-- Script de inicialización de PostgreSQL
-- Se ejecuta una única vez cuando el volumen está vacío.

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
