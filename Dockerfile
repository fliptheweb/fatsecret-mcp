FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json tsconfig.json ./
RUN npm ci
COPY src ./src
RUN npm run build && npm prune --omit=dev

# supergateway exposes the stdio server over Streamable HTTP for remote clients
FROM node:22-alpine
RUN apk add --no-cache tzdata && npm install -g supergateway@4.3.0
WORKDIR /app
COPY --from=build /app/package.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
USER node
# Profile tokens live in ~/.fatsecret-mcp/config.json; mount it as a volume
VOLUME /home/node/.fatsecret-mcp
EXPOSE 8000
CMD ["supergateway", "--stdio", "node /app/dist/index.js", "--outputTransport", "streamableHttp", \
     "--stateful", "--sessionTimeout", "3600000", "--port", "8000", "--healthEndpoint", "/healthz"]
