FROM node:22-alpine AS build
WORKDIR /app
COPY biaws-api/package.json biaws-api/package-lock.json ./biaws-api/
RUN cd biaws-api && npm ci
COPY shared ./shared
COPY biaws-api ./biaws-api
RUN cd biaws-api && npm run build

FROM node:22-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY biaws-api/package.json biaws-api/package-lock.json ./biaws-api/
RUN cd biaws-api && npm ci --omit=dev
COPY --from=build /app/biaws-api/dist ./biaws-api/dist
COPY shared ./shared
COPY biaws-cli ./biaws-cli
COPY starter-skills ./starter-skills
WORKDIR /app/biaws-api
EXPOSE 3100
CMD ["npm", "start"]
