import { supabase } from '../lib/supabase';
import { ReturnNote } from '../types';
import { documentNumberingService } from './documentNumberingService';

class ReturnNoteService {
  private readonly TABLE_NAME = 'return_notes';

  private async ensureAuthenticated(): Promise<string> {
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) {
      throw new Error('User must be authenticated to perform this operation');
    }
    return user.id;
  }

  private mapDatabaseToReturnNote(data: any): ReturnNote {
    return {
      id: data.id,
      number: data.number,
      invoice_id: data.invoice_id,
      delivery_note_id: data.delivery_note_id,
      customer_id: data.customer_id,
      customer_data: data.customer_data,
      date: data.date,
      status: data.status,
      items: data.items || [],
      reason: data.reason,
      notes: data.notes,
      created_at: data.created_at,
      updated_at: data.updated_at
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

  async getReturnNote(id: string): Promise<ReturnNote | null> {
    try {
      await this.ensureAuthenticated();

      const { data, error } = await supabase
        .from(this.TABLE_NAME)
        .select('*')
        .eq('id', id)
        .single();

      if (error) {
        console.error('Error fetching return note:', error);
        throw error;
      }

      return data ? this.mapDatabaseToReturnNote(data) : null;
    } catch (error) {
      console.error('Error loading return note:', error);
      return null;
    }
  }

  async createReturnNote(returnNote: Partial<ReturnNote>): Promise<ReturnNote> {
    try {
      await this.ensureAuthenticated();

      // Get next return note number
      const number = await documentNumberingService.generateNumber('RETURN');

      const { data, error } = await supabase
        .from(this.TABLE_NAME)
        .insert([{
          ...returnNote,
          number,
          status: returnNote.status || 'draft',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }])
        .select()
        .single();

      if (error) {
        console.error('Error creating return note:', error);
        throw error;
      }

      return this.mapDatabaseToReturnNote(data);
    } catch (error) {
      console.error('Error creating return note:', error);
      throw error;
    }
  }

  async updateReturnNote(id: string, returnNote: Partial<ReturnNote>): Promise<ReturnNote> {
    try {
      await this.ensureAuthenticated();

      const { data, error } = await supabase
        .from(this.TABLE_NAME)
        .update({
          ...returnNote,
          updated_at: new Date().toISOString()
        })
        .eq('id', id)
        .select()
        .single();

      if (error) {
        console.error('Error updating return note:', error);
        throw error;
      }

      return this.mapDatabaseToReturnNote(data);
    } catch (error) {
      console.error('Error updating return note:', error);
      throw error;
    }
  }

  async deleteReturnNote(id: string): Promise<void> {
    try {
      await this.ensureAuthenticated();

      const { error } = await supabase
        .from(this.TABLE_NAME)
        .delete()
        .eq('id', id);

      if (error) {
        console.error('Error deleting return note:', error);
        throw error;
      }
    } catch (error) {
      console.error('Error deleting return note:', error);
      throw error;
    }
  }

  async searchReturnNotes(query: string): Promise<ReturnNote[]> {
    try {
      await this.ensureAuthenticated();

      const { data, error } = await supabase
        .from(this.TABLE_NAME)
        .select('*')
        .or(`number.ilike.%${query}%,customer_data->>'name'.ilike.%${query}%`)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error searching return notes:', error);
        throw error;
      }

      return (data || []).map(this.mapDatabaseToReturnNote);
    } catch (error) {
      console.error('Error searching return notes:', error);
      return [];
    }
  }

  async processReturnNote(id: string): Promise<void> {
    try {
      const returnNote = await this.getReturnNote(id);
      if (returnNote) {
        await this.updateReturnNote(id, {
          status: 'processed'
        });
      }
    } catch (error) {
      console.error('Error processing return note:', error);
      throw error;
    }
  }

  async cancelReturnNote(id: string, reason?: string): Promise<void> {
    try {
      const returnNote = await this.getReturnNote(id);
      if (returnNote) {
        await this.updateReturnNote(id, {
          status: 'cancelled',
          notes: reason ? `${returnNote.notes || ''}\n\nAnnulé: ${reason}`.trim() : returnNote.notes
        });
      }
    } catch (error) {
      console.error('Error cancelling return note:', error);
      throw error;
    }
  }
}

export const returnNoteService = new ReturnNoteService();