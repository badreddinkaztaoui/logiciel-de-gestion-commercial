export interface WooCommerceLineItem {
  id: number;
  name: string;
  product_id: number;
  quantity: number;
  price: string;
  tax_class?: string;
  sku?: string;
  total: string;
  total_tax: string;
  subtotal: string;
  subtotal_tax: string;
}

export interface WooCommerceOrder {
  id: number;
  number: string;
  status: 'pending' | 'processing' | 'on-hold' | 'completed' | 'cancelled' | 'refunded';
  currency: string;
  date_created: string;
  date_modified: string;
  total: string;
  total_tax: string;
  shipping_total: string;
  shipping_tax: string;
  customer_id: number;
  billing?: {
    first_name?: string;
    last_name?: string;
    company?: string;
    email?: string;
    phone?: string;
    address_1?: string;
    address_2?: string;
    city?: string;
    postcode?: string;
    country?: string;
  };
  shipping: {
    first_name: string;
    last_name: string;
    company: string;
    address_1: string;
    address_2: string;
    city: string;
    state: string;
    postcode: string;
    country: string;
  };
  line_items?: WooCommerceLineItem[];
  tax_lines: {
    id: number;
    rate_code: string;
    rate_id: number;
    label: string;
    compound: boolean;
    tax_total: string;
    shipping_tax_total: string;
    rate_percent: number;
  }[];
  user_id?: string;
  created_at?: string;
  updated_at?: string;
}

export interface Customer {
  id: string; // UUID
  woocommerce_id?: number;
  first_name: string;
  last_name: string;
  company?: string;
  email: string;
  phone?: string;
  address?: string;
  city?: string;
  postal_code?: string;
  country?: string;
  ice?: string;
  notes?: string;
  billing_data?: Record<string, any>;
  shipping_data?: Record<string, any>;
  user_id?: string; // UUID
  created_at?: string;
  updated_at?: string;
}

export interface Quote {
  id: string;
  number: string;
  customer: {
    name: string;
    email: string;
    company?: string;
    address: string;
    city: string;
  };
  date: string;
  validUntil: string;
  status: 'draft' | 'sent' | 'accepted' | 'rejected' | 'expired' | 'deleted';
  items: {
    description: string;
    quantity: number;
    unitPrice: number;
    total: number;
  }[];
  subtotal: number;
  tax: number;
  total: number;
  conditions?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface Invoice {
  id: string;
  number: string;
  orderId?: number;  // woocommerce_order_id
  customerId?: string;  // customer_id (uuid)
  date: string;
  dueDate: string;  // due_date
  status: 'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled';
  customer: {
    name: string;
    email: string;
    company: string;
    address: string;
    city: string;
    postal_code: string;  // Changed from postalCode
    country: string;
  };
  items: Array<{
    id: string;
    description: string;
    quantity: number;
    unitPrice: number;
    unitPriceHT: number;
    total: number;
    totalHT: number;
    taxRate: number;
    taxAmount: number;
    productId?: number;
    sku?: string;
  }>;
  subtotal: number;
  tax: number;  // tax_amount in DB
  taxRate: number;  // tax_rate in DB
  total: number;
  currency: string;
  paymentMethod?: string;  // payment_method
  paymentDate?: string;  // payment_date
  notes?: string;
  woocommerceStatus?: string;
  lastSyncedAt?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface DeliveryNote {
  id: string;
  number: string;
  orderId?: number;
  invoice_id?: string;
  customer_id?: string;
  customer_data?: any;
  date: string;
  estimated_delivery_date?: string;
  actual_delivery_date?: string;
  status: 'draft' | 'in_transit' | 'delivered' | 'cancelled';
  items: any[];
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface ReturnNote {
  id: string;
  number: string;
  invoice_id?: string;
  delivery_note_id?: string;
  customer_id?: string;
  customer_data?: {
    name: string;
    email: string;
    company?: string;
  };
  date: string;
  status: 'draft' | 'processed' | 'cancelled';
  items: Array<{
    id: string;
    productId?: number;
    description: string;
    quantity: number;
    condition: 'new' | 'used' | 'damaged';
    reason?: string;
    refundAmount: number;
  }>;
  reason?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface Supplier {
  id: string;
  name: string;
  company?: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  postal_code?: string;
  country?: string;
  ice?: string;
  notes?: string;
  created_at?: string;
  updated_at?: string;
}

export interface PurchaseOrder {
  id: string;
  number: string;
  supplier_id?: string;
  supplier_data?: any;
  date: string;
  expected_delivery_date?: string;
  status: 'draft' | 'sent' | 'confirmed' | 'received' | 'cancelled';
  items: any[];
  subtotal: number;
  tax_rate: number;
  tax_amount: number;
  total: number;
  currency: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface PurchaseOrderItem {
  id: string;
  productId: number;
  sku?: string;
  description: string;
  quantity: number;
  received: number;
  unitPrice: number; // Prix unitaire TTC
  total: number; // Total TTC pour cette ligne
  taxRate?: number; // Tax rate for this item (0, 7, 10, 20%)
  taxAmount?: number; // Tax amount for this item
}

export interface ReceiveItems {
  purchaseOrderId: string;
  receiveDate: string;
  items: {
    id: string;
    productId: number;
    quantity: number;
    receivedQuantity: number;
  }[];
  notes?: string;
}

export interface DocumentNumberSequence {
  documentType: string;
  number: string;
  reserved: boolean;
  confirmed: boolean;
  timestamp: string;
}

export interface SalesJournal {
  id: string;
  number: string;
  date: string; // Date for which the journal is generated
  createdAt: string; // When the journal was created
  status: 'draft' | 'validated';
  ordersIncluded: number[]; // Array of order IDs included in this journal
  lines: SalesJournalLine[];
  totals: {
    totalHT: number;
    totalTTC: number;
    taxBreakdown: {
      rate: number;
      base: number; // Base HT for this tax rate
      amount: number; // Tax amount
    }[];
  };
  notes?: string;
}

export interface SalesJournalLine {
  id: string;
  orderId: number;
  orderNumber: string;
  lineItemId: number;
  productId?: number;
  sku: string;
  productName: string;
  quantity: number;
  unitPriceTTC: number;
  totalTTC: number;
  taxRate: number;
  unitPriceHT: number;
  totalHT: number;
  taxAmount: number;
  customerName: string;
  customerEmail?: string;
}

export interface WooCommerceProduct {
  id: number;
  name: string;
  price: string;
  sku?: string;
  tax_class?: string;
}

export interface Client {
  id: string;
  woocommerce_id?: number;
  first_name: string;
  last_name: string;
  company?: string;
  email: string;
  phone?: string;
  address?: string;
  city?: string;
  postal_code?: string;
  country?: string;
  ice?: string;
  notes?: string;
  billing_data?: {
    first_name?: string;
    last_name?: string;
    company?: string;
    address?: string;
    city?: string;
    postal_code?: string;
    country?: string;
    email?: string;
    phone?: string;
  };
  shipping_data?: {
    first_name?: string;
    last_name?: string;
    company?: string;
    address?: string;
    city?: string;
    postal_code?: string;
    country?: string;
  };
  user_id?: string;
  created_at?: string;
  updated_at?: string;
  // Computed fields from related data
  ordersCount?: number;
  lastOrderDate?: string;
  totalRevenue?: number;
}