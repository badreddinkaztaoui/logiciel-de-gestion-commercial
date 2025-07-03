import React, { useState } from 'react';
import { Globe, Key, Settings as SettingsIcon, Eye, EyeOff, CheckCircle, AlertCircle, Zap } from 'lucide-react';
import { WooCommerceSettings as IWooCommerceSettings } from '../../services/settingsService';

interface WooCommerceSettingsProps {
  settings: IWooCommerceSettings;
  onUpdate: (settings: Partial<IWooCommerceSettings>) => void;
}

const WooCommerceSettings: React.FC<WooCommerceSettingsProps> = ({ settings, onUpdate }) => {
  const [showSecret, setShowSecret] = useState(false);
  const [testingConnection, setTestingConnection] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'success' | 'error'>('idle');

  const handleChange = (field: keyof IWooCommerceSettings, value: any) => {
    onUpdate({ [field]: value });
  };

  const testConnection = async () => {
    setTestingConnection(true);
    setConnectionStatus('idle');

    try {
      // Simuler un test de connexion
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Ici, vous pouvez ajouter la logique de test réel
      setConnectionStatus('success');
    } catch (error) {
      setConnectionStatus('error');
    } finally {
      setTestingConnection(false);
    }
  };

  const maskedSecret = settings.consumerSecret ? 
    settings.consumerSecret.substring(0, 8) + '•'.repeat(Math.max(0, settings.consumerSecret.length - 8)) : '';

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
          <Key className="w-5 h-5 mr-2" />
          Configuration API
        </h3>

        <div className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              URL de l'API WooCommerce *
            </label>
            <input
              type="url"
              value={settings.apiUrl}
              onChange={(e) => handleChange('apiUrl', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="https://votre-site.com/wp-json/wc/v3"
            />
            <p className="text-xs text-gray-500 mt-1">
              L'URL de base de votre API WooCommerce (généralement se termine par /wp-json/wc/v3)
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Consumer Key *
            </label>
            <input
              type="text"
              value={settings.consumerKey}
              onChange={(e) => handleChange('consumerKey', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="ck_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Consumer Secret *
            </label>
            <div className="relative">
              <input
                type={showSecret ? "text" : "password"}
                value={settings.consumerSecret}
                onChange={(e) => handleChange('consumerSecret', e.target.value)}
                className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="cs_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
              />
              <button
                type="button"
                onClick={() => setShowSecret(!showSecret)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center"
              >
                {showSecret ? (
                  <EyeOff className="w-4 h-4 text-gray-400" />
                ) : (
                  <Eye className="w-4 h-4 text-gray-400" />
                )}
              </button>
            </div>
            {!showSecret && settings.consumerSecret && (
              <p className="text-xs text-gray-500 mt-1">
                Masqué: {maskedSecret}
              </p>
            )}
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
                disabled={testingConnection || !settings.apiUrl || !settings.consumerKey || !settings.consumerSecret}
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
                    : 'Échec de la connexion. Vérifiez vos paramètres.'
                  }
                </span>
              </div>
            )}
          </div>
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
                Notifier les clients par email
              </label>
              <p className="text-xs text-gray-500">
                Envoyer des notifications automatiques lors des changements de statut
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
                Gestion automatique du stock
              </label>
              <p className="text-xs text-gray-500">
                Mettre à jour le stock WooCommerce lors des livraisons et retours
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Guide de configuration */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h4 className="font-medium text-blue-900 mb-3">Guide de configuration</h4>
        <div className="text-sm text-blue-700 space-y-2">
          <p><strong>1.</strong> Connectez-vous à votre admin WooCommerce</p>
          <p><strong>2.</strong> Allez dans WooCommerce → Paramètres → Avancé → API REST</p>
          <p><strong>3.</strong> Cliquez sur "Ajouter une clé"</p>
          <p><strong>4.</strong> Définissez les permissions sur "Lecture/Écriture"</p>
          <p><strong>5.</strong> Copiez le Consumer Key et Consumer Secret ici</p>
        </div>
      </div>
    </div>
  );
};

export default WooCommerceSettings;