# Bun runs the TS sources directly: no build step, no tsc on the tiny VPS.
# The server exposes native stateless Streamable HTTP itself (PORT),
# so supergateway (and its per-session child processes) is gone.
FROM oven/bun:alpine
RUN apk add --no-cache tzdata && adduser -D -h /home/bun bun
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --production
COPY src ./src
USER bun
# Profile tokens live in ~/.fatsecret-mcp/config.json; mount it as a volume
VOLUME /home/bun/.fatsecret-mcp
ENV PORT=8000
EXPOSE 8000
CMD ["bun", "src/index.ts"]
