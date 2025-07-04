import { supabase } from '../lib/supabase';
import { settingsService } from './settingsService';

export type DocumentType = 'INVOICE' | 'SALES_JOURNAL' | 'QUOTE' | 'DELIVERY' | 'RETURN' | 'PURCHASE_ORDER';

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

const getPrefix = (type: DocumentType) => {
  switch (type) {
    case 'QUOTE':
      return 'F D';
    case 'DELIVERY':
      return 'F L';
    case 'RETURN':
      return 'F R';
    case 'PURCHASE_ORDER':
      return 'F PO';
    case 'INVOICE':
      return 'F A';
    case 'SALES_JOURNAL':
      return 'F G';
    default:
      return '';
  }
}

class DocumentNumberingService {
  private readonly TABLE_NAME = 'document_numbers';

  private formatNumber(type: DocumentType, year: number, sequence: number): string {
    const sequencePadded = sequence.toString().padStart(4, '0');
    const prefix = getPrefix(type);
    return `${prefix} ${year}${sequencePadded}`;
  }

  private async getCurrentSequenceInfo(type: DocumentType, year: number): Promise<SequenceInfo> {
    try {
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

  async resetNumbering(type: DocumentType, year?: number): Promise<void> {
    try {
      const targetYear = year || new Date().getFullYear();

      const { error } = await supabase
        .from(this.TABLE_NAME)
        .delete()
        .eq('document_type', type)
        .eq('year', targetYear);

      if (error) {
        console.error('Error resetting document numbers:', error);
        throw new Error('Failed to reset document numbering');
      }

      const settings = await settingsService.getNumberingSettings();
      const startNumber = settings[type].startNumber;

      await this.reserveNumber(type, targetYear, startNumber);

      await this.updateSettingsCurrentNumber(type, startNumber);

      console.log(`Document numbering reset successfully for ${type} (${targetYear})`);
    } catch (error) {
      console.error('Error in resetNumbering:', error);
      throw error;
    }
  }

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

  async generateNumber(type: DocumentType, orderId?: number, journalId?: string): Promise<string> {
    try {
      const year = new Date().getFullYear();
      const { currentSequence, formattedNumber } = await this.getCurrentSequenceInfo(type, year);

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

      await this.updateSettingsCurrentNumber(type, currentSequence);

      return formattedNumber;
    } catch (error) {
      console.error('Error in generateNumber:', error);
      throw error;
    }
  }

  async generatePreviewNumber(type: DocumentType, year?: number): Promise<string> {
    const targetYear = year || new Date().getFullYear();
    const { nextFormattedNumber } = await this.getCurrentSequenceInfo(type, targetYear);
    return nextFormattedNumber;
  }

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

  async cleanupStaleReservations(): Promise<void> {
    try {
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