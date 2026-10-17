FROM node:22-alpine AS build
WORKDIR /app/biaws-mcp
COPY biaws-mcp/package.json biaws-mcp/package-lock.json ./
RUN npm ci
COPY biaws-mcp ./
RUN npm run build

FROM node:22-alpine
ENV NODE_ENV=production
WORKDIR /app/biaws-mcp
COPY biaws-mcp/package.json biaws-mcp/package-lock.json ./
RUN npm ci --omit=dev
COPY --from=build /app/biaws-mcp/dist ./dist
USER node
EXPOSE 3120
CMD ["node", "dist/src/http.js"]

