import { supabase } from '../lib/supabase';
import { ReturnNote } from '../types';

class ReturnNoteService {
  private readonly TABLE_NAME = 'return_notes';

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
   * Convert database row to ReturnNote type
   */
  private mapDatabaseToReturnNote(row: any): ReturnNote {
    return {
      id: row.id,
      number: row.number,
      orderId: row.order_id,
      date: row.date,
      reason: row.reason,
      status: row.status,
      customer: row.customer,
      items: row.items,
      refundAmount: parseFloat(row.refund_amount || '0'),
      notes: row.notes
    };
  }

  /**
   * Convert ReturnNote type to database row
   */
  private mapReturnNoteToDatabase(returnNote: ReturnNote): any {
    return {
      id: returnNote.id,
      number: returnNote.number,
      order_id: returnNote.orderId,
      date: returnNote.date,
      reason: returnNote.reason,
      status: returnNote.status,
      customer: returnNote.customer,
      items: returnNote.items,
      refund_amount: returnNote.refundAmount,
      notes: returnNote.notes
    };
  }

  async getReturnNotes(): Promise<ReturnNote[]> {
    try {
      await this.ensureAuthenticated();

      const { data, error } = await supabase
        .from(this.TABLE_NAME)
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching return notes:', error);
        throw error;
      }

      return (data || []).map(this.mapDatabaseToReturnNote);
    } catch (error) {
      console.error('Error loading return notes:', error);
      return [];
    }
  }

  async getReturnNoteById(id: string): Promise<ReturnNote | null> {
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

      return data ? this.mapDatabaseToReturnNote(data) : null;
    } catch (error) {
      console.error('Error getting return note by ID:', error);
      return null;
    }
  }

  async saveReturnNote(returnNote: ReturnNote): Promise<ReturnNote> {
    try {
      await this.ensureAuthenticated();

      const returnNoteData = this.mapReturnNoteToDatabase(returnNote);
      
      if (!returnNote.id) {
        returnNoteData.id = crypto.randomUUID();
      }

      const { data, error } = await supabase
        .from(this.TABLE_NAME)
        .upsert(returnNoteData)
        .select()
        .single();

      if (error) {
        console.error('Error saving return note:', error);
        throw error;
      }

      return this.mapDatabaseToReturnNote(data);
    } catch (error) {
      console.error('Error saving return note:', error);
      throw error;
    }
  }

  async deleteReturnNote(returnNoteId: string): Promise<void> {
    try {
      await this.ensureAuthenticated();

      const { error } = await supabase
        .from(this.TABLE_NAME)
        .delete()
        .eq('id', returnNoteId);

      if (error) {
        console.error('Error deleting return note:', error);
        throw error;
      }
    } catch (error) {
      console.error('Error deleting return note:', error);
      throw error;
    }
  }

  async getReturnNoteStats() {
    try {
      const returnNotes = await this.getReturnNotes();
      
      return {
        total: returnNotes.length,
        pending: returnNotes.filter(r => r.status === 'pending').length,
        approved: returnNotes.filter(r => r.status === 'approved').length,
        rejected: returnNotes.filter(r => r.status === 'rejected').length,
        processed: returnNotes.filter(r => r.status === 'processed').length,
        totalRefundAmount: returnNotes.reduce((sum, r) => sum + (r.refundAmount || 0), 0)
      };
    } catch (error) {
      console.error('Error getting return note stats:', error);
      return {
        total: 0,
        pending: 0,
        approved: 0,
        rejected: 0,
        processed: 0,
        totalRefundAmount: 0
      };
    }
  }
}

export const returnNoteService = new ReturnNoteService();