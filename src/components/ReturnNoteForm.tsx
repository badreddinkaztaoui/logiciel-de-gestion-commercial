import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  Trash2, 
  Save, 
  ArrowLeft, 
  User, 
  Package,
  AlertTriangle,
  CheckCircle,
  Search,
  ShoppingCart,
  FileText,
  Calculator
} from 'lucide-react';
import { ReturnNote, WooCommerceOrder } from '../types';
import { orderService } from '../services/orderService';
import { returnNoteService } from '../services/returnNoteService';
import { wooCommerceService } from '../services/woocommerce';
import { formatCurrency, formatDate, generateDocumentNumber } from '../utils/formatters';

interface ReturnNoteFormProps {
  editingNote?: ReturnNote | null;
  sourceOrder?: WooCommerceOrder | null;
  onSave: (note: ReturnNote) => void;
  onCancel: () => void;
}

const ReturnNoteForm: React.FC<ReturnNoteFormProps> = ({
  editingNote,
  sourceOrder,
  onSave,
  onCancel
}) => {
  const [formData, setFormData] = useState<Partial<ReturnNote>>({
    id: '',
    number: '',
    date: new Date().toISOString().split('T')[0],
    reason: '',
    status: 'pending',
    customer: {
      name: '',
      email: '',
      company: ''
    },
    items: [],
    notes: ''
  });

  const [availableOrders, setAvailableOrders] = useState<WooCommerceOrder[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<WooCommerceOrder | null>(null);
  const [errors, setErrors] = useState<{[key: string]: string}>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [refundAmount, setRefundAmount] = useState(0);
  const [updateStock, setUpdateStock] = useState(true);
  const [updateOrderStatus, setUpdateOrderStatus] = useState(false);

  const returnReasons = [
    'Produit défectueux',
    'Produit endommagé lors de la livraison',
    'Ne correspond pas à la description',
    'Erreur de commande',
    'Client a changé d\'avis',
    'Produit non conforme',
    'Autre'
  ];

  const itemConditions = [
    { value: 'new', label: 'Neuf', description: 'Produit en parfait état' },
    { value: 'used', label: 'Utilisé', description: 'Produit utilisé mais fonctionnel' },
    { value: 'damaged', label: 'Endommagé', description: 'Produit défectueux ou abîmé' }
  ];

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      // Load available orders
      const orders = await orderService.getOrders();
      setAvailableOrders(orders);

      if (editingNote) {
        setFormData(editingNote);
        calculateRefundAmount(editingNote.items);
        if (editingNote.orderId) {
          const order = orders.find(o => o.id === editingNote.orderId);
          setSelectedOrder(order || null);
        }
      } else if (sourceOrder) {
        await initializeFromOrder(sourceOrder);
      } else {
        // New return note
        const documentNumber = await generateDocumentNumber('RET');
        
        setFormData({
          id: crypto.randomUUID(),
          number: documentNumber,
          date: new Date().toISOString().split('T')[0],
          reason: '',
          status: 'pending',
          customer: {
            name: '',
            email: '',
            company: ''
          },
          items: [{
            id: crypto.randomUUID(),
            description: '',
            quantity: 1,
            reason: '',
            condition: 'new'
          }],
          notes: ''
        });
      }
    } catch (error) {
      console.error('Error loading data:', error);
    }
  };

  const initializeFromOrder = async (order: WooCommerceOrder) => {
    setSelectedOrder(order);
    
    const documentNumber = await generateDocumentNumber('RET');
    
    setFormData({
      id: crypto.randomUUID(),
      number: documentNumber,
      orderId: order.id,
      date: new Date().toISOString().split('T')[0],
      reason: '',
      status: 'pending',
      customer: {
        name: `${order.billing.first_name} ${order.billing.last_name}`,
        email: order.billing.email,
        company: order.billing.company || ''
      },
      items: order.line_items.map(item => ({
        id: crypto.randomUUID(),
        description: item.name,
        quantity: item.quantity,
        reason: '',
        condition: 'new',
        productId: item.product_id,
        originalPrice: item.price,
        refundAmount: item.price * item.quantity
      })),
      notes: `Bon de retour généré à partir de la commande #${order.number}`
    });
  };

  const calculateRefundAmount = (items: any[]) => {
    const total = items.reduce((sum, item) => sum + (item.refundAmount || 0), 0);
    setRefundAmount(total);
  };

  useEffect(() => {
    if (formData.items) {
      calculateRefundAmount(formData.items);
    }
  }, [formData.items]);

  const handleOrderSelect = async (orderId: number) => {
    const order = availableOrders.find(o => o.id === orderId);
    if (order) {
      await initializeFromOrder(order);
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
  };

  const handleItemChange = (index: number, field: string, value: any) => {
    const newItems = [...(formData.items || [])];
    newItems[index] = {
      ...newItems[index],
      [field]: value
    };

    // Auto-calculate refund amount based on condition
    if (field === 'condition' || field === 'quantity') {
      const item = newItems[index];
      if (item.originalPrice) {
        let refundPercentage = 1; // 100% by default
        
        switch (item.condition) {
          case 'used':
            refundPercentage = 0.8; // 80% for used items
            break;
          case 'damaged':
            refundPercentage = 0.5; // 50% for damaged items
            break;
          default:
            refundPercentage = 1; // 100% for new items
        }
        
        item.refundAmount = item.originalPrice * item.quantity * refundPercentage;
      }
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
          reason: '',
          condition: 'new',
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

  const addFromOrder = () => {
    if (!selectedOrder) return;

    const orderItems = selectedOrder.line_items.map(item => ({
      id: crypto.randomUUID(),
      description: item.name,
      quantity: item.quantity,
      reason: formData.reason || '',
      condition: 'new' as const,
      productId: item.product_id,
      originalPrice: item.price,
      refundAmount: item.price * item.quantity
    }));

    setFormData(prev => ({
      ...prev,
      items: [...(prev.items || []), ...orderItems]
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
        if (!item.reason.trim()) {
          newErrors[`item_${index}_reason`] = 'Raison requise';
        }
      });
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Vérifiez si tous les articles sont retournés
  const areAllItemsReturned = (order: WooCommerceOrder, returnItems: any[]): boolean => {
    // Créer une map des quantités de produits dans la commande originale
    const originalItemQuantities: Record<number, number> = {};
    order.line_items.forEach(item => {
      originalItemQuantities[item.product_id] = item.quantity;
    });
    
    // Vérifier si tous les articles de la commande sont retournés
    for (const productId in originalItemQuantities) {
      const returnedItem = returnItems.find(item => item.productId === parseInt(productId));
      
      // Si l'article n'est pas retourné ou la quantité retournée est inférieure
      if (!returnedItem || returnedItem.quantity < originalItemQuantities[parseInt(productId)]) {
        return false;
      }
    }
    
    return true;
  };

  const processReturnUpdates = async (note: ReturnNote) => {
    try {
      console.log('Traitement du retour:', note);
      
      // Update stock for items with product IDs (only for new condition items)
      if (updateStock) {
        console.log('Mise à jour du stock...');
        for (const item of note.items) {
          if (item.productId && item.condition === 'new') {
            try {
              console.log(`Augmentation du stock pour le produit ${item.productId}: +${item.quantity}`);
              await wooCommerceService.increaseProductStock(item.productId, item.quantity);
              console.log(`Stock mis à jour avec succès pour le produit ${item.productId}`);
            } catch (error) {
              console.error(`Erreur lors de la mise à jour du stock pour le produit ${item.productId}:`, error);
            }
          }
        }
      }

      // Mise à jour conditionnelle du statut de commande
      if (updateOrderStatus && note.orderId) {
        // Vérifier si l'ordre existe
        const order = availableOrders.find(o => o.id === note.orderId);
        
        if (order) {
          // Vérifier si tous les articles sont retournés
          const allReturned = areAllItemsReturned(order, note.items);
          
          if (allReturned) {
            try {
              console.log(`Mise à jour du statut de la commande ${note.orderId} vers 'refunded'`);
              await wooCommerceService.updateOrderStatus(note.orderId, 'refunded');
              console.log('Statut de la commande mis à jour avec succès');
            } catch (error) {
              console.error('Erreur lors de la mise à jour du statut de la commande:', error);
            }
          } else {
            console.log('Pas de mise à jour du statut car tous les articles ne sont pas retournés');
          }
        }
      }

      // Add note to WooCommerce order
      if (note.orderId) {
        try {
          const noteText = `Bon de retour ${note.number} créé. Raison: ${note.reason}. Articles retournés: ${note.items.length}`;
          await wooCommerceService.addOrderNote(note.orderId, noteText, true);
          console.log('Note ajoutée à la commande WooCommerce');
        } catch (error) {
          console.error('Erreur lors de l\'ajout de la note à la commande:', error);
        }
      }

      console.log('Traitement du retour terminé avec succès');
    } catch (error) {
      console.error('Erreur lors du traitement du retour:', error);
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
      const note: ReturnNote = {
        id: formData.id!,
        number: formData.number!,
        orderId: formData.orderId,
        date: formData.date!,
        reason: formData.reason!,
        status: formData.status!,
        customer: formData.customer!,
        items: formData.items!,
        refundAmount: refundAmount,
        notes: formData.notes
      };

      // Update WooCommerce stock and order status if note is approved/processed
      if (note.status === 'approved' || note.status === 'processed') {
        await processReturnUpdates(note);
        
        // Show success message
        if (updateOrderStatus) {
          if (note.orderId && selectedOrder && areAllItemsReturned(selectedOrder, note.items)) {
            alert(`Bon de retour ${note.status === 'approved' ? 'approuvé' : 'traité'} avec succès ! Le stock WooCommerce a été mis à jour et le statut de la commande a été changé en 'Remboursé'.`);
          } else {
            alert(`Bon de retour ${note.status === 'approved' ? 'approuvé' : 'traité'} avec succès ! Le stock WooCommerce a été mis à jour. Le statut de la commande n'a pas été modifié car tous les articles n'ont pas été retournés.`);
          }
        } else {
          alert(`Bon de retour ${note.status === 'approved' ? 'approuvé' : 'traité'} avec succès ! Le stock WooCommerce a été mis à jour.`);
        }
      }

      await returnNoteService.saveReturnNote(note);
      onSave(note);
    } catch (error) {
      console.error('Erreur lors de la sauvegarde:', error);
      alert('Erreur lors de la sauvegarde du bon de retour: ' + (error as Error).message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const getConditionColor = (condition: string) => {
    switch (condition) {
      case 'new': return 'text-green-600 bg-green-50';
      case 'used': return 'text-yellow-600 bg-yellow-50';
      case 'damaged': return 'text-red-600 bg-red-50';
      default: return 'text-gray-600 bg-gray-50';
    }
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
              <span>Retour aux bons de retour</span>
            </button>
            <h1 className="text-3xl font-bold text-gray-900">
              {editingNote ? 'Modifier le bon de retour' : 'Nouveau bon de retour'}
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
                onChange={(e) => setFormData(prev => ({ ...prev, number: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                required
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
                <option value="pending">En attente</option>
                <option value="approved">Approuvé</option>
                <option value="rejected">Rejeté</option>
                <option value="processed">Traité</option>
              </select>
            </div>
          </div>

          <div className="mt-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Raison principale du retour *
            </label>
            <select
              value={formData.reason}
              onChange={(e) => setFormData(prev => ({ ...prev, reason: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              required
            >
              <option value="">Sélectionner une raison</option>
              {returnReasons.map(reason => (
                <option key={reason} value={reason}>{reason}</option>
              ))}
            </select>
            {errors.reason && <p className="text-red-500 text-sm mt-1">{errors.reason}</p>}
          </div>
        </div>

        {/* Customer Information */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-6">Informations client</h2>
          
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
              />
            </div>
            
            {/* Order Selection */}
            {!sourceOrder && (
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
                      #{order.number} - {order.billing.first_name} {order.billing.last_name} - {formatCurrency(parseFloat(order.total))}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </div>

        {/* Items */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-lg font-semibold text-gray-900">Articles à retourner</h2>
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
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">État</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Raison</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Remboursement</th>
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
                        <p className="text-xs text-gray-500 mt-1">ID Produit WooCommerce: {item.productId}</p>
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
                      <select
                        value={item.condition}
                        onChange={(e) => handleItemChange(index, 'condition', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      >
                        {itemConditions.map(condition => (
                          <option key={condition.value} value={condition.value}>
                            {condition.label}
                          </option>
                        ))}
                      </select>
                      <p className="text-xs text-gray-500 mt-1">
                        {itemConditions.find(c => c.value === item.condition)?.description}
                      </p>
                      {item.condition === 'new' && item.productId && (
                        <p className="text-xs text-green-600 mt-1">✓ Stock sera remis à jour</p>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <select
                        value={item.reason}
                        onChange={(e) => handleItemChange(index, 'reason', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      >
                        <option value="">Sélectionner</option>
                        {returnReasons.map(reason => (
                          <option key={reason} value={reason}>{reason}</option>
                        ))}
                      </select>
                      {errors[`item_${index}_reason`] && (
                        <p className="text-red-500 text-xs mt-1">{errors[`item_${index}_reason`]}</p>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <input
                        type="number"
                        value={item.refundAmount || 0}
                        onChange={(e) => handleItemChange(index, 'refundAmount', parseFloat(e.target.value) || 0)}
                        className="w-32 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        min="0"
                        step="0.01"
                      />
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
        {(formData.status === 'approved' || formData.status === 'processed') && (
          <div className="bg-blue-50 rounded-lg border border-blue-200 p-6">
            <h3 className="text-lg font-semibold text-blue-900 mb-4">Options WooCommerce</h3>
            <div className="space-y-4">
              <div className="flex items-center space-x-3">
                <input
                  type="checkbox"
                  id="updateStock"
                  checked={updateStock}
                  onChange={(e) => setUpdateStock(e.target.checked)}
                  className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500"
                />
                <div>
                  <label htmlFor="updateStock" className="text-sm font-medium text-blue-900">
                    Remettre en stock les articles en bon état (condition "Neuf")
                  </label>
                  <p className="text-xs text-gray-500">
                    Augmente automatiquement les quantités en stock dans WooCommerce
                  </p>
                </div>
              </div>
              <div className="flex items-center space-x-3">
                <input
                  type="checkbox"
                  id="updateOrderStatus"
                  checked={updateOrderStatus}
                  onChange={(e) => setUpdateOrderStatus(e.target.checked)}
                  className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500"
                />
                <div>
                  <label htmlFor="updateOrderStatus" className="text-sm font-medium text-blue-900">
                    Marquer la commande comme remboursée
                  </label>
                  <p className="text-xs text-gray-500">
                    Ne mettra à jour le statut que si TOUS les articles de la commande sont retournés
                  </p>
                </div>
              </div>
              <div className="text-sm text-blue-700 bg-blue-100 p-3 rounded">
                <p className="font-medium">Important :</p>
                <p>• Le stock ne sera mis à jour que pour les articles avec ID produit WooCommerce</p>
                <p>• Seuls les articles en état "Neuf" seront remis en stock</p>
                <p>• Le statut de la commande ne sera changé en "Remboursé" que si tous les articles ont été retournés</p>
                <p>• Ces actions se déclencheront à la sauvegarde si le statut est "Approuvé" ou "Traité"</p>
              </div>
            </div>
          </div>
        )}

        {/* Refund Summary */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex justify-end">
            <div className="w-full max-w-md space-y-4">
              <div className="flex justify-between text-lg font-bold text-gray-900 border-t pt-4">
                <span>Montant du remboursement:</span>
                <span className="text-blue-600">{formatCurrency(refundAmount)}</span>
              </div>
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
    </div>
  );
};

export default ReturnNoteForm;