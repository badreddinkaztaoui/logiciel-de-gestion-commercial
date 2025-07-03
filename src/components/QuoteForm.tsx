import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  Trash2, 
  Save, 
  ArrowLeft, 
  User, 
  Building, 
  MapPin, 
  Mail,
  Phone,
  Calendar,
  FileText,
  Calculator,
  Search,
  Package,
  AlertTriangle,
  CheckCircle,
  Users,
  Percent
} from 'lucide-react';
import { Quote, WooCommerceOrder, Customer } from '../types';
import { quoteService } from '../services/quoteService';
import { customerService } from '../services/customerService';
import { wooCommerceService, WooCommerceProduct } from '../services/woocommerce';
import { formatCurrency, generateDocumentNumber } from '../utils/formatters';
import ProductSearch from './ProductSearch';

interface QuoteFormProps {
  editingQuote?: Quote | null;
  sourceOrder?: WooCommerceOrder | null;
  onSave: (quote: Quote) => void;
  onCancel: () => void;
}

const QuoteForm: React.FC<QuoteFormProps> = ({
  editingQuote,
  sourceOrder,
  onSave,
  onCancel
}) => {
  const [formData, setFormData] = useState<Partial<Quote>>({
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
      city: '',
      postalCode: '',
      country: 'Maroc'
    },
    items: [],
    subtotal: 0,
    tax: 0,
    total: 0,
    notes: '',
    conditions: ''
  });

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
  const [customerSearchTerm, setCustomerSearchTerm] = useState('');
  const [showCustomerForm, setShowCustomerForm] = useState(false);
  const [errors, setErrors] = useState<{[key: string]: string}>({});
  const [showProductSearch, setShowProductSearch] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);

  // Helper function to round to 2 decimal places
  const round2 = (num: number): number => {
    return Math.round((num + Number.EPSILON) * 100) / 100;
  };

  useEffect(() => {
    // Load customers
    const loadCustomers = async () => {
      try {
        const savedCustomers = await customerService.getCustomers();
        setCustomers(savedCustomers);
      } catch (error) {
        console.error('Error loading customers:', error);
        setCustomers([]);
      }
    };
    
    loadCustomers();

    // Initialize form data
    const initializeForm = async () => {
      try {
        if (editingQuote) {
          setFormData(editingQuote);
          
          // Try to find the customer in the list
          const matchingCustomer = customers.find(c => 
            c.email === editingQuote.customer.email || 
            (c.firstName + ' ' + c.lastName) === editingQuote.customer.name
          );
          
          if (matchingCustomer) {
            setSelectedCustomerId(matchingCustomer.id);
          }
        } else if (sourceOrder) {
          // Create quote from WooCommerce order with TTC pricing
          const orderTotalTTC = parseFloat(sourceOrder.total);
          
          // Use actual tax from WooCommerce if available
          let taxFromOrder: number;
          let subtotalFromOrder: number;
          
          if (sourceOrder.total_tax && parseFloat(sourceOrder.total_tax) >= 0) {
            // Use actual tax amount from WooCommerce (including 0 tax)
            taxFromOrder = round2(parseFloat(sourceOrder.total_tax));
            subtotalFromOrder = round2(orderTotalTTC - taxFromOrder);
          } else {
            // Fallback calculation from items
            taxFromOrder = 0;
            subtotalFromOrder = 0;
          }
          
          const validUntil = new Date();
          validUntil.setDate(validUntil.getDate() + 30);

          // Try to find existing customer
          const existingCustomer = customers.find(c => 
            c.email === sourceOrder.billing.email ||
            c.wooCommerceId === sourceOrder.customer_id
          );

          // Generate quote number
          const quoteNumber = await generateDocumentNumber('quote');
          
          const billing = sourceOrder.billing || {};
          
          setFormData({
            id: crypto.randomUUID(),
            number: quoteNumber,
            orderId: sourceOrder.id,
            date: new Date().toISOString().split('T')[0],
            validUntil: validUntil.toISOString().split('T')[0],
            status: 'draft',
            customer: {
              name: `${billing.first_name || ''} ${billing.last_name || ''}`.trim() || 'Client',
              email: billing.email || '',
              company: billing.company || '',
              address: billing.address_1 + (billing.address_2 ? ` ${billing.address_2}` : ''),
              city: billing.city || '',
              postalCode: billing.postcode || '',
              country: billing.country || 'MA'
            },
            items: sourceOrder.line_items ? sourceOrder.line_items.map(item => {
              const itemTotalTTC = parseFloat(item.total || '0'); // WooCommerce TTC price
              const itemTax = parseFloat(item.total_tax || '0');
              const unitPriceTTC = round2(itemTotalTTC / (item.quantity || 1)); // Unit price TTC
              
              // Calculate tax rate for this item
              let taxRate = 20; // Default
              if ((item as any).calculated_tax_rate !== undefined) {
                taxRate = (item as any).calculated_tax_rate;
              } else if ((item as any).tax_class !== undefined) {
                try {
                  taxRate = wooCommerceService.getTaxRateForClass((item as any).tax_class);
                } catch (error) {
                  console.warn(`Error getting tax rate for class "${(item as any).tax_class}":`, error);
                }
              } else if (itemTotalTTC > 0 && itemTax >= 0) {
                if (itemTax === 0) {
                  taxRate = 0;
                } else {
                  const itemHT = itemTotalTTC - itemTax;
                  if (itemHT > 0) {
                    const calculatedRate = (itemTax / itemHT) * 100;
                    const validRates = [0, 7, 10, 20];
                    taxRate = validRates.reduce((prev, curr) => 
                      Math.abs(curr - calculatedRate) < Math.abs(prev - calculatedRate) ? curr : prev
                    );
                  }
                }
              }
              
              return {
                id: crypto.randomUUID(),
                description: item.name || 'Article',
                quantity: item.quantity || 1,
                unitPrice: unitPriceTTC, // Store TTC price
                total: itemTotalTTC, // Store TTC total
                productId: item.product_id,
                taxRate: taxRate,
                taxAmount: itemTax
              };
            }) : [],
            subtotal: subtotalFromOrder,
            tax: taxFromOrder,
            total: orderTotalTTC,
            notes: `Devis généré à partir de la commande WooCommerce #${sourceOrder.number}`,
            conditions: 'Devis valable 30 jours. Prix susceptibles de modification selon disponibilité.'
          });

          if (existingCustomer) {
            setSelectedCustomerId(existingCustomer.id);
          }
        } else {
          // New quote
          const validUntil = new Date();
          validUntil.setDate(validUntil.getDate() + 30);
          
          const quoteNumber = await generateDocumentNumber('quote');

          setFormData({
            id: crypto.randomUUID(),
            number: quoteNumber,
            date: new Date().toISOString().split('T')[0],
            validUntil: validUntil.toISOString().split('T')[0],
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
            items: [{
              id: crypto.randomUUID(),
              description: '',
              quantity: 1,
              unitPrice: 0, // Prix TTC
              total: 0, // Total TTC
              taxRate: 20,
              taxAmount: 0
            }],
            subtotal: 0,
            tax: 0,
            total: 0,
            notes: '',
            conditions: 'Devis valable 30 jours. Prix susceptibles de modification selon disponibilité.'
          });
        }
        
        setIsInitialized(true);
      } catch (error) {
        console.error('Error initializing form:', error);
      }
    };

    initializeForm();
  }, [editingQuote, sourceOrder]);

  useEffect(() => {
    if (isInitialized && !sourceOrder) {
      calculateTotals();
    }
  }, [formData.items, isInitialized, sourceOrder]);

  // Filter customers based on search term
  const filteredCustomers = customers.filter(customer => {
    if (!customer || !customerSearchTerm) return false;
    const searchLower = customerSearchTerm.toLowerCase();
    return (
      customer.firstName.toLowerCase().includes(searchLower) ||
      customer.lastName.toLowerCase().includes(searchLower) ||
      customer.email.toLowerCase().includes(searchLower) ||
      (customer.company && customer.company.toLowerCase().includes(searchLower))
    );
  });

  // Updated calculation for TTC pricing
  const calculateTotals = () => {
    // Calculate subtotal HT from TTC prices
    const subtotal = round2(formData.items?.reduce((sum, item) => {
      const itemTTC = item.total || 0;
      const taxRate = (item.taxRate || 20) / 100;
      const itemHT = round2(itemTTC / (1 + taxRate));
      return sum + itemHT;
    }, 0) || 0);
    
    // Tax is calculated from HT amounts
    const tax = round2(formData.items?.reduce((sum, item) => {
      const itemTTC = item.total || 0;
      const taxRate = (item.taxRate || 20) / 100;
      const itemHT = round2(itemTTC / (1 + taxRate));
      const itemTax = round2(itemHT * taxRate);
      return sum + itemTax;
    }, 0) || 0);
    
    // Total TTC is sum of all item totals TTC
    const total = round2(formData.items?.reduce((sum, item) => sum + (item.total || 0), 0) || 0);

    setFormData(prev => ({
      ...prev,
      subtotal,
      tax,
      total
    }));
  };

  const handleCustomerSelect = (customerId: string) => {
    setSelectedCustomerId(customerId);
    
    if (customerId) {
      const customer = customers.find(c => c.id === customerId);
      if (customer) {
        setFormData(prev => ({
          ...prev,
          customer: {
            name: `${customer.firstName} ${customer.lastName}`,
            email: customer.email,
            company: customer.company || '',
            address: customer.address || '',
            city: customer.city || '',
            postalCode: customer.postalCode || '',
            country: customer.country || 'Maroc'
          }
        }));
      }
    } else {
      // Reset customer data
      setFormData(prev => ({
        ...prev,
        customer: {
          name: '',
          email: '',
          company: '',
          address: '',
          city: '',
          postalCode: '',
          country: 'Maroc'
        }
      }));
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
    
    // Clear selection if user types manually
    if (selectedCustomerId) {
      setSelectedCustomerId('');
    }
  };

  const handleItemChange = (index: number, field: string, value: any) => {
    const newItems = [...(formData.items || [])];
    newItems[index] = {
      ...newItems[index],
      [field]: value
    };

    if (field === 'quantity' || field === 'unitPrice') {
      // Calculate total TTC from unit price TTC
      const newTotalTTC = round2(newItems[index].quantity * newItems[index].unitPrice);
      newItems[index].total = newTotalTTC;
      
      // Calculate tax amount from TTC total
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
          unitPrice: 0, // Prix TTC
          total: 0, // Total TTC
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
    // WooCommerce prices are TTC, so we use them directly
    const priceTTC = round2(parseFloat(product.price));
    const totalTTC = round2(priceTTC * quantity);
    
    // Calculate HT from TTC for tax amount calculation
    const totalHT = round2(totalTTC / (1 + taxRate / 100));
    const taxAmount = round2(totalHT * (taxRate / 100));
    
    const newItem = {
      id: crypto.randomUUID(),
      description: product.name,
      quantity: quantity,
      unitPrice: priceTTC, // Store TTC price (like WooCommerce)
      total: totalTTC, // Store TTC total
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

    if (!formData.customer?.name.trim()) {
      newErrors.customerName = 'Le nom du client est requis';
    }

    if (!formData.customer?.email.trim()) {
      newErrors.customerEmail = 'L\'email du client est requis';
    } else if (!/\S+@\S+\.\S+/.test(formData.customer.email)) {
      newErrors.customerEmail = 'Format d\'email invalide';
    }

    if (!formData.validUntil) {
      newErrors.validUntil = 'La date de validité est requise';
    } else if (new Date(formData.validUntil) <= new Date()) {
      newErrors.validUntil = 'La date de validité doit être future';
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
      const quote: Quote = {
        id: formData.id!,
        number: formData.number!,
        orderId: formData.orderId,
        date: formData.date!,
        validUntil: formData.validUntil!,
        status: formData.status!,
        customer: formData.customer!,
        items: formData.items!,
        subtotal: formData.subtotal!,
        tax: formData.tax!,
        total: formData.total!,
        notes: formData.notes,
        conditions: formData.conditions
      };

      onSave(quote);
    } finally {
      setIsSubmitting(false);
    }
  };

  const isExpired = formData.validUntil && new Date(formData.validUntil) < new Date();

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

  return (
    <div className="max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <button
              onClick={onCancel}
              className="flex items-center space-x-2 text-gray-600 hover:text-gray-900 mb-4 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Retour aux devis</span>
            </button>
            <h1 className="text-3xl font-bold text-gray-900">
              {editingQuote ? 'Modifier le devis' : 'Nouveau devis'}
            </h1>
            {sourceOrder && (
              <div className="mt-2">
                <p className="text-gray-600">
                  À partir de la commande #{sourceOrder.number}
                </p>
                {sourceOrder.total_tax && (
                  <p className="text-sm text-blue-600">
                    TVA importée: {formatCurrency(parseFloat(sourceOrder.total_tax))}
                  </p>
                )}
                <p className="text-xs text-gray-500 mt-1">
                  ✓ Prix TTC conservés (comme WooCommerce)
                </p>
              </div>
            )}
          </div>
          <div className="flex items-center space-x-3">
            <button
              onClick={onCancel}
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
        {/* Quote Header */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-6">Informations générales</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Numéro de devis
              </label>
              <input
                type="text"
                value={formData.number}
                onChange={(e) => setFormData(prev => ({ ...prev, number: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Date du devis
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
                Valable jusqu'au
              </label>
              <input
                type="date"
                value={formData.validUntil}
                onChange={(e) => setFormData(prev => ({ ...prev, validUntil: e.target.value }))}
                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                  isExpired ? 'border-red-300 bg-red-50' : 'border-gray-300'
                }`}
                required
              />
              {errors.validUntil && <p className="text-red-500 text-sm mt-1">{errors.validUntil}</p>}
              {isExpired && (
                <p className="text-red-500 text-sm mt-1 flex items-center">
                  <AlertTriangle className="w-4 h-4 mr-1" />
                  Devis expiré
                </p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Statut
              </label>
              <select
                value={formData.status}
                onChange={(e) => setFormData(prev => ({ ...prev, status: e.target.value as any }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="draft">Brouillon</option>
                <option value="sent">Envoyé</option>
                <option value="accepted">Accepté</option>
                <option value="rejected">Rejeté</option>
                <option value="expired">Expiré</option>
              </select>
            </div>
          </div>
        </div>

        {/* Customer Information */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-6">Informations client</h2>
          
          {/* Customer Selection */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-4">
              <label className="block text-sm font-medium text-gray-700">
                Sélectionner un client existant
              </label>
              <button
                type="button"
                onClick={() => window.open('/clients', '_blank')}
                className="flex items-center space-x-2 px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
              >
                <Users className="w-4 h-4" />
                <span>Gérer les clients</span>
              </button>
            </div>
            
            <div className="relative">
              <div className="relative">
                <Search className="w-5 h-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Rechercher un client ou sélectionner..."
                  value={customerSearchTerm}
                  onChange={(e) => setCustomerSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              
              {/* Customer Selection Dropdown */}
              {customerSearchTerm && (
                <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                  {filteredCustomers.length > 0 ? (
                    <>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedCustomerId('');
                          setCustomerSearchTerm('');
                          handleCustomerSelect('');
                        }}
                        className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 border-b border-gray-100"
                      >
                        <em>Saisie manuelle (nouveau client)</em>
                      </button>
                      {filteredCustomers.map((customer) => (
                        <button
                          key={customer.id}
                          type="button"
                          onClick={() => {
                            handleCustomerSelect(customer.id);
                            setCustomerSearchTerm('');
                          }}
                          className="w-full px-4 py-2 text-left hover:bg-gray-50 border-b border-gray-100 last:border-b-0"
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-sm font-medium text-gray-900">
                                {customer.firstName} {customer.lastName}
                              </p>
                              <p className="text-xs text-gray-500">{customer.email}</p>
                              {customer.company && (
                                <p className="text-xs text-gray-500">{customer.company}</p>
                              )}
                            </div>
                            {customer.wooCommerceId && (
                              <Building className="w-4 h-4 text-green-500" title="Client WooCommerce" />
                            )}
                          </div>
                        </button>
                      ))}
                    </>
                  ) : (
                    <div className="px-4 py-2 text-sm text-gray-500">
                      Aucun client trouvé
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Selected Customer Display */}
            {selectedCustomerId && (
              <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <CheckCircle className="w-4 h-4 text-blue-600" />
                    <span className="text-sm font-medium text-blue-900">
                      Client sélectionné: {formData.customer?.name}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleCustomerSelect('')}
                    className="text-blue-600 hover:text-blue-800 text-sm"
                  >
                    Changer
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Customer Fields */}
          <div className="space-y-6">
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
                  disabled={!!selectedCustomerId}
                />
                {errors.customerName && <p className="text-red-500 text-sm mt-1">{errors.customerName}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Email *
                </label>
                <input
                  type="email"
                  value={formData.customer?.email || ''}
                  onChange={(e) => handleCustomerChange('email', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  required
                  disabled={!!selectedCustomerId}
                />
                {errors.customerEmail && <p className="text-red-500 text-sm mt-1">{errors.customerEmail}</p>}
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
                  disabled={!!selectedCustomerId}
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
                  disabled={!!selectedCustomerId}
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
                  disabled={!!selectedCustomerId}
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
                  disabled={!!selectedCustomerId}
                />
              </div>
            </div>

            {!selectedCustomerId && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <div className="flex items-start space-x-3">
                  <AlertTriangle className="w-5 h-5 text-yellow-500 mt-0.5" />
                  <div>
                    <h4 className="font-medium text-yellow-900">Saisie manuelle</h4>
                    <p className="text-sm text-yellow-700 mt-1">
                      Vous saisissez un nouveau client. Ces informations seront sauvegardées avec le devis mais n'ajouteront pas automatiquement le client à votre base de données.
                    </p>
                  </div>
                </div>
              </div>
            )}
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
                <span>Article manuel</span>
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Description</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Quantité</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Prix unitaire TTC</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Total TTC</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Taux TVA</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {formData.items?.map((item, index) => (
                  <tr key={item.id}>
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
                        value={item.unitPrice}
                        onChange={(e) => handleItemChange(index, 'unitPrice', parseFloat(e.target.value) || 0)}
                        className="w-32 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        min="0"
                        step="0.01"
                      />
                      <p className="text-xs text-gray-500 mt-1">TTC</p>
                      {errors[`item_${index}_price`] && (
                        <p className="text-red-500 text-xs mt-1">{errors[`item_${index}_price`]}</p>
                      )}
                    </td>
                    <td className="px-6 py-4 font-medium">
                      {formatCurrency(item.total)}
                    </td>
                    <td className="px-6 py-4">
                      <select
                        value={item.taxRate || 20}
                        onChange={(e) => handleItemChange(index, 'taxRate', parseFloat(e.target.value))}
                        className="w-20 px-2 py-1 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      >
                        <option value={0}>0%</option>
                        <option value={7}>7%</option>
                        <option value={10}>10%</option>
                        <option value={20}>20%</option>
                      </select>
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
              
              {/* Enhanced Tax Breakdown */}
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
            </div>
          </div>
        </div>

        {/* Conditions */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Conditions particulières</h2>
          <textarea
            value={formData.conditions || ''}
            onChange={(e) => setFormData(prev => ({ ...prev, conditions: e.target.value }))}
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            placeholder="Conditions de validité, délais de livraison, modalités de paiement..."
          />
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

export default QuoteForm;