# Finanzas — Proyecto Full-Stack

Stack: **Next.js 14** · **NestJS** · **PostgreSQL** · **Prisma** · **Docker**

## Inicio rápido

```bash
# 1. Copiar variables de entorno
cp backend/.env.example backend/.env
cp frontend/.env.local.example frontend/.env.local

# 2. Levantar toda la infraestructura
docker compose up --build

# 3. Ejecutar migraciones de base de datos (primera vez)
docker compose exec backend npx prisma migrate dev --name init
```

| Servicio    | URL                            |
|-------------|--------------------------------|
| Frontend    | http://localhost:3000          |
| Backend API | http://localhost:3001/api/v1   |
| Swagger     | http://localhost:3001/api/docs |
| PostgreSQL  | localhost:5432                 |

## Estructura

```
finanzas/
├── frontend/          # Next.js + TypeScript + Tailwind
├── backend/           # NestJS + TypeScript + Prisma
├── docker/            # Scripts de inicialización de DB
└── docker-compose.yml
```

## Comandos útiles

```bash
# Solo desarrollo local (sin Docker)
cd backend  && npm install && npm run start:dev
cd frontend && npm install && npm run dev

# Abrir Prisma Studio (GUI de la BD)
cd backend && npx prisma studio

# Ver logs de un servicio
docker compose logs -f backend
```