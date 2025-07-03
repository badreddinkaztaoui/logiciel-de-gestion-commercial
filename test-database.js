import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase environment variables');
  console.log('Make sure you have VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your .env file');
  console.log('Example .env file:');
  console.log('VITE_SUPABASE_URL=https://your-project.supabase.co');
  console.log('VITE_SUPABASE_ANON_KEY=your-anon-key');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function testDatabase() {
  console.log('🔍 Testing database connection...');
  console.log(`📡 Connecting to: ${supabaseUrl}`);

  try {
    const { data, error } = await supabase
      .from('orders')
      .select('count(*)', { count: 'exact', head: true });

    if (error) {
      if (error.code === '42P01') {
        console.log('❌ Orders table does not exist');
        console.log('📋 Please run the SQL schema first (see setup-database.md)');
        return false;
      }
      throw error;
    }

    console.log('✅ Database connection successful');
    console.log(`📊 Orders table exists (${data ? 'accessible' : 'no data yet'})`);

    const tables = [
      { name: 'customers', description: 'Clients' },
      { name: 'suppliers', description: 'Fournisseurs' },
      { name: 'quotes', description: 'Devis' },
      { name: 'invoices', description: 'Factures' },
      { name: 'sales_journal', description: 'Journal De Vente' },
      { name: 'delivery_notes', description: 'Bons de livraison' },
      { name: 'return_notes', description: 'Bons de retour' },
      { name: 'purchase_orders', description: 'Bons de commande' },
      { name: 'purchase_order_receives', description: 'Purchase Order Receives' }
    ];

    let allTablesExist = true;

    for (const table of tables) {
      try {
        const { error } = await supabase
          .from(table.name)
          .select('count(*)', { count: 'exact', head: true });

        if (error) {
          console.log(`❌ Table '${table.name}' (${table.description}) has issues:`, error.message);
          allTablesExist = false;
        } else {
          console.log(`✅ Table '${table.name}' (${table.description}) exists and is accessible`);
        }
      } catch (err) {
        console.log(`❌ Error testing table '${table.name}' (${table.description}):`, err.message);
        allTablesExist = false;
      }
    }

    if (allTablesExist) {
      console.log('\n🎉 All required tables are present!');
      console.log('📋 Your application supports:');
      console.log('   • Commands (WooCommerce orders)');
      console.log('   • Clients (Customer management)');
      console.log('   • Fournisseurs (Supplier management)');
      console.log('   • Devis (Quote management)');
      console.log('   • Factures (Invoice management)');
      console.log('   • Journal De Vente (Sales journal)');
      console.log('   • Bons de livraison (Delivery notes)');
      console.log('   • Bons de retour (Return notes)');
      console.log('   • Bons de commande (Purchase orders)');
    }

    return allTablesExist;
  } catch (error) {
    console.error('❌ Database test failed:', error.message);
    return false;
  }
}

testDatabase()
  .then(success => {
    if (success) {
      console.log('\n🎉 Database setup is complete! You can now sync WooCommerce data and use all features.');
    } else {
      console.log('\n❌ Database setup is incomplete. Please check the setup-database.md file.');
    }
    process.exit(success ? 0 : 1);
  })
  .catch(error => {
    console.error('💥 Unexpected error:', error);
    process.exit(1);
  });