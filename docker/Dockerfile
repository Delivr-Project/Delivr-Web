# Builds the Delivr web client (Nuxt, Nitro "bun" preset) and serves it with Bun.
#
#   docker build -f docker/Dockerfile -t delivr-web .
#
# Runtime configuration (overrides the build-time defaults from nuxt.config.ts):
#   NUXT_PUBLIC_API_URL             Public URL of the Delivr API incl. version, e.g. https://api.example.com/v1
#   NUXT_PUBLIC_APP_URL             Public URL of this web client, e.g. https://mail.example.com
#   NUXT_PUBLIC_IS_SIGNUP_ENABLED   "true" to show the sign-up link on the login page

FROM oven/bun:1 AS build

WORKDIR /app

COPY package.json bun.lock ./
COPY patches ./patches
# postinstall ("nuxt prepare") needs the full source tree, it runs as part of "nuxt build" anyway
RUN bun install --frozen-lockfile --ignore-scripts

COPY . .

RUN bun run build


FROM oven/bun:1-slim

WORKDIR /app

COPY --from=build --chown=bun:bun /app/.output ./.output

ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=14128

USER bun

EXPOSE 14128/tcp

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD bun -e "fetch('http://127.0.0.1:' + process.env.PORT + '/').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"

CMD ["bun", ".output/server/index.mjs"]
