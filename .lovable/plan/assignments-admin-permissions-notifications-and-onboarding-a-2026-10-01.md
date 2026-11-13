# Assignments, Admin Permissions, Notifications, and Onboarding Auto-Pay

## 1. Admin Permissions tab (Settings -> Admins)
- New "Permissions" tab. The owner picks an admin, then sets each area to **No access / View / View & Edit**: Client Hub, Support Chats, Support Tickets, Branding, Marketing, Videos/Education, Workflows, Analytics, Billing, Settings, and every other sidebar tool.
- Two extra checkboxes: **Only see chats assigned to me** and **Only see tickets assigned to me**.
- Only the account owner can edit these (you can too while logged in as them). Admins can't change their own permissions. The owner always has full access.
- Sidebar items hide for "No access", and "View" makes that page read-only. The database enforces the same rules, so hiding a button isn't the only protection.

## 2. Assigning tickets and chats
- A small person icon on every ticket and open chat. Click it to see the owner and all accepted admins, then click a name to assign. It then shows "Assigned to Jane Doe".
- Anyone who can see the item can assign it. Admins limited to assigned items only see what's assigned to them.
- When an assigned person replies to a ticket, their name appears on the reply. In chats, the AI chat gets told "Your case is being handled by Jane". That note goes into the AI's context for that conversation, so it can mention the person by name.

## 3. Notification toggles
- **Owner:** All tickets / All chats / Assigned tickets / Nothing (default: Nothing).
- **Admins:** Assigned tickets, Assigned chats (both on by default). These fire when the admin is assigned, and on every new message in an item assigned to them.
- The webhooks you already have keep their names and content. New fields are only added: account/agency name, agency ID, assignee name, email, phone, assigned_at, and a list of recipients.

## 4. Caroline Hobbs' Sep 23 booking
- **Cause:** the booking came from Bethany Hudspeth (opsfindalottolove@gmail.com, "Onboarding for team Find A Lot To Love & Summer Hudson"). That email and name don't belong to any SaaS Suite account or user, so nothing matched. The call was logged, but no account was charged.
- **Fix:** matching will also check client emails under each agency and admin emails. Unmatched bookings will show in admin so they can be assigned by hand. Once you confirm which Caroline account is correct, I'll attach this booking to it and use up 1 call. She has two accounts: caroline@rewardrealty.org (1 call left) and carolinehobbs@therise.group (0 left).

## 5. Onboarding auto-pay
- On the Onboarding Calls page there's a toggle: **Pay Manually / Auto-Pay Upon Booking**. Before Auto-Pay turns on, they must tick a box that says: "Any onboarding call booked for your agency will automatically charge your card on file $60."
- With Auto-Pay on, every booked call for their account charges their saved Stripe card $60 and keeps their call balance where it was. If the charge fails, it falls back to using a call from their balance and alerts you.
- Turning it on saves their card for later charges through a short Stripe setup step, if no card is saved yet.

## Technical details
- New tables: `admin_permissions` (owner_email, admin_email, area, level, restrict_assigned_chats/tickets), `support_assignments` (kind ticket/chat, ref id, assignee email/name, assigned_by), `support_notify_prefs`. The `can_access_area()` security-definer function is used inside the RLS policies on tickets/chat tables.
- `notify-support-webhook`, `notify-team-reply`, and `respond-to-ticket` gain extra fields and assignee recipients. Ticket replies store `responder_name`.
- `consume-onboarding-call` gets wider matching, plus an off-session Stripe PaymentIntent when `onboarding_autopay` is on. The new `create-onboarding-setup` function handles saving the card.
