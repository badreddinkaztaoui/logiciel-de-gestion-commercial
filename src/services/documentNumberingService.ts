import { supabase } from '../lib/supabase';

/**
 * Service for managing document number sequences
 * This ensures sequential, non-duplicated document numbers with proper tracking
 */
class DocumentNumberingService {
  /**
   * Ensure user is authenticated
   */
  private async ensureAuthenticated(): Promise<string> {
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) {
      throw new Error('User must be authenticated to perform this operation');
    }
    return user.id;
  }

  /**
   * Reserve a document number for a specific document type
   * @param documentType The type of document (invoice, quote, etc.)
   * @returns The reserved document number
   */
  async reserveDocumentNumber(documentType: string): Promise<string> {
    try {
      await this.ensureAuthenticated();
      
      // Call the RPC function to reserve a new document number
      console.log(`Reserving new number for ${documentType}...`);
      const { data, error } = await supabase.rpc('reserve_document_number', {
        p_document_type: documentType
      });
      
      if (error) {
        console.error('Error reserving document number:', error);
        throw error;
      }
      
      if (!data) {
        throw new Error('Failed to reserve document number');
      }
      
      const documentNumber = data;
      console.log(`Reserved document number for ${documentType}: ${documentNumber}`);
      return documentNumber;
    } catch (error) {
      console.error('Error in reserveDocumentNumber:', error);
      throw error;
    }
  }

  /**
   * Confirm that a document number has been used
   * @param documentType The type of document
   * @param documentNumber The document number to confirm
   * @param documentId The ID of the document that used this number
   * @returns true if confirmed
   */
  async confirmDocumentNumber(documentType: string, documentNumber: string, documentId: string): Promise<boolean> {
    try {
      await this.ensureAuthenticated();
      
      // Call the function to confirm the document number
      const { data, error } = await supabase.rpc('confirm_document_number', {
        p_document_type: documentType,
        p_document_number: documentNumber,
        p_document_id: documentId
      });
      
      if (error) {
        console.error('Error confirming document number:', error);
        throw error;
      }
      
      console.log(`Confirmed document number for ${documentType}: ${documentNumber}`);
      return true;
    } catch (error) {
      console.error('Error in confirmDocumentNumber:', error);
      throw error;
    }
  }

  /**
   * Release a document number that was reserved but not used
   * @param documentType The type of document
   * @param documentNumber The document number to release
   * @returns true if released
   */
  async releaseDocumentNumber(documentType: string, documentNumber: string): Promise<boolean> {
    try {
      await this.ensureAuthenticated();
      
      console.log(`Releasing document number ${documentNumber} for ${documentType}...`);
      
      // Call the function to release the document number
      const { data, error } = await supabase.rpc('release_document_number', {
        p_document_type: documentType,
        p_document_number: documentNumber
      });
      
      if (error) {
        console.error('Error releasing document number:', error);
        throw error;
      }
      
      console.log(`Released document number for ${documentType}: ${documentNumber}`);
      return true;
    } catch (error) {
      console.error('Error in releaseDocumentNumber:', error);
      return false; // Return false instead of throwing to avoid crashes on cleanup
    }
  }

  /**
   * Check if a document number is available (reserved but not confirmed)
   * @param documentType The type of document
   * @param documentNumber The document number to check
   * @returns true if the number is available
   */
  async isDocumentNumberAvailable(documentType: string, documentNumber: string): Promise<boolean> {
    try {
      await this.ensureAuthenticated();
      
      // Call the function to check document number availability
      const { data, error } = await supabase.rpc('is_document_number_available', {
        p_document_type: documentType,
        p_document_number: documentNumber
      });
      
      if (error) {
        console.error('Error checking document number availability:', error);
        throw error;
      }
      
      return !!data;
    } catch (error) {
      console.error('Error in isDocumentNumberAvailable:', error);
      return false;
    }
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