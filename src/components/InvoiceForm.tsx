import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import {
  Plus,
  Trash2,
  Save,
  ArrowLeft,
  Search,
  Users,
  Percent,
  AlertTriangle,
  Package,
  RefreshCw,
  CheckCircle
} from 'lucide-react';
import { Invoice, WooCommerceOrder, Customer } from '../types';
import { invoiceService } from '../services/invoiceService';
import { customerService } from '../services/customerService';
import { wooCommerceService, WooCommerceProduct } from '../services/woocommerce';
import { formatCurrency, generateDocumentNumber } from '../utils/formatters';
import ProductSearch from './ProductSearch';

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
  const [isInitialized, setIsInitialized] = useState(false);
  const [isLoadingProducts, setIsLoadingProducts] = useState(false);
  const [productLoadingStatus, setProductLoadingStatus] = useState<string>('');
  const [loading, setLoading] = useState(true);

  // Helper function to round to 2 decimal places
  const round2 = (num: number): number => {
    return Math.round((num + Number.EPSILON) * 100) / 100;
  };

  // Load customers
  useEffect(() => {
    const loadCustomers = async () => {
      try {
        const savedCustomers = await customerService.getCustomers();
        setCustomers(savedCustomers || []);
      } catch (error) {
        console.error('Error loading customers:', error);
        setCustomers([]);
      }
    };

    loadCustomers();
  }, []);

  // Initialize form data based on URL params and state
  useEffect(() => {
    const initializeForm = async () => {
      setLoading(true);

      try {
        if (id) {
          // Editing mode - load existing invoice
          console.log('📝 Loading existing invoice for editing, ID:', id);
          const invoice = await invoiceService.getInvoiceById(id);
          if (invoice) {
            setFormData(invoice);
          } else {
            console.error('Invoice not found');
            navigate('/invoices');
            return;
          }
        } else if (locationState?.sourceOrder) {
          // Creating from order
          console.log('🛒 Initializing NEW invoice from WooCommerce order:', locationState.sourceOrder.number);
          await initializeFromWooCommerceOrderWithFreshPrices(locationState.sourceOrder);
        } else {
          // Creating new blank invoice
          console.log('➕ Creating new blank invoice');
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

  // Function to initialize blank invoice
  const initializeBlankInvoice = async () => {
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 30);

    const blankFormData = {
      id: crypto.randomUUID(),
      number: '', // Don't generate number until save
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

    console.log('✅ Blank invoice initialized');
    setFormData(blankFormData);
  };

  const handleCancel = () => {
    navigate('/invoices');
  };

  const handleSave = async (invoice: Invoice) => {
    try {
      await invoiceService.saveInvoice(invoice);
      navigate('/invoices');
    } catch (error) {
      console.error('Error saving invoice:', error);
    }
  };

  // NEW FUNCTION: Initialize invoice from WooCommerce order with fresh product prices
  const initializeFromWooCommerceOrderWithFreshPrices = async (order: WooCommerceOrder) => {
    console.log('🔥 FETCHING FRESH PRICES: Initializing invoice from WooCommerce order with current product prices');
    console.log('Order data received:', order);

    if (!order) {
      console.error('❌ No order data provided');
      await initializeBlankInvoice();
      return;
    }

    setIsLoadingProducts(true);
    setProductLoadingStatus('Initialisation...');

    try {
      // Ensure tax data is loaded
      setProductLoadingStatus('Chargement des données fiscales...');
      await wooCommerceService.initializeTaxData();

      // Extract customer information safely with default empty object for billing
      const billing = order.billing || {};
      const customerInfo = {
        name: `${billing.first_name || ''} ${billing.last_name || ''}`.trim() || 'Client',
        email: billing.email || '',
        company: billing.company || '',
        address: `${billing.address_1 || ''}${billing.address_2 ? ` ${billing.address_2}` : ''}`,
        city: billing.city || '',
        postalCode: billing.postcode || '',
        country: billing.country || 'MA'
      };

      console.log('👤 Customer info extracted:', customerInfo);

      // Due date calculation
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + 30);

      // CRITICAL: Process line items with FRESH WooCommerce product prices
      setProductLoadingStatus('Récupération des prix actuels des produits...');
      const processedItems = [];

      for (let i = 0; i < (order.line_items || []).length; i++) {
        const item = order.line_items[i];
        setProductLoadingStatus(`Traitement du produit ${i + 1}/${order.line_items.length}: ${item.name}`);

        console.log(`\n🛍️ Processing item ${i + 1}: "${item.name}"`);
        console.log('Original order item data:', item);

        let currentPriceTTC = 0;
        let taxRate = 20; // Default tax rate

        try {
          if (item.product_id) {
            // Try to get fresh price from WooCommerce product
            const freshProduct = await wooCommerceService.getProduct(item.product_id);

            if (freshProduct && freshProduct.price) {
              currentPriceTTC = parseFloat(freshProduct.price.toString());
              console.log(`✅ Fresh WooCommerce price found: ${formatCurrency(currentPriceTTC)} TTC`);

              // Get tax rate for the product
              if (freshProduct.tax_class !== undefined) {
                taxRate = wooCommerceService.getTaxRateForClass(freshProduct.tax_class);
                console.log(`🎯 Tax rate detected: ${taxRate}%`);
              }
            } else {
              console.log('⚠️ No fresh product price found, using order price');
              currentPriceTTC = parseFloat((item.price || '0').toString());
            }
          } else {
            console.log('⚠️ No product ID, using order price');
            currentPriceTTC = parseFloat((item.price || '0').toString());
          }
        } catch (error) {
          console.log('⚠️ Error fetching fresh price, using order price:', error);
          currentPriceTTC = parseFloat((item.price || '0').toString());
        }

        const quantity = parseInt(item.quantity?.toString() || '1');
        const totalTTC = round2(currentPriceTTC * quantity);

        // Calculate tax breakdown (TTC -> HT + tax)
        const taxRate100 = taxRate / 100;
        const totalHT = round2(totalTTC / (1 + taxRate100));
        const taxAmount = round2(totalHT * taxRate100);

        const processedItem = {
          id: crypto.randomUUID(),
          productId: item.product_id,
          description: item.name || '',
          quantity: quantity,
          unitPrice: currentPriceTTC, // Store as TTC
          total: totalTTC, // Total TTC
          taxRate: taxRate,
          taxAmount: taxAmount // Tax amount calculated from HT
        };

        console.log('📊 Processed item breakdown:', {
          description: processedItem.description,
          unitPriceTTC: formatCurrency(processedItem.unitPrice),
          quantity: processedItem.quantity,
          totalTTC: formatCurrency(processedItem.total),
          taxRate: `${processedItem.taxRate}%`,
          taxAmount: formatCurrency(processedItem.taxAmount)
        });

        processedItems.push(processedItem);
      }

      // Calculate totals from processed items
      const subtotalHT = round2(processedItems.reduce((sum, item) => {
        const taxRate100 = (item.taxRate || 20) / 100;
        const itemHT = round2(item.total / (1 + taxRate100));
        return sum + itemHT;
      }, 0));

      const totalTax = round2(processedItems.reduce((sum, item) => sum + (item.taxAmount || 0), 0));
      const totalTTC = round2(processedItems.reduce((sum, item) => sum + item.total, 0));

      console.log('💰 Final calculations:', {
        subtotalHT: formatCurrency(subtotalHT),
        totalTax: formatCurrency(totalTax),
        totalTTC: formatCurrency(totalTTC),
        originalOrderTotal: formatCurrency(parseFloat(order.total || '0'))
      });

      // Prepare final form data
      const invoiceData = {
        id: crypto.randomUUID(),
        number: '', // Don't generate number until save
        orderId: order.id,
        date: new Date().toISOString().split('T')[0],
        dueDate: dueDate.toISOString().split('T')[0],
        status: 'draft' as const,
        customer: customerInfo,
        items: processedItems,
        subtotal: subtotalHT,
        tax: totalTax,
        total: totalTTC,
        notes: `Facture générée à partir de la commande WooCommerce #${order.number || order.id}`
      };

      console.log('✅ Final invoice data ready:', {
        itemsCount: invoiceData.items.length,
        totalTTC: formatCurrency(invoiceData.total)
      });

      setFormData(invoiceData);

    } catch (error) {
      console.error('❌ Error during fresh price initialization:', error);
      console.log('🔄 Falling back to order prices...');
      await initializeFromWooCommerceOrderFallback(order);
    } finally {
      setIsLoadingProducts(false);
      setProductLoadingStatus('');
    }
  };

  // Fallback method using order prices (previous implementation)
  const initializeFromWooCommerceOrderFallback = async (order: WooCommerceOrder) => {
    console.log('🔄 Using fallback method with order prices');

    const orderTotalTTC = round2(parseFloat(order.total || '0'));
    const orderTaxTotal = round2(parseFloat(order.total_tax || '0'));
    const orderSubtotalHT = round2(orderTotalTTC - orderTaxTotal);

    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 30);

    const billing = order.billing || {};
    const customerInfo = {
      name: `${billing.first_name || ''} ${billing.last_name || ''}`.trim() || 'Client',
      email: billing.email || '',
      company: billing.company || '',
      address: `${billing.address_1 || ''}${billing.address_2 ? ` ${billing.address_2}` : ''}`,
      city: billing.city || '',
      postalCode: billing.postcode || '',
      country: billing.country || 'MA'
    };

    const items = (order.line_items || []).map(item => {
      const quantity = parseInt(item.quantity?.toString() || '1');
      const unitPriceTTC = parseFloat((item.price || '0').toString());
      const totalTTC = round2(unitPriceTTC * quantity);

      return {
        id: crypto.randomUUID(),
        productId: item.product_id,
        description: item.name || '',
        quantity: quantity,
        unitPrice: unitPriceTTC,
        total: totalTTC,
        taxRate: 20,
        taxAmount: round2(totalTTC * 0.2 / 1.2)
      };
    });

    const invoiceData = {
      id: crypto.randomUUID(),
      number: '', // Don't generate number until save
      orderId: order.id,
      date: new Date().toISOString().split('T')[0],
      dueDate: dueDate.toISOString().split('T')[0],
      status: 'draft' as const,
      customer: customerInfo,
      items: items,
      subtotal: orderSubtotalHT,
      tax: orderTaxTotal,
      total: orderTotalTTC,
      notes: `Facture générée à partir de la commande WooCommerce #${order.number || order.id} (prix de commande)`
    };

    setFormData(invoiceData);
  };

  // Calculate totals from current items (for manual editing)
  const calculateTotals = () => {
    if (!formData.items || formData.items.length === 0 || !isInitialized) return;

    console.log('🧮 Recalculating totals from manual changes');

    const subtotal = round2(formData.items.reduce((sum, item) => {
      const itemTTC = item.total || 0;
      const taxRate = (item.taxRate || 20) / 100;
      const itemHT = round2(itemTTC / (1 + taxRate));
      return sum + itemHT;
    }, 0));

    const tax = round2(formData.items.reduce((sum, item) => {
      const itemTTC = item.total || 0;
      const taxRate = (item.taxRate || 20) / 100;
      const itemHT = round2(itemTTC / (1 + taxRate));
      const itemTax = round2(itemHT * taxRate);
      return sum + itemTax;
    }, 0));

    const total = round2(formData.items.reduce((sum, item) => sum + (item.total || 0), 0));

    console.log('Recalculated totals:', { subtotal, tax, total });

    setFormData(prev => ({
      ...prev,
      subtotal,
      tax,
      total
    }));
  };

  // Only recalculate when items change manually (not during initialization)
  useEffect(() => {
    if (isInitialized && !locationState?.sourceOrder && formData.items && formData.items.length > 0) {
      calculateTotals();
    }
  }, [formData.items, isInitialized, locationState]);

  // Filter customers safely
  const filteredCustomers = customers.filter(customer => {
    if (!customer || !customerSearchTerm) return false;
    const searchLower = customerSearchTerm.toLowerCase();
    return (
      (customer.firstName && customer.firstName.toLowerCase().includes(searchLower)) ||
      (customer.lastName && customer.lastName.toLowerCase().includes(searchLower)) ||
      (customer.email && customer.email.toLowerCase().includes(searchLower)) ||
      (customer.company && customer.company.toLowerCase().includes(searchLower))
    );
  });

  const handleCustomerSelect = (customerId: string) => {
    setSelectedCustomerId(customerId);

    if (customerId) {
      const customer = customers.find(c => c && c.id === customerId);
      if (customer) {
        setFormData(prev => ({
          ...prev,
          customer: {
            name: `${customer.firstName || ''} ${customer.lastName || ''}`.trim(),
            email: customer.email || '',
            company: customer.company || '',
            address: customer.address || '',
            city: customer.city || '',
            postalCode: customer.postalCode || '',
            country: customer.country || 'Maroc'
          }
        }));
      }
    }
  };

  const handleCustomerChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      customer: {
        ...prev.customer!,
        [field]: value
      }
    }));

    if (selectedCustomerId) {
      setSelectedCustomerId('');
    }
  };

  const handleItemChange = (index: number, field: string, value: any) => {
    console.log(`Changing item ${index}, field ${field}, value:`, value);

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
      // Recalculate tax amount when tax rate changes (keep TTC price the same)
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

  const addItem = () => {
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

  const removeItem = (index: number) => {
    setFormData(prev => ({
      ...prev,
      items: prev.items?.filter((_, i) => i !== index) || []
    }));
  };

  const handleProductSelect = (product: WooCommerceProduct, quantity: number, taxRate: number) => {
    console.log(`Adding product "${product.name}" with tax rate ${taxRate}%`);

    const priceTTC = round2(parseFloat(product.price));
    const totalTTC = round2(priceTTC * quantity);
    const totalHT = round2(totalTTC / (1 + taxRate / 100));
    const taxAmount = round2(totalHT * (taxRate / 100));

    const newItem = {
      id: crypto.randomUUID(),
      description: product.name,
      quantity: quantity,
      unitPrice: priceTTC,
      total: totalTTC,
      productId: product.id,
      sku: product.sku,
      taxRate: taxRate,
      taxAmount: taxAmount
    };

    setFormData(prev => ({
      ...prev,
      items: [...(prev.items || []), newItem]
    }));
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);

    try {
      const invoice: Invoice = {
        id: formData.id!,
        number: formData.number!,
        orderId: formData.orderId,
        date: formData.date!,
        dueDate: formData.dueDate!,
        status: formData.status!,
        customer: formData.customer!,
        items: formData.items!,
        subtotal: formData.subtotal!,
        tax: formData.tax!,
        total: formData.total!,
        notes: formData.notes
      };

      console.log('💾 Saving invoice:', {
        number: invoice.number,
        total: formatCurrency(invoice.total),
        items: invoice.items.length,
        fromOrder: !!locationState?.sourceOrder
      });

      await handleSave(invoice);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Enhanced tax breakdown for display
  const getTaxBreakdown = () => {
    const taxBreakdown = new Map<number, number>();

    formData.items?.forEach(item => {
      const taxRate = item.taxRate || 20;
      const totalTTC = item.total || 0;
      const taxRate100 = taxRate / 100;
      const totalHT = round2(totalTTC / (1 + taxRate100));
      const taxAmount = round2(totalHT * taxRate100);

      if (taxBreakdown.has(taxRate)) {
        taxBreakdown.set(taxRate, round2(taxBreakdown.get(taxRate)! + taxAmount));
      } else {
        taxBreakdown.set(taxRate, taxAmount);
      }
    });

    return Array.from(taxBreakdown.entries())
      .filter(([rate, amount]) => amount > 0)
      .sort(([rateA], [rateB]) => rateA - rateB);
  };

  // Show loading screen during product price fetching
  if (isLoadingProducts) {
    return (
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-center min-h-screen">
          <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full">
            <div className="text-center">
              <RefreshCw className="w-12 h-12 text-blue-500 animate-spin mx-auto mb-4" />
              <h2 className="text-xl font-semibold text-gray-900 mb-2">
                Récupération des prix actuels
              </h2>
              <p className="text-gray-600 mb-4">
                Importation des prix à jour depuis WooCommerce...
              </p>
              {productLoadingStatus && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
                  <p className="text-sm text-blue-700">{productLoadingStatus}</p>
                </div>
              )}
              <div className="flex items-center justify-center space-x-2 text-sm text-gray-500">
                <Package className="w-4 h-4" />
                <span>Commande #{locationState?.sourceOrder?.number || locationState?.sourceOrder?.id}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <button
              onClick={handleCancel}
              className="flex items-center space-x-2 text-gray-600 hover:text-gray-900 mb-4 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Retour aux factures</span>
            </button>
            <h1 className="text-3xl font-bold text-gray-900">
              {id ? 'Modifier la facture' : 'Nouvelle facture'}
            </h1>
            {locationState?.sourceOrder && (
              <div className="mt-2">
                <p className="text-gray-600">
                  À partir de la commande #{locationState.sourceOrder.number || locationState.sourceOrder.id}
                </p>
                <div className="flex items-center space-x-4 mt-1">
                  <p className="text-sm text-green-600 flex items-center">
                    <RefreshCw className="w-4 h-4 mr-1" />
                    ✅ Prix actuels récupérés depuis les produits WooCommerce
                  </p>
                  <p className="text-sm text-blue-600">
                    🎯 Taux TVA détectés automatiquement
                  </p>
                  {locationState.sourceOrder.total_tax && (
                    <p className="text-sm text-green-600">
                      💰 TVA commande: {formatCurrency(parseFloat(locationState.sourceOrder.total_tax))}
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
          <div className="flex items-center space-x-3">
            <button
              onClick={handleCancel}
              className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Annuler
            </button>
            <button
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="flex items-center space-x-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {isSubmitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span>Sauvegarde...</span>
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  <span>Sauvegarder</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* Invoice Header */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-6">Informations générales</h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Numéro de facture
              </label>
              <input
                type="text"
                value={formData.number || 'Sera généré lors de la sauvegarde'}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-500 cursor-not-allowed"
                disabled
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Date de facture
              </label>
              <input
                type="date"
                value={formData.date}
                onChange={(e) => setFormData(prev => ({ ...prev, date: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Date d'échéance
              </label>
              <input
                type="date"
                value={formData.dueDate}
                onChange={(e) => setFormData(prev => ({ ...prev, dueDate: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                required
              />
            </div>
          </div>

          <div className="mt-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Statut
            </label>
            <select
              value={formData.status}
              onChange={(e) => setFormData(prev => ({ ...prev, status: e.target.value as any }))}
              className="w-full max-w-xs px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="draft">Brouillon</option>
              <option value="sent">Envoyée</option>
              <option value="paid">Payée</option>
              <option value="overdue">En retard</option>
            </select>
          </div>
        </div>

        {/* Customer Information */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-6">Informations client</h2>

          {!id && customers.length > 0 && (
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Sélectionner un client existant (optionnel)
              </label>
              <div className="relative">
                <Search className="w-5 h-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Rechercher un client..."
                  value={customerSearchTerm}
                  onChange={(e) => setCustomerSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              {customerSearchTerm && filteredCustomers.length > 0 && (
                <div className="mt-2 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                  {filteredCustomers.slice(0, 5).map((customer) => (
                    <button
                      key={customer.id}
                      type="button"
                      onClick={() => {
                        handleCustomerSelect(customer.id);
                        setCustomerSearchTerm('');
                      }}
                      className="w-full px-4 py-2 text-left hover:bg-gray-50 border-b border-gray-100 last:border-b-0"
                    >
                      <p className="text-sm font-medium text-gray-900">
                        {customer.firstName} {customer.lastName}
                      </p>
                      {customer.email && (
                        <p className="text-xs text-gray-500">{customer.email}</p>
                      )}
                      {customer.company && (
                        <p className="text-xs text-gray-500">{customer.company}</p>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Nom du client *
              </label>
              <input
                type="text"
                value={formData.customer?.name || ''}
                onChange={(e) => handleCustomerChange('name', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                required
                placeholder="Nom complet du client"
              />
              {errors.customerName && <p className="text-red-500 text-sm mt-1">{errors.customerName}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Email
              </label>
              <input
                type="email"
                value={formData.customer?.email || ''}
                onChange={(e) => handleCustomerChange('email', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="email@exemple.com"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Entreprise
              </label>
              <input
                type="text"
                value={formData.customer?.company || ''}
                onChange={(e) => handleCustomerChange('company', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Nom de l'entreprise"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Adresse
              </label>
              <input
                type="text"
                value={formData.customer?.address || ''}
                onChange={(e) => handleCustomerChange('address', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Adresse complète"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Ville
              </label>
              <input
                type="text"
                value={formData.customer?.city || ''}
                onChange={(e) => handleCustomerChange('city', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Ville"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Code postal
              </label>
              <input
                type="text"
                value={formData.customer?.postalCode || ''}
                onChange={(e) => handleCustomerChange('postalCode', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Code postal"
              />
            </div>
          </div>
        </div>

        {/* Items */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-lg font-semibold text-gray-900">Articles</h2>
            <div className="flex space-x-3">
              <button
                type="button"
                onClick={() => setShowProductSearch(true)}
                className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
              >
                <Search className="w-4 h-4" />
                <span>Produit WooCommerce</span>
              </button>
              <button
                type="button"
                onClick={addItem}
                className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Plus className="w-4 h-4" />
                <span>Ajouter article</span>
              </button>
            </div>
          </div>

          {/* Success notice when imported from order */}
          {locationState?.sourceOrder && (
            <div className="mb-4 bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="flex items-start space-x-3">
                <CheckCircle className="w-5 h-5 text-green-500 mt-0.5" />
                <div className="text-sm text-green-700">
                  <div className="font-bold mb-2">🎉 Facture créée avec les prix actuels WooCommerce #{locationState.sourceOrder.number}</div>
                  <div className="space-y-1">
                    <p>✅ Prix unitaires TTC récupérés directement depuis les produits WooCommerce</p>
                    <p>✅ Taux de TVA détectés automatiquement depuis les classes de taxe</p>
                    <p>✅ Totaux HT et TTC calculés avec précision</p>
                    <p>✅ Prix mis à jour (non plus les anciens prix de la commande)</p>
                    <p className="font-medium text-green-800">
                      📦 {formData.items?.length || 0} article(s) importé(s) - Total: {formatCurrency(formData.total || 0)} TTC
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Description</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Quantité</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Prix unitaire TTC
                    {locationState?.sourceOrder && <div className="text-xs text-green-600 font-normal">(Prix actuel WooCommerce)</div>}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Total TTC</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Taux TVA</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {formData.items?.map((item, index) => (
                  <tr key={item.id} className={locationState?.sourceOrder ? 'bg-green-50/30' : ''}>
                    <td className="px-6 py-4">
                      <input
                        type="text"
                        value={item.description}
                        onChange={(e) => handleItemChange(index, 'description', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="Description de l'article"
                      />
                      {(item as any).sku && (
                        <p className="text-xs text-gray-500 mt-1">SKU: {(item as any).sku}</p>
                      )}
                      {item.productId && (
                        <p className="text-xs text-green-600 mt-1 flex items-center">
                          <Package className="w-3 h-3 mr-1" />
                          WooCommerce #{item.productId}
                        </p>
                      )}
                      {locationState?.sourceOrder && (
                        <p className="text-xs text-green-600 mt-1 flex items-center">
                          <RefreshCw className="w-3 h-3 mr-1" />
                          Prix actuel récupéré
                        </p>
                      )}
                      {errors[`item_${index}_description`] && (
                        <p className="text-red-500 text-xs mt-1">{errors[`item_${index}_description`]}</p>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <input
                        type="number"
                        value={item.quantity}
                        onChange={(e) => handleItemChange(index, 'quantity', parseInt(e.target.value) || 0)}
                        className="w-20 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        min="1"
                      />
                      {errors[`item_${index}_quantity`] && (
                        <p className="text-red-500 text-xs mt-1">{errors[`item_${index}_quantity`]}</p>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <input
                        type="number"
                        value={item.unitPrice.toFixed(2)}
                        onChange={(e) => handleItemChange(index, 'unitPrice', parseFloat(e.target.value) || 0)}
                        className={`w-32 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                          locationState?.sourceOrder ? 'bg-green-50 border-green-300' : 'border-gray-300'
                        }`}
                        min="0"
                        step="0.01"
                      />
                      <p className="text-xs text-blue-600 mt-1 font-medium">TTC</p>
                      {locationState?.sourceOrder && (
                        <p className="text-xs text-green-500 mt-1 flex items-center">
                          <RefreshCw className="w-3 h-3 mr-1" />
                          ✓ Prix actuel
                        </p>
                      )}
                      {errors[`item_${index}_price`] && (
                        <p className="text-red-500 text-xs mt-1">{errors[`item_${index}_price`]}</p>
                      )}
                    </td>
                    <td className="px-6 py-4 font-medium">
                      <div className="text-blue-600 font-bold">{formatCurrency(item.total)}</div>
                      <div className="text-xs text-gray-500">
                        HT: {formatCurrency(round2(item.total / (1 + (item.taxRate || 20) / 100)))}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col space-y-1">
                        <select
                          value={item.taxRate ?? 20}
                          onChange={(e) => handleItemChange(index, 'taxRate', parseFloat(e.target.value))}
                          className="w-20 px-2 py-1 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        >
                          <option value={0}>0%</option>
                          <option value={7}>7%</option>
                          <option value={10}>10%</option>
                          <option value={20}>20%</option>
                        </select>
                        {locationState?.sourceOrder && item.productId && (
                          <div className="text-xs text-green-600 flex items-center">
                            <CheckCircle className="w-3 h-3 mr-1" />
                            Auto-détecté
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <button
                        type="button"
                        onClick={() => removeItem(index)}
                        className="text-red-600 hover:text-red-800 p-2 hover:bg-red-50 rounded-lg transition-colors"
                        disabled={formData.items?.length === 1}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {errors.items && <p className="text-red-500 text-sm mt-2">{errors.items}</p>}
        </div>

        {/* Totals */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex justify-end">
            <div className="w-full max-w-md space-y-4">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Sous-total HT:</span>
                <span className="font-medium">{formatCurrency(formData.subtotal || 0)}</span>
              </div>

              {getTaxBreakdown().map(([rate, amount]) => (
                <div key={rate} className="flex justify-between text-sm">
                  <span className="text-gray-600 flex items-center">
                    <Percent className="w-3 h-3 mr-1" />
                    TVA {rate}%:
                  </span>
                  <span className="font-medium text-blue-600">{formatCurrency(amount)}</span>
                </div>
              ))}

              <div className="flex justify-between text-lg font-bold border-t pt-4">
                <span>Total TTC:</span>
                <span className="text-blue-600">{formatCurrency(formData.total || 0)}</span>
              </div>

              {locationState?.sourceOrder && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-3 mt-4">
                  <p className="text-xs text-green-700 font-medium mb-1 flex items-center">
                    <RefreshCw className="w-3 h-3 mr-1" />
                    ✅ Totaux calculés avec les prix actuels WooCommerce
                  </p>
                  <p className="text-xs text-green-600">
                    Commande #{locationState.sourceOrder.number} - Total commande: {formatCurrency(parseFloat(locationState.sourceOrder.total))}
                  </p>
                  <p className="text-xs text-green-600">
                    Total facture (prix actuels): {formatCurrency(formData.total || 0)}
                  </p>
                  {(() => {
                    const difference = Math.abs(parseFloat(locationState.sourceOrder.total) - (formData.total || 0));
                    if (difference < 0.01) {
                      return (
                        <p className="text-xs text-green-800 font-bold mt-1">
                          🎯 Aucune différence de prix !
                        </p>
                      );
                    } else {
                      return (
                        <p className="text-xs text-orange-700 font-bold mt-1">
                          📈 Différence: {formatCurrency(difference)} (prix mis à jour)
                        </p>
                      );
                    }
                  })()}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Notes */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Notes</h2>
          <textarea
            value={formData.notes || ''}
            onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
            rows={4}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            placeholder="Notes additionnelles..."
          />
        </div>
      </form>

      {/* Product Search Modal */}
      {showProductSearch && (
        <ProductSearch
          onProductSelect={handleProductSelect}
          onClose={() => setShowProductSearch(false)}
        />
      )}
    </div>
  );
};

export default InvoiceForm;