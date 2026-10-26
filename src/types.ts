export type TxType = 'income' | 'expense';

export interface Transaction {
  id: string;
  title: string;
  amount: number;
  type: TxType;
  category: string;
  method: string;
  date: string; // ISO yyyy-mm-dd
  notes: string;
  createdAt: number;
  /** Link transactions created together (installments/recurrent). */
  groupId?: string;
  /** Which installment this is (e.g. 1 of 12). */
  installment?: number;
  /** Total installments in the group. */
  installmentTotal?: number;
  /** Whether this is a recurring monthly entry. */
  recurrent?: boolean;
  status?: 'settled' | 'planned';
  accountId?: string;
}

export interface Category {
  name: string;
  type: TxType;
}

/** Monthly budget limit for an expense category, in BRL. */
export interface Budget {
  category: string;
  limit: number;
}

export interface Account { id: string; name: string; openingBalance: number; }
export interface Transfer { id: string; from: string; to: string; amount: number; date: string; }

export interface AppData {
  accounts?: Account[];
  transfers?: Transfer[];
  transactions: Transaction[];
  categories: Category[];
  budgets: Budget[];
  settings: {
    theme: 'light' | 'dark';
    currency: string;
    lastBackupDate: number | null;
  };
}
