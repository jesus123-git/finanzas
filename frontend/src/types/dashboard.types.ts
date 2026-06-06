import { AccountType, TransactionType } from './api.enums';

// ─── Re-exportamos los enums para que los componentes los importen desde aquí ─
export { AccountType, TransactionType };

// ─── BankAccount ──────────────────────────────────────────────────────────────

export interface BankAccount {
  id: string;
  name: string;
  type: AccountType;
  balance: number;
  currency: string;
  provider: string | null;
  externalAccountId: string | null;
  userId: string;
  createdAt: string;
  updatedAt: string;
}

// ─── Balance Summary ──────────────────────────────────────────────────────────

export interface BalanceSummary {
  totalByCurrency: Record<string, number>; // { COP: 3500000, USD: 1200 }
  accountCount: number;
}

// ─── Transaction ──────────────────────────────────────────────────────────────

export interface Transaction {
  id: string;
  amount: number;
  description: string;
  type: TransactionType;
  date: string;
  bankAccount: { id: string; name: string; currency: string };
  category: { id: string; name: string };
  userId: string;
  createdAt: string;
}

export interface PaginatedTransactions {
  data: Transaction[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  totalIncome: number;
  totalExpense: number;
}

// ─── Estado del dashboard ─────────────────────────────────────────────────────

export interface DashboardData {
  summary: BalanceSummary;
  accounts: BankAccount[];
  recentTransactions: Transaction[];
  totalIncome: number;
  totalExpense: number;
}
