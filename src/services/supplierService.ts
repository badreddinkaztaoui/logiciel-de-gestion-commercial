import { supabase } from '../lib/supabase';
import { Supplier } from '../types';

class SupplierService {
  private readonly TABLE_NAME = 'suppliers';

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
   * Convert database row to Supplier type
   */
  private mapDatabaseToSupplier(row: any): Supplier {
    return {
      id: row.id,
      name: row.name,
      contactName: row.contact_name,
      email: row.email,
      phone: row.phone,
      address: row.address,
      city: row.city,
      postalCode: row.postal_code,
      country: row.country,
      taxNumber: row.tax_number,
      notes: row.notes
    };
  }

  /**
   * Convert Supplier type to database row
   */
  private mapSupplierToDatabase(supplier: Supplier): any {
    return {
      id: supplier.id,
      name: supplier.name,
      contact_name: supplier.contactName,
      email: supplier.email,
      phone: supplier.phone,
      address: supplier.address,
      city: supplier.city,
      postal_code: supplier.postalCode,
      country: supplier.country,
      tax_number: supplier.taxNumber,
      notes: supplier.notes
    };
  }

  async getSuppliers(): Promise<Supplier[]> {
    try {
      await this.ensureAuthenticated();

      const { data, error } = await supabase
        .from(this.TABLE_NAME)
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching suppliers:', error);
        throw error;
      }

      const suppliers = (data || []).map(this.mapDatabaseToSupplier);
      
      // If no suppliers exist, create the default one
      if (suppliers.length === 0) {
        const defaultSupplier = await this.createDefaultSupplier();
        return [defaultSupplier];
      }

      return suppliers;
    } catch (error) {
      console.error('Error loading suppliers:', error);
      return [];
    }
  }

  private async createDefaultSupplier(): Promise<Supplier> {
    const defaultSupplier: Supplier = {
      id: crypto.randomUUID(),
      name: 'GETRADIS',
      contactName: 'Service commercial',
      email: 'contact@getradis.ma',
      phone: '+212 522 123456',
      address: 'Zone Industrielle',
      city: 'Casablanca',
      postalCode: '20000',
      country: 'Maroc',
      taxNumber: '123456789',
      notes: 'Fournisseur principal de matériel informatique'
    };

    return await this.saveSupplier(defaultSupplier);
  }

  async getSupplierById(id: string): Promise<Supplier | null> {
    try {
      await this.ensureAuthenticated();

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

      return data ? this.mapDatabaseToSupplier(data) : null;
    } catch (error) {
      console.error('Error getting supplier by ID:', error);
      return null;
    }
  }

  async saveSupplier(supplier: Supplier): Promise<Supplier> {
    try {
      await this.ensureAuthenticated();

      const supplierData = this.mapSupplierToDatabase(supplier);
      
      if (!supplier.id) {
        supplierData.id = crypto.randomUUID();
      }

      const { data, error } = await supabase
        .from(this.TABLE_NAME)
        .upsert(supplierData)
        .select()
        .single();

      if (error) {
        console.error('Error saving supplier:', error);
        throw error;
      }

      return this.mapDatabaseToSupplier(data);
    } catch (error) {
      console.error('Error saving supplier:', error);
      throw error;
    }
  }

  async deleteSupplier(supplierId: string): Promise<void> {
    try {
      await this.ensureAuthenticated();

      const { error } = await supabase
        .from(this.TABLE_NAME)
        .delete()
        .eq('id', supplierId);

      if (error) {
        console.error('Error deleting supplier:', error);
        throw error;
      }
    } catch (error) {
      console.error('Error deleting supplier:', error);
      throw error;
    }
  }

  getDefaultSupplier(): Supplier {
    return {
      id: 'getradis',
      name: 'GETRADIS',
      contactName: 'Service commercial',
      email: 'contact@getradis.ma',
      phone: '+212 522 123456',
      address: 'Zone Industrielle',
      city: 'Casablanca',
      postalCode: '20000',
      country: 'Maroc',
      taxNumber: '123456789',
      notes: 'Fournisseur principal de matériel informatique'
    };
  }
}

export const supplierService = new SupplierService();