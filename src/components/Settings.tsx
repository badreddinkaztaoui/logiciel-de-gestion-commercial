import React, { useState, useEffect } from 'react';
import {
  Save,
  RotateCcw,
  Download,
  Upload,
  Building,
  Hash,
  Palette,
  Globe,
  Truck,
  RotateCcw as ReturnIcon,
  Scale,
  Eye,
  AlertCircle,
  CheckCircle,
  Paintbrush,
  ArrowLeft,
  Loader2
} from 'lucide-react';
import { settingsService, AllSettings } from '../services/settingsService';

// Import des composants de paramètres
import CompanySettings from './settings/CompanySettings';
import NumberingSettings from './settings/NumberingSettings';
import TemplateSettings from './settings/TemplateSettings';
import WooCommerceSettings from './settings/WooCommerceSettings';
import DeliverySettings from './settings/DeliverySettings';
import ReturnSettings from './settings/ReturnSettings';
import LegalSettings from './settings/LegalSettings';

const Settings: React.FC = () => {
  const [settings, setSettings] = useState<AllSettings | null>(null);
  const [loadingSettings, setLoadingSettings] = useState(true);
  const [activeTab, setActiveTab] = useState('company');
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  useEffect(() => {
    const initializeSettings = async () => {
      setLoadingSettings(true);
      try {
        await settingsService.checkAndResetNumbering();
        const loadedSettings = await settingsService.getSettings();
        setSettings(loadedSettings);
      } catch (error) {
        console.error('Error loading settings:', error);
        const defaultSettings = await settingsService.getSettings();
        setSettings(defaultSettings);
      } finally {
        setLoadingSettings(false);
      }
    };

    initializeSettings();
  }, []);

  const tabs = [
    { id: 'company', label: 'Entreprise', icon: Building, color: 'blue' },
    { id: 'numbering', label: 'Numérotation', icon: Hash, color: 'green' },
    { id: 'template', label: 'Apparence', icon: Palette, color: 'purple' },
    { id: 'woocommerce', label: 'WooCommerce', icon: Globe, color: 'orange' },
    { id: 'delivery', label: 'Livraisons', icon: Truck, color: 'teal' },
    { id: 'returns', label: 'Retours', icon: ReturnIcon, color: 'red' },
    { id: 'legal', label: 'Mentions légales', icon: Scale, color: 'gray' }
  ];

  const handleSave = async () => {
    if (!settings) return;

    setSaveStatus('saving');
    try {
      await settingsService.saveSettings(settings);
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 2000);
    } catch (error) {
      setSaveStatus('error');
      setTimeout(() => setSaveStatus('idle'), 2000);
    }
  };

  const handleReset = async () => {
    if (window.confirm('Êtes-vous sûr de vouloir réinitialiser tous les paramètres ?')) {
      try {
        await settingsService.resetToDefaults();
        const resetSettings = await settingsService.getSettings();
        setSettings(resetSettings);
      } catch (error) {
        console.error('Error resetting settings:', error);
      }
    }
  };

  const handleExport = async () => {
    const settingsJson = await settingsService.exportSettings();
    const blob = new Blob([settingsJson], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'gepronet-settings.json';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const settingsJson = e.target?.result as string;
          if (await settingsService.importSettings(settingsJson)) {
            const importedSettings = await settingsService.getSettings();
            setSettings(importedSettings);
            alert('Paramètres importés avec succès !');
          } else {
            alert('Erreur lors de l\'import des paramètres.');
          }
        } catch (error) {
          alert('Fichier invalide.');
        }
      };
      reader.readAsText(file);
    }
  };

  const updateSettings = (section: keyof AllSettings, updates: any) => {
    if (!settings) return;

    setSettings(prev => prev ? ({
      ...prev,
      [section]: { ...prev[section], ...updates }
    }) : null);
  };

  const renderTabContent = () => {
    if (!settings) return null;

    switch (activeTab) {
      case 'company':
        return (
          <CompanySettings
            settings={settings.company || {}}
            onUpdate={(updates) => updateSettings('company', updates)}
          />
        );
      case 'numbering':
        return (
          <NumberingSettings
            settings={settings.numbering || {}}
            onUpdate={(updates) => updateSettings('numbering', updates)}
          />
        );
      case 'template':
        return (
          <TemplateSettings
            settings={settings.template || {}}
            onUpdate={(updates) => updateSettings('template', updates)}
          />
        );
      case 'woocommerce':
        return (
          <WooCommerceSettings
            settings={settings.woocommerce || {}}
            onUpdate={(updates) => updateSettings('woocommerce', updates)}
          />
        );
      case 'delivery':
        return (
          <DeliverySettings
            settings={settings.delivery || {}}
            onUpdate={(updates) => updateSettings('delivery', updates)}
          />
        );
      case 'returns':
        return (
          <ReturnSettings
            settings={settings.returns || {}}
            onUpdate={(updates) => updateSettings('returns', updates)}
          />
        );
      case 'legal':
        return (
          <LegalSettings
            settings={settings.legal || {}}
            onUpdate={(updates) => updateSettings('legal', updates)}
          />
        );
      default:
        return null;
    }
  };

  const getSaveButtonContent = () => {
    switch (saveStatus) {
      case 'saving':
        return (
          <>
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
            <span>Sauvegarde...</span>
          </>
        );
      case 'saved':
        return (
          <>
            <CheckCircle className="w-4 h-4" />
            <span>Sauvegardé</span>
          </>
        );
      case 'error':
        return (
          <>
            <AlertCircle className="w-4 h-4" />
            <span>Erreur</span>
          </>
        );
      default:
        return (
          <>
            <Save className="w-4 h-4" />
            <span>Sauvegarder</span>
          </>
        );
    }
  };

  const currentTab = tabs.find(tab => tab.id === activeTab);

  // Show loading state while settings are being loaded
  if (loadingSettings || !settings) {
    return (
      <div className="h-screen flex flex-col overflow-hidden">
        <div className="flex-none p-6 bg-white border-b">
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Paramètres</h1>
              <p className="text-gray-600 mt-1">Configuration de votre application</p>
            </div>
          </div>
        </div>

        <div className="flex-1 flex items-center justify-center">
          <div className="flex items-center space-x-3 text-gray-600">
            <Loader2 className="w-6 h-6 animate-spin" />
            <span>Chargement des paramètres...</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col overflow-hidden pb-20">
      {/* Header */}
      <div className="flex-none p-6 bg-white border-b">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Paramètres</h1>
            <p className="text-gray-600 mt-1">Configuration de votre application</p>
          </div>

          <div className="flex items-center space-x-3">
            {/* Import/Export */}
            <label className="cursor-pointer flex items-center space-x-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors">
              <Upload className="w-4 h-4" />
              <span>Importer</span>
              <input
                type="file"
                accept=".json"
                onChange={handleImport}
                className="hidden"
              />
            </label>

            <button
              onClick={handleExport}
              className="flex items-center space-x-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
            >
              <Download className="w-4 h-4" />
              <span>Exporter</span>
            </button>

            {/* Reset */}
            <button
              onClick={handleReset}
              className="flex items-center space-x-2 px-4 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Réinitialiser</span>
            </button>

            {/* Save */}
            <button
              onClick={handleSave}
              disabled={saveStatus === 'saving'}
              className={`flex items-center space-x-2 px-6 py-2 rounded-lg transition-colors ${
                saveStatus === 'saved'
                  ? 'bg-green-600 text-white'
                  : saveStatus === 'error'
                  ? 'bg-red-600 text-white'
                  : 'bg-blue-600 text-white hover:bg-blue-700'
              } disabled:opacity-50`}
            >
              {getSaveButtonContent()}
            </button>
          </div>
        </div>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Navigation Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`p-4 rounded-lg border-2 transition-all duration-200 ${
                    isActive
                      ? `border-${tab.color}-500 bg-${tab.color}-50`
                      : 'border-gray-200 hover:border-gray-300 bg-white hover:bg-gray-50'
                  }`}
                >
                  <div className="flex flex-col items-center space-y-2">
                    <Icon className={`w-6 h-6 ${
                      isActive ? `text-${tab.color}-600` : 'text-gray-500'
                    }`} />
                    <span className={`text-sm font-medium text-center ${
                      isActive ? `text-${tab.color}-700` : 'text-gray-700'
                    }`}>
                      {tab.label}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Content */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200">
            {/* Tab Header */}
            <div className={`border-b border-gray-200 px-6 py-4 bg-${currentTab?.color}-50`}>
              <div className="flex items-center space-x-3">
                {currentTab && <currentTab.icon className={`w-5 h-5 text-${currentTab.color}-600`} />}
                <div>
                  <h2 className={`text-lg font-semibold text-${currentTab?.color}-900`}>
                    {currentTab?.label}
                  </h2>
                  <p className={`text-sm text-${currentTab?.color}-700`}>
                    {activeTab === 'company' && 'Informations de votre entreprise'}
                    {activeTab === 'numbering' && 'Configuration de la numérotation des documents'}
                    {activeTab === 'template' && 'Personnalisation de l\'apparence des documents'}
                    {activeTab === 'woocommerce' && 'Intégration avec votre boutique WooCommerce'}
                    {activeTab === 'delivery' && 'Paramètres des bons de livraison'}
                    {activeTab === 'returns' && 'Configuration des bons de retour'}
                    {activeTab === 'legal' && 'Mentions légales et conditions'}
                  </p>
                </div>
              </div>
            </div>

            {/* Tab Content */}
            <div className="p-6">
              {renderTabContent()}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Settings;