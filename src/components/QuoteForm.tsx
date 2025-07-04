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
} from 'lucide-react';
import { Quote, WooCommerceOrder, Customer } from '../types';
import { quoteService } from '../services/quoteService';
import { customerService } from '../services/customerService';
import { WooCommerceProduct } from '../services/woocommerce';
import { formatCurrency } from '../utils/formatters';
import ProductSearch from './ProductSearch';

interface ProductWithQuantity extends WooCommerceProduct {
  quantity: number;
  taxRate: number;
}

interface QuoteItem {
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
  sku: string;
  product_id: string | number;
  taxRate: number;
}

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
        const savedCustomers = await customerService.getCustomers();
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

      const items = order.line_items.map(item => ({
        description: item.name,
        quantity: Number(item.quantity),
        unitPrice: Number(item.price),
        total: Number(item.quantity) * Number(item.price),
        sku: '',
        product_id: undefined,
        taxRate: 20 // Default tax rate for order items
      }));

      const subtotal = items.reduce((sum, item) => sum + item.total, 0);
      const tax = subtotal * 0.2;
      const total = subtotal + tax;

      setFormData({
        date: new Date().toISOString().split('T')[0],
        validUntil: expiryDate.toISOString().split('T')[0],
        status: 'draft',
        customer: {
          name: `${order.billing.first_name} ${order.billing.last_name}`,
          email: order.billing.email,
          company: order.billing.company || '',
          address: order.billing.address_1,
          city: order.billing.city
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
    const newItems = [...(formData.items || [])] as QuoteItem[];
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
    setFormData(prev => {
      const items = [
        ...(prev.items || []),
        {
          description: '',
          quantity: 1,
          unitPrice: 0,
          total: 0,
          sku: '',
          product_id: undefined,
          taxRate: 20
        }
      ];

      return {
        ...prev,
        items
      };
    });
  };

  const removeItem = (index: number) => {
    setFormData(prev => {
      const items = (prev.items?.filter((_, i) => i !== index) || []) as QuoteItem[];
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

    const newItem: QuoteItem = {
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

      const savedQuote = editingQuote
        ? await quoteService.updateQuote(editingQuote.id, formData)
        : await quoteService.createQuote(formData);

      onSave(savedQuote);
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
    <div className="bg-white p-6 rounded-lg shadow">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-900">
          {editingQuote ? 'Modifier le devis' : 'Nouveau devis'}
        </h2>
        <button
          type="button"
          onClick={onCancel}
          className="inline-flex items-center text-gray-600 hover:text-gray-900"
        >
          <ArrowLeft className="w-5 h-5 mr-1" />
          Retour
        </button>
            </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
            <label className="block text-sm font-medium text-gray-700">Date</label>
              <input
                type="date"
                value={formData.date}
              onChange={e => setFormData(prev => ({ ...prev, date: e.target.value }))}
              className="mt-1 block w-full rounded-md border border-gray-300 bg-white py-2 pl-3 pr-10 text-base focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 sm:text-sm"
              />
            {errors.date && <p className="mt-1 text-sm text-red-600">{errors.date}</p>}
            </div>
            <div>
            <label className="block text-sm font-medium text-gray-700">Date d'expiration</label>
              <input
                type="date"
                value={formData.validUntil}
              onChange={e => setFormData(prev => ({ ...prev, validUntil: e.target.value }))}
              className="mt-1 block w-full rounded-md border border-gray-300 bg-white py-2 pl-3 pr-10 text-base focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 sm:text-sm"
            />
            {errors.validUntil && <p className="mt-1 text-sm text-red-600">{errors.validUntil}</p>}
            </div>
            <div>
            <label className="block text-sm font-medium text-gray-700">Statut</label>
              <select
                value={formData.status}
              onChange={e => setFormData(prev => ({ ...prev, status: e.target.value as Quote['status'] }))}
              className="mt-1 block w-full rounded-lg border border-gray-300 bg-white py-2 pl-3 pr-10 text-base focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 sm:text-sm"
            >
              <option value="draft" className="py-2">Brouillon</option>
              <option value="sent" className="py-2">Envoyé</option>
              <option value="accepted" className="py-2">Accepté</option>
              <option value="rejected" className="py-2">Rejeté</option>
              <option value="expired" className="py-2">Expiré</option>
              </select>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Client</label>
            <div className="relative">
            <select
              value={selectedCustomer?.id || ''}
              onChange={e => {
                const customer = customers.find(c => c.id === e.target.value);
                if (customer) handleCustomerSelect(customer);
              }}
              className="block w-full appearance-none rounded-lg border border-gray-300 bg-white py-2 pl-3 pr-10 text-base focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 sm:text-sm"
            >
              <option value="" className="text-gray-500">Sélectionner un client</option>
              {customers.map(customer => (
                <option key={customer.id} value={customer.id} className="py-2">
                  {customer.name} {customer.company ? `(${customer.company})` : ''}
                </option>
              ))}
            </select>
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-500">
              <svg className="h-4 w-4 fill-current" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
                <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/>
              </svg>
            </div>
          </div>
          {errors.customer && <p className="mt-1 text-sm text-red-600">{errors.customer}</p>}
        </div>

        {renderCustomerDetails()}

        <div>
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-medium text-gray-900">Articles</h3>
            <div className="space-x-2">
              <button
                type="button"
                onClick={() => setShowProductSearch(true)}
                className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                <Search className="w-4 h-4 mr-2" />
                Rechercher un produit
              </button>
              <button
                type="button"
                onClick={addItem}
                className="inline-flex items-center px-3 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                <Plus className="w-4 h-4 mr-2" />
                Ajouter un article
              </button>
            </div>
          </div>

          {errors.items && <p className="mt-1 text-sm text-red-600 mb-4">{errors.items}</p>}

          <div className="bg-white shadow-sm rounded-lg overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Description
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Quantité
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Prix unitaire
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Total
                  </th>
                  <th scope="col" className="relative px-6 py-3">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {formData.items?.map((item, index) => (
                  <tr key={index}>
                    <td className="px-6 py-4">
                      <input
                        type="text"
                        value={item.description}
                        onChange={e => handleItemChange(index, 'description', e.target.value)}
                        className="block w-full border-0 p-0 text-gray-900 placeholder-gray-500 focus:ring-0 sm:text-sm"
                        placeholder="Description de l'article"
                      />
                    </td>
                    <td className="px-6 py-4">
                      <input
                        type="number"
                        min="1"
                        value={item.quantity}
                        onChange={e => handleItemChange(index, 'quantity', parseInt(e.target.value))}
                        className="block w-20 border-0 p-0 text-gray-900 placeholder-gray-500 focus:ring-0 sm:text-sm"
                      />
                    </td>
                    <td className="px-6 py-4">
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={item.unitPrice.toFixed(2)}
                        onChange={e => handleItemChange(index, 'unitPrice', parseFloat(e.target.value))}
                        className="block w-32 border-0 p-0 text-gray-900 placeholder-gray-500 focus:ring-0 sm:text-sm"
                      />
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      {formatCurrency(item.total)}
                    </td>
                    <td className="px-6 py-4 text-right text-sm font-medium">
                      <button
                        type="button"
                        onClick={() => removeItem(index)}
                        className="text-red-600 hover:text-red-900"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-gray-50">
                <tr>
                  <td colSpan={3} className="px-6 py-3 text-right text-sm font-medium text-gray-900">
                    Sous-total HT
                  </td>
                  <td className="px-6 py-3 text-sm text-gray-900">
                    {formatCurrency(formData.subtotal || 0)}
                  </td>
                  <td></td>
                </tr>
                {(() => {
                  const taxRates = new Map<number, number>();
                  formData.items?.forEach(item => {
                    const currentTax = item.total * (item.taxRate / 100);
                    taxRates.set(item.taxRate, (taxRates.get(item.taxRate) || 0) + currentTax);
                  });
                  return Array.from(taxRates.entries()).map(([rate, amount]) => (
                    <tr key={rate}>
                      <td colSpan={3} className="px-6 py-3 text-right text-sm font-medium text-gray-900">
                        TVA ({rate}%)
                      </td>
                      <td className="px-6 py-3 text-sm text-gray-900">
                        {formatCurrency(amount)}
                      </td>
                      <td></td>
                    </tr>
                  ));
                })()}
                <tr>
                  <td colSpan={3} className="px-6 py-3 text-right text-sm font-medium text-gray-900">
                    Total TTC
                  </td>
                  <td className="px-6 py-3 text-sm font-medium text-gray-900">
                    {formatCurrency(formData.total || 0)}
                  </td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Notes</label>
          <textarea
            value={formData.notes}
            onChange={e => setFormData(prev => ({ ...prev, notes: e.target.value }))}
            rows={4}
            className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
            placeholder="Notes ou conditions particulières..."
          />
        </div>

        <div className="flex justify-end space-x-3">
          <button
            type="button"
            onClick={onCancel}
            className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            disabled={isSubmitting}
          >
            Annuler
          </button>
          <button
            type="submit"
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            disabled={isSubmitting}
          >
            <Save className="w-4 h-4 mr-2" />
            {isSubmitting ? 'Enregistrement...' : 'Enregistrer'}
          </button>
        </div>

        {errors.submit && (
          <div className="mt-4 p-4 bg-red-50 rounded-md">
            <div className="flex">
              <AlertTriangle className="w-5 h-5 text-red-400" />
              <p className="ml-3 text-sm text-red-500">{errors.submit}</p>
            </div>
          </div>
        )}
      </form>

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