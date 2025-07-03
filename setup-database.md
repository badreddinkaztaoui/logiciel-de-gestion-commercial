# Database Setup Instructions

## The Problem
You're getting the error `relation "public.orders" does not exist` because your Supabase database doesn't have the required tables created yet.

## Solution
You need to run the SQL schema to create all the necessary tables. Here are two ways to do it:

### Option 1: Using Supabase Dashboard (Recommended)

1. Go to your Supabase project dashboard
2. Navigate to **SQL Editor** in the left sidebar
3. Click **"New Query"**
4. Copy the entire content from `supabase-schema.sql` file
5. Paste it into the SQL editor
6. Click **"Run"** to execute the schema

### Option 2: Using Supabase CLI

If you have the Supabase CLI installed:

```bash
# Make sure you're logged in
supabase login

# Link your project (replace with your project reference)
supabase link --project-ref your-project-ref

# Run the migration
supabase db push
```

### What This Creates

The schema will create the following tables for your French business management application:

#### Core Tables
- `orders` - **Commands** (WooCommerce orders data)
- `customers` - **Clients** (Customer management)
- `suppliers` - **Fournisseurs** (Supplier management)

#### Document Management Tables
- `quotes` - **Devis** (Quote management)
- `invoices` - **Factures** (Invoice management with payment tracking)
- `delivery_notes` - **Bons de livraison** (Delivery notes and shipping)
- `return_notes` - **Bons de retour** (Return notes and refunds)
- `purchase_orders` - **Bons de commande** (Purchase orders to suppliers)
- `purchase_order_receives` - **Reception** (Tracking received items)

#### Business Intelligence
- `sales_journal` - **Journal De Vente** (Sales journal for accounting)

### Features Include

Each table includes:
- **Row Level Security (RLS)** policies for user data isolation
- **Proper indexes** for performance optimization
- **Foreign key relationships** for data integrity
- **JSON fields** for flexible data storage (line items, addresses, etc.)
- **Audit fields** (created_at, updated_at, user_id)

### Business Workflow Support

The schema supports complete French business document workflows:
1. **WooCommerce → Orders** (Automatic sync)
2. **Orders → Quotes** (Devis generation)
3. **Quotes → Invoices** (Facture creation)
4. **Invoices → Delivery Notes** (Bon de livraison)
5. **Delivery → Return Notes** (Bon de retour if needed)
6. **All → Sales Journal** (Accounting integration)
7. **Suppliers → Purchase Orders** (Procurement management)

### After Running the Schema

1. Refresh your application
2. Try the manual sync again
3. Your WooCommerce data should now sync properly to Supabase
4. All business document features will be available

### Verification

To verify the tables were created successfully, you can run this query in the SQL Editor:

```sql
SELECT table_name, table_comment
FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;
```

Or use the test script:

```bash
node test-database.js
```

You should see all the tables listed above with their French business context.