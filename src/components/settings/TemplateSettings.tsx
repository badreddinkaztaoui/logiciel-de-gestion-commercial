import React from 'react';
import { Palette, RotateCw, Percent, Type, Monitor } from 'lucide-react';
import { TemplateSettings as ITemplateSettings } from '../../services/settingsService';

interface TemplateSettingsProps {
  settings: ITemplateSettings;
  onUpdate: (settings: Partial<ITemplateSettings>) => void;
}

const TemplateSettings: React.FC<TemplateSettingsProps> = ({ settings, onUpdate }) => {
  const handleChange = (field: keyof ITemplateSettings, value: any) => {
    onUpdate({ [field]: value });
  };

  const colorPresets = [
    { name: 'Bleu classique', primary: '#2563eb', secondary: '#64748b' },
    { name: 'Vert moderne', primary: '#059669', secondary: '#6b7280' },
    { name: 'Rouge élégant', primary: '#dc2626', secondary: '#6b7280' },
    { name: 'Violet créatif', primary: '#7c3aed', secondary: '#6b7280' },
    { name: 'Orange dynamique', primary: '#ea580c', secondary: '#6b7280' },
    { name: 'Indigo professionnel', primary: '#4338ca', secondary: '#6b7280' }
  ];

  const applyColorPreset = (preset: { primary: string; secondary: string }) => {
    onUpdate({
      primaryColor: preset.primary,
      secondaryColor: preset.secondary
    });
  };

  return (
    <div className="space-y-8">
      <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
        <div className="flex items-start space-x-3">
          <Palette className="w-5 h-5 text-purple-500 mt-0.5" />
          <div>
            <h4 className="font-medium text-purple-900">Personnalisation des documents</h4>
            <p className="text-sm text-purple-700 mt-1">
              Personnalisez l'apparence de vos factures, bons de livraison et bons de retour.
            </p>
          </div>
        </div>
      </div>

      {/* Couleurs */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-6 flex items-center">
          <Palette className="w-5 h-5 mr-2" />
          Couleurs
        </h3>

        <div className="space-y-6">
          {/* Presets de couleurs */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Palettes prédéfinies
            </label>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {colorPresets.map((preset, index) => (
                <button
                  key={index}
                  onClick={() => applyColorPreset(preset)}
                  className="flex items-center space-x-3 p-3 border border-gray-200 rounded-lg hover:border-gray-300 transition-colors"
                >
                  <div className="flex space-x-1">
                    <div 
                      className="w-4 h-4 rounded"
                      style={{ backgroundColor: preset.primary }}
                    ></div>
                    <div 
                      className="w-4 h-4 rounded"
                      style={{ backgroundColor: preset.secondary }}
                    ></div>
                  </div>
                  <span className="text-sm text-gray-700">{preset.name}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Couleurs personnalisées */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Couleur principale
              </label>
              <div className="flex space-x-2">
                <input
                  type="color"
                  value={settings.primaryColor}
                  onChange={(e) => handleChange('primaryColor', e.target.value)}
                  className="w-16 h-10 border border-gray-300 rounded-lg cursor-pointer"
                />
                <input
                  type="text"
                  value={settings.primaryColor}
                  onChange={(e) => handleChange('primaryColor', e.target.value)}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <p className="text-xs text-gray-500 mt-1">Utilisée pour les titres et éléments principaux</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Couleur secondaire
              </label>
              <div className="flex space-x-2">
                <input
                  type="color"
                  value={settings.secondaryColor}
                  onChange={(e) => handleChange('secondaryColor', e.target.value)}
                  className="w-16 h-10 border border-gray-300 rounded-lg cursor-pointer"
                />
                <input
                  type="text"
                  value={settings.secondaryColor}
                  onChange={(e) => handleChange('secondaryColor', e.target.value)}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <p className="text-xs text-gray-500 mt-1">Utilisée pour les éléments secondaires</p>
            </div>
          </div>
        </div>
      </div>

      {/* Typographie et tailles */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-6 flex items-center">
          <Type className="w-5 h-5 mr-2" />
          Typographie et mise en page
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Taille du logo
            </label>
            <select
              value={settings.logoSize}
              onChange={(e) => handleChange('logoSize', e.target.value as any)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="small">Petit (2cm)</option>
              <option value="medium">Moyen (3cm)</option>
              <option value="large">Grand (4cm)</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Taille de police
            </label>
            <select
              value={settings.fontSize}
              onChange={(e) => handleChange('fontSize', e.target.value as any)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="small">Petit (9pt)</option>
              <option value="medium">Moyen (10pt)</option>
              <option value="large">Grand (11pt)</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Devise
            </label>
            <select
              value={settings.currency}
              onChange={(e) => handleChange('currency', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="MAD">Dirham Marocain (MAD)</option>
              <option value="EUR">Euro (EUR)</option>
              <option value="USD">Dollar US (USD)</option>
              <option value="GBP">Livre Sterling (GBP)</option>
            </select>
          </div>
        </div>
      </div>

      {/* TVA et fiscalité */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-6 flex items-center">
          <Percent className="w-5 h-5 mr-2" />
          TVA et fiscalité
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Taux de TVA (%)
            </label>
            <input
              type="number"
              value={settings.taxRate}
              onChange={(e) => handleChange('taxRate', parseFloat(e.target.value) || 0)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              min="0"
              max="100"
              step="0.1"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Libellé TVA
            </label>
            <input
              type="text"
              value={settings.taxLabel}
              onChange={(e) => handleChange('taxLabel', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="TVA, TPS, Taxe..."
            />
          </div>
        </div>
      </div>

      {/* Options d'affichage */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-6 flex items-center">
          <Monitor className="w-5 h-5 mr-2" />
          Options d'affichage
        </h3>

        <div className="space-y-4">
          <div className="flex items-center space-x-3">
            <input
              type="checkbox"
              id="showLogo"
              checked={settings.showLogo}
              onChange={(e) => handleChange('showLogo', e.target.checked)}
              className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500"
            />
            <label htmlFor="showLogo" className="text-sm font-medium text-gray-700">
              Afficher le logo sur les documents
            </label>
          </div>
          <div className="flex items-center space-x-3">
            <input
              type="checkbox"
              id="showTaxNumber"
              checked={settings.showTaxNumber}
              onChange={(e) => handleChange('showTaxNumber', e.target.checked)}
              className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500"
            />
            <label htmlFor="showTaxNumber" className="text-sm font-medium text-gray-700">
              Afficher le numéro de TVA
            </label>
          </div>
          <div className="flex items-center space-x-3">
            <input
              type="checkbox"
              id="showRegistrationNumber"
              checked={settings.showRegistrationNumber}
              onChange={(e) => handleChange('showRegistrationNumber', e.target.checked)}
              className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500"
            />
            <label htmlFor="showRegistrationNumber" className="text-sm font-medium text-gray-700">
              Afficher le numéro d'enregistrement
            </label>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TemplateSettings;