import React from 'react';
import { ArrowLeft, Save, RefreshCw } from 'lucide-react';
import { WooCommerceOrder } from '../../types/index';

interface InvoiceHeaderProps {
  id?: string;
  isSubmitting: boolean;
  sourceOrder?: WooCommerceOrder;
  onCancel: () => void;
  onSubmit: (e: React.FormEvent) => void;
}

const InvoiceHeader: React.FC<InvoiceHeaderProps> = ({
  id,
  isSubmitting,
  sourceOrder,
  onCancel,
  onSubmit
}) => {
  return (
    <div className="mb-8">
      <div className="flex items-center justify-between">
        <div>
          <button
            onClick={onCancel}
            className="flex items-center space-x-2 text-gray-600 hover:text-gray-900 mb-4 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Retour aux factures</span>
          </button>
          <h1 className="text-3xl font-bold text-gray-900">
            {id ? 'Modifier la facture' : 'Nouvelle facture'}
          </h1>
          {sourceOrder && (
            <div className="mt-2">
              <p className="text-gray-600">
                À partir de la commande #{sourceOrder.number || sourceOrder.id}
              </p>
              <div className="flex items-center space-x-4 mt-1">
                <p className="text-sm text-green-600 flex items-center">
                  <RefreshCw className="w-4 h-4 mr-1" />
                  ✅ Prix actuels récupérés depuis les produits WooCommerce
                </p>
                <p className="text-sm text-blue-600">
                  🎯 Taux TVA détectés automatiquement
                </p>
                {sourceOrder.total_tax && (
                  <p className="text-sm text-green-600">
                    💰 TVA commande: {new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(parseFloat(sourceOrder.total_tax))}
                  </p>
                )}
              </div>
            </div>
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
            onClick={onSubmit}
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
  );
};

export default InvoiceHeader;