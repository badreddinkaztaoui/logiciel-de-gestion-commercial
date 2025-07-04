import { supabase } from '../lib/supabase';
import { Supplier } from '../types';

class SupplierService {
  private readonly TABLE_NAME = 'suppliers';

  private async ensureAuthenticated(): Promise<string> {
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) {
      throw new Error('User must be authenticated to perform this operation');
    }
    return user.id;
  }

  private mapDatabaseToSupplier(data: any): Supplier {
    return {
      id: data.id,
      name: data.name,
      company: data.company,
      email: data.email,
      phone: data.phone,
      address: data.address,
      city: data.city,
      postal_code: data.postal_code,
      country: data.country,
      ice: data.ice,
      notes: data.notes,
      created_at: data.created_at,
      updated_at: data.updated_at
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

      return (data || []).map(this.mapDatabaseToSupplier);
    } catch (error) {
      console.error('Error loading suppliers:', error);
      return [];
    }
  }

  async getSupplier(id: string): Promise<Supplier | null> {
    try {
      await this.ensureAuthenticated();

      const { data, error } = await supabase
        .from(this.TABLE_NAME)
        .select('*')
        .eq('id', id)
        .single();

      if (error) {
        console.error('Error fetching supplier:', error);
        throw error;
      }

      return data ? this.mapDatabaseToSupplier(data) : null;
    } catch (error) {
      console.error('Error loading supplier:', error);
      return null;
    }
  }

  async createSupplier(supplier: Partial<Supplier>): Promise<Supplier> {
    try {
      await this.ensureAuthenticated();

      const { data, error } = await supabase
        .from(this.TABLE_NAME)
        .insert([{
          ...supplier,
          country: supplier.country || 'Maroc',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }])
        .select()
        .single();

      if (error) {
        console.error('Error creating supplier:', error);
        throw error;
      }

      return this.mapDatabaseToSupplier(data);
    } catch (error) {
      console.error('Error creating supplier:', error);
      throw error;
    }
  }

  async updateSupplier(id: string, supplier: Partial<Supplier>): Promise<Supplier> {
    try {
      await this.ensureAuthenticated();

      const { data, error } = await supabase
        .from(this.TABLE_NAME)
        .update({
          ...supplier,
          updated_at: new Date().toISOString()
        })
        .eq('id', id)
        .select()
        .single();

      if (error) {
        console.error('Error updating supplier:', error);
        throw error;
      }

      return this.mapDatabaseToSupplier(data);
    } catch (error) {
      console.error('Error updating supplier:', error);
      throw error;
    }
  }

  async deleteSupplier(id: string): Promise<void> {
    try {
      await this.ensureAuthenticated();

      const { error } = await supabase
        .from(this.TABLE_NAME)
        .delete()
        .eq('id', id);

      if (error) {
        console.error('Error deleting supplier:', error);
        throw error;
      }
    } catch (error) {
      console.error('Error deleting supplier:', error);
      throw error;
    }
  }

  async searchSuppliers(query: string): Promise<Supplier[]> {
    try {
      await this.ensureAuthenticated();

      const { data, error } = await supabase
        .from(this.TABLE_NAME)
        .select('*')
        .or(`name.ilike.%${query}%,company.ilike.%${query}%,email.ilike.%${query}%`)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error searching suppliers:', error);
        throw error;
      }

      return (data || []).map(this.mapDatabaseToSupplier);
    } catch (error) {
      console.error('Error searching suppliers:', error);
      return [];
    }
  }

  getDefaultSupplier(): Supplier {
    return {
      id: 'getradis',
      name: 'GETRADIS',
      email: 'contact@getradis.ma',
      phone: '+212 522 123456',
      address: 'Zone Industrielle',
      city: 'Casablanca',
      postal_code: '20000',
      country: 'Maroc',
      ice: '123456789',
      notes: 'Fournisseur principal de matériel informatique',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
  }
}

export const supplierService = new SupplierService();