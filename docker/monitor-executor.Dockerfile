FROM node:22-alpine

ENV NODE_ENV=production
WORKDIR /app

COPY biaws-monitor-executor/package.json biaws-monitor-executor/package-lock.json ./biaws-monitor-executor/
RUN cd biaws-monitor-executor && npm ci --omit=dev

COPY shared ./shared
COPY biaws-monitor-executor ./biaws-monitor-executor

WORKDIR /app/biaws-monitor-executor
EXPOSE 3110

CMD ["npm", "start"]
