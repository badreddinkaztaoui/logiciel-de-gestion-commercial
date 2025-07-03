import React from 'react';
import { Truck, Clock, Package, Plus, Trash2, Bell } from 'lucide-react';
import { DeliverySettings as IDeliverySettings } from '../../services/settingsService';

interface DeliverySettingsProps {
  settings: IDeliverySettings;
  onUpdate: (settings: Partial<IDeliverySettings>) => void;
}

const DeliverySettings: React.FC<DeliverySettingsProps> = ({ settings, onUpdate }) => {
  const handleChange = (field: keyof IDeliverySettings, value: any) => {
    onUpdate({ [field]: value });
  };

  const addCarrier = () => {
    const newCarrier = prompt('Nom du nouveau transporteur:');
    if (newCarrier && newCarrier.trim()) {
      handleChange('availableCarriers', [...settings.availableCarriers, newCarrier.trim()]);
    }
  };

  const removeCarrier = (index: number) => {
    if (window.confirm('Supprimer ce transporteur ?')) {
      const newCarriers = settings.availableCarriers.filter((_, i) => i !== index);
      handleChange('availableCarriers', newCarriers);
      
      // Si le transporteur par défaut est supprimé, choisir le premier disponible
      if (settings.defaultCarrier === settings.availableCarriers[index] && newCarriers.length > 0) {
        handleChange('defaultCarrier', newCarriers[0]);
      }
    }
  };

  return (
    <div className="space-y-8">
      <div className="bg-green-50 border border-green-200 rounded-lg p-4">
        <div className="flex items-start space-x-3">
          <Truck className="w-5 h-5 text-green-500 mt-0.5" />
          <div>
            <h4 className="font-medium text-green-900">Configuration des livraisons</h4>
            <p className="text-sm text-green-700 mt-1">
              Définissez les paramètres par défaut pour vos bons de livraison et la gestion des transporteurs.
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
              Délai de livraison par défaut (jours)
            </label>
            <input
              type="number"
              value={settings.defaultDeliveryDays}
              onChange={(e) => handleChange('defaultDeliveryDays', parseInt(e.target.value) || 1)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              min="1"
              max="30"
            />
            <p className="text-xs text-gray-500 mt-1">
              Nombre de jours ajoutés à la date de création pour estimer la livraison
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Transporteur par défaut
            </label>
            <select
              value={settings.defaultCarrier}
              onChange={(e) => handleChange('defaultCarrier', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              {settings.availableCarriers.map((carrier, index) => (
                <option key={index} value={carrier}>{carrier}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Notes de livraison par défaut
          </label>
          <textarea
            value={settings.defaultNotes}
            onChange={(e) => handleChange('defaultNotes', e.target.value)}
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            placeholder="Instructions générales pour les livraisons..."
          />
        </div>
      </div>

      {/* Transporteurs */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-medium text-gray-900 flex items-center">
            <Package className="w-5 h-5 mr-2" />
            Transporteurs disponibles
          </h3>
          <button
            onClick={addCarrier}
            className="flex items-center space-x-2 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>Ajouter</span>
          </button>
        </div>

        <div className="space-y-3">
          {settings.availableCarriers.map((carrier, index) => (
            <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div className="flex items-center space-x-3">
                <Truck className="w-4 h-4 text-gray-600" />
                <span className="font-medium text-gray-900">{carrier}</span>
                {carrier === settings.defaultCarrier && (
                  <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full">
                    Par défaut
                  </span>
                )}
              </div>
              <button
                onClick={() => removeCarrier(index)}
                disabled={settings.availableCarriers.length === 1}
                className="p-1 text-red-600 hover:text-red-800 hover:bg-red-50 rounded disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                title="Supprimer"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>

        {settings.availableCarriers.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            <Package className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p>Aucun transporteur configuré</p>
          </div>
        )}
      </div>

      {/* Options automatiques */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-6 flex items-center">
          <Bell className="w-5 h-5 mr-2" />
          Automatisation et notifications
        </h3>

        <div className="space-y-4">
          <div className="flex items-center space-x-3">
            <input
              type="checkbox"
              id="autoMarkInTransit"
              checked={settings.autoMarkInTransit}
              onChange={(e) => handleChange('autoMarkInTransit', e.target.checked)}
              className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500"
            />
            <div>
              <label htmlFor="autoMarkInTransit" className="text-sm font-medium text-gray-700">
                Marquer automatiquement en transit
              </label>
              <p className="text-xs text-gray-500">
                Passer automatiquement au statut "En transit" après création
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <input
              type="checkbox"
              id="notifyCustomersOnShipping"
              checked={settings.notifyCustomersOnShipping}
              onChange={(e) => handleChange('notifyCustomersOnShipping', e.target.checked)}
              className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500"
            />
            <div>
              <label htmlFor="notifyCustomersOnShipping" className="text-sm font-medium text-gray-700">
                Notifier les clients lors de l'expédition
              </label>
              <p className="text-xs text-gray-500">
                Envoyer un email au client quand la livraison passe en transit
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <input
              type="checkbox"
              id="trackingEnabled"
              checked={settings.trackingEnabled}
              onChange={(e) => handleChange('trackingEnabled', e.target.checked)}
              className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500"
            />
            <div>
              <label htmlFor="trackingEnabled" className="text-sm font-medium text-gray-700">
                Activer le suivi des colis
              </label>
              <p className="text-xs text-gray-500">
                Permettre l'ajout de numéros de suivi aux bons de livraison
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Aperçu */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h4 className="font-medium text-blue-900 mb-3">Aperçu des paramètres</h4>
        <div className="text-sm text-blue-700 space-y-1">
          <p>• <strong>Délai standard :</strong> {settings.defaultDeliveryDays} jour{settings.defaultDeliveryDays > 1 ? 's' : ''}</p>
          <p>• <strong>Transporteur par défaut :</strong> {settings.defaultCarrier}</p>
          <p>• <strong>Transporteurs disponibles :</strong> {settings.availableCarriers.length}</p>
          <p>• <strong>Notifications clients :</strong> {settings.notifyCustomersOnShipping ? 'Activées' : 'Désactivées'}</p>
        </div>
      </div>
    </div>
  );
};

export default DeliverySettings;