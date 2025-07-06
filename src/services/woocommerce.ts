import { orderService } from './orderService';
import { invoiceService } from './invoiceService';
import { salesJournalService } from './salesJournalService';

export interface WooCommerceProduct {
  id: number;
  name: string;
  sku: string;
  price: string;
  regular_price: string;
  sale_price: string;
  stock_quantity: number | null;
  manage_stock: boolean;
  stock_status: 'instock' | 'outofstock' | 'onbackorder';
  tax_class: string;
  images: {
    id: number;
    src: string;
    alt: string;
  }[];
  categories: {
    id: number;
    name: string;
  }[];
}

export interface WooCommerceCustomer {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  role: string;
  username: string;
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
  is_paying_customer: boolean;
  orders_count: number;
  total_spent: string;
  avatar_url: string;
  date_created: string;
  date_modified: string;
}

interface WooCommerceTaxClass {
  slug: string;
  name: string;
}

interface WooCommerceTaxRate {
  id: number;
  country: string;
  state: string;
  postcode: string;
  city: string;
  rate: string;
  name: string;
  priority: number;
  compound: boolean;
  shipping: boolean;
  order: number;
  class: string;
}

class WooCommerceService {
  private syncInterval: NodeJS.Timeout | null = null;
  private lastSyncTime: string | null = null;
  private syncCallbacks: Array<(orders: any[], isNewOrders: boolean) => void> = [];
  private taxRatesCache: Map<string, number> = new Map();
  private taxClassesCache: WooCommerceTaxClass[] = [];
  private productsCache: Map<number, WooCommerceProduct> = new Map();
  private syncInProgress: boolean = false;

  private getAuthHeader(): string {
    const consumerKey = import.meta.env.VITE_WC_CONSUMER_KEY;
    const consumerSecret = import.meta.env.VITE_WC_CONSUMER_SECRET;

    if (!consumerKey || !consumerSecret) {
      throw new Error('WooCommerce credentials not found in environment variables');
    }

    try {
      const credentials = btoa(`${consumerKey}:${consumerSecret}`);
      return `Basic ${credentials}`;
    } catch (error) {
      console.error('Error creating auth header:', error);
      const buffer = Buffer.from(`${consumerKey}:${consumerSecret}`);
      return `Basic ${buffer.toString('base64')}`;
    }
  }

  private getApiUrl(): string {
    const apiUrl = import.meta.env.VITE_WC_API_URL;
    if (!apiUrl) {
      throw new Error('WooCommerce API URL not found in environment variables');
    }
    return apiUrl;
  }

  async fetchTaxClasses(): Promise<WooCommerceTaxClass[]> {
    try {
      const response = await fetch(`${this.getApiUrl()}/taxes/classes`, {
        headers: {
          'Authorization': this.getAuthHeader(),
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const taxClasses = await response.json();
      const standardClass = { slug: '', name: 'Standard' };
      const allClasses = [standardClass, ...taxClasses];
      this.taxClassesCache = allClasses;
      return allClasses;
    } catch (error) {
      console.error('Error fetching tax classes:', error);
      return [
        { slug: '', name: 'Standard' },
        { slug: 'reduced-rate', name: 'Reduced Rate' },
        { slug: 'zero-rate', name: 'Zero Rate' }
      ];
    }
  }

  async fetchTaxRates(): Promise<WooCommerceTaxRate[]> {
    try {
      const response = await fetch(`${this.getApiUrl()}/taxes?per_page=100`, {
        headers: {
          'Authorization': this.getAuthHeader(),
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const taxRates = await response.json();
      this.buildTaxRateMap(taxRates);
      return taxRates;
    } catch (error) {
      console.error('Error fetching tax rates:', error);
      this.setDefaultTaxRates();
      return [];
    }
  }

  private buildTaxRateMap(taxRates: WooCommerceTaxRate[]): void {
    this.taxRatesCache.clear();
    const ratesByClass = new Map<string, WooCommerceTaxRate[]>();

    taxRates.forEach(rate => {
      const taxClass = rate.class || '';
      if (!ratesByClass.has(taxClass)) {
        ratesByClass.set(taxClass, []);
      }
      ratesByClass.get(taxClass)!.push(rate);
    });

    ratesByClass.forEach((rates, taxClass) => {
      let bestRate = rates.find(r => r.country === 'MA') || rates[0];

      if (bestRate) {
        const rateValue = parseFloat(bestRate.rate);
        if ([0, 7, 10, 20].includes(rateValue)) {
          this.taxRatesCache.set(taxClass, rateValue);
        } else {
          this.taxRatesCache.set(taxClass, 20);
        }
      }
    });

    this.setDefaultTaxRates();
  }

  private setDefaultTaxRates(): void {
    if (!this.taxRatesCache.has('')) {
      this.taxRatesCache.set('', 20);
    }
    if (!this.taxRatesCache.has('standard')) {
      this.taxRatesCache.set('standard', 20);
    }
    if (!this.taxRatesCache.has('reduced-rate')) {
      this.taxRatesCache.set('reduced-rate', 10);
    }
    if (!this.taxRatesCache.has('super-reduced-rate')) {
      this.taxRatesCache.set('super-reduced-rate', 7);
    }

    const zeroRateClasses = [
      'zero-rate', 'zero', '0', 'exempt', 'exempted', 'exemption',
      'exonerer', 'exonérer', 'exonere', 'exoneré', 'exoneration',
      'tva-0', 'taux-0', 'sans-tva', 'hors-tva', 'free', 'none', 'no-tax'
    ];

    zeroRateClasses.forEach(className => {
      this.taxRatesCache.set(className, 0);
    });

    const commonFrenchMappings = [
      { classes: ['tva-20', 'taux-20', 'standard-fr', 'normal'], rate: 20 },
      { classes: ['tva-10', 'taux-10', 'reduit', 'réduit', 'intermediaire', 'intermédiaire'], rate: 10 },
      { classes: ['tva-7', 'taux-7', 'super-reduit', 'super-réduit'], rate: 7 }
    ];

    commonFrenchMappings.forEach(mapping => {
      mapping.classes.forEach(className => {
        if (!this.taxRatesCache.has(className)) {
          this.taxRatesCache.set(className, mapping.rate);
        }
      });
    });
  }

  getTaxRateForClass(taxClass: string = ''): number {
    const normalizedClass = this.normalizeTaxClass(taxClass);

    if (this.taxRatesCache.has(normalizedClass)) {
      return this.taxRatesCache.get(normalizedClass)!;
    }

    if (this.taxRatesCache.has(taxClass)) {
      return this.taxRatesCache.get(taxClass)!;
    }

    const classVariations = this.generateTaxClassVariations(normalizedClass);
    for (const variation of classVariations) {
      if (this.taxRatesCache.has(variation)) {
        return this.taxRatesCache.get(variation)!;
      }
    }

    const patternRate = this.detectTaxRateByPattern(normalizedClass);
    if (patternRate !== null && [0, 7, 10, 20].includes(patternRate)) {
      return patternRate;
    }

    return this.taxRatesCache.get('') || 20;
  }

  private normalizeTaxClass(taxClass: string): string {
    return taxClass
      .toLowerCase()
      .trim()
      .replace(/[àáâãäå]/g, 'a')
      .replace(/[èéêë]/g, 'e')
      .replace(/[ìíîï]/g, 'i')
      .replace(/[òóôõö]/g, 'o')
      .replace(/[ùúûü]/g, 'u')
      .replace(/[ýÿ]/g, 'y')
      .replace(/[ç]/g, 'c')
      .replace(/[ñ]/g, 'n')
      .replace(/[\s_]+/g, '-')
      .replace(/[-]+/g, '-')
      .replace(/^-|-$/g, '');
  }

  private generateTaxClassVariations(normalizedClass: string): string[] {
    const variations = [
      normalizedClass,
      normalizedClass.replace(/-/g, '_'),
      normalizedClass.replace(/_/g, '-'),
      normalizedClass.replace(/[-_]/g, ''),
      normalizedClass.replace(/[-_]/g, ' ')
    ];

    variations.push(`tva-${normalizedClass}`);
    variations.push(`taux-${normalizedClass}`);

    return [...new Set(variations)];
  }

  private detectTaxRateByPattern(normalizedClass: string): number | null {
    if (/^(exoner|exempt|zero|0|sans-tva|hors-tva|free|none|no-tax)/.test(normalizedClass)) {
      return 0;
    }

    const numericMatch = normalizedClass.match(/(\d+(?:[.,]\d+)?)/);
    if (numericMatch) {
      const rate = parseFloat(numericMatch[1].replace(',', '.'));
      if ([0, 7, 10, 20].includes(rate)) {
        return rate;
      }
    }

    if (/^(reduit|intermediaire|reduced)/.test(normalizedClass)) {
      return 10;
    }
    if (/^(super-reduit|super-reduced)/.test(normalizedClass)) {
      return 7;
    }
    if (/^(standard|normal|tva-standard)/.test(normalizedClass)) {
      return 20;
    }

    return null;
  }

  async fetchProductTaxClass(productId: number): Promise<string> {
    try {
      if (this.productsCache.has(productId)) {
        return this.productsCache.get(productId)!.tax_class || '';
      }

      const response = await fetch(`${this.getApiUrl()}/products/${productId}`, {
        headers: {
          'Authorization': this.getAuthHeader(),
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        return '';
      }

      const product: WooCommerceProduct = await response.json();
      this.productsCache.set(productId, product);
      return product.tax_class || '';
    } catch (error) {
      console.error(`Error fetching product ${productId}:`, error);
      return '';
    }
  }

  async initializeTaxData(): Promise<void> {
    try {
      await Promise.all([
        this.fetchTaxClasses(),
        this.fetchTaxRates()
      ]);
    } catch (error) {
      console.error('Failed to initialize tax data:', error);
      this.setDefaultTaxRates();
    }
  }

  private async formatOrderTaxData(order: any): Promise<any> {
    const processedLineItems = await Promise.all(
      (order.line_items || []).map(async (item: any) => {
        const itemTotal = parseFloat(item.total || '0');
        const itemTax = parseFloat(item.total_tax || '0');
        const itemSubtotal = itemTotal - itemTax;

        let taxRate = 0;
        let taxClass = item.tax_class || '';

        if (taxClass !== undefined) {
          taxRate = this.getTaxRateForClass(taxClass);
        } else if (item.product_id) {
          try {
            taxClass = await this.fetchProductTaxClass(item.product_id);
            taxRate = this.getTaxRateForClass(taxClass);
          } catch (error) {
            console.warn(`Could not fetch tax class for product ${item.product_id}`);
          }
        }

        if (taxRate === 0 && itemSubtotal > 0 && itemTax > 0) {
          const calculatedRate = Math.round((itemTax / itemSubtotal) * 100 * 100) / 100;
          if ([0, 7, 10, 20].includes(Math.round(calculatedRate))) {
            taxRate = Math.round(calculatedRate);
          } else {
            taxRate = 20;
          }
        }

        if (taxRate === 0 && item.taxes && item.taxes.length > 0) {
          const firstTax = item.taxes[0];
          if (firstTax.rate_code) {
            const rateMatch = firstTax.rate_code.match(/(\d+(?:\.\d+)?)/);
            if (rateMatch) {
              const extractedRate = parseFloat(rateMatch[1]);
              if ([0, 7, 10, 20].includes(extractedRate)) {
                taxRate = extractedRate;
              }
            }
          }
        }

        return {
          ...item,
          total_tax: item.total_tax || '0',
          tax_class: taxClass,
          taxes: item.taxes || [],
          calculated_tax_rate: taxRate,
          calculated_subtotal: itemSubtotal,
          calculated_tax_amount: itemTax
        };
      })
    );

    const processedTaxLines = (order.tax_lines || []).map((taxLine: any) => {
      let ratePercent = parseFloat(taxLine.rate_percent || '0');

      if (ratePercent === 0) {
        ratePercent = this.extractRateFromTaxLine(taxLine);
      }

      if (taxLine.label && (
        taxLine.label.toLowerCase().includes('exonerer') ||
        taxLine.label.toLowerCase().includes('exonérer') ||
        taxLine.label.toLowerCase().includes('exempt')
      )) {
        ratePercent = 0;
      }

      if (![0, 7, 10, 20].includes(Math.round(ratePercent))) {
        ratePercent = 20;
      }

      return {
        ...taxLine,
        rate_percent: ratePercent
      };
    });

    return {
      ...order,
      total_tax: order.total_tax || '0',
      shipping_total: order.shipping_total || '0',
      shipping_tax: order.shipping_tax || '0',
      line_items: processedLineItems,
      tax_lines: processedTaxLines
    };
  }

  private extractRateFromTaxLine(taxLine: any): number {
    try {
      if (taxLine.label) {
        const label = taxLine.label.toLowerCase();
        if (label.includes('exonerer') ||
            label.includes('exonérer') ||
            label.includes('exempt') ||
            label.includes('zero') ||
            label.includes('0%') ||
            label.includes('sans tva') ||
            label.includes('hors tva')) {
          return 0;
        }
      }

      if (taxLine.rate_code) {
        const rateMatch = taxLine.rate_code.match(/(\d+(?:\.\d+)?)/);
        if (rateMatch) {
          const rate = parseFloat(rateMatch[1]);
          if ([0, 7, 10, 20].includes(rate)) {
            return rate;
          }
        }
      }

      if (taxLine.label) {
        const rateMatch = taxLine.label.match(/(\d+(?:\.\d+)?)%/);
        if (rateMatch) {
          const rate = parseFloat(rateMatch[1]);
          if ([0, 7, 10, 20].includes(rate)) {
            return rate;
          }
        }
      }

      if (taxLine.name) {
        const rateMatch = taxLine.name.match(/(\d+(?:\.\d+)?)%/);
        if (rateMatch) {
          const rate = parseFloat(rateMatch[1]);
          if ([0, 7, 10, 20].includes(rate)) {
            return rate;
          }
        }
      }

      return 20;
    } catch (error) {
      console.error('Error extracting tax rate from tax line:', error);
      return 20;
    }
  }

  async fetchOrders(params?: {
    status?: string;
    per_page?: number;
    page?: number;
    after?: string;
    before?: string;
    modified_after?: string;
  }) {
    try {
      if (this.taxRatesCache.size === 0) {
        await this.initializeTaxData();
      }

      const searchParams = new URLSearchParams();
      if (params?.status) searchParams.append('status', params.status);
      if (params?.per_page) searchParams.append('per_page', params.per_page.toString());
      if (params?.page) searchParams.append('page', params.page.toString());
      if (params?.after) searchParams.append('after', params.after);
      if (params?.before) searchParams.append('before', params.before);
      if (params?.modified_after) searchParams.append('modified_after', params.modified_after);

      searchParams.append('context', 'edit');

      const response = await fetch(`${this.getApiUrl()}/orders?${searchParams}`, {
        headers: {
          'Authorization': this.getAuthHeader(),
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const orders = await response.json();
      const processedOrders = await Promise.all(
        orders.map((order: any) => this.formatOrderTaxData(order))
      );

      return processedOrders;
    } catch (error) {
      console.error('Error fetching WooCommerce orders:', error);
      throw error;
    }
  }

  async fetchOrder(orderId: number) {
    try {
      if (this.taxRatesCache.size === 0) {
        await this.initializeTaxData();
      }

      const response = await fetch(`${this.getApiUrl()}/orders/${orderId}?context=edit`, {
        headers: {
          'Authorization': this.getAuthHeader(),
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const order = await response.json();
      return await this.formatOrderTaxData(order);
    } catch (error) {
      console.error('Error fetching WooCommerce order:', error);
      throw error;
    }
  }

  async updateOrderStatus(orderId: number, status: string) {
    try {
      const response = await fetch(`${this.getApiUrl()}/orders/${orderId}`, {
        method: 'PUT',
        headers: {
          'Authorization': this.getAuthHeader(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const order = await response.json();
      return await this.formatOrderTaxData(order);
    } catch (error) {
      console.error('Error updating WooCommerce order status:', error);
      throw error;
    }
  }

  async addOrderNote(orderId: number, note: string, customerNote: boolean = false) {
    try {
      const response = await fetch(`${this.getApiUrl()}/orders/${orderId}/notes`, {
        method: 'POST',
        headers: {
          'Authorization': this.getAuthHeader(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          note: note,
          customer_note: customerNote
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error adding order note:', error);
      throw error;
    }
  }

  async createRefund(orderId: number, amount: number, reason: string, lineItems?: any[]) {
    try {
      const refundData: any = {
        amount: amount.toString(),
        reason: reason
      };

      if (lineItems && lineItems.length > 0) {
        refundData.line_items = lineItems;
      }

      const response = await fetch(`${this.getApiUrl()}/orders/${orderId}/refunds`, {
        method: 'POST',
        headers: {
          'Authorization': this.getAuthHeader(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(refundData),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error creating refund:', error);
      throw error;
    }
  }

  async fetchCustomers(params?: {
    per_page?: number;
    page?: number;
    search?: string;
    email?: string;
    orderby?: string;
    order?: string;
  }): Promise<WooCommerceCustomer[]> {
    try {
      const searchParams = new URLSearchParams();
      if (params?.per_page) searchParams.append('per_page', params.per_page.toString());
      if (params?.page) searchParams.append('page', params.page.toString());
      if (params?.search) searchParams.append('search', params.search);
      if (params?.email) searchParams.append('email', params.email);
      if (params?.orderby) searchParams.append('orderby', params.orderby);
      if (params?.order) searchParams.append('order', params.order);

      const response = await fetch(`${this.getApiUrl()}/customers?${searchParams}`, {
        headers: {
          'Authorization': this.getAuthHeader(),
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`WooCommerce API error (${response.status}):`, errorText);
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error fetching WooCommerce customers:', error);
      throw error;
    }
  }

  async fetchCustomer(customerId: number): Promise<WooCommerceCustomer> {
    try {
      const response = await fetch(`${this.getApiUrl()}/customers/${customerId}`, {
        headers: {
          'Authorization': this.getAuthHeader(),
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error fetching WooCommerce customer:', error);
      throw error;
    }
  }

  async createCustomer(customerData: {
    email: string;
    first_name: string;
    last_name: string;
    username?: string;
    billing?: {
      first_name: string;
      last_name: string;
      company?: string;
      address_1?: string;
      address_2?: string;
      city?: string;
      state?: string;
      postcode?: string;
      country?: string;
      email: string;
      phone?: string;
    };
    shipping?: {
      first_name: string;
      last_name: string;
      company?: string;
      address_1?: string;
      address_2?: string;
      city?: string;
      state?: string;
      postcode?: string;
      country?: string;
    };
  }): Promise<WooCommerceCustomer> {
    try {
      const response = await fetch(`${this.getApiUrl()}/customers`, {
        method: 'POST',
        headers: {
          'Authorization': this.getAuthHeader(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(customerData),
      });

      if (!response.ok) {
        const errorText = await response.text();
        let errorMessage = `HTTP error! status: ${response.status}`;

        try {
          const errorData = JSON.parse(errorText);
          errorMessage += `, message: ${errorData.message || 'Unknown error'}`;
        } catch (jsonError) {
          errorMessage += `, response: ${errorText}`;
        }

        throw new Error(errorMessage);
      }

      return await response.json();
    } catch (error) {
      console.error('Error creating WooCommerce customer:', error);
      throw error;
    }
  }

  async updateCustomer(customerId: number, customerData: Partial<WooCommerceCustomer>): Promise<WooCommerceCustomer> {
    try {
      const response = await fetch(`${this.getApiUrl()}/customers/${customerId}`, {
        method: 'PUT',
        headers: {
          'Authorization': this.getAuthHeader(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(customerData),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error updating WooCommerce customer:', error);
      throw error;
    }
  }

  async searchProducts(params?: {
    search?: string;
    per_page?: number;
    page?: number;
    category?: number;
    sku?: string;
    status?: string;
    stock_status?: string;
  }): Promise<WooCommerceProduct[]> {
    try {
      const searchParams = new URLSearchParams();
      if (params?.search) searchParams.append('search', params.search);
      if (params?.per_page) searchParams.append('per_page', params.per_page.toString());
      if (params?.page) searchParams.append('page', params.page.toString());
      if (params?.category) searchParams.append('category', params.category.toString());
      if (params?.sku) searchParams.append('sku', params.sku);
      if (params?.status) searchParams.append('status', params.status);
      if (params?.stock_status) searchParams.append('stock_status', params.stock_status);

      const response = await fetch(`${this.getApiUrl()}/products?${searchParams}`, {
        headers: {
          'Authorization': this.getAuthHeader(),
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error searching WooCommerce products:', error);
      throw error;
    }
  }

  async getProduct(productId: number): Promise<WooCommerceProduct> {
    try {
      const response = await fetch(`${this.getApiUrl()}/products/${productId}`, {
        headers: {
          'Authorization': this.getAuthHeader(),
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error fetching WooCommerce product:', error);
      throw error;
    }
  }

  async updateProductStock(productId: number, quantity: number): Promise<WooCommerceProduct> {
    try {
      const response = await fetch(`${this.getApiUrl()}/products/${productId}`, {
        method: 'PUT',
        headers: {
          'Authorization': this.getAuthHeader(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          stock_quantity: quantity,
          manage_stock: true,
          stock_status: quantity > 0 ? 'instock' : 'outofstock'
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error updating WooCommerce product stock:', error);
      throw error;
    }
  }

  async reduceProductStock(productId: number, quantityToReduce: number): Promise<WooCommerceProduct> {
    try {
      const product = await this.getProduct(productId);
      const currentStock = product.stock_quantity || 0;
      const newStock = Math.max(0, currentStock - quantityToReduce);
      return await this.updateProductStock(productId, newStock);
    } catch (error) {
      console.error('Error reducing WooCommerce product stock:', error);
      throw error;
    }
  }

  async increaseProductStock(productId: number, quantityToAdd: number): Promise<WooCommerceProduct> {
    try {
      const product = await this.getProduct(productId);
      const currentStock = product.stock_quantity || 0;
      const newStock = currentStock + quantityToAdd;
      return await this.updateProductStock(productId, newStock);
    } catch (error) {
      console.error('Error increasing WooCommerce product stock:', error);
      throw error;
    }
  }

  async processReturn(orderId: number, returnItems: any[], refundAmount: number, reason: string, updateStatus: boolean = false) {
    try {
      const results = {
        stockUpdates: [] as any[],
        refund: null as any,
        orderNote: null as any,
        statusUpdate: null as any
      };

      for (const item of returnItems) {
        if (item.productId && item.condition === 'new') {
          try {
            const stockUpdate = await this.increaseProductStock(item.productId, item.quantity);
            results.stockUpdates.push({
              productId: item.productId,
              quantity: item.quantity,
              newStock: stockUpdate.stock_quantity
            });
          } catch (error) {
            console.error(`Error updating stock for product ${item.productId}:`, error);
          }
        }
      }

      if (refundAmount > 0) {
        const lineItems = returnItems
          .filter(item => item.refundAmount > 0)
          .map(item => ({
            id: item.lineItemId || item.id,
            quantity: item.quantity,
            refund_total: item.refundAmount.toString()
          }));

        try {
          results.refund = await this.createRefund(orderId, refundAmount, reason, lineItems);
        } catch (error) {
          console.error('Error creating refund:', error);
        }
      }

      if (updateStatus) {
        try {
          results.statusUpdate = await this.updateOrderStatus(orderId, 'refunded');
        } catch (error) {
          console.error('Error updating order status:', error);
        }
      }

      const noteText = `Bon de retour traité: ${returnItems.length} article(s) retourné(s). ` +
                      `Montant remboursé: ${refundAmount}€. Raison: ${reason}`;

      try {
        results.orderNote = await this.addOrderNote(orderId, noteText, true);
      } catch (error) {
        console.error('Error adding order note:', error);
      }

      return results;
    } catch (error) {
      console.error('Error processing return:', error);
      throw error;
    }
  }

  startRealTimeSync(intervalMinutes: number = 2): void {
    this.stopRealTimeSync();

    this.initializeTaxData().then(() => {
      this.performSync();
      this.syncInterval = setInterval(() => {
        this.performSync();
      }, intervalMinutes * 60 * 1000);
    }).catch(error => {
      console.error('Failed to initialize tax data for sync:', error);
      this.performSync();
      this.syncInterval = setInterval(() => {
        this.performSync();
      }, intervalMinutes * 60 * 1000);
    });
  }

  stopRealTimeSync(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
  }

  onSyncUpdate(callback: (orders: any[], isNewOrders: boolean) => void): void {
    this.syncCallbacks.push(callback);
  }

  getLastSyncTime(): string | null {
    return this.lastSyncTime;
  }

  async performSync(): Promise<void> {
    try {
      // Prevent concurrent syncs
      if (this.syncInProgress) {
        console.log('Sync already in progress, skipping...');
        return;
      }

      this.syncInProgress = true;

      const params: any = {
        per_page: 100,
        orderby: 'date',
        order: 'desc'
      };

      if (this.lastSyncTime) {
        params.modified_after = this.lastSyncTime;
      } else {
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        params.after = thirtyDaysAgo.toISOString();
      }

      const orders = await this.fetchOrders(params);

      if (orders && orders.length > 0) {
        const { mergedOrders, newOrdersCount } = await orderService.mergeOrders(orders);

        // Process orders in smaller batches to avoid overwhelming the database
        const batchSize = 5; // Reduced batch size to minimize conflicts
        for (let i = 0; i < orders.length; i += batchSize) {
          const batch = orders.slice(i, i + batchSize);

          // Process batch with proper error handling
          for (const order of batch) {
            try {
              await this.processOrderSafely(order);
            } catch (error) {
              console.error(`Error processing order ${order.id}:`, error);
              // Continue with next order even if one fails
            }
          }

          // Add delay between batches to reduce database load
          if (i + batchSize < orders.length) {
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
        }

        this.syncCallbacks.forEach(callback => {
          callback(mergedOrders, newOrdersCount > 0);
        });

        this.lastSyncTime = new Date().toISOString();
      }
    } catch (error) {
      console.error('WooCommerce sync failed:', error);
      throw error;
    } finally {
      this.syncInProgress = false;
    }
  }

  private async processOrderSafely(order: any): Promise<void> {
    const maxRetries = 3;
    let retryCount = 0;

    while (retryCount < maxRetries) {
      try {
        // Sync invoice first
        await invoiceService.syncWithWooCommerce(order.id, order.status);

        // Add small delay to prevent race conditions
        await new Promise(resolve => setTimeout(resolve, 200));

        // Then update sales journal
        await salesJournalService.updateJournalForOrder(order.id);

        return; // Success, exit retry loop
      } catch (error: any) {
        retryCount++;

        // Check if this is a duplicate key error that we can retry
        if (error?.code === '23505' && retryCount < maxRetries) {
          const delay = Math.min(500 * Math.pow(2, retryCount), 5000);
          console.log(`Retrying order ${order.id} processing (attempt ${retryCount + 1}) after ${delay}ms`);
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }

        // If we've exhausted retries or it's not a retryable error, throw it
        throw error;
      }
    }
  }

  getAvailableTaxRates(): number[] {
    return [0, 7, 10, 20];
  }

  getAvailableTaxClasses(): WooCommerceTaxClass[] {
    return this.taxClassesCache;
  }

  debugTaxConfiguration(): void {
    console.log('Tax Classes:', this.taxClassesCache);
    console.log('Tax Rate Map:', Object.fromEntries(this.taxRatesCache));
    console.log('Products Cache Size:', this.productsCache.size);
    console.log('Available Rates:', this.getAvailableTaxRates());
  }
}

export const wooCommerceService = new WooCommerceService();