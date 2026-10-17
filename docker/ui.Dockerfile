FROM node:22-alpine AS build

WORKDIR /app/biaws-ui
COPY biaws-ui/package.json biaws-ui/package-lock.json ./
RUN npm ci

COPY shared /app/shared
COPY biaws-ui ./
ARG VITE_MONITORING_REFRESH_SECONDS=30
ENV VITE_BIAWS_API_URL=""
ENV VITE_MONITORING_REFRESH_SECONDS=${VITE_MONITORING_REFRESH_SECONDS}
RUN npm run build

FROM nginx:1.29-alpine
COPY docker/safe-logging.conf /etc/nginx/conf.d/00-safe-logging.conf

COPY docker/proxy-api.conf /etc/nginx/templates/proxy-api.conf.template
ENV NGINX_ENVSUBST_OUTPUT_DIR=/etc/nginx
ENV BIAWS_MCP_HTTP_ENABLED=false BIAWS_PUBLIC_SCHEME=http
COPY docker/nginx.conf.template /etc/nginx/templates/conf.d/default.conf.template
COPY --from=build /app/biaws-ui/dist /usr/share/nginx/html

EXPOSE 80
