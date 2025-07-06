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

      // First check if the quote exists
      const existingQuote = await this.getQuote(id);
      if (!existingQuote) {
        throw new Error('Quote not found - it may have already been deleted');
      }

      console.log('Attempting to delete quote:', {
        id,
        number: existingQuote.number,
        status: existingQuote.status
      });

      // Attempt to delete the quote
      const { data, error, count } = await supabase
        .from(this.TABLE_NAME)
        .delete()
        .eq('id', id)
        .select(); // This will return the deleted rows

      if (error) {
        console.error('Supabase error deleting quote:', error);

        // Provide more specific error messages based on error codes
        if (error.code === '23503') {
          throw new Error('Cannot delete quote - it is referenced by other documents (foreign key constraint)');
        } else if (error.code === '42501') {
          throw new Error('Permission denied - you do not have rights to delete this quote');
        } else if (error.code === 'PGRST116') {
          throw new Error('Quote not found or already deleted');
        } else {
          throw new Error(`Database error: ${error.message}`);
        }
      }

      console.log('Delete operation result:', {
        data,
        count,
        deletedRows: data?.length || 0
      });

      // Verify the deletion actually happened
      if (!data || data.length === 0) {
        console.error('Delete operation succeeded but no rows were deleted');

        // Check if quote still exists
        const stillExists = await this.getQuote(id);
        if (stillExists) {
          throw new Error('Delete operation failed - quote still exists in database. This might be due to Row Level Security policies or other constraints.');
        }
      }

      // Double-check that the quote is actually gone
      const verifyDeleted = await this.getQuote(id);
      if (verifyDeleted) {
        throw new Error('Quote deletion verification failed - quote still exists in database');
      }

      console.log(`Quote ${id} deleted successfully and verified`);
    } catch (error) {
      console.error('Error deleting quote:', error);

      if (error instanceof Error) {
        // Re-throw the error with the same message to maintain error context
        throw error;
      } else {
        throw new Error('Unknown error occurred while deleting quote');
      }
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
  async convertToInvoice(quoteId: string): Promise<any> {
    try {
      const quote = await this.getQuote(quoteId);
      if (!quote) {
        throw new Error('Quote not found');
      }

      if (quote.status !== 'accepted') {
        throw new Error('Only accepted quotes can be converted to invoices');
      }

      // Convert quote items to invoice items format
      const invoiceItems = quote.items.map(item => ({
        id: crypto.randomUUID(),
        description: item.description,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        unitPriceHT: item.unitPrice, // For now, assuming prices are HT
        total: item.total,
        totalHT: item.total,
        taxRate: 20, // Default tax rate
        taxAmount: item.total * 0.2,
        sku: `ITEM-${Date.now()}`
      }));

      // Calculate totals
      const subtotal = invoiceItems.reduce((sum, item) => sum + item.totalHT, 0);
      const tax = invoiceItems.reduce((sum, item) => sum + item.taxAmount, 0);
      const total = subtotal + tax;

      // Generate due date (30 days from today)
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + 30);

      const invoiceData = {
        id: crypto.randomUUID(),
        number: '', // Will be generated by the invoice service
        date: new Date().toISOString().split('T')[0],
        dueDate: dueDate.toISOString().split('T')[0],
        status: 'draft' as const,
        customer: {
          name: quote.customer.name,
          email: quote.customer.email,
          company: quote.customer.company || '',
          address: quote.customer.address,
          city: quote.customer.city,
          postal_code: '',
          country: 'Maroc'
        },
        items: invoiceItems,
        subtotal,
        tax,
        taxRate: 20,
        total,
        currency: 'MAD',
        notes: `Facture générée à partir du devis ${quote.number}. ${quote.notes || ''}`.trim()
      };

      return invoiceData;
    } catch (error) {
      console.error('Error converting quote to invoice:', error);
      throw error;
    }
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

  async debugQuoteAccess(id: string): Promise<void> {
    try {
      const userId = await this.ensureAuthenticated();
      console.log('Current user ID:', userId);

      // Check if we can read the quote
      const quote = await this.getQuote(id);
      console.log('Quote found:', quote ? 'Yes' : 'No');

      if (quote) {
        console.log('Quote details:', {
          id: quote.id,
          number: quote.number,
          status: quote.status,
          created_at: quote.created_at
        });
      }

      // Test raw Supabase access
      const { data: rawData, error: rawError } = await supabase
        .from(this.TABLE_NAME)
        .select('*')
        .eq('id', id);

      console.log('Raw Supabase query result:', {
        data: rawData,
        error: rawError
      });

      // Check if we can perform a test update (to verify write permissions)
      const { data: updateTest, error: updateError } = await supabase
        .from(this.TABLE_NAME)
        .update({ updated_at: new Date().toISOString() })
        .eq('id', id)
        .select();

      console.log('Update permission test:', {
        canUpdate: !updateError,
        updateError: updateError?.message,
        updatedRows: updateTest?.length || 0
      });

      // Check current RLS policies (if accessible)
      const { data: policies, error: policyError } = await supabase
        .rpc('get_rls_policies', { table_name: this.TABLE_NAME });

      console.log('RLS policies info:', {
        policies: policies || 'Not accessible',
        policyError: policyError?.message
      });

    } catch (error) {
      console.error('Debug error:', error);
    }
  }

  async checkUserQuoteOwnership(id: string): Promise<boolean> {
    try {
      const userId = await this.ensureAuthenticated();

      // Try to get the quote with user_id filter if it exists
      const { data, error } = await supabase
        .from(this.TABLE_NAME)
        .select('*')
        .eq('id', id)
        .eq('user_id', userId)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        console.log('No user_id column or other error:', error.message);
        return true; // Assume ownership if no user_id column
      }

      const hasOwnership = !!data;
      console.log('User quote ownership check:', {
        userId,
        quoteId: id,
        hasOwnership
      });

      return hasOwnership;
    } catch (error) {
      console.error('Error checking quote ownership:', error);
      return false;
    }
  }

  async checkRLSPolicies(): Promise<void> {
    try {
      console.log('Checking RLS policies for quotes table...');

      // Check if RLS is enabled on the table
      const { data: rlsStatus, error: rlsError } = await supabase
        .from('pg_class')
        .select('relname, relrowsecurity')
        .eq('relname', 'quotes')
        .single();

      if (rlsError) {
        console.log('Could not check RLS status:', rlsError.message);
      } else {
        console.log('RLS status:', {
          table: rlsStatus.relname,
          rlsEnabled: rlsStatus.relrowsecurity
        });
      }

      // Try to get policies using direct SQL
      const { data: policies, error: policiesError } = await supabase
        .rpc('exec_sql', {
          query: `SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
                  FROM pg_policies
                  WHERE tablename = 'quotes' AND schemaname = 'public'`
        });

      if (policiesError) {
        console.log('Could not fetch policies:', policiesError.message);
      } else {
        console.log('Table policies:', policies);
      }

    } catch (error) {
      console.error('Error checking RLS policies:', error);
    }
  }

  async attemptDirectDelete(id: string): Promise<void> {
    try {
      console.log('Attempting direct delete with user context...');

      const userId = await this.ensureAuthenticated();
      console.log('User ID:', userId);

      // Try different delete approaches

      // Approach 1: Direct delete with user context
      const { data: result1, error: error1 } = await supabase
        .from(this.TABLE_NAME)
        .delete()
        .eq('id', id)
        .select();

      console.log('Direct delete result:', { data: result1, error: error1 });

      // Approach 2: Try with RLS bypass (if user has permissions)
      const { data: result2, error: error2 } = await supabase
        .rpc('delete_quote_bypass_rls', { quote_id: id });

      console.log('RLS bypass delete result:', { data: result2, error: error2 });

      // Approach 3: Try updating status to 'deleted' instead of actual deletion
      const { data: result3, error: error3 } = await supabase
        .from(this.TABLE_NAME)
        .update({
          status: 'deleted',
          deleted_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', id)
        .select();

      console.log('Soft delete result:', { data: result3, error: error3 });

    } catch (error) {
      console.error('Error in direct delete attempts:', error);
    }
  }
}

export const quoteService = new QuoteService();