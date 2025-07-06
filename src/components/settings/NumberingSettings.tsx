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
    const cleanValue = value.replace(/\D/g, '');
    const numValue = Math.max(1, parseInt(cleanValue) || 1);

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
    const docTypeLabel = {
      'SALES_JOURNAL': 'le journal de vente',
      'INVOICE': 'les factures',
      'QUOTE': 'les devis',
      'DELIVERY': 'les bons de livraison',
      'RETURN': 'les bons de retour',
      'PURCHASE_ORDER': 'les bons de commande'
    }[type] || type;

    if (window.confirm(`Réinitialiser la numérotation pour ${docTypeLabel} ? Cette action supprimera tous les numéros existants pour cette année et redémarrera à partir du numéro de départ configuré.`)) {
      try {
        toast.loading(`Réinitialisation de la numérotation pour ${docTypeLabel}...`);

        // Reset the numbering using the document numbering service
        await documentNumberingService.resetNumbering(type);

        // Reload the settings from the database to get the updated values
        const updatedSettings = await settingsService.getNumberingSettings();
        setLocalSettings(updatedSettings);
        onUpdate(updatedSettings);
        setHasChanges(false);

        toast.dismiss();
        toast.success(`Numérotation réinitialisée pour ${docTypeLabel}. Le prochain numéro sera ${getPreviewNumber(type)}.`);
      } catch (error) {
        console.error('Error resetting numbering:', error);
        toast.dismiss();

        let errorMessage = 'Erreur lors de la réinitialisation de la numérotation';

        if (error instanceof Error) {
          if (error.message.includes('Failed to reset')) {
            errorMessage = 'Échec de la réinitialisation. Vérifiez vos permissions de base de données.';
          } else if (error.message.includes('duplicate')) {
            errorMessage = 'Conflit de numérotation détecté. Veuillez réessayer.';
          } else {
            errorMessage = `Erreur: ${error.message}`;
          }
        }

        toast.error(errorMessage);
      }
    }
  };

  const getPreviewNumber = (type: keyof INumberingSettings) => {
    const docSettings = localSettings[type];
    const nextNumber = Math.max(docSettings.currentNumber, docSettings.startNumber);
    return formatDocumentNumber(type, nextNumber);
  };

  const getCurrentStatus = (type: keyof INumberingSettings) => {
    const docSettings = localSettings[type];
    const nextNumber = Math.max(docSettings.currentNumber, docSettings.startNumber);

    return {
      startNumber: docSettings.startNumber,
      currentNumber: docSettings.currentNumber,
      nextNumber,
      isValid: docSettings.currentNumber >= docSettings.startNumber
    };
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

  const handleDebugNumbering = async () => {
    try {
      toast.loading('Diagnostic complet du système de numérotation...');

      // Run comprehensive diagnostics
      const issues = await documentNumberingService.diagnoseProblem();

      // Validate the numbering system
      await documentNumberingService.validateNumberingSystem();

      // Get the status for debugging
      const status = await documentNumberingService.getNumberingStatus();

      toast.dismiss();

      // Display results
      console.group('🔍 Diagnostic du système de numérotation');
      console.log('📊 État actuel du système:', status);
      console.log('🚨 Problèmes détectés:');
      issues.forEach(issue => console.log(issue));
      console.groupEnd();

      const hasErrors = issues.some(issue => issue.includes('❌'));
      const hasWarnings = issues.some(issue => issue.includes('⚠️'));

      if (hasErrors) {
        toast.error(`Erreurs détectées dans le système de numérotation. Consultez la console pour plus de détails.`);
      } else if (hasWarnings) {
        toast.success(`Système opérationnel avec quelques avertissements. Consultez la console pour plus de détails.`);
      } else {
        toast.success('Système de numérotation parfaitement opérationnel ! ✅');
      }

      // Show a summary in the UI
      const errorCount = issues.filter(issue => issue.includes('❌')).length;
      const warningCount = issues.filter(issue => issue.includes('⚠️')).length;
      const successCount = issues.filter(issue => issue.includes('✅')).length;

      if (errorCount > 0 || warningCount > 0) {
        setTimeout(() => {
          alert(`Résumé du diagnostic:\n\n✅ Succès: ${successCount}\n⚠️ Avertissements: ${warningCount}\n❌ Erreurs: ${errorCount}\n\nConsultez la console (F12) pour plus de détails.`);
        }, 1000);
      }

    } catch (error) {
      console.error('Error during numbering diagnosis:', error);
      toast.dismiss();
      toast.error('Erreur lors du diagnostic du système de numérotation');
    }
  };

  const handleRepairNumbering = async () => {
    if (window.confirm('Réparer le système de numérotation ? Cette opération va nettoyer les doublons et corriger les incohérences.')) {
      try {
        toast.loading('Réparation du système de numérotation en cours...');

        // Run the repair operation
        await documentNumberingService.repairNumberingSystem();

        toast.dismiss();
        toast.success('Système de numérotation réparé avec succès ! 🔧');

        // Refresh the diagnostic to show the results
        setTimeout(() => {
          handleDebugNumbering();
        }, 1000);

      } catch (error) {
        console.error('Error during numbering repair:', error);
        toast.dismiss();
        toast.error('Erreur lors de la réparation du système de numérotation');
      }
    }
  };

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
        <div className="flex space-x-2">
          <button
            onClick={handleRepairNumbering}
            className="px-4 py-2 bg-yellow-100 text-yellow-700 rounded-lg hover:bg-yellow-200 flex items-center space-x-2"
            title="Réparer le système de numérotation"
          >
            <RotateCw className="w-4 h-4" />
            <span>Réparer</span>
          </button>
          <button
            onClick={handleDebugNumbering}
            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 flex items-center space-x-2"
            title="Vérifier le système de numérotation"
          >
            <AlertCircle className="w-4 h-4" />
            <span>Vérifier</span>
          </button>
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
                  <p className="text-xs text-gray-500 mt-1">
                    Départ: {docSettings.startNumber} | Actuel: {docSettings.currentNumber}
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
                  type="text"
                  value={docSettings.startNumber}
                  onChange={(e) => handleStartNumberChange(docType.key, e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="1"
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