import { Customer } from '../types';
import { supabase } from '../lib/supabase';

class CustomerService {
  async getCustomers(): Promise<Customer[]> {
    const { data, error } = await supabase
      .from('customers')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  }

  async getCustomerStats(): Promise<{
    total: number;
    withWooCommerceId: number;
    withCompany: number;
    withICE: number;
  }> {
    const { data: customers, error } = await supabase
      .from('customers')
      .select('woocommerce_id, company, ice');

    if (error) throw error;

    return {
      total: customers?.length || 0,
      withWooCommerceId: customers?.filter(c => c.woocommerce_id != null).length || 0,
      withCompany: customers?.filter(c => c.company != null).length || 0,
      withICE: customers?.filter(c => c.ice != null).length || 0
    };
  }

  async saveCustomer(customer: Customer): Promise<Customer> {
    const { data, error } = await supabase
      .from('customers')
      .upsert({
        id: customer.id,
        first_name: customer.first_name,
        last_name: customer.last_name,
        company: customer.company,
        email: customer.email,
        phone: customer.phone,
        address: customer.address,
        city: customer.city,
        postal_code: customer.postal_code,
        country: customer.country || 'Maroc',
        ice: customer.ice,
        notes: customer.notes,
        billing_data: customer.billing_data,
        shipping_data: customer.shipping_data,
        woocommerce_id: customer.woocommerce_id,
        user_id: customer.user_id
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async deleteCustomer(id: string): Promise<void> {
    const { error } = await supabase
      .from('customers')
      .delete()
      .eq('id', id);

    if (error) throw error;
  }

  async syncWithWooCommerce(): Promise<{
    importedCount: number;
    updatedCount: number;
    skippedCount: number;
  }> {
    const { data, error } = await supabase
      .rpc('sync_woocommerce_customers');

    if (error) throw error;
    return data || { importedCount: 0, updatedCount: 0, skippedCount: 0 };
  }
}

export const customerService = new CustomerService();