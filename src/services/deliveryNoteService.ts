import { supabase } from '../lib/supabase';
import { DeliveryNote } from '../types';
import { wooCommerceService } from './woocommerce';
import { documentNumberingService } from './documentNumberingService';

class DeliveryNoteService {
  private readonly TABLE_NAME = 'delivery_notes';

  private async ensureAuthenticated(): Promise<string> {
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) {
      throw new Error('User must be authenticated to perform this operation');
    }
    return user.id;
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

      return data || [];
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

      return data;
    } catch (error) {
      console.error('Error loading delivery note:', error);
      return null;
    }
  }

  async createDeliveryNote(note: DeliveryNote): Promise<DeliveryNote> {
    try {

      if (!note.number) {
        try {
          note.number = await documentNumberingService.generateNumber('DELIVERY');
        } catch (error) {
          console.error('Error generating delivery note number:', error);
          // Fallback number generation
          const timestamp = Date.now().toString().slice(-6);
          note.number = `BL-${timestamp}`;
        }
      }

      // Separate orderId from the database data
      const { orderId, ...dbData } = note;

      const { data, error } = await supabase
        .from(this.TABLE_NAME)
        .insert({
          ...dbData,
          id: dbData.id || crypto.randomUUID(),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select()
        .single();

      if (error) {
        console.error('Error creating delivery note:', error);
        throw error;
      }

      // Add orderId back to the returned data for WooCommerce integration
      const result = { ...data, orderId } as DeliveryNote;

      // Update WooCommerce order if applicable
      if (orderId && result.status === 'delivered') {
        await this.updateWooCommerceOrder(result);
      }

      return result;
    } catch (error) {
      console.error('Error creating delivery note:', error);
      throw error;
    }
  }

  async createFromInvoice(invoiceId: string): Promise<DeliveryNote> {
    try {
      // Import invoice service to get the conversion data
      const { invoiceService } = await import('./invoiceService');
      const deliveryNoteData = await invoiceService.convertToDeliveryNote(invoiceId);

      return await this.createDeliveryNote(deliveryNoteData);
    } catch (error) {
      console.error('Error creating delivery note from invoice:', error);
      throw error;
    }
  }

  async updateDeliveryNote(id: string, note: DeliveryNote): Promise<DeliveryNote> {
    try {
      await this.ensureAuthenticated();

      // Separate orderId from the database data
      const { orderId, ...dbData } = note;

      const { data, error } = await supabase
        .from(this.TABLE_NAME)
        .update({
          ...dbData,
          updated_at: new Date().toISOString()
        })
        .eq('id', id)
        .select()
        .single();

      if (error) {
        console.error('Error updating delivery note:', error);
        throw error;
      }

      // Add orderId back to the returned data for WooCommerce integration
      const result = { ...data, orderId } as DeliveryNote;

      // Update WooCommerce order if applicable
      if (orderId && result.status === 'delivered') {
        await this.updateWooCommerceOrder(result);
      }

      return result;
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

      return data || [];
    } catch (error) {
      console.error('Error searching delivery notes:', error);
      return [];
    }
  }

  async markAsDelivered(id: string): Promise<DeliveryNote> {
    try {
      const note = await this.getDeliveryNote(id);
      if (!note) {
        throw new Error('Delivery note not found');
      }

      note.status = 'delivered';
      note.items = note.items.map(item => ({
        ...item,
        delivered: item.quantity
      }));

      return await this.updateDeliveryNote(id, note);
    } catch (error) {
      console.error('Error marking delivery note as delivered:', error);
      throw error;
    }
  }

  async markAsInTransit(id: string): Promise<DeliveryNote> {
    try {
      const note = await this.getDeliveryNote(id);
      if (!note) {
        throw new Error('Delivery note not found');
      }

      note.status = 'in_transit';
      return await this.updateDeliveryNote(id, note);
    } catch (error) {
      console.error('Error marking delivery note as in transit:', error);
      throw error;
    }
  }

  async cancelDeliveryNote(id: string): Promise<DeliveryNote> {
    try {
      const note = await this.getDeliveryNote(id);
      if (!note) {
        throw new Error('Delivery note not found');
      }

      note.status = 'cancelled';
      return await this.updateDeliveryNote(id, note);
    } catch (error) {
      console.error('Error cancelling delivery note:', error);
      throw error;
    }
  }

  private async updateWooCommerceOrder(note: DeliveryNote): Promise<void> {
    if (!note.orderId) return;

    try {
      // Update order status if delivered
      if (note.status === 'delivered') {
        await wooCommerceService.updateOrderStatus(note.orderId, 'completed');
      }

      // Add note to WooCommerce order
      const noteText = `Bon de livraison ${note.number} - Statut: ${note.status}
Articles livrés: ${note.items.reduce((sum, item) => sum + (item.delivered || 0), 0)}/${note.items.reduce((sum, item) => sum + item.quantity, 0)}`;

      await wooCommerceService.addOrderNote(note.orderId, noteText, true);
    } catch (error) {
      console.error('Error updating WooCommerce order:', error);
      throw error;
    }
  }

  async getDeliveryNoteStats() {
    try {
      const deliveryNotes = await this.getDeliveryNotes();

      return {
        total: deliveryNotes.length,
        draft: deliveryNotes.filter(d => d.status === 'draft').length,
        inTransit: deliveryNotes.filter(d => d.status === 'in_transit').length,
        delivered: deliveryNotes.filter(d => d.status === 'delivered').length,
        cancelled: deliveryNotes.filter(d => d.status === 'cancelled').length,
        totalItems: deliveryNotes.reduce((sum, d) => sum + (d.items?.length || 0), 0),
        pendingDeliveries: deliveryNotes.filter(d => ['draft', 'in_transit'].includes(d.status)).length
      };
    } catch (error) {
      console.error('Error getting delivery note stats:', error);
      return {
        total: 0,
        draft: 0,
        inTransit: 0,
        delivered: 0,
        cancelled: 0,
        totalItems: 0,
        pendingDeliveries: 0
      };
    }
  }

  subscribeToDeliveryNotes(callback: (payload: any) => void) {
    return supabase
      .channel('public:delivery_notes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: this.TABLE_NAME
        },
        callback
      )
      .subscribe();
  }
}

export const deliveryNoteService = new DeliveryNoteService();