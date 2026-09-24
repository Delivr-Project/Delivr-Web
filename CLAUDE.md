# Delivr Web

## Tech Stack

- **Runtime**: Bun 1.x
- **Framework**: Nuxt 4.x
- **UI Library**: Nuxt UI 4.x (based on Reka UI)
- **Language**: TypeScript 6.x + Vue 3.x + Vue Router 5.x
- **API Client**: `@hey-api/openapi-ts` (generated from Delivr API OpenAPI spec)
- **Validation**: Zod 4.x
- **PWA**: `@vite-pwa/nuxt`
- **Icons**: Lucide (via `@iconify-json/lucide`)
- **Sanitization**: `dompurify`
- **Rich text editor**: Nuxt UI `UEditor` (TipTap 3.x) + `@tiptap/extension-text-align`

## Project Structure

```
app/
├── app.vue                   # Root Vue component
├── app.config.ts             # App configuration
├── error.vue                 # Error page
├── assets/
│   └── css/
│       └── main.css          # Global styles
├── components/
│   ├── Gravatar.vue
│   ├── SenderAvatar.vue        # Sender avatar (Gravatar / BIMI brand logo / initials)
│   ├── dashboard/           # Dashboard components
│   │   ├── DashboardDeleteModal.vue
│   │   ├── DashboardModal.vue
│   │   ├── DashboardPageBody.vue
│   │   ├── DashboardPageHeader.vue
│   │   ├── DataTable.vue
│   │   ├── MailAccountsMenu.vue
│   │   ├── MailSearch.vue
│   │   ├── NotificationsSlideover.vue
│   │   └── UserMenu.vue
│   ├── form/
│   │   └── DateRangePicker.vue
│   ├── img/
│   │   ├── DelivrIcon.vue
│   │   └── DelivrLogo.vue
│   └── mail/
│       ├── compose/            # Mail composer (rich editor + draft autosave)
│       │   ├── MailComposer.vue            # Full compose screen: header/fields, save status, send, discard, drop overlay
│       │   ├── MailComposeEditor.vue       # UEditor wrapper: toolbars, paste/drop of files, `ready` event,
│       │   │                                #   and the `mailSignature` node that keeps the signature block
│       │   ├── MailComposeAttachments.vue  # Attachment tiles (upload progress, preview, remove, add)
│       │   ├── MailComposeLinkPopover.vue  # Link insert/edit popover (URL normalization)
│       │   └── MailRecipientInput.vue      # To/Cc/Bcc tag input with address validation
│       ├── MailDetailContent.vue
│       ├── MailIdentitiesManager.vue  # Sender-identity CRUD panel (list, add, edit, signature, default, delete)
│       ├── MailFolderView.vue  # Folder list + split/list view modes, pagination, bulk actions, drag & drop,
│       │                       #   Shift/Ctrl-click and keyboard selection
│       ├── MailListItem.vue
│       ├── MailList.vue
│       └── MailToolbar.vue     # Shared toolbar (bulk/read/delete/refresh + reading-pane actions)
├── composables/
│   ├── stores/               # State stores
│   │   ├── useMailAccountsStore.ts
│   │   ├── usePreferencesStore.ts  # All per-user preferences (remote content, mark-as-read, folders, onboarding)
│   │   ├── useSelectedMailAccountStore.ts
│   │   └── useUserStore.ts
│   ├── useAPI.ts
│   ├── useAppCookies.ts
│   ├── useMailAttachments.ts # Authed binary fetch/download of mail attachments (`fetchAttachmentFile` → `File`)
│   ├── useMailDraft.ts       # Draft state, dirty tracking, debounced autosave, attachments, send/discard
│   ├── useMailDrag.ts        # Drag & drop state for moving mails between folders
│   ├── useAwaitedComputed.ts
│   ├── useBimiURL.ts         # Resolves a sender's BIMI brand-logo URL via the API
│   ├── useDashboard.ts
│   ├── useDefaultOnFormError.ts
│   ├── useGravatarURL.ts
│   ├── useMailViewMode.ts
│   ├── useRuntimeAppConfigs.ts
│   ├── useSanitizeHtml.ts
│   ├── useSubrouterInjectedData.ts
│   ├── useSubrouterPathDynamics.ts
│   └── updateAPIClient.ts
├── layouts/
│   ├── auth.vue              # Auth layout (login, register, etc.)
│   └── default.vue           # Main dashboard layout
├── middleware/
│   ├── auth.global.ts        # Global auth middleware
│   └── rewrites.global.ts    # URL rewrite middleware
├── pages/                    # Auto-imported pages (Nuxt file-based routing)
│   ├── (app)/                # Route group (no URL segment): main dashboard
│   │   ├── index.vue
│   │   ├── mail/[mailAccountID]/          # compose, index, folder/[folderPath]/{index,[mailUID]}
│   │   └── settings/         # index, security, apikeys/*, mail-accounts/*
│   │                         #   mail-accounts/[mailAccountID]/: index, identities, folder-settings,
│   │                         #   backend-configuration, onboarding
│   ├── admin/                # index, users
│   └── auth/                 # login, signup, forgot-password, reset-password
├── utils/
│   ├── index.ts
│   ├── abstractStore.ts      # Base store class
│   ├── mail/                 # NOT auto-imported (nested) — import explicitly
│   │   ├── mailAddress.ts    # `MailAddressUtils`: parse/format/validate/dedupe addresses
│   │   ├── mailIdentity.ts   # `MailIdentityUtils`: sender list, duplicates, min-one rule
│   │   ├── mailCompose.ts    # `MailComposeUtils`: reply/forward builders, HTML ⇄ text conversions
│   │   └── mailSelection.ts  # `MailSelectionUtils`: list selection rules (range, toggle, cursor move)
│   ├── mailboxDisplay.ts
│   ├── routeMatcher.ts
│   └── types.ts
└── api-client/               # Generated API client (do not hand-edit)
    ├── index.ts
    ├── client.gen.ts
    ├── sdk.gen.ts
    ├── types.gen.ts
    ├── zod.gen.ts
    ├── client/                # Generated client core
    └── core/                  # Core client utilities

server/                        # Nitro server routes (run on the SSR server)
└── routes/
    └── mail/[mailAccountID]/folder/[folderPath]/[mailUID]/attachment/[filename].get.ts
                               # Authenticated same-origin attachment preview proxy
```

## Commands

| Command | Description |
|---------|-------------|
| `bun run dev` | Start dev server on port 14128 |
| `bun run build` | Production build |
| `bun run start` | Start production server on port 14128 |
| `bun run generate` | Static site generation |
| `bun run preview` | Preview production build |
| `bun run typecheck` | Run `nuxt typecheck` + `tsc` |
| `bun test` | Run test suite |
| `bun run api-client:generate` | Regenerate API client from OpenAPI spec |

## Key Conventions

- **API Client**: Generated via `@hey-api/openapi-ts` from the Delivr API OpenAPI spec. **Do not hand-edit** `*.gen.ts` files. Regenerate with `bun run api-client:generate` (reads the spec from the running API at `http://localhost:14123/docs/v1/openapi`).
- **Binary endpoints / attachments** (`useMailAttachments`): the generated SDK returns parsed JSON, so it isn't used for binary bodies.
  - **Download** does a direct authenticated `fetch` to the API (bearer token from `useAppCookies`, base URL from `runtimeConfig.public.apiUrl`) → `Blob` → transient object URL revoked right after. Nothing is persisted client-side.
  - **Preview** opens a real, same-origin URL that mirrors the email's view route and ends in the filename: `/mail/{accountId}/folder/{folderPath}/{mailUID}/attachment/{filename}` (the `folderPath` segment is `encodeURIComponent(imapPath)`). It's served by the nitro route `server/routes/mail/[mailAccountID]/folder/[folderPath]/[mailUID]/attachment/[filename].get.ts`, which authenticates via the `dla_session_token` cookie, resolves the filename to the attachment id via the API's attachments list, proxies the bytes with a bearer token, and streams them back — so a browser tab (which can't send an `Authorization` header) shows a proper filename instead of a `blob:` UUID and still requires auth. (The API addresses attachments by index, so the filename→id lookup costs one extra list call.)
  - Inline preview is restricted to an allowlist of inert types (PDF + raster images, **not** SVG/HTML) to avoid script execution in the app origin; other types are forced to download. The allowlist is enforced **both** client-side (UX) and in the nitro route (security).
- **Composables**: All composables in `app/composables/` are auto-imported by Nuxt. Stores use the `use*Store` naming convention.
- **Auto-import scope**: Nuxt only scans the *top level* of `app/utils/` and `app/composables/`. Anything nested (e.g. `app/utils/mail/*`) must be imported explicitly — which is why the compose utils live there, as their namespace members would otherwise be picked up as (broken) auto-imports.
- **Sender identities**: every mail account has at least one — the API creates it together with the account and refuses to delete the last one (409), so the new-account form asks for a **Sender Address** (mirrored from the SMTP username until edited) and sends it as `identity` in the create body. Managing them afterwards happens under `/settings/mail-accounts/{id}/identities` and in the new-account wizard (`onboarding.vue`); both render `MailIdentitiesManager.vue`, which owns the CRUD against `/mail-accounts/{id}/identities` and saves each change immediately. The shared rules live in `app/utils/mail/mailIdentity.ts` (`MailIdentityUtils`, unit-tested in `tests/mailIdentity.test.ts`): the composer's "From" ordering (default identity → account address → the rest, deduped), the duplicate-address check the API doesn't do, `canDelete`, and the suggestion offered to an account without identities.
- **Signatures** are per identity, edited with the composer's own `MailComposeEditor` in the identity dialog and stored as **editor HTML** (not mail HTML — the body is converted by `toEmailHtml` when it is sent, and a pre-converted copy would no longer match what the editor gives back). In the body a signature lives inside `<div data-delivr-signature>`, which survives only because `MailComposeEditor` registers a `mailSignature` TipTap node for it — TipTap unwraps elements it has no node for. `MailComposeUtils` owns the block: `withSignature` inserts or replaces it (above a reply's "… wrote:" line or a forward's header, otherwise at the end), `readSignature`/`hasSignatureBlock` find it, `isSameHtml` compares it while ignoring the `margin:0` that `toEmailHtml` adds, and `toEmailHtml` drops an empty block. Switching the "From" identity mid-compose swaps the signature (`swapSignature` in `MailComposer.vue`) **only** while the block still matches the previous identity's — once edited, it is the user's text. `tests/mailSignatureEditor.test.ts` runs the real TipTap round trip under happy-dom, including a test that the marker *would* be lost without the node.
- **Composing mail**: `/mail/{accountId}/compose` handles every mode via query params — `?draft=<uid>&folder=<path>` (resume), `?reply|replyAll|forward=<uid>&folder=<path>`, or `?to=&subject=` (new). The page resolves the Drafts folder via special-use (falling back to INBOX), builds the prefilled content with `MailComposeUtils`, sanitizes quoted HTML with DOMPurify, and hands everything to `MailComposer.vue`.
- **Draft autosave** (`useMailDraft`): snapshot-based dirty tracking with a debounced save (2.5 s, 20 s max wait), serialized so only one save is in flight. The first save creates the draft (`POST`, flags `draft`+`seen`), later ones `PUT` it; since the API replaces the message, the draft UID and attachment ids are remapped after every save and the `?draft=` query is kept in sync. A 404 recreates a lost draft; 5xx retries once after 15 s. Sending force-saves first, then calls `/send` with `moveToSent`. TipTap normalizes content on `create`, so the editor emits `ready` and the composable takes its pristine baseline only then — otherwise an untouched reply would look dirty.
- **Components**: Auto-imported from `app/components/`. Organized by domain (dashboard/, mail/, form/, img/).
- **Layouts**: `auth.vue` for unauthenticated routes, `default.vue` for the main dashboard.
- **Middleware**: Global middleware in `app/middleware/`. Auth middleware handles session validation. Rewrites middleware handles URL transformations.
- **State Management**: Simple composable stores (not Pinia) in `app/composables/stores/`. The `abstractStore.ts` utility provides a base class pattern.
- **Preferences** (`usePreferencesStore`): every per-user preference is loaded in one `GET /account/preferences` (pre-warmed by `auth.global.ts`), and each is saved through its own `PUT /account/preferences/<key>` — only the ones that changed. Writes **throw** instead of falling back to the defaults when the preferences couldn't be loaded (merging a remote-content rule into an empty policy would wipe the user's rules), and throw after rolling back a value whose write failed, so callers must catch and toast. `login.vue` clears it (and the mail-account stores) because a previous user's session may still be in memory. Unit-tested in `tests/preferencesStore.test.ts`.
- **Styling**: Nuxt UI components with custom CSS in `app/assets/css/main.css`.
- **PWA**: Configured via `@vite-pwa/nuxt` in `nuxt.config.ts`.
- **Icons**: Use Lucide icons via the `i-lucide-*` format (e.g., `i-lucide-mail`).

## Architecture Notes

- The app is a Nuxt 4 project using the `app/` directory structure (not the legacy `pages/` at root).
- The API client is generated from the Delivr API backend — keep the backend running and up-to-date before regenerating.
- Nuxt UI 4 components use the `U` prefix (e.g., `UButton`, `UInput`). Check the Nuxt UI docs for component APIs.
- The app uses Vue Router 5 — route definitions are file-based under `app/pages/`.
- `nuxt.config.ts` contains the full configuration including PWA, devtools, and module setup.
