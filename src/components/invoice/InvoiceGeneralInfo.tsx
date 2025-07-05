import React from 'react';
import { Invoice } from '../../types/index';

interface InvoiceGeneralInfoProps {
  formData: Partial<Invoice>;
  onFieldChange: (field: string, value: any) => void;
}

const InvoiceGeneralInfo: React.FC<InvoiceGeneralInfoProps> = ({
  formData,
  onFieldChange
}) => {
  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <h2 className="text-lg font-semibold text-gray-900 mb-6">Informations générales</h2>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Numéro de facture
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
            Date de facture
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
            Date d'échéance
          </label>
          <input
            type="date"
            value={formData.dueDate}
            onChange={(e) => onFieldChange('dueDate', e.target.value)}
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
          <option value="sent">Envoyée</option>
          <option value="paid">Payée</option>
          <option value="overdue">En retard</option>
        </select>
      </div>
    </div>
  );
};

export default InvoiceGeneralInfo;