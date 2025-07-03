import { supabase } from '../lib/supabase';
import { Customer, WooCommerceOrder } from '../types';
import { wooCommerceService, WooCommerceCustomer } from './woocommerce';

class CustomerService {
  private readonly TABLE_NAME = 'customers';

  /**
   * Ensure user is authenticated before performing any operations
   */
  private async ensureAuthenticated(): Promise<string> {
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) {
      throw new Error('User must be authenticated to perform this operation');
    }
    return user.id;
  }

  /**
   * Convert database row to Customer type
   */
  private mapDatabaseToCustomer(row: any): Customer {
    return {
      id: row.id,
      wooCommerceId: row.woocommerce_id,
      firstName: row.first_name,
      lastName: row.last_name,
      company: row.company,
      email: row.email,
      phone: row.phone,
      address: row.address,
      city: row.city,
      postalCode: row.postal_code,
      country: row.country,
      ice: row.ice,
      notes: row.notes,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  /**
   * Convert Customer type to database row
   */
  private mapCustomerToDatabase(customer: Customer): any {
    return {
      id: customer.id,
      woocommerce_id: customer.wooCommerceId,
      first_name: customer.firstName,
      last_name: customer.lastName,
      company: customer.company,
      email: customer.email,
      phone: customer.phone,
      address: customer.address,
      city: customer.city,
      postal_code: customer.postalCode,
      country: customer.country || 'Maroc',
      ice: customer.ice,
      notes: customer.notes
    };
  }

  async getCustomers(): Promise<Customer[]> {
    try {
      await this.ensureAuthenticated();

      const { data, error } = await supabase
        .from(this.TABLE_NAME)
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching customers:', error);
        throw error;
      }

      return (data || []).map(this.mapDatabaseToCustomer);
    } catch (error) {
      console.error('Error loading customers:', error);
      return [];
    }
  }

  async getCustomerById(id: string): Promise<Customer | null> {
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

      return data ? this.mapDatabaseToCustomer(data) : null;
    } catch (error) {
      console.error('Error getting customer by ID:', error);
      return null;
    }
  }

  async getCustomerByWooCommerceId(wooCommerceId: number): Promise<Customer | null> {
    try {
      if (!wooCommerceId) {
        return null;
      }

      await this.ensureAuthenticated();

      const { data, error } = await supabase
        .from(this.TABLE_NAME)
        .select('*')
        .eq('woocommerce_id', wooCommerceId)
        .maybeSingle();

      if (error) {
        console.error('Error getting customer by WooCommerce ID:', error);
        throw error;
      }

      return data ? this.mapDatabaseToCustomer(data) : null;
    } catch (error) {
      console.error('Error getting customer by WooCommerce ID:', error);
      return null;
    }
  }

  async getCustomerByEmail(email: string): Promise<Customer | null> {
    try {
      // Check if email is empty or only whitespace
      if (!email || email.trim() === '') {
        return null;
      }

      await this.ensureAuthenticated();

      const { data, error } = await supabase
        .from(this.TABLE_NAME)
        .select('*')
        .eq('email', email)
        .maybeSingle();

      if (error) {
        console.error('Error getting customer by email:', error);
        throw error;
      }

      return data ? this.mapDatabaseToCustomer(data) : null;
    } catch (error) {
      console.error('Error getting customer by email:', error);
      return null;
    }
  }

  async saveCustomer(customer: Customer, syncToWooCommerce: boolean = false): Promise<Customer> {
    try {
      const userId = await this.ensureAuthenticated();

      console.log('Saving customer with syncToWooCommerce =', syncToWooCommerce);

      // If this is a new customer and we want to sync to WooCommerce
      if (!customer.wooCommerceId && syncToWooCommerce) {
        try {
          console.log('Creating customer in WooCommerce...', {
            email: customer.email,
            firstName: customer.firstName,
            lastName: customer.lastName
          });

          const username = customer.email.split('@')[0];

          const wcCustomerData = {
            email: customer.email,
            first_name: customer.firstName,
            last_name: customer.lastName,
            username: username,
            billing: {
              first_name: customer.firstName,
              last_name: customer.lastName,
              company: customer.company || '',
              address_1: customer.address || '',
              address_2: '',
              city: customer.city || '',
              state: '',
              postcode: customer.postalCode || '',
              country: customer.country || 'MA',
              email: customer.email,
              phone: customer.phone || ''
            },
            shipping: {
              first_name: customer.firstName,
              last_name: customer.lastName,
              company: customer.company || '',
              address_1: customer.address || '',
              address_2: '',
              city: customer.city || '',
              state: '',
              postcode: customer.postalCode || '',
              country: customer.country || 'MA'
            }
          };

          console.log('WooCommerce customer data:', wcCustomerData);

          try {
            const wcCustomer = await wooCommerceService.createCustomer(wcCustomerData);
            console.log('Customer created in WooCommerce with ID:', wcCustomer.id);

            customer.wooCommerceId = wcCustomer.id;
          } catch (wcError) {
            console.error('Error in WooCommerce API call:', wcError);
            throw new Error(`Error syncing with WooCommerce: ${(wcError as Error).message}`);
          }
        } catch (syncError) {
          console.error('Error creating customer in WooCommerce:', syncError);
          throw new Error(`Error syncing with WooCommerce: ${(syncError as Error).message}`);
        }
      }

      // Prepare customer data for database
      const customerData = this.mapCustomerToDatabase(customer);

      if (!customer.id) {
        customerData.id = crypto.randomUUID();
      }

      // Add user_id to customer data
      customerData.user_id = userId;

      console.log('Upserting customer to Supabase:', customerData);
      const { data, error } = await supabase
        .from(this.TABLE_NAME)
        .upsert(customerData)
        .select()
        .single();

      if (error) {
        console.error('Error saving customer to Supabase:', error);
        throw error;
      }

      console.log('Customer saved successfully:', data);
      return this.mapDatabaseToCustomer(data);
    } catch (error) {
      console.error('Error in saveCustomer method:', error);
      throw error;
    }
  }

  async deleteCustomer(customerId: string): Promise<void> {
    try {
      await this.ensureAuthenticated();

      const { error } = await supabase
        .from(this.TABLE_NAME)
        .delete()
        .eq('id', customerId);

      if (error) {
        console.error('Error deleting customer:', error);
        throw error;
      }
    } catch (error) {
      console.error('Error deleting customer:', error);
      throw error;
    }
  }

  // Create customer from WooCommerce Customer
  createCustomerFromWooCommerceCustomer(wcCustomer: WooCommerceCustomer): Customer {
    const customerId = crypto.randomUUID();
    const now = new Date().toISOString();

    return {
      id: customerId,
      wooCommerceId: wcCustomer.id,
      firstName: wcCustomer.first_name || wcCustomer.billing.first_name,
      lastName: wcCustomer.last_name || wcCustomer.billing.last_name,
      company: wcCustomer.billing.company || undefined,
      email: wcCustomer.email || wcCustomer.billing.email,
      phone: wcCustomer.billing.phone || undefined,
      address: wcCustomer.billing.address_1 + (wcCustomer.billing.address_2 ? ` ${wcCustomer.billing.address_2}` : ''),
      city: wcCustomer.billing.city,
      postalCode: wcCustomer.billing.postcode,
      country: wcCustomer.billing.country,
      createdAt: now,
      updatedAt: now
    };
  }

  // Create customer from WooCommerce Order
  createCustomerFromWooCommerceOrder(order: WooCommerceOrder): Customer {
    const customerId = crypto.randomUUID();
    const now = new Date().toISOString();

    return {
      id: customerId,
      wooCommerceId: order.customer_id,
      firstName: order.billing.first_name,
      lastName: order.billing.last_name,
      company: order.billing.company || undefined,
      email: order.billing.email,
      phone: order.billing.phone || undefined,
      address: order.billing.address_1 + (order.billing.address_2 ? ` ${order.billing.address_2}` : ''),
      city: order.billing.city,
      postalCode: order.billing.postcode,
      country: order.billing.country,
      createdAt: now,
      updatedAt: now
    };
  }

  // Import customers from WooCommerce
  async importCustomersFromWooCommerce(): Promise<{
    importedCount: number;
    updatedCount: number;
    skippedCount: number;
  }> {
    try {
      console.log('Fetching customers from WooCommerce...');

      let allCustomers: WooCommerceCustomer[] = [];
      let page = 1;
      let hasMore = true;

      while (hasMore) {
        const customers = await wooCommerceService.fetchCustomers({
          per_page: 100,
          page: page,
          orderby: 'registered_date',
          order: 'desc'
        });

        if (customers.length === 0) {
          hasMore = false;
        } else {
          allCustomers = [...allCustomers, ...customers];
          page++;

          if (page > 10) {
            hasMore = false;
          }
        }
      }

      console.log(`${allCustomers.length} customers fetched from WooCommerce`);
      return this.importWooCommerceCustomers(allCustomers);
    } catch (error) {
      console.error('Error fetching WooCommerce customers:', error);
      throw error;
    }
  }

  // Import WooCommerce customers
  async importWooCommerceCustomers(wcCustomers: WooCommerceCustomer[]): Promise<{
    importedCount: number;
    updatedCount: number;
    skippedCount: number;
  }> {
    let importedCount = 0;
    let updatedCount = 0;
    let skippedCount = 0;

    const promises = wcCustomers.map(async (wcCustomer) => {
      try {
        const existingCustomer = await this.getCustomerByWooCommerceId(wcCustomer.id) ||
                                await this.getCustomerByEmail(wcCustomer.email || wcCustomer.billing.email);

        if (existingCustomer) {
          const shouldUpdate = this.shouldUpdateCustomerFromWC(existingCustomer, wcCustomer);

          if (shouldUpdate) {
            const updatedCustomer: Customer = {
              ...existingCustomer,
              wooCommerceId: wcCustomer.id,
              firstName: wcCustomer.first_name || wcCustomer.billing.first_name,
              lastName: wcCustomer.last_name || wcCustomer.billing.last_name,
              company: wcCustomer.billing.company || existingCustomer.company,
              email: wcCustomer.email || wcCustomer.billing.email,
              phone: wcCustomer.billing.phone || existingCustomer.phone,
              address: wcCustomer.billing.address_1 + (wcCustomer.billing.address_2 ? ` ${wcCustomer.billing.address_2}` : ''),
              city: wcCustomer.billing.city,
              postalCode: wcCustomer.billing.postcode,
              country: wcCustomer.billing.country,
              ice: existingCustomer.ice,
              notes: existingCustomer.notes,
              updatedAt: new Date().toISOString()
            };

            await this.saveCustomer(updatedCustomer);
            updatedCount++;
          } else {
            skippedCount++;
          }
        } else {
          const newCustomer = this.createCustomerFromWooCommerceCustomer(wcCustomer);
          await this.saveCustomer(newCustomer);
          importedCount++;
        }
      } catch (error) {
        console.error('Error processing customer:', wcCustomer, error);
        skippedCount++;
      }
    });

    // Wait for all promises to complete
    await Promise.all(promises);

    return { importedCount, updatedCount, skippedCount };
  }

  // Import customers from orders
  async importCustomersFromOrders(orders: WooCommerceOrder[]): Promise<{
    importedCount: number;
    updatedCount: number;
    skippedCount: number;
  }> {
    try {
      const userId = await this.ensureAuthenticated();
      let importedCount = 0;
      let updatedCount = 0;
      let skippedCount = 0;

      for (const order of orders) {
        if (!order.customer_id) {
          skippedCount++;
          continue;
        }

        // Check if customer already exists
        const { data: existingCustomer } = await supabase
          .from(this.TABLE_NAME)
          .select('id')
          .eq('woocommerce_id', order.customer_id)
          .single();

        const customerData = this.filterCustomerData(order, userId);

        if (existingCustomer) {
          // Update existing customer
          const { error: updateError } = await supabase
            .from(this.TABLE_NAME)
            .update(customerData)
            .eq('woocommerce_id', order.customer_id);

          if (updateError) {
            console.error('Error updating customer:', updateError);
            skippedCount++;
          } else {
            updatedCount++;
          }
        } else {
          // Insert new customer
          const { error: insertError } = await supabase
            .from(this.TABLE_NAME)
            .insert(customerData);

          if (insertError) {
            console.error('Error inserting customer:', insertError);
            skippedCount++;
          } else {
            importedCount++;
          }
        }
      }

      return { importedCount, updatedCount, skippedCount };
    } catch (error) {
      console.error('Failed to import customers:', error);
      throw error;
    }
  }

  private shouldUpdateCustomer(customer: Customer, order: WooCommerceOrder): boolean {
    const newAddress = order.billing.address_1 + (order.billing.address_2 ? ` ${order.billing.address_2}` : '');

    return (
      customer.firstName !== order.billing.first_name ||
      customer.lastName !== order.billing.last_name ||
      customer.company !== (order.billing.company || customer.company) ||
      customer.email !== order.billing.email ||
      customer.phone !== (order.billing.phone || customer.phone) ||
      customer.address !== newAddress ||
      customer.city !== order.billing.city ||
      customer.postalCode !== order.billing.postcode ||
      customer.country !== order.billing.country
    );
  }

  private shouldUpdateCustomerFromWC(customer: Customer, wcCustomer: WooCommerceCustomer): boolean {
    const newAddress = wcCustomer.billing.address_1 + (wcCustomer.billing.address_2 ? ` ${wcCustomer.billing.address_2}` : '');
    const wcFirstName = wcCustomer.first_name || wcCustomer.billing.first_name;
    const wcLastName = wcCustomer.last_name || wcCustomer.billing.last_name;
    const wcEmail = wcCustomer.email || wcCustomer.billing.email;

    return (
      customer.firstName !== wcFirstName ||
      customer.lastName !== wcLastName ||
      customer.company !== (wcCustomer.billing.company || customer.company) ||
      customer.email !== wcEmail ||
      customer.phone !== (wcCustomer.billing.phone || customer.phone) ||
      customer.address !== newAddress ||
      customer.city !== wcCustomer.billing.city ||
      customer.postalCode !== wcCustomer.billing.postcode ||
      customer.country !== wcCustomer.billing.country
    );
  }

  async syncWithWooCommerce(): Promise<{
    importedCount: number;
    updatedCount: number;
    skippedCount: number;
  }> {
    try {
      console.log('Starting customer sync with WooCommerce...');
      return await this.importCustomersFromWooCommerce();
    } catch (error) {
      console.error('Error syncing customers:', error);
      throw error;
    }
  }

  async searchCustomers(query: string): Promise<Customer[]> {
    try {
      await this.ensureAuthenticated();

      const { data, error } = await supabase
        .from(this.TABLE_NAME)
        .select('*')
        .or(`first_name.ilike.%${query}%,last_name.ilike.%${query}%,email.ilike.%${query}%,company.ilike.%${query}%,phone.ilike.%${query}%`)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error searching customers:', error);
        throw error;
      }

      return (data || []).map(this.mapDatabaseToCustomer);
    } catch (error) {
      console.error('Error searching customers:', error);
      return [];
    }
  }

  async getCustomerStats() {
    try {
      const customers = await this.getCustomers();

      return {
        total: customers.length,
        withWooCommerceId: customers.filter(c => c.wooCommerceId).length,
        withCompany: customers.filter(c => c.company).length,
        withICE: customers.filter(c => c.ice).length
      };
    } catch (error) {
      console.error('Error getting customer stats:', error);
      return {
        total: 0,
        withWooCommerceId: 0,
        withCompany: 0,
        withICE: 0
      };
    }
  }

  /**
   * Get current authenticated user ID
   */
  private async getCurrentUserId(): Promise<string> {
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) {
      throw new Error('User not authenticated');
    }
    return user.id;
  }

  /**
   * Filter customer data for database storage
   */
  private filterCustomerData(orderData: any, userId: string) {
    const billing = orderData.billing || {};
    const shipping = orderData.shipping || {};

    return {
      woocommerce_id: orderData.customer_id,
      first_name: billing.first_name || '',
      last_name: billing.last_name || '',
      company: billing.company || '',
      email: billing.email || '',
      phone: billing.phone || '',
      address: billing.address_1 || '',
      city: billing.city || '',
      postal_code: billing.postcode || '',
      country: billing.country || 'Maroc',
      ice: billing.ice || null,
      billing_data: billing,
      shipping_data: shipping,
      user_id: userId,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
  }
}

export const customerService = new CustomerService();