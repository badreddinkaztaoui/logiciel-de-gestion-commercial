import { supabase } from '../lib/supabase';
import { Invoice } from '../types';
import { documentNumberingService } from './documentNumberingService';
import { toast } from 'react-hot-toast';

class InvoiceService {
  private readonly TABLE_NAME = 'invoices';

  private mapDatabaseToInvoice(row: any): Invoice {
    return {
      id: row.id,
      number: row.number,
      orderId: row.woocommerce_order_id,
      date: row.date,
      dueDate: row.due_date,
      status: row.status,
      customer: row.customer_info,
      items: row.line_items,
      subtotal: parseFloat(row.subtotal || '0'),
      tax: parseFloat(row.tax_amount || '0'),
      taxRate: parseFloat(row.tax_rate || '20'),
      total: parseFloat(row.total || '0'),
      currency: row.currency || 'MAD',
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
        .maybeSingle();

      if (error) {
        console.error('Error getting invoice by order ID:', error);
        return null;
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
      if (!invoice.id || !invoice.number) {
        try {
          invoice.number = await this.generateInvoiceNumber(invoice.orderId);
        } catch (error) {
          console.error('Error generating invoice number:', error);
          throw error;
        }
      }

      const invoiceData = this.mapInvoiceToDatabase(invoice);

      if (!invoice.id) {
        invoiceData.id = crypto.randomUUID();
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

      if (invoice.woocommerce_order_id && invoice.woocommerce_order_id > 0) {
        throw new Error(
          'Cette facture est liée à une commande WooCommerce (#' +
          invoice.woocommerce_order_id +
          '). Pour des raisons de cohérence des données, elle ne peut pas être supprimée. ' +
          'Vous pouvez la marquer comme "annulée" à la place.'
        );
      }

      const { error: deleteError } = await supabase
        .from(this.TABLE_NAME)
        .delete()
        .eq('id', invoiceId);

      if (deleteError) {
        console.error('Error deleting invoice:', deleteError);
        throw deleteError;
      }

      if (invoice.number) {
        try {
          await documentNumberingService.deleteNumber(invoice.number);
        } catch (error) {
          toast.error('Erreur lors de la suppression du numéro de document');
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
      const invoice = await this.getInvoiceById(invoiceId);
      if (!invoice) {
        throw new Error('Invoice not found');
      }

      const updatedInvoice: Invoice = {
        ...invoice,
        status: 'cancelled',
        notes: (invoice.notes ? invoice.notes + '\n' : '') +
          `Facture annulée le ${new Date().toLocaleDateString()}`
      };

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

  async convertToDeliveryNote(invoiceId: string): Promise<any> {
    try {
      const invoice = await this.getInvoiceById(invoiceId);
      if (!invoice) {
        throw new Error('Invoice not found');
      }

      if (invoice.status === 'cancelled') {
        throw new Error('Cannot create delivery note for cancelled invoice');
      }

      // Convert invoice items to delivery note items
      const deliveryItems = invoice.items.map(item => ({
        id: crypto.randomUUID(),
        productId: item.productId,
        sku: item.sku || `ITEM-${Date.now()}`,
        description: item.description,
        quantity: item.quantity,
        delivered: 0, // Not yet delivered
        unitPrice: item.unitPrice,
        total: item.total
      }));

      const deliveryNoteData = {
        id: crypto.randomUUID(),
        number: '', // Will be generated by delivery note service
        invoice_id: invoice.id,
        customer_id: invoice.customerId,
        customer_data: invoice.customer,
        date: new Date().toISOString().split('T')[0],
        estimated_delivery_date: null,
        actual_delivery_date: null,
        status: 'draft' as const,
        items: deliveryItems,
        notes: `Bon de livraison généré à partir de la facture ${invoice.number}`
      };

      return deliveryNoteData;
    } catch (error) {
      console.error('Error converting invoice to delivery note:', error);
      throw error;
    }
  }

  async convertToReturnNote(invoiceId: string, returnReason?: string): Promise<any> {
    try {
      const invoice = await this.getInvoiceById(invoiceId);
      if (!invoice) {
        throw new Error('Invoice not found');
      }

      if (invoice.status !== 'paid') {
        throw new Error('Only paid invoices can have return notes created');
      }

      // Convert invoice items to return note items
      const returnItems = invoice.items.map(item => ({
        id: crypto.randomUUID(),
        productId: item.productId,
        description: item.description,
        quantity: item.quantity,
        condition: 'new' as const,
        reason: returnReason || 'Customer return',
        refundAmount: item.total
      }));

      const returnNoteData = {
        id: crypto.randomUUID(),
        number: '', // Will be generated by return note service
        invoice_id: invoice.id,
        customer_id: invoice.customerId,
        customer_data: {
          name: invoice.customer.name,
          email: invoice.customer.email,
          company: invoice.customer.company
        },
        date: new Date().toISOString().split('T')[0],
        status: 'draft' as const,
        items: returnItems,
        reason: returnReason || 'Customer return',
        notes: `Bon de retour généré à partir de la facture ${invoice.number}`
      };

      return returnNoteData;
    } catch (error) {
      console.error('Error converting invoice to return note:', error);
      throw error;
    }
  }
}

export const invoiceService = new InvoiceService();
