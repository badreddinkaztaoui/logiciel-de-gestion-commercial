export interface WooCommerceLineItem {
  id: number;
  name: string;
  product_id: number;
  variation_id?: number;
  quantity: number;
  tax_class: string;
  subtotal: string;
  subtotal_tax: string;
  total: string;
  total_tax: string;
  sku: string;
  price: number;
  taxes: {
    id: number;
    rate_code: string;
    rate_id: number;
    label: string;
    compound: boolean;
    tax_total: string;
    shipping_tax_total: string;
  }[];
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
  billing: {
    first_name: string;
    last_name: string;
    company: string;
    address_1: string;
    address_2: string;
    city: string;
    state: string;
    postcode: string;
    country: string;
    email: string;
    phone: string;
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
  line_items: WooCommerceLineItem[];
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
  id: string;
  wooCommerceId?: number; // ID du client dans WooCommerce
  firstName: string;
  lastName: string;
  company?: string;
  email: string;
  phone?: string;
  address?: string;
  city?: string;
  postalCode?: string;
  country?: string;
  ice?: string; // Champ spécifique non présent dans WooCommerce
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Quote {
  id: string;
  number: string;
  orderId?: number;
  date: string;
  validUntil: string;
  status: 'draft' | 'sent' | 'accepted' | 'rejected' | 'expired';
  customer: {
    name: string;
    email: string;
    company?: string;
    address: string;
    city: string;
    postalCode: string;
    country: string;
  };
  items: {
    id: string;
    description: string;
    quantity: number;
    unitPrice: number; // Prix unitaire TTC (comme WooCommerce)
    total: number; // Total TTC pour cette ligne
    productId?: number; // WooCommerce product ID
    sku?: string; // Product SKU
    taxRate?: number; // Tax rate for this item (0, 7, 10, 20%)
    taxAmount?: number; // Tax amount for this item
  }[];
  subtotal: number; // Sous-total HT
  tax: number; // Total des taxes
  total: number; // Total TTC
  notes?: string;
  conditions?: string; // Conditions particulières du devis
}

export interface Invoice {
  id: string;
  number: string;
  orderId?: number;
  quoteId?: string; // ID du devis d'origine
  date: string;
  dueDate: string;
  status: 'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled';
  customer: {
    name: string;
    email: string;
    company?: string;
    address: string;
    city: string;
    postalCode: string;
    country: string;
  };
  items: {
    id: string;
    description: string;
    quantity: number;
    unitPrice: number; // Prix unitaire TTC (comme WooCommerce)
    total: number; // Total TTC pour cette ligne
    productId?: number; // WooCommerce product ID for stock management
    sku?: string; // Product SKU
    taxRate?: number; // Tax rate for this item (0, 7, 10, 20%)
    taxAmount?: number; // Tax amount for this item
  }[];
  subtotal: number; // Sous-total HT
  tax: number; // Total des taxes
  total: number; // Total TTC
  notes?: string;
  woocommerceStatus?: string; // WooCommerce order status
  lastSyncedAt?: string; // Last sync timestamp with WooCommerce
}

export interface DeliveryNote {
  id: string;
  number: string;
  orderId?: number;
  invoiceId?: string;
  date: string;
  estimatedDeliveryDate?: string;
  status: 'pending' | 'in_transit' | 'delivered' | 'cancelled';
  customer: {
    name: string;
    company?: string;
    address: string;
    city: string;
    postalCode: string;
    country: string;
  };
  items: {
    id: string;
    description: string;
    quantity: number;
    delivered?: number;
    productId?: number; // WooCommerce product ID
  }[];
  notes?: string;
}

export interface ReturnNote {
  id: string;
  number: string;
  orderId?: number;
  date: string;
  reason: string;
  status: 'pending' | 'approved' | 'rejected' | 'processed';
  customer: {
    name: string;
    email: string;
    company?: string;
  };
  items: {
    id: string;
    description: string;
    quantity: number;
    reason: string;
    condition: 'new' | 'used' | 'damaged';
    productId?: number; // WooCommerce product ID for stock management
    refundAmount?: number;
  }[];
  refundAmount?: number;
  notes?: string;
}

export interface Supplier {
  id: string;
  name: string;
  contactName: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  postalCode: string;
  country: string;
  taxNumber?: string;
  notes?: string;
}

export interface PurchaseOrder {
  id: string;
  number: string;
  date: string;
  expectedDeliveryDate: string;
  status: 'draft' | 'ordered' | 'partial' | 'complete' | 'cancelled';
  supplierId: string;
  items: PurchaseOrderItem[];
  subtotal: number; // Sous-total HT
  tax: number; // Total des taxes
  total: number; // Total TTC
  notes?: string;
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