import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { Invoice, WooCommerceOrder, Customer } from '../types/index';
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
      postalCode: '',
      country: 'Maroc'
    },
    items: [],
    subtotal: 0,
    tax: 0,
    total: 0,
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
        postalCode: '',
        country: 'Maroc'
      },
      items: [{
        id: crypto.randomUUID(),
        description: '',
        quantity: 1,
        unitPrice: 0,
        total: 0,
        taxRate: 20,
        taxAmount: 0
      }],
      subtotal: 0,
      tax: 0,
      total: 0,
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
    let taxRate = 20;

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
    const taxRate100 = taxRate / 100;
    const totalHT = round2(totalTTC / (1 + taxRate100));
    const taxAmount = round2(totalHT * taxRate100);

    return {
      id: crypto.randomUUID(),
      productId: item.product_id,
      description: item.name || '',
      quantity,
      unitPrice: currentPriceTTC,
      total: totalTTC,
      taxRate,
      taxAmount
    };
  };

  const calculateTotalsFromItems = (items: any[]) => {
    const subtotal = round2(items.reduce((sum, item) => {
      const taxRate100 = (item.taxRate || 20) / 100;
      const itemHT = round2(item.total / (1 + taxRate100));
      return sum + itemHT;
    }, 0));

    const tax = round2(items.reduce((sum, item) => sum + (item.taxAmount || 0), 0));
    const total = round2(items.reduce((sum, item) => sum + item.total, 0));

    return { subtotal, tax, total };
  };

  const extractCustomerFromOrder = (order: WooCommerceOrder) => {
    const billing = order.billing || {};
    return {
      name: `${billing.first_name || ''} ${billing.last_name || ''}`.trim() || 'Client',
      email: billing.email || '',
      company: billing.company || '',
      address: `${billing.address_1 || ''}${billing.address_2 ? ` ${billing.address_2}` : ''}`,
      city: billing.city || '',
      postalCode: billing.postcode || '',
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

    if (!formData.items?.length) {
      newErrors.items = 'Au moins un article est requis';
    } else {
      formData.items.forEach((item, index) => {
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
      setFormData(prev => ({
        ...prev,
        customer: {
          name: `${customer.firstName} ${customer.lastName}`.trim(),
          email: customer.email,
          company: customer.company || '-',
          address: customer.address || '',
          city: customer.city || '',
          postalCode: customer.postalCode || '',
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
      const newTotalTTC = round2(newItems[index].quantity * newItems[index].unitPrice);
      newItems[index].total = newTotalTTC;

      const taxRate = (newItems[index].taxRate || 20) / 100;
      const totalHT = round2(newTotalTTC / (1 + taxRate));
      newItems[index].taxAmount = round2(totalHT * taxRate);
    }

    if (field === 'taxRate') {
      const totalTTC = newItems[index].total;
      const taxRate = parseFloat(value) / 100;
      const totalHT = round2(totalTTC / (1 + taxRate));
      newItems[index].taxAmount = round2(totalHT * taxRate);
    }

    setFormData(prev => ({
      ...prev,
      items: newItems
    }));
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
          total: 0,
          taxRate: 20,
          taxAmount: 0
        }
      ]
    }));
  };

  const handleRemoveItem = (index: number) => {
    setFormData(prev => ({
      ...prev,
      items: prev.items?.filter((_, i) => i !== index) || []
    }));
  };

  const handleProductSelect = (product: ProductWithQuantity) => {
    const priceTTC = round2(parseFloat(product.price));
    const totalTTC = round2(priceTTC * product.quantity);
    const totalHT = round2(totalTTC / (1 + product.taxRate / 100));
    const taxAmount = round2(totalHT * (product.taxRate / 100));

    const newItem = {
      id: crypto.randomUUID(),
      description: product.name,
      quantity: product.quantity,
      unitPrice: priceTTC,
      total: totalTTC,
      productId: product.id,
      sku: product.sku,
      taxRate: product.taxRate,
      taxAmount: taxAmount
    };

    setFormData(prev => ({
      ...prev,
      items: [...(prev.items || []), newItem]
    }));
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