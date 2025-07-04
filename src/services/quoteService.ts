import { supabase } from '../lib/supabase';
import { Quote } from '../types';
import { documentNumberingService } from './documentNumberingService';

class QuoteService {
  private readonly TABLE_NAME = 'quotes';

  private async ensureAuthenticated(): Promise<string> {
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) {
      throw new Error('User must be authenticated to perform this operation');
    }
    return user.id;
  }

  private mapDatabaseToQuote(data: any): Quote {
    return {
      id: data.id,
      number: data.number,
      date: data.date,
      validUntil: data.expiry_date,
      status: data.status,
      customer: data.customer_data,
      items: data.items || [],
      subtotal: Number(data.subtotal),
      tax: Number(data.tax_amount),
      total: Number(data.total),
      notes: data.notes,
      created_at: data.created_at,
      updated_at: data.updated_at
    };
  }

  private mapQuoteToDatabase(quote: Partial<Quote>): any {
    const now = new Date().toISOString();
    const data = {
      number: quote.number,
      customer_data: quote.customer,
      date: quote.date,
      expiry_date: quote.validUntil,
      status: quote.status || 'draft',
      items: quote.items || [],
      subtotal: quote.subtotal || 0,
      tax_rate: 20,
      tax_amount: quote.tax || 0,
      total: quote.total || 0,
      currency: 'MAD',
      notes: quote.notes,
      created_at: quote.created_at || now,
      updated_at: now
    };

    // Only include id if it exists and is not empty
    if (quote.id) {
      return { ...data, id: quote.id };
    }

    return data;
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

  async getQuote(id: string): Promise<Quote | null> {
    try {
      await this.ensureAuthenticated();

      const { data, error } = await supabase
        .from(this.TABLE_NAME)
        .select('*')
        .eq('id', id)
        .single();

      if (error) {
        console.error('Error fetching quote:', error);
        throw error;
      }

      return data ? this.mapDatabaseToQuote(data) : null;
    } catch (error) {
      console.error('Error loading quote:', error);
      return null;
    }
  }

  async createQuote(quote: Partial<Quote>): Promise<Quote> {
    try {
      await this.ensureAuthenticated();

      const number = await documentNumberingService.generateNumber('QUOTE');
      const now = new Date().toISOString();

      const quoteData = this.mapQuoteToDatabase({
        ...quote,
        number,
        created_at: now,
        updated_at: now
      });

      const { data, error } = await supabase
        .from(this.TABLE_NAME)
        .insert([quoteData])
        .select()
        .single();

      if (error) {
        console.error('Error creating quote:', error);
        throw error;
      }

      return this.mapDatabaseToQuote(data);
    } catch (error) {
      console.error('Error creating quote:', error);
      throw error;
    }
  }

  async updateQuote(id: string, quote: Partial<Quote>): Promise<Quote> {
    try {
      await this.ensureAuthenticated();

      const { data, error } = await supabase
        .from(this.TABLE_NAME)
        .update(this.mapQuoteToDatabase(quote))
        .eq('id', id)
        .select()
        .single();

      if (error) {
        console.error('Error updating quote:', error);
        throw error;
      }

      return this.mapDatabaseToQuote(data);
    } catch (error) {
      console.error('Error updating quote:', error);
      throw error;
    }
  }

  async deleteQuote(id: string): Promise<void> {
    try {
      await this.ensureAuthenticated();

      const { error } = await supabase
        .from(this.TABLE_NAME)
        .delete()
        .eq('id', id);

      if (error) {
        console.error('Error deleting quote:', error);
        throw error;
      }
    } catch (error) {
      console.error('Error deleting quote:', error);
      throw error;
    }
  }

  async searchQuotes(query: string): Promise<Quote[]> {
    try {
      await this.ensureAuthenticated();

      const { data, error } = await supabase
        .from(this.TABLE_NAME)
        .select('*')
        .or(`number.ilike.%${query}%,customer_data->>'name'.ilike.%${query}%`)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error searching quotes:', error);
        throw error;
      }

      return (data || []).map(this.mapDatabaseToQuote);
    } catch (error) {
      console.error('Error searching quotes:', error);
      return [];
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
      const quote = await this.getQuote(quoteId);
      if (quote) {
        quote.status = 'accepted';
        await this.updateQuote(quoteId, quote);
      }
    } catch (error) {
      console.error('Error accepting quote:', error);
      throw error;
    }
  }

  async rejectQuote(quoteId: string, reason?: string): Promise<void> {
    try {
      const quote = await this.getQuote(quoteId);
      if (quote) {
        quote.status = 'rejected';
        if (reason) {
          quote.notes = quote.notes ? `${quote.notes}\n\nRejeté: ${reason}` : `Rejeté: ${reason}`;
        }
        await this.updateQuote(quoteId, quote);
      }
    } catch (error) {
      console.error('Error rejecting quote:', error);
      throw error;
    }
  }

  async checkExpiredQuotes(): Promise<Quote[]> {
    try {
      const quotes = await this.getQuotes();
      const expiredQuotes: Quote[] = [];
      const today = new Date();

      for (const quote of quotes) {
        if (quote.status === 'sent' && quote.validUntil && new Date(quote.validUntil) < today) {
          quote.status = 'expired';
          await this.updateQuote(quote.id, quote);
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