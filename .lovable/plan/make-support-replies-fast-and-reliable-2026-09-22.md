# Make support replies fast and reliable

## Goal
Support replies should appear immediately, never leave Send disabled, and avoid duplicate sends when Supabase or a notification service is slow.

## Changes
- Replace the passive timeout with real request cancellation using Supabase's abort support.
- Give each send a unique database ID so retrying cannot create duplicate replies.
- Clear the composer and re-enable Send immediately after the database confirms the reply, while email delivery continues separately.
- Prevent realtime events from triggering overlapping full conversation and inbox reloads after every reply.
- Add short, explicit time limits to external AI and webhook calls so background delivery cannot run indefinitely.
- Apply the same reliable behavior to both standard Admin Support and Support Mode.

## Verification
- Test successful, delayed, timed-out, and retried sends.
- Confirm one saved reply per click, immediate button recovery, and no duplicate notification.
- Check Supabase request timing and the support page in the live preview.

## Technical details
The database itself is not currently showing a platform-wide outage. The existing helper races a timer against a request but never aborts the underlying fetch. Realtime callbacks also launch uncoordinated reloads, increasing request contention. The fix will use `AbortController`/`.abortSignal()`, idempotent UUID inserts, and guarded refresh scheduling.
