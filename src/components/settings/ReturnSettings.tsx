import React from 'react';
import { RotateCcw, Clock, CheckCircle, AlertTriangle, Plus, Trash2 } from 'lucide-react';
import { ReturnSettings as IReturnSettings } from '../../services/settingsService';

interface ReturnSettingsProps {
  settings: IReturnSettings;
  onUpdate: (settings: Partial<IReturnSettings>) => void;
}

const ReturnSettings: React.FC<ReturnSettingsProps> = ({ settings, onUpdate }) => {
  const handleChange = (field: keyof IReturnSettings, value: any) => {
    onUpdate({ [field]: value });
  };

  const addReturnReason = () => {
    const newReason = prompt('Nouvelle raison de retour:');
    if (newReason && newReason.trim()) {
      handleChange('defaultReturnReasons', [...settings.defaultReturnReasons, newReason.trim()]);
    }
  };

  const removeReturnReason = (index: number) => {
    if (window.confirm('Supprimer cette raison de retour ?')) {
      const newReasons = settings.defaultReturnReasons.filter((_, i) => i !== index);
      handleChange('defaultReturnReasons', newReasons);
    }
  };

  const stockPolicies = [
    { value: 'immediate', label: 'Immédiat', description: 'Remettre en stock dès la création du bon de retour' },
    { value: 'after_approval', label: 'Après approbation', description: 'Remettre en stock uniquement après approbation' },
    { value: 'manual', label: 'Manuel', description: 'Gestion manuelle du stock pour chaque retour' }
  ];

  const refundPolicies = [
    { value: 'full', label: 'Intégral', description: 'Remboursement complet automatique' },
    { value: 'condition_based', label: 'Selon l\'état', description: 'Montant basé sur l\'état du produit retourné' },
    { value: 'manual', label: 'Manuel', description: 'Validation manuelle de chaque remboursement' }
  ];

  return (
    <div className="space-y-8">
      <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
        <div className="flex items-start space-x-3">
          <RotateCcw className="w-5 h-5 text-orange-500 mt-0.5" />
          <div>
            <h4 className="font-medium text-orange-900">Politique de retours</h4>
            <p className="text-sm text-orange-700 mt-1">
              Configurez les règles de gestion des retours, remboursements et mise à jour du stock.
            </p>
          </div>
        </div>
      </div>

      {/* Paramètres généraux */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-6 flex items-center">
          <Clock className="w-5 h-5 mr-2" />
          Paramètres généraux
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Période de retour (jours)
            </label>
            <input
              type="number"
              value={settings.returnPeriodDays}
              onChange={(e) => handleChange('returnPeriodDays', parseInt(e.target.value) || 1)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              min="1"
              max="365"
            />
            <p className="text-xs text-gray-500 mt-1">
              Nombre de jours pendant lesquels les retours sont acceptés
            </p>
          </div>
          <div className="flex items-center space-x-3">
            <input
              type="checkbox"
              id="autoApproveReturns"
              checked={settings.autoApproveReturns}
              onChange={(e) => handleChange('autoApproveReturns', e.target.checked)}
              className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500"
            />
            <div>
              <label htmlFor="autoApproveReturns" className="text-sm font-medium text-gray-700">
                Approbation automatique
              </label>
              <p className="text-xs text-gray-500">
                Approuver automatiquement tous les bons de retour
              </p>
            </div>
          </div>
        </div>

        <div className="mt-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Notes par défaut pour les retours
          </label>
          <textarea
            value={settings.defaultNotes}
            onChange={(e) => handleChange('defaultNotes', e.target.value)}
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            placeholder="Instructions pour les retours de produits..."
          />
        </div>
      </div>

      {/* Politiques de stock */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-6 flex items-center">
          <CheckCircle className="w-5 h-5 mr-2" />
          Gestion du stock
        </h3>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Politique de mise à jour du stock
            </label>
            <div className="space-y-3">
              {stockPolicies.map((policy) => (
                <div key={policy.value} className="flex items-start space-x-3">
                  <input
                    type="radio"
                    id={`stock-${policy.value}`}
                    name="stockUpdatePolicy"
                    value={policy.value}
                    checked={settings.stockUpdatePolicy === policy.value}
                    onChange={(e) => handleChange('stockUpdatePolicy', e.target.value as any)}
                    className="mt-1 w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 focus:ring-blue-500"
                  />
                  <div>
                    <label htmlFor={`stock-${policy.value}`} className="text-sm font-medium text-gray-700">
                      {policy.label}
                    </label>
                    <p className="text-xs text-gray-500">{policy.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Politiques de remboursement */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-6 flex items-center">
          <AlertTriangle className="w-5 h-5 mr-2" />
          Politique de remboursement
        </h3>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Type de remboursement
            </label>
            <div className="space-y-3">
              {refundPolicies.map((policy) => (
                <div key={policy.value} className="flex items-start space-x-3">
                  <input
                    type="radio"
                    id={`refund-${policy.value}`}
                    name="refundPolicy"
                    value={policy.value}
                    checked={settings.refundPolicy === policy.value}
                    onChange={(e) => handleChange('refundPolicy', e.target.value as any)}
                    className="mt-1 w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 focus:ring-blue-500"
                  />
                  <div>
                    <label htmlFor={`refund-${policy.value}`} className="text-sm font-medium text-gray-700">
                      {policy.label}
                    </label>
                    <p className="text-xs text-gray-500">{policy.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {settings.refundPolicy === 'condition_based' && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h4 className="font-medium text-blue-900 mb-2">Barème de remboursement selon l'état</h4>
              <div className="text-sm text-blue-700 space-y-1">
                <p>• <strong>Neuf :</strong> 100% du prix d'achat</p>
                <p>• <strong>Utilisé :</strong> 80% du prix d'achat</p>
                <p>• <strong>Endommagé :</strong> 50% du prix d'achat</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Raisons de retour */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-medium text-gray-900">Raisons de retour prédéfinies</h3>
          <button
            onClick={addReturnReason}
            className="flex items-center space-x-2 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>Ajouter</span>
          </button>
        </div>

        <div className="space-y-2">
          {settings.defaultReturnReasons.map((reason, index) => (
            <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <span className="text-sm text-gray-900">{reason}</span>
              <button
                onClick={() => removeReturnReason(index)}
                disabled={settings.defaultReturnReasons.length === 1}
                className="p-1 text-red-600 hover:text-red-800 hover:bg-red-50 rounded disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                title="Supprimer"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>

        {settings.defaultReturnReasons.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            <RotateCcw className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p>Aucune raison de retour configurée</p>
          </div>
        )}
      </div>

      {/* Notifications */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-6">Notifications</h3>

        <div className="flex items-center space-x-3">
          <input
            type="checkbox"
            id="notifyCustomersOnReturn"
            checked={settings.notifyCustomersOnReturn}
            onChange={(e) => handleChange('notifyCustomersOnReturn', e.target.checked)}
            className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500"
          />
          <div>
            <label htmlFor="notifyCustomersOnReturn" className="text-sm font-medium text-gray-700">
              Notifier les clients des changements de statut
            </label>
            <p className="text-xs text-gray-500">
              Envoyer un email lors de l'approbation, rejet ou traitement du retour
            </p>
          </div>
        </div>
      </div>

      {/* Résumé de la configuration */}
      <div className="bg-green-50 border border-green-200 rounded-lg p-4">
        <h4 className="font-medium text-green-900 mb-3">Résumé de la configuration</h4>
        <div className="text-sm text-green-700 space-y-1">
          <p>• <strong>Période de retour :</strong> {settings.returnPeriodDays} jour{settings.returnPeriodDays > 1 ? 's' : ''}</p>
          <p>• <strong>Approbation :</strong> {settings.autoApproveReturns ? 'Automatique' : 'Manuelle'}</p>
          <p>• <strong>Stock :</strong> Mise à jour {stockPolicies.find(p => p.value === settings.stockUpdatePolicy)?.label.toLowerCase()}</p>
          <p>• <strong>Remboursement :</strong> {refundPolicies.find(p => p.value === settings.refundPolicy)?.label}</p>
          <p>• <strong>Raisons prédéfinies :</strong> {settings.defaultReturnReasons.length}</p>
        </div>
      </div>
    </div>
  );
};

export default ReturnSettings;