import React, { useState, useEffect } from 'react';
import {
  Plus,
  Trash2,
  Save,
  ArrowLeft,
  User,
  AlertTriangle,
  Search,
} from 'lucide-react';
import { ReturnNote, Customer, DeliveryNote, Invoice } from '../types';
import { customerService } from '../services/customerService';
import { returnNoteService } from '../services/returnNoteService';
import { deliveryNoteService } from '../services/deliveryNoteService';
import { invoiceService } from '../services/invoiceService';
import { formatCurrency, formatDate } from '../utils/formatters';
import { documentNumberingService } from '../services/documentNumberingService';

interface ReturnNoteFormProps {
  editingNote?: ReturnNote | null;
  onSave: (note: ReturnNote) => void;
  onCancel: () => void;
}

const ReturnNoteForm: React.FC<ReturnNoteFormProps> = ({
  editingNote,
  onSave,
  onCancel
}) => {
  const [formData, setFormData] = useState<Partial<ReturnNote>>({
    id: '',
    number: '',
    date: new Date().toISOString().split('T')[0],
    status: 'draft',
    customer_id: '',
    customer_data: undefined,
    invoice_id: undefined,
    delivery_note_id: undefined,
    items: [],
    reason: '',
    notes: '',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  });

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [deliveryNotes, setDeliveryNotes] = useState<DeliveryNote[]>([]);
  const [errors, setErrors] = useState<{[key: string]: string}>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [showCustomerSearch, setShowCustomerSearch] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setIsLoading(true);

      const [
        savedCustomers,
        savedInvoices,
        savedDeliveryNotes
      ] = await Promise.all([
        customerService.getCustomers(),
        invoiceService.getInvoices(),
        deliveryNoteService.getDeliveryNotes()
      ]);

      setCustomers(savedCustomers);
      setInvoices(savedInvoices);
      setDeliveryNotes(savedDeliveryNotes);

      if (editingNote) {
        setFormData(editingNote);
      } else {
        const number = await documentNumberingService.generateNumber('RETURN');

        setFormData(prev => ({
          ...prev,
          id: crypto.randomUUID(),
          number,
          date: new Date().toISOString().split('T')[0],
          items: [{
            id: crypto.randomUUID(),
            description: '',
            quantity: 1,
            condition: 'new',
            reason: '',
            refundAmount: 0
          }]
        }));
      }
    } catch (error) {
      console.error('Error loading data:', error);
      setErrors({ general: 'Error initializing form. Please try again.' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleCustomerSelect = async (customer: Customer) => {
    setFormData(prev => ({
      ...prev,
      customer_id: customer.id,
      customer_data: {
        name: `${customer.first_name} ${customer.last_name}`,
        email: customer.email,
        company: customer.company || ''
      }
    }));
    setShowCustomerSearch(false);
  };

  const handleInvoiceSelect = async (invoiceId: string | null) => {
    if (!invoiceId) {
      setFormData(prev => ({
        ...prev,
        invoice_id: undefined
      }));
      return;
    }

    const invoice = invoices.find(i => i.id === invoiceId);
    if (invoice) {
      setFormData(prev => ({
        ...prev,
        invoice_id: invoice.id,
        customer_id: invoice.customer.email,
        customer_data: {
          name: invoice.customer.name,
          email: invoice.customer.email,
          company: invoice.customer.company
        }
      }));
    }
  };

  const handleDeliveryNoteSelect = async (deliveryNoteId: string | null) => {
    if (!deliveryNoteId) {
      setFormData(prev => ({
        ...prev,
        delivery_note_id: undefined
      }));
      return;
    }

    const note = deliveryNotes.find(n => n.id === deliveryNoteId);
    if (note) {
      setFormData(prev => ({
        ...prev,
        delivery_note_id: note.id,
        customer_id: note.customer_id,
        customer_data: note.customer_data
      }));
    }
  };

  const handleItemChange = (index: number, field: string, value: any) => {
    const newItems = [...(formData.items || [])];
    newItems[index] = {
      ...newItems[index],
      [field]: value
    };

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
          condition: 'new',
          reason: '',
          refundAmount: 0
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

  const validateForm = (): boolean => {
    const newErrors: {[key: string]: string} = {};

    if (!formData.customer_id) {
      newErrors.customer = 'Veuillez sélectionner un client';
    }

    if (!formData.reason?.trim()) {
      newErrors.reason = 'La raison du retour est requise';
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
        const itemReason = item.reason || '';
        if (!itemReason.trim()) {
          newErrors[`item_${index}_reason`] = 'Raison requise';
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
      const note: ReturnNote = {
        id: formData.id!,
        number: formData.number!,
        date: formData.date!,
        status: formData.status!,
        customer_id: formData.customer_id!,
        customer_data: formData.customer_data!,
        invoice_id: formData.invoice_id,
        delivery_note_id: formData.delivery_note_id,
        items: formData.items!.map(item => ({
          ...item,
          condition: item.condition || 'new',
          refundAmount: item.refundAmount || 0
        })),
        reason: formData.reason!,
        notes: formData.notes,
        created_at: formData.created_at!,
        updated_at: new Date().toISOString()
      };

      if (editingNote) {
        await returnNoteService.updateReturnNote(note.id, note);
      } else {
        await returnNoteService.createReturnNote(note);
      }
      onSave(note);
    } catch (error) {
      console.error('Error saving note:', error);
      alert('Erreur lors de la sauvegarde du bon de retour');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCustomerClear = () => {
    setFormData(prev => ({
      ...prev,
      customer_id: '',
      customer_data: undefined
    }));
  };

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Chargement...</p>
        </div>
      </div>
    );
  }

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
              <span>Retour aux bons de retour</span>
            </button>
            <h1 className="text-3xl font-bold text-gray-900">
              {editingNote ? 'Modifier le bon de retour' : 'Nouveau bon de retour'}
            </h1>
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

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        <form onSubmit={handleSubmit} className="max-w-6xl mx-auto space-y-6">
          {errors.general && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start space-x-3">
              <AlertTriangle className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-red-800">{errors.general}</p>
              </div>
            </div>
          )}

          {/* Return Note Header */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-6">Informations générales</h2>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Numéro de bon de retour
                </label>
                <input
                  type="text"
                  value={formData.number}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-gray-50"
                  required
                  readOnly
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Date du retour
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
                  Statut
                </label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData(prev => ({ ...prev, status: e.target.value as any }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="draft">Brouillon</option>
                  <option value="processed">Traité</option>
                  <option value="cancelled">Annulé</option>
                </select>
              </div>
            </div>

            <div className="mt-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Raison principale du retour *
              </label>
              <textarea
                value={formData.reason}
                onChange={(e) => setFormData(prev => ({ ...prev, reason: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                rows={2}
                required
              />
              {errors.reason && <p className="text-red-500 text-sm mt-1">{errors.reason}</p>}
            </div>
          </div>

          {/* Customer Information */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-lg font-semibold text-gray-900">Client</h2>
              <button
                type="button"
                onClick={() => setShowCustomerSearch(true)}
                className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Search className="w-4 h-4" />
                <span>Rechercher un client</span>
              </button>
            </div>

            {formData.customer_data ? (
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <p className="font-medium text-gray-900">{formData.customer_data.name}</p>
                    <p className="text-sm text-gray-600">{formData.customer_data.email}</p>
                    {formData.customer_data.company && (
                      <p className="text-sm text-gray-600">{formData.customer_data.company}</p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={handleCustomerClear}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    ×
                  </button>
                </div>
              </div>
            ) : (
              <div className="text-center py-6 bg-gray-50 rounded-lg border-2 border-dashed border-gray-200">
                <User className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                <p className="text-sm text-gray-600">
                  Aucun client sélectionné. Utilisez le bouton de recherche pour en sélectionner un.
                </p>
              </div>
            )}
            {errors.customer && <p className="text-red-500 text-sm mt-2">{errors.customer}</p>}
          </div>

          {/* Linked Documents */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-6">Documents liés</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Facture liée
                </label>
                <select
                  value={formData.invoice_id || ''}
                  onChange={(e) => handleInvoiceSelect(e.target.value || null)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">Aucune facture</option>
                  {invoices.map(invoice => (
                    <option key={invoice.id} value={invoice.id}>
                      #{invoice.number} - {formatDate(invoice.date)} - {formatCurrency(invoice.total)}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Bon de livraison lié
                </label>
                <select
                  value={formData.delivery_note_id || ''}
                  onChange={(e) => handleDeliveryNoteSelect(e.target.value || null)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">Aucun bon de livraison</option>
                  {deliveryNotes.map(note => (
                    <option key={note.id} value={note.id}>
                      #{note.number} - {formatDate(note.date)}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Items */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-lg font-semibold text-gray-900">Articles à retourner</h2>
              <button
                type="button"
                onClick={addItem}
                className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Plus className="w-4 h-4" />
                <span>Ajouter un article</span>
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Description</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Quantité</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Raison</th>
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
                          type="text"
                          value={item.reason}
                          onChange={(e) => handleItemChange(index, 'reason', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          placeholder="Raison du retour"
                        />
                        {errors[`item_${index}_reason`] && (
                          <p className="text-red-500 text-xs mt-1">{errors[`item_${index}_reason`]}</p>
                        )}
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
      </div>

      {/* Customer Search Modal */}
      {showCustomerSearch && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-2xl w-full">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">Rechercher un client</h3>
                <button
                  onClick={() => setShowCustomerSearch(false)}
                  className="text-gray-400 hover:text-gray-600 text-2xl"
                >
                  ×
                </button>
              </div>

              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Search className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Rechercher par nom, email..."
                  className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg leading-5 bg-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                />
              </div>
            </div>

            <div className="max-h-96 overflow-y-auto p-6">
              {customers
                .filter(customer =>
                  `${customer.first_name} ${customer.last_name}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
                  customer.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
                  (customer.company || '').toLowerCase().includes(searchTerm.toLowerCase())
                )
                .map(customer => (
                  <button
                    key={customer.id}
                    onClick={() => handleCustomerSelect(customer)}
                    className="w-full text-left p-3 hover:bg-gray-50 rounded-lg mb-2 last:mb-0"
                  >
                    <div className="font-medium text-gray-900">
                      {customer.first_name} {customer.last_name}
                    </div>
                    <div className="text-sm text-gray-600">{customer.email}</div>
                    {customer.company && (
                      <div className="text-sm text-gray-500">{customer.company}</div>
                    )}
                  </button>
                ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ReturnNoteForm;