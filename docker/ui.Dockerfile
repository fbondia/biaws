FROM node:22-alpine AS build

WORKDIR /app/biaws-ui
COPY biaws-ui/package.json biaws-ui/package-lock.json ./
RUN npm ci

COPY shared /app/shared
COPY biaws-ui ./
ARG VITE_MONITORING_REFRESH_SECONDS=30
ENV VITE_ISSUE_API_URL=""
ENV VITE_MONITORING_REFRESH_SECONDS=${VITE_MONITORING_REFRESH_SECONDS}
RUN npm run build

FROM nginx:1.29-alpine

COPY docker/nginx.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /app/biaws-ui/dist /usr/share/nginx/html

EXPOSE 80
