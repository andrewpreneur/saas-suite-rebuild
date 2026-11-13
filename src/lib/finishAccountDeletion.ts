/** A deleted account must leave the app even if remote sign-out is unavailable. */
export async function finishAccountDeletion(
  signOut: () => Promise<unknown>,
  clearAccountState: () => unknown,
  goHome: () => void,
): Promise<void> {
  try {
    await signOut();
  } finally {
    try {
      await clearAccountState();
    } finally {
      goHome();
    }
  }
}