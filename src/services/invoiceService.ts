import { supabase } from '../lib/supabase';
import { Invoice } from '../types';
import { documentNumberingService } from './documentNumberingService';

class InvoiceService {
  private readonly TABLE_NAME = 'invoices';
  private currentUserId: string | null = null;

  /**
   * Ensure user is authenticated
   */
  private async ensureAuthenticated(): Promise<string> {
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) {
      throw new Error('User must be authenticated to perform this operation');
    }
    this.currentUserId = user.id;
    return user.id;
  }

  /**
   * Convert database row to Invoice type
   */
  private mapDatabaseToInvoice(row: any): Invoice {
    return {
      id: row.id,
      number: row.number,
      orderId: row.woocommerce_order_id,
      quoteId: row.quote_id,
      date: row.date,
      dueDate: row.due_date,
      status: row.status,
      customer: row.customer_data || row.customer,
      items: row.items,
      subtotal: parseFloat(row.subtotal || '0'),
      tax: parseFloat(row.tax_amount || '0'),
      total: parseFloat(row.total || '0'),
      notes: row.notes
    };
  }

  /**
   * Convert Invoice type to database row
   */
  private mapInvoiceToDatabase(invoice: Invoice): any {
    return {
      id: invoice.id,
      number: invoice.number,
      woocommerce_order_id: invoice.orderId,
      quote_id: invoice.quoteId,
      date: invoice.date,
      due_date: invoice.dueDate,
      status: invoice.status,
      customer_data: invoice.customer,
      items: invoice.items,
      subtotal: invoice.subtotal,
      tax_amount: invoice.tax,
      total: invoice.total,
      tax_rate: 20.00,
      notes: invoice.notes
    };
  }

  async getInvoices(): Promise<Invoice[]> {
    try {
      const { data, error } = await supabase
        .from(this.TABLE_NAME)
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching invoices:', error);
        throw error;
      }

      return (data || []).map(this.mapDatabaseToInvoice);
    } catch (error) {
      console.error('Error loading invoices:', error);
      return [];
    }
  }

  async getInvoiceById(id: string): Promise<Invoice | null> {
    try {
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

      return data ? this.mapDatabaseToInvoice(data) : null;
    } catch (error) {
      console.error('Error getting invoice by ID:', error);
      return null;
    }
  }

  async getInvoiceByOrderId(orderId: number): Promise<Invoice | null> {
    try {
      const { data, error } = await supabase
        .from(this.TABLE_NAME)
        .select('*')
        .eq('woocommerce_order_id', orderId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return null;
        }
        throw error;
      }

      return data ? this.mapDatabaseToInvoice(data) : null;
    } catch (error) {
      console.error('Error getting invoice by order ID:', error);
      return null;
    }
  }

  async saveInvoice(invoice: Invoice): Promise<Invoice> {
    try {
      await this.ensureAuthenticated();

      const invoiceData = this.mapInvoiceToDatabase(invoice);

      if (!invoice.id) {
        invoiceData.id = crypto.randomUUID();

        // Generate invoice number if not provided
        if (!invoice.number) {
          invoiceData.number = await documentNumberingService.generateNumber(
            'INVOICE',
            invoice.orderId
          );
        }
      }

      const { data, error } = await supabase
        .from(this.TABLE_NAME)
        .upsert(invoiceData)
        .select()
        .single();

      if (error) {
        console.error('Error saving invoice:', error);
        throw error;
      }

      return this.mapDatabaseToInvoice(data);
    } catch (error) {
      console.error('Error saving invoice:', error);
      throw error;
    }
  }

  async deleteInvoice(invoiceId: string): Promise<void> {
    try {
      await this.ensureAuthenticated();

      const { error } = await supabase
        .from(this.TABLE_NAME)
        .delete()
        .eq('id', invoiceId);

      if (error) {
        console.error('Error deleting invoice:', error);
        throw error;
      }
    } catch (error) {
      console.error('Error deleting invoice:', error);
      throw error;
    }
  }

  async getInvoiceStats() {
    try {
      const invoices = await this.getInvoices();

      return {
        total: invoices.length,
        draft: invoices.filter(i => i.status === 'draft').length,
        sent: invoices.filter(i => i.status === 'sent').length,
        paid: invoices.filter(i => i.status === 'paid').length,
        overdue: invoices.filter(i => i.status === 'overdue').length,
        totalValue: invoices.reduce((sum, i) => sum + i.total, 0),
        paidValue: invoices.filter(i => i.status === 'paid').reduce((sum, i) => sum + i.total, 0),
        pendingValue: invoices.filter(i => ['sent', 'overdue'].includes(i.status)).reduce((sum, i) => sum + i.total, 0)
      };
    } catch (error) {
      console.error('Error getting invoice stats:', error);
      return {
        total: 0,
        draft: 0,
        sent: 0,
        paid: 0,
        overdue: 0,
        totalValue: 0,
        paidValue: 0,
        pendingValue: 0
      };
    }
  }
}

export const invoiceService = new InvoiceService();