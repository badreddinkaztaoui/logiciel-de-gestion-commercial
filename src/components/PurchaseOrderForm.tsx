import React, { useState, useEffect } from 'react';
import {
  Plus,
  Trash2,
  Save,
  ArrowLeft,
  Search,
  Package,
} from 'lucide-react';
import { PurchaseOrder, Supplier } from '../types';
import { purchaseOrderService } from '../services/purchaseOrderService';
import { supplierService } from '../services/supplierService';
import { formatCurrency } from '../utils/formatters';
import ProductSearch, { ProductWithQuantity } from './ProductSearch';
import { documentNumberingService } from '../services/documentNumberingService';

interface PurchaseOrderFormProps {
  editingOrder?: PurchaseOrder | null;
  onSave: (order: PurchaseOrder) => void;
  onCancel: () => void;
}

const PurchaseOrderForm: React.FC<PurchaseOrderFormProps> = ({
  editingOrder,
  onSave,
  onCancel
}) => {
  const [formData, setFormData] = useState<PurchaseOrder>({
    id: editingOrder?.id || crypto.randomUUID(),
    number: editingOrder?.number || '',
    date: editingOrder?.date || new Date().toISOString().split('T')[0],
    expected_delivery_date: editingOrder?.expected_delivery_date || '',
    status: editingOrder?.status || 'draft',
    supplier_id: editingOrder?.supplier_id || '',
    supplier_data: editingOrder?.supplier_data || null,
    items: editingOrder?.items || [], // Start with empty items list
    subtotal: editingOrder?.subtotal || 0,
    tax_rate: editingOrder?.tax_rate || 20,
    tax_amount: editingOrder?.tax_amount || 0,
    total: editingOrder?.total || 0,
    currency: editingOrder?.currency || 'MAD',
    notes: editingOrder?.notes || '',
    created_at: editingOrder?.created_at || new Date().toISOString(),
    updated_at: editingOrder?.updated_at || new Date().toISOString()
  });

  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [errors, setErrors] = useState<{[key: string]: string}>({});
  const [showProductSearch, setShowProductSearch] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [numberReserved, setNumberReserved] = useState(false);

  const round2 = (num: number): number => {
    return Math.round((num + Number.EPSILON) * 100) / 100;
  };

  useEffect(() => {
    return () => {
      if (formData.number && !editingOrder) {
        console.log(`Cleaning up reserved number on unmount: ${formData.number}`);
        documentNumberingService.deleteNumber(formData.number)
          .catch(error => console.error('Error releasing document number:', error));
      }
    };
  }, [formData.number, editingOrder]);

  useEffect(() => {
    const initialize = async () => {
      try {
        setIsLoading(true);

        const savedSuppliers = await supplierService.getSuppliers();
        setSuppliers(savedSuppliers);

        if (editingOrder) {
          console.log('Editing existing order:', editingOrder.number);
          setFormData(editingOrder);
          setNumberReserved(true);
        } else {
          console.log('Initializing new purchase order form...');

          const expectedDelivery = new Date();
          expectedDelivery.setDate(expectedDelivery.getDate() + 7);
          const expectedDeliveryStr = expectedDelivery.toISOString().split('T')[0];

          try {
            const orderNumber = await purchaseOrderService.getNextPurchaseOrderNumber();
            console.log('Reserved document number:', orderNumber);

            setFormData({
              id: crypto.randomUUID(),
              number: orderNumber,
              date: new Date().toISOString().split('T')[0],
              expected_delivery_date: expectedDeliveryStr,
              status: 'draft',
              supplier_id: savedSuppliers.length > 0 ? savedSuppliers[0].id : '',
              supplier_data: null,
              items: [],
              subtotal: 0,
              tax_rate: 20,
              tax_amount: 0,
              total: 0,
              currency: 'MAD',
              notes: '',
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            });
            setNumberReserved(true);
          } catch (numError) {
            console.error('Error reserving document number:', numError);
            setErrors({ general: 'Error reserving document number. Please try again.' });
            setNumberReserved(false);
          }
        }
      } catch (error) {
        console.error('Error initializing form:', error);
        setErrors({ general: 'Error initializing form. Please try again.' });
      } finally {
        setIsLoading(false);
      }
    };

    initialize();
  }, [editingOrder]);

  useEffect(() => {
    calculateTotals();
  }, [formData.items]);

  const calculateTotals = () => {
    if (!formData.items || formData.items.length === 0) return;

    console.log('Calculating purchase order totals from TTC prices:', formData.items);

    const subtotal = round2(formData.items?.reduce((sum, item) => {
      const itemTTC = item.total || 0;
      const taxRate = (item.tax_rate || 20) / 100;
      const itemHT = round2(itemTTC / (1 + taxRate));
      return sum + itemHT;
    }, 0) || 0);

    const tax_amount = round2(formData.items?.reduce((sum, item) => {
      const itemTTC = item.total || 0;
      const taxRate = (item.tax_rate || 20) / 100;
      const itemHT = round2(itemTTC / (1 + taxRate));
      const itemTax = round2(itemHT * taxRate);
      return sum + itemTax;
    }, 0) || 0);

    const total = round2(formData.items?.reduce((sum, item) => sum + (item.total || 0), 0) || 0);

    console.log('Calculated purchase order totals (TTC system):', { subtotal, tax_amount, total });

    setFormData(prev => ({
      ...prev,
      subtotal,
      tax_amount,
      total
    }));
  };

  const handleItemChange = (index: number, field: string, value: any) => {
    const newItems = [...(formData.items || [])];
    newItems[index] = {
      ...newItems[index],
      [field]: value
    };

    // Recalculate totals if quantity, unit price or tax rate changes
    if (field === 'quantity' || field === 'unit_price' || field === 'tax_rate') {
      const item = newItems[index];
      const totalHT = round2(item.unit_price * item.quantity);
      const taxAmount = round2(totalHT * (item.tax_rate / 100));
      const totalTTC = round2(totalHT + taxAmount);

      newItems[index] = {
        ...item,
        total: totalTTC,
        tax_amount: taxAmount
      };

      // Update form totals
      const formTotals = calculateTotalsFromItems(newItems);
      setFormData(prev => ({
        ...prev,
        items: newItems,
        subtotal: formTotals.subtotal,
        tax_amount: formTotals.tax_amount,
        total: formTotals.total
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        items: newItems
      }));
    }
  };

  const calculateTotalsFromItems = (items: any[]) => {
    const subtotal = round2(items.reduce((sum, item) => sum + (item.unit_price * item.quantity), 0));
    const tax_amount = round2(items.reduce((sum, item) => {
      const itemHT = item.unit_price * item.quantity;
      return sum + (itemHT * (item.tax_rate / 100));
    }, 0));
    const total = round2(subtotal + tax_amount);

    return { subtotal, tax_amount, total };
  };

  const addItem = () => {
    const newItem = {
      id: crypto.randomUUID(),
      description: '',
      quantity: 1,
      unit_price: 0,
      total: 0,
      tax_rate: 20,
      tax_amount: 0,
      received: 0
    };

    setFormData(prev => ({
      ...prev,
      items: [...(prev.items || []), newItem]
    }));
  };

  const removeItem = (index: number) => {
    const newItems = formData.items?.filter((_, i) => i !== index) || [];
    const formTotals = calculateTotalsFromItems(newItems);

    setFormData(prev => ({
      ...prev,
      items: newItems,
      subtotal: formTotals.subtotal,
      tax_amount: formTotals.tax_amount,
      total: formTotals.total
    }));
  };

  const handleProductSelect = async (product: ProductWithQuantity) => {
    console.log(`Adding product "${product.name}" to purchase order`);

    // Use the buy price (HT) from the product
    const buyPrice = product.buyPrice;
    const totalHT = round2(buyPrice * product.quantity);
    const taxRate = product.taxRate || 20;
    const taxAmount = round2(totalHT * (taxRate / 100));
    const totalTTC = round2(totalHT + taxAmount);

    console.log(`Purchase order product price: HT=${buyPrice} (buy price, tax rate: ${taxRate}%)`);

    const newItem = {
      id: crypto.randomUUID(),
      product_id: product.id.toString(),
      sku: product.sku,
      description: product.name,
      quantity: product.quantity,
      received: 0,
      unit_price: buyPrice, // This is the buy price (HT)
      total: totalTTC,
      tax_rate: taxRate,
      tax_amount: taxAmount
    };

    setFormData(prev => ({
      ...prev,
      items: [...(prev.items || []), newItem]
    }));

    console.log(`Purchase order product added - HT: ${formatCurrency(totalHT)}, Tax: ${formatCurrency(taxAmount)}, TTC: ${formatCurrency(totalTTC)}`);
  };

  const handleSupplierChange = async (supplierId: string) => {
    const supplier = suppliers.find(s => s.id === supplierId);
    setFormData(prev => ({
      ...prev,
      supplier_id: supplierId,
      supplier_data: supplier || null
    }));

    // If supplier is not TVA registered, set all tax rates to 0
    if (supplier && !supplier.tva_registered) {
      const updatedItems = formData.items?.map(item => ({
        ...item,
        tax_rate: 0,
        tax_amount: 0,
        total: round2(item.unit_price * item.quantity) // Total becomes just HT
      })) || [];

      setFormData(prev => ({
        ...prev,
        items: updatedItems,
        tax_rate: 0,
        tax_amount: 0,
        total: round2(updatedItems.reduce((sum, item) => sum + (item.total || 0), 0))
      }));
    }
  };

  const validateForm = (): boolean => {
    const newErrors: {[key: string]: string} = {};

    if (!formData.supplier_id) {
      newErrors.supplier = 'Veuillez sélectionner un fournisseur';
    }

    if (!formData.expected_delivery_date) {
      newErrors.expected_delivery_date = 'Date de livraison attendue requise';
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
        if (item.unit_price < 0) {
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
      const purchaseOrder: PurchaseOrder = {
        id: formData.id!,
        number: formData.number!,
        date: formData.date!,
        expected_delivery_date: formData.expected_delivery_date!,
        status: formData.status!,
        supplier_id: formData.supplier_id!,
        supplier_data: formData.supplier_data,
        items: formData.items!,
        subtotal: formData.subtotal!,
        tax_rate: formData.tax_rate!,
        tax_amount: formData.tax_amount!,
        total: formData.total!,
        currency: formData.currency!,
        notes: formData.notes,
        created_at: formData.created_at!,
        updated_at: new Date().toISOString()
      };

      await purchaseOrderService.savePurchaseOrder(purchaseOrder);
      onSave(purchaseOrder);
    } catch (error) {
      console.error('Error saving purchase order:', error);
      alert(`Error saving purchase order: ${(error as Error).message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    // Release the document number if this is a new order
    if (!editingOrder && formData.number) {
      documentNumberingService.deleteNumber(formData.number)
        .catch(error => console.error('Error releasing document number on cancel:', error));
    }

    onCancel();
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
              onClick={handleCancel}
              className="flex items-center space-x-2 text-gray-600 hover:text-gray-900 mb-4 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Retour aux bons de commande</span>
            </button>
            <h1 className="text-3xl font-bold text-gray-900">
              {editingOrder ? 'Modifier le bon de commande' : 'Nouveau bon de commande'}
            </h1>
            <p className="text-gray-600 mt-1">Prix d'achat HT, calculs automatiques de la TVA</p>
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
              disabled={isSubmitting || !numberReserved}
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
      <div className="flex-1 overflow-y-auto">
        <form className="max-w-5xl mx-auto p-6 space-y-6">
          {/* General Information */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-6">Informations générales</h2>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Numéro
                </label>
                <div className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-gray-700">
                  {formData.number || 'Généré automatiquement'}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Date *
                </label>
                <input
                  type="date"
                  value={formData.date}
                  onChange={(e) => setFormData(prev => ({ ...prev, date: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  required
                />
                {errors.date && <p className="text-red-500 text-sm mt-1">{errors.date}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Date de livraison prévue
                </label>
                <input
                  type="date"
                  value={formData.expected_delivery_date || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, expected_delivery_date: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>

            <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Fournisseur *
                </label>
                <select
                  value={formData.supplier_id}
                  onChange={(e) => handleSupplierChange(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  required
                >
                  <option value="">Sélectionner un fournisseur</option>
                  {suppliers.map((supplier) => (
                    <option key={supplier.id} value={supplier.id}>
                      {supplier.name} {supplier.company ? `(${supplier.company})` : ''}
                      {!supplier.tva_registered && ' - Non assujetti TVA'}
                    </option>
                  ))}
                </select>
                {errors.supplier && <p className="text-red-500 text-sm mt-1">{errors.supplier}</p>}
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
                  <option value="confirmed">Confirmé</option>
                  <option value="received">Reçu</option>
                  <option value="cancelled">Annulé</option>
                </select>
              </div>
            </div>

            {/* Add TVA status notice */}
            {formData.supplier_id && suppliers.find(s => s.id === formData.supplier_id)?.tva_registered === false && (
              <div className="mt-2 p-2 bg-yellow-50 border border-yellow-200 rounded text-sm text-yellow-800">
                Ce fournisseur n'est pas assujetti à la TVA. Les prix sont HT sans TVA.
              </div>
            )}
          </div>

          {/* Items */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-lg font-semibold text-gray-900">Articles à commander</h2>
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

            {/* Price info notice */}
            <div className="mb-4 bg-blue-50 border border-blue-200 rounded-lg p-3">
              <div className="flex items-start space-x-2">
                <Package className="w-4 h-4 text-blue-500 mt-0.5" />
                <div className="text-sm text-blue-700">
                  <strong>Prix d'achat HT:</strong> Les prix sont saisis en HT.
                  La TVA est calculée automatiquement avec une précision de 2 décimales.
                </div>
              </div>
            </div>

            {/* Items Table */}
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Description</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Quantité</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Prix unitaire HT</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">TVA</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total TTC</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {formData.items?.map((item, index) => {
                    const totalHT = round2(item.unit_price * item.quantity);
                    const taxAmount = round2(totalHT * (item.tax_rate / 100));
                    const totalTTC = round2(totalHT + taxAmount);

                    return (
                      <tr key={item.id}>
                        <td className="px-6 py-4">
                          <input
                            type="text"
                            value={item.description}
                            onChange={(e) => handleItemChange(index, 'description', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            placeholder="Description de l'article"
                          />
                          {item.sku && (
                            <p className="text-xs text-gray-500 mt-1">SKU: {item.sku}</p>
                          )}
                          {item.product_id && parseInt(item.product_id) > 0 && (
                            <p className="text-xs text-blue-600 mt-1 flex items-center">
                              <Package className="w-3 h-3 mr-1" />
                              WooCommerce ID: {item.product_id}
                            </p>
                          )}
                          {errors[`item_${index}_description`] && (
                            <p className="text-red-500 text-xs mt-1">{errors[`item_${index}_description`]}</p>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <input
                            type="number"
                            min="1"
                            value={item.quantity}
                            onChange={(e) => handleItemChange(index, 'quantity', parseInt(e.target.value) || 0)}
                            className="w-20 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          />
                          {errors[`item_${index}_quantity`] && (
                            <p className="text-red-500 text-xs mt-1">{errors[`item_${index}_quantity`]}</p>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center space-x-1">
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              value={item.unit_price}
                              onChange={(e) => handleItemChange(index, 'unit_price', parseFloat(e.target.value) || 0)}
                              className="w-24 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            />
                            <span className="text-gray-500">{formData.currency}</span>
                          </div>
                          {errors[`item_${index}_unit_price`] && (
                            <p className="text-red-500 text-xs mt-1">{errors[`item_${index}_unit_price`]}</p>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center space-x-1">
                            <input
                              type="number"
                              step="1"
                              min="0"
                              max="100"
                              value={item.tax_rate}
                              onChange={(e) => handleItemChange(index, 'tax_rate', parseFloat(e.target.value) || 0)}
                              className="w-20 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            />
                            <span className="text-gray-500">%</span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm">
                            <p className="font-medium">{formatCurrency(totalTTC)} {formData.currency}</p>
                            <p className="text-gray-500 text-xs">
                              HT: {formatCurrency(totalHT)} | TVA: {formatCurrency(taxAmount)}
                            </p>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <button
                            type="button"
                            onClick={() => removeItem(index)}
                            className="text-red-600 hover:text-red-900 p-1 hover:bg-red-50 rounded"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {formData.items?.length === 0 && (
              <div className="text-center py-12">
                <Package className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">Aucun article</h3>
                <p className="text-gray-500 mb-4">
                  Ajoutez des articles à commander en utilisant les boutons ci-dessus
                </p>
              </div>
            )}

            {/* Totals */}
            <div className="mt-6 flex justify-end">
              <div className="w-64 space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Total HT:</span>
                  <span className="font-medium">{formatCurrency(formData.subtotal)} {formData.currency}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">TVA ({formData.tax_rate}%):</span>
                  <span className="font-medium">{formatCurrency(formData.tax_amount)} {formData.currency}</span>
                </div>
                <div className="flex justify-between text-base font-bold border-t border-gray-200 pt-3">
                  <span>Total TTC:</span>
                  <span>{formatCurrency(formData.total)} {formData.currency}</span>
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
              placeholder="Notes additionnelles pour le fournisseur..."
            />
          </div>
        </form>
      </div>

      {/* Product Search Modal */}
      {showProductSearch && (
        <ProductSearch
          onSelect={handleProductSelect}
          onClose={() => setShowProductSearch(false)}
        />
      )}
    </div>
  );
};

export default PurchaseOrderForm;