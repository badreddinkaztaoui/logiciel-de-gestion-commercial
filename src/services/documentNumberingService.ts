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

  private async ensureAuthenticated(): Promise<void> {
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) {
      throw new Error('User must be authenticated to perform this operation');
    }
  }

  /**
   * Completely reset the document_numbers table structure
   * This will drop and recreate the table, effectively resetting all numbering
   */
  async resetTableStructure(): Promise<void> {
    try {
      await this.ensureAuthenticated();

      // Drop the existing table
      const { error: dropError } = await supabase.rpc('drop_document_numbers_table');
      if (dropError) {
        console.error('Error dropping document_numbers table:', dropError);
        throw new Error('Failed to drop document_numbers table');
      }

      // Create the table again
      const { error: createError } = await supabase.rpc('create_document_numbers_table');
      if (createError) {
        console.error('Error creating document_numbers table:', createError);
        throw new Error('Failed to create document_numbers table');
      }

      console.log('Document numbers table has been completely reset');
    } catch (error) {
      console.error('Error in resetTableStructure:', error);
      throw error;
    }
  }

  async initialize() {
    // Create the document_numbers table if it doesn't exist
    const { error } = await supabase.rpc('create_document_numbers_table');
    if (error) {
      console.error('Error creating document_numbers table:', error);
    }
  }

  /**
   * Reset document numbering for a specific document type to start fresh
   * This will delete existing document numbers for that type and allow starting from sequence 1
   */
  async resetNumbering(documentType: 'INVOICE' | 'SALES_JOURNAL'): Promise<void> {
    try {
      await this.ensureAuthenticated();

      // Delete records for the specific document type
      const { error } = await supabase
        .from(this.TABLE_NAME)
        .delete()
        .eq('document_type', documentType);

      if (error) {
        console.error('Error resetting document numbers:', error);
        throw new Error('Failed to reset document numbering');
      }

      console.log(`Document numbering has been reset successfully for ${documentType}`);
    } catch (error) {
      console.error('Error in resetNumbering:', error);
      throw error;
    }
  }

  private async getLastNumber(documentType: 'INVOICE' | 'SALES_JOURNAL', year: number): Promise<number> {
    await this.ensureAuthenticated();

    const { data, error } = await supabase
      .from(this.TABLE_NAME)
      .select('sequence')
      .eq('document_type', documentType)
      .eq('year', year)
      .order('sequence', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error('Error getting last number:', error);
      return 0;
    }

    return data?.sequence || 0;
  }

  async generateNumber(
    documentType: 'INVOICE' | 'SALES_JOURNAL',
    orderId?: number,
    journalId?: string
  ): Promise<string> {
    await this.ensureAuthenticated();
    const year = new Date().getFullYear();

    // Get the last sequence number for this year
    const lastSequence = await this.getLastNumber(documentType, year);
    const nextSequence = lastSequence + 1;

    // Format: F G{YEAR}{SEQUENCE} for sales journal, F A{YEAR}{SEQUENCE} for invoice
    const formattedNumber = documentType === 'SALES_JOURNAL'
      ? `F G${year}${nextSequence.toString().padStart(4, '0')}`
      : `F A${year}${nextSequence.toString().padStart(4, '0')}`;

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
      .insert([{
        id: documentNumber.id,
        document_type: documentNumber.documentType,
        number: documentNumber.number,
        year: documentNumber.year,
        sequence: documentNumber.sequence,
        created_at: documentNumber.createdAt,
        order_id: documentNumber.orderId,
        journal_id: documentNumber.journalId
      }])
      .select()
      .single();

    if (error) {
      console.error('Error generating number:', error);
      throw error;
    }

    return formattedNumber;
  }

  async getNumberByOrderId(orderId: number): Promise<string | null> {
    await this.ensureAuthenticated();

    const { data, error } = await supabase
      .from(this.TABLE_NAME)
      .select('number')
      .eq('order_id', orderId)
      .maybeSingle();

    if (error) {
      console.error('Error getting number by order ID:', error);
      return null;
    }

    return data?.number || null;
  }

  async getNumberByJournalId(journalId: string): Promise<string | null> {
    await this.ensureAuthenticated();

    const { data, error } = await supabase
      .from(this.TABLE_NAME)
      .select('number')
      .eq('journal_id', journalId)
      .maybeSingle();

    if (error) {
      console.error('Error getting number by journal ID:', error);
      return null;
    }

    return data?.number || null;
  }

  async validateNumber(number: string): Promise<boolean> {
    await this.ensureAuthenticated();

    const { data, error } = await supabase
      .from(this.TABLE_NAME)
      .select('id')
      .eq('number', number)
      .maybeSingle();

    if (error) {
      console.error('Error validating number:', error);
      return false;
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

    // Format: F G{YEAR}{SEQUENCE} for sales journal, F A{YEAR}{SEQUENCE} for invoice
    return documentType === 'SALES_JOURNAL'
      ? `F G${year}${nextSequence.toString().padStart(4, '0')}`
      : `F A${year}${nextSequence.toString().padStart(4, '0')}`;
  }

  /**
   * Clean up stale reservations
   * This is useful for cleaning up unconfirmed reservations that may have been abandoned
   */
  async cleanupStaleReservations(): Promise<void> {
    try {
      await this.ensureAuthenticated();

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