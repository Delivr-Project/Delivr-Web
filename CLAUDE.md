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

- **API Client**: Generated via `@hey-api/openapi-ts` from the Delivr API OpenAPI spec. **Do not hand-edit** `*.gen.ts` files. Regenerate with `bun run api-client:generate`.
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
