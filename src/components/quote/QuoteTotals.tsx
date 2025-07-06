import React from 'react';
import { Percent, RefreshCw } from 'lucide-react';
import { formatCurrency } from '../../utils/formatters';
import { WooCommerceOrder } from '../../types/index';

interface ExtendedQuoteItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
  unitPriceHT?: number;
  totalHT?: number;
  taxRate?: number;
  taxAmount?: number;
  productId?: number;
  sku?: string;
}

interface QuoteTotalsProps {
  subtotal: number;
  tax: number;
  total: number;
  items: ExtendedQuoteItem[];
  sourceOrder?: WooCommerceOrder;
}

const round2 = (num: number): number => {
  return Math.round((num + Number.EPSILON) * 100) / 100;
};

const QuoteTotals: React.FC<QuoteTotalsProps> = ({
  subtotal,
  total,
  items,
  sourceOrder
}) => {
  const getTaxBreakdown = () => {
    const taxBreakdown = new Map<number, number>();

    items.forEach(item => {
      const taxRate = item.taxRate || 0;
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

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <div className="flex justify-end">
        <div className="w-full max-w-md space-y-4">
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Sous-total HT:</span>
            <span className="font-medium">{formatCurrency(subtotal)}</span>
          </div>

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
            <span className="text-blue-600">{formatCurrency(total)}</span>
          </div>

          {sourceOrder && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-3 mt-4">
              <p className="text-xs text-green-700 font-medium mb-1 flex items-center">
                <RefreshCw className="w-3 h-3 mr-1" />
                ✅ Totaux calculés avec les prix actuels WooCommerce
              </p>
              <p className="text-xs text-green-600">
                Commande #{sourceOrder.number || sourceOrder.id} - Total commande: {formatCurrency(parseFloat(sourceOrder.total || '0'))}
              </p>
              <p className="text-xs text-green-600">
                Total devis (prix actuels): {formatCurrency(total)}
              </p>
              {(() => {
                const difference = Math.abs(parseFloat(sourceOrder.total || '0') - total);
                if (difference < 0.01) {
                  return (
                    <p className="text-xs text-green-800 font-bold mt-1">
                      🎯 Aucune différence de prix !
                    </p>
                  );
                } else {
                  return (
                    <p className="text-xs text-orange-700 font-bold mt-1">
                      📈 Différence: {formatCurrency(difference)} (prix mis à jour)
                    </p>
                  );
                }
              })()}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default QuoteTotals;