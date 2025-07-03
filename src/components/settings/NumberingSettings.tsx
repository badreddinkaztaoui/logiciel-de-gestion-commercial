import React, { useState, useEffect } from 'react';
import { Hash, RotateCw, AlertCircle } from 'lucide-react';
import { NumberingSettings as INumberingSettings, settingsService } from '../../services/settingsService';

interface NumberingSettingsProps {
  settings: INumberingSettings;
  onUpdate: (settings: Partial<INumberingSettings>) => void;
}

const NumberingSettings: React.FC<NumberingSettingsProps> = ({ settings, onUpdate }) => {
  const [previewNumbers, setPreviewNumbers] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());

  const formatDocumentNumber = (type: keyof INumberingSettings, prefix: string, suffix: string, number: number) => {
    // Special format for sales journal and invoice
    if (type === 'SALES_JOURNAL' || type === 'INVOICE') {
      return `F G${selectedYear}${number.toString().padStart(4, '0')}`;
    } else if (suffix) {
      return `${prefix}-${suffix}${number}`;
    } else {
      return `${prefix}-${number.toString().padStart(6, '0')}`;
    }
  };

  const handleDocumentTypeUpdate = async (
    type: keyof INumberingSettings,
    field: string,
    value: any
  ) => {
    // Update local state
    onUpdate({
      [type]: { ...settings[type], [field]: value }
    });

    // If changing start number, also update current number
    if (field === 'startNumber' && value > settings[type].currentNumber) {
      onUpdate({
        [type]: { ...settings[type], [field]: value, currentNumber: value }
      });
    }

    // Update preview immediately when prefix or suffix changes
    if (field === 'prefix' || field === 'suffix') {
      const docSettings = { ...settings[type], [field]: value };
      const formattedNumber = formatDocumentNumber(type, docSettings.prefix, docSettings.suffix, docSettings.currentNumber);
      setPreviewNumbers(prev => ({ ...prev, [type]: formattedNumber }));
    }
  };

  const loadNextNumber = async (type: keyof INumberingSettings) => {
    try {
      setLoading(prev => ({ ...prev, [type]: true }));
      const docSettings = settings[type];
      const formattedNumber = formatDocumentNumber(type, docSettings.prefix, docSettings.suffix, docSettings.currentNumber);
      setPreviewNumbers(prev => ({ ...prev, [type]: formattedNumber }));
    } catch (error) {
      console.error('Error getting next number:', error);
      // Fallback to local preview
      const docSettings = settings[type];
      const formattedNumber = formatDocumentNumber(type, docSettings.prefix, docSettings.suffix, docSettings.currentNumber);
      setPreviewNumbers(prev => ({ ...prev, [type]: formattedNumber }));
    } finally {
      setLoading(prev => ({ ...prev, [type]: false }));
    }
  };

  // Update preview when year changes for sales journal and invoice
  useEffect(() => {
    loadNextNumber('SALES_JOURNAL');
    loadNextNumber('INVOICE');
  }, [selectedYear]);

  const documentTypes = [
    { key: 'QUOTE' as const, label: 'Devis', icon: '📋', color: 'purple' },
    { key: 'INVOICE' as const, label: 'Factures', icon: '📄', color: 'blue' },
    { key: 'SALES_JOURNAL' as const, label: 'Journal de vente', icon: '📊', color: 'indigo' },
    { key: 'DELIVERY' as const, label: 'Bons de livraison', icon: '🚚', color: 'green' },
    { key: 'RETURN' as const, label: 'Bons de retour', icon: '↩️', color: 'orange' },
    { key: 'PURCHASE_ORDER' as const, label: 'Bons de commande', icon: '🛒', color: 'red' }
  ];

  // Load preview numbers when component mounts
  useEffect(() => {
    documentTypes.forEach(({ key }) => {
      loadNextNumber(key);
    });
  }, [settings]); // Also reload when settings change

  // Generate year options (current year +/- 5 years)
  const currentYear = new Date().getFullYear();
  const yearOptions = Array.from({ length: 11 }, (_, i) => currentYear - 5 + i);

  return (
    <div className="space-y-8">
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start space-x-3">
          <Hash className="w-5 h-5 text-blue-500 mt-0.5" />
          <div>
            <h4 className="font-medium text-blue-900">Configuration de la numérotation</h4>
            <p className="text-sm text-blue-700 mt-1">
              Configurez le format de numérotation pour chaque type de document.
              La numérotation est gérée automatiquement et garantit des numéros uniques.
            </p>
          </div>
        </div>
      </div>

      {documentTypes.map((docType) => {
        const docSettings = settings[docType.key];
        const previewNumber = previewNumbers[docType.key] || '';

        return (
          <div key={docType.key} className="bg-white border border-gray-200 rounded-lg p-6">
            <div className="flex items-center space-x-3 mb-6">
              <span className="text-2xl">{docType.icon}</span>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">{docType.label}</h3>
                <p className="text-sm text-gray-600">
                  Prochain numéro: {loading[docType.key] ? (
                    <span className="font-mono text-gray-400">Chargement...</span>
                  ) : (
                    <span className="font-mono font-bold text-blue-600">
                      {previewNumber}
                    </span>
                  )}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {(docType.key === 'SALES_JOURNAL' || docType.key === 'INVOICE') ? (
                // Special inputs for Sales Journal and Invoice
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Année
                    </label>
                    <select
                      value={selectedYear}
                      onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      {yearOptions.map(year => (
                        <option key={year} value={year}>{year}</option>
                      ))}
                    </select>
                    <p className="text-xs text-gray-500 mt-1">
                      L'année qui sera utilisée dans le numéro
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Numéro de départ
                    </label>
                    <input
                      type="number"
                      value={docSettings.startNumber}
                      onChange={(e) => handleDocumentTypeUpdate(docType.key, 'startNumber', parseInt(e.target.value) || 1)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      min="1"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Utilisé lors de la réinitialisation
                    </p>
                  </div>
                </>
              ) : (
                // Regular inputs for other document types
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Préfixe
                    </label>
                    <input
                      type="text"
                      value={docSettings.prefix}
                      onChange={(e) => handleDocumentTypeUpdate(docType.key, 'prefix', e.target.value.toUpperCase())}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="JV"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Suffixe
                    </label>
                    <input
                      type="text"
                      value={docSettings.suffix}
                      onChange={(e) => handleDocumentTypeUpdate(docType.key, 'suffix', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="Optionnel"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Numéro de départ
                    </label>
                    <input
                      type="number"
                      value={docSettings.startNumber}
                      onChange={(e) => handleDocumentTypeUpdate(docType.key, 'startNumber', parseInt(e.target.value) || 1)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      min="1"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Utilisé lors de la réinitialisation
                    </p>
                  </div>
                </>
              )}
            </div>

            <div className="mt-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Remise à zéro automatique
              </label>
              <select
                value={docSettings.resetPeriod}
                onChange={(e) => handleDocumentTypeUpdate(docType.key, 'resetPeriod', e.target.value as any)}
                className="w-full max-w-xs px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="never">Jamais</option>
                <option value="yearly">Chaque année (1er janvier)</option>
                <option value="monthly">Chaque mois (1er du mois)</option>
              </select>
            </div>

            {/* Aperçu du format */}
            <div className="mt-6 bg-gray-50 rounded-lg p-4">
              <h4 className="font-medium text-gray-900 mb-3">Aperçu du format</h4>
              <div className="flex items-center justify-center">
                <div className="bg-white border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                  {loading[docType.key] ? (
                    <div className="animate-pulse">
                      <div className="h-8 bg-gray-200 rounded w-48"></div>
                      <p className="text-sm text-gray-500 mt-2">Chargement...</p>
                    </div>
                  ) : (
                    <>
                      <span className="text-3xl font-mono font-bold text-blue-600">
                        {previewNumber}
                      </span>
                      <p className="text-sm text-gray-500 mt-2">Prochain numéro</p>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      })}

      <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
        <div className="flex items-start space-x-3">
          <AlertCircle className="w-5 h-5 text-orange-500 mt-0.5" />
          <div>
            <h4 className="font-medium text-orange-900">Important</h4>
            <ul className="text-sm text-orange-700 mt-1 space-y-1">
              <li>• La numérotation est gérée automatiquement pour garantir des numéros uniques</li>
              <li>• La remise à zéro utilise le "Numéro de départ" configuré</li>
              <li>• La réinitialisation se fait automatiquement selon la période choisie</li>
              <li>• Chaque type de document a sa propre séquence indépendante</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default NumberingSettings;