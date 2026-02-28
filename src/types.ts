export interface Subscription {
  id: string;
  name: string;
  activationDate: string;
  expirationDate: string;
  notes: string;
  category: string;
}

export type TransactionType = 'expense' | 'income';

export interface Transaction {
  id: string;
  type: TransactionType;
  person: string;
  description: string;
  amount: number;
  date: string;
}

export interface Purchase {
  id: string;
  date: string;
  details: string;
}

export interface Customer {
  id: string;
  name: string;
  username: string;
  purchases: Purchase[];
  notes: string;
}

export interface Product {
  id: string;
  name: string;
  costPrice: number;
  supplier: string;
  sellingPrice: number;
  notes: string;
}

export interface SaleRecord {
  id: string;
  customerName: string;
  customerUsername: string;
  date: string;
  productName: string;
  price: number;
  notes: string;
}
