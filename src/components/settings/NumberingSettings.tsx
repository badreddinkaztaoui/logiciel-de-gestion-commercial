import React, { useState, useEffect } from 'react';
import { Hash, RotateCw, AlertCircle, Save } from 'lucide-react';
import { NumberingSettings as INumberingSettings, settingsService } from '../../services/settingsService';
import { documentNumberingService } from '../../services/documentNumberingService';
import { toast } from 'react-hot-toast';

interface NumberingSettingsProps {
  settings: INumberingSettings;
  onUpdate: (settings: Partial<INumberingSettings>) => void;
}

const NumberingSettings: React.FC<NumberingSettingsProps> = ({ settings, onUpdate }) => {
  const [localSettings, setLocalSettings] = useState<INumberingSettings>(settings);
  const [hasChanges, setHasChanges] = useState(false);
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());

  useEffect(() => {
    setLocalSettings(settings);
  }, [settings]);

  const formatDocumentNumber = (type: keyof INumberingSettings, number: number) => {
    const paddedNumber = number.toString().padStart(4, '0');
    switch (type) {
      case 'SALES_JOURNAL':
        return `F G${selectedYear}${paddedNumber}`;
      case 'INVOICE':
        return `F A${selectedYear}${paddedNumber}`;
      case 'QUOTE':
        return `F D${selectedYear}${paddedNumber}`;
      case 'DELIVERY':
        return `F L${selectedYear}${paddedNumber}`;
      case 'RETURN':
        return `F R${selectedYear}${paddedNumber}`;
      case 'PURCHASE_ORDER':
        return `F PO${selectedYear}${paddedNumber}`;
      default:
        return `DOC-${paddedNumber}`;
    }
  };

  const handleStartNumberChange = (type: keyof INumberingSettings, value: string) => {
    const numValue = Math.max(1, parseInt(value) || 1);

    setLocalSettings(prev => ({
      ...prev,
      [type]: {
        ...prev[type],
        startNumber: numValue,
        currentNumber: numValue
      }
    }));
    setHasChanges(true);
  };

  const handleFieldChange = (type: keyof INumberingSettings, field: string, value: any) => {
    setLocalSettings(prev => ({
      ...prev,
      [type]: {
        ...prev[type],
        [field]: value
      }
    }));
    setHasChanges(true);
  };

  const handleSave = async () => {
    if (hasChanges) {
      try {
        await settingsService.updateNumberingSettings(localSettings);

        for (const docType of documentTypes) {
          if ((docType.key === 'SALES_JOURNAL' || docType.key === 'INVOICE') &&
              localSettings[docType.key].startNumber !== settings[docType.key].startNumber) {
            await documentNumberingService.resetNumbering(docType.key);
          }
        }

        onUpdate(localSettings);
        setHasChanges(false);

        toast.success('Paramètres de numérotation enregistrés avec succès');
      } catch (error) {
        console.error('Error saving numbering settings:', error);
        toast.error('Erreur lors de l\'enregistrement des paramètres');
      }
    }
  };

  const handleReset = async (type: keyof INumberingSettings) => {
    if (window.confirm(`Réinitialiser la numérotation pour ${type === 'SALES_JOURNAL' ? 'le journal de vente' : type} ? Cette action est irréversible.`)) {
      try {
        if (type === 'SALES_JOURNAL' || type === 'INVOICE') {
          await documentNumberingService.resetNumbering(type);
        }

        const startNumber = localSettings[type].startNumber || 1;
        setLocalSettings(prev => ({
          ...prev,
          [type]: {
            ...prev[type],
            currentNumber: startNumber
          }
        }));
        setHasChanges(true);
      } catch (error) {
        console.error('Error resetting numbering:', error);
        alert('Erreur lors de la réinitialisation de la numérotation');
      }
    }
  };

  const getPreviewNumber = (type: keyof INumberingSettings) => {
    const docSettings = localSettings[type];
    return formatDocumentNumber(type, docSettings.currentNumber);
  };

  const currentYear = new Date().getFullYear();
  const yearOptions = Array.from({ length: 11 }, (_, i) => currentYear - 5 + i);

  const documentTypes = [
    { key: 'QUOTE' as const, label: 'Devis', icon: '📋', color: 'purple' },
    { key: 'INVOICE' as const, label: 'Factures', icon: '📄', color: 'blue' },
    { key: 'SALES_JOURNAL' as const, label: 'Journal de vente', icon: '📊', color: 'indigo' },
    { key: 'DELIVERY' as const, label: 'Bons de livraison', icon: '🚚', color: 'green' },
    { key: 'RETURN' as const, label: 'Bons de retour', icon: '↩️', color: 'orange' },
    { key: 'PURCHASE_ORDER' as const, label: 'Bons de commande', icon: '🛒', color: 'red' }
  ];

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex-1 mr-4">
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
        <button
          onClick={handleSave}
          disabled={!hasChanges}
          className={`px-4 py-2 rounded-lg flex items-center space-x-2 ${
            hasChanges
              ? 'bg-blue-600 text-white hover:bg-blue-700'
              : 'bg-gray-100 text-gray-400 cursor-not-allowed'
          }`}
        >
          <Save className="w-4 h-4" />
          <span>Sauvegarder</span>
        </button>
      </div>

      {documentTypes.map((docType) => {
        const docSettings = localSettings[docType.key];
        const previewNumber = getPreviewNumber(docType.key);

        return (
          <div key={docType.key} className="bg-white border border-gray-200 rounded-lg p-6">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center space-x-3">
                <span className="text-2xl">{docType.icon}</span>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">{docType.label}</h3>
                  <p className="text-sm text-gray-600">
                    Prochain numéro: <span className="font-mono font-bold text-blue-600">
                      {previewNumber}
                    </span>
                  </p>
                </div>
              </div>
              <button
                onClick={() => handleReset(docType.key)}
                className="flex items-center space-x-2 px-4 py-2 bg-red-50 text-red-700 rounded-lg hover:bg-red-100 transition-colors"
                title="Réinitialiser la numérotation"
              >
                <RotateCw className="w-4 h-4" />
                <span>Réinitialiser</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
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
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Numéro de départ
                </label>
                <input
                  type="number"
                  value={docSettings.startNumber}
                  onChange={(e) => handleStartNumberChange(docType.key, e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  min="1"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Période de réinitialisation
                </label>
                <select
                  value={docSettings.resetPeriod}
                  onChange={(e) => handleFieldChange(docType.key, 'resetPeriod', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="never">Jamais</option>
                  <option value="yearly">Annuelle</option>
                  <option value="monthly">Mensuelle</option>
                </select>
              </div>
            </div>

            <div className="mt-6 bg-gray-50 rounded-lg p-4">
              <h4 className="font-medium text-gray-900 mb-3">Aperçu du format</h4>
              <div className="flex items-center justify-center">
                <div className="bg-white border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                  <span className="text-3xl font-mono font-bold text-blue-600">
                    {previewNumber}
                  </span>
                  <p className="text-sm text-gray-500 mt-2">Prochain numéro</p>
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