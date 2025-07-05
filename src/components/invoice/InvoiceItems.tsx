import React from 'react';
import { Plus, Search, Package, RefreshCw, CheckCircle, Trash2 } from 'lucide-react';
import { formatCurrency } from '../../utils/formatters';
import { WooCommerceOrder } from '../../types/index';

interface InvoiceItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
  taxRate: number;
  taxAmount: number;
  productId?: number;
  sku?: string;
}

interface InvoiceItemsProps {
  items: InvoiceItem[];
  sourceOrder?: WooCommerceOrder;
  onItemChange: (index: number, field: string, value: any) => void;
  onAddItem: () => void;
  onRemoveItem: (index: number) => void;
  onShowProductSearch: () => void;
  errors: { [key: string]: string };
}

const round2 = (num: number): number => {
  return Math.round((num + Number.EPSILON) * 100) / 100;
};

const InvoiceItems: React.FC<InvoiceItemsProps> = ({
  items,
  sourceOrder,
  onItemChange,
  onAddItem,
  onRemoveItem,
  onShowProductSearch,
  errors
}) => {
  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-lg font-semibold text-gray-900">Articles</h2>
        <div className="flex space-x-3">
          <button
            type="button"
            onClick={onShowProductSearch}
            className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
          >
            <Search className="w-4 h-4" />
            <span>Produit WooCommerce</span>
          </button>
          <button
            type="button"
            onClick={onAddItem}
            className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>Ajouter article</span>
          </button>
        </div>
      </div>

      {/* Success notice when imported from order */}
      {sourceOrder && (
        <div className="mb-4 bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="flex items-start space-x-3">
            <CheckCircle className="w-5 h-5 text-green-500 mt-0.5" />
            <div className="text-sm text-green-700">
              <div className="font-bold mb-2">🎉 Facture créée avec les prix actuels WooCommerce #{sourceOrder.number}</div>
              <div className="space-y-1">
                <p>✅ Prix unitaires TTC récupérés directement depuis les produits WooCommerce</p>
                <p>✅ Taux de TVA détectés automatiquement depuis les classes de taxe</p>
                <p>✅ Totaux HT et TTC calculés avec précision</p>
                <p>✅ Prix mis à jour (non plus les anciens prix de la commande)</p>
                <p className="font-medium text-green-800">
                  📦 {items.length} article(s) importé(s) - Total: {formatCurrency(items.reduce((sum, item) => sum + item.total, 0))} TTC
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-96">
                Description
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider w-32">
                Quantité
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider w-40">
                Prix unitaire TTC
                {sourceOrder && <div className="text-xs text-green-600 font-normal">(Prix actuel WooCommerce)</div>}
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider w-40">
                Total TTC
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider w-32">
                Taux TVA
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider w-24">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {items.map((item, index) => (
              <tr key={item.id} className={sourceOrder ? 'bg-green-50/30' : ''}>
                <td className="px-6 py-4 w-96">
                  <input
                    type="text"
                    value={item.description}
                    onChange={(e) => onItemChange(index, 'description', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Description de l'article"
                  />
                  {item.sku && (
                    <p className="text-xs text-gray-500 mt-1">SKU: {item.sku}</p>
                  )}
                  {item.productId && (
                    <p className="text-xs text-green-600 mt-1 flex items-center">
                      <Package className="w-3 h-3 mr-1" />
                      WooCommerce #{item.productId}
                    </p>
                  )}
                  {sourceOrder && (
                    <p className="text-xs text-green-600 mt-1 flex items-center">
                      <RefreshCw className="w-3 h-3 mr-1" />
                      Prix actuel récupéré
                    </p>
                  )}
                  {errors[`item_${index}_description`] && (
                    <p className="text-red-500 text-xs mt-1">{errors[`item_${index}_description`]}</p>
                  )}
                </td>
                <td className="px-6 py-4 text-right w-32">
                  <input
                    type="number"
                    value={item.quantity}
                    onChange={(e) => onItemChange(index, 'quantity', parseInt(e.target.value) || 0)}
                    className="w-20 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    min="1"
                  />
                  {errors[`item_${index}_quantity`] && (
                    <p className="text-red-500 text-xs mt-1">{errors[`item_${index}_quantity`]}</p>
                  )}
                </td>
                <td className="px-6 py-4 text-right w-40">
                  <input
                    type="number"
                    value={item.unitPrice.toFixed(2)}
                    onChange={(e) => onItemChange(index, 'unitPrice', parseFloat(e.target.value) || 0)}
                    className={`w-32 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                      sourceOrder ? 'bg-green-50 border-green-300' : 'border-gray-300'
                    }`}
                    min="0"
                    step="0.01"
                  />
                  <p className="text-xs text-blue-600 mt-1 font-medium">TTC</p>
                  {sourceOrder && (
                    <p className="text-xs text-green-500 mt-1 flex items-center">
                      <RefreshCw className="w-3 h-3 mr-1" />
                      ✓ Prix actuel
                    </p>
                  )}
                  {errors[`item_${index}_price`] && (
                    <p className="text-red-500 text-xs mt-1">{errors[`item_${index}_price`]}</p>
                  )}
                </td>
                <td className="px-6 py-4 text-right w-40">
                  <div className="text-blue-600 font-bold">{formatCurrency(item.total)}</div>
                  <div className="text-xs text-gray-500">
                    HT: {formatCurrency(round2(item.total / (1 + (item.taxRate || 0) / 100)))}
                  </div>
                </td>
                <td className="px-6 py-4 text-right w-32">
                  <div className="flex flex-col items-end space-y-1">
                    <select
                      value={item.taxRate ?? 20}
                      onChange={(e) => onItemChange(index, 'taxRate', parseFloat(e.target.value))}
                      className="w-20 px-2 py-1 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value={0}>0%</option>
                      <option value={7}>7%</option>
                      <option value={10}>10%</option>
                      <option value={20}>20%</option>
                    </select>
                    {sourceOrder && item.productId && (
                      <div className="text-xs text-green-600 flex items-center">
                        <CheckCircle className="w-3 h-3 mr-1" />
                        Auto-détecté
                      </div>
                    )}
                  </div>
                </td>
                <td className="px-6 py-4 text-right w-24">
                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={() => onRemoveItem(index)}
                      className="text-red-600 hover:text-red-800 p-2 hover:bg-red-50 rounded-lg transition-colors"
                      disabled={items.length === 1}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {errors.items && <p className="text-red-500 text-sm mt-2">{errors.items}</p>}
    </div>
  );
};

export default InvoiceItems;