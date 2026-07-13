// Mirrors the backend domain types (../../backend/src/types.ts).
// Money is always an integer number of cents.

export type MenuCategory = 'pizza' | 'sides' | 'drinks' | 'desserts';

export interface MenuItem {
  id: string;
  name: string;
  description: string;
  category: MenuCategory;
  price: number;
  imageUrl?: string;
  vegetarian?: boolean;
  spicy?: boolean;
}

export type PaymentProvider = 'stripe' | 'paypal' | 'mock';

export type OrderStatus =
  | 'pending_payment'
  | 'paid'
  | 'preparing'
  | 'ready'
  | 'cancelled';

export interface OrderLine {
  menuItemId: string;
  name: string;
  unitPrice: number;
  quantity: number;
}

export interface CustomerInfo {
  name?: string;
  phone?: string;
  address?: string;
  notes?: string;
}

export interface Order {
  id: string;
  lines: OrderLine[];
  subtotal: number;
  deliveryFee: number;
  total: number;
  currency: string;
  status: OrderStatus;
  customer?: CustomerInfo;
  payment?: { provider: PaymentProvider; reference?: string; paidAt?: string };
  createdAt: string;
  updatedAt: string;
}
