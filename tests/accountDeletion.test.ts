import { describe, expect, test } from 'bun:test';
import { validateDeletionConfirmation, canDeleteDisplayedAccount } from '../supabase/functions/delete-user-account/policy';
import { finishAccountDeletion } from '../src/lib/finishAccountDeletion';

describe('self-service account deletion', () => {
  test('successful deletion signs out, clears state and returns home in order', async () => {
    const calls: string[] = [];
    await finishAccountDeletion(async () => { calls.push('logout'); }, () => { calls.push('clear'); }, () => { calls.push('/'); });
    expect(calls).toEqual(['logout', 'clear', '/']);
  });
  test('a sign-out failure still clears state and returns home', async () => {
    const calls: string[] = [];
    await expect(finishAccountDeletion(async () => { throw new Error('offline'); }, () => { calls.push('clear'); }, () => { calls.push('/'); })).rejects.toThrow('offline');
    expect(calls).toEqual(['clear', '/']);
  });
  test('an app-state cleanup failure still returns home', async () => {
    let destination = '';
    await expect(finishAccountDeletion(async () => {}, () => { throw new Error('storage'); }, () => { destination = '/'; })).rejects.toThrow('storage');
    expect(destination).toBe('/');
  });
  test('requires explicit DELETE confirmation', () => {
    expect(validateDeletionConfirmation({ email: 'owner@example.com' }, 'owner@example.com')).toBe(false);
    expect(validateDeletionConfirmation({ confirmation: 'DELETE', email: 'owner@example.com' }, 'owner@example.com')).toBe(true);
  });
  test('cannot confirm deletion of someone else through request email', () => {
    expect(validateDeletionConfirmation({ confirmation: 'DELETE', email: 'other@example.com' }, 'owner@example.com')).toBe(false);
  });
  test('normalizes confirmation emails', () => {
    expect(validateDeletionConfirmation({ confirmation: 'DELETE', email: ' OWNER@EXAMPLE.COM ' }, 'owner@example.com')).toBe(true);
  });
  test('does not offer deletion during impersonation or workspace switching', () => {
    expect(canDeleteDisplayedAccount('owner@example.com', 'owner@example.com', true)).toBe(false);
    expect(canDeleteDisplayedAccount('owner@example.com', 'other@example.com', false)).toBe(false);
    expect(canDeleteDisplayedAccount('owner@example.com', ' OWNER@EXAMPLE.COM ', false)).toBe(true);
  });
  test('rejects missing or malformed confirmation', () => {
    for (const body of [null, 'DELETE', {}, { confirmation: 'DELETE', email: 4 }]) {
      expect(validateDeletionConfirmation(body, 'owner@example.com')).toBe(false);
    }
  });
});