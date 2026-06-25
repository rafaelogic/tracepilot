FROM mcr.microsoft.com/playwright:v1.61.1-jammy AS base
WORKDIR /app
ENV NODE_ENV=production

FROM base AS deps
ENV NODE_ENV=development
COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci

FROM deps AS build
ENV NODE_ENV=production
COPY tsconfig.server.json ./
COPY apps/api ./apps/api
COPY packages ./packages
RUN npm run prisma:generate
RUN npm run build:api

FROM base AS runner
COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci --omit=dev
COPY --from=build /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=build /app/dist-server ./dist-server
COPY apps/api/docker-entrypoint.sh ./apps/api/docker-entrypoint.sh
RUN chmod +x ./apps/api/docker-entrypoint.sh
EXPOSE 4040
ENTRYPOINT ["./apps/api/docker-entrypoint.sh"]
CMD ["npm", "start"]
