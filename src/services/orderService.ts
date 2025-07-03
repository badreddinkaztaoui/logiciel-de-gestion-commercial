import { supabase } from '../lib/supabase';
import { WooCommerceOrder } from '../types';
import { customerService } from './customerService';

class OrderService {
  private readonly TABLE_NAME = 'woocommerce_orders';

  private async getCurrentUserId(): Promise<string> {
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) {
      throw new Error('User not authenticated');
    }
    return user.id;
  }

  private async ensureAuthenticated(): Promise<string> {
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) {
      throw new Error('User must be authenticated to perform this operation');
    }
    return user.id;
  }

  private async filterOrderForDatabase(order: WooCommerceOrder, userId: string): Promise<Partial<WooCommerceOrder>> {
    const now = new Date().toISOString();

    const {
      _links,
      parent_id,
      version,
      prices_include_tax,
      discount_total,
      discount_tax,
      cart_tax,
      order_key,
      payment_method,
      payment_method_title,
      transaction_id,
      customer_ip_address,
      customer_user_agent,
      created_via,
      customer_note,
      date_completed,
      date_paid,
      cart_hash,
      meta_data,
      shipping_lines,
      fee_lines,
      coupon_lines,
      refunds,
      payment_url,
      is_editable,
      needs_payment,
      needs_processing,
      date_created_gmt,
      date_modified_gmt,
      date_completed_gmt,
      date_paid_gmt,
      ...filteredOrder
    } = order as any;

    return {
      id: filteredOrder.id,
      number: filteredOrder.number,
      status: filteredOrder.status,
      currency: filteredOrder.currency || 'MAD',
      date_created: filteredOrder.date_created,
      date_modified: filteredOrder.date_modified,
      total: filteredOrder.total,
      total_tax: filteredOrder.total_tax,
      shipping_total: filteredOrder.shipping_total,
      shipping_tax: filteredOrder.shipping_tax,
      customer_id: filteredOrder.customer_id,
      billing: filteredOrder.billing,
      shipping: filteredOrder.shipping,
      line_items: filteredOrder.line_items,
      tax_lines: filteredOrder.tax_lines,
      user_id: userId,
      created_at: filteredOrder.created_at || now,
      updated_at: now
    };
  }

  async getOrders(page: number = 1, limit: number = 20): Promise<{
    data: WooCommerceOrder[];
    count: number | null;
  }> {
    try {
      await this.ensureAuthenticated();

      const from = (page - 1) * limit;
      const to = from + limit - 1;

      const { data, error, count } = await supabase
        .from(this.TABLE_NAME)
        .select('*', { count: 'exact' })
        .order('date_created', { ascending: false })
        .range(from, to);

      if (error) {
        console.error('Error fetching orders:', error);
        throw error;
      }

      return {
        data: (data as WooCommerceOrder[]) || [],
        count
      };
    } catch (error) {
      console.error('Failed to fetch orders:', error);
      throw error;
    }
  }

  async getOrderById(orderId: number): Promise<WooCommerceOrder | null> {
    try {
      await this.ensureAuthenticated();

      const { data, error } = await supabase
        .from(this.TABLE_NAME)
        .select('*')
        .eq('id', orderId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return null;
        }
        console.error('Error fetching order:', error);
        throw error;
      }

      return data as WooCommerceOrder;
    } catch (error) {
      console.error('Failed to fetch order:', error);
      throw error;
    }
  }

  async saveOrder(order: WooCommerceOrder): Promise<WooCommerceOrder> {
    try {
      const userId = await this.ensureAuthenticated();

      const filteredOrder = await this.filterOrderForDatabase(order, userId);

      const { data, error } = await supabase
        .from(this.TABLE_NAME)
        .upsert(filteredOrder, {
          onConflict: 'id,user_id',
          ignoreDuplicates: false
        })
        .select()
        .single();

      if (error) {
        console.error('Error saving order:', error);
        throw error;
      }

      return data as WooCommerceOrder;
    } catch (error) {
      console.error('Failed to save order:', error);
      throw error;
    }
  }

  async deleteOrder(orderId: number): Promise<void> {
    try {
      const userId = await this.ensureAuthenticated();

      const { error } = await supabase
        .from(this.TABLE_NAME)
        .delete()
        .eq('id', orderId)
        .eq('user_id', userId);

      if (error) {
        console.error('Error deleting order:', error);
        throw error;
      }
    } catch (error) {
      console.error('Failed to delete order:', error);
      throw error;
    }
  }

  async getOrdersByStatus(status: string): Promise<WooCommerceOrder[]> {
    try {
      await this.ensureAuthenticated();

      const { data, error } = await supabase
        .from(this.TABLE_NAME)
        .select('*')
        .eq('status', status)
        .order('date_created', { ascending: false });

      if (error) {
        console.error('Error fetching orders by status:', error);
        throw error;
      }

      return (data as WooCommerceOrder[]) || [];
    } catch (error) {
      console.error('Failed to fetch orders by status:', error);
      throw error;
    }
  }

  async getOrdersByDateRange(startDate: string, endDate: string): Promise<WooCommerceOrder[]> {
    try {
      await this.ensureAuthenticated();

      const { data, error } = await supabase
        .from(this.TABLE_NAME)
        .select('*')
        .gte('date_created', startDate)
        .lte('date_created', endDate)
        .order('date_created', { ascending: false });

      if (error) {
        console.error('Error fetching orders by date range:', error);
        throw error;
      }

      return (data as WooCommerceOrder[]) || [];
    } catch (error) {
      console.error('Failed to fetch orders by date range:', error);
      throw error;
    }
  }

  async mergeOrders(newOrders: WooCommerceOrder[]): Promise<{
    mergedOrders: WooCommerceOrder[],
    newOrdersCount: number
  }> {
    try {
      if (!newOrders || newOrders.length === 0) {
        const { data: existingOrders } = await this.getOrders();
        return { mergedOrders: existingOrders, newOrdersCount: 0 };
      }

      const userId = await this.ensureAuthenticated();

      // Import customers from orders first
      const customerResults = await customerService.importCustomersFromOrders(newOrders);
      console.log('Customers imported:', customerResults.importedCount, 'updated:', customerResults.updatedCount, 'skipped:', customerResults.skippedCount);

      // Filter and prepare orders for database
      const ordersToUpsert = await Promise.all(
        newOrders.map(order => this.filterOrderForDatabase(order, userId))
      );

      // Upsert orders with composite key conflict resolution
      const { data: upsertedOrders, error: upsertError } = await supabase
        .from(this.TABLE_NAME)
        .upsert(ordersToUpsert, {
          onConflict: 'id,user_id',
          ignoreDuplicates: false
        })
        .select();

      if (upsertError) {
        console.error('Error upserting orders:', upsertError);
        throw upsertError;
      }

      // Get all orders after merge
      const { data: allOrders } = await this.getOrders();

      return {
        mergedOrders: allOrders,
        newOrdersCount: ordersToUpsert.length
      };
    } catch (error) {
      console.error('Failed to merge orders:', error);
      throw error;
    }
  }

  async searchOrders(query: string): Promise<WooCommerceOrder[]> {
    try {
      await this.ensureAuthenticated();

      let { data, error } = await supabase
        .from(this.TABLE_NAME)
        .select('*')
        .ilike('number', `%${query}%`)
        .order('date_created', { ascending: false });

      if (error) {
        console.error('Error searching orders:', error);
        throw error;
      }

      if (!data || data.length === 0) {
        const { data: customerData, error: customerError } = await supabase
          .from(this.TABLE_NAME)
          .select('*')
          .or(`billing->>'first_name'.ilike.%${query}%,billing->>'last_name'.ilike.%${query}%,billing->>'email'.ilike.%${query}%`)
          .order('date_created', { ascending: false });

        if (customerError) {
          console.error('Error searching orders by customer:', customerError);
          throw customerError;
        }

        data = customerData;
      }

      return (data as WooCommerceOrder[]) || [];
    } catch (error) {
      console.error('Failed to search orders:', error);
      throw error;
    }
  }

  subscribeToOrders(callback: (payload: any) => void) {
    return supabase
      .channel('public:orders')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: this.TABLE_NAME,
          filter: `user_id=eq.${supabase.auth.getUser()?.then(u => u.data.user?.id)}`
        },
        (payload) => {
          console.log('Real-time order change:', payload);
          callback(payload);
        }
      )
      .subscribe();
  }

  async getOrderStats(): Promise<{
    total: number;
    byStatus: Record<string, number>;
    totalValue: number;
    recentCount: number;
  }> {
    try {
      const { data: orders } = await this.getOrders();

      const stats = {
        total: orders.length,
        byStatus: {} as Record<string, number>,
        totalValue: 0,
        recentCount: 0
      };

      const now = new Date();
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

      orders.forEach(order => {
        stats.byStatus[order.status] = (stats.byStatus[order.status] || 0) + 1;
        stats.totalValue += parseFloat(order.total || '0');
        if (new Date(order.date_created) > sevenDaysAgo) {
          stats.recentCount++;
        }
      });

      return stats;
    } catch (error) {
      console.error('Failed to get order stats:', error);
      throw error;
    }
  }

  async clearAllOrders(): Promise<void> {
    try {
      await this.ensureAuthenticated();

      const { error } = await supabase
        .from(this.TABLE_NAME)
        .delete()
        .neq('id', 0);

      if (error) {
        console.error('Error clearing orders:', error);
        throw error;
      }

      console.log('All orders cleared from Supabase');
    } catch (error) {
      console.error('Failed to clear orders:', error);
      throw error;
    }
  }
}

export const orderService = new OrderService();