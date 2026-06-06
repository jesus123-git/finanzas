# ─── Stage 1: dependencias base ──────────────────────────────────────────────
FROM node:20-alpine AS base
WORKDIR /app
COPY package*.json ./
RUN npm ci

# ─── Stage 2: desarrollo (next dev con hot-reload) ───────────────────────────
FROM base AS development
COPY . .
EXPOSE 3000
CMD ["npm", "run", "dev"]

# ─── Stage 3: builder (next build → .next/standalone) ────────────────────────
FROM base AS builder
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# ─── Stage 4: producción (standalone output de Next.js) ──────────────────────
FROM node:20-alpine AS production
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
# next build --standalone copia solo lo necesario
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
EXPOSE 3000
CMD ["node", "server.js"]
