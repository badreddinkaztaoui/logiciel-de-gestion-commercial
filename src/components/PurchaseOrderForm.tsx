import React, { useState, useEffect } from 'react';
import {
  Plus,
  Trash2,
  Save,
  ArrowLeft,
  Search,
  Percent,
  Package,
  AlertCircle
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
  const [formData, setFormData] = useState<Partial<PurchaseOrder>>({
    id: '',
    number: '',
    date: new Date().toISOString().split('T')[0],
    expected_delivery_date: '',
    status: 'draft',
    supplier_id: '',
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
              items: [{
                id: crypto.randomUUID(),
                product_id: '0',
                description: '',
                quantity: 1,
                received: 0,
                unit_price: 0,
                total: 0,
                tax_rate: 20,
                tax_amount: 0
              }],
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
    console.log(`Changing purchase order item ${index}, field ${field}, value:`, value);

    const newItems = [...(formData.items || [])];
    newItems[index] = {
      ...newItems[index],
      [field]: value
    };

    if (field === 'quantity' || field === 'unit_price') {
      const newTotalTTC = round2(newItems[index].quantity * newItems[index].unit_price);
      newItems[index].total = newTotalTTC;

      const taxRate = (newItems[index].tax_rate || 20) / 100;
      const totalHT = round2(newTotalTTC / (1 + taxRate));
      newItems[index].tax_amount = round2(totalHT * taxRate);

      console.log(`Purchase order item total TTC: ${newTotalTTC}, HT: ${totalHT}, tax: ${newItems[index].tax_amount}`);
    }

    if (field === 'tax_rate') {
      const totalTTC = newItems[index].total;
      const taxRate = parseFloat(value) / 100;
      const totalHT = round2(totalTTC / (1 + taxRate));
      newItems[index].tax_amount = round2(totalHT * taxRate);
      console.log(`Tax rate changed to ${value}% for purchase order item "${newItems[index].description}", TTC stays ${totalTTC}`);
    }

    setFormData(prev => ({
      ...prev,
      items: newItems
    }));
  };

  const addItem = () => {
    console.log('Adding new purchase order item');

    setFormData(prev => ({
      ...prev,
      items: [
        ...(prev.items || []),
        {
          id: crypto.randomUUID(),
          product_id: '0',
          description: '',
          quantity: 1,
          received: 0,
          unit_price: 0,
          total: 0,
          tax_rate: 20,
          tax_amount: 0
        }
      ]
    }));
  };

  const removeItem = (index: number) => {
    console.log('Removing purchase order item at index:', index);

    setFormData(prev => ({
      ...prev,
      items: prev.items?.filter((_, i) => i !== index) || []
    }));
  };

  const handleProductSelect = async (product: ProductWithQuantity) => {
    console.log(`Adding product "${product.name}" to purchase order with tax rate 20% (TTC pricing)`);

    const priceTTC = round2(parseFloat(product.price));
    const totalTTC = round2(priceTTC * product.quantity);

    const taxRate = 20; // Default tax rate
    const totalHT = round2(totalTTC / (1 + taxRate / 100));
    const taxAmount = round2(totalHT * (taxRate / 100));

    console.log(`Purchase order product price: TTC=${priceTTC} (keeping TTC price, tax rate: ${taxRate}%)`);

    const newItem = {
      id: crypto.randomUUID(),
      product_id: product.id.toString(),
      sku: product.sku,
      description: product.name,
      quantity: product.quantity,
      received: 0,
      unit_price: priceTTC,
      total: totalTTC,
      tax_rate: taxRate,
      tax_amount: taxAmount
    };

    setFormData(prev => ({
      ...prev,
      items: [...(prev.items || []), newItem]
    }));

    console.log(`Purchase order product added - TTC: ${formatCurrency(totalTTC)}, HT: ${formatCurrency(totalHT)}, Tax: ${formatCurrency(taxAmount)}`);
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

  const getTaxBreakdown = () => {
    const taxBreakdown = new Map<number, number>();

    formData.items?.forEach(item => {
      const taxRate = item.tax_rate || 20;
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
      .filter(([_, amount]) => amount > 0)
      .sort(([rateA], [rateB]) => rateA - rateB);
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
            <p className="text-gray-600 mt-1">Prix TTC (comme WooCommerce), calculs automatiques</p>
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
      <div className="flex-1 overflow-auto p-6">
        <form onSubmit={handleSubmit} className="max-w-6xl mx-auto space-y-6">
          {errors.general && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start space-x-3">
              <AlertCircle className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-red-800">{errors.general}</p>
              </div>
            </div>
          )}

          {/* Order Header */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-6">Informations générales</h2>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Numéro de bon de commande
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={formData.number || 'Génération...'}
                    className="w-full px-3 py-2 border border-gray-300 bg-gray-50 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 cursor-not-allowed"
                    required
                    readOnly
                  />
                  <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                    <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">Auto</span>
                  </div>
                </div>
                {!numberReserved && (
                  <p className="text-xs text-orange-500 mt-1">Réservation du numéro en cours...</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Date de commande
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
                  Livraison attendue
                </label>
                <input
                  type="date"
                  value={formData.expected_delivery_date}
                  onChange={(e) => setFormData(prev => ({ ...prev, expected_delivery_date: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  required
                />
                {errors.expected_delivery_date && <p className="text-red-500 text-sm mt-1">{errors.expected_delivery_date}</p>}
              </div>
            </div>

            <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Fournisseur *
                </label>
                <select
                  value={formData.supplier_id}
                  onChange={(e) => setFormData(prev => ({ ...prev, supplier_id: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  required
                >
                  <option value="">Sélectionner un fournisseur</option>
                  {suppliers.map((supplier) => (
                    <option key={supplier.id} value={supplier.id}>
                      {supplier.name}
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
                  <strong>Prix TTC:</strong> Les prix sont saisis en TTC (comme WooCommerce).
                  Le sous-total HT et la TVA sont calculés automatiquement avec une précision de 2 décimales.
                </div>
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
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">TVA</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {formData.items?.map((item, index) => {
                    const totalTTC = item.total || 0;
                    const taxRate100 = (item.tax_rate || 20) / 100;
                    const totalHT = round2(totalTTC / (1 + taxRate100));
                    const itemTaxAmount = round2(totalHT * taxRate100);

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
                            value={item.unit_price.toFixed(2)}
                            onChange={(e) => handleItemChange(index, 'unit_price', parseFloat(e.target.value) || 0)}
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
                          <div>
                            <div className="text-blue-600 font-bold">{formatCurrency(totalTTC)}</div>
                            <div className="text-xs text-gray-500">HT: {formatCurrency(totalHT)}</div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <select
                            value={item.tax_rate ?? 20}
                            onChange={(e) => handleItemChange(index, 'tax_rate', parseFloat(e.target.value))}
                            className="w-20 px-2 py-1 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          >
                            <option value={0}>0%</option>
                            <option value={7}>7%</option>
                            <option value={10}>10%</option>
                            <option value={20}>20%</option>
                          </select>
                        </td>
                        <td className="px-6 py-4 font-medium text-blue-600">
                          {formatCurrency(itemTaxAmount)}
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
                    );
                  })}
                </tbody>
              </table>
            </div>

            {errors.items && <p className="text-red-500 text-sm mt-2">{errors.items}</p>}
          </div>

          {/* Totals with Tax Breakdown */}
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

                <div className="flex justify-between text-sm border-t pt-2">
                  <span className="text-gray-600">Total TVA:</span>
                  <span className="font-medium text-blue-600">{formatCurrency(formData.tax_amount || 0)}</span>
                </div>

                <div className="flex justify-between text-lg font-bold border-t pt-4">
                  <span>Total TTC:</span>
                  <span className="text-blue-600">{formatCurrency(formData.total || 0)}</span>
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