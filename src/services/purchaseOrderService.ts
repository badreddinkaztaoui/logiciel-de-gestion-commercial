import { supabase } from '../lib/supabase';
import { PurchaseOrder, ReceiveItems } from '../types';
import { wooCommerceService } from './woocommerce';
import { documentNumberingService } from './documentNumberingService';

class PurchaseOrderService {
  private readonly ORDERS_TABLE = 'purchase_orders';
  private readonly RECEIVES_TABLE = 'purchase_order_receives';

  /**
   * Ensure user is authenticated
   */
  private async ensureAuthenticated(): Promise<string> {
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) {
      throw new Error('User must be authenticated to perform this operation');
    }
    return user.id;
  }

  /**
   * Convert database row to PurchaseOrder type
   */
  private mapDatabaseToPurchaseOrder(row: any): PurchaseOrder {
    return {
      id: row.id,
      number: row.number,
      date: row.date,
      expectedDeliveryDate: row.expected_delivery_date,
      status: row.status,
      supplierId: row.supplier_id,
      items: row.items,
      subtotal: parseFloat(row.subtotal || '0'),
      tax: parseFloat(row.tax || '0'),
      total: parseFloat(row.total || '0'),
      notes: row.notes
    };
  }

  /**
   * Convert PurchaseOrder type to database row
   */
  private mapPurchaseOrderToDatabase(order: PurchaseOrder): any {
    return {
      id: order.id,
      number: order.number,
      date: order.date,
      expected_delivery_date: order.expectedDeliveryDate,
      status: order.status,
      supplier_id: order.supplierId,
      items: order.items,
      subtotal: order.subtotal,
      tax: order.tax,
      total: order.total,
      notes: order.notes
    };
  }

  /**
   * Convert database row to ReceiveItems type
   */
  private mapDatabaseToReceiveItems(row: any): ReceiveItems {
    return {
      purchaseOrderId: row.purchase_order_id,
      receiveDate: row.receive_date,
      items: row.items,
      notes: row.notes
    };
  }

  /**
   * Convert ReceiveItems type to database row
   */
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
      const userId = await this.ensureAuthenticated();

      const orderData = this.mapPurchaseOrderToDatabase(order);
      
      // Generate UUID if this is a new purchase order
      if (!order.id) {
        orderData.id = crypto.randomUUID();
      }
      
      // Confirm the document number if it's being saved
      if (order.number) {
        try {
          await documentNumberingService.confirmDocumentNumber(
            'purchaseOrder', 
            order.number, 
            orderData.id
          );
        } catch (numError) {
          console.error('Error confirming document number:', numError);
          // Continue with save operation even if confirmation fails
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

      // Get the order first to get the document number
      const order = await this.getPurchaseOrderById(orderId);

      // Delete the order
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

      // 1. Save the receive history
      const receiveDataForDb = this.mapReceiveItemsToDatabase(receiveData);
      receiveDataForDb.id = crypto.randomUUID();

      const { error: receiveError } = await supabase
        .from(this.RECEIVES_TABLE)
        .insert(receiveDataForDb);

      if (receiveError) {
        console.error('Error saving receive history:', receiveError);
        throw receiveError;
      }

      // 2. Update the purchase order
      const order = await this.getPurchaseOrderById(receiveData.purchaseOrderId);
      if (order) {
        // Update received quantities
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
        
        // Determine new status
        const allReceived = updatedItems.every(item => (item.received || 0) >= item.quantity);
        const anyReceived = updatedItems.some(item => (item.received || 0) > 0);
        
        const updatedOrder: PurchaseOrder = {
          ...order,
          items: updatedItems,
          status: allReceived ? 'complete' : (anyReceived ? 'partial' : order.status)
        };
        
        await this.savePurchaseOrder(updatedOrder);
        
        // 3. Update WooCommerce stock for each received item
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
      return await documentNumberingService.reserveDocumentNumber('purchaseOrder');
    } catch (error) {
      console.error('Error getting next purchase order number:', error);
      // Fallback to timestamp-based generation
      const timestamp = Date.now().toString().slice(-6);
      return `BC-${timestamp}`;
    }
  }
}

export const purchaseOrderService = new PurchaseOrderService();