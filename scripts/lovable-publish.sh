#!/usr/bin/env bash
# Publish the Lovable project via the public API (version 2026-09-11).
#
# Lovable ingests a GitHub push through its GitHub app before that commit
# exists in the project snapshot. There is no API to ask whether sync has
# finished, so this script sleeps for SYNC_WAIT_SECONDS (default 90) and only
# then POSTs /v1/projects/{project_id}/publish. A short wait publishes the
# previous snapshot.
#
# Required environment:
#   LOV_PUBLIC_API_KEY   Workspace access token (projects:write, and
#                        workspaces:read when the project id must be resolved).
#                        Never printed.
# Optional:
#   LOVABLE_PROJECT_ID        API project id. This API uses UUIDs (and may also
#                             use prj_... ids). Both are sent to publish as-is.
#                             When unset, this repo's project UUID is used
#                             (DEFAULT_PROJECT_UUID). A UUID that gets HTTP 404
#                             is looked up from GET /v1/workspaces and
#                             GET /v1/projects.
#   SYNC_WAIT_SECONDS         Seconds to wait for GitHub sync. Default 90.
#   PUBLISH_TIMEOUT_SECONDS   Budget for the POST and status polls. Default 900.
#   CURL_MAX_TIME             Per-request curl limit in seconds. Default 90.
#   LOVABLE_API_BASE          Override for tests. Default https://api.lovable.dev.
#
# On success, prints the deployment id and live URL, and appends both to
# $GITHUB_STEP_SUMMARY when that file is set. Exits non-zero on a missing
# secret, a non-2xx POST, a security refusal, a deployment error, or timeout.
# A POST that returns 503 (or times out in curl) is not retried: Lovable's 60s
# request_timeout can mean the publish still started.

set -euo pipefail
set +x

API_VERSION="2026-09-11"
API_BASE="${LOVABLE_API_BASE:-https://api.lovable.dev}"
# This repo's Lovable project id. The editor URL uses the same UUID:
# https://lovable.dev/projects/5d824616-a50a-49a4-9b57-8fb62de744ee
# Used when LOVABLE_PROJECT_ID is unset. Publish accepts this UUID directly.
DEFAULT_PROJECT_UUID="5d824616-a50a-49a4-9b57-8fb62de744ee"
LIST_PAGE_LIMIT=100
MAX_LIST_PAGES=100
PUBLISH_LOOKUP_DONE=0
SYNC_WAIT_SECONDS="${SYNC_WAIT_SECONDS:-90}"
PUBLISH_TIMEOUT_SECONDS="${PUBLISH_TIMEOUT_SECONDS:-900}"
MIN_POLL_SECONDS=2
MAX_POLL_SECONDS=10
CURL_MAX_TIME="${CURL_MAX_TIME:-90}"

HTTP_CODE=""
CURL_EXIT=0
POLL_INTERVAL=$MIN_POLL_SECONDS
DEADLINE=0
LAST_STATUS=""
LAST_DEPLOYMENT_ID=""
RESPONSE_FILE=""
TMPDIR_PUBLISH=""

fail() {
  local message="$1"
  printf 'ERROR: %s\n' "$message" | redact_stream >&2
  emit_error "${message}"
  exit 1
}

emit_error() {
  local message
  message=$(redact_text "$1")
  message=${message//$'\r'/ }
  message=${message//$'\n'/ }
  message=${message//'%'/'%25'}
  printf '%s\n' "::error::${message}"
}

add_mask() {
  local value="$1"
  local encoded="$value"
  encoded=${encoded//'%'/'%25'}
  encoded=${encoded//$'\r'/'%0D'}
  encoded=${encoded//$'\n'/'%0A'}
  printf '%s\n' "::add-mask::${encoded}"
}

require_command() {
  local name="$1"
  if ! command -v "$name" >/dev/null 2>&1; then
    fail "${name} is required but was not found on PATH."
  fi
}

require_nonnegative_integer() {
  local name="$1"
  local value="$2"
  if [[ ! "$value" =~ ^[0-9]+$ ]]; then
    fail "${name} must be a non-negative integer (got: ${value})."
  fi
}

json_get() {
  local file="$1"
  local expr="$2"
  local value=""
  if [[ ! -s "$file" ]]; then
    printf ''
    return 0
  fi
  value=$(jq -r "${expr} // empty" "$file" 2>/dev/null || true)
  if [[ "$value" == "null" ]]; then
    value=""
  fi
  printf '%s' "$value"
}

print_body() {
  local file="$1"
  local pretty
  if [[ ! -s "$file" ]]; then
    echo "(empty body)"
    return 0
  fi
  pretty="${TMPDIR_PUBLISH}/pretty.json"
  if jq . "$file" >"$pretty" 2>/dev/null; then
    redact_file "$pretty"
  else
    redact_file "$file"
  fi
}

redact_stream() {
  awk '
    BEGIN {
      key = ENVIRON["LOV_PUBLIC_API_KEY"]
      repl = "***"
    }
    {
      line = $0
      out = ""
      while (length(key) > 0 && (i = index(line, key)) > 0) {
        out = out substr(line, 1, i - 1) repl
        line = substr(line, i + length(key))
      }
      print out line
    }
  '
}

redact_text() {
  printf '%s' "$1" | redact_stream
}

redact_file() {
  local file="$1"
  redact_stream <"$file"
}

retry_after_seconds() {
  local raw
  raw=$(awk 'BEGIN { IGNORECASE = 1 }
    /^retry-after:/ {
      sub(/^[^:]*:[[:space:]]*/, "")
      gsub(/[[:space:]]/, "")
      print
      exit
    }
  ' "${TMPDIR_PUBLISH}/headers" 2>/dev/null || true)
  if [[ "$raw" =~ ^[0-9]+$ ]]; then
    printf '%s' "$raw"
  fi
}

header_value() {
  local name="$1"
  awk -v name="$name" 'BEGIN { IGNORECASE = 1 }
    {
      line = $0
      sub(/\r$/, "", line)
      colon = index(line, ":")
      if (colon == 0) {
        next
      }
      key = substr(line, 1, colon - 1)
      if (tolower(key) == tolower(name)) {
        value = substr(line, colon + 1)
        sub(/^[[:space:]]+/, "", value)
        print value
        exit
      }
    }
  ' "${TMPDIR_PUBLISH}/headers" 2>/dev/null || true
}

deployment_id_from_location() {
  local location="$1"
  location=${location%%\?*}
  location=${location%%#*}
  if [[ "$location" =~ /publish/([A-Za-z0-9_-]+)$ ]]; then
    printf '%s' "${BASH_REMATCH[1]}"
  fi
}

deployment_id_from_body() {
  local file="$1"
  local id status
  id=$(json_get "$file" '.id')
  status=$(json_get "$file" '.status')
  case "$status" in
    running | completed | error | unknown)
      if [[ "$id" =~ ^[A-Za-z0-9_-]+$ ]]; then
        printf '%s' "$id"
      fi
      ;;
  esac
}

sleep_seconds() {
  local seconds="$1"
  local reason="${2:-}"
  local now remaining
  if (( seconds <= 0 )); then
    return 0
  fi
  if (( DEADLINE > 0 )); then
    now=$(date +%s)
    remaining=$((DEADLINE - now))
    if (( remaining <= 0 )); then
      return 0
    fi
    if (( seconds > remaining )); then
      seconds=$remaining
    fi
  fi
  if [[ -n "$reason" ]]; then
    echo "$reason"
  fi
  sleep "$seconds"
}

bump_poll_interval() {
  if (( POLL_INTERVAL < MAX_POLL_SECONDS )); then
    POLL_INTERVAL=$((POLL_INTERVAL + 2))
    if (( POLL_INTERVAL > MAX_POLL_SECONDS )); then
      POLL_INTERVAL=$MAX_POLL_SECONDS
    fi
  fi
}

past_deadline() {
  local now
  now=$(date +%s)
  if (( DEADLINE > 0 && now >= DEADLINE )); then
    return 0
  fi
  return 1
}

describe_error_class() {
  local class="$1"
  case "$class" in
    transient)
      echo "Lovable classifies this failure as transient. This script does not send another POST."
      ;;
    code)
      echo "Lovable says to fix the app code or SQL, then publish again."
      ;;
    configuration)
      echo "Lovable says to fix configuration committed in the project, then publish again."
      ;;
    data)
      echo "Lovable says to review the migration against production data and get human approval before publishing again."
      ;;
    integration)
      echo "Lovable says to repair external credentials, quota, or the connected service, then publish again."
      ;;
    policy)
      echo "Lovable says a workspace administrator must lift the blocking policy or approve the publish."
      ;;
    internal)
      echo "Lovable says to contact Lovable support with the deployment id."
      ;;
    "")
      echo "error_class is empty. Use error_message and contact Lovable support. This script does not send another POST."
      ;;
    *)
      echo "Unrecognized error_class. Use error_message and contact Lovable support. This script does not send another POST."
      ;;
  esac
}

fail_with_response() {
  local context="$1"
  local code="$2"
  local file="$3"
  local err_type detail request_id refs class message summary
  err_type=$(json_get "$file" '.type')
  detail=$(json_get "$file" '.detail')
  request_id=$(json_get "$file" '.request_id')
  class=$(json_get "$file" '.error_class')
  message=$(json_get "$file" '.error_message')
  refs=$(jq -r 'try ((.props.finding_refs // []) | map(tostring) | join(", ")) catch empty' "$file" 2>/dev/null || true)
  if [[ -z "$request_id" ]]; then
    request_id=$(header_value "X-Request-Id" || true)
  fi

  {
    echo "Lovable publish failed during ${context}."
    echo "HTTP status: ${code}"
    if [[ -n "$err_type" ]]; then
      echo "type: ${err_type}"
    fi
    if [[ -n "$detail" ]]; then
      echo "detail: ${detail}"
    fi
    if [[ -n "$request_id" ]]; then
      echo "request_id: ${request_id}"
    fi
    if [[ -n "$refs" ]]; then
      echo "finding_refs: ${refs}"
    fi
    if [[ -n "$class" ]]; then
      echo "error_class: ${class}"
    fi
    if [[ -n "$message" ]]; then
      echo "error_message: ${message}"
    fi
    echo "Response body:"
    print_body "$file"
  } | redact_stream >&2

  summary="Lovable publish failed during ${context} (HTTP ${code})"
  if [[ -n "$err_type" ]]; then
    summary="${summary}, type ${err_type}"
  fi
  if [[ "$err_type" == "security_critical_findings" && -n "$refs" ]]; then
    summary="${summary}, finding_refs ${refs}"
  fi
  if [[ -n "$class" || -n "$message" ]]; then
    summary="${summary}, error_class ${class:-empty}, error_message ${message:-empty}"
  fi
  emit_error "${summary}."
  exit 1
}

fail_deployment_error() {
  local file="$1"
  local deployment_id="$2"
  local class message
  class=$(json_get "$file" '.error_class')
  message=$(json_get "$file" '.error_message')
  {
    echo "Lovable publish failed. Deployment status is error."
    echo "HTTP status: ${HTTP_CODE}"
    echo "Deployment id: ${deployment_id}"
    echo "error_class: ${class:-null}"
    echo "error_message: ${message:-null}"
    describe_error_class "$class"
    echo "Response body:"
    print_body "$file"
  } | redact_stream >&2
  emit_error "Lovable deployment ${deployment_id} failed (error_class ${class:-null}): ${message:-no error_message}."
  exit 1
}

fail_timeout() {
  local context="$1"
  {
    echo "Lovable publish timed out after ${PUBLISH_TIMEOUT_SECONDS}s (${context})."
    if [[ -n "$LAST_DEPLOYMENT_ID" ]]; then
      echo "Deployment id: ${LAST_DEPLOYMENT_ID}"
    fi
    if [[ -n "$LAST_STATUS" ]]; then
      echo "Last deployment status: ${LAST_STATUS}"
    fi
    if [[ -n "$HTTP_CODE" ]]; then
      echo "Last HTTP status: ${HTTP_CODE}"
    fi
    if [[ -n "$RESPONSE_FILE" && -f "$RESPONSE_FILE" ]]; then
      echo "Last response body:"
      print_body "$RESPONSE_FILE"
    fi
  } | redact_stream >&2
  emit_error "Lovable publish timed out after ${PUBLISH_TIMEOUT_SECONDS}s (${context})."
  exit 1
}

# POST that ended in 503 or a client timeout may already have started a
# deployment. Never send a second POST. Poll only when the response tells us
# which deployment to read.
fail_indeterminate_post() {
  local reason="$1"
  local file="$2"
  local deployment_id
  deployment_id=$(deployment_id_from_body "$file")
  if [[ -z "$deployment_id" ]]; then
    deployment_id=$(deployment_id_from_location "$(header_value "Location" || true)")
  fi
  if [[ -n "$deployment_id" ]]; then
    echo "POST did not return a clean 202 (${reason}). A deployment id was present, so this script will poll it and will not send another POST."
    echo "Deployment id: ${deployment_id}"
    poll_deployment "$deployment_id"
    return 0
  fi
  {
    echo "Lovable publish POST did not return a deployment id (${reason})."
    echo "HTTP status: ${HTTP_CODE:-none}"
    echo "A 503 request_timeout (Lovable's processing deadline is about 60s) can mean the publish still started."
    echo "This script will not send another POST. Check the project in Lovable before running the workflow again."
    if [[ -f "$file" ]]; then
      echo "Response body:"
      print_body "$file"
    fi
  } | redact_stream >&2
  emit_error "Lovable publish POST ${reason}. No deployment id was returned, so status was not polled and no second POST was sent."
  exit 1
}

do_request() {
  local method="$1"
  local url="$2"
  local -a args=()
  HTTP_CODE=""
  CURL_EXIT=0
  RESPONSE_FILE="${TMPDIR_PUBLISH}/response.json"
  : >"${TMPDIR_PUBLISH}/headers"
  : >"$RESPONSE_FILE"

  args=(
    --silent
    --show-error
    --request "$method"
    --url "$url"
    --header @"${TMPDIR_PUBLISH}/api-key-header"
    --header "Lovable-Version: ${API_VERSION}"
    --header "Accept: application/json"
    --dump-header "${TMPDIR_PUBLISH}/headers"
    --output "$RESPONSE_FILE"
    --max-time "$CURL_MAX_TIME"
    --write-out '%{http_code}'
  )
  if [[ "$method" == "POST" ]]; then
    args+=(--header "Content-Type: application/json" --data-binary '{}')
  fi

  set +e
  HTTP_CODE=$(curl "${args[@]}")
  CURL_EXIT=$?
  set -e
  if [[ -z "$HTTP_CODE" ]]; then
    HTTP_CODE="000"
  fi
}

accept_deployment() {
  local file="$1"
  local deployment_id status live_url
  deployment_id=$(deployment_id_from_body "$file")
  if [[ -z "$deployment_id" ]]; then
    deployment_id=$(json_get "$file" '.id')
  fi
  if [[ ! "$deployment_id" =~ ^[A-Za-z0-9_-]+$ ]]; then
    fail_with_response "reading the publish response (missing deployment id)" "$HTTP_CODE" "$file"
  fi
  status=$(json_get "$file" '.status')
  LAST_DEPLOYMENT_ID="$deployment_id"
  LAST_STATUS="$status"
  echo "Publish accepted. Deployment id: ${deployment_id}. Status: ${status:-unknown}."
  case "$status" in
    completed)
      live_url=$(json_get "$file" '.url')
      if [[ -z "$live_url" ]]; then
        fail_with_response "a completed deployment with no url" "$HTTP_CODE" "$file"
      fi
      report_success "$deployment_id" "$live_url"
      ;;
    error)
      fail_deployment_error "$file" "$deployment_id"
      ;;
    *)
      poll_deployment "$deployment_id"
      ;;
  esac
}

report_success() {
  local deployment_id live_url
  deployment_id=$(redact_text "$1")
  live_url=$(redact_text "$2")
  echo "Lovable publish completed."
  echo "Deployment id: ${deployment_id}"
  echo "Live URL: ${live_url}"
  if [[ -n "${GITHUB_STEP_SUMMARY:-}" ]]; then
    {
      echo "## Lovable publish"
      echo
      echo "- Deployment id: \`${deployment_id}\`"
      echo "- Live URL: ${live_url}"
    } >>"$GITHUB_STEP_SUMMARY"
  fi
}

poll_deployment() {
  local deployment_id="$1"
  local url status live_url retry
  url="${API_BASE}/v1/projects/${LOVABLE_PROJECT_ID}/publish/${deployment_id}"
  LAST_DEPLOYMENT_ID="$deployment_id"
  POLL_INTERVAL=$MIN_POLL_SECONDS

  while true; do
    if past_deadline; then
      fail_timeout "waiting for deployment ${deployment_id}"
    fi

    echo "Polling deployment ${deployment_id}."
    do_request GET "$url"

    if (( CURL_EXIT != 0 )); then
      echo "Status request failed before an HTTP response (curl exit ${CURL_EXIT}). Retrying until the deadline." >&2
      if past_deadline; then
        fail_timeout "status request failed (curl exit ${CURL_EXIT})"
      fi
      sleep_seconds "$POLL_INTERVAL" "Waiting ${POLL_INTERVAL}s before the next status poll."
      bump_poll_interval
      continue
    fi

    if [[ "$HTTP_CODE" == "429" ]]; then
      retry=$(retry_after_seconds || true)
      if [[ -z "$retry" ]]; then
        retry=$POLL_INTERVAL
        echo "Rate limited (HTTP 429) with no integer Retry-After. Waiting ${retry}s." >&2
      else
        if (( retry < MIN_POLL_SECONDS )); then
          retry=$MIN_POLL_SECONDS
        fi
        echo "Rate limited (HTTP 429). Waiting ${retry}s from Retry-After." >&2
      fi
      if past_deadline; then
        fail_with_response "polling deployment ${deployment_id} (rate limited at the deadline)" "$HTTP_CODE" "$RESPONSE_FILE"
      fi
      sleep_seconds "$retry" "Waiting ${retry}s before the next status poll."
      bump_poll_interval
      continue
    fi

    if [[ "$HTTP_CODE" =~ ^5 ]]; then
      {
        echo "Status request returned HTTP ${HTTP_CODE}. Retrying the GET until the deadline."
        echo "Response body:"
        print_body "$RESPONSE_FILE"
      } | redact_stream >&2
      if past_deadline; then
        fail_with_response "polling deployment ${deployment_id}" "$HTTP_CODE" "$RESPONSE_FILE"
      fi
      sleep_seconds "$POLL_INTERVAL" "Waiting ${POLL_INTERVAL}s before the next status poll."
      bump_poll_interval
      continue
    fi

    if [[ ! "$HTTP_CODE" =~ ^2 ]]; then
      fail_with_response "polling deployment ${deployment_id}" "$HTTP_CODE" "$RESPONSE_FILE"
    fi

    status=$(json_get "$RESPONSE_FILE" '.status')
    LAST_STATUS="$status"
    echo "Deployment ${deployment_id} status: ${status:-empty}."

    case "$status" in
      completed)
        live_url=$(json_get "$RESPONSE_FILE" '.url')
        if [[ -z "$live_url" ]]; then
          fail_with_response "deployment ${deployment_id} (status completed, url empty)" "$HTTP_CODE" "$RESPONSE_FILE"
        fi
        report_success "$deployment_id" "$live_url"
        return 0
        ;;
      error)
        fail_deployment_error "$RESPONSE_FILE" "$deployment_id"
        ;;
      running | unknown)
        if past_deadline; then
          fail_timeout "deployment ${deployment_id} still ${status}"
        fi
        sleep_seconds "$POLL_INTERVAL" "Waiting ${POLL_INTERVAL}s before the next status poll."
        bump_poll_interval
        ;;
      *)
        echo "Unrecognized deployment status '${status:-empty}'. Continuing until the deadline." >&2
        if past_deadline; then
          fail_timeout "deployment ${deployment_id} still ${status:-empty}"
        fi
        sleep_seconds "$POLL_INTERVAL" "Waiting ${POLL_INTERVAL}s before the next status poll."
        bump_poll_interval
        ;;
    esac
  done
}

start_publish() {
  local url attempt retry previous
  local max_attempts=5
  url="${API_BASE}/v1/projects/${LOVABLE_PROJECT_ID}/publish"
  attempt=0

  while true; do
    if past_deadline; then
      fail_timeout "before Lovable accepted the publish"
    fi
    attempt=$((attempt + 1))
    echo "Starting publish (attempt ${attempt}) for project ${LOVABLE_PROJECT_ID}."
    do_request POST "$url"

    if (( CURL_EXIT != 0 )); then
      if (( CURL_EXIT == 28 )); then
        fail_indeterminate_post "curl timed out after ${CURL_MAX_TIME}s (exit 28) waiting for the POST response" "$RESPONSE_FILE"
      else
        fail_indeterminate_post "curl failed with exit ${CURL_EXIT} before a usable HTTP response" "$RESPONSE_FILE"
      fi
      return 0
    fi

    if [[ "$HTTP_CODE" == "429" ]]; then
      retry=$(retry_after_seconds || true)
      if [[ -z "$retry" ]]; then
        retry=$MIN_POLL_SECONDS
      fi
      {
        echo "Publish POST was rate limited (HTTP 429)."
        echo "Response body:"
        print_body "$RESPONSE_FILE"
      } | redact_stream >&2
      if (( attempt >= max_attempts )); then
        fail_with_response "POST /publish after ${max_attempts} rate-limit responses" "$HTTP_CODE" "$RESPONSE_FILE"
      fi
      if past_deadline; then
        fail_with_response "POST /publish (rate limited at the deadline)" "$HTTP_CODE" "$RESPONSE_FILE"
      fi
      sleep_seconds "$retry" "Waiting ${retry}s (Retry-After) before retrying the publish POST."
      continue
    fi

    if [[ "$HTTP_CODE" == "503" ]]; then
      fail_indeterminate_post "HTTP 503" "$RESPONSE_FILE"
      return 0
    fi

    # A UUID is a valid project id. Publish it directly. Look the id up only
    # when Lovable says that project does not exist.
    if [[ "$HTTP_CODE" == "404" && "$PUBLISH_LOOKUP_DONE" != "1" ]] && is_uuid "$LOVABLE_PROJECT_ID"; then
      PUBLISH_LOOKUP_DONE=1
      previous="$LOVABLE_PROJECT_ID"
      cp "$RESPONSE_FILE" "${TMPDIR_PUBLISH}/publish-404.json"
      echo "Publish returned HTTP 404 for project ${previous}. Looking up the project id from the workspace list."
      resolve_lovable_project_id "$previous"
      if [[ "${LOVABLE_PROJECT_ID,,}" == "${previous,,}" ]]; then
        HTTP_CODE=404
        fail_with_response "POST /publish" "404" "${TMPDIR_PUBLISH}/publish-404.json"
      fi
      url="${API_BASE}/v1/projects/${LOVABLE_PROJECT_ID}/publish"
      continue
    fi

    if [[ ! "$HTTP_CODE" =~ ^2 ]]; then
      fail_with_response "POST /publish" "$HTTP_CODE" "$RESPONSE_FILE"
    fi

    accept_deployment "$RESPONSE_FILE"
    return 0
  done
}

is_uuid() {
  local value="$1"
  [[ "$value" =~ ^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$ ]]
}

publishable_project_id() {
  local value="$1"
  [[ "$value" =~ ^[A-Za-z0-9_-]+$ ]]
}

trim_whitespace() {
  local value="$1"
  value="${value#"${value%%[![:space:]]*}"}"
  value="${value%"${value##*[![:space:]]}"}"
  printf '%s' "$value"
}

classify_lovable_project_id() {
  local raw
  raw=$(trim_whitespace "${LOVABLE_PROJECT_ID:-}")
  LOVABLE_PROJECT_ID="$raw"
  if [[ -z "$LOVABLE_PROJECT_ID" ]]; then
    LOVABLE_PROJECT_ID="$DEFAULT_PROJECT_UUID"
    echo "LOVABLE_PROJECT_ID is not set. Using ${LOVABLE_PROJECT_ID} as the API project id."
    return 0
  fi
  if is_uuid "$LOVABLE_PROJECT_ID"; then
    echo "LOVABLE_PROJECT_ID is a UUID. Using it as the API project id."
    return 0
  fi
  if ! publishable_project_id "$LOVABLE_PROJECT_ID"; then
    fail "LOVABLE_PROJECT_ID contains characters that cannot go in the publish URL."
  fi
}

lovable_list_url() {
  local path="$1"
  local workspace_id="${2:-}"
  local cursor="${3:-}"
  jq -nr \
    --arg base "${API_BASE%/}" \
    --arg path "$path" \
    --arg workspace_id "$workspace_id" \
    --arg cursor "$cursor" \
    --arg limit "$LIST_PAGE_LIMIT" \
    '
      [$base, $path] | join("") as $root
      | [
          (if $workspace_id != "" then "workspace_id=\($workspace_id | @uri)" else empty end),
          "limit=\($limit | @uri)",
          (if $cursor != "" then "cursor=\($cursor | @uri)" else empty end)
        ]
      | join("&")
      | "\($root)?\(.)"
    '
}

# GET a list page. Retries rate limits and 5xx. Does not retry a publish POST.
list_get() {
  local context="$1"
  local url="$2"
  local attempt=0
  local max_attempts=5
  local retry
  while true; do
    if past_deadline; then
      fail_timeout "while ${context}"
    fi
    attempt=$((attempt + 1))
    do_request GET "$url"
    if (( CURL_EXIT != 0 )); then
      echo "GET failed before an HTTP response while ${context} (curl exit ${CURL_EXIT})." >&2
      if (( attempt >= max_attempts )); then
        fail "GET failed while ${context} (curl exit ${CURL_EXIT})."
      fi
      sleep_seconds "$MIN_POLL_SECONDS" "Waiting ${MIN_POLL_SECONDS}s before retrying ${context}."
      continue
    fi
    if [[ "$HTTP_CODE" == "429" ]]; then
      retry=$(retry_after_seconds || true)
      if [[ -z "$retry" ]]; then
        retry=$MIN_POLL_SECONDS
      fi
      {
        echo "Rate limited (HTTP 429) while ${context}."
        echo "Response body:"
        print_body "$RESPONSE_FILE"
      } | redact_stream >&2
      if (( attempt >= max_attempts )); then
        fail_with_response "${context} after ${max_attempts} rate-limit responses" "$HTTP_CODE" "$RESPONSE_FILE"
      fi
      sleep_seconds "$retry" "Waiting ${retry}s before retrying ${context}."
      continue
    fi
    if [[ "$HTTP_CODE" =~ ^5 ]]; then
      {
        echo "HTTP ${HTTP_CODE} while ${context}. Retrying the GET."
        echo "Response body:"
        print_body "$RESPONSE_FILE"
      } | redact_stream >&2
      if (( attempt >= max_attempts )); then
        fail_with_response "${context}" "$HTTP_CODE" "$RESPONSE_FILE"
      fi
      sleep_seconds "$MIN_POLL_SECONDS" "Waiting ${MIN_POLL_SECONDS}s before retrying ${context}."
      continue
    fi
    if [[ ! "$HTTP_CODE" =~ ^2 ]]; then
      fail_with_response "${context}" "$HTTP_CODE" "$RESPONSE_FILE"
    fi
    return 0
  done
}

read_page_document() {
  local kind="$1"
  local file="$2"
  local parsed list_key keys
  list_key="${kind}s"
  parsed="${TMPDIR_PUBLISH}/page-parsed.json"
  if [[ ! -s "$file" ]]; then
    fail "Empty response while listing ${kind}s."
  fi
  if ! jq empty "$file" >/dev/null 2>&1; then
    fail_with_response "listing ${kind}s (response was not JSON)" "$HTTP_CODE" "$file"
  fi
  if ! jq -c --arg list_key "$list_key" '
    def items:
      if type == "array" then .
      elif (.data | type) == "array" then .data
      elif (.[$list_key] | type) == "array" then .[$list_key]
      elif .data == null and ((.pagination | type) == "object") then []
      else null end;
    def flag:
      if (.pagination.has_more | type) == "boolean" then .pagination.has_more
      elif (.pagination.has_more | type) == "string" then (.pagination.has_more == "true")
      elif (.has_more | type) == "boolean" then .has_more
      elif (.has_more | type) == "string" then (.has_more == "true")
      else false end;
    def cursor:
      (.pagination.next_cursor // .next_cursor // "")
      | if type == "string" then .
        elif . == null then ""
        else tostring end;
    (items) as $items
    | if $items == null then
        {
          ok: false,
          items: [],
          has_more: false,
          next_cursor: "",
          keys: (if type == "object" then (keys | join(", ")) else type end)
        }
      else
        {ok: true, items: $items, has_more: flag, next_cursor: cursor, keys: ""}
      end
  ' "$file" >"$parsed"; then
    fail_with_response "listing ${kind}s (could not parse the page)" "$HTTP_CODE" "$file"
  fi
  if [[ "$(jq -r '.ok' "$parsed")" != "true" ]]; then
    keys=$(jq -r '.keys' "$parsed")
    {
      echo "Could not find a ${kind} list in the response."
      echo "Top-level keys: ${keys:-"(none)"}"
      echo "Response body:"
      print_body "$file"
    } | redact_stream >&2
    fail "Could not find a ${kind} list in the Lovable response (top-level: ${keys:-none})."
  fi
  cp "$parsed" "${TMPDIR_PUBLISH}/page.json"
}

page_has_more() {
  jq -r '.has_more' "${TMPDIR_PUBLISH}/page.json"
}

page_next_cursor() {
  jq -r '.next_cursor // ""' "${TMPDIR_PUBLISH}/page.json"
}

# Sets PAGE_CURSOR when another page exists. Returning 1 means the list is finished.
# fail() must run in the current shell, so callers cannot capture this function.
advance_cursor() {
  local context="$1"
  local seen="$2"
  local has_more next
  PAGE_CURSOR=""
  has_more=$(page_has_more)
  if [[ "$has_more" != "true" ]]; then
    return 1
  fi
  next=$(page_next_cursor)
  if [[ -z "$next" ]]; then
    fail "${context} reported pagination.has_more but no next_cursor."
  fi
  if [[ "$next" == *$'\n'* || "$next" == *$'\r'* ]]; then
    fail "${context} returned a pagination cursor with a line break."
  fi
  if grep -Fxq -- "$next" "$seen"; then
    fail "${context} repeated a pagination cursor."
  fi
  printf '%s\n' "$next" >>"$seen"
  PAGE_CURSOR="$next"
  return 0
}

collect_workspaces() {
  local url cursor="" page=0 seen
  seen="${TMPDIR_PUBLISH}/workspace-cursors.txt"
  : >"$seen"
  : >"${TMPDIR_PUBLISH}/workspace-ids.txt"
  while true; do
    page=$((page + 1))
    if (( page > MAX_LIST_PAGES )); then
      fail "Stopped listing workspaces after ${MAX_LIST_PAGES} pages."
    fi
    url=$(lovable_list_url "/v1/workspaces" "" "$cursor")
    echo "Listing workspaces (page ${page})."
    list_get "listing workspaces" "$url"
    cp "$RESPONSE_FILE" "${TMPDIR_PUBLISH}/list-body.json"
    read_page_document "workspace" "${TMPDIR_PUBLISH}/list-body.json"
    jq -r '
      .items[]
      | if (.id | type) == "string" and (.id | length) > 0 then .id
        elif (.workspace_id | type) == "string" and (.workspace_id | length) > 0 then .workspace_id
        else empty end
    ' "${TMPDIR_PUBLISH}/page.json" >>"${TMPDIR_PUBLISH}/workspace-ids.txt"
    if ! advance_cursor "Workspace list" "$seen"; then
      break
    fi
    cursor="$PAGE_CURSOR"
  done
  awk 'NF && !seen[$0]++' "${TMPDIR_PUBLISH}/workspace-ids.txt" >"${TMPDIR_PUBLISH}/workspace-ids.uniq"
  mv "${TMPDIR_PUBLISH}/workspace-ids.uniq" "${TMPDIR_PUBLISH}/workspace-ids.txt"
}

append_projects() {
  local uuid_lc="$1"
  jq -c --arg uuid "$uuid_lc" '
    .items[]
    | . as $project
    | {
        id: (if ($project.id | type) == "string" then $project.id else "" end),
        name: (
          ($project.name // $project.display_name // "")
          | if type == "string" then gsub("[\r\n\t]"; " ") else "" end
        ),
        match: (($project | tostring | ascii_downcase) | contains($uuid)),
        exact: (
          (($project.id // "") | if type == "string" then ascii_downcase else "" end) == $uuid
        )
      }
  ' "${TMPDIR_PUBLISH}/page.json" >>"${TMPDIR_PUBLISH}/project-rows.jsonl"
}

collect_projects() {
  local uuid_lc="$1"
  local workspace_id url cursor page seen
  : >"${TMPDIR_PUBLISH}/project-rows.jsonl"
  while IFS= read -r workspace_id || [[ -n "${workspace_id:-}" ]]; do
    workspace_id=${workspace_id%$'\r'}
    if [[ -z "$workspace_id" ]]; then
      continue
    fi
    cursor=""
    page=0
    seen="${TMPDIR_PUBLISH}/project-cursors.txt"
    : >"$seen"
    while true; do
      page=$((page + 1))
      if (( page > MAX_LIST_PAGES )); then
        fail "Stopped listing projects for workspace ${workspace_id} after ${MAX_LIST_PAGES} pages."
      fi
      url=$(lovable_list_url "/v1/projects" "$workspace_id" "$cursor")
      echo "Listing projects in workspace ${workspace_id} (page ${page})."
      list_get "listing projects" "$url"
      cp "$RESPONSE_FILE" "${TMPDIR_PUBLISH}/list-body.json"
      read_page_document "project" "${TMPDIR_PUBLISH}/list-body.json"
      append_projects "$uuid_lc"
      if ! advance_cursor "Project list for workspace ${workspace_id}" "$seen"; then
        break
      fi
      cursor="$PAGE_CURSOR"
    done
  done <"${TMPDIR_PUBLISH}/workspace-ids.txt"
}

project_catalog() {
  local rows="${TMPDIR_PUBLISH}/project-rows.jsonl"
  local out="${TMPDIR_PUBLISH}/project-catalog.json"
  if [[ ! -s "$rows" ]]; then
    printf '[]\n' >"$out"
    return 0
  fi
  jq -s '
    reduce .[] as $row (
      [];
      if any(.[]; .id == $row.id) then
        map(
          if .id == $row.id then
            .match = (.match or ($row.match == true))
            | .exact = ((.exact // false) or ($row.exact == true))
            | if (.name | length) == 0 then .name = ($row.name // "") else . end
          else
            .
          end
        )
      else
        . + [{
          id: ($row.id // ""),
          name: ($row.name // ""),
          match: ($row.match == true),
          exact: ($row.exact == true)
        }]
      end
    )
  ' "$rows" >"$out"
}

format_project_catalog() {
  local mode="$1"
  jq -r --arg mode "$mode" '
    (if $mode == "exact" then map(select(.exact)) else map(select(.match)) end)
    | if length == 0 then "(none)"
      else
        map(
          (.id | if length == 0 then "(no id)" else . end) as $id
          | (.name | if length == 0 then "(no name)" else . end) as $name
          | "- \($id)  \($name)"
        )
        | join("\n")
      end
  ' "${TMPDIR_PUBLISH}/project-catalog.json"
}

note_resolved_project_id() {
  local project_id name
  project_id=$(redact_text "$1")
  name=$(redact_text "$2")
  name=${name//\`/\'}
  echo "Resolved Lovable API project id: ${project_id}"
  if [[ -n "$name" ]]; then
    echo "Matched project name: ${name}"
  fi
  echo "This id is not a secret. Optionally store it as the LOVABLE_PROJECT_ID repository secret to skip this lookup on later runs."
  if [[ -n "${GITHUB_STEP_SUMMARY:-}" ]]; then
    {
      echo "## Lovable project id"
      echo
      echo "Resolved API project id: \`${project_id}\`"
      if [[ -n "$name" ]]; then
        echo
        echo "Matched project name: ${name}"
      fi
      echo
      echo "This id is not a secret. Optionally store it as the \`LOVABLE_PROJECT_ID\` repository secret to skip this lookup on later runs."
    } >>"$GITHUB_STEP_SUMMARY"
  fi
}

accept_resolved_project_id() {
  local id="$1"
  local name="$2"
  local uuid_lc="$3"
  if ! publishable_project_id "$id"; then
    fail "Matched project id '${id}' cannot go in the publish URL."
  fi
  LOVABLE_PROJECT_ID="$id"
  if [[ "${id,,}" == "$uuid_lc" ]]; then
    echo "A listed project id matches ${id} exactly. Using that id."
    return 0
  fi
  note_resolved_project_id "$id" "$name"
}

resolve_lovable_project_id() {
  local uuid="$1"
  local uuid_lc exact_count count id name catalog scanned
  if ! is_uuid "$uuid"; then
    fail "Cannot look up a Lovable project id without a UUID."
  fi
  uuid_lc=$(printf '%s' "$uuid" | tr '[:upper:]' '[:lower:]')
  echo "Looking up project id for UUID ${uuid_lc}."
  collect_workspaces
  if [[ ! -s "${TMPDIR_PUBLISH}/workspace-ids.txt" ]]; then
    fail "No workspaces were returned. The API key needs workspaces:read. See docs/lovable-auto-publish.md."
  fi
  collect_projects "$uuid_lc"
  project_catalog
  scanned=$(jq -r 'length' "${TMPDIR_PUBLISH}/project-catalog.json")
  exact_count=$(jq -r 'map(select(.exact)) | length' "${TMPDIR_PUBLISH}/project-catalog.json")
  if [[ "$exact_count" == "1" ]]; then
    id=$(jq -r 'map(select(.exact))[0].id' "${TMPDIR_PUBLISH}/project-catalog.json")
    name=$(jq -r 'map(select(.exact))[0].name // ""' "${TMPDIR_PUBLISH}/project-catalog.json")
    accept_resolved_project_id "$id" "$name" "$uuid_lc"
    return 0
  fi
  if [[ "$exact_count" != "0" ]]; then
    catalog=$(format_project_catalog exact)
    fail "$(printf '%s\n' \
      "UUID ${uuid_lc} is the id of ${exact_count} listed projects. Expected one." \
      "Set LOVABLE_PROJECT_ID to the project id you want to publish." \
      "Matched projects:" \
      "$catalog")"
  fi
  count=$(jq -r 'map(select(.match)) | length' "${TMPDIR_PUBLISH}/project-catalog.json")
  if [[ "$count" == "0" ]]; then
    fail "$(printf '%s\n' \
      "No listed project has id ${uuid_lc}, and none contains that UUID." \
      "Searched ${scanned} projects." \
      "Set LOVABLE_PROJECT_ID to the project id you want to publish.")"
  fi
  if [[ "$count" != "1" ]]; then
    catalog=$(format_project_catalog match)
    fail "$(printf '%s\n' \
      "UUID ${uuid_lc} is not a project id, and ${count} projects contain it. Expected one." \
      "Set LOVABLE_PROJECT_ID to the project id you want to publish." \
      "Matched projects:" \
      "$catalog")"
  fi
  id=$(jq -r 'map(select(.match))[0].id' "${TMPDIR_PUBLISH}/project-catalog.json")
  name=$(jq -r 'map(select(.match))[0].name // ""' "${TMPDIR_PUBLISH}/project-catalog.json")
  accept_resolved_project_id "$id" "$name" "$uuid_lc"
}

main() {
  if [[ "${GITHUB_ACTIONS:-}" == "true" && -n "${LOV_PUBLIC_API_KEY:-}" ]]; then
    add_mask "$LOV_PUBLIC_API_KEY"
  fi

  if [[ -z "${LOV_PUBLIC_API_KEY:-}" ]]; then
    echo "ERROR: LOV_PUBLIC_API_KEY is not set." >&2
    emit_error "LOV_PUBLIC_API_KEY is not set. Add it under Settings → Secrets and variables → Actions. Lovable reserves the name LOVABLE_API_KEY, so this workflow uses LOV_PUBLIC_API_KEY. See docs/lovable-auto-publish.md."
    exit 1
  fi

  require_command curl
  require_command jq
  require_nonnegative_integer SYNC_WAIT_SECONDS "$SYNC_WAIT_SECONDS"
  require_nonnegative_integer PUBLISH_TIMEOUT_SECONDS "$PUBLISH_TIMEOUT_SECONDS"
  require_nonnegative_integer CURL_MAX_TIME "$CURL_MAX_TIME"
  if (( PUBLISH_TIMEOUT_SECONDS < 1 )); then
    fail "PUBLISH_TIMEOUT_SECONDS must be at least 1."
  fi
  if (( CURL_MAX_TIME < 1 )); then
    fail "CURL_MAX_TIME must be at least 1."
  fi

  case "$API_BASE" in
    https://*)
      ;;
    http://127.0.0.1:* | http://localhost:* | http://localhost)
      ;;
    *)
      fail "LOVABLE_API_BASE must be an https URL."
      ;;
  esac
  API_BASE=${API_BASE%/}

  if [[ "$LOV_PUBLIC_API_KEY" == *$'\n'* || "$LOV_PUBLIC_API_KEY" == *$'\r'* ]]; then
    fail "LOV_PUBLIC_API_KEY contains a line break and cannot be sent."
  fi
  classify_lovable_project_id

  umask 077
  TMPDIR_PUBLISH=$(mktemp -d)
  trap 'rm -rf "$TMPDIR_PUBLISH"' EXIT
  printf 'Lovable-API-Key: %s\n' "$LOV_PUBLIC_API_KEY" >"${TMPDIR_PUBLISH}/api-key-header"

  if (( SYNC_WAIT_SECONDS == 0 )); then
    echo "SYNC_WAIT_SECONDS is 0. Skipping the wait for Lovable's GitHub sync."
  else
    echo "Waiting ${SYNC_WAIT_SECONDS}s so Lovable's GitHub app can ingest this push before publish."
    echo "There is no sync-status API. SYNC_WAIT_SECONDS defaults to 90. If the live site is still the previous snapshot, increase SYNC_WAIT_SECONDS in .github/workflows/lovable-publish.yml."
    sleep "$SYNC_WAIT_SECONDS"
  fi

  DEADLINE=$(($(date +%s) + PUBLISH_TIMEOUT_SECONDS))
  start_publish
}

if [[ "${BASH_SOURCE[0]}" == "$0" ]]; then
  main "$@"
fi
