import React from 'react';
import { Building, Camera, Hash, CreditCard, Smartphone, Info, Mail, Globe } from 'lucide-react';
import { CompanySettings as ICompanySettings } from '../../services/settingsService';

interface CompanySettingsProps {
  settings: ICompanySettings;
  onUpdate: (settings: Partial<ICompanySettings>) => void;
}

const CompanySettings: React.FC<CompanySettingsProps> = ({ settings, onUpdate }) => {
  const handleChange = (field: keyof ICompanySettings, value: string) => {
    onUpdate({ [field]: value });
  };

  return (
    <div className="space-y-6">
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start space-x-3">
          <Building className="w-5 h-5 text-blue-500 mt-0.5" />
          <div>
            <h4 className="font-medium text-blue-900">Informations de votre entreprise</h4>
            <p className="text-sm text-blue-700 mt-1">
              Ces informations apparaîtront sur vos factures, bons de livraison et autres documents.
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            <Building className="w-4 h-4 inline mr-1" />
            Nom de l'entreprise *
          </label>
          <input
            type="text"
            value={settings.name}
            onChange={(e) => handleChange('name', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            placeholder="Nom de votre entreprise"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Description
          </label>
          <input
            type="text"
            value={settings.description}
            onChange={(e) => handleChange('description', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            placeholder="Secteur d'activité ou slogan"
          />
        </div>
      </div>

      <div className="border-t pt-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
          <Info className="w-5 h-5 mr-2" />
          Informations Footer
        </h3>
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
          <p className="text-sm text-yellow-800">
            Ces informations apparaîtront dans le pied de page de vos documents (factures, bons de livraison, etc.).
          </p>
        </div>

        {/* Informations légales */}
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Hash className="w-4 h-4 inline mr-1" />
                ICE
              </label>
              <input
                type="text"
                value={settings.ice || ''}
                onChange={(e) => handleChange('ice', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="000046099000031"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Building className="w-4 h-4 inline mr-1" />
                R.C (Registre Commerce)
              </label>
              <input
                type="text"
                value={settings.rc || ''}
                onChange={(e) => handleChange('rc', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="99139"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                CNSS
              </label>
              <input
                type="text"
                value={settings.cnss || ''}
                onChange={(e) => handleChange('cnss', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="9639595"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                IF (Identifiant Fiscal)
              </label>
              <input
                type="text"
                value={settings.if || ''}
                onChange={(e) => handleChange('if', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="3366970"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                PATENTE
              </label>
              <input
                type="text"
                value={settings.patente || ''}
                onChange={(e) => handleChange('patente', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="25 790761"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <CreditCard className="w-4 h-4 inline mr-1" />
                RIB
              </label>
              <input
                type="text"
                value={settings.rib || ''}
                onChange={(e) => handleChange('rib', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="021 810 0000 069 030 27084 9 37"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Adresse complète pour footer
            </label>
            <input
              type="text"
              value={settings.footerAddress || ''}
              onChange={(e) => handleChange('footerAddress', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="15, Avenue Al Abtal, Appt N°4 Agdal - Rabat - 10000 - Maroc"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Mail className="w-4 h-4 inline mr-1" />
                Email footer
              </label>
              <input
                type="email"
                value={settings.footerEmail || ''}
                onChange={(e) => handleChange('footerEmail', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="contact@rabatcommerce.com"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Globe className="w-4 h-4 inline mr-1" />
                Site web footer
              </label>
              <input
                type="text"
                value={settings.footerWebsite || ''}
                onChange={(e) => handleChange('footerWebsite', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="www.rabatcommerce.com"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Smartphone className="w-4 h-4 inline mr-1" />
                Téléphone
              </label>
              <input
                type="text"
                value={settings.telephone || ''}
                onChange={(e) => handleChange('telephone', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="0661 - 201- 500"
              />
            </div>
          </div>
        </div>

        {/* Aperçu du footer */}
        <div className="mt-6 bg-gray-50 border border-gray-200 rounded-lg p-4">
          <h4 className="font-medium text-gray-900 mb-3">Aperçu du footer</h4>
          <div className="text-xs text-gray-600 space-y-1">
            <p>
              <strong>ICE :</strong> {settings.ice || '[ICE]'} - <strong>R.C :</strong> {settings.rc || '[RC]'} - <strong>CNSS :</strong> {settings.cnss || '[CNSS]'}
            </p>
            <p>
              <strong>IF :</strong> {settings.if || '[IF]'} - <strong>PATENTE :</strong> {settings.patente || '[PATENTE]'} - <strong>RIB :</strong> {settings.rib || '[RIB]'}
            </p>
            <p>
              {settings.footerAddress || '[Adresse complète]'}. {settings.footerEmail || '[Email]'} - {settings.footerWebsite || '[Site web]'} - <strong>Téléphone :</strong> {settings.telephone || '[Téléphone]'}
            </p>
          </div>
        </div>
      </div>

      <div className="border-t pt-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
          <Camera className="w-5 h-5 mr-2" />
          Logo
        </h3>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              URL du logo
            </label>
            <input
              type="url"
              value={settings.logo}
              onChange={(e) => handleChange('logo', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="https://exemple.com/logo.png"
            />
          </div>
          {settings.logo && (
            <div className="flex items-center space-x-4">
              <div className="text-sm text-gray-600">Aperçu :</div>
              <img 
                src={settings.logo} 
                alt="Logo preview" 
                className="h-16 object-contain border border-gray-200 rounded-lg p-2"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                  e.currentTarget.nextElementSibling?.classList.remove('hidden');
                }}
              />
              <div className="hidden text-sm text-red-500">Erreur de chargement du logo</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CompanySettings;