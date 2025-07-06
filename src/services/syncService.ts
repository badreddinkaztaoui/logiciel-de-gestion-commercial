import { supabase } from '../lib/supabase';
import { wooCommerceService } from './woocommerce';
import { customerService } from './customerService';
import { orderService } from './orderService';
import { WooCommerceOrder } from '../types';

export interface SyncState {
  isInitialSyncComplete: boolean;
  lastSyncTime: string | null;
  isSyncing: boolean;
  syncError: string | null;
}

export interface SyncResult {
  success: boolean;
  customersImported: number;
  ordersImported: number;
  customersUpdated: number;
  ordersUpdated: number;
  error?: string;
}

class SyncService {
  private readonly SYNC_STATE_KEY = 'woocommerce_sync_state';
  private readonly SETTINGS_TABLE = 'settings';

  private syncState: SyncState = {
    isInitialSyncComplete: false,
    lastSyncTime: null,
    isSyncing: false,
    syncError: null
  };

  private syncCallbacks: Array<(state: SyncState) => void> = [];

  constructor() {
    this.loadSyncState();
  }

  /**
   * Load sync state from localStorage and database
   */
  private async loadSyncState(): Promise<void> {
    try {
      // Load from localStorage first for immediate UI response
      const localState = localStorage.getItem(this.SYNC_STATE_KEY);
      if (localState) {
        this.syncState = { ...this.syncState, ...JSON.parse(localState) };
      }

      // Load from database for persistent state
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data, error } = await supabase
          .from(this.SETTINGS_TABLE)
          .select('settings_data')
          .eq('user_id', user.id)
          .single();

        if (!error && data?.settings_data?.syncState) {
          this.syncState = { ...this.syncState, ...data.settings_data.syncState };
          this.saveSyncStateToLocal();
        }
      }
    } catch (error) {
      console.error('Error loading sync state:', error);
    }
  }

  /**
   * Save sync state to localStorage and database
   */
  private async saveSyncState(): Promise<void> {
    try {
      this.saveSyncStateToLocal();
      await this.saveSyncStateToDatabase();
      this.notifyCallbacks();
    } catch (error) {
      console.error('Error saving sync state:', error);
    }
  }

  private saveSyncStateToLocal(): void {
    localStorage.setItem(this.SYNC_STATE_KEY, JSON.stringify(this.syncState));
  }

  private async saveSyncStateToDatabase(): Promise<void> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: existingSettings } = await supabase
        .from(this.SETTINGS_TABLE)
        .select('settings_data')
        .eq('user_id', user.id)
        .single();

      const settingsData = {
        ...(existingSettings?.settings_data || {}),
        syncState: this.syncState
      };

      await supabase
        .from(this.SETTINGS_TABLE)
        .upsert({
          user_id: user.id,
          settings_data: settingsData,
          updated_at: new Date().toISOString()
        });
    } catch (error) {
      console.error('Error saving sync state to database:', error);
    }
  }

  /**
   * Check if initial sync is needed
   */
  async shouldPerformInitialSync(): Promise<boolean> {
    await this.loadSyncState();
    return !this.syncState.isInitialSyncComplete && !this.syncState.isSyncing;
  }

  /**
   * Perform initial WooCommerce sync
   */
  async performInitialSync(): Promise<SyncResult> {
    if (this.syncState.isSyncing) {
      return {
        success: false,
        customersImported: 0,
        ordersImported: 0,
        customersUpdated: 0,
        ordersUpdated: 0,
        error: 'Sync already in progress'
      };
    }

    this.syncState.isSyncing = true;
    this.syncState.syncError = null;
    await this.saveSyncState();

    try {
      const result = await this.performFullSync();

      if (result.success) {
        this.syncState.isInitialSyncComplete = true;
        this.syncState.lastSyncTime = new Date().toISOString();
        this.syncState.syncError = null;
      } else {
        this.syncState.syncError = result.error || 'Unknown error occurred';
      }

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      this.syncState.syncError = errorMessage;

      return {
        success: false,
        customersImported: 0,
        ordersImported: 0,
        customersUpdated: 0,
        ordersUpdated: 0,
        error: errorMessage
      };
    } finally {
      this.syncState.isSyncing = false;
      await this.saveSyncState();
    }
  }

  /**
   * Perform manual sync (for sync button)
   */
  async performManualSync(): Promise<SyncResult> {
    if (this.syncState.isSyncing) {
      return {
        success: false,
        customersImported: 0,
        ordersImported: 0,
        customersUpdated: 0,
        ordersUpdated: 0,
        error: 'Sync already in progress'
      };
    }

    this.syncState.isSyncing = true;
    this.syncState.syncError = null;
    await this.saveSyncState();

    try {
      const result = await this.performFullSync();

      if (result.success) {
        this.syncState.lastSyncTime = new Date().toISOString();
        this.syncState.syncError = null;
      } else {
        this.syncState.syncError = result.error || 'Unknown error occurred';
      }

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      this.syncState.syncError = errorMessage;

      return {
        success: false,
        customersImported: 0,
        ordersImported: 0,
        customersUpdated: 0,
        ordersUpdated: 0,
        error: errorMessage
      };
    } finally {
      this.syncState.isSyncing = false;
      await this.saveSyncState();
    }
  }

  /**
   * Perform full synchronization of customers and orders
   */
  private async performFullSync(): Promise<SyncResult> {
    let customersImported = 0;
    let ordersImported = 0;
    let customersUpdated = 0;
    let ordersUpdated = 0;

    try {
      // Step 1: Sync customers
      console.log('Starting customer sync...');
      const customerResult = await customerService.syncWithWooCommerce();
      customersImported = customerResult.importedCount;
      customersUpdated = customerResult.updatedCount;

      // Step 2: Sync orders
      console.log('Starting order sync...');
      const orderResult = await this.syncOrdersFromWooCommerce();
      ordersImported = orderResult.newOrdersCount;
      ordersUpdated = orderResult.updatedOrdersCount;

      return {
        success: true,
        customersImported,
        ordersImported,
        customersUpdated,
        ordersUpdated
      };
    } catch (error) {
      console.error('Error during full sync:', error);
      throw error;
    }
  }

  /**
   * Sync orders from WooCommerce with duplicate prevention
   */
  private async syncOrdersFromWooCommerce(): Promise<{
    newOrdersCount: number;
    updatedOrdersCount: number;
  }> {
    let page = 1;
    let newOrdersCount = 0;
    let updatedOrdersCount = 0;
    const perPage = 100;

    try {
      console.log('Starting orders sync from WooCommerce...');

      while (true) {
        console.log(`Fetching WooCommerce orders - Page ${page}`);

        const orders = await wooCommerceService.fetchOrders({
          per_page: perPage,
          page: page,
          status: 'any'
        });

        console.log(`Received ${orders?.length || 0} orders from WooCommerce`);

        if (!orders || orders.length === 0) {
          console.log('No more orders to process, ending sync');
          break;
        }

        // Process orders in batches to avoid overwhelming the database
        for (const order of orders) {
          try {
            // Check if order already exists
            const existingOrder = await orderService.getOrderById(order.id);

            if (existingOrder) {
              // Update existing order if needed
              const needsUpdate = this.shouldUpdateOrder(existingOrder, order);
              if (needsUpdate) {
                console.log(`Updating existing order ${order.id}`);
                await orderService.saveOrder(order);
                updatedOrdersCount++;
              }
            } else {
              // Import new order
              console.log(`Importing new order ${order.id}`);
              await orderService.saveOrder(order);
              newOrdersCount++;
            }

            // Also ensure customer exists for this order
            if (order.customer_id && order.customer_id > 0) {
              await this.ensureCustomerFromOrder(order);
            }
          } catch (error) {
            console.error(`Error processing order ${order.id}:`, error);
            // Continue with next order instead of failing the entire sync
          }
        }

        // If we got less than the requested amount, we're done
        if (orders.length < perPage) {
          console.log(`Received ${orders.length} orders (less than ${perPage}), ending sync`);
          break;
        }

        page++;

        // Add a safety limit to prevent infinite loops
        if (page > 100) {
          console.log('Reached page limit (100), ending sync');
          break;
        }
      }

      console.log(`Orders sync completed: ${newOrdersCount} new, ${updatedOrdersCount} updated`);
    } catch (error) {
      console.error('Error syncing orders:', error);
      throw error;
    }

    return { newOrdersCount, updatedOrdersCount };
  }

  /**
   * Check if an order needs to be updated
   */
  private shouldUpdateOrder(existingOrder: WooCommerceOrder, newOrder: WooCommerceOrder): boolean {
    // Update if status has changed
    if (existingOrder.status !== newOrder.status) {
      return true;
    }

    // Update if total has changed
    if (existingOrder.total !== newOrder.total) {
      return true;
    }

    // Update if date_modified is newer
    if (new Date(newOrder.date_modified) > new Date(existingOrder.date_modified)) {
      return true;
    }

    return false;
  }

  /**
   * Ensure customer exists for an order
   */
  private async ensureCustomerFromOrder(order: WooCommerceOrder): Promise<void> {
    try {
      // Check if customer already exists
      const existingCustomer = await customerService.getCustomerByWooCommerceId(order.customer_id);

      if (!existingCustomer) {
        // Create customer from order data
        const customer = customerService.createCustomerFromWooCommerceOrder(order);
        await customerService.saveCustomer(customer, false); // Don't sync back to WooCommerce
      }
    } catch (error) {
      console.error(`Error ensuring customer for order ${order.id}:`, error);
      // Don't throw error, just log it
    }
  }

  /**
   * Get current sync state
   */
  getSyncState(): SyncState {
    return { ...this.syncState };
  }

  /**
   * Subscribe to sync state changes
   */
  onSyncStateChange(callback: (state: SyncState) => void): void {
    this.syncCallbacks.push(callback);
  }

  /**
   * Unsubscribe from sync state changes
   */
  offSyncStateChange(callback: (state: SyncState) => void): void {
    this.syncCallbacks = this.syncCallbacks.filter(cb => cb !== callback);
  }

  /**
   * Notify all callbacks about state changes
   */
  private notifyCallbacks(): void {
    this.syncCallbacks.forEach(callback => {
      try {
        callback(this.getSyncState());
      } catch (error) {
        console.error('Error in sync state callback:', error);
      }
    });
  }

  /**
   * Reset sync state (for testing or manual reset)
   */
  async resetSyncState(): Promise<void> {
    this.syncState = {
      isInitialSyncComplete: false,
      lastSyncTime: null,
      isSyncing: false,
      syncError: null
    };
    await this.saveSyncState();
  }

  /**
   * Get sync statistics
   */
  async getSyncStats(): Promise<{
    totalOrders: number;
    totalCustomers: number;
    lastSyncTime: string | null;
  }> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        return {
          totalOrders: 0,
          totalCustomers: 0,
          lastSyncTime: null
        };
      }

      const [ordersResult, customersResult] = await Promise.all([
        supabase
          .from('woocommerce_orders')
          .select('id', { count: 'exact' })
          .eq('user_id', user.id),
        supabase
          .from('customers')
          .select('id', { count: 'exact' })
          .eq('user_id', user.id)
      ]);

      return {
        totalOrders: ordersResult.count || 0,
        totalCustomers: customersResult.count || 0,
        lastSyncTime: this.syncState.lastSyncTime
      };
    } catch (error) {
      console.error('Error getting sync stats:', error);
      return {
        totalOrders: 0,
        totalCustomers: 0,
        lastSyncTime: null
      };
    }
  }
}

export const syncService = new SyncService();