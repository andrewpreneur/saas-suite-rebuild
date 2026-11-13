/** Session keys for native Google / Apple return handling. */
export const OAUTH_HANDLED_KEY = 'ss_native_oauth_handled';
export const OAUTH_RUN_KEY = 'ss_oauth_run';
export const OAUTH_LAUNCH_CONSUMED_KEY = 'ss_oauth_launch_consumed';

/** Clears sticky native sign-in state so a second login in the same app session works. */
export const clearNativeOAuthState = () => {
  try {
    sessionStorage.removeItem(OAUTH_HANDLED_KEY);
    sessionStorage.removeItem(OAUTH_RUN_KEY);
    sessionStorage.removeItem(OAUTH_LAUNCH_CONSUMED_KEY);
  } catch {
    /* private mode */
  }
};

/** Starts a new native sign-in attempt and returns its run id. */
export const beginNativeOAuthRun = (): string => {
  const run = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  try {
    sessionStorage.setItem(OAUTH_RUN_KEY, run);
    sessionStorage.removeItem(OAUTH_HANDLED_KEY);
  } catch {
    /* private mode */
  }
  return run;
};

export const currentNativeOAuthRun = (): string => {
  try {
    return sessionStorage.getItem(OAUTH_RUN_KEY) || '';
  } catch {
    return '';
  }
};
