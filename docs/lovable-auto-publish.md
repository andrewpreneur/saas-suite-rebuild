# Auto-publish to Lovable

Pushes to `main`, and manual runs of the **Publish to Lovable** workflow, publish this project's live Lovable site.

The workflow checks out the repo only so it can run `scripts/lovable-publish.sh`. It does not build or upload the app. Lovable's GitHub app syncs the commit, and the script calls the public publish API ([publish project](https://docs.lovable.dev/api-reference/deploy-domains/publish-project), [get publish status](https://docs.lovable.dev/api-reference/deploy-domains/get-publish-status)). Requests send `Lovable-Version: 2026-09-11`.

## What the script does

1. Stops immediately when `LOV_PUBLIC_API_KEY` is missing.
2. Uses `LOVABLE_PROJECT_ID` as the API project id. Ids from this API are UUIDs, and some projects may still use a `prj_...` id. Both are valid. When the secret is unset, the script uses this repo's project UUID `5d824616-a50a-49a4-9b57-8fb62de744ee`.
3. Waits `SYNC_WAIT_SECONDS` (default **90**) so Lovable can ingest the push. There is no API to check sync. A shorter wait publishes the previous snapshot. Change the value in `.github/workflows/lovable-publish.yml`. The job timeout is 25 minutes and includes this wait; raise `timeout-minutes` if you raise the wait.
4. `POST https://api.lovable.dev/v1/projects/{project_id}/publish` with body `{}`. A UUID is published directly. If that POST returns HTTP 404, the script looks the id up and publishes once more:
   - `GET /v1/workspaces`, then for each workspace `GET /v1/projects?workspace_id=...`, following `pagination.has_more` and `pagination.next_cursor`.
   - If a listed project's `id` equals the UUID, that id is used. Other projects that merely contain the UUID are ignored.
   - If no id matches, the script uses the one project that contains the UUID anywhere in its object. The id it finds is printed in the log and the job summary.
   - If none match, or several contain the UUID and none has that exact id, the job stops. The error lists only the matched candidates, not every project in the workspace.
5. Polls `GET .../publish/{deployment_id}` until `completed` or `error`. Polls start at 2 seconds and back off toward 10. `Retry-After` on HTTP 429 is honored. The publish budget is `PUBLISH_TIMEOUT_SECONDS` (default 900, about 15 minutes) and starts after the sync wait.
6. On success, logs the deployment id and live URL and writes both to the job summary. On failure, exits non-zero and logs the HTTP status and response body. The API key is masked with `::add-mask::` and is not written to the log.

A POST that returns HTTP 503, or whose client wait times out, is not sent again. Lovable's processing deadline is about 60 seconds, and a `503` `request_timeout` can mean the publish still started. The script polls only when the response includes a deployment id. Otherwise it fails and tells you to check the project in Lovable before running the workflow again.

## Secrets

Create the API key under **Settings → Secrets and variables → Actions → New repository secret**. `LOVABLE_PROJECT_ID` is optional.

| Secret | Value |
| --- | --- |
| `LOV_PUBLIC_API_KEY` | Workspace access token. Required. Lovable reserves the name `LOVABLE_API_KEY`, so the workflow secret uses `LOV_PUBLIC_API_KEY`. |
| `LOVABLE_PROJECT_ID` | Optional. A UUID or a `prj_...` id. Both are published directly. When unset, the workflow uses this repo's project UUID. |

### API key

In Lovable: **Workspace settings → API keys & OAuth → Workspace access tokens → New API key**.

- The workspace needs a **Business or Enterprise** plan. Publish is "Business or higher".
- The person creating the key needs the **owner or admin** role. The account email must be verified.
- Scope: **`projects:write`**. That includes `projects:read`, which the status poll uses.
- Also grant **`workspaces:read`** on the same key. Publish itself only needs `projects:write`. The lookup that runs after an HTTP 404 lists workspaces and projects, and that list needs `workspaces:read`.
- The token is shown once. It starts with `lov_`.
- Leave the key's IP allowlist empty. GitHub-hosted runners do not have a stable address, and an allowlist returns `403` `ip_restricted`.

### Project id

Project ids from this API are UUIDs. A `prj_...` id is also accepted when a project has one. This repo's project id is `5d824616-a50a-49a4-9b57-8fb62de744ee`, the same value as in the editor URL `https://lovable.dev/projects/5d824616-a50a-49a4-9b57-8fb62de744ee`.

Store that UUID, store a `prj_...` id, or leave the secret unset. The workflow publishes that id. It lists projects only when publish returns HTTP 404. Names and ids in the log are not secrets. The API key stays masked. GitHub also masks a project id that is stored as a secret, so the UUID may appear as `***` in the Actions log.

To look the id up yourself, list workspaces, then list projects in each workspace. Both calls need `workspaces:read`. Use the project whose `id` equals the UUID. A project that only mentions the UUID in another field is a different project.

```bash
curl -sS https://api.lovable.dev/v1/workspaces \
  -H "Lovable-API-Key: $LOV_PUBLIC_API_KEY" \
  -H "Lovable-Version: 2026-09-11"

curl -sS "https://api.lovable.dev/v1/projects?workspace_id=WORKSPACE_ID" \
  -H "Lovable-API-Key: $LOV_PUBLIC_API_KEY" \
  -H "Lovable-Version: 2026-09-11"
```

Use the project's `id`. A workspace-scoped key only returns its own workspace. Project lists are paged (`pagination.has_more`, `pagination.next_cursor`) and eventually consistent.

## Limitations

- Every push to `main` starts a publish, including commits Lovable's GitHub app pushes (`lovable-dev[bot]` / `gpt-engineer-app[bot]` in `git log`). A docs-only commit publishes too.
- GitHub concurrency keeps the in-progress publish running and queues the next one. Only one pending run is kept, so a burst of pushes can skip intermediate runs. The run that starts later publishes whatever Lovable has synced from `main` after the wait.
- A Git commit does not deploy Edge Functions or run migration files. [Git sync](https://docs.lovable.dev/integrations/git-sync-overview) says Lovable does not deploy a changed Edge Function or run a new migration file when commits sync. After a function syncs, deploy it from the project chat (More → Database → Manage → Edge functions). Change the database from the project chat or the SQL editor. This workflow only publishes the snapshot Lovable already has. Lovable's publish troubleshooting also says a publish can fail when an edge function in that snapshot cannot be deployed; that is separate from running migration files that arrived through Git.
- An IP allowlist on the API key does not fit GitHub-hosted runners.
- Lovable can refuse the publish with `security_critical_findings`. The log includes `finding_refs`. Fix those findings, then run the workflow again.
- `90` seconds is a delay, not a confirmation that sync finished. If the published site is still the previous commit, increase `SYNC_WAIT_SECONDS`.
