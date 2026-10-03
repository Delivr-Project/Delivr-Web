FROM oven/bun:latest-slim

RUN apt-get update && apt-get install -y --no-install-recommends curl ca-certificates openssl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /opt/delivr/web

COPY .output ./app/.output

EXPOSE 14128/tcp

ENV NITRO_ENV=production
ENV NITRO_HOST=::
ENV NITRO_PORT=14128

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s \
	CMD curl -f http://localhost:14128 || exit 1

CMD [ "bun", "run", "/opt/leicraftmc/auth/laviac/app/.output/server/index.mjs" ]
