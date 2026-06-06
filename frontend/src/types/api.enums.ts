// Espejo de los enums del backend (Prisma).
// Mantenerlos aquí evita depender de @prisma/client en el frontend.

export enum AccountType {
  CHECKING = 'CHECKING',
  SAVINGS  = 'SAVINGS',
  CREDIT   = 'CREDIT',
  CASH     = 'CASH',
}

export enum TransactionType {
  INCOME   = 'INCOME',
  EXPENSE  = 'EXPENSE',
  TRANSFER = 'TRANSFER',
}
