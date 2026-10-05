FROM oven/bun:1.3.10-alpine AS bun-base
WORKDIR /usr/src/app

RUN apk add --no-cache netcat-openbsd openssl

FROM bun-base AS bun-install
COPY package.json bun.lock ./
COPY prisma ./prisma/
RUN bun install --frozen-lockfile
RUN bunx prisma generate

FROM bun-base AS local
ENV NODE_ENV=development
COPY . .
COPY --from=bun-install /usr/src/app/node_modules ./node_modules
COPY --from=bun-install /usr/src/app/src/generated ./src/generated
RUN sed -i 's/\r$//' ./entrypoint/setup.sh \
    && chmod +x ./entrypoint/setup.sh
ENTRYPOINT [ "sh", "./entrypoint/setup.sh" ]
CMD [ "bun", "--watch", "src/index.ts" ]

FROM local AS development

FROM node:24-alpine AS node-base
WORKDIR /usr/src/app

RUN apk add --no-cache netcat-openbsd openssl

FROM node-base AS node-install
COPY package.json package-lock.json ./
COPY prisma ./prisma/
RUN npm ci
RUN npx prisma generate

FROM node-base AS staging
ENV NODE_ENV=staging
COPY . .
COPY --from=node-install /usr/src/app/node_modules ./node_modules
COPY --from=node-install /usr/src/app/src/generated ./src/generated
RUN sed -i 's/\r$//' ./entrypoint/setup.sh \
    && chmod +x ./entrypoint/setup.sh
ENTRYPOINT [ "sh", "./entrypoint/setup.sh" ]
CMD [ "npm", "run", "start" ]

FROM staging AS production
ENV NODE_ENV=production
