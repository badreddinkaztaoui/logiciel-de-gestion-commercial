import React from 'react';
import {
  ArrowLeft,
  Download,
  CheckCircle,
  Printer,
  Save
} from 'lucide-react';
import { SalesJournal } from '../types';
import { formatCurrency, numberToFrenchWords } from '../utils/formatters';
import '../styles/print.css';

interface SalesJournalFormProps {
  journal: SalesJournal;
  onClose: () => void;
  onValidate: (journal: SalesJournal) => void;
  onExport: (journal: SalesJournal) => void;
}

const SalesJournalForm: React.FC<SalesJournalFormProps> = ({
  journal,
  onClose,
  onValidate,
  onExport
}) => {
  const handleValidate = () => {
    if (window.confirm(`Valider le journal ${journal.number} ? Cette action est irréversible.`)) {
      onValidate(journal);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const date = new Date(journal.date);
  const dayNames = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
  const dayName = dayNames[date.getDay()];
  const formattedDate = date.toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });

  const totals = {
    totalHT: journal.totals.totalHT,
    totalTVA: journal.totals.totalTTC - journal.totals.totalHT,
    totalTTC: journal.totals.totalTTC,
    taxBreakdown: journal.totals.taxBreakdown
  };

  return (
    <div className="h-screen flex flex-col overflow-hidden pb-20">
      {/* Header */}
      <div className="flex-none p-6 bg-white border-b">
        <div className="flex items-center justify-between">
          <div>
            <button
              onClick={onClose}
              className="flex items-center space-x-2 text-gray-600 hover:text-gray-900 mb-4 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Retour aux journaux</span>
            </button>
            <h1 className="text-3xl font-bold text-gray-900">
              Journal de vente #{journal.number}
            </h1>
            <p className="text-gray-600 mt-1">
              {dayName} {formattedDate}
            </p>
          </div>
          <div className="flex items-center space-x-3">
            <button
              onClick={handlePrint}
              className="flex items-center space-x-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
            >
              <Printer className="w-4 h-4" />
              <span>Imprimer</span>
            </button>
            <button
              onClick={() => onExport(journal)}
              className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
            >
              <Download className="w-4 h-4" />
              <span>Exporter</span>
            </button>
            {journal.status === 'draft' && (
              <button
                onClick={handleValidate}
                className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <CheckCircle className="w-4 h-4" />
                <span>Valider</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Journal Content */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="text-center mb-8">
              <h1 className="text-2xl font-bold uppercase">
                FACTURE / JOURNAL DE VENTE GEPRONET DU {dayName} {formattedDate}
              </h1>
              <div className="document-info mt-4 flex justify-between items-center">
                <div>
                  <p className="font-bold">N° de Facture Magasin</p>
                  <p>{journal.number}</p>
                </div>
                <div>
                  <p className="font-bold">Date</p>
                  <p>{formattedDate}</p>
                </div>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b-2 border-gray-800">
                    <th className="text-left p-2 w-1/6">Référence</th>
                    <th className="text-left p-2 w-2/6">Désignation</th>
                    <th className="text-right p-2 w-1/12">Qté</th>
                    <th className="text-right p-2 w-1/8">P.U. H.T</th>
                    <th className="text-right p-2 w-1/8">Net H.T</th>
                    <th className="text-right p-2 w-1/12">T.V.A %</th>
                    <th className="text-right p-2 w-1/8">Montant T.V.A</th>
                  </tr>
                </thead>
                <tbody>
                  {journal.lines.map((line) => (
                    <tr key={line.id} className="border-b border-gray-300">
                      <td className="p-2">{line.sku}</td>
                      <td className="p-2">{line.productName}</td>
                      <td className="p-2 text-right">{line.quantity}</td>
                      <td className="p-2 text-right">{formatCurrency(line.unitPriceHT)}</td>
                      <td className="p-2 text-right">{formatCurrency(line.totalHT)}</td>
                      <td className="p-2 text-right">{line.taxRate}%</td>
                      <td className="p-2 text-right">{formatCurrency(line.taxAmount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex justify-between items-start mt-8 space-x-6">
              <div className="flex-1">
                <table className="w-full border border-gray-300">
                  <tbody>
                    <tr className="border-b border-gray-300">
                      <td className="p-2 font-bold">Taux Base</td>
                      <td className="p-2 font-bold">Montant</td>
                    </tr>
                    {journal.totals.taxBreakdown.map((tax) => (
                      <tr key={tax.rate} className="border-b border-gray-300">
                        <td className="p-2">{tax.rate}%</td>
                        <td className="p-2 text-right font-mono">{formatCurrency(tax.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex-1">
                <table className="w-full border border-gray-300">
                  <tbody>
                    <tr className="border-b border-gray-300">
                      <td className="p-2 font-bold">Total HT</td>
                      <td className="p-2 text-right font-mono">{formatCurrency(totals.totalHT)}</td>
                    </tr>
                    <tr className="border-b border-gray-300">
                      <td className="p-2 font-bold">Total TTC Brut</td>
                      <td className="p-2 text-right font-mono">{formatCurrency(totals.totalTTC)}</td>
                    </tr>
                    <tr className="border-b border-gray-300">
                      <td className="p-2 font-bold">Total Remises TTC</td>
                      <td className="p-2 text-right font-mono">{formatCurrency(0)}</td>
                    </tr>
                    <tr>
                      <td className="p-2 font-bold">NET TTC</td>
                      <td className="p-2 text-right font-bold font-mono">{formatCurrency(totals.totalTTC)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            <div className="mt-8 p-4 bg-gray-50 rounded-lg border border-gray-200">
              <p className="text-gray-700">
                Arrêté la présente journée au montant TTC de : {numberToFrenchWords(totals.totalTTC)}
              </p>
            </div>

            <div className="mt-4 text-right text-sm text-gray-500">
              <p>Page : 1</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SalesJournalForm;