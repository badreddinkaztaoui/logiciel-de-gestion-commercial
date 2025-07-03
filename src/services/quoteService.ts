import { supabase } from '../lib/supabase';
import { Quote } from '../types';

class QuoteService {
  private readonly TABLE_NAME = 'quotes';

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
   * Convert database row to Quote type
   */
  private mapDatabaseToQuote(row: any): Quote {
    return {
      id: row.id,
      number: row.number,
      orderId: row.order_id,
      date: row.date,
      validUntil: row.valid_until,
      status: row.status,
      customer: row.customer,
      items: row.items,
      subtotal: parseFloat(row.subtotal || '0'),
      tax: parseFloat(row.tax || '0'),
      total: parseFloat(row.total || '0'),
      notes: row.notes,
      conditions: row.conditions
    };
  }

  /**
   * Convert Quote type to database row
   */
  private mapQuoteToDatabase(quote: Quote): any {
    return {
      id: quote.id,
      number: quote.number,
      order_id: quote.orderId,
      date: quote.date,
      valid_until: quote.validUntil,
      status: quote.status,
      customer: quote.customer,
      items: quote.items,
      subtotal: quote.subtotal,
      tax: quote.tax,
      total: quote.total,
      notes: quote.notes,
      conditions: quote.conditions
    };
  }

  async getQuotes(): Promise<Quote[]> {
    try {
      await this.ensureAuthenticated();

      const { data, error } = await supabase
        .from(this.TABLE_NAME)
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching quotes:', error);
        throw error;
      }

      return (data || []).map(this.mapDatabaseToQuote);
    } catch (error) {
      console.error('Error loading quotes:', error);
      return [];
    }
  }

  async getQuoteById(id: string): Promise<Quote | null> {
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

      return data ? this.mapDatabaseToQuote(data) : null;
    } catch (error) {
      console.error('Error getting quote by ID:', error);
      return null;
    }
  }

  async getQuoteByNumber(number: string): Promise<Quote | null> {
    try {
      await this.ensureAuthenticated();

      const { data, error } = await supabase
        .from(this.TABLE_NAME)
        .select('*')
        .eq('number', number)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return null;
        }
        throw error;
      }

      return data ? this.mapDatabaseToQuote(data) : null;
    } catch (error) {
      console.error('Error getting quote by number:', error);
      return null;
    }
  }

  async saveQuote(quote: Quote): Promise<Quote> {
    try {
      await this.ensureAuthenticated();

      const quoteData = this.mapQuoteToDatabase(quote);
      
      if (!quote.id) {
        quoteData.id = crypto.randomUUID();
      }

      const { data, error } = await supabase
        .from(this.TABLE_NAME)
        .upsert(quoteData)
        .select()
        .single();

      if (error) {
        console.error('Error saving quote:', error);
        throw error;
      }

      return this.mapDatabaseToQuote(data);
    } catch (error) {
      console.error('Error saving quote:', error);
      throw error;
    }
  }

  async deleteQuote(quoteId: string): Promise<void> {
    try {
      await this.ensureAuthenticated();

      const { error } = await supabase
        .from(this.TABLE_NAME)
        .delete()
        .eq('id', quoteId);

      if (error) {
        console.error('Error deleting quote:', error);
        throw error;
      }
    } catch (error) {
      console.error('Error deleting quote:', error);
      throw error;
    }
  }

  // Convert quote to invoice
  convertToInvoice(quoteId: string): any {
    // This will be handled by the invoice service
    // Return the structure for invoice creation
    return {
      quoteId: quoteId,
      // Other invoice-specific logic will be handled in the UI
    };
  }

  async acceptQuote(quoteId: string): Promise<void> {
    try {
      const quote = await this.getQuoteById(quoteId);
      if (quote) {
        quote.status = 'accepted';
        await this.saveQuote(quote);
      }
    } catch (error) {
      console.error('Error accepting quote:', error);
      throw error;
    }
  }

  async rejectQuote(quoteId: string, reason?: string): Promise<void> {
    try {
      const quote = await this.getQuoteById(quoteId);
      if (quote) {
        quote.status = 'rejected';
        if (reason) {
          quote.notes = quote.notes ? `${quote.notes}\n\nRejeté: ${reason}` : `Rejeté: ${reason}`;
        }
        await this.saveQuote(quote);
      }
    } catch (error) {
      console.error('Error rejecting quote:', error);
      throw error;
    }
  }

  async checkExpiredQuotes(): Promise<Quote[]> {
    try {
      const quotes = await this.getQuotes();
      const today = new Date();
      const expiredQuotes: Quote[] = [];

      for (const quote of quotes) {
        if (quote.status === 'sent' && new Date(quote.validUntil) < today) {
          quote.status = 'expired';
          await this.saveQuote(quote);
          expiredQuotes.push(quote);
        }
      }

      return expiredQuotes;
    } catch (error) {
      console.error('Error checking expired quotes:', error);
      return [];
    }
  }

  async getQuoteStats() {
    try {
      const quotes = await this.getQuotes();
      
      return {
        total: quotes.length,
        draft: quotes.filter(q => q.status === 'draft').length,
        sent: quotes.filter(q => q.status === 'sent').length,
        accepted: quotes.filter(q => q.status === 'accepted').length,
        rejected: quotes.filter(q => q.status === 'rejected').length,
        expired: quotes.filter(q => q.status === 'expired').length,
        totalValue: quotes.reduce((sum, q) => sum + q.total, 0),
        acceptedValue: quotes.filter(q => q.status === 'accepted').reduce((sum, q) => sum + q.total, 0),
        pendingValue: quotes.filter(q => q.status === 'sent').reduce((sum, q) => sum + q.total, 0)
      };
    } catch (error) {
      console.error('Error getting quote stats:', error);
      return {
        total: 0,
        draft: 0,
        sent: 0,
        accepted: 0,
        rejected: 0,
        expired: 0,
        totalValue: 0,
        acceptedValue: 0,
        pendingValue: 0
      };
    }
  }
}

export const quoteService = new QuoteService();