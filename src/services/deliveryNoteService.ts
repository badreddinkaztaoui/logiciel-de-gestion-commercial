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
      const userId = await this.ensureAuthenticated();

      if (!note.number) {
        note.number = await documentNumberingService.generateNumber('DELIVERY');
      }

      const { data, error } = await supabase
        .from(this.TABLE_NAME)
        .insert({
          ...note,
          user_id: userId,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select()
        .single();

      if (error) {
        console.error('Error creating delivery note:', error);
        throw error;
      }

      // Update WooCommerce order if applicable
      if (note.orderId && note.status === 'delivered') {
        await this.updateWooCommerceOrder(note);
      }

      return data;
    } catch (error) {
      console.error('Error creating delivery note:', error);
      throw error;
    }
  }

  async updateDeliveryNote(id: string, note: DeliveryNote): Promise<DeliveryNote> {
    try {
      await this.ensureAuthenticated();

      const { data, error } = await supabase
        .from(this.TABLE_NAME)
        .update({
          ...note,
          updated_at: new Date().toISOString()
        })
        .eq('id', id)
        .select()
        .single();

      if (error) {
        console.error('Error updating delivery note:', error);
        throw error;
      }

      // Update WooCommerce order if applicable
      if (note.orderId && note.status === 'delivered') {
        await this.updateWooCommerceOrder(note);
      }

      return data;
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