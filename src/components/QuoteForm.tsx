import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { Quote, WooCommerceOrder, Customer } from '../types';
import { quoteService } from '../services/quoteService';
import { customerService } from '../services/customerService';
import { wooCommerceService } from '../services/woocommerce';
import ProductSearch from './ProductSearch';
import type { ProductWithQuantity } from './ProductSearch';

import QuoteHeader from './quote/QuoteHeader';
import QuoteGeneralInfo from './quote/QuoteGeneralInfo';
import QuoteCustomerInfo from './quote/QuoteCustomerInfo';
import QuoteItems from './quote/QuoteItems';
import QuoteTotals from './quote/QuoteTotals';
import QuoteNotes from './quote/QuoteNotes';

interface LocationState {
  sourceOrder?: WooCommerceOrder;
}

// Extended item type with additional fields for display
interface ExtendedQuoteItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
  unitPriceHT?: number;
  totalHT?: number;
  taxRate?: number;
  taxAmount?: number;
  productId?: number;
  sku?: string;
}

const QuoteForm: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const locationState = location.state as LocationState;

  const [formData, setFormData] = useState<Partial<Quote & { items: ExtendedQuoteItem[] }>>({
    id: '',
    number: '',
    date: new Date().toISOString().split('T')[0],
    validUntil: '',
    status: 'draft',
    customer: {
      name: '',
      email: '',
      company: '',
      address: '',
      city: ''
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
          const quote = await quoteService.getQuote(id);
          if (quote) {
            // Convert basic items to extended items
            const extendedItems: ExtendedQuoteItem[] = quote.items.map(item => ({
              id: crypto.randomUUID(),
              description: item.description,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              total: item.total,
              unitPriceHT: item.unitPrice, // Default to same as unitPrice for display
              totalHT: item.total,
              taxRate: 0,
              taxAmount: 0
            }));

            setFormData({
              ...quote,
              items: extendedItems
            });
          } else {
            console.error('Quote not found');
            navigate('/quotes');
            return;
          }
        } else if (locationState?.sourceOrder) {
          await initializeFromWooCommerceOrder(locationState.sourceOrder);
        } else {
          await initializeBlankQuote();
        }

        setIsInitialized(true);
      } catch (error) {
        console.error('Error initializing form:', error);
        navigate('/quotes');
      } finally {
        setLoading(false);
      }
    };

    initializeForm();
  }, [id, locationState, navigate]);

  const initializeBlankQuote = async () => {
    const validUntil = new Date();
    validUntil.setDate(validUntil.getDate() + 30);

    const blankFormData = {
      id: crypto.randomUUID(),
      number: '',
      date: new Date().toISOString().split('T')[0],
      validUntil: validUntil.toISOString().split('T')[0],
      status: 'draft' as const,
      customer: {
        name: '',
        email: '',
        company: '',
        address: '',
        city: ''
      },
      items: [],
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

      const validUntil = new Date();
      validUntil.setDate(validUntil.getDate() + 30);

      const quoteData = {
        id: crypto.randomUUID(),
        number: '',
        orderId: order.id,
        date: new Date().toISOString().split('T')[0],
        validUntil: validUntil.toISOString().split('T')[0],
        status: 'draft' as const,
        customer: extractCustomerFromOrder(order),
        items: processedItems,
        ...totals,
        notes: `Devis généré à partir de la commande WooCommerce #${order.number || order.id}`
      };

      setFormData(quoteData);
    } catch (error) {
      console.error('Error initializing from order:', error);
      await initializeBlankQuote();
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

  const processOrderItem = async (item: any): Promise<ExtendedQuoteItem> => {
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

  const calculateTotalsFromItems = (items: ExtendedQuoteItem[]) => {
    // Group items by tax rate
    const itemsByTaxRate: { [key: number]: ExtendedQuoteItem[] } = {};
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
      total
    };
  };

  const extractCustomerFromOrder = (order: WooCommerceOrder) => {
    const billing = order.billing || {};
    return {
      name: `${billing.first_name || ''} ${billing.last_name || ''}`.trim() || 'Client',
      email: billing.email || '',
      company: billing.company || '',
      address: `${billing.address_1 || ''}${billing.address_2 ? ` ${billing.address_2}` : ''}`,
      city: billing.city || ''
    };
  };

  const round2 = (num: number): number => {
    return Math.round((num + Number.EPSILON) * 100) / 100;
  };

  const handleCancel = () => {
    navigate('/quotes');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);

    try {
      // Convert extended items back to basic items for the API
      const basicItems = (formData.items || []).map(item => ({
        description: item.description,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        total: item.total
      }));

      const quoteData: Partial<Quote> = {
        ...formData,
        items: basicItems
      };

      if (id) {
        await quoteService.updateQuote(id, quoteData);
      } else {
        await quoteService.createQuote(quoteData);
      }

      navigate('/quotes');
    } catch (error) {
      console.error('Error saving quote:', error);
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
        [field]: value || ''
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
          company: customer.company || '',
          address: customer.address || '',
          city: customer.city || ''
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

      if ((item.taxRate || 0) === 0) {
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
        const taxRate100 = (item.taxRate || 0) / 100;
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
      const currentItems = (prev.items || []) as ExtendedQuoteItem[];
      const updatedItems = currentItems.filter((_, i) => i !== index);
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

    const newItem: ExtendedQuoteItem = {
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

  // Create customer with the correct interface for components that expect postal_code and country
  const customerForComponents = {
    name: formData.customer?.name || '',
    email: formData.customer?.email || '',
    company: formData.customer?.company || '',
    address: formData.customer?.address || '',
    city: formData.customer?.city || '',
    postal_code: '', // Not used in Quote but needed for component interface
    country: 'Maroc' // Default value for component interface
  };

  return (
    <div className="h-full flex flex-col">
      {/* Fixed Header Section */}
      <div className="flex-none bg-white px-6 py-4 border-b">
        <QuoteHeader
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
            <QuoteGeneralInfo
              formData={formData}
              onFieldChange={handleFieldChange}
            />
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <QuoteCustomerInfo
              customer={customerForComponents}
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
            <QuoteItems
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
            <QuoteTotals
              subtotal={formData.subtotal || 0}
              tax={formData.tax || 0}
              total={formData.total || 0}
              items={formData.items || []}
              sourceOrder={locationState?.sourceOrder}
            />
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <QuoteNotes
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

export default QuoteForm;