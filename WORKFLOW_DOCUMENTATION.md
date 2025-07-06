# 📋 **Application Workflow Documentation**

## 🔄 **Document Conversion Workflows**

This application now supports a complete document lifecycle with seamless conversions between different document types.

### **1. Quote to Invoice Conversion**

**Flow**: `Devis` → `Facture`

**Usage**:
```typescript
// In the UI
const handleConvertToInvoice = async (quote: Quote) => {
  const invoiceData = await quoteService.convertToInvoice(quote.id);
  const savedInvoice = await invoiceService.saveInvoice(invoiceData);
};
```

**Requirements**:
- Quote status must be `accepted` (bypassed with user confirmation)
- Automatically generates invoice number using the numbering system
- Preserves customer information and items
- Sets 30-day due date by default

---

### **2. Invoice to Delivery Note Conversion**

**Flow**: `Facture` → `Bon de Livraison`

**Usage**:
```typescript
// Create delivery note from invoice
const deliveryNote = await deliveryNoteService.createFromInvoice(invoiceId);
```

**Features**:
- Copies all invoice items with delivery tracking
- Links delivery note to original invoice
- Tracks delivery status (`draft` → `in_transit` → `delivered`)
- Integrates with WooCommerce stock management

---

### **3. Invoice to Return Note Conversion**

**Flow**: `Facture` → `Bon de Retour`

**Usage**:
```typescript
// Create return note from invoice
const returnNote = await returnNoteService.createFromInvoice(invoiceId, reason);
```

**Requirements**:
- Invoice status must be `paid`
- Supports custom return reasons
- Tracks item conditions (`new`, `used`, `damaged`)
- Calculates refund amounts

---

### **4. Delivery Note to Return Note Conversion**

**Flow**: `Bon de Livraison` → `Bon de Retour`

**Usage**:
```typescript
// Create return note from delivery note
const returnNote = await returnNoteService.createFromDeliveryNote(deliveryNoteId, reason);
```

**Requirements**:
- Delivery note status must be `delivered`
- Only delivered quantities can be returned

---

### **5. Purchase Order Creation for Suppliers**

**Flow**: `Fournisseur` → `Bon de Commande`

**Usage**:
```typescript
// Create purchase order for supplier
const purchaseOrder = await purchaseOrderService.createFromSupplier(supplierId, items);
```

**Features**:
- Automatic total calculations with tax
- Supplier information integration
- Stock management integration
- Status tracking (`draft` → `sent` → `confirmed` → `received`)

---

## 🔢 **Document Numbering System**

All documents use a robust numbering system with the following prefixes:

| Document Type | Prefix | Format | Example |
|---------------|--------|--------|---------|
| Quote | `F D` | F D YYYY#### | F D 20250001 |
| Invoice | `F A` | F A YYYY#### | F A 20250001 |
| Delivery Note | `F L` | F L YYYY#### | F L 20250001 |
| Return Note | `F R` | F R YYYY#### | F R 20250001 |
| Purchase Order | `F PO` | F PO YYYY#### | F PO 20250001 |
| Sales Journal | `F G` | F G YYYY#### | F G 20250001 |

**Features**:
- **Automatic generation** with retry logic for concurrent access
- **Year-based sequences** that reset annually
- **Fallback numbering** when primary system fails
- **Conflict resolution** for simultaneous requests

---

## 🛠 **CRUD Operations Guide**

### **Quotes (Devis)**

```typescript
// Create
const quote = await quoteService.createQuote(quoteData);

// Read
const quotes = await quoteService.getQuotes();
const quote = await quoteService.getQuote(id);

// Update
const updatedQuote = await quoteService.updateQuote(id, quoteData);

// Delete
await quoteService.deleteQuote(id);

// Convert to Invoice
const invoiceData = await quoteService.convertToInvoice(quoteId);
```

### **Invoices (Factures)**

```typescript
// Create
const invoice = await invoiceService.saveInvoice(invoiceData);

// Read
const invoices = await invoiceService.getInvoices();
const invoice = await invoiceService.getInvoiceById(id);

// Update
const updatedInvoice = await invoiceService.saveInvoice(invoiceData);

// Convert to Delivery Note
const deliveryNoteData = await invoiceService.convertToDeliveryNote(invoiceId);

// Convert to Return Note
const returnNoteData = await invoiceService.convertToReturnNote(invoiceId, reason);
```

### **Delivery Notes (Bons de Livraison)**

```typescript
// Create
const deliveryNote = await deliveryNoteService.createDeliveryNote(noteData);

// Create from Invoice
const deliveryNote = await deliveryNoteService.createFromInvoice(invoiceId);

// Update Status
await deliveryNoteService.markAsInTransit(id);
await deliveryNoteService.markAsDelivered(id);
```

### **Return Notes (Bons de Retour)**

```typescript
// Create
const returnNote = await returnNoteService.createReturnNote(noteData);

// Create from Invoice
const returnNote = await returnNoteService.createFromInvoice(invoiceId, reason);

// Create from Delivery Note
const returnNote = await returnNoteService.createFromDeliveryNote(deliveryNoteId, reason);

// Process Return
await returnNoteService.processReturnNote(id);
```

### **Purchase Orders (Bons de Commande)**

```typescript
// Create
const purchaseOrder = await purchaseOrderService.createPurchaseOrder(orderData);

// Create from Supplier
const purchaseOrder = await purchaseOrderService.createFromSupplier(supplierId, items);

// Update Status
await purchaseOrderService.markAsSent(id);
await purchaseOrderService.markAsConfirmed(id);

// Receive Items
await purchaseOrderService.receiveItems(receiveData);
```

### **Suppliers (Fournisseurs)**

```typescript
// Create
const supplier = await supplierService.createSupplier(supplierData);

// Read
const suppliers = await supplierService.getSuppliers();
const supplier = await supplierService.getSupplier(id);

// Update
const updatedSupplier = await supplierService.updateSupplier(id, supplierData);

// Delete
await supplierService.deleteSupplier(id);
```

---

## 📊 **Statistics & Analytics**

Each service provides comprehensive statistics:

```typescript
// Quote Statistics
const quoteStats = await quoteService.getQuoteStats();
// Returns: { total, draft, sent, accepted, rejected, expired, totalValue, acceptedValue, pendingValue }

// Invoice Statistics
const invoiceStats = await invoiceService.getInvoiceStats();
// Returns: { total, draft, sent, paid, overdue, totalValue, paidValue, pendingValue }

// Delivery Note Statistics
const deliveryStats = await deliveryNoteService.getDeliveryNoteStats();
// Returns: { total, draft, inTransit, delivered, cancelled, totalItems, pendingDeliveries }

// Return Note Statistics
const returnStats = await returnNoteService.getReturnNoteStats();
// Returns: { total, draft, processed, cancelled, totalItems, totalRefundValue, pendingReturns }

// Purchase Order Statistics
const purchaseStats = await purchaseOrderService.getPurchaseOrderStats();
// Returns: { total, draft, sent, confirmed, received, cancelled, totalValue, pendingValue, receivedValue }
```

---

## 🔧 **Error Handling & Resilience**

The system includes comprehensive error handling:

### **Document Number Generation**
- **Retry Logic**: Up to 5 attempts with exponential backoff
- **Fallback Numbers**: Timestamp-based when primary system fails
- **Concurrent Protection**: Handles simultaneous number generation

### **Database Operations**
- **Constraint Handling**: Automatic retry for duplicate key violations
- **Transaction Safety**: Operations are atomic where possible
- **Graceful Degradation**: System continues functioning even if individual operations fail

### **WooCommerce Integration**
- **Sync Resilience**: Individual order failures don't break entire sync
- **Rate Limiting**: Strategic delays to prevent overwhelming the database
- **Batch Processing**: Orders processed in small batches to minimize conflicts

---

## 🚀 **Usage Examples**

### **Complete Quote-to-Invoice Workflow**

```typescript
// 1. Create a quote
const quote = await quoteService.createQuote({
  customer: customerData,
  items: quoteItems,
  // ... other quote data
});

// 2. Accept the quote
await quoteService.acceptQuote(quote.id);

// 3. Convert to invoice
const invoiceData = await quoteService.convertToInvoice(quote.id);
const invoice = await invoiceService.saveInvoice(invoiceData);

// 4. Create delivery note
const deliveryNote = await deliveryNoteService.createFromInvoice(invoice.id);

// 5. Mark as delivered
await deliveryNoteService.markAsDelivered(deliveryNote.id);

// 6. Handle returns if needed
const returnNote = await returnNoteService.createFromDeliveryNote(deliveryNote.id, "Customer request");
```

### **Supplier Purchase Order Workflow**

```typescript
// 1. Create or get supplier
const supplier = await supplierService.createSupplier({
  name: "GETRADIS",
  email: "contact@getradis.ma",
  // ... other supplier data
});

// 2. Create purchase order
const purchaseOrder = await purchaseOrderService.createFromSupplier(supplier.id, [
  { description: "Laptop", quantity: 10, unitPrice: 1500, total: 15000 }
]);

// 3. Send to supplier
await purchaseOrderService.markAsSent(purchaseOrder.id);

// 4. Receive confirmation
await purchaseOrderService.markAsConfirmed(purchaseOrder.id);

// 5. Receive items
await purchaseOrderService.receiveItems({
  purchaseOrderId: purchaseOrder.id,
  receiveDate: new Date().toISOString().split('T')[0],
  items: [{ id: "item1", productId: 123, quantity: 10, receivedQuantity: 10 }]
});
```

---

## ✅ **Quality Assurance**

The system ensures:

- **Data Integrity**: All conversions preserve essential information
- **Number Uniqueness**: Document numbers are guaranteed unique
- **Status Consistency**: Document statuses follow logical workflows
- **Audit Trail**: All operations are logged for tracking
- **Performance**: Optimized for concurrent operations
- **Scalability**: Handles high-volume document processing

This enhanced workflow system provides a complete document management solution with seamless conversions, robust numbering, and comprehensive error handling.