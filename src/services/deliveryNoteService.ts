import { supabase } from '../lib/supabase';
import { DeliveryNote } from '../types';

class DeliveryNoteService {
  private readonly TABLE_NAME = 'delivery_notes';

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
   * Convert database row to DeliveryNote type
   */
  private mapDatabaseToDeliveryNote(row: any): DeliveryNote {
    return {
      id: row.id,
      number: row.number,
      orderId: row.order_id,
      invoiceId: row.invoice_id,
      date: row.date,
      estimatedDeliveryDate: row.estimated_delivery_date,
      status: row.status,
      customer: row.customer,
      items: row.items,
      notes: row.notes
    };
  }

  /**
   * Convert DeliveryNote type to database row
   */
  private mapDeliveryNoteToDatabase(deliveryNote: DeliveryNote): any {
    return {
      id: deliveryNote.id,
      number: deliveryNote.number,
      order_id: deliveryNote.orderId,
      invoice_id: deliveryNote.invoiceId,
      date: deliveryNote.date,
      estimated_delivery_date: deliveryNote.estimatedDeliveryDate,
      status: deliveryNote.status,
      customer: deliveryNote.customer,
      items: deliveryNote.items,
      notes: deliveryNote.notes
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

  async getDeliveryNoteById(id: string): Promise<DeliveryNote | null> {
    try {
      await this.ensureAuthenticated();

      const { data, error } = await supabase
        .from(this.TABLE_NAME)
        .select('*')
        .eq('id', id)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return null;
        }
        throw error;
      }

      return data ? this.mapDatabaseToDeliveryNote(data) : null;
    } catch (error) {
      console.error('Error getting delivery note by ID:', error);
      return null;
    }
  }

  async saveDeliveryNote(deliveryNote: DeliveryNote): Promise<DeliveryNote> {
    try {
      await this.ensureAuthenticated();

      const deliveryNoteData = this.mapDeliveryNoteToDatabase(deliveryNote);
      
      if (!deliveryNote.id) {
        deliveryNoteData.id = crypto.randomUUID();
      }

      const { data, error } = await supabase
        .from(this.TABLE_NAME)
        .upsert(deliveryNoteData)
        .select()
        .single();

      if (error) {
        console.error('Error saving delivery note:', error);
        throw error;
      }

      return this.mapDatabaseToDeliveryNote(data);
    } catch (error) {
      console.error('Error saving delivery note:', error);
      throw error;
    }
  }

  async deleteDeliveryNote(deliveryNoteId: string): Promise<void> {
    try {
      await this.ensureAuthenticated();

      const { error } = await supabase
        .from(this.TABLE_NAME)
        .delete()
        .eq('id', deliveryNoteId);

      if (error) {
        console.error('Error deleting delivery note:', error);
        throw error;
      }
    } catch (error) {
      console.error('Error deleting delivery note:', error);
      throw error;
    }
  }

  async getDeliveryNoteStats() {
    try {
      const deliveryNotes = await this.getDeliveryNotes();
      
      return {
        total: deliveryNotes.length,
        pending: deliveryNotes.filter(d => d.status === 'pending').length,
        inTransit: deliveryNotes.filter(d => d.status === 'in_transit').length,
        delivered: deliveryNotes.filter(d => d.status === 'delivered').length,
        cancelled: deliveryNotes.filter(d => d.status === 'cancelled').length
      };
    } catch (error) {
      console.error('Error getting delivery note stats:', error);
      return {
        total: 0,
        pending: 0,
        inTransit: 0,
        delivered: 0,
        cancelled: 0
      };
    }
  }
}

export const deliveryNoteService = new DeliveryNoteService();