FROM node:22-alpine AS build

WORKDIR /app/biaws-ui
COPY biaws-ui/package.json biaws-ui/package-lock.json ./
RUN npm ci

COPY shared /app/shared
COPY biaws-ui ./
ENV VITE_ISSUE_API_URL=""
RUN npm run build

FROM nginx:1.29-alpine

COPY docker/nginx.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /app/biaws-ui/dist /usr/share/nginx/html

EXPOSE 80
