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
      const settingsSequence = docSettings.currentNumber;
      const dbSequence = lastSequence + 1;
      const startNumber = docSettings.startNumber;

      // Use the same logic as getNextSequenceAtomic
      const nextSequence = Math.max(settingsSequence, dbSequence, startNumber);

      return {
        currentSequence: nextSequence,
        nextSequence,
        formattedNumber: this.formatNumber(type, year, nextSequence),
        nextFormattedNumber: this.formatNumber(type, year, nextSequence)
      };
    } catch (error) {
      console.error('Error getting sequence info:', error);
      throw error;
    }
  }

  private async updateSettingsCurrentNumber(type: DocumentType, sequence: number, isReset: boolean = false): Promise<void> {
    try {
      const settings = await settingsService.getNumberingSettings();
      const startNumber = settings[type].startNumber;

      let newCurrentNumber: number;
      if (isReset) {
        // During reset, set current number to exactly the start number
        newCurrentNumber = startNumber;
      } else {
        // During normal operation, set current number to next available number
        newCurrentNumber = Math.max(sequence + 1, startNumber);
      }

      const updatedSettings = {
        ...settings,
        [type]: {
          ...settings[type],
          currentNumber: newCurrentNumber
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

      // Get the start number from settings
      const settings = await settingsService.getNumberingSettings();
      const startNumber = settings[type].startNumber;

      console.log(`Resetting numbering for ${type} (${targetYear}) to start from ${startNumber}`);

      // Delete all existing records for this type and year
      const { error: deleteError } = await supabase
        .from(this.TABLE_NAME)
        .delete()
        .eq('document_type', type)
        .eq('year', targetYear);

      if (deleteError) {
        console.error('Error deleting existing document numbers:', deleteError);
        throw new Error('Failed to clear existing document numbers');
      }

      // Small delay to ensure delete operation completes
      await new Promise(resolve => setTimeout(resolve, 100));

      // Update settings to reflect the reset - set current number to start number
      // This ensures the first document created will get the start number
      await this.updateSettingsCurrentNumber(type, startNumber, true);

      console.log(`Document numbering reset completed for ${type} (${targetYear}). Next document will use ${startNumber}`);
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
    const maxRetries = 5;
    let retryCount = 0;

    while (retryCount < maxRetries) {
      try {
        return await this.generateNumberWithRetry(type, orderId, journalId);
      } catch (error: any) {
        // Check if this is a duplicate key error
        if (error?.code === '23505' && error?.message?.includes('document_numbers_document_type_year_sequence_key')) {
          retryCount++;
          if (retryCount >= maxRetries) {
            console.error(`Max retries exceeded for generating ${type} number`);
            throw new Error(`Failed to generate document number after ${maxRetries} attempts`);
          }

          // Wait with exponential backoff
          const delay = Math.min(100 * Math.pow(2, retryCount), 2000);
          await new Promise(resolve => setTimeout(resolve, delay));
          console.log(`Retrying document number generation for ${type} (attempt ${retryCount + 1})`);
          continue;
        }

        // If it's not a duplicate key error, throw it
        console.error('Error in generateNumber:', error);
        throw error;
      }
    }

    throw new Error(`Failed to generate document number after ${maxRetries} attempts`);
  }

  private async generateNumberWithRetry(type: DocumentType, orderId?: number, journalId?: string): Promise<string> {
    try {
      const year = new Date().getFullYear();

      // Use a more robust sequence generation approach
      const sequence = await this.getNextSequenceAtomic(type, year);
      const formattedNumber = this.formatNumber(type, year, sequence);

      const documentNumber: DocumentNumber = {
        id: crypto.randomUUID(),
        documentType: type,
        number: formattedNumber,
        year,
        sequence,
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
        throw error;
      }

      // Update settings after successful insertion
      await this.updateSettingsCurrentNumber(type, sequence);

      return formattedNumber;
    } catch (error) {
      throw error;
    }
  }

  private async getNextSequenceAtomic(type: DocumentType, year: number): Promise<number> {
    try {
      // First, try to get the settings-based sequence
      const [settings, lastSequence] = await Promise.all([
        settingsService.getNumberingSettings(),
        this.getLastNumber(type, year)
      ]);

      const docSettings = settings[type];
      const settingsSequence = docSettings.currentNumber;
      const dbSequence = lastSequence + 1;
      const startNumber = docSettings.startNumber;

      // Use the maximum of all sequences, but ensure it's at least the start number
      const nextSequence = Math.max(settingsSequence, dbSequence, startNumber);

      return nextSequence;
    } catch (error) {
      console.error('Error getting next sequence:', error);
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

  async validateNumberingSystem(): Promise<void> {
    try {
      console.log('Validating document numbering system...');
      const documentTypes: DocumentType[] = ['QUOTE', 'INVOICE', 'SALES_JOURNAL', 'DELIVERY', 'RETURN', 'PURCHASE_ORDER'];

      for (const type of documentTypes) {
        const settings = await settingsService.getNumberingSettings();
        const docSettings = settings[type];
        const year = new Date().getFullYear();

        // Check if current number is less than start number
        if (docSettings.currentNumber < docSettings.startNumber) {
          console.log(`Fixing ${type}: current number (${docSettings.currentNumber}) < start number (${docSettings.startNumber})`);
          // Reset to start number using the same logic as resetNumbering
          await this.updateSettingsCurrentNumber(type, docSettings.startNumber, true);
        }

        // Get the next number to ensure it's valid
        const nextNumber = await this.generatePreviewNumber(type, year);
        console.log(`${type}: Next number will be ${nextNumber}`);
      }

      console.log('Document numbering system validation completed successfully');
    } catch (error) {
      console.error('Error validating numbering system:', error);
      throw error;
    }
  }

  async getNumberingStatus(): Promise<{[key in DocumentType]: {
    startNumber: number;
    currentNumber: number;
    nextNumber: string;
    lastUsedNumber: number;
  }}> {
    try {
      const settings = await settingsService.getNumberingSettings();
      const year = new Date().getFullYear();
      const status = {} as any;

      const documentTypes: DocumentType[] = ['QUOTE', 'INVOICE', 'SALES_JOURNAL', 'DELIVERY', 'RETURN', 'PURCHASE_ORDER'];

      for (const type of documentTypes) {
        const docSettings = settings[type];
        const lastUsedNumber = await this.getLastNumber(type, year);
        const nextNumber = await this.generatePreviewNumber(type, year);

        status[type] = {
          startNumber: docSettings.startNumber,
          currentNumber: docSettings.currentNumber,
          nextNumber,
          lastUsedNumber
        };
      }

      return status;
    } catch (error) {
      console.error('Error getting numbering status:', error);
      throw error;
    }
  }

  async checkDatabaseConnectivity(): Promise<{
    canRead: boolean;
    canWrite: boolean;
    canDelete: boolean;
    error?: string;
  }> {
    try {
      // Test read permissions
      const { error: readError } = await supabase
        .from(this.TABLE_NAME)
        .select('count', { count: 'exact', head: true });

      const canRead = !readError;

      // Test write permissions with a test record
      const testRecord = {
        id: crypto.randomUUID(),
        document_type: 'QUOTE' as DocumentType,
        number: 'TEST-CONNECTION',
        year: 9999, // Use a year that won't conflict
        sequence: 999999,
        created_at: new Date().toISOString()
      };

      const { error: writeError } = await supabase
        .from(this.TABLE_NAME)
        .insert([testRecord]);

      const canWrite = !writeError;

      // Test delete permissions (clean up test record)
      let canDelete = false;
      if (canWrite) {
        const { error: deleteError } = await supabase
          .from(this.TABLE_NAME)
          .delete()
          .eq('id', testRecord.id);

        canDelete = !deleteError;
      }

      return {
        canRead,
        canWrite,
        canDelete,
        error: readError?.message || writeError?.message
      };
    } catch (error) {
      return {
        canRead: false,
        canWrite: false,
        canDelete: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  async diagnoseProblem(): Promise<string[]> {
    const issues: string[] = [];

    try {
      // Check database connectivity
      const dbCheck = await this.checkDatabaseConnectivity();

      if (!dbCheck.canRead) {
        issues.push(`❌ Impossible de lire la table ${this.TABLE_NAME}: ${dbCheck.error}`);
      }

      if (!dbCheck.canWrite) {
        issues.push(`❌ Impossible d'écrire dans la table ${this.TABLE_NAME}: ${dbCheck.error}`);
      }

      if (!dbCheck.canDelete) {
        issues.push(`❌ Impossible de supprimer de la table ${this.TABLE_NAME}`);
      }

      // Check settings
      try {
        const settings = await settingsService.getNumberingSettings();
        if (!settings) {
          issues.push('❌ Impossible de charger les paramètres de numérotation');
        }
      } catch (error) {
        issues.push(`❌ Erreur lors du chargement des paramètres: ${error instanceof Error ? error.message : 'Erreur inconnue'}`);
      }

      // Check for data consistency
      const documentTypes: DocumentType[] = ['QUOTE', 'INVOICE', 'SALES_JOURNAL', 'DELIVERY', 'RETURN', 'PURCHASE_ORDER'];
      for (const type of documentTypes) {
        try {
          const settings = await settingsService.getNumberingSettings();
          const docSettings = settings[type];

          if (docSettings.currentNumber < docSettings.startNumber) {
            issues.push(`⚠️ ${type}: Le numéro actuel (${docSettings.currentNumber}) est inférieur au numéro de départ (${docSettings.startNumber})`);
          }
        } catch (error) {
          issues.push(`❌ ${type}: Erreur lors de la vérification - ${error instanceof Error ? error.message : 'Erreur inconnue'}`);
        }
      }

      if (issues.length === 0) {
        issues.push('✅ Tous les tests sont passés - le système de numérotation est opérationnel');
      }

    } catch (error) {
      issues.push(`❌ Erreur générale du diagnostic: ${error instanceof Error ? error.message : 'Erreur inconnue'}`);
    }

    return issues;
  }

  async cleanupNumberingData(): Promise<void> {
    try {
      console.log('Cleaning up numbering data...');
      const documentTypes: DocumentType[] = ['QUOTE', 'INVOICE', 'SALES_JOURNAL', 'DELIVERY', 'RETURN', 'PURCHASE_ORDER'];
      const currentYear = new Date().getFullYear();

      for (const type of documentTypes) {
        // Get all records for this type and current year
        const { data: records, error } = await supabase
          .from(this.TABLE_NAME)
          .select('*')
          .eq('document_type', type)
          .eq('year', currentYear)
          .order('sequence', { ascending: true });

        if (error) {
          console.error(`Error fetching records for ${type}:`, error);
          continue;
        }

        if (!records || records.length === 0) {
          console.log(`No records found for ${type} - this is normal for new document types`);
          continue;
        }

        // Check for duplicates and inconsistencies
        const sequenceMap = new Map<number, any[]>();
        records.forEach(record => {
          const seq = record.sequence;
          if (!sequenceMap.has(seq)) {
            sequenceMap.set(seq, []);
          }
          sequenceMap.get(seq)!.push(record);
        });

        // Remove duplicates (keep the most recent one)
        for (const [sequence, duplicates] of sequenceMap.entries()) {
          if (duplicates.length > 1) {
            console.log(`Found ${duplicates.length} duplicates for ${type} sequence ${sequence}`);

            // Sort by created_at and keep the most recent
            duplicates.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
            const toKeep = duplicates[0];
            const toDelete = duplicates.slice(1);

            // Delete the older duplicates
            for (const record of toDelete) {
              const { error: deleteError } = await supabase
                .from(this.TABLE_NAME)
                .delete()
                .eq('id', record.id);

              if (deleteError) {
                console.error(`Error deleting duplicate record ${record.id}:`, deleteError);
              } else {
                console.log(`Deleted duplicate record for ${type} sequence ${sequence}`);
              }
            }
          }
        }
      }

      console.log('Numbering data cleanup completed');
    } catch (error) {
      console.error('Error during numbering cleanup:', error);
      throw error;
    }
  }

  async repairNumberingSystem(): Promise<void> {
    try {
      console.log('Starting numbering system repair...');

      // First, clean up any duplicate or orphaned records
      await this.cleanupNumberingData();

      // Then validate and fix any inconsistencies
      await this.validateNumberingSystem();

      console.log('Numbering system repair completed successfully');
    } catch (error) {
      console.error('Error during numbering system repair:', error);
      throw error;
    }
  }
}

export const documentNumberingService = new DocumentNumberingService();