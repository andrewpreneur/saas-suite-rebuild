import { expect, test } from "bun:test";
import { isRetryableSignupError, presentSignupError, retrySignupStep } from "../src/lib/signupAttempt";

test("account-creation races are retried and then hidden from the form", async () => {
  expect(isRetryableSignupError({ message: "Error creating account" })).toBe(true);
  expect(isRetryableSignupError({ code: "57014" })).toBe(true);
  expect(isRetryableSignupError({ message: "Invalid login credentials" })).toBe(false);
  expect(presentSignupError({ message: "Error creating account" })).not.toContain("Error creating account");
  expect(presentSignupError({ message: "Please choose a password with at least 6 characters." })).toContain("password");

  let calls = 0;
  const result = await retrySignupStep(async () => {
    calls += 1;
    if (calls < 3) return { data: null, error: { message: "Error creating account" } };
    return { data: { user: { id: "u" } }, error: null };
  });
  expect(calls).toBe(3);
  expect(result.error).toBeNull();
  expect(result.data.user.id).toBe("u");
});

test("an existing profile row is not treated as a failed signup", async () => {
  const result = await retrySignupStep(async () => ({ data: { ok: true }, error: { code: "23505", message: "duplicate key" } }));
  expect(result.error).toBeNull();
});
