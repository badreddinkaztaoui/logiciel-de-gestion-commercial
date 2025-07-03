import React, { useState } from 'react';
import { Globe, Settings as SettingsIcon, CheckCircle, AlertCircle, Zap } from 'lucide-react';
import { WooCommerceSettings as IWooCommerceSettings } from '../../services/settingsService';
import { wooCommerceService } from '../../services/woocommerce';

interface WooCommerceSettingsProps {
  settings: IWooCommerceSettings;
  onUpdate: (settings: Partial<IWooCommerceSettings>) => void;
}

const WooCommerceSettings: React.FC<WooCommerceSettingsProps> = ({ settings, onUpdate }) => {
  const [testingConnection, setTestingConnection] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'success' | 'error'>('idle');

  const handleChange = (field: keyof IWooCommerceSettings, value: any) => {
    onUpdate({ [field]: value });
  };

  const testConnection = async () => {
    setTestingConnection(true);
    setConnectionStatus('idle');

    try {
      // Test the connection using the wooCommerceService
      await wooCommerceService.fetchTaxClasses();
      setConnectionStatus('success');
    } catch (error) {
      console.error('Connection test failed:', error);
      setConnectionStatus('error');
    } finally {
      setTestingConnection(false);
    }
  };

  return (
    <div className="space-y-8">
      <div className="bg-green-50 border border-green-200 rounded-lg p-4">
        <div className="flex items-start space-x-3">
          <Globe className="w-5 h-5 text-green-500 mt-0.5" />
          <div>
            <h4 className="font-medium text-green-900">Intégration WooCommerce</h4>
            <p className="text-sm text-green-700 mt-1">
              Connectez votre boutique WooCommerce pour synchroniser automatiquement les commandes et gérer le stock.
            </p>
          </div>
        </div>
      </div>

      {/* Configuration API */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-6 flex items-center">
          <Globe className="w-5 h-5 mr-2" />
          Configuration API
        </h3>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <p className="text-sm text-blue-700">
            Les identifiants de connexion WooCommerce sont configurés via les variables d'environnement de l'application.
            Si vous avez besoin de les modifier, veuillez contacter votre administrateur système.
          </p>
        </div>

        {/* Test de connexion */}
        <div className="bg-gray-50 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-medium text-gray-900">Test de connexion</h4>
              <p className="text-sm text-gray-600 mt-1">
                Vérifiez que les paramètres de connexion sont corrects
              </p>
            </div>
            <button
              onClick={testConnection}
              disabled={testingConnection}
              className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {testingConnection ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span>Test en cours...</span>
                </>
              ) : (
                <>
                  <Zap className="w-4 h-4" />
                  <span>Tester</span>
                </>
              )}
            </button>
          </div>

          {/* Résultat du test */}
          {connectionStatus !== 'idle' && (
            <div className={`mt-4 p-3 rounded-lg flex items-center space-x-2 ${
              connectionStatus === 'success'
                ? 'bg-green-100 text-green-800'
                : 'bg-red-100 text-red-800'
            }`}>
              {connectionStatus === 'success' ? (
                <CheckCircle className="w-4 h-4" />
              ) : (
                <AlertCircle className="w-4 h-4" />
              )}
              <span className="text-sm font-medium">
                {connectionStatus === 'success'
                  ? 'Connexion réussie ! L\'API WooCommerce est accessible.'
                  : 'Échec de la connexion. Vérifiez les variables d\'environnement de l\'application.'
                }
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Options de synchronisation */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-6 flex items-center">
          <SettingsIcon className="w-5 h-5 mr-2" />
          Synchronisation automatique
        </h3>

        <div className="space-y-6">
          <div className="flex items-center space-x-3">
            <input
              type="checkbox"
              id="autoSync"
              checked={settings.autoSync}
              onChange={(e) => handleChange('autoSync', e.target.checked)}
              className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500"
            />
            <label htmlFor="autoSync" className="text-sm font-medium text-gray-700">
              Activer la synchronisation automatique
            </label>
          </div>

          {settings.autoSync && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Intervalle de synchronisation (minutes)
              </label>
              <select
                value={settings.syncInterval}
                onChange={(e) => handleChange('syncInterval', parseInt(e.target.value))}
                className="w-full max-w-xs px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value={1}>1 minute</option>
                <option value={2}>2 minutes</option>
                <option value={5}>5 minutes</option>
                <option value={10}>10 minutes</option>
                <option value={15}>15 minutes</option>
                <option value={30}>30 minutes</option>
                <option value={60}>1 heure</option>
              </select>
              <p className="text-xs text-gray-500 mt-1">
                Fréquence de vérification des nouvelles commandes
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Options avancées */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-6">Options avancées</h3>

        <div className="space-y-4">
          <div className="flex items-center space-x-3">
            <input
              type="checkbox"
              id="updateOrderStatus"
              checked={settings.updateOrderStatus}
              onChange={(e) => handleChange('updateOrderStatus', e.target.checked)}
              className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500"
            />
            <div>
              <label htmlFor="updateOrderStatus" className="text-sm font-medium text-gray-700">
                Mettre à jour le statut des commandes WooCommerce
              </label>
              <p className="text-xs text-gray-500">
                Marquer automatiquement les commandes comme terminées lors de la livraison
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <input
              type="checkbox"
              id="notifyCustomers"
              checked={settings.notifyCustomers}
              onChange={(e) => handleChange('notifyCustomers', e.target.checked)}
              className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500"
            />
            <div>
              <label htmlFor="notifyCustomers" className="text-sm font-medium text-gray-700">
                Notifier les clients
              </label>
              <p className="text-xs text-gray-500">
                Envoyer des notifications aux clients lors des mises à jour de commande
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <input
              type="checkbox"
              id="stockManagement"
              checked={settings.stockManagement}
              onChange={(e) => handleChange('stockManagement', e.target.checked)}
              className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500"
            />
            <div>
              <label htmlFor="stockManagement" className="text-sm font-medium text-gray-700">
                Gestion du stock
              </label>
              <p className="text-xs text-gray-500">
                Mettre à jour automatiquement le stock WooCommerce
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WooCommerceSettings;