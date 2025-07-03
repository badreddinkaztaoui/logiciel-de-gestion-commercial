import React, { useState } from 'react';
import { 
  Save, 
  ArrowLeft, 
  Package,
  CheckCircle,
  AlertCircle,
  ShoppingCart
} from 'lucide-react';
import { PurchaseOrder, ReceiveItems, PurchaseOrderItem } from '../types';
import { purchaseOrderService } from '../services/purchaseOrderService';
import { supplierService } from '../services/supplierService';
import { formatCurrency, formatDate } from '../utils/formatters';

interface ReceiveItemsFormProps {
  purchaseOrder: PurchaseOrder;
  onSave: () => void;
  onCancel: () => void;
}

const ReceiveItemsForm: React.FC<ReceiveItemsFormProps> = ({
  purchaseOrder,
  onSave,
  onCancel
}) => {
  const [receiveDate, setReceiveDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [receiveItems, setReceiveItems] = useState<{id: string; productId: number; quantity: number; receivedQuantity: number}[]>(
    purchaseOrder.items.map(item => ({
      id: item.id,
      productId: item.productId,
      quantity: item.quantity,
      receivedQuantity: 0
    }))
  );
  const [notes, setNotes] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errors, setErrors] = useState<{[key: string]: string}>({});

  const supplier = supplierService.getSupplierById(purchaseOrder.supplierId);

  const handleReceiveQuantityChange = (itemId: string, quantity: number) => {
    setReceiveItems(prev => prev.map(item => {
      if (item.id === itemId) {
        // Ensure quantity is not greater than what's left to receive
        const purchaseItem = purchaseOrder.items.find(i => i.id === itemId);
        const remainingToReceive = (purchaseItem?.quantity || 0) - (purchaseItem?.received || 0);
        const validQuantity = Math.min(quantity, remainingToReceive);
        
        return {
          ...item,
          receivedQuantity: validQuantity
        };
      }
      return item;
    }));
  };

  const receiveAll = () => {
    setReceiveItems(prev => prev.map(item => {
      const purchaseItem = purchaseOrder.items.find(i => i.id === item.id);
      const remainingToReceive = (purchaseItem?.quantity || 0) - (purchaseItem?.received || 0);
      return {
        ...item,
        receivedQuantity: remainingToReceive
      };
    }));
  };

  const validateForm = (): boolean => {
    const newErrors: {[key: string]: string} = {};
    
    if (!receiveDate) {
      newErrors.receiveDate = 'La date de réception est requise';
    }
    
    const totalReceived = receiveItems.reduce((sum, item) => sum + item.receivedQuantity, 0);
    if (totalReceived <= 0) {
      newErrors.items = 'Vous devez réceptionner au moins un article';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);
    
    try {
      // Ne garder que les articles avec une quantité reçue > 0
      const itemsToReceive = receiveItems.filter(item => item.receivedQuantity > 0);
      
      const receiveData: ReceiveItems = {
        purchaseOrderId: purchaseOrder.id,
        receiveDate,
        items: itemsToReceive,
        notes
      };
      
      // Process the reception in the service
      await purchaseOrderService.receiveItems(receiveData);
      
      alert('Articles réceptionnés avec succès! Le stock WooCommerce a été mis à jour.');
      onSave();
    } catch (error) {
      console.error('Erreur lors de la réception:', error);
      alert(`Erreur lors de la réception des articles: ${(error as Error).message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const getRemainingQuantity = (item: PurchaseOrderItem): number => {
    return Math.max(0, item.quantity - (item.received || 0));
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
              <span>Retour aux bons de commande</span>
            </button>
            <h1 className="text-3xl font-bold text-gray-900">
              Réception d'articles
            </h1>
            <p className="text-gray-600 mt-1">
              Bon de commande #{purchaseOrder.number} - {supplier?.name}
            </p>
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
                  <span>Traitement...</span>
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  <span>Confirmer réception</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      <div className="space-y-8">
        {/* Informations générales */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-6">Informations de réception</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Date de réception
              </label>
              <input
                type="date"
                value={receiveDate}
                onChange={(e) => setReceiveDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                required
              />
              {errors.receiveDate && <p className="text-red-500 text-sm mt-1">{errors.receiveDate}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Bon de commande
              </label>
              <div className="px-3 py-2 border border-gray-200 bg-gray-50 rounded-lg text-gray-700">
                #{purchaseOrder.number} ({formatDate(purchaseOrder.date)})
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Fournisseur
              </label>
              <div className="px-3 py-2 border border-gray-200 bg-gray-50 rounded-lg text-gray-700">
                {supplier?.name}
              </div>
            </div>
          </div>
        </div>

        {/* Articles à réceptionner */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-lg font-semibold text-gray-900">Articles à réceptionner</h2>
            <button
              type="button"
              onClick={receiveAll}
              className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
            >
              <CheckCircle className="w-4 h-4" />
              <span>Tout réceptionner</span>
            </button>
          </div>

          {errors.items && <div className="bg-red-50 border-l-4 border-red-400 p-4 mb-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <AlertCircle className="h-5 w-5 text-red-400" />
              </div>
              <div className="ml-3">
                <p className="text-sm text-red-700">{errors.items}</p>
              </div>
            </div>
          </div>}

          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Description</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Commandé</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Déjà reçu</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Reste à recevoir</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Quantité à réceptionner</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {purchaseOrder.items.map((item) => {
                  const remainingQuantity = getRemainingQuantity(item);
                  const receiveItem = receiveItems.find(ri => ri.id === item.id);
                  
                  return (
                    <tr key={item.id} className={remainingQuantity <= 0 ? 'bg-gray-50' : ''}>
                      <td className="px-6 py-4">
                        <div>
                          <p className="font-medium text-gray-900">{item.description}</p>
                          {item.sku && <p className="text-xs text-gray-500">SKU: {item.sku}</p>}
                          {item.productId > 0 && <p className="text-xs text-gray-500">ID: {item.productId}</p>}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-gray-900">
                        {item.quantity}
                      </td>
                      <td className="px-6 py-4 text-gray-900">
                        {item.received || 0}
                      </td>
                      <td className="px-6 py-4">
                        {remainingQuantity > 0 ? (
                          <span className="font-medium text-blue-600">{remainingQuantity}</span>
                        ) : (
                          <span className="bg-green-100 text-green-800 text-xs font-medium px-2 py-0.5 rounded">Complet</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        {remainingQuantity > 0 ? (
                          <input
                            type="number"
                            min="0"
                            max={remainingQuantity}
                            value={receiveItem?.receivedQuantity || 0}
                            onChange={(e) => handleReceiveQuantityChange(item.id, parseInt(e.target.value) || 0)}
                            className="w-20 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          />
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="mt-6">
            <p className="text-sm text-gray-600 bg-yellow-50 p-4 rounded-lg border-l-4 border-yellow-400">
              <span className="font-medium">Note:</span> Les articles réceptionnés seront ajoutés au stock WooCommerce automatiquement.
            </p>
          </div>
        </div>

        {/* Notes */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Notes de réception</h2>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={4}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            placeholder="Informations supplémentaires concernant la réception..."
          />
        </div>
      </div>
    </div>
  );
};

export default ReceiveItemsForm;