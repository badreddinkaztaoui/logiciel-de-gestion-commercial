import React from 'react';
import { Scale, FileText, CreditCard, Building } from 'lucide-react';
import { LegalSettings as ILegalSettings } from '../../services/settingsService';

interface LegalSettingsProps {
  settings: ILegalSettings;
  onUpdate: (settings: Partial<ILegalSettings>) => void;
}

const LegalSettings: React.FC<LegalSettingsProps> = ({ settings, onUpdate }) => {
  const handleChange = (field: keyof ILegalSettings, value: string) => {
    onUpdate({ [field]: value });
  };

  return (
    <div className="space-y-8">
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
        <div className="flex items-start space-x-3">
          <Scale className="w-5 h-5 text-gray-500 mt-0.5" />
          <div>
            <h4 className="font-medium text-gray-900">Mentions légales et conditions</h4>
            <p className="text-sm text-gray-700 mt-1">
              Configurez les textes légaux qui apparaîtront sur vos documents commerciaux.
            </p>
          </div>
        </div>
      </div>

      {/* Conditions générales */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-6 flex items-center">
          <FileText className="w-5 h-5 mr-2" />
          Conditions de vente
        </h3>

        <div className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Conditions générales de vente
            </label>
            <textarea
              value={settings.termsAndConditions}
              onChange={(e) => handleChange('termsAndConditions', e.target.value)}
              rows={4}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Conditions générales applicables à vos ventes..."
            />
            <p className="text-xs text-gray-500 mt-1">
              Texte affiché sur les factures concernant les conditions de vente
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Politique de retour
            </label>
            <textarea
              value={settings.returnPolicy}
              onChange={(e) => handleChange('returnPolicy', e.target.value)}
              rows={4}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Conditions et délais pour les retours de produits..."
            />
            <p className="text-xs text-gray-500 mt-1">
              Conditions applicables aux retours de produits
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Politique de livraison
            </label>
            <textarea
              value={settings.shippingPolicy}
              onChange={(e) => handleChange('shippingPolicy', e.target.value)}
              rows={4}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Délais, frais de port et conditions de livraison..."
            />
            <p className="text-xs text-gray-500 mt-1">
              Informations sur les modalités de livraison
            </p>
          </div>
        </div>
      </div>

      {/* Conditions de paiement */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-6 flex items-center">
          <CreditCard className="w-5 h-5 mr-2" />
          Paiement et facturation
        </h3>

        <div className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Conditions de paiement
            </label>
            <textarea
              value={settings.paymentTerms}
              onChange={(e) => handleChange('paymentTerms', e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Délais de paiement, pénalités de retard..."
            />
            <p className="text-xs text-gray-500 mt-1">
              Conditions de paiement affichées sur les factures
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Coordonnées bancaires
            </label>
            <textarea
              value={settings.bankDetails}
              onChange={(e) => handleChange('bankDetails', e.target.value)}
              rows={4}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Banque, IBAN, RIB..."
            />
            <p className="text-xs text-gray-500 mt-1">
              Informations bancaires pour les virements (optionnel)
            </p>
          </div>
        </div>
      </div>

      {/* Mentions légales */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-6 flex items-center">
          <Building className="w-5 h-5 mr-2" />
          Mentions légales
        </h3>

        <div className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Mentions légales obligatoires
            </label>
            <textarea
              value={settings.legalMentions}
              onChange={(e) => handleChange('legalMentions', e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Forme juridique, capital, SIRET, etc."
            />
            <p className="text-xs text-gray-500 mt-1">
              Mentions légales obligatoires selon votre statut juridique
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Texte de pied de page
            </label>
            <input
              type="text"
              value={settings.footerText}
              onChange={(e) => handleChange('footerText', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Message de remerciement, slogan..."
            />
            <p className="text-xs text-gray-500 mt-1">
              Texte personnalisé affiché en bas des documents
            </p>
          </div>
        </div>
      </div>

      {/* Exemples de textes */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h4 className="font-medium text-blue-900 mb-3">Exemples de textes légaux</h4>
        <div className="text-sm text-blue-700 space-y-3">
          <div>
            <p className="font-medium">Conditions de paiement :</p>
            <p className="italic">"Paiement à 30 jours net. En cas de retard, des pénalités de 3 fois le taux légal seront appliquées."</p>
          </div>
          <div>
            <p className="font-medium">Mentions légales (SARL) :</p>
            <p className="italic">"SARL au capital de 10 000€ - SIRET: 123 456 789 00012 - APE: 4791A"</p>
          </div>
          <div>
            <p className="font-medium">Politique de retour :</p>
            <p className="italic">"Retours acceptés dans les 14 jours suivant la livraison. Produits neufs et dans leur emballage d'origine."</p>
          </div>
        </div>
      </div>

      {/* Aperçu */}
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
        <h4 className="font-medium text-gray-900 mb-3">Aperçu sur les documents</h4>
        <div className="text-sm text-gray-700 space-y-2">
          <p>• <strong>Factures :</strong> Conditions de paiement + Mentions légales + Pied de page</p>
          <p>• <strong>Bons de livraison :</strong> Politique de livraison + Mentions légales + Pied de page</p>
          <p>• <strong>Bons de retour :</strong> Politique de retour + Mentions légales + Pied de page</p>
        </div>
      </div>
    </div>
  );
};

export default LegalSettings;