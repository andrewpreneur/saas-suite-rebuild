import { expect, test } from 'bun:test';
import { signupErrorMessage } from '../src/lib/signupError';
test('registration failures distinguish timeouts from existing accounts without exposing database details', () => {
  expect(signupErrorMessage({code:'57014'})).not.toBe(signupErrorMessage({code:'23505'}));
  expect(signupErrorMessage({message:'private database details'})).not.toContain('private database details');
});