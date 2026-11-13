// HighLevel user-permission scopes for the Menu Link Removal / AI Studio sales step.
//
// PUT /users/{id} replaces the buyer's scope list. This module only decides which
// scopes may be ADDED. The custom-code step reads the current user and writes the
// union, so existing scopes and permission flags stay.
//
// Checked against HighLevel's docs on 2026-10-23:
// - Update User and Get User, plus the highlevel-api-sdk Users models.
//   Marketplace pages label these routes Version v3. Live HighLevel rejects the
//   header Version: "v3" ("version header was not found"). Generated code sends
//   Version: "2021-07-28", the same date header as the buyer resolver.
//   `scopes` and `scopesAssignedToOnly` are top-level arrays. `permissions` is a
//   separate object of flags (campaignsEnabled, contentAiEnabled, …), not the scope list.
//   An empty scopes array disables every scope. Omitted assigned-only scopes are left
//   alone; an empty array clears them.
// - AI Studio IAM v2 changelog and the AI Studio help article: "View AI Studio" and
//   "View & manage AI Studio". Live test: ai-studio.readonly + ai-studio.write returned
//   200 and left AI Studio at 0/3. ai-studio.writev2 grants View + View & manage (2/3).
//   The same response lists ai-studio.readonlyv2, so both v2 names are sent.
// - The third AI Studio checkbox, "Manage Git & download code" (Oct 2026), has no
//   published scope string. It is not added. A buyer who already has it keeps it.
// - Voice AI's current API scope list still uses voice-ai-agents, voice-ai-agent-goals,
//   and voice-ai-dashboard. voice-ai-common is not on that public OAuth list; it is a
//   user-permission name and is unchanged until HighLevel publishes a replacement.
// - Conversation AI's public API token scopes are conversation-ai.readonly / .write.
//   Those are token scopes, not the user-permission names (text-ai-*). Renaming the
//   user-permission strings to the token scopes would not check the buyer's boxes.
//   They stay until a live user-permission test shows a new name, the way AI Studio did.
//
// Menu link removal is CSS. Assigning the link uses the agency integration token
// (custom-menu-link.write on that token), not a scope on the buyer. No buyer scope
// is added for the menu link.

export const AI_SCOPE_GENERATOR_VERSION = "2026-10-23-v2-merge";

export const AI_STUDIO_V2_SCOPES = ["ai-studio.readonlyv2", "ai-studio.writev2"] as const;

/** Why each scope this product may add is on the allowlist. */
export const PRODUCT_SCOPE_NOTES: Record<string, string> = {
  "ai-studio.readonlyv2":
    "IAM v2 View AI Studio. The old ai-studio.readonly is accepted and does not grant the permission.",
  "ai-studio.writev2":
    "IAM v2 View & manage AI Studio. With readonlyv2, this is the published AI Studio access (the 2/3 the live test confirmed).",
  "voice-ai-agents.readonly":
    "View Voice AI agents. Still the name in HighLevel's Voice AI API scope list.",
  "voice-ai-agents.write":
    "Create and edit Voice AI agents. Still the name in the Voice AI API scope list.",
  "voice-ai-common.readonly":
    "Read shared Voice AI settings. Not in the public OAuth list; kept as the user-permission name pending a published rename.",
  "voice-ai-common.write":
    "Edit shared Voice AI settings. Same caveat as voice-ai-common.readonly.",
  "voice-ai-agent-goals.readonly":
    "View Voice AI agent goals. Still the name in the Voice AI API scope list.",
  "voice-ai-agent-goals.write":
    "Edit Voice AI agent goals. Still the name in the Voice AI API scope list.",
  "voice-ai-dashboard.readonly":
    "View the Voice AI dashboard. Still the name in the Voice AI API scope list.",
  "text-ai-agents.write":
    "Edit Conversation AI agents. User-permission name; the public API token scope conversation-ai.write is a different list.",
  "text-ai-agent-goals.readonly":
    "View Conversation AI agent goals (user permission, not the API token scope).",
  "text-ai-agent-goals.write":
    "Edit Conversation AI agent goals (user permission, not the API token scope).",
  "text-ai-agent-training.write":
    "Edit Conversation AI training (user permission, not the API token scope).",
  "text-ai-agents-dashboard.readonly":
    "View the Conversation AI dashboard (user permission, not the API token scope).",
  "askai.write": "Use Ask AI. No published rename in the current user or OAuth docs.",
  "copilot.readonly":
    "View HighLevel Copilot. No published rename in the current user or OAuth docs.",
  "eliza.write":
    "Use the Eliza assistant permission. No published rename in the current user or OAuth docs.",
  "contentAI.write":
    "Use Content AI. The user record also has a contentAiEnabled flag; this scope is the permission string the old step sent, with no published rename.",
  "reputation/reviewsAIAgents.write":
    "Manage Reviews AI agents. No published rename in the current user or OAuth docs.",
};

export const AI_FEATURE_SCOPES: { key: string; label: string; scopes: string[] }[] = [
  {
    key: "ai_studio",
    label: "AI Studio",
    scopes: [...AI_STUDIO_V2_SCOPES],
  },
  {
    key: "voice_ai",
    label: "Voice AI",
    scopes: [
      "voice-ai-agents.write",
      "voice-ai-agents.readonly",
      "voice-ai-common.readonly",
      "voice-ai-common.write",
      "voice-ai-agent-goals.readonly",
      "voice-ai-agent-goals.write",
      "voice-ai-dashboard.readonly",
    ],
  },
  {
    key: "conversation_ai",
    label: "Conversation AI",
    scopes: [
      "text-ai-agents.write",
      "text-ai-agent-goals.readonly",
      "text-ai-agent-goals.write",
      "text-ai-agent-training.write",
      "text-ai-agents-dashboard.readonly",
    ],
  },
  {
    key: "ask_ai",
    label: "Ask AI",
    scopes: ["askai.write", "copilot.readonly", "eliza.write"],
  },
  {
    key: "content_ai",
    label: "Content AI",
    scopes: ["contentAI.write"],
  },
  {
    key: "reviews_ai",
    label: "Reviews AI",
    scopes: ["reputation/reviewsAIAgents.write"],
  },
];

/**
 * Agency-level or destructive scope names. These are never added.
 * `locations.` matches locations.create / locations.write and does not match locations/tags.write.
 * `companies.` matches companies.write. Existing scopes on the buyer are kept even when they match.
 */
export const BLOCKED_SCOPE_PREFIXES = [
  "snapshots/api.",
  "internaltools.",
  "agency/",
  "locations.",
  "saas/",
  "private-integration-",
  "custom-menu-link.",
  "users/team-management.",
  "users-sso-login-management.",
  "affiliateportal.",
  "oauth.",
  "audit-logs.",
  "companies.",
] as const;

export const BLOCKED_SCOPE_EXACT = ["loginas.write", "sso-config.write"] as const;

const BLOCKED_EXACT = new Set<string>(BLOCKED_SCOPE_EXACT);

export function isBlockedUserScope(scope: string): boolean {
  if (BLOCKED_EXACT.has(scope)) return true;
  return BLOCKED_SCOPE_PREFIXES.some((prefix) => scope.startsWith(prefix));
}

/** Scopes selected features may add, in feature order, with agency/destructive names removed. */
export function scopesForFeatures(features: string[]): string[] {
  const selected = new Set(features);
  const scopes = AI_FEATURE_SCOPES.filter((feature) => selected.has(feature.key)).flatMap(
    (feature) => feature.scopes,
  );
  return unique(scopes).filter((scope) => !isBlockedUserScope(scope));
}

export type MergedUserAccess = {
  companyId: string;
  scopes: string[];
  scopesAssignedToOnly?: string[];
  permissions?: Record<string, unknown>;
};

type ScopeField = { present: boolean; values: string[] };

function unique(scopes: string[]): string[] {
  const out: string[] = [];
  for (const scope of scopes) if (!out.includes(scope)) out.push(scope);
  return out;
}

/** Array, JSON array string, or comma-separated string. null means the value is not a scope list. */
export function readScopeList(value: unknown): string[] | null {
  if (value == null) return null;
  if (Array.isArray(value)) {
    if (value.some((item) => typeof item !== "string")) return null;
    return value.map((item) => item.trim()).filter(Boolean);
  }
  if (typeof value === "string" && value.trim()) {
    const trimmed = value.trim();
    if (trimmed.startsWith("[")) {
      try {
        return readScopeList(JSON.parse(trimmed));
      } catch {
        return null;
      }
    }
    return trimmed
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return null;
}

function scopeField(record: Record<string, unknown> | null, key: string): ScopeField {
  if (!record || !Object.prototype.hasOwnProperty.call(record, key))
    return { present: false, values: [] };
  const values = readScopeList(record[key]);
  if (values == null) {
    throw new Error(
      "HighLevel returned scopes in an unexpected shape. Existing permissions were left unchanged.",
    );
  }
  return { present: true, values };
}

export function unwrapHighLevelUser(raw: unknown): Record<string, unknown> {
  const response = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const payload =
    response.data && typeof response.data === "object"
      ? (response.data as Record<string, unknown>)
      : response;
  const nested = payload.user;
  if (
    nested &&
    typeof nested === "object" &&
    !Array.isArray(nested) &&
    payload.scopes == null &&
    payload.permissions == null
  ) {
    return nested as Record<string, unknown>;
  }
  return payload;
}

/**
 * Union of the buyer's current scopes plus the selected product scopes.
 * Throws when the current scope list cannot be read, so the caller does not PUT.
 * Does not copy type, role, locationIds, email, or password.
 */
export function mergeUserAccess(
  companyId: string,
  raw: unknown,
  features: string[],
): MergedUserAccess {
  const user = unwrapHighLevelUser(raw);
  const permissions =
    user.permissions && typeof user.permissions === "object" && !Array.isArray(user.permissions)
      ? (user.permissions as Record<string, unknown>)
      : null;
  const fromUser = scopeField(user, "scopes");
  const fromPermissions = scopeField(permissions, "scopes");
  if (!fromUser.present && !fromPermissions.present) {
    throw new Error(
      "HighLevel did not return the buyer's current scopes. Existing permissions were left unchanged.",
    );
  }
  const existing = unique([...fromUser.values, ...fromPermissions.values]);
  const add = scopesForFeatures(features).filter((scope) => !existing.includes(scope));
  const assignedUser = scopeField(user, "scopesAssignedToOnly");
  const assignedPermissions = scopeField(permissions, "scopesAssignedToOnly");
  const body: MergedUserAccess = {
    companyId,
    scopes: existing.concat(add),
  };
  if (assignedUser.present || assignedPermissions.present) {
    body.scopesAssignedToOnly = unique([...assignedUser.values, ...assignedPermissions.values]);
  }
  if (permissions) {
    const flags: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(permissions)) {
      if (key === "scopes" || key === "scopesAssignedToOnly") continue;
      flags[key] = value;
    }
    if (Object.keys(flags).length) body.permissions = flags;
  }
  return body;
}

/** Scopes that would be newly granted. Empty when the buyer already has all of them. */
export function scopesToAdd(raw: unknown, features: string[]): string[] {
  const merged = mergeUserAccess("", raw, features);
  const user = unwrapHighLevelUser(raw);
  const permissions =
    user.permissions && typeof user.permissions === "object" && !Array.isArray(user.permissions)
      ? (user.permissions as Record<string, unknown>)
      : null;
  const existing = unique([
    ...scopeField(user, "scopes").values,
    ...scopeField(permissions, "scopes").values,
  ]);
  return merged.scopes.filter((scope) => !existing.includes(scope));
}
