import React from 'react';
import { Quote } from '../../types/index';

interface QuoteGeneralInfoProps {
  formData: Partial<Quote>;
  onFieldChange: (field: string, value: any) => void;
}

const QuoteGeneralInfo: React.FC<QuoteGeneralInfoProps> = ({
  formData,
  onFieldChange
}) => {
  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <h2 className="text-lg font-semibold text-gray-900 mb-6">Informations générales</h2>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Numéro de devis
          </label>
          <input
            type="text"
            value={formData.number || 'Sera généré lors de la sauvegarde'}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-500 cursor-not-allowed"
            disabled
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Date du devis
          </label>
          <input
            type="date"
            value={formData.date}
            onChange={(e) => onFieldChange('date', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Valide jusqu'au
          </label>
          <input
            type="date"
            value={formData.validUntil}
            onChange={(e) => onFieldChange('validUntil', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            required
          />
        </div>
      </div>

      <div className="mt-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Statut
        </label>
        <select
          value={formData.status}
          onChange={(e) => onFieldChange('status', e.target.value)}
          className="w-full max-w-xs px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        >
          <option value="draft">Brouillon</option>
          <option value="sent">Envoyé</option>
          <option value="accepted">Accepté</option>
          <option value="rejected">Rejeté</option>
          <option value="expired">Expiré</option>
        </select>
      </div>
    </div>
  );
};

export default QuoteGeneralInfo;