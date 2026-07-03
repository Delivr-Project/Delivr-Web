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
│   ├── dashboard/           # Dashboard components
│   │   ├── DashboardDeleteModal.vue
│   │   ├── DashboardPageHeader.vue
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
│       ├── MailDetailContent.vue
│       ├── MailFolderView.vue
│       ├── MailList.vue
│       └── MailListItem.vue
├── composables/
│   ├── stores/               # State stores
│   │   ├── useMailAccountsStore.ts
│   │   ├── useRemoteContentPolicyStore.ts
│   │   ├── useSelectedMailAccountStore.ts
│   │   └── useUserStore.ts
│   ├── useAPI.ts
│   ├── useAppCookies.ts
│   ├── useMailAttachments.ts # Authed binary fetch/download of mail attachments
│   ├── useAwaitedComputed.ts
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
├── utils/
│   ├── index.ts
│   ├── abstractStore.ts      # Base store class
│   ├── mailboxDisplay.ts
│   ├── routeMatcher.ts
│   └── types.ts
└── api-client/               # Generated API client (do not hand-edit)
    ├── index.ts
    ├── client.gen.ts
    ├── sdk.gen.ts
    ├── types.gen.ts
    ├── zod.gen.ts
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
- **Components**: Auto-imported from `app/components/`. Organized by domain (dashboard/, mail/, form/, img/).
- **Layouts**: `auth.vue` for unauthenticated routes, `default.vue` for the main dashboard.
- **Middleware**: Global middleware in `app/middleware/`. Auth middleware handles session validation. Rewrites middleware handles URL transformations.
- **State Management**: Simple composable stores (not Pinia) in `app/composables/stores/`. The `abstractStore.ts` utility provides a base class pattern.
- **Styling**: Nuxt UI components with custom CSS in `app/assets/css/main.css`.
- **PWA**: Configured via `@vite-pwa/nuxt` in `nuxt.config.ts`.
- **Icons**: Use Lucide icons via the `i-lucide-*` format (e.g., `i-lucide-mail`).

## Architecture Notes

- The app is a Nuxt 4 project using the `app/` directory structure (not the legacy `pages/` at root).
- The API client is generated from the Delivr API backend — keep the backend running and up-to-date before regenerating.
- Nuxt UI 4 components use the `U` prefix (e.g., `UButton`, `UInput`). Check the Nuxt UI docs for component APIs.
- The app uses Vue Router 5 — route definitions are file-based under `app/pages/`.
- `nuxt.config.ts` contains the full configuration including PWA, devtools, and module setup.
