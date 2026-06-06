# ─── Stage 1: dependencias base ──────────────────────────────────────────────
FROM node:20-alpine AS base
WORKDIR /app
COPY package*.json ./
RUN npm install

# ─── Stage 2: desarrollo (next dev con hot-reload) ───────────────────────────
FROM base AS development
COPY . .
EXPOSE 3000
CMD ["npm", "run", "dev"]

# ─── Stage 3: builder ────────────────────────────────────────────────────────
FROM base AS builder
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# ─── Stage 4: producción ─────────────────────────────────────────────────────
FROM node:20-alpine AS production
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
EXPOSE 3000
CMD ["node", "server.js"]
