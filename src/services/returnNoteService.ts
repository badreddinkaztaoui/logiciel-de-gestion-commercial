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

      // Generate number if not provided (for new notes)
      if (!returnNote.number) {
        try {
          returnNote.number = await documentNumberingService.generateNumber('RETURN');
        } catch (error) {
          console.error('Error generating return note number:', error);
          // Enhanced fallback number generation with microsecond precision and random
          const now = new Date();
          const timestamp = now.getTime().toString(); // Full timestamp with milliseconds
          const microseconds = (performance.now() % 1000).toFixed(0).padStart(3, '0');
          const random = Math.floor(Math.random() * 100000).toString().padStart(5, '0');
          returnNote.number = `BR-${timestamp}-${microseconds}-${random}`;
        }
      }

      // Ensure we have a unique ID
      const id = returnNote.id || crypto.randomUUID();

      const insertData = {
        ...returnNote,
        id,
        status: returnNote.status || 'draft',
        created_at: returnNote.created_at || new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      const { data, error } = await supabase
        .from(this.TABLE_NAME)
        .insert([insertData])
        .select()
        .single();

      if (error) {
        console.error('Error creating return note:', error);

        // Provide more specific error messages
        if (error.code === '23505') {
          if (error.message.includes('return_notes_number_key')) {
            throw new Error('Un bon de retour avec ce numéro existe déjà. Veuillez réessayer.');
          } else if (error.message.includes('return_notes_pkey')) {
            throw new Error('Un bon de retour avec cet identifiant existe déjà. Veuillez réessayer.');
          } else {
            throw new Error('Cette donnée existe déjà dans le système. Veuillez réessayer.');
          }
        }

        throw error;
      }

      return this.mapDatabaseToReturnNote(data);
    } catch (error) {
      console.error('Error creating return note:', error);
      throw error;
    }
  }

  async createFromInvoice(invoiceId: string, returnReason?: string): Promise<ReturnNote> {
    try {
      // Import invoice service to get the conversion data
      const { invoiceService } = await import('./invoiceService');
      const returnNoteData = await invoiceService.convertToReturnNote(invoiceId, returnReason);

      return await this.createReturnNote(returnNoteData);
    } catch (error) {
      console.error('Error creating return note from invoice:', error);
      throw error;
    }
  }

  async createFromDeliveryNote(deliveryNoteId: string, returnReason?: string): Promise<ReturnNote> {
    try {
      // Import delivery note service to get the delivery data
      const { deliveryNoteService } = await import('./deliveryNoteService');
      const deliveryNote = await deliveryNoteService.getDeliveryNote(deliveryNoteId);

      if (!deliveryNote) {
        throw new Error('Delivery note not found');
      }

      if (deliveryNote.status !== 'delivered') {
        throw new Error('Only delivered items can be returned');
      }

      // Convert delivery note items to return note items
      const returnItems = deliveryNote.items.map((item: any) => ({
        id: crypto.randomUUID(),
        productId: item.productId,
        description: item.description,
        quantity: item.delivered || item.quantity,
        condition: 'new' as const,
        reason: returnReason || 'Customer return',
        refundAmount: item.total || 0
      }));

      const returnNoteData = {
        id: crypto.randomUUID(),
        delivery_note_id: deliveryNote.id,
        invoice_id: deliveryNote.invoice_id,
        customer_id: deliveryNote.customer_id,
        customer_data: deliveryNote.customer_data,
        date: new Date().toISOString().split('T')[0],
        status: 'draft' as const,
        items: returnItems,
        reason: returnReason || 'Customer return',
        notes: `Bon de retour généré à partir du bon de livraison ${deliveryNote.number}`
      };

      return await this.createReturnNote(returnNoteData);
    } catch (error) {
      console.error('Error creating return note from delivery note:', error);
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
      if (!returnNote) {
        throw new Error('Return note not found');
      }

      // Update WooCommerce stock for returned products
      await this.updateWooCommerceStock(returnNote);

      // Process WooCommerce refund if applicable
      await this.processWooCommerceRefund(returnNote);

      // Update return note status
      await this.updateReturnNote(id, {
        status: 'processed'
      });
    } catch (error) {
      console.error('Error processing return note:', error);
      throw error;
    }
  }

  private async updateWooCommerceStock(returnNote: ReturnNote): Promise<void> {
    try {
      // Import WooCommerce service dynamically to avoid circular dependencies
      const { wooCommerceService } = await import('./woocommerce');

      if (!returnNote.items || returnNote.items.length === 0) {
        return;
      }

      const stockUpdateResults = [];

      for (const item of returnNote.items) {
        // Only update stock for products that are in good condition
        if (item.productId && (item.condition === 'new' || item.condition === 'used')) {
          try {
            console.log(`Updating stock for product ${item.productId}: +${item.quantity}`);
            const result = await wooCommerceService.increaseProductStock(item.productId, item.quantity);
            stockUpdateResults.push({
              productId: item.productId,
              quantity: item.quantity,
              newStock: result.stock_quantity,
              success: true
            });
          } catch (error) {
            console.error(`Error updating stock for product ${item.productId}:`, error);
            stockUpdateResults.push({
              productId: item.productId,
              quantity: item.quantity,
              success: false,
              error: error instanceof Error ? error.message : 'Unknown error'
            });
          }
        }
      }

      console.log('Stock update results:', stockUpdateResults);
    } catch (error) {
      console.error('Error updating WooCommerce stock:', error);
      // Don't throw here - stock update failure shouldn't prevent return processing
    }
  }

  private async processWooCommerceRefund(returnNote: ReturnNote): Promise<void> {
    try {
      // Import services dynamically to avoid circular dependencies
      const { wooCommerceService } = await import('./woocommerce');

      // Only process refund if there's a linked invoice and items with refund amounts
      if (!returnNote.invoice_id || !returnNote.items || returnNote.items.length === 0) {
        return;
      }

      // Get the original order ID from the invoice
      const { invoiceService } = await import('./invoiceService');
      const invoice = await invoiceService.getInvoiceById(returnNote.invoice_id);

      if (!invoice || !invoice.orderId) {
        console.log('No WooCommerce order found for this return note');
        return;
      }

      // Calculate total refund amount
      const totalRefundAmount = returnNote.items.reduce((sum, item) => sum + (item.refundAmount || 0), 0);

      if (totalRefundAmount <= 0) {
        console.log('No refund amount specified for return note');
        return;
      }

      // Process the return in WooCommerce
      const refundResult = await wooCommerceService.processReturn(
        invoice.orderId,
        returnNote.items,
        totalRefundAmount,
        returnNote.reason || 'Product return',
        false // Don't update order status to refunded automatically
      );

      console.log('WooCommerce refund processed:', refundResult);
    } catch (error) {
      console.error('Error processing WooCommerce refund:', error);
      // Don't throw here - refund failure shouldn't prevent return processing
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

  async getReturnNoteStats() {
    try {
      const returnNotes = await this.getReturnNotes();

      return {
        total: returnNotes.length,
        draft: returnNotes.filter(r => r.status === 'draft').length,
        processed: returnNotes.filter(r => r.status === 'processed').length,
        cancelled: returnNotes.filter(r => r.status === 'cancelled').length,
        totalItems: returnNotes.reduce((sum, r) => sum + (r.items?.length || 0), 0),
        totalRefundValue: returnNotes
          .filter(r => r.status === 'processed')
          .reduce((sum, r) => sum + (r.items?.reduce((itemSum, item) => itemSum + (item.refundAmount || 0), 0) || 0), 0),
        pendingReturns: returnNotes.filter(r => r.status === 'draft').length
      };
    } catch (error) {
      console.error('Error getting return note stats:', error);
      return {
        total: 0,
        draft: 0,
        processed: 0,
        cancelled: 0,
        totalItems: 0,
        totalRefundValue: 0,
        pendingReturns: 0
      };
    }
  }
}

export const returnNoteService = new ReturnNoteService();