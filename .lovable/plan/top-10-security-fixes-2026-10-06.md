# Top 10 security fixes

All 68 findings from the latest scan were dismissed in the Security tab at some point. You've asked for a review now, so these are the 10 most serious, with what each one risks and how to fix it safely. Each fix replaces the current "everyone" access rule with a check that matches how the app already uses that data, so the screens that work today keep working.

## The 10 issues

| # | Area | Risk today | Fix | What keeps working |
|---|------|------------|-----|--------------------|
| 1 | Customer progress (user_progress) | Anyone with the public app key can change any customer's name, email or last-login details for any agency | Only the hub's own sign-up and progress functions can write. Owners and admins can edit their own agency only | Hub sign-up, login tracking, dashboard edits |
| 2 | Video completions (module_completion) | Anyone can read or fake any customer's video progress | Reads and writes limited to that customer's agency. Hub writes go through the existing safe functions | Video progress in the hub and the dashboard stats pop-up |
| 3 | Onboarding checklist completions | Anyone can delete any customer's completed checklist items | Delete limited to the agency owner or an admin. The hub can still tick and untick its own customer's items | Checklist ticking in the hub |
| 4 | Team chat messages (agency_owner_messages) | Anyone can read every agency's support messages, including customer emails | Reads limited to the agency, its team, and the customer's own hub session (through the existing message-reading function) | Live chat on both sides, the admin inbox |
| 5 | Feature requests, comments, upvotes | Anyone can delete anyone's posts and votes | Delete limited to the author or a platform admin | Posting, voting, admin moderation |
| 6 | Community profiles | Any signed-in member can see every member's email | Hide the email column from everyone except the profile's owner and staff. Names and avatars stay public | Community feed, profiles, mentions |
| 7 | Ticket reply attachments (file storage) | Any signed-in user can download, replace or delete any ticket attachment | Access limited to platform admins, the agency team, and the ticket's customer | Attaching files to tickets and viewing them |
| 8 | Logos, skill packs, video thumbnails (file storage) | Any signed-in user can overwrite or delete another agency's logo or files | Uploads go into each account's own folder. Only that account (or admin) can replace or delete. Public viewing stays as-is | Branding uploads, skill-pack downloads, thumbnails |
| 9 | Guest counter and simple users | Anyone can reset or flood the guest counter or add fake users | Writes only through the existing guest-creation function | Guest hub access |
| 10 | Leaked-password check (sign-in setting) | People can sign up with passwords already exposed in data breaches | Turn on leaked-password protection | Existing logins are unaffected. Only new or changed passwords are checked |

## Not changing (public on purpose)

Agency menu config, video settings, onboarding checklists, custom videos, hub home settings and similar tables are read by public hub pages before anyone signs in. Locking them down would break hubs, so they stay readable. Public sign-up and lead forms (webinar sign-ups, text requests, affiliate click tracking) also stay open to new entries by design.

## How existing features stay safe

- Before changing anything, list every place in the app and server functions that reads or writes each table, and write the new rules to cover all of them.
- Apply one table at a time. After each change, check that hub sign-in, live chat, tickets, the dashboard, and community still work, and run the security scan again.
- Server functions use full-access keys, so tightening these rules doesn't change them.
- Each change can be undone right away by restoring the previous rule.

## Technical details

- Items 1–5 and 9: replace `USING (true)` policies with `can_access_agency(agency_id)`, author-email checks, or calls to the existing security-definer functions (`create_user_progress_safe*`, `create_guest_user`, `get_ai_chat_messages`). Before dropping anon policies, grep `src/` and `supabase/functions` for anonymous client writes to each table.
- Item 6: revoke column-level SELECT on the email column, or read it through a view or function for staff.
- Items 7–8: storage policies keyed on `(storage.foldername(name))[1]` matching the owner's agency ID or email. Existing files already in the root of a bucket stay readable; only new uploads go into per-account folders.
- Item 10: an Auth setting. You turn it on in the Supabase dashboard, because this project uses its own Supabase account.
