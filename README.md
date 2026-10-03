<div align="center">

<img src="./public/static/logo/logo.svg" alt="Delivr" height="56" />

# Delivr Web

### A Mail Client that actually Delivers

A fast, installable webmail client built with Nuxt 4 & Nuxt UI —
your inbox, in a clean PWA that stays out of the way.

<br />

[![Nuxt](https://img.shields.io/badge/Nuxt-4.x-00DC82?logo=nuxtdotjs&logoColor=white)](https://nuxt.com)
[![Vue](https://img.shields.io/badge/Vue-3.x-4FC08D?logo=vuedotjs&logoColor=white)](https://vuejs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-6.x-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Bun](https://img.shields.io/badge/Bun-1.x-000000?logo=bun&logoColor=white)](https://bun.sh)
[![PWA](https://img.shields.io/badge/PWA-ready-00bcff?logo=pwa&logoColor=white)](https://web.dev/progressive-web-apps/)
[![License](https://img.shields.io/badge/License-AGPL--3.0-00bcff)](./LICENSE)

[**API Backend →**](https://github.com/Delivr-Project/Delivr-API) &nbsp;•&nbsp; [Features](#-features) &nbsp;•&nbsp; [Quick Start](#-quick-start) &nbsp;•&nbsp; [Configuration](#️-configuration)

</div>

---

## ✨ Features

- 📥 **Full mail workflow** — browse folders, read threads, compose, and manage flags across multiple mail accounts.
- 🗂️ **Multi-account, multi-folder** — switch between mail accounts and drill into any mailbox folder from a single dashboard.
- 📎 **Safe attachments & content** — HTML is sanitised with [`dompurify`](https://github.com/cure53/DOMPurify) and a remote-content policy keeps tracking pixels at bay.
- 🔑 **Accounts & API keys** — sign in, reset passwords, manage security settings, and issue API keys from the UI.
- 🛡️ **Admin tools** — user administration for instance operators.
- 📱 **Installable PWA** — `@vite-pwa/nuxt` with auto-update, offline shell, and a native app-like experience.
- 🌗 **Dark by default** — a focused, dark-first interface built on [Nuxt UI 4](https://ui.nuxt.com) and Lucide icons.
- 🔌 **Type-safe API client** — fully generated from the Delivr API's OpenAPI spec, so the frontend and backend never drift.

## 🧱 Tech Stack

| Layer | Choice |
|-------|--------|
| Runtime | **Bun 1.x** |
| Framework | **Nuxt 4.x** (SSR) |
| UI | **Nuxt UI 4.x** (Reka UI) + Lucide icons |
| Language | **TypeScript 6.x** + Vue 3 + Vue Router 5 |
| API Client | `@hey-api/openapi-ts` (generated) |
| Validation | **Zod 4.x** |
| PWA | `@vite-pwa/nuxt` |
| Sanitization | `dompurify` |

## 🚀 Quick Start

> **Prerequisites:** [Bun](https://bun.sh) 1.x, and a running [Delivr API](https://github.com/Delivr-Project/Delivr-API) instance.

```bash
# 1. Install dependencies
bun install

# 2. Configure your environment
cp example.env .env
#    → point DELIVR_API_URL at your running Delivr API

# 3. Start the dev server
bun run dev
```

Open **http://localhost:14128** and sign in.

> 💡 **Regenerating the API client:** the frontend talks to the backend through a generated client. Keep the API running and up to date, then run `bun run api-client:generate`. Never hand-edit the `*.gen.ts` files.

## 🐳 Docker

Want to run the whole thing, API included? The [Delivr API](https://github.com/Delivr-Project/Delivr-API) repository has a `docker-compose.yml` that starts both with one command. That's usually the easiest way.

If you already have an API running somewhere and just need the web client, grab the ready-made image:

```bash
docker run -d -p 14128:14128 \
  -e NUXT_PUBLIC_API_URL=https://api.example.com/v1 \
  -e NUXT_PUBLIC_APP_URL=https://mail.example.com \
  ghcr.io/delivr-project/delivr-web:latest
```

Or with Compose: `DELIVR_API_URL=https://api.example.com/v1 docker compose up -d`. To update, run `docker compose pull && docker compose up -d`.

Want to build it yourself instead? `docker build -f docker/Dockerfile -t delivr-web .` (or add `--build` to the Compose command).

You configure the image when you start it, so one build works for any setup:

| Variable | What it does | Default |
|----------|--------------|---------|
| `NUXT_PUBLIC_API_URL` | Where the API lives, including `/v1` | `http://localhost:14123/v1` |
| `NUXT_PUBLIC_APP_URL` | The address of this web client | `http://localhost:14128` |
| `NUXT_PUBLIC_IS_SIGNUP_ENABLED` | Set to `true` to show the sign-up link on the login page | `false` |
| `PORT` | Port inside the container | `14128` |

Keep in mind that the API URL is used by your *browser*, not by the container, so it has to be an address you can open yourself. On the API side, `DLA_APP_URL` must point to this web client, or the browser will block the requests (CORS).

## ⚙️ Configuration

Environment-based configuration (see [`example.env`](./example.env)):

| Variable | Description | Default |
|----------|-------------|---------|
| `DELIVR_API_URL` | Base URL of the Delivr API (v1) | `http://localhost:14123/v1` |
| `DELIVR_APP_URL` | Public URL of this web app | `http://localhost:14128` |
| `DELIVR_ENABLE_SIGNUP` | Allow self-service registration | `false` |
| `USE_DEV_PROXY` | Route API calls through a dev proxy | `false` |

## 🛠️ Commands

| Command | Description |
|---------|-------------|
| `bun run dev` | Start dev server on port `14128` |
| `bun run build` | Production build |
| `bun run start` | Start production server on port `14128` |
| `bun run generate` | Static site generation |
| `bun run preview` | Preview the production build |
| `bun run typecheck` | `nuxt typecheck` + `tsc` |
| `bun test` | Run the test suite |
| `bun run api-client:generate` | Regenerate the API client from the OpenAPI spec |

## 🗺️ Project Structure

```
app/
├── app.vue                 # Root component
├── components/             # Auto-imported, organised by domain
│   ├── dashboard/          # Menus, search, notifications
│   ├── mail/               # List, folder view, detail, compose
│   ├── form/ · img/        # Shared form controls & branding
├── composables/            # Auto-imported logic
│   └── stores/             # Lightweight composable stores (not Pinia)
├── layouts/                # auth.vue (login) · default.vue (dashboard)
├── middleware/             # Global auth & URL-rewrite middleware
├── pages/                  # File-based routing
│   ├── auth/               # login · signup · forgot / reset password
│   ├── admin/              # user administration
│   └── (app)/              # mail, compose, settings, mail-accounts, apikeys
├── utils/                  # Helpers, base store, types
└── api-client/             # Generated API client — do not hand-edit
```

> **Note:** Files ending in `.gen.ts` are generated from the API's OpenAPI spec. Regenerate with `bun run api-client:generate` rather than editing them by hand.

## 📦 The Delivr Project

| Repository | Description |
|------------|-------------|
| **Delivr Web** _(you are here)_ | The Nuxt 4 web client & PWA |
| [**Delivr API**](https://github.com/Delivr-Project/Delivr-API) | The Bun + Hono backend |

## 📄 License

Licensed under the [GNU AGPL-3.0](./LICENSE).

<div align="center"><sub>Built with 💙 and Nuxt.</sub></div>
