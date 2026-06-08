export interface User {
  id: string;
  name: string;
  email: string;
  phone?: string;
  avatarUrl?: string;
  createdAt: string;
}

export interface Business {
  id: string;
  userId: string;
  name: string;
  nit?: string;
  legalName?: string;
  logoUrl?: string;
  address?: string;
  phone?: string;
  email?: string;
  taxRegime?: string;
  isActive: boolean;
  usePriceLists: boolean;
  createdAt: string;
  _count?: {
    customers: number;
    invoices: number;
    transactions: number;
  };
}

export interface Customer {
  id: string;
  businessId: string;
  name: string;
  nit?: string;
  email?: string;
  phone?: string;
  address?: string;
  notes?: string;
  createdAt: string;
}

export interface Transaction {
  id: string;
  businessId?: string;
  type: 'INCOME' | 'EXPENSE' | 'TRANSFER';
  amount: number;
  description: string;
  notes?: string;
  date: string;
  categoryLabel?: string;
  createdAt: string;
}

export interface InvoiceItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  taxRate: number;
  total: number;
}

export interface Invoice {
  id: string;
  businessId: string;
  customerId?: string;
  number: string;
  status: 'DRAFT' | 'SENT' | 'VIEWED' | 'PAID' | 'OVERDUE' | 'CANCELLED';
  issueDate: string;
  dueDate?: string;
  subtotal: number;
  tax: number;
  total: number;
  notes?: string;
  items?: InvoiceItem[];
  customer?: { id: string; name: string; email?: string; nit?: string };
  createdAt: string;
}

export interface DashboardKPIs {
  currentMonth: {
    income: number;
    expenses: number;
    profit: number;
  };
  pendingCollection: {
    total: number;
    count: number;
  };
}

export interface AuthResponse {
  user: User;
  accessToken: string;
}
