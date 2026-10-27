# Build from the mobile/ directory. This file prepares a preview artifact only.
FROM node:24-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts
COPY . .
ARG PREVIEW_WEB_ORIGIN
RUN test -n "$PREVIEW_WEB_ORIGIN" && \
    EXPO_PUBLIC_PREVIEW_WEB_ORIGIN="$PREVIEW_WEB_ORIGIN" \
    EXPO_PUBLIC_WEB_BASE_URL="$PREVIEW_WEB_ORIGIN" \
    EXPO_PUBLIC_API_BASE_URL= \
    npx expo export --platform web --clear --output-dir /tmp/export && \
    EXPO_PUBLIC_PREVIEW_WEB_ORIGIN="$PREVIEW_WEB_ORIGIN" \
    node deploy/preview/package.mjs /tmp/export /artifact
FROM node:24-alpine
WORKDIR /app
COPY --from=build --chown=node:node /artifact/ ./
ENV NODE_ENV=production PORT=8080 PREVIEW_BIND_HOST=0.0.0.0
USER node
EXPOSE 8080
CMD ["node", "server.mjs"]
