# ─── Stage 1: dependencias base ──────────────────────────────────────────────
FROM node:20-alpine AS base

# libc6-compat → compatibilidad de glibc que necesitan los binarios de Prisma
# openssl     → el query engine de Prisma se enlaza dinámicamente con libssl
RUN apk add --no-cache libc6-compat openssl

WORKDIR /app
COPY package*.json ./
RUN npm install

# ─── Stage 2: desarrollo (hot-reload con ts-node / nest cli) ─────────────────
FROM base AS development
COPY . .
# Generar Prisma Client para que los tipos estén disponibles al compilar TS
RUN npx prisma generate
EXPOSE 3001
CMD ["npm", "run", "start:dev"]

# ─── Stage 3: builder (compila TypeScript → dist/) ───────────────────────────
FROM base AS builder
COPY . .
# Generar Prisma Client ANTES de compilar: los tipos (enums, modelos) que
# importa el código TS solo existen después de `prisma generate`
RUN npx prisma generate
RUN npm run build

# ─── Stage 4: producción (imagen mínima, sin devDependencies) ────────────────
FROM node:20-alpine AS production
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
RUN npm install --omit=dev
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
# El cliente Prisma generado vive en node_modules del builder; copiarlo porque
# `npm install --omit=dev` no trae el CLI de prisma para regenerarlo aquí
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma/client ./node_modules/@prisma/client
EXPOSE 3001
# Aplicar migraciones pendientes contra DATABASE_URL antes de arrancar
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main.js"]
