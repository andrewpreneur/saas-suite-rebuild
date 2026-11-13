# SaaSSuite Premium: design system v1

The one UI of this rebuild. Goal: simple, calm, premium. An owner should never have to think about the interface.

## Principles (from our UX rules)
1. **One job per page, one primary action per view.** The primary action is the purple `accent` button. Everything else is quieter.
2. **Always answer three questions:** where am I (top bar trail, page title, lit sidebar row), what can I do here (obvious controls), what just happened (pressed state within 100ms, toast, updated numbers).
3. **Design all five states:** ideal, empty (one sentence + one action), loading (skeleton in the content's shape), partial (long names, missing data), error (what failed + what to do).
4. **Motion explains, it does not decorate.** One staggered reveal per page. Transform and opacity only. Nothing over 500ms.
5. **Recognition over recall.** Show options. Never make someone re-enter what the app knows.
6. **Words are interface.** Buttons are verb + object ("Save changes"). No "Submit", no "OK", no exclamation marks.

## Tokens (`src/index.css`, scoped to `html.ds-ui`, always on)
| Token | Use |
|---|---|
| `--brand` #6043EF, `--brand-hover`, `--brand-subtle` | Accent actions, links, selection |
| `--canvas` | App background (use the `px-canvas` class on page shells) |
| `--card`, `--border`, `--muted`, `--muted-foreground` | Surfaces, hairlines, quiet fills, secondary text |
| `--success`, `--warning`, `--destructive`, `--info` | Status. Never color alone: pair with icon or text |
| `--shadow-card`, `--shadow-raised`, `--shadow-popover`, `--shadow-dialog`, `--shadow-brand` | Tailwind: `shadow-card`, `shadow-raised`, `shadow-popover`, `shadow-dialog`, `shadow-brand` |
| `--gradient-brand`, `--gradient-brand-soft` | Accent fills and washes (`px-brand-fill`, `px-brand-wash`) |
| Radius | `rounded-sm` 6, `rounded-md` 12, `rounded-lg` 14 (cards), `rounded-xl` 20 (hero surfaces, dialogs) |
| Type | `text-h1`..`text-h4`, `text-body-lg`, `text-body`, `text-small`, `text-caption`. Inter. One h1 per page |
| Spacing | 4 · 8 · 12 · 16 · 24 · 32 · 48 · 64. No one-off values |

## Surface classes
- `px-canvas` page background · `px-surface` standard card · `px-surface-interactive` card that opens something (lifts on hover)
- `px-glass` sticky bars · `px-brand-fill` accent fill · `px-brand-wash` soft brand panel (one per page)
- `px-icon-chip` 40px icon tile · `px-eyebrow` small caps label · `px-skeleton` shimmer placeholder

## Motion (`src/lib/motion.ts`)
`pageEnter`, `staggerParent` + `riseItem`, `popIn`, `slideStep`, `SPRING_SNAPPY`, `SPRING_SOFT`, `EASE_OUT`, `EASE_IN`, `DURATION`.
Import from `framer-motion`. Reduced motion is handled once in the shell with `<MotionConfig reducedMotion="user">`.

## Components
**Primitives** `src/components/ui/*` (shadcn, restyled): Button (`accent`, default, `outline`, `secondary`, `ghost`, `destructive`, `link`; sizes `sm`, default, `lg`, `icon`), Input, Textarea, Select, Switch, Checkbox, Card, Tabs (sliding brand bar), Dialog, DropdownMenu, Popover, Tooltip, Table, Badge (tones `neutral|brand|success|warning|danger|info`), Tag, Banner, TextField, Progress, Skeleton, Accordion, Command.

**Premium** `src/components/premium/*`:
- `Reveal` / `RevealItem`: staggered page-load reveal.
- `SectionCard`: icon chip + title + description + actions + body. The default content card.
- `AppTopBar`: trail + ⌘K jump menu (already in the shell).
- `platform/PageHeader`: eyebrow, h1, subtitle, actions.

**From 21st.dev** `src/components/premium/21st/*` (source and author are credited at the top of each file):
| File | Export | Use it for |
|---|---|---|
| `wizard-steps.tsx` | `WizardSteps`, `useWizard` | Multi-step flows: onboarding, setup, branding steps |
| `animated-tabs.tsx` | `AnimatedTabs` | Segmented or pill switches inside a page |
| `expandable-tabs.tsx` | `ExpandableTabs` | Compact icon toolbars that expand the selected label |
| `number-ticker.tsx` | default `NumberTicker` | KPI numbers that count to their value |
| `spotlight.tsx` | `Spotlight` | Pointer-following glow inside a hero or feature card |
| `folder-card.tsx` | `FolderCard` | Collections: lesson groups, resource folders, hub sections |
| `empty-state.tsx` | `EmptyState`, `EmptyStateIllustration` | Every empty list or first-run screen |
| `animated-list.tsx` | `AnimatedList` | Feeds where items arrive: activity, notifications |
| `text-shimmer.tsx` | `TextShimmer` | "Thinking…", "Saving…" and streaming status text |
| `ai-prompt-box.tsx` | `PromptInputBox` | Reference only (dark, fixed colors). Use `premium/copilot/CopilotPromptBox`, the brand-token version, for any AI composer |
| `animated-state-icons.tsx` | `SuccessIcon`, `CopiedIcon`, `SendIcon`, `PlayPauseIcon`, `LockUnlockIcon`, `EyeToggleIcon`, … | Icons that morph to confirm an action (copy, send, save) |
| `animated-icon.tsx` | `AnimatedIcon`, `StateChevron` | Replayable icon micro-interactions |
| `halo-dropzone.tsx` | `HaloDropzone` | File and image upload |
| `floating-gradient.tsx` | `FloatingGradient` | Soft animated backdrop for auth and onboarding only |
| `command-palette.tsx` | `CommandPalette`, `useCommandPalette` | Reference for the ⌘K menu |
| `animated-sidebar.tsx` | `Sidebar001*` | Reference; the app sidebar already uses its sliding-pill idea |

Recolor any 21st component to the tokens above (brand purple, `px-*` surfaces, our radius). It must look like one brand, not a collage.

## Rules
- Use `SectionCard` and `PageHeader` rather than hand-built headers. Use `EmptyState` for every empty list.
- No new hex colors, shadows or radii in screens: use tokens. No Tailwind purple/violet/indigo: use `brand`.
- Touch targets 44px on phones. Labels above inputs, always visible. Errors next to the field, saying how to fix it.
- Disabled buttons are a last resort: leave it enabled and explain what is blocking.
- Check every screen at 375, 768 and 1440 wide. No horizontal overflow.
- This copy has no backend. Screens read the mock in `src/lib/platformMock.ts`; add fixtures there when a screen looks empty.

## Calm screens (v1.1)

Andrew's note after v1: "Screens still have a LOT on them. Lots of buttons and places to go." These rules fix that.
They apply to every signed-in screen. Nothing is removed from the product: things move behind one clear door.

**The budget.** When a page first loads, the content area (not the sidebar or top bar) shows:
- one title, one sentence under it, and **one** button (the page's primary action);
- at most **seven** other things a person can click, where a list of like rows counts as one thing;
- no setting's editor. Editors open when asked for.

**Where everything else goes.**

| It was... | It becomes... | Built with |
|---|---|---|
| A second, third, fourth header button | One "..." menu | `PageHeader` `more={[...]}` or `premium/MoreMenu` |
| A stack of cards, each an open form | One card of rows. Row = name + what it is set to now. Click opens the editor in a side panel (bottom sheet on phones) | `premium/SettingList` (`SettingList`, `SettingItem`, `EditorPanel`) |
| Four big number cards that are only context | One slim strip, or nothing if a tab already shows the count | `premium/StatStrip` |
| "Advanced" options beside the basics | Inside the same side panel, under an "Advanced" disclosure | `ui/collapsible` |
| A paragraph of explanation | One sentence. The rest goes in the "..." menu as "How this works" | `MoreMenu` + a dialog |
| A link, a plan picker and two icon buttons in a bar | One compact chip that opens a popover | `ui/popover` |
| More than four tabs | Four tabs, or use the page switcher in the top bar | `21st/animated-tabs` |
| A collection of things (trainings, files, groups) | Folders or cards you open | `21st/glass-folder-cards`, `21st/folder-card` |

**Keep inline only** what a person changes on nearly every visit (a reply box, a search field, the list they came for).
Every control must still be reachable in two clicks from its page, by mouse, touch and keyboard.

**Navigation.** The sidebar is Dashboard plus five groups with one open at a time. The page name in the top bar is a
switcher for the other pages in the same group. Cmd+K reaches everything. Don't add sidebar links; add to a group.

## Skins: Clean and Glass

`src/lib/skin.ts` holds the choice (`clean` or `glass`, per browser); the switch is `premium/SkinSwitch` in the top bar.
Glass is CSS only (`html[data-skin="glass"]` in `src/index.css`): frosted panes over a fixed colour field.
To stay correct in both skins, build surfaces from `px-surface`, `px-surface-interactive`, `bg-card`, `bg-muted` and
`bg-background`. Never hard-code `bg-white` or a hex background on a surface: it will not frost. Check every screen in both.
