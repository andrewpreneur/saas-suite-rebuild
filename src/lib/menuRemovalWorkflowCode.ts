import {
  AI_SCOPE_GENERATOR_VERSION,
  BLOCKED_SCOPE_EXACT,
  BLOCKED_SCOPE_PREFIXES,
  scopesForFeatures,
} from "../components/highlevel/aiScopes";

/** Runs only inside HighLevel's Custom Code JavaScript action. */
export function buildBuyerResolverCode(companyId: string, token: string): string {
  return `const TOKEN = ${JSON.stringify(token || "YOURTOKENHERE")};
const COMPANY_ID = ${JSON.stringify(companyId || "YOURCOMPANYIDHERE")};
const email = String(inputData.email || "").trim().toLowerCase();
if (!email || TOKEN === "YOURTOKENHERE" || COMPANY_ID === "YOURCOMPANYIDHERE") throw new Error("Map contact.email and supply your fresh token and Company ID.");
const headers = { Authorization: "Bearer " + TOKEN, Version: "2021-07-28" };
const users = [];
for (let skip = 0; ; skip += 100) {
  if (skip >= 5000) throw new Error("Too many matches. Ask SaaSSuite support to review this buyer.");
  const url = "https://services.leadconnectorhq.com/users/search?companyId=" + encodeURIComponent(COMPANY_ID) + "&query=" + encodeURIComponent(email) + "&skip=" + skip + "&limit=100";
  const response = await customRequest.get(url, { headers });
  const data = response.data || response;
  if (!Array.isArray(data.users)) throw new Error("HighLevel returned no user list. Check token scopes.");
  users.push(...data.users.filter(u => String(u.email || "").trim().toLowerCase() === email));
  if (data.users.length < 100) break;
}
const matches = [...new Map(users.map(u => [u.id, u])).values()];
if (matches.length !== 1 || !matches[0].id) throw new Error("Buyer email must match exactly one HighLevel user.");
const user = matches[0];
const locations = [...new Set(user.locationIds || user.roles?.locationIds || [])];
if (locations.length !== 1) throw new Error("Buyer must belong to exactly one sub-account. Ask support if they have multiple.");
const check = await customRequest.get("https://services.leadconnectorhq.com/locations/" + encodeURIComponent(locations[0]), { headers });
const location = (check.data || check).location;
if (!location || location.companyId !== COMPANY_ID) throw new Error("Buyer sub-account does not belong to your agency.");
output = { location_id: locations[0], user_id: user.id, email };`;
}

const AI_PERMISSION_RUNTIME = `const userId = String(inputData.user_id || "").trim();
if (!userId || TOKEN === "YOURTOKENHERE" || COMPANY_ID === "YOURCOMPANYIDHERE") throw new Error("Map user_id from action #1 and supply your fresh View Users + Edit Users token and Company ID.");
const headers = { Authorization: "Bearer " + TOKEN, Version: "2021-07-28", "Content-Type": "application/json" };
function unique(list) {
  const out = [];
  for (const scope of list) if (!out.includes(scope)) out.push(scope);
  return out;
}
function readList(value) {
  if (value == null) return null;
  if (Array.isArray(value)) {
    if (value.some(item => typeof item !== "string")) return null;
    return value.map(item => item.trim()).filter(Boolean);
  }
  if (typeof value === "string" && value.trim()) {
    const trimmed = value.trim();
    if (trimmed.startsWith("[")) {
      try { return readList(JSON.parse(trimmed)); } catch (e) { return null; }
    }
    return trimmed.split(",").map(item => item.trim()).filter(Boolean);
  }
  return null;
}
function scopeField(record, key) {
  if (!record || typeof record !== "object" || Array.isArray(record) || !Object.prototype.hasOwnProperty.call(record, key)) return { present: false, values: [] };
  const values = readList(record[key]);
  if (values == null) throw new Error("HighLevel returned scopes in an unexpected shape. Existing permissions were left unchanged.");
  return { present: true, values };
}
function blocked(scope) {
  if (BLOCKED_EXACT.indexOf(scope) !== -1) return true;
  return BLOCKED_PREFIXES.some(prefix => scope.startsWith(prefix));
}
function unwrapUser(response) {
  const payload = response && response.data && typeof response.data === "object" ? response.data : response;
  if (payload && payload.user && typeof payload.user === "object" && !Array.isArray(payload.user) && payload.scopes == null && payload.permissions == null) return payload.user;
  return payload && typeof payload === "object" ? payload : {};
}
const response = await customRequest.get("https://services.leadconnectorhq.com/users/" + encodeURIComponent(userId), { headers });
const status = response && (response.status || response.statusCode);
if (status && Number(status) >= 400) throw new Error("Could not read this buyer from HighLevel. Existing permissions were left unchanged.");
const user = unwrapUser(response);
const permissions = user.permissions && typeof user.permissions === "object" && !Array.isArray(user.permissions) ? user.permissions : null;
const fromUser = scopeField(user, "scopes");
const fromPermissions = scopeField(permissions, "scopes");
if (!fromUser.present && !fromPermissions.present) throw new Error("HighLevel did not return the buyer's current scopes. Existing permissions were left unchanged.");
const existing = unique(fromUser.values.concat(fromPermissions.values));
const add = ADD.filter(scope => !blocked(scope) && existing.indexOf(scope) === -1);
const merged = existing.concat(add);
const assignedUser = scopeField(user, "scopesAssignedToOnly");
const assignedPermissions = scopeField(permissions, "scopesAssignedToOnly");
const body = { companyId: COMPANY_ID, scopes: merged };
if (assignedUser.present || assignedPermissions.present) body.scopesAssignedToOnly = unique(assignedUser.values.concat(assignedPermissions.values));
if (permissions) {
  const flags = {};
  for (const key of Object.keys(permissions)) {
    if (key === "scopes" || key === "scopesAssignedToOnly") continue;
    flags[key] = permissions[key];
  }
  if (Object.keys(flags).length) body.permissions = flags;
}
if (add.length) {
  const updated = await customRequest.put("https://services.leadconnectorhq.com/users/" + encodeURIComponent(userId), body, { headers });
  const putStatus = updated && (updated.status || updated.statusCode);
  if (putStatus && Number(putStatus) >= 400) throw new Error("HighLevel did not save the merged permissions. Check the token has Edit Users.");
}
output = { user_id: userId, scopes_added: add, scope_count: merged.length, unchanged: add.length === 0 };`;

/**
 * HighLevel Custom Code for the permission step. A webhook cannot merge a GET into a PUT,
 * and PUT /users replaces the whole scope list. The token stays in the workflow.
 */
export function buildAiPermissionCode(
  companyId: string,
  token: string,
  features: string[],
): string {
  const add = scopesForFeatures(features);
  return `// SaaSSuite AI permission step ${AI_SCOPE_GENERATOR_VERSION}
// GET /users/{id}, add only the product scopes, PUT the union. Existing scopes are kept.
// Menu-link assignment uses the agency token, not a scope on this buyer.
const TOKEN = ${JSON.stringify(token.trim() || "YOURTOKENHERE")};
const COMPANY_ID = ${JSON.stringify(companyId.trim() || "YOURCOMPANYIDHERE")};
const ADD = ${JSON.stringify(add)};
const BLOCKED_EXACT = ${JSON.stringify([...BLOCKED_SCOPE_EXACT])};
const BLOCKED_PREFIXES = ${JSON.stringify([...BLOCKED_SCOPE_PREFIXES])};
${AI_PERMISSION_RUNTIME}`;
}
