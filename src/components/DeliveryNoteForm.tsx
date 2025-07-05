import React, { useState, useEffect } from 'react';
import {
  Plus,
  Trash2,
  Save,
  ArrowLeft,
  CheckCircle,
  ShoppingCart,
  FileText,
} from 'lucide-react';
import { DeliveryNote, WooCommerceOrder, Invoice } from '../types';
import { orderService } from '../services/orderService';
import { invoiceService } from '../services/invoiceService';
import { wooCommerceService } from '../services/woocommerce';
import { generateDocumentNumber } from '../utils/formatters';

interface DeliveryNoteFormProps {
  editingNote?: DeliveryNote | null;
  sourceOrder?: WooCommerceOrder | null;
  sourceInvoice?: Invoice | null;
  onSave: (note: DeliveryNote) => void;
  onCancel: () => void;
}

const DeliveryNoteForm: React.FC<DeliveryNoteFormProps> = ({
  editingNote,
  sourceOrder,
  sourceInvoice,
  onSave,
  onCancel
}) => {
  const [formData, setFormData] = useState<Partial<DeliveryNote>>({
    id: '',
    number: '',
    date: new Date().toISOString().split('T')[0],
    status: 'draft',
    customer_data: {
      name: '',
      company: '',
      address: '',
      city: '',
      postalCode: '',
      country: 'Maroc'
    },
    items: [],
    notes: ''
  });

  const [availableOrders, setAvailableOrders] = useState<WooCommerceOrder[]>([]);
  const [availableInvoices, setAvailableInvoices] = useState<Invoice[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<WooCommerceOrder | null>(null);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [errors, setErrors] = useState<{[key: string]: string}>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [updateOrderStatus, setUpdateOrderStatus] = useState(false);
  const [estimatedDeliveryDate, setEstimatedDeliveryDate] = useState('');

  const deliveryStatuses = [
    { value: 'pending', label: 'En attente', color: 'orange' },
    { value: 'in_transit', label: 'En cours de livraison', color: 'blue' },
    { value: 'delivered', label: 'Livré', color: 'green' },
    { value: 'cancelled', label: 'Annulé', color: 'red' }
  ];

  useEffect(() => {
    const loadData = async () => {
      try {
        // Load available orders and invoices
        const orders = await orderService.getOrders();
        const invoices = await invoiceService.getInvoices();
        setAvailableOrders(orders.data);
        setAvailableInvoices(invoices);

        if (editingNote) {
          setFormData(editingNote);
          setEstimatedDeliveryDate(editingNote.estimated_delivery_date || '');

          if (editingNote.orderId) {
            const order = orders.data.find(o => o.id === editingNote.orderId);
            setSelectedOrder(order || null);
          }

          if (editingNote.invoice_id) {
            const invoice = invoices.find(i => i.id === editingNote.invoice_id);
            setSelectedInvoice(invoice || null);
          }
        } else if (sourceOrder) {
          await initializeFromOrder(sourceOrder);
        } else if (sourceInvoice) {
          await initializeFromInvoice(sourceInvoice);
        } else {
          // New delivery note
          const tomorrow = new Date();
          tomorrow.setDate(tomorrow.getDate() + 1);

          const documentNumber = await generateDocumentNumber('BL');

          setFormData({
            id: crypto.randomUUID(),
            number: documentNumber,
            date: new Date().toISOString().split('T')[0],
            status: 'draft',
            customer_data: {
              name: '',
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
              delivered: 0
            }],
            notes: ''
          });

          setEstimatedDeliveryDate(tomorrow.toISOString().split('T')[0]);
        }
      } catch (error) {
        console.error('Error loading data:', error);
      }
    };

    loadData();
  }, [editingNote, sourceOrder, sourceInvoice]);

  const initializeFromOrder = async (order: WooCommerceOrder) => {
    setSelectedOrder(order);

    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);

    const documentNumber = await generateDocumentNumber('BL');

    setFormData({
      id: crypto.randomUUID(),
      number: documentNumber,
      orderId: order.id,
      date: new Date().toISOString().split('T')[0],
      status: 'draft',
      customer_data: {
        name: order.billing ? `${order.billing.first_name || ''} ${order.billing.last_name || ''}`.trim() : '',
        company: order.billing?.company || '',
        address: order.shipping ? `${order.shipping.address_1 || ''}${order.shipping.address_2 ? ` ${order.shipping.address_2}` : ''}` : '',
        city: order.shipping?.city || '',
        postalCode: order.shipping?.postcode || '',
        country: order.shipping?.country || ''
      },
      items: order.line_items?.map(item => ({
        id: crypto.randomUUID(),
        description: item.name,
        quantity: item.quantity,
        delivered: 0,
        productId: item.product_id
      })) || [],
      notes: `Bon de livraison généré à partir de la commande #${order.number}`
    });

    setEstimatedDeliveryDate(tomorrow.toISOString().split('T')[0]);
  };

  const initializeFromInvoice = async (invoice: Invoice) => {
    setSelectedInvoice(invoice);

    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);

    const documentNumber = await generateDocumentNumber('BL');

    setFormData({
      id: crypto.randomUUID(),
      number: documentNumber,
      invoice_id: invoice.id,
      orderId: invoice.orderId,
      date: new Date().toISOString().split('T')[0],
      status: 'draft',
      customer_data: {
        name: invoice.customer.name,
        company: invoice.customer.company || '',
        address: invoice.customer.address,
        city: invoice.customer.city,
        postalCode: invoice.customer.postalCode,
        country: invoice.customer.country
      },
      items: invoice.items.map(item => ({
        id: crypto.randomUUID(),
        description: item.description,
        quantity: item.quantity,
        delivered: 0,
        productId: item.productId
      })),
      notes: `Bon de livraison généré à partir de la facture #${invoice.number}`
    });

    setEstimatedDeliveryDate(tomorrow.toISOString().split('T')[0]);
  };

  const handleOrderSelect = async (orderId: number) => {
    const order = availableOrders.find(o => o.id === orderId);
    if (order) {
      await initializeFromOrder(order);
      setSelectedInvoice(null);
    }
  };

  const handleInvoiceSelect = async (invoiceId: string) => {
    const invoice = availableInvoices.find(i => i.id === invoiceId);
    if (invoice) {
      await initializeFromInvoice(invoice);
      setSelectedOrder(null);
    }
  };

  const handleCustomerChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      customer_data: {
        ...prev.customer_data!,
        [field]: value
      }
    }));
  };

  const handleItemChange = (index: number, field: string, value: any) => {
    const newItems = [...(formData.items || [])];
    newItems[index] = {
      ...newItems[index],
      [field]: value
    };

    // Ensure delivered quantity doesn't exceed ordered quantity
    if (field === 'delivered' && value > newItems[index].quantity) {
      newItems[index].delivered = newItems[index].quantity;
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
          delivered: 0
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

  const addFromOrder = () => {
    if (!selectedOrder) return;

    const orderItems = selectedOrder.line_items?.map(item => ({
      id: crypto.randomUUID(),
      description: item.name,
      quantity: item.quantity,
      delivered: 0,
      productId: item.product_id
    })) || [];

    setFormData(prev => ({
      ...prev,
      items: [...(prev.items || []), ...orderItems]
    }));
  };

  const addFromInvoice = () => {
    if (!selectedInvoice) return;

    const invoiceItems = selectedInvoice.items.map(item => ({
      id: crypto.randomUUID(),
      description: item.description,
      quantity: item.quantity,
      delivered: 0,
      productId: item.productId
    }));

    setFormData(prev => ({
      ...prev,
      items: [...(prev.items || []), ...invoiceItems]
    }));
  };

  const markAllAsDelivered = () => {
    setFormData(prev => ({
      ...prev,
      items: prev.items?.map(item => ({
        ...item,
        delivered: item.quantity
      })) || []
    }));
  };

  const calculateDeliveryStatus = () => {
    const items = formData.items || [];
    if (items.length === 0) return 'pending';

    const totalQuantity = items.reduce((sum, item) => sum + item.quantity, 0);
    const totalDelivered = items.reduce((sum, item) => sum + (item.delivered || 0), 0);

    if (totalDelivered === 0) return 'pending';
    if (totalDelivered >= totalQuantity) return 'delivered';
    return 'partial';
  };

  const validateForm = (): boolean => {
    const newErrors: {[key: string]: string} = {};

    if (!formData.customer_data?.name.trim()) {
      newErrors.customerName = 'Le nom du client est requis';
    }

    if (!formData.customer_data?.address.trim()) {
      newErrors.customerAddress = 'L\'adresse de livraison est requise';
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
        if (item.delivered < 0 || item.delivered > item.quantity) {
          newErrors[`item_${index}_delivered`] = 'Quantité livrée invalide';
        }
      });
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const processDeliveryUpdates = async (note: DeliveryNote) => {
    try {
      console.log('Traitement du bon de livraison:', note);

      // Update order status if requested and delivery is complete
      if (updateOrderStatus && note.orderId && note.status === 'delivered') {
        try {
          console.log(`Mise à jour du statut de la commande ${note.orderId} vers 'completed'`);
          await wooCommerceService.updateOrderStatus(note.orderId, 'completed');
          console.log('Statut de la commande mis à jour avec succès');
        } catch (error) {
          console.error('Erreur lors de la mise à jour du statut de la commande:', error);
        }
      }

      // Add note to WooCommerce order
      if (note.orderId) {
        try {
          const deliveryStatus = calculateDeliveryStatus();
          const noteText = `Bon de livraison ${note.number} - Statut: ${note.status}. ` +
                          `Articles: ${note.items.length}. ` +
                          `Livraison: ${deliveryStatus === 'delivered' ? 'Complète' :
                                     deliveryStatus === 'partial' ? 'Partielle' : 'En attente'}`;
          await wooCommerceService.addOrderNote(note.orderId, noteText, true);
          console.log('Note ajoutée à la commande WooCommerce');
        } catch (error) {
          console.error('Erreur lors de l\'ajout de la note à la commande:', error);
        }
      }

      console.log('Traitement du bon de livraison terminé avec succès');
    } catch (error) {
      console.error('Erreur lors du traitement du bon de livraison:', error);
      throw error;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);

    try {
      const note: DeliveryNote = {
        id: formData.id!,
        number: formData.number!,
        orderId: formData.orderId,
        invoice_id: formData.invoice_id,
        date: formData.date!,
        status: formData.status!,
        customer_data: formData.customer_data!,
        items: formData.items!,
        estimated_delivery_date: estimatedDeliveryDate,
        notes: formData.notes,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      // Process WooCommerce updates if delivery is marked as delivered
      if (note.status === 'delivered') {
        await processDeliveryUpdates(note);
        alert('Bon de livraison sauvegardé avec succès ! La commande WooCommerce a été mise à jour.');
      }

      onSave(note);
    } catch (error) {
      console.error('Erreur lors de la sauvegarde:', error);
      alert('Erreur lors de la sauvegarde du bon de livraison: ' + (error as Error).message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const getDeliveryProgress = () => {
    const items = formData.items || [];
    if (items.length === 0) return 0;

    const totalQuantity = items.reduce((sum, item) => sum + item.quantity, 0);
    const totalDelivered = items.reduce((sum, item) => sum + (item.delivered || 0), 0);

    return totalQuantity > 0 ? Math.round((totalDelivered / totalQuantity) * 100) : 0;
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
              <span>Retour aux bons de livraison</span>
            </button>
            <h1 className="text-3xl font-bold text-gray-900">
              {editingNote ? 'Modifier le bon de livraison' : 'Nouveau bon de livraison'}
            </h1>
            {sourceOrder && (
              <p className="text-gray-600 mt-1">
                À partir de la commande #{sourceOrder.number}
              </p>
            )}
            {sourceInvoice && (
              <p className="text-gray-600 mt-1">
                À partir de la facture #{sourceInvoice.number}
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

      {/* Scrollable Content */}
      <div className="flex-1 overflow-auto p-6">
        <form onSubmit={handleSubmit} className="max-w-6xl mx-auto space-y-6">
          {/* Delivery Note Header */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-6">Informations générales</h2>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Numéro de bon de livraison
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
                  Date de préparation
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
                  Date de livraison estimée
                </label>
                <input
                  type="date"
                  value={estimatedDeliveryDate}
                  onChange={(e) => setEstimatedDeliveryDate(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>

            <div className="mt-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Statut de livraison
              </label>
              <select
                value={formData.status}
                onChange={(e) => setFormData(prev => ({ ...prev, status: e.target.value as any }))}
                className="w-full max-w-xs px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                {deliveryStatuses.map(status => (
                  <option key={status.value} value={status.value}>
                    {status.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Progress Bar */}
            <div className="mt-6">
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-medium text-gray-700">Progression de livraison</span>
                <span className="text-sm text-gray-600">{getDeliveryProgress()}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${getDeliveryProgress()}%` }}
                ></div>
              </div>
            </div>
          </div>

          {/* Source Selection */}
          {!sourceOrder && !sourceInvoice && (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-6">Source du bon de livraison</h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Commande liée (optionnel)
                  </label>
                  <select
                    value={selectedOrder?.id || ''}
                    onChange={(e) => e.target.value ? handleOrderSelect(parseInt(e.target.value)) : setSelectedOrder(null)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">Aucune commande</option>
                    {availableOrders.map(order => (
                      <option key={order.id} value={order.id}>
                        #{order.number} - {order.billing ? `${order.billing.first_name || ''} ${order.billing.last_name || ''}`.trim() : 'No name'}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Facture liée (optionnel)
                  </label>
                  <select
                    value={selectedInvoice?.id || ''}
                    onChange={(e) => e.target.value ? handleInvoiceSelect(e.target.value) : setSelectedInvoice(null)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">Aucune facture</option>
                    {availableInvoices.map(invoice => (
                      <option key={invoice.id} value={invoice.id}>
                        #{invoice.number} - {invoice.customer.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* Customer Information */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-6">Adresse de livraison</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Nom du destinataire *
                </label>
                <input
                  type="text"
                  value={formData.customer_data?.name || ''}
                  onChange={(e) => handleCustomerChange('name', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  required
                />
                {errors.customerName && <p className="text-red-500 text-sm mt-1">{errors.customerName}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Entreprise
                </label>
                <input
                  type="text"
                  value={formData.customer_data?.company || ''}
                  onChange={(e) => handleCustomerChange('company', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Adresse *
                </label>
                <input
                  type="text"
                  value={formData.customer_data?.address || ''}
                  onChange={(e) => handleCustomerChange('address', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  required
                />
                {errors.customerAddress && <p className="text-red-500 text-sm mt-1">{errors.customerAddress}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Ville *
                </label>
                <input
                  type="text"
                  value={formData.customer_data?.city || ''}
                  onChange={(e) => handleCustomerChange('city', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Code postal *
                </label>
                <input
                  type="text"
                  value={formData.customer_data?.postalCode || ''}
                  onChange={(e) => handleCustomerChange('postalCode', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  required
                />
              </div>
            </div>
          </div>

          {/* Items */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-lg font-semibold text-gray-900">Articles à livrer</h2>
              <div className="flex space-x-3">
                {selectedOrder && (
                  <button
                    type="button"
                    onClick={addFromOrder}
                    className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                  >
                    <ShoppingCart className="w-4 h-4" />
                    <span>Ajouter de la commande</span>
                  </button>
                )}
                {selectedInvoice && (
                  <button
                    type="button"
                    onClick={addFromInvoice}
                    className="flex items-center space-x-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
                  >
                    <FileText className="w-4 h-4" />
                    <span>Ajouter de la facture</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={markAllAsDelivered}
                  className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                >
                  <CheckCircle className="w-4 h-4" />
                  <span>Tout livrer</span>
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
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Qté commandée</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Qté livrée</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Statut</th>
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
                        {item.productId && (
                          <p className="text-xs text-gray-500 mt-1">ID Produit: {item.productId}</p>
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
                          value={item.delivered || 0}
                          onChange={(e) => handleItemChange(index, 'delivered', parseInt(e.target.value) || 0)}
                          className="w-20 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          min="0"
                          max={item.quantity}
                        />
                        {errors[`item_${index}_delivered`] && (
                          <p className="text-red-500 text-xs mt-1">{errors[`item_${index}_delivered`]}</p>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        {(item.delivered || 0) === 0 ? (
                          <span className="px-2 py-1 bg-orange-100 text-orange-800 text-xs rounded-full">En attente</span>
                        ) : (item.delivered || 0) >= item.quantity ? (
                          <span className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded-full">Complet</span>
                        ) : (
                          <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full">Partiel</span>
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

          {/* WooCommerce Options */}
          {formData.status === 'delivered' && (
            <div className="bg-blue-50 rounded-lg border border-blue-200 p-6">
              <h3 className="text-lg font-semibold text-blue-900 mb-4">Options WooCommerce</h3>
              <div className="space-y-4">
                <div className="flex items-center space-x-3">
                  <input
                    type="checkbox"
                    id="updateOrderStatus"
                    checked={updateOrderStatus}
                    onChange={(e) => setUpdateOrderStatus(e.target.checked)}
                    className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <label htmlFor="updateOrderStatus" className="text-sm font-medium text-blue-900">
                    Marquer la commande comme terminée dans WooCommerce
                  </label>
                </div>
              </div>
            </div>
          )}

          {/* Notes */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Notes de livraison</h2>
            <textarea
              value={formData.notes || ''}
              onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
              rows={4}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Instructions spéciales, horaires de livraison, etc..."
            />
          </div>
        </form>
      </div>
    </div>
  );
};

export default DeliveryNoteForm;