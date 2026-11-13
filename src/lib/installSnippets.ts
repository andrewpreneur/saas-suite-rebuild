/** The current install: one CSS line and one JS line per agency (served by dynamic-styles). */
export const DYNAMIC_STYLES_BASE = "https://auth.saassuite.ai/functions/v1/dynamic-styles";

/** Shown on Design until an agency replaces the Custom JS tag that has no user fields. */
export const THEME_INSTALL_UPDATE_NOTE =
  "Update your HighLevel Custom JS so a theme saved in one sub-account is shared with the other users of that sub-account. The old tag still runs. A logo saved in one sub-account stays on that sub-account either way.";

/** HighLevel replaces these merge fields on the Custom JS tag. Unfilled {{...}} values are ignored. */
export const HIGHLEVEL_USER_ATTRS =
  'data-user-type="{{user.type}}" data-user-role="{{user.role}}" data-user-email="{{user.email}}" data-user-name="{{user.name}}" data-user-id="{{user.id}}" data-company-id="{{user.companyId}}"';

export const installSnippets = (agencyId: string | null | undefined) => {
  const id = agencyId || "[AGENCY_ID]";
  return {
    css: `@import url('${DYNAMIC_STYLES_BASE}?agency_id=${id}&type=css');`,
    js: `<script src="${DYNAMIC_STYLES_BASE}?agency_id=${id}&type=js" ${HIGHLEVEL_USER_ATTRS}></script>`,
  };
};
