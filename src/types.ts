import { WooCommerceProduct } from './services/woocommerce';

export interface Customer {
  id: string;
  name: string;
  email: string;
  company?: string;
  address?: string;
  city?: string;
}

export interface WooCommerceOrder {
  id: number;
  number: string;
  date_created: string;
  total: string;
  billing: {
    first_name: string;
    last_name: string;
    company: string;
    email: string;
    address_1: string;
    city: string;
  };
  line_items: Array<{
    name: string;
    quantity: number;
    price: string;
    product_id: number;
  }>;
}

export interface Quote {
  id: string;
  number: string;
  date: string;
  validUntil: string;
  status: 'draft' | 'sent' | 'accepted' | 'rejected' | 'expired';
  customer: {
    name: string;
    email: string;
    company?: string;
    address: string;
    city: string;
  };
  items: Array<{
    description: string;
    quantity: number;
    unitPrice: number;
    total: number;
    sku?: string;
    product_id?: string | number;
    taxRate: number;
  }>;
  subtotal: number;
  tax: number;
  total: number;
  notes?: string;
  created_at?: string;
  updated_at?: string;
}

export interface PurchaseOrder {
  id: string;
  number: string;
  date: string;
  expectedDeliveryDate: string;
  status: 'draft' | 'pending' | 'partial' | 'complete' | 'cancelled';
  supplierId: string;
  items: Array<{
    id: string;
    productId: string;
    description: string;
    quantity: number;
    received?: number;
    unitPrice: number;
    total: number;
    taxRate: number;
    taxAmount: number;
    sku?: string;
  }>;
  subtotal: number;
  tax: number;
  total: number;
  notes?: string;
}

export interface ReceiveItems {
  purchaseOrderId: string;
  receiveDate: string;
  items: Array<{
    id: string;
    productId: string;
    receivedQuantity: number;
  }>;
  notes?: string;
}

export interface ReturnNote {
  id: string;
  number: string;
  orderId?: number;
  customer: {
    name: string;
    email: string;
    company?: string;
  };
  date: string;
  status: 'pending' | 'approved' | 'rejected' | 'processed';
  items: Array<{
    id: string;
    description: string;
    quantity: number;
    reason: string;
    condition: 'new' | 'used' | 'damaged';
    productId?: number;
    refundAmount?: number;
  }>;
  reason?: string;
  notes?: string;
  refundAmount?: number;
}

export interface Supplier {
  id: string;
  name: string;
  email: string;
  phone?: string;
  address?: string;
  city?: string;
  notes?: string;
}

export interface ProductWithQuantity extends WooCommerceProduct {
  quantity: number;
  taxRate: number;
}