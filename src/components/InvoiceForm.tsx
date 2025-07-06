import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { Invoice, WooCommerceOrder, Customer, Quote } from '../types/index';
import { invoiceService } from '../services/invoiceService';
import { customerService } from '../services/customerService';
import { wooCommerceService } from '../services/woocommerce';
import ProductSearch from './ProductSearch';
import type { ProductWithQuantity } from './ProductSearch';

import InvoiceHeader from './invoice/InvoiceHeader';
import InvoiceGeneralInfo from './invoice/InvoiceGeneralInfo';
import InvoiceCustomerInfo from './invoice/InvoiceCustomerInfo';
import InvoiceItems from './invoice/InvoiceItems';
import InvoiceTotals from './invoice/InvoiceTotals';
import InvoiceNotes from './invoice/InvoiceNotes';

interface LocationState {
  sourceOrder?: WooCommerceOrder;
  sourceQuote?: Quote;
}

const InvoiceForm: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const locationState = location.state as LocationState;

  const [formData, setFormData] = useState<Partial<Invoice>>({
    id: '',
    number: '',
    date: new Date().toISOString().split('T')[0],
    dueDate: '',
    status: 'draft',
    customer: {
      name: '',
      email: '',
      company: '',
      address: '',
      city: '',
      postal_code: '',
      country: 'Maroc'
    },
    items: [],
    subtotal: 0,
    tax: 0,
    taxRate: 0,
    total: 0,
    currency: 'MAD',
    notes: ''
  });

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
  const [customerSearchTerm, setCustomerSearchTerm] = useState('');
  const [errors, setErrors] = useState<{[key: string]: string}>({});
  const [showProductSearch, setShowProductSearch] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [_, setIsInitialized] = useState(false);
  const [isLoadingProducts, setIsLoadingProducts] = useState(false);
  const [productLoadingStatus, setProductLoadingStatus] = useState<string>('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadCustomers = async () => {
      try {
        const savedCustomers = await customerService.getCustomers();
        if (savedCustomers) {
          setCustomers(savedCustomers as unknown as Customer[]);
        } else {
          setCustomers([]);
        }
      } catch (error) {
        console.error('Error loading customers:', error);
        setCustomers([]);
      }
    };

    loadCustomers();
  }, []);

  // Initialize form data
  useEffect(() => {
    const initializeForm = async () => {
      setLoading(true);

      try {
        if (id) {
          const invoice = await invoiceService.getInvoiceById(id);
          if (invoice) {
            setFormData(invoice);
          } else {
            console.error('Invoice not found');
            navigate('/invoices');
            return;
          }
        } else if (locationState?.sourceOrder) {
          await initializeFromWooCommerceOrder(locationState.sourceOrder);
        } else if (locationState?.sourceQuote) {
          await initializeFromQuote(locationState.sourceQuote);
        } else {
          await initializeBlankInvoice();
        }

        setIsInitialized(true);
      } catch (error) {
        console.error('Error initializing form:', error);
        navigate('/invoices');
      } finally {
        setLoading(false);
      }
    };

    initializeForm();
  }, [id, locationState, navigate]);

  const initializeBlankInvoice = async () => {
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 30);

    const blankFormData = {
      id: crypto.randomUUID(),
      number: '',
      date: new Date().toISOString().split('T')[0],
      dueDate: dueDate.toISOString().split('T')[0],
      status: 'draft' as const,
      customer: {
        name: '',
        email: '',
        company: '',
        address: '',
        city: '',
        postal_code: '',
        country: 'Maroc'
      },
      items: [],
      subtotal: 0,
      tax: 0,
      taxRate: 0,
      total: 0,
      currency: 'MAD',
      notes: ''
    };

    setFormData(blankFormData);
  };

  const initializeFromWooCommerceOrder = async (order: WooCommerceOrder) => {
    setIsLoadingProducts(true);
    setProductLoadingStatus('Initialisation...');

    try {
      await wooCommerceService.initializeTaxData();
      const processedItems = await processOrderItems(order);
      const totals = calculateTotalsFromItems(processedItems);

      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + 30);

      const invoiceData = {
        id: crypto.randomUUID(),
        number: '',
        orderId: order.id,
        date: new Date().toISOString().split('T')[0],
        dueDate: dueDate.toISOString().split('T')[0],
        status: 'draft' as const,
        customer: extractCustomerFromOrder(order),
        items: processedItems,
        ...totals,
        notes: `Facture générée à partir de la commande WooCommerce #${order.number || order.id}`
      };

      setFormData(invoiceData);
    } catch (error) {
      console.error('Error initializing from order:', error);
      await initializeBlankInvoice();
    } finally {
      setIsLoadingProducts(false);
      setProductLoadingStatus('');
    }
  };

  const processOrderItems = async (order: WooCommerceOrder) => {
    const items = [];
    for (const item of order.line_items || []) {
      setProductLoadingStatus(`Traitement du produit: ${item.name}`);

      const processedItem = await processOrderItem(item);
      items.push(processedItem);
    }
    return items;
  };

  const processOrderItem = async (item: any) => {
    let currentPriceTTC = 0;
    let taxRate = 0;

    try {
      if (item.product_id) {
        const freshProduct = await wooCommerceService.getProduct(item.product_id);
        if (freshProduct?.price) {
          currentPriceTTC = parseFloat(freshProduct.price);
          if (freshProduct.tax_class !== undefined) {
            taxRate = wooCommerceService.getTaxRateForClass(freshProduct.tax_class);
          }
        } else {
          currentPriceTTC = parseFloat(item.price || '0');
        }
      } else {
        currentPriceTTC = parseFloat(item.price || '0');
      }
    } catch (error) {
      currentPriceTTC = parseFloat(item.price || '0');
    }

    const quantity = parseInt(item.quantity?.toString() || '1');
    const totalTTC = round2(currentPriceTTC * quantity);

    // For 0% TVA, HT = TTC
    if (taxRate === 0) {
      return {
        id: crypto.randomUUID(),
        productId: item.product_id,
        description: item.name || '',
        quantity,
        unitPrice: currentPriceTTC,
        unitPriceHT: currentPriceTTC, // Same as TTC for 0% TVA
        total: totalTTC,
        totalHT: totalTTC, // Same as TTC for 0% TVA
        taxRate: 0,
        taxAmount: 0
      };
    } else {
      // Calculate HT for products with TVA
      const taxRate100 = taxRate / 100;
      const unitPriceHT = round2(currentPriceTTC / (1 + taxRate100));
      const totalHT = round2(unitPriceHT * quantity);
      const taxAmount = round2(totalHT * taxRate100);

      return {
        id: crypto.randomUUID(),
        productId: item.product_id,
        description: item.name || '',
        quantity,
        unitPrice: currentPriceTTC,
        unitPriceHT: unitPriceHT,
        total: totalTTC,
        totalHT: totalHT,
        taxRate,
        taxAmount
      };
    }
  };

  const calculateTotalsFromItems = (items: any[]) => {
    // Group items by tax rate
    const itemsByTaxRate: { [key: number]: any[] } = {};
    items.forEach(item => {
      const rate = item.taxRate || 0;
      if (!itemsByTaxRate[rate]) {
        itemsByTaxRate[rate] = [];
      }
      itemsByTaxRate[rate].push(item);
    });

    let subtotal = 0;
    let totalTax = 0;

    // Calculate subtotal and tax for each tax rate group
    Object.entries(itemsByTaxRate).forEach(([taxRate, groupItems]) => {
      const rate = parseFloat(taxRate);
      const groupSubtotal = groupItems.reduce((sum, item) => {
        if (rate > 0) {
          // For items with tax, calculate HT price
          const taxRate100 = rate / 100;
          const itemHT = round2(item.total / (1 + taxRate100));
          return sum + itemHT;
        } else {
          // For items without tax, use total as is
          return sum + item.total;
        }
      }, 0);

      subtotal += groupSubtotal;
      if (rate > 0) {
        totalTax += round2(groupSubtotal * (rate / 100));
      }
    });

    subtotal = round2(subtotal);
    totalTax = round2(totalTax);
    const total = round2(subtotal + totalTax);

    return {
      subtotal,
      tax: totalTax,
      total,
      // We don't set a global taxRate anymore as it's per item
    };
  };

  const extractCustomerFromOrder = (order: WooCommerceOrder) => {
    const billing = order.billing || {};
    return {
      name: `${billing.first_name || ''} ${billing.last_name || ''}`.trim() || 'Client',
      email: billing.email || '',
      company: billing.company || '',
      address: `${billing.address_1 || ''}${billing.address_2 ? ` ${billing.address_2}` : ''}`,
      city: billing.city || '',
      postal_code: billing.postcode || '',
      country: billing.country || 'MA'
    };
  };

  const round2 = (num: number): number => {
    return Math.round((num + Number.EPSILON) * 100) / 100;
  };

  const handleCancel = () => {
    navigate('/invoices');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);

    try {
      const invoice = formData as Invoice;
      await invoiceService.saveInvoice(invoice);
      navigate('/invoices');
    } catch (error) {
      console.error('Error saving invoice:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const validateForm = (): boolean => {
    const newErrors: {[key: string]: string} = {};

    if (!formData.customer?.name?.trim()) {
      newErrors.customerName = 'Le nom du client est requis';
    }

    // Only validate items if they exist
    const items = formData.items || [];
    if (items.length > 0) {
      items.forEach((item, index) => {
        if (!item.description.trim()) {
          newErrors[`item_${index}_description`] = 'Description requise';
        }
        if (item.quantity <= 0) {
          newErrors[`item_${index}_quantity`] = 'Quantité invalide';
        }
        if (item.unitPrice < 0) {
          newErrors[`item_${index}_price`] = 'Prix invalide';
        }
      });
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleFieldChange = (field: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleCustomerChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      customer: {
        ...prev.customer!,
        [field]: field === 'company' ? (value || '-') : (value || '')
      }
    }));

    if (selectedCustomerId) {
      setSelectedCustomerId('');
    }
  };

  const handleCustomerSelect = (customerId: string) => {
    setSelectedCustomerId(customerId);

    const customer = customers.find(c => c.id === customerId);
    if (customer) {
      const fullName = [
        customer.first_name || '',
        customer.last_name || ''
      ].filter(Boolean).join(' ');

      setFormData(prev => ({
        ...prev,
        customerId: customer.id,
        customer: {
          name: fullName || 'Client',
          email: customer.email || '',
          company: customer.company || '-',
          address: customer.address || '',
          city: customer.city || '',
          postal_code: customer.postal_code || '',
          country: customer.country || 'MA'
        }
      }));
    }
  };

  const handleItemChange = (index: number, field: string, value: any) => {
    const newItems = [...(formData.items || [])];
    newItems[index] = {
      ...newItems[index],
      [field]: value
    };

    if (field === 'quantity' || field === 'unitPrice') {
      const item = newItems[index];
      const totalTTC = round2(item.quantity * item.unitPrice);

      if (item.taxRate === 0) {
        // For 0% TVA, HT = TTC
        newItems[index] = {
          ...item,
          total: totalTTC,
          unitPriceHT: item.unitPrice,
          totalHT: totalTTC,
          taxAmount: 0
        };
      } else {
        // Calculate HT for products with TVA
        const taxRate100 = item.taxRate / 100;
        const unitPriceHT = round2(item.unitPrice / (1 + taxRate100));
        const totalHT = round2(unitPriceHT * item.quantity);
        const taxAmount = round2(totalHT * taxRate100);

        newItems[index] = {
          ...item,
          total: totalTTC,
          unitPriceHT: unitPriceHT,
          totalHT: totalHT,
          taxAmount: taxAmount
        };
      }
    }

    setFormData(prev => {
      const totals = calculateTotalsFromItems(newItems);
      return {
        ...prev,
        items: newItems,
        ...totals
      };
    });
  };

  const handleAddItem = () => {
    setFormData(prev => ({
      ...prev,
      items: [
        ...(prev.items || []),
        {
          id: crypto.randomUUID(),
          description: '',
          quantity: 1,
          unitPrice: 0,
          unitPriceHT: 0,
          total: 0,
          totalHT: 0,
          taxRate: 0,
          taxAmount: 0
        }
      ]
    }));
  };

  const handleRemoveItem = (index: number) => {
    setFormData(prev => {
      const updatedItems = prev.items?.filter((_, i) => i !== index) || [];
      const totals = calculateTotalsFromItems(updatedItems);

      return {
        ...prev,
        items: updatedItems,
        ...totals
      };
    });
  };

  const handleProductSelect = (product: ProductWithQuantity) => {
    const priceTTC = round2(parseFloat(product.price));
    const totalTTC = round2(priceTTC * product.quantity);

    let unitPriceHT = priceTTC;
    let totalHT = totalTTC;
    let taxAmount = 0;

    if (product.taxRate > 0) {
      const taxRate100 = product.taxRate / 100;
      unitPriceHT = round2(priceTTC / (1 + taxRate100));
      totalHT = round2(unitPriceHT * product.quantity);
      taxAmount = round2(totalHT * taxRate100);
    }

    const newItem = {
      id: crypto.randomUUID(),
      description: product.name,
      quantity: product.quantity,
      unitPrice: priceTTC,
      unitPriceHT: unitPriceHT,
      total: totalTTC,
      totalHT: totalHT,
      productId: product.id,
      sku: product.sku,
      taxRate: product.taxRate || 0,
      taxAmount: taxAmount
    };

    setFormData(prev => {
      const updatedItems = [...(prev.items || []), newItem];
      const totals = calculateTotalsFromItems(updatedItems);

      return {
        ...prev,
        items: updatedItems,
        ...totals
      };
    });
  };

  const initializeFromQuote = async (quote: Quote) => {
    setIsLoadingProducts(true);
    setProductLoadingStatus('Initialisation à partir du devis...');

    try {
      // Convert quote items to invoice items format
      const invoiceItems = quote.items.map(item => ({
        id: crypto.randomUUID(),
        description: item.description,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        unitPriceHT: item.unitPrice, // For now, assuming prices are HT
        total: item.total,
        totalHT: item.total,
        taxRate: 20, // Default tax rate
        taxAmount: round2(item.total * 0.2),
        sku: `ITEM-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
      }));

      // Calculate totals using the same logic as for orders
      const totals = calculateTotalsFromItems(invoiceItems);

      // Generate due date (30 days from today)
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + 30);

      const invoiceData = {
        id: crypto.randomUUID(),
        number: '',
        date: new Date().toISOString().split('T')[0],
        dueDate: dueDate.toISOString().split('T')[0],
        status: 'draft' as const,
        customer: {
          name: quote.customer.name,
          email: quote.customer.email,
          company: quote.customer.company || '',
          address: quote.customer.address,
          city: quote.customer.city,
          postal_code: '',
          country: 'Maroc'
        },
        items: invoiceItems,
        ...totals,
        notes: `Facture générée à partir du devis ${quote.number}. ${quote.notes || ''}`.trim()
      };

      setFormData(invoiceData);
    } catch (error) {
      console.error('Error initializing from quote:', error);
      await initializeBlankInvoice();
    } finally {
      setIsLoadingProducts(false);
      setProductLoadingStatus('');
    }
  };

  if (loading || isLoadingProducts) {
    return (
      <div className="h-full flex flex-col">
        <div className="flex-1 px-6 py-4">
          <div className="flex items-center justify-center h-full">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 max-w-md w-full">
              <div className="text-center">
                <Loader2 className="w-12 h-12 text-blue-500 animate-spin mx-auto mb-4" />
                <h2 className="text-xl font-semibold text-gray-900 mb-2">
                  {isLoadingProducts ? 'Récupération des prix actuels' : 'Chargement...'}
                </h2>
                {productLoadingStatus && (
                  <p className="text-gray-600">{productLoadingStatus}</p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Fixed Header Section */}
      <div className="flex-none bg-white px-6 py-4 border-b">
        <InvoiceHeader
          id={id}
          isSubmitting={isSubmitting}
          sourceOrder={locationState?.sourceOrder}
          onCancel={handleCancel}
          onSubmit={handleSubmit}
        />
      </div>

      {/* Scrollable Content Section */}
      <div className="flex-1 px-6 py-4 overflow-auto">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <InvoiceGeneralInfo
              formData={formData}
              onFieldChange={handleFieldChange}
            />
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <InvoiceCustomerInfo
              customer={formData.customer!}
              customers={customers}
              customerSearchTerm={customerSearchTerm}
              selectedCustomerId={selectedCustomerId}
              errors={errors}
              onCustomerChange={handleCustomerChange}
              onCustomerSelect={handleCustomerSelect}
              onSearchTermChange={setCustomerSearchTerm}
              isEditMode={!!id}
            />
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <InvoiceItems
              items={formData.items || []}
              sourceOrder={locationState?.sourceOrder}
              onItemChange={handleItemChange}
              onAddItem={handleAddItem}
              onRemoveItem={handleRemoveItem}
              onShowProductSearch={() => setShowProductSearch(true)}
              errors={errors}
            />
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <InvoiceTotals
              subtotal={formData.subtotal || 0}
              tax={formData.tax || 0}
              total={formData.total || 0}
              items={formData.items || []}
              sourceOrder={locationState?.sourceOrder}
            />
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <InvoiceNotes
              notes={formData.notes || ''}
              onChange={(notes) => handleFieldChange('notes', notes)}
            />
          </div>
        </form>
      </div>

      {showProductSearch && (
        <ProductSearch
          onSelect={handleProductSelect}
          onClose={() => setShowProductSearch(false)}
        />
      )}
    </div>
  );
};

export default InvoiceForm;