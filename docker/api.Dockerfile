FROM node:22-alpine

ENV NODE_ENV=production
WORKDIR /app

COPY biaws-api/package.json biaws-api/package-lock.json ./biaws-api/
RUN cd biaws-api && npm ci --omit=dev

COPY shared ./shared
COPY biaws-api ./biaws-api
COPY biaws-cli ./biaws-cli
COPY starter-skills ./starter-skills

WORKDIR /app/biaws-api
EXPOSE 3100

CMD ["npm", "start"]
