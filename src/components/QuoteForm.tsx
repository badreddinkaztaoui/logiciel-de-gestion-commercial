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
  Search,
  AlertTriangle,
  CheckCircle
} from 'lucide-react';
import { Quote, WooCommerceOrder, Customer as BaseCustomer } from '../types';
import { quoteService } from '../services/quoteService';
import { customerService } from '../services/customerService';
import { WooCommerceProduct } from '../services/woocommerce';
import { formatCurrency } from '../utils/formatters';
import ProductSearch from './ProductSearch';

interface Customer extends BaseCustomer {
  name: string;
  email: string;
  company?: string;
  address?: string;
  city?: string;
}

interface ProductWithQuantity extends WooCommerceProduct {
  quantity: number;
  taxRate: number;
}

interface ExtendedQuoteItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
  sku: string;
  product_id: string | number;
  taxRate: number;
}

type ExtendedQuote = Omit<Quote, 'items'> & {
  items: ExtendedQuoteItem[];
};

interface QuoteFormProps {
  editingQuote?: ExtendedQuote | null;
  sourceOrder?: WooCommerceOrder | null;
  onSave: (quote: ExtendedQuote) => void;
  onCancel: () => void;
}

const QuoteForm: React.FC<QuoteFormProps> = ({
  editingQuote,
  sourceOrder,
  onSave,
  onCancel
}) => {
  const [formData, setFormData] = useState<Partial<ExtendedQuote>>({
    number: '',
    date: new Date().toISOString().split('T')[0],
    validUntil: '',
    status: 'draft',
    customer: {
      name: '',
      email: '',
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
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [errors, setErrors] = useState<{[key: string]: string}>({});
  const [showProductSearch, setShowProductSearch] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const savedCustomers = await customerService.getCustomers() as Customer[];
      setCustomers(savedCustomers);

      if (editingQuote) {
        setFormData(editingQuote);
        if (editingQuote.customer) {
          const customer = savedCustomers.find(c => c.email === editingQuote.customer.email);
          setSelectedCustomer(customer || null);
        }
      } else if (sourceOrder) {
        await initializeFromOrder(sourceOrder);
      }
    } catch (error) {
      console.error('Error loading data:', error);
    }
  };

  const initializeFromOrder = async (order: WooCommerceOrder) => {
    try {
      const expiryDate = new Date();
      expiryDate.setDate(expiryDate.getDate() + 30);

      const items = (order.line_items || []).map(item => ({
        id: crypto.randomUUID(),
        description: item.name,
        quantity: Number(item.quantity),
        unitPrice: Number(item.price),
        total: Number(item.quantity) * Number(item.price),
        sku: (item as any).sku || '',
        product_id: item.product_id,
        taxRate: 20 // Default tax rate for order items
      }));

      const subtotal = items.reduce((sum, item) => sum + item.total, 0);
      const tax = subtotal * 0.2;
      const total = subtotal + tax;

      const billing = order.billing || {};

      setFormData({
        date: new Date().toISOString().split('T')[0],
        validUntil: expiryDate.toISOString().split('T')[0],
        status: 'draft',
        customer: {
          name: `${billing.first_name || ''} ${billing.last_name || ''}`.trim(),
          email: billing.email || '',
          company: billing.company || '',
          address: billing.address_1 || '',
          city: billing.city || ''
        },
        items,
        subtotal,
        tax,
        total,
        notes: `Devis créé à partir de la commande #${order.number}`
      });
    } catch (error) {
      console.error('Error initializing from order:', error);
    }
  };

  const handleCustomerSelect = (customer: Customer) => {
    setSelectedCustomer(customer);
    setFormData(prev => ({
      ...prev,
      customer: {
        name: customer.name,
        email: customer.email,
        company: customer.company,
        address: customer.address || '',
        city: customer.city || ''
      }
    }));
  };

  const handleItemChange = (index: number, field: string, value: any) => {
    const newItems = [...(formData.items || [])] as ExtendedQuoteItem[];
    newItems[index] = {
      ...newItems[index],
      [field]: value
    };

    if (field === 'quantity' || field === 'unitPrice') {
      const quantity = field === 'quantity' ? value : newItems[index].quantity;
      const unitPrice = field === 'unitPrice' ? value : newItems[index].unitPrice;
      newItems[index].total = quantity * unitPrice;
    }

    const subtotal = newItems.reduce((sum, item) => sum + item.total, 0);
    const tax = newItems.reduce((sum, item) => sum + (item.total * (item.taxRate / 100)), 0);
    const total = subtotal + tax;

    setFormData(prev => ({
      ...prev,
      items: newItems,
      subtotal,
      tax,
      total
    }));
  };

  const addItem = () => {
    const newItem: ExtendedQuoteItem = {
      id: crypto.randomUUID(),
      description: '',
      quantity: 1,
      unitPrice: 0,
      total: 0,
      sku: '',
      product_id: '',
      taxRate: 20
    };

    setFormData(prev => ({
      ...prev,
      items: [...(prev.items || []), newItem]
    }));
  };

  const removeItem = (index: number) => {
    setFormData(prev => {
      const items = (prev.items?.filter((_, i) => i !== index) || []) as ExtendedQuoteItem[];
      const subtotal = items.reduce((sum, item) => sum + item.total, 0);
      const tax = items.reduce((sum, item) => sum + (item.total * (item.taxRate / 100)), 0);
      const total = subtotal + tax;

      return {
        ...prev,
        items,
        subtotal,
        tax,
        total
      };
    });
  };

  const handleProductSelect = (product: ProductWithQuantity) => {
    const priceHT = parseFloat(product.price) / (1 + product.taxRate / 100);

    const newItem: ExtendedQuoteItem = {
      id: crypto.randomUUID(),
      description: product.name,
      quantity: product.quantity,
      unitPrice: priceHT,
      total: priceHT * product.quantity,
      sku: product.sku || '',
      product_id: product.id,
      taxRate: product.taxRate
    };

    setFormData(prev => {
      const items = [...(prev.items || []), newItem];
      const subtotal = items.reduce((sum, item) => sum + item.total, 0);
      const tax = items.reduce((sum, item) => sum + (item.total * (item.taxRate / 100)), 0);
      const total = subtotal + tax;

      return {
        ...prev,
        items,
        subtotal,
        tax,
        total
      };
    });

    setShowProductSearch(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrors({});

    try {
      const newErrors: {[key: string]: string} = {};
      if (!formData.customer) newErrors.customer = 'Veuillez sélectionner un client';
      if (!formData.items?.length) newErrors.items = 'Veuillez ajouter au moins un article';
      if (!formData.date) newErrors.date = 'La date est requise';
      if (!formData.validUntil) newErrors.validUntil = 'La date d\'expiration est requise';

      if (Object.keys(newErrors).length > 0) {
        setErrors(newErrors);
        setIsSubmitting(false);
        return;
      }

      // Only include the required properties for the API
      const quoteData = {
        ...formData,
        items: formData.items?.map(item => ({
          description: item.description,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          total: item.total
        }))
      };

      const savedQuote = editingQuote
        ? await quoteService.updateQuote(editingQuote.id, quoteData)
        : await quoteService.createQuote(quoteData);

      // Transform the saved quote back to ExtendedQuote format
      const extendedQuote: ExtendedQuote = {
        ...savedQuote,
        items: savedQuote.items.map(item => ({
          id: crypto.randomUUID(),
          description: item.description,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          total: item.total,
          sku: '',
          product_id: '',
          taxRate: 20
        }))
      };

      onSave(extendedQuote);
    } catch (error) {
      console.error('Error saving quote:', error);
      setErrors({ submit: 'Une erreur est survenue lors de l\'enregistrement du devis' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderCustomerDetails = () => {
    if (!formData.customer) return null;

    return (
      <div className="bg-gray-50 p-4 rounded-lg">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Détails du client</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <p className="flex items-center text-sm text-gray-600">
              <User className="w-4 h-4 mr-2" />
              {formData.customer.name}
            </p>
            {formData.customer.company && (
              <p className="flex items-center text-sm text-gray-600 mt-2">
                <Building className="w-4 h-4 mr-2" />
                {formData.customer.company}
              </p>
            )}
            <p className="flex items-center text-sm text-gray-600 mt-2">
              <Mail className="w-4 h-4 mr-2" />
              {formData.customer.email}
            </p>
          </div>
          <div>
            <p className="flex items-center text-sm text-gray-600">
              <MapPin className="w-4 h-4 mr-2" />
              {formData.customer.address}
            </p>
            <p className="text-sm text-gray-600 ml-6">
              {formData.customer.city}
            </p>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="h-screen flex flex-col overflow-hidden pb-20">
      {/* Header */}
      <div className="flex-none p-6 bg-white border-b">
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
              {editingQuote ? `Modifier le devis ${editingQuote.number}` : 'Nouveau devis'}
            </h1>
            {sourceOrder && (
              <p className="text-gray-600 mt-1">
                À partir de la commande #{sourceOrder.number}
              </p>
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
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
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

      {/* Scrollable Content */}
      <div className="flex-1 overflow-auto p-6">
        <form onSubmit={handleSubmit} className="max-w-7xl mx-auto space-y-6">
          {/* Basic Information */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-6">Informations générales</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Date</label>
                <input
                  type="date"
                  value={formData.date}
                  onChange={e => setFormData(prev => ({ ...prev, date: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  required
                />
                {errors.date && <p className="mt-1 text-sm text-red-600">{errors.date}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Date d'expiration</label>
                <input
                  type="date"
                  value={formData.validUntil}
                  onChange={e => setFormData(prev => ({ ...prev, validUntil: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  required
                />
                {errors.validUntil && <p className="mt-1 text-sm text-red-600">{errors.validUntil}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Statut</label>
                <select
                  value={formData.status}
                  onChange={e => setFormData(prev => ({ ...prev, status: e.target.value as Quote['status'] }))}
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

          {/* Customer Selection */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-6">Client</h2>
            <div className="space-y-4">
              <div>
                <select
                  value={selectedCustomer?.id || ''}
                  onChange={e => {
                    const customer = customers.find(c => c.id === e.target.value);
                    if (customer) handleCustomerSelect(customer);
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">Sélectionner un client</option>
                  {customers.map(customer => (
                    <option key={customer.id} value={customer.id}>
                      {customer.name} {customer.company ? `(${customer.company})` : ''}
                    </option>
                  ))}
                </select>
                {errors.customer && <p className="mt-1 text-sm text-red-600">{errors.customer}</p>}
              </div>
              {renderCustomerDetails()}
            </div>
          </div>

          {/* Items */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-lg font-semibold text-gray-900">Articles</h2>
              <div className="flex items-center space-x-3">
                <button
                  type="button"
                  onClick={() => setShowProductSearch(true)}
                  className="flex items-center space-x-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  <Search className="w-4 h-4" />
                  <span>Rechercher un produit</span>
                </button>
                <button
                  type="button"
                  onClick={addItem}
                  className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  <span>Ajouter un article</span>
                </button>
              </div>
            </div>

            {errors.items && (
              <div className="mb-4 p-4 bg-red-50 rounded-lg flex items-center text-red-700">
                <AlertTriangle className="w-5 h-5 mr-2" />
                <p className="text-sm">{errors.items}</p>
              </div>
            )}

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b-2 border-gray-200">
                    <th className="text-left p-2">Description</th>
                    <th className="text-right p-2">Quantité</th>
                    <th className="text-right p-2">Prix unitaire</th>
                    <th className="text-right p-2">Total HT</th>
                    <th className="text-right p-2">TVA</th>
                    <th className="text-right p-2">Total TTC</th>
                    <th className="w-10"></th>
                  </tr>
                </thead>
                <tbody>
                  {formData.items?.map((item, index) => (
                    <tr key={item.id} className="border-b border-gray-200">
                      <td className="p-2">
                        <input
                          type="text"
                          value={item.description}
                          onChange={e => handleItemChange(index, 'description', e.target.value)}
                          className="w-full px-2 py-1 border border-gray-300 rounded"
                          placeholder="Description"
                        />
                      </td>
                      <td className="p-2">
                        <input
                          type="number"
                          min="1"
                          value={item.quantity}
                          onChange={e => handleItemChange(index, 'quantity', parseInt(e.target.value))}
                          className="w-20 px-2 py-1 border border-gray-300 rounded text-right"
                        />
                      </td>
                      <td className="p-2">
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={item.unitPrice}
                          onChange={e => handleItemChange(index, 'unitPrice', parseFloat(e.target.value))}
                          className="w-32 px-2 py-1 border border-gray-300 rounded text-right"
                        />
                      </td>
                      <td className="p-2 text-right">{formatCurrency(item.total)}</td>
                      <td className="p-2 text-right">{formatCurrency(item.total * (item.taxRate / 100))}</td>
                      <td className="p-2 text-right">{formatCurrency(item.total * (1 + item.taxRate / 100))}</td>
                      <td className="p-2">
                        <button
                          type="button"
                          onClick={() => removeItem(index)}
                          className="text-red-600 hover:text-red-800 p-1"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-gray-50">
                  <tr>
                    <td colSpan={3} className="p-2 text-right font-medium">Total HT</td>
                    <td className="p-2 text-right font-medium">{formatCurrency(formData.subtotal || 0)}</td>
                    <td colSpan={3}></td>
                  </tr>
                  <tr>
                    <td colSpan={3} className="p-2 text-right font-medium">TVA</td>
                    <td className="p-2 text-right font-medium">{formatCurrency(formData.tax || 0)}</td>
                    <td colSpan={3}></td>
                  </tr>
                  <tr>
                    <td colSpan={3} className="p-2 text-right font-medium">Total TTC</td>
                    <td className="p-2 text-right font-bold">{formatCurrency(formData.total || 0)}</td>
                    <td colSpan={3}></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* Notes */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Notes</h2>
            <textarea
              value={formData.notes}
              onChange={e => setFormData(prev => ({ ...prev, notes: e.target.value }))}
              rows={4}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Notes ou conditions particulières..."
            />
          </div>

          {errors.submit && (
            <div className="p-4 bg-red-50 rounded-lg flex items-center text-red-700">
              <AlertTriangle className="w-5 h-5 mr-2" />
              <p className="text-sm">{errors.submit}</p>
            </div>
          )}
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