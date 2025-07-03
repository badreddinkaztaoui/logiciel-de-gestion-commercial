import { supabase } from '../lib/supabase';

interface DocumentNumber {
  id: string;
  documentType: 'INVOICE' | 'SALES_JOURNAL';
  number: string;
  year: number;
  sequence: number;
  createdAt: string;
  orderId?: number;
  journalId?: string;
}

/**
 * Service for managing document number sequences
 * This ensures sequential, non-duplicated document numbers with proper tracking
 */
class DocumentNumberingService {
  private readonly TABLE_NAME = 'document_numbers';

  async initialize() {
    // Create the document_numbers table if it doesn't exist
    const { error } = await supabase.rpc('create_document_numbers_table');
    if (error) {
      console.error('Error creating document_numbers table:', error);
    }
  }

  private async getLastNumber(documentType: 'INVOICE' | 'SALES_JOURNAL', year: number): Promise<number> {
    const { data, error } = await supabase
      .from(this.TABLE_NAME)
      .select('sequence')
      .eq('document_type', documentType)
      .eq('year', year)
      .order('sequence', { ascending: false })
      .limit(1)
      .single();

    if (error) {
      if (error.code === 'PGRST116') { // No rows found
        return 0;
      }
      throw error;
    }

    return data?.sequence || 0;
  }

  async generateNumber(
    documentType: 'INVOICE' | 'SALES_JOURNAL',
    orderId?: number,
    journalId?: string
  ): Promise<string> {
    const year = new Date().getFullYear();

    // Get the last sequence number for this year
    const lastSequence = await this.getLastNumber(documentType, year);
    const nextSequence = lastSequence + 1;

    // Format: F G{YEAR}{SEQUENCE}
    const formattedNumber = `F G${year}${nextSequence.toString().padStart(4, '0')}`;

    // Save the new number
    const documentNumber: DocumentNumber = {
      id: crypto.randomUUID(),
      documentType,
      number: formattedNumber,
      year,
      sequence: nextSequence,
      createdAt: new Date().toISOString(),
      orderId,
      journalId
    };

    const { error } = await supabase
      .from(this.TABLE_NAME)
      .insert({
        id: documentNumber.id,
        document_type: documentNumber.documentType,
        number: documentNumber.number,
        year: documentNumber.year,
        sequence: documentNumber.sequence,
        created_at: documentNumber.createdAt,
        order_id: documentNumber.orderId,
        journal_id: documentNumber.journalId
      });

    if (error) {
      throw error;
    }

    return formattedNumber;
  }

  async getNumberByOrderId(orderId: number): Promise<string | null> {
    const { data, error } = await supabase
      .from(this.TABLE_NAME)
      .select('number')
      .eq('orderId', orderId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      throw error;
    }

    return data?.number || null;
  }

  async getNumberByJournalId(journalId: string): Promise<string | null> {
    const { data, error } = await supabase
      .from(this.TABLE_NAME)
      .select('number')
      .eq('journalId', journalId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      throw error;
    }

    return data?.number || null;
  }

  async validateNumber(number: string): Promise<boolean> {
    const { data, error } = await supabase
      .from(this.TABLE_NAME)
      .select('id')
      .eq('number', number)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return false;
      }
      throw error;
    }

    return !!data;
  }

  async generatePreviewNumber(
    documentType: 'INVOICE' | 'SALES_JOURNAL'
  ): Promise<string> {
    const year = new Date().getFullYear();

    // Get the last sequence number for this year
    const lastSequence = await this.getLastNumber(documentType, year);
    const nextSequence = lastSequence + 1;

    // Format: F G{YEAR}{SEQUENCE}
    return `F G${year}${nextSequence.toString().padStart(4, '0')}`;
  }

  /**
   * Clean up stale reservations
   * This is useful for cleaning up unconfirmed reservations that may have been abandoned
   */
  async cleanupStaleReservations(): Promise<void> {
    try {
      // Delete reservations older than 24 hours that haven't been confirmed
      const { data, error } = await supabase.rpc('cleanup_stale_reservations', {
        p_hours_threshold: 24
      });

      if (error) {
        console.error('Error cleaning up stale reservations:', error);
      } else {
        console.log(`Cleaned up ${data} stale document number reservations`);
      }
    } catch (error) {
      console.error('Error in cleanupStaleReservations:', error);
    }
  }
}

export const documentNumberingService = new DocumentNumberingService();