import { supabase } from '../lib/supabase';
import { PurchaseOrder, ReceiveItems } from '../types';
import { wooCommerceService } from './woocommerce';
import { documentNumberingService } from './documentNumberingService';

class PurchaseOrderService {
  private readonly ORDERS_TABLE = 'purchase_orders';
  private readonly RECEIVES_TABLE = 'purchase_order_receives';

  private async ensureAuthenticated(): Promise<string> {
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) {
      throw new Error('User must be authenticated to perform this operation');
    }
    return user.id;
  }

  private mapDatabaseToPurchaseOrder(row: any): PurchaseOrder {
    // Filter status to only include valid values
    const validStatuses = ['draft', 'sent', 'confirmed', 'received', 'cancelled'];
    const status = validStatuses.includes(row.status) ? row.status : 'draft';

    return {
      id: row.id,
      number: row.number,
      date: row.date,
      expected_delivery_date: row.expected_delivery_date,
      status: status as PurchaseOrder['status'],
      supplier_id: row.supplier_id,
      supplier_data: row.supplier_data,
      items: row.items,
      subtotal: parseFloat(row.subtotal || '0'),
      tax_rate: parseFloat(row.tax_rate || '20'),
      tax_amount: parseFloat(row.tax_amount || '0'),
      total: parseFloat(row.total || '0'),
      currency: row.currency || 'MAD',
      notes: row.notes,
      created_at: row.created_at,
      updated_at: row.updated_at
    };
  }

  private mapPurchaseOrderToDatabase(order: PurchaseOrder): any {
    return {
      id: order.id,
      number: order.number,
      date: order.date,
      expected_delivery_date: order.expected_delivery_date,
      status: order.status,
      supplier_id: order.supplier_id,
      supplier_data: order.supplier_data,
      items: order.items,
      subtotal: order.subtotal,
      tax_rate: order.tax_rate,
      tax_amount: order.tax_amount,
      total: order.total,
      currency: order.currency,
      notes: order.notes
    };
  }

  private mapDatabaseToReceiveItems(row: any): ReceiveItems {
    return {
      purchaseOrderId: row.purchase_order_id,
      receiveDate: row.receive_date,
      items: row.items,
      notes: row.notes
    };
  }

  private mapReceiveItemsToDatabase(receive: ReceiveItems): any {
    return {
      purchase_order_id: receive.purchaseOrderId,
      receive_date: receive.receiveDate,
      items: receive.items,
      notes: receive.notes
    };
  }

  async getPurchaseOrders(): Promise<PurchaseOrder[]> {
    try {
      await this.ensureAuthenticated();

      const { data, error } = await supabase
        .from(this.ORDERS_TABLE)
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching purchase orders:', error);
        throw error;
      }

      return (data || []).map(this.mapDatabaseToPurchaseOrder);
    } catch (error) {
      console.error('Error loading purchase orders:', error);
      return [];
    }
  }

  async getPurchaseOrderById(id: string): Promise<PurchaseOrder | null> {
    try {
      await this.ensureAuthenticated();

      const { data, error } = await supabase
        .from(this.ORDERS_TABLE)
        .select('*')
        .eq('id', id)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return null;
        }
        throw error;
      }

      return data ? this.mapDatabaseToPurchaseOrder(data) : null;
    } catch (error) {
      console.error('Error getting purchase order by ID:', error);
      return null;
    }
  }

  async savePurchaseOrder(order: PurchaseOrder): Promise<PurchaseOrder> {
    try {
      const orderData = this.mapPurchaseOrderToDatabase(order);

      if (!order.id) {
        orderData.id = crypto.randomUUID();
      }

      if (order.number) {
        try {
          await documentNumberingService.validateNumber(order.number);
        } catch (numError) {
          console.error('Error validating document number:', numError);
        }
      }

      const { data, error } = await supabase
        .from(this.ORDERS_TABLE)
        .upsert(orderData)
        .select()
        .single();

      if (error) {
        console.error('Error saving purchase order:', error);
        throw error;
      }

      return this.mapDatabaseToPurchaseOrder(data);
    } catch (error) {
      console.error('Error saving purchase order:', error);
      throw error;
    }
  }

  async deletePurchaseOrder(orderId: string): Promise<void> {
    try {
      await this.ensureAuthenticated();

      const { error } = await supabase
        .from(this.ORDERS_TABLE)
        .delete()
        .eq('id', orderId);

      if (error) {
        console.error('Error deleting purchase order:', error);
        throw error;
      }
    } catch (error) {
      console.error('Error deleting purchase order:', error);
      throw error;
    }
  }

  async getReceiveHistory(): Promise<ReceiveItems[]> {
    try {
      await this.ensureAuthenticated();

      const { data, error } = await supabase
        .from(this.RECEIVES_TABLE)
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching receive history:', error);
        throw error;
      }

      return (data || []).map(this.mapDatabaseToReceiveItems);
    } catch (error) {
      console.error('Error loading receive history:', error);
      return [];
    }
  }

  async getReceiveHistoryByPurchaseOrderId(purchaseOrderId: string): Promise<ReceiveItems[]> {
    try {
      await this.ensureAuthenticated();

      const { data, error } = await supabase
        .from(this.RECEIVES_TABLE)
        .select('*')
        .eq('purchase_order_id', purchaseOrderId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching receive history by purchase order ID:', error);
        throw error;
      }

      return (data || []).map(this.mapDatabaseToReceiveItems);
    } catch (error) {
      console.error('Error loading receive history by purchase order ID:', error);
      return [];
    }
  }

  async receiveItems(receiveData: ReceiveItems): Promise<void> {
    try {
      await this.ensureAuthenticated();

      const receiveDataForDb = this.mapReceiveItemsToDatabase(receiveData);
      receiveDataForDb.id = crypto.randomUUID();

      const { error: receiveError } = await supabase
        .from(this.RECEIVES_TABLE)
        .insert(receiveDataForDb);

      if (receiveError) {
        console.error('Error saving receive history:', receiveError);
        throw receiveError;
      }

      const order = await this.getPurchaseOrderById(receiveData.purchaseOrderId);
      if (order) {
        const updatedItems = order.items.map(item => {
          const receivedItem = receiveData.items.find(ri => ri.id === item.id);
          if (receivedItem) {
            return {
              ...item,
              received: (item.received || 0) + receivedItem.receivedQuantity
            };
          }
          return item;
        });

        const allReceived = updatedItems.every(item => (item.received || 0) >= item.quantity);
        const anyReceived = updatedItems.some(item => (item.received || 0) > 0);

        const updatedOrder: PurchaseOrder = {
          ...order,
          items: updatedItems,
          status: allReceived ? 'received' : order.status
        };

        await this.savePurchaseOrder(updatedOrder);

        for (const item of receiveData.items) {
          if (item.receivedQuantity > 0 && item.productId) {
            try {
              await wooCommerceService.increaseProductStock(item.productId, item.receivedQuantity);
              console.log(`Stock updated for product ${item.productId}: +${item.receivedQuantity}`);
            } catch (error) {
              console.error(`Error updating stock for product ${item.productId}:`, error);
              throw error;
            }
          }
        }
      }
    } catch (error) {
      console.error('Error receiving items:', error);
      throw error;
    }
  }

  async getNextPurchaseOrderNumber(): Promise<string> {
    try {
      return await documentNumberingService.generatePreviewNumber('PURCHASE_ORDER');
    } catch (error) {
      console.error('Error getting next purchase order number:', error);
      const timestamp = Date.now().toString().slice(-6);
      return `BC-${timestamp}`;
    }
  }

  async createPurchaseOrder(order: Partial<PurchaseOrder>): Promise<PurchaseOrder> {
    try {
      await this.ensureAuthenticated();

      // Generate purchase order number
      let number;
      try {
        number = await documentNumberingService.generateNumber('PURCHASE_ORDER');
      } catch (error) {
        console.error('Error generating purchase order number:', error);
        // Fallback number generation
        const timestamp = Date.now().toString().slice(-6);
        number = `BC-${timestamp}`;
      }

      const orderData = {
        ...order,
        id: order.id || crypto.randomUUID(),
        number,
        status: order.status || 'draft',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      const { data, error } = await supabase
        .from(this.ORDERS_TABLE)
        .insert([orderData])
        .select()
        .single();

      if (error) {
        console.error('Error creating purchase order:', error);
        throw error;
      }

      return this.mapDatabaseToPurchaseOrder(data);
    } catch (error) {
      console.error('Error creating purchase order:', error);
      throw error;
    }
  }

  async createFromSupplier(supplierId: string, items: any[]): Promise<PurchaseOrder> {
    try {
      // Import supplier service to get supplier data
      const { supplierService } = await import('./supplierService');
      const supplier = await supplierService.getSupplier(supplierId);

      if (!supplier) {
        throw new Error('Supplier not found');
      }

      // Calculate totals
      const subtotal = items.reduce((sum, item) => sum + (item.total || 0), 0);
      const tax_rate = 20; // Default tax rate
      const tax_amount = subtotal * (tax_rate / 100);
      const total = subtotal + tax_amount;

      const purchaseOrderData = {
        supplier_id: supplierId,
        supplier_data: supplier,
        date: new Date().toISOString().split('T')[0],
        expected_delivery_date: undefined, // Use undefined instead of null
        items,
        subtotal,
        tax_rate,
        tax_amount,
        total,
        currency: 'MAD',
        notes: `Bon de commande pour ${supplier.name}`
      };

      return await this.createPurchaseOrder(purchaseOrderData);
    } catch (error) {
      console.error('Error creating purchase order from supplier:', error);
      throw error;
    }
  }

  async getPurchaseOrderStats() {
    try {
      const purchaseOrders = await this.getPurchaseOrders();

      return {
        total: purchaseOrders.length,
        draft: purchaseOrders.filter(p => p.status === 'draft').length,
        sent: purchaseOrders.filter(p => p.status === 'sent').length,
        confirmed: purchaseOrders.filter(p => p.status === 'confirmed').length,
        received: purchaseOrders.filter(p => p.status === 'received').length,
        cancelled: purchaseOrders.filter(p => p.status === 'cancelled').length,
        totalValue: purchaseOrders.reduce((sum, p) => sum + (p.total || 0), 0),
        pendingValue: purchaseOrders
          .filter(p => ['draft', 'sent', 'confirmed'].includes(p.status || ''))
          .reduce((sum, p) => sum + (p.total || 0), 0),
        receivedValue: purchaseOrders
          .filter(p => p.status === 'received')
          .reduce((sum, p) => sum + (p.total || 0), 0)
      };
    } catch (error) {
      console.error('Error getting purchase order stats:', error);
      return {
        total: 0,
        draft: 0,
        sent: 0,
        confirmed: 0,
        received: 0,
        cancelled: 0,
        totalValue: 0,
        pendingValue: 0,
        receivedValue: 0
      };
    }
  }

  async markAsSent(orderId: string): Promise<PurchaseOrder> {
    try {
      const order = await this.getPurchaseOrderById(orderId);
      if (!order) {
        throw new Error('Purchase order not found');
      }

      const updatedOrder = { ...order, status: 'sent' as const };
      return await this.savePurchaseOrder(updatedOrder);
    } catch (error) {
      console.error('Error marking purchase order as sent:', error);
      throw error;
    }
  }

  async markAsConfirmed(orderId: string): Promise<PurchaseOrder> {
    try {
      const order = await this.getPurchaseOrderById(orderId);
      if (!order) {
        throw new Error('Purchase order not found');
      }

      const updatedOrder = { ...order, status: 'confirmed' as const };
      return await this.savePurchaseOrder(updatedOrder);
    } catch (error) {
      console.error('Error marking purchase order as confirmed:', error);
      throw error;
    }
  }
}

export const purchaseOrderService = new PurchaseOrderService();