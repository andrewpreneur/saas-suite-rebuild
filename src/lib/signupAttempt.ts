import { signupErrorMessage } from "./signupError";

export function isRetryableSignupError(error: { code?: string; message?: string } | null | undefined): boolean {
  if (!error) return false;
  if (error.code === "57014") return true;
  return /error creating account|database error|timeout|timed out|fetch failed|network request failed|502|503|504/i.test(error.message || "");
}

type SignupResult<T> = { data: T; error: { code?: string; message?: string } | null };

/** Retry profile insert / auth signup when the trigger races or the database times out. */
export async function retrySignupStep<T>(run: () => PromiseLike<SignupResult<T>>, attempts = 3): Promise<SignupResult<T>> {
  let last: SignupResult<T> | null = null;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const result = await run();
    if (!result.error || result.error.code === "23505") return { data: result.data, error: result.error?.code === "23505" ? null : result.error };
    last = result;
    if (!isRetryableSignupError(result.error) || attempt === attempts - 1) return result;
    await new Promise((resolve) => setTimeout(resolve, 350 * (attempt + 1)));
  }
  return last || { data: null as T, error: { message: "Error creating account" } };
}

export function presentSignupError(error: { code?: string; message?: string } | null | undefined): string {
  if (!error) return signupErrorMessage(error);
  if (error.code === "57014" || error.code === "23505" || isRetryableSignupError(error)) return signupErrorMessage(error);
  const message = error.message || "";
  if (/database|sql|constraint|duplicate key|stack/i.test(message)) return signupErrorMessage(error);
  return message || signupErrorMessage(error);
}
