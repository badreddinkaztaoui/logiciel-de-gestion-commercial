import { supabase } from '../lib/supabase';
import { documentNumberingService } from './documentNumberingService';
import { wooCommerceService } from './woocommerce';

interface DeliveryNote {
  id: string;
  number: string;
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

interface DeliveryNoteItem {
  product_id: number;
  sku: string;
  description: string;
  quantity: number;
  delivered: number;
  unit_price: number;
  total: number;
}

class DeliveryNoteService {
  private readonly TABLE_NAME = 'delivery_notes';

  private async ensureAuthenticated(): Promise<string> {
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) {
      throw new Error('User must be authenticated to perform this operation');
    }
    return user.id;
  }

  private mapDatabaseToDeliveryNote(data: any): DeliveryNote {
    return {
      id: data.id,
      number: data.number,
      invoice_id: data.invoice_id,
      customer_id: data.customer_id,
      customer_data: data.customer_data,
      date: data.date,
      estimated_delivery_date: data.estimated_delivery_date,
      actual_delivery_date: data.actual_delivery_date,
      status: data.status,
      items: data.items || [],
      notes: data.notes,
      created_at: data.created_at,
      updated_at: data.updated_at
    };
  }

  async getDeliveryNotes(): Promise<DeliveryNote[]> {
    try {
      await this.ensureAuthenticated();

      const { data, error } = await supabase
        .from(this.TABLE_NAME)
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching delivery notes:', error);
        throw error;
      }

      return (data || []).map(this.mapDatabaseToDeliveryNote);
    } catch (error) {
      console.error('Error loading delivery notes:', error);
      return [];
    }
  }

  async getDeliveryNote(id: string): Promise<DeliveryNote | null> {
    try {
      await this.ensureAuthenticated();

      const { data, error } = await supabase
        .from(this.TABLE_NAME)
        .select('*')
        .eq('id', id)
        .single();

      if (error) {
        console.error('Error fetching delivery note:', error);
        throw error;
      }

      return data ? this.mapDatabaseToDeliveryNote(data) : null;
    } catch (error) {
      console.error('Error loading delivery note:', error);
      return null;
    }
  }

  async createDeliveryNote(deliveryNote: Partial<DeliveryNote>): Promise<DeliveryNote> {
    try {
      await this.ensureAuthenticated();

      const number = await documentNumberingService.generateNumber('DELIVERY');

      const { data, error } = await supabase
        .from(this.TABLE_NAME)
        .insert([{
          ...deliveryNote,
          number,
          status: deliveryNote.status || 'draft',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }])
        .select()
        .single();

      if (error) {
        console.error('Error creating delivery note:', error);
        throw error;
      }

      return this.mapDatabaseToDeliveryNote(data);
    } catch (error) {
      console.error('Error creating delivery note:', error);
      throw error;
    }
  }

  async updateDeliveryNote(id: string, deliveryNote: Partial<DeliveryNote>): Promise<DeliveryNote> {
    try {
      await this.ensureAuthenticated();

      const { data, error } = await supabase
        .from(this.TABLE_NAME)
        .update({
          ...deliveryNote,
          updated_at: new Date().toISOString()
        })
        .eq('id', id)
        .select()
        .single();

      if (error) {
        console.error('Error updating delivery note:', error);
        throw error;
      }

      return this.mapDatabaseToDeliveryNote(data);
    } catch (error) {
      console.error('Error updating delivery note:', error);
      throw error;
    }
  }

  async deleteDeliveryNote(id: string): Promise<void> {
    try {
      await this.ensureAuthenticated();

      const { error } = await supabase
        .from(this.TABLE_NAME)
        .delete()
        .eq('id', id);

      if (error) {
        console.error('Error deleting delivery note:', error);
        throw error;
      }
    } catch (error) {
      console.error('Error deleting delivery note:', error);
      throw error;
    }
  }

  async searchDeliveryNotes(query: string): Promise<DeliveryNote[]> {
    try {
      await this.ensureAuthenticated();

      const { data, error } = await supabase
        .from(this.TABLE_NAME)
        .select('*')
        .or(`number.ilike.%${query}%,customer_data->>'name'.ilike.%${query}%`)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error searching delivery notes:', error);
        throw error;
      }

      return (data || []).map(this.mapDatabaseToDeliveryNote);
    } catch (error) {
      console.error('Error searching delivery notes:', error);
      return [];
    }
  }

  async getDeliveryNoteStats() {
    try {
      await this.ensureAuthenticated();

      const { data: allNotes, error } = await supabase
        .from(this.TABLE_NAME)
        .select('status');

      if (error) {
        console.error('Error fetching delivery note stats:', error);
        throw error;
      }

      const stats = {
        total: allNotes.length,
        pending: allNotes.filter(note => note.status === 'draft').length,
        inTransit: allNotes.filter(note => note.status === 'in_transit').length,
        delivered: allNotes.filter(note => note.status === 'delivered').length,
        cancelled: allNotes.filter(note => note.status === 'cancelled').length
      };

      return stats;
    } catch (error) {
      console.error('Error loading delivery note stats:', error);
      return {
        total: 0,
        pending: 0,
        inTransit: 0,
        delivered: 0,
        cancelled: 0
      };
    }
  }

  async createDeliveryNoteFromOrder(orderId: number): Promise<DeliveryNote> {
    try {
      await this.ensureAuthenticated();

      // Fetch order from WooCommerce
      const order = await wooCommerceService.fetchOrder(orderId);
      if (!order) {
        throw new Error(`Order ${orderId} not found`);
      }

      // Create customer data object
      const customerData = {
        name: `${order.billing.first_name} ${order.billing.last_name}`.trim(),
        company: order.billing.company,
        email: order.billing.email,
        phone: order.billing.phone,
        address: order.shipping.address_1,
        city: order.shipping.city,
        postal_code: order.shipping.postcode,
        country: order.shipping.country,
        order_id: orderId
      };

      // Map order items to delivery note items
      const items = order.line_items.map((item: any): DeliveryNoteItem => ({
        product_id: item.product_id,
        sku: item.sku,
        description: item.name,
        quantity: item.quantity,
        delivered: 0,
        unit_price: parseFloat(item.price.toString()),
        total: parseFloat(item.total)
      }));

      // Create delivery note
      const deliveryNote = await this.createDeliveryNote({
        customer_data: customerData,
        date: new Date().toISOString().split('T')[0],
        status: 'draft',
        items
      });

      // Add note to WooCommerce order
      await wooCommerceService.addOrderNote(
        orderId,
        `Bon de livraison créé: ${deliveryNote.number}`,
        false
      );

      return deliveryNote;
    } catch (error) {
      console.error('Error creating delivery note from order:', error);
      throw error;
    }
  }

  async markAsDelivered(id: string): Promise<void> {
    try {
      const deliveryNote = await this.getDeliveryNote(id);
      if (deliveryNote) {
        await this.updateDeliveryNote(id, {
          status: 'delivered',
          actual_delivery_date: new Date().toISOString().split('T')[0]
        });

        // Update WooCommerce order status if it exists
        if (deliveryNote.customer_data?.order_id) {
          await wooCommerceService.updateOrderStatus(
            deliveryNote.customer_data.order_id,
            'completed'
          );
          await wooCommerceService.addOrderNote(
            deliveryNote.customer_data.order_id,
            `Bon de livraison ${deliveryNote.number} marqué comme livré`,
            false
          );
        }
      }
    } catch (error) {
      console.error('Error marking delivery note as delivered:', error);
      throw error;
    }
  }

  async markAsInTransit(id: string): Promise<void> {
    try {
      const deliveryNote = await this.getDeliveryNote(id);
      if (deliveryNote) {
        await this.updateDeliveryNote(id, {
          status: 'in_transit'
        });

        // Update WooCommerce order status if it exists
        if (deliveryNote.customer_data?.order_id) {
          await wooCommerceService.updateOrderStatus(
            deliveryNote.customer_data.order_id,
            'in-transit'
          );
          await wooCommerceService.addOrderNote(
            deliveryNote.customer_data.order_id,
            `Bon de livraison ${deliveryNote.number} en cours de livraison`,
            false
          );
        }
      }
    } catch (error) {
      console.error('Error marking delivery note as in transit:', error);
      throw error;
    }
  }

  async cancelDeliveryNote(id: string, reason?: string): Promise<void> {
    try {
      const deliveryNote = await this.getDeliveryNote(id);
      if (deliveryNote) {
        await this.updateDeliveryNote(id, {
          status: 'cancelled',
          notes: reason ? `${deliveryNote.notes || ''}\n\nAnnulé: ${reason}`.trim() : deliveryNote.notes
        });

        // Update WooCommerce order if it exists
        if (deliveryNote.customer_data?.order_id) {
          await wooCommerceService.addOrderNote(
            deliveryNote.customer_data.order_id,
            `Bon de livraison ${deliveryNote.number} annulé${reason ? `: ${reason}` : ''}`,
            false
          );
        }
      }
    } catch (error) {
      console.error('Error cancelling delivery note:', error);
      throw error;
    }
  }
}

export const deliveryNoteService = new DeliveryNoteService();