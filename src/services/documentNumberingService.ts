import { supabase } from '../lib/supabase';
import { settingsService } from './settingsService';

export type DocumentType = 'INVOICE' | 'SALES_JOURNAL';

interface DocumentNumber {
  id: string;
  documentType: DocumentType;
  number: string;
  year: number;
  sequence: number;
  createdAt: string;
  orderId?: number;
  journalId?: string;
}

interface SequenceInfo {
  currentSequence: number;
  nextSequence: number;
  formattedNumber: string;
  nextFormattedNumber: string;
}

/**
 * Service for managing document number sequences
 * This ensures sequential, non-duplicated document numbers with proper tracking
 */
class DocumentNumberingService {
  private readonly TABLE_NAME = 'document_numbers';

  /**
   * Format a document number based on its type and sequence
   */
  private formatNumber(type: DocumentType, year: number, sequence: number): string {
    const sequencePadded = sequence.toString().padStart(4, '0');
    const prefix = type === 'SALES_JOURNAL' ? 'G' : 'A';
    return `F ${prefix}${year}${sequencePadded}`;
  }

  /**
   * Get the current sequence information for a document type
   */
  private async getCurrentSequenceInfo(type: DocumentType, year: number): Promise<SequenceInfo> {
    try {
      // Get settings and last used sequence
      const [settings, lastSequence] = await Promise.all([
        settingsService.getNumberingSettings(),
        this.getLastNumber(type, year)
      ]);

      const docSettings = settings[type];
      const currentSequence = Math.max(docSettings.startNumber, lastSequence + 1);
      const nextSequence = currentSequence;

      return {
        currentSequence,
        nextSequence,
        formattedNumber: this.formatNumber(type, year, currentSequence),
        nextFormattedNumber: this.formatNumber(type, year, nextSequence)
      };
    } catch (error) {
      console.error('Error getting sequence info:', error);
      throw error;
    }
  }

  /**
   * Update the current number in settings after generating a new number
   */
  private async updateSettingsCurrentNumber(type: DocumentType, sequence: number): Promise<void> {
    try {
      const settings = await settingsService.getNumberingSettings();
      const updatedSettings = {
        ...settings,
        [type]: {
          ...settings[type],
          currentNumber: sequence + 1 // Store the next number instead of current
        }
      };
      await settingsService.updateNumberingSettings(updatedSettings);
    } catch (error) {
      console.error('Error updating settings current number:', error);
      // Don't throw error as this is a non-critical operation
    }
  }

  /**
   * Get the last used sequence number for a document type in a specific year
   */
  private async getLastNumber(type: DocumentType, year: number): Promise<number> {
    const { data, error } = await supabase
      .from(this.TABLE_NAME)
      .select('sequence')
      .eq('document_type', type)
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

  /**
   * Reset numbering for a specific document type and year
   */
  async resetNumbering(type: DocumentType, year?: number): Promise<void> {
    try {
      const targetYear = year || new Date().getFullYear();

      // Delete records for the specific document type and year
      const { error } = await supabase
        .from(this.TABLE_NAME)
        .delete()
        .eq('document_type', type)
        .eq('year', targetYear);

      if (error) {
        console.error('Error resetting document numbers:', error);
        throw new Error('Failed to reset document numbering');
      }

      // Get settings to ensure we're starting from the correct number
      const settings = await settingsService.getNumberingSettings();
      const startNumber = settings[type].startNumber;

      // Create first sequence with start number
      await this.reserveNumber(type, targetYear, startNumber);

      // Update settings with the next number
      await this.updateSettingsCurrentNumber(type, startNumber);

      console.log(`Document numbering reset successfully for ${type} (${targetYear})`);
    } catch (error) {
      console.error('Error in resetNumbering:', error);
      throw error;
    }
  }

  /**
   * Reserve a specific sequence number
   */
  private async reserveNumber(type: DocumentType, year: number, sequence: number): Promise<string> {
    const formattedNumber = this.formatNumber(type, year, sequence);

    const documentNumber: DocumentNumber = {
      id: crypto.randomUUID(),
      documentType: type,
      number: formattedNumber,
      year,
      sequence,
      createdAt: new Date().toISOString()
    };

    const { error } = await supabase
      .from(this.TABLE_NAME)
      .insert([{
        id: documentNumber.id,
        document_type: documentNumber.documentType,
        number: documentNumber.number,
        year: documentNumber.year,
        sequence: documentNumber.sequence,
        created_at: documentNumber.createdAt
      }])
      .select()
      .single();

    if (error) {
      console.error('Error reserving number:', error);
      throw error;
    }

    return formattedNumber;
  }

  /**
   * Generate a new document number and save it
   */
  async generateNumber(type: DocumentType, orderId?: number, journalId?: string): Promise<string> {
    try {
      const year = new Date().getFullYear();
      const { currentSequence, formattedNumber } = await this.getCurrentSequenceInfo(type, year);

      // Save the new number with references
      const documentNumber: DocumentNumber = {
        id: crypto.randomUUID(),
        documentType: type,
        number: formattedNumber,
        year,
        sequence: currentSequence,
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

      // Update the current number in settings to show the next number
      await this.updateSettingsCurrentNumber(type, currentSequence);

      return formattedNumber;
    } catch (error) {
      console.error('Error in generateNumber:', error);
      throw error;
    }
  }

  /**
   * Preview the next number without saving it
   */
  async generatePreviewNumber(type: DocumentType, year?: number): Promise<string> {
    const targetYear = year || new Date().getFullYear();
    const { nextFormattedNumber } = await this.getCurrentSequenceInfo(type, targetYear);
    return nextFormattedNumber;
  }

  /**
   * Get a document number by order ID
   */
  async getNumberByOrderId(orderId: number): Promise<string | null> {
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

  /**
   * Get a document number by journal ID
   */
  async getNumberByJournalId(journalId: string): Promise<string | null> {
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

  /**
   * Validate if a number exists
   */
  async validateNumber(number: string): Promise<boolean> {
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

  /**
   * Delete a specific document number
   */
  async deleteNumber(number: string): Promise<void> {
    const { error } = await supabase
      .from(this.TABLE_NAME)
      .delete()
      .eq('number', number);

    if (error) {
      console.error('Error deleting document number:', error);
      throw error;
    }
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