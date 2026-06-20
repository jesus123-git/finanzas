-- Moneda de operación de la empresa (LATAM): COP por defecto
ALTER TABLE "businesses" ADD COLUMN "currency" TEXT NOT NULL DEFAULT 'COP';
