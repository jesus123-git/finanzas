# ─── Stage 1: dependencias base ──────────────────────────────────────────────
FROM node:20-alpine AS base
WORKDIR /app
COPY package*.json ./
RUN npm install

# ─── Stage 2: desarrollo (hot-reload con ts-node / nest cli) ─────────────────
FROM base AS development
COPY . .
EXPOSE 3001
CMD ["npm", "run", "start:dev"]

# ─── Stage 3: builder (compila TypeScript → dist/) ───────────────────────────
FROM base AS builder
COPY . .
RUN npm run build

# ─── Stage 4: producción (imagen mínima, sin devDependencies) ────────────────
FROM node:20-alpine AS production
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
RUN npm install --omit=dev
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
EXPOSE 3001
CMD ["node", "dist/main.js"]
