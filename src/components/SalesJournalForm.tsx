import React from 'react';
import {
  ArrowLeft,
  Download,
  CheckCircle,
  Printer
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
    <div className="max-w-7xl mx-auto print:max-w-none print:mx-0">
      <div className="print:hidden mb-6">
        <div className="flex items-center justify-between">
            <button
              onClick={onClose}
              className="flex items-center space-x-2 text-gray-600 hover:text-gray-900 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Retour aux journaux</span>
            </button>
            <div className="flex items-center space-x-4">
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

      <div className="bg-white print:shadow-none print:p-0 p-4">
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

        <div className="flex justify-between items-start p-4 print:p-0">
          <div className="totals-section print:w-[45%]">
            <table className="w-full border border-gray-300 print:border-black">
              <tbody>
                <tr className="border-b border-gray-300 print:border-black">
                  <td className="p-2 print:p-1 font-bold">Taux Base</td>
                  <td className="p-2 print:p-1 font-bold">Montant</td>
                </tr>
                {journal.totals.taxBreakdown.map((tax) => (
                  <tr key={tax.rate} className="border-b border-gray-300 print:border-black">
                    <td className="p-2 print:p-1">{tax.rate}%</td>
                    <td className="p-2 print:p-1 text-right font-mono">{formatCurrency(tax.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="totals-section print:w-[45%]">
            <table className="w-full border border-gray-300 print:border-black">
              <tbody>
                <tr className="border-b border-gray-300 print:border-black">
                  <td className="p-2 print:p-1 font-bold">Total HT</td>
                  <td className="p-2 print:p-1 text-right font-mono">{formatCurrency(totals.totalHT)}</td>
                </tr>
                <tr className="border-b border-gray-300 print:border-black">
                  <td className="p-2 print:p-1 font-bold">Total TTC Brut</td>
                  <td className="p-2 print:p-1 text-right font-mono">{formatCurrency(totals.totalTTC)}</td>
                </tr>
                <tr className="border-b border-gray-300 print:border-black">
                  <td className="p-2 print:p-1 font-bold">Total Remises TTC</td>
                  <td className="p-2 print:p-1 text-right font-mono">{formatCurrency(0)}</td>
                </tr>
                <tr>
                  <td className="p-2 print:p-1 font-bold">NET TTC</td>
                  <td className="p-2 print:p-1 text-right font-bold font-mono">{formatCurrency(totals.totalTTC)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div className="amount-in-words mt-4">
          <p>
            Arrêté la présente journée au montant TTC de : {numberToFrenchWords(totals.totalTTC)}
          </p>
        </div>

        <div className="page-number">
          <p>Page : 1</p>
        </div>
      </div>
    </div>
  );
};

export default SalesJournalForm;