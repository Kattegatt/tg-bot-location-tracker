FROM node:20-alpine

WORKDIR /app

COPY package.json package-lock.json tsconfig.base.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/bot/package.json apps/bot/package.json
COPY apps/webapp/package.json apps/webapp/package.json
COPY packages/shared/package.json packages/shared/package.json

RUN npm ci

COPY . .

RUN npm -w packages/shared run build \
  && npm -w apps/api run build

WORKDIR /app/apps/api

CMD ["npm", "run", "start:prod"]

