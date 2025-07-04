import { supabase } from '../lib/supabase';
import { Invoice } from '../types';
import { documentNumberingService } from './documentNumberingService';
import { settingsService } from './settingsService';
import { toast } from 'react-hot-toast';

class InvoiceService {
  private readonly TABLE_NAME = 'invoices';

  private mapDatabaseToInvoice(row: any): Invoice {
    return {
      id: row.id,
      number: row.number,
      orderId: row.woocommerce_order_id,
      quoteId: row.quote_id,
      date: row.date,
      dueDate: row.due_date,
      status: row.status,
      customer: row.customer_info,
      items: row.line_items,
      subtotal: parseFloat(row.subtotal || '0'),
      tax: parseFloat(row.tax_amount || '0'),
      total: parseFloat(row.total || '0'),
      notes: row.notes,
      woocommerceStatus: row.woocommerce_status,
      lastSyncedAt: row.last_synced_at
    };
  }

  private mapInvoiceToDatabase(invoice: Invoice): any {
    return {
      id: invoice.id,
      number: invoice.number,
      woocommerce_order_id: invoice.orderId,
      quote_id: invoice.quoteId,
      date: invoice.date,
      due_date: invoice.dueDate,
      status: invoice.status,
      customer_info: invoice.customer,
      line_items: invoice.items,
      subtotal: invoice.subtotal,
      tax_amount: invoice.tax,
      total: invoice.total,
      tax_rate: 20.00,
      notes: invoice.notes,
      woocommerce_status: invoice.woocommerceStatus,
      last_synced_at: invoice.lastSyncedAt || new Date().toISOString()
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

  async generateInvoiceNumber(orderId?: number): Promise<string> {
    try {
      return await documentNumberingService.generateNumber('INVOICE', orderId);
    } catch (error) {
      console.error('Error generating invoice number:', error);
      throw error;
    }
  }

  async previewNextInvoiceNumber(year?: number): Promise<string> {
    try {
      return await documentNumberingService.generatePreviewNumber('INVOICE', year);
    } catch (error) {
      console.error('Error generating preview number:', error);
      throw error;
    }
  }

  async saveInvoice(invoice: Invoice): Promise<Invoice> {
    try {
      // Generate new number for new invoices before mapping to database
      if (!invoice.id || !invoice.number) {
        try {
          invoice.number = await this.generateInvoiceNumber(invoice.orderId);
        } catch (error) {
          console.error('Error generating invoice number:', error);
          throw error;
        }
      }

      const invoiceData = this.mapInvoiceToDatabase(invoice);

      // For new invoices
      if (!invoice.id) {
        invoiceData.id = crypto.randomUUID();
      }

      // Use upsert instead of insert/update to handle both cases
      const { data, error } = await supabase
        .from(this.TABLE_NAME)
        .upsert(invoiceData)
        .select()
        .single();

      if (error) {
        console.error('Error saving invoice:', error);
        throw error;
      }

      if (!data) {
        throw new Error('No data returned after saving invoice');
      }

      return this.mapDatabaseToInvoice(data);
    } catch (error) {
      console.error('Error saving invoice:', error);
      throw error;
    }
  }

  async deleteInvoice(invoiceId: string): Promise<void> {
    try {
      // First, get the invoice to check if it exists and get its number
      const { data: invoice, error: fetchError } = await supabase
        .from(this.TABLE_NAME)
        .select('number, woocommerce_order_id')
        .eq('id', invoiceId)
        .single();

      if (fetchError) {
        if (fetchError.code === 'PGRST116') {
          throw new Error('Invoice not found');
        }
        console.error('Error fetching invoice for deletion:', fetchError);
        throw fetchError;
      }

      if (!invoice) {
        throw new Error('Invoice not found');
      }

      // Check if invoice is linked to a WooCommerce order
      if (invoice.woocommerce_order_id && invoice.woocommerce_order_id > 0) {
        throw new Error(
          'Cette facture est liée à une commande WooCommerce (#' +
          invoice.woocommerce_order_id +
          '). Pour des raisons de cohérence des données, elle ne peut pas être supprimée. ' +
          'Vous pouvez la marquer comme "annulée" à la place.'
        );
      }

      // Delete the invoice
      const { error: deleteError } = await supabase
        .from(this.TABLE_NAME)
        .delete()
        .eq('id', invoiceId);

      if (deleteError) {
        console.error('Error deleting invoice:', deleteError);
        throw deleteError;
      }

      // Delete the document number entry if it exists
      if (invoice.number) {
        try {
          await documentNumberingService.deleteNumber(invoice.number);
        } catch (error) {
          toast.error('Erreur lors de la suppression du numéro de document');
          // Continue even if document number deletion fails
        }
      }

      console.log(`Successfully deleted invoice ${invoiceId}`);
    } catch (error) {
      console.error('Error in deleteInvoice:', error);
      throw error;
    }
  }

  async cancelInvoice(invoiceId: string): Promise<Invoice> {
    try {
      // Get the current invoice
      const invoice = await this.getInvoiceById(invoiceId);
      if (!invoice) {
        throw new Error('Invoice not found');
      }

      // Update the invoice status to cancelled
      const updatedInvoice: Invoice = {
        ...invoice,
        status: 'cancelled',
        notes: (invoice.notes ? invoice.notes + '\n' : '') +
          `Facture annulée le ${new Date().toLocaleDateString()}`
      };

      // Save the updated invoice
      const result = await this.saveInvoice(updatedInvoice);
      console.log(`Successfully cancelled invoice ${invoiceId}`);
      return result;
    } catch (error) {
      console.error('Error cancelling invoice:', error);
      throw error;
    }
  }

  async syncWithWooCommerce(orderId: number, woocommerceStatus: string): Promise<void> {
    try {
      const invoice = await this.getInvoiceByOrderId(orderId);
      if (invoice) {
        await this.saveInvoice({
          ...invoice,
          woocommerceStatus,
          lastSyncedAt: new Date().toISOString()
        });
      }
    } catch (error) {
      console.error('Error syncing invoice with WooCommerce:', error);
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