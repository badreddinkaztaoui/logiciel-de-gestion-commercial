import React, { useState, useEffect } from 'react';
import {
  Plus,
  Eye,
  Download,
  Search,
  Calendar,
  FileText,
  TrendingUp,
  AlertCircle,
  CheckCircle,
  Percent,
  Receipt,
  Shield
} from 'lucide-react';
import { salesJournalService } from '../services/salesJournalService';
import { SalesJournal } from '../types';
import { formatCurrency, formatDate } from '../utils/formatters';
import SalesJournalForm from './SalesJournalForm';

const SalesJournalComponent: React.FC = () => {
  const [journals, setJournals] = useState<SalesJournal[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [selectedJournal, setSelectedJournal] = useState<SalesJournal | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    total: 0,
    validated: 0,
    totalValue: 0,
    totalLines: 0
  });

  useEffect(() => {
    loadJournals();
  }, []);

  const loadJournals = async () => {
    try {
      setLoading(true);
      const savedJournals = await salesJournalService.getSalesJournals();
      setJournals(savedJournals.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));

      // Load stats
      const journalStats = await salesJournalService.getJournalStats();
      setStats(journalStats);
    } catch (error) {
      console.error('Error loading sales journals:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredJournals = journals.filter(journal => {
    const searchLower = searchTerm.toLowerCase();
    return (
      journal.number.toLowerCase().includes(searchLower) ||
      journal.date.includes(searchTerm) ||
      journal.notes?.toLowerCase().includes(searchLower)
    );
  });

  const handleCreateJournal = async () => {
    if (!selectedDate) {
      alert('Veuillez sélectionner une date');
      return;
    }

    try {
      // Check if journal already exists for this date
      const exists = await salesJournalService.journalExistsForDate(selectedDate);
      if (exists) {
        alert(`Un journal existe déjà pour le ${formatDate(selectedDate)}. Impossible d'en créer un nouveau.`);
        return;
      }

      const newJournal = await salesJournalService.generateSalesJournal(selectedDate);

      if (newJournal.lines.length === 0) {
        alert(`Aucune commande trouvée pour le ${formatDate(selectedDate)}`);
        return;
      }

      const savedJournal = await salesJournalService.saveSalesJournal(newJournal);
      setSelectedJournal(savedJournal);
      setShowForm(true);
      await loadJournals();
    } catch (error) {
      console.error('Error creating sales journal:', error);
      alert('Erreur lors de la création du journal de vente');
    }
  };

  const handleViewJournal = (journal: SalesJournal) => {
    setSelectedJournal(journal);
    setShowForm(true);
  };

  const handleCloseForm = () => {
    setShowForm(false);
    setSelectedJournal(null);
    loadJournals();
  };

  const handleExportJournal = async (journal: SalesJournal) => {
    try {
      const exportData = await salesJournalService.exportJournalForAccounting(journal.id);
      if (!exportData) return;

      // Create CSV content
      const csvContent = exportData.csvData.map(row =>
        row.map(field => `"${field}"`).join(',')
      ).join('\n');

      // Download CSV file
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `journal-vente-${journal.number}-${journal.date}.csv`;
      link.click();
    } catch (error) {
      console.error('Error exporting journal:', error);
      alert('Erreur lors de l\'exportation du journal');
    }
  };

  const handleValidateJournal = async (journal: SalesJournal) => {
    if (window.confirm(`Valider le journal ${journal.number} ? Cette action est irréversible.`)) {
      try {
        await salesJournalService.validateJournal(journal.id);
        await loadJournals();
      } catch (error) {
        console.error('Error validating journal:', error);
        alert('Erreur lors de la validation du journal');
      }
    }
  };

  // Calculate total exempt products across all journals
  const getExemptProductsTotal = () => {
    let totalExemptTTC = 0;
    let totalExemptLines = 0;

    journals.forEach(journal => {
      const exemptLines = journal.lines.filter(line => line.taxRate === 0);
      totalExemptTTC += exemptLines.reduce((sum, line) => sum + line.totalTTC, 0);
      totalExemptLines += exemptLines.length;
    });

    return {
      totalTTC: totalExemptTTC,
      linesCount: totalExemptLines
    };
  };

  const exemptStats = getExemptProductsTotal();

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'validated':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'draft':
        return <AlertCircle className="w-4 h-4 text-orange-500" />;
      default:
        return <FileText className="w-4 h-4 text-gray-500" />;
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'validated':
        return 'Validé';
      case 'draft':
        return 'Brouillon';
      default:
        return status;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'validated':
        return 'bg-green-100 text-green-800';
      case 'draft':
        return 'bg-orange-100 text-orange-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Chargement des journaux de vente...</p>
        </div>
      </div>
    );
  }

  if (showForm && selectedJournal) {
    return (
      <SalesJournalForm
        journal={selectedJournal}
        onClose={handleCloseForm}
        onValidate={handleValidateJournal}
        onExport={handleExportJournal}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center space-y-4 sm:space-y-0">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Journal de vente</h1>
          <p className="text-gray-600">Génération automatique des journaux de vente par date</p>
        </div>

        <div className="flex items-center space-x-3">
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
          <button
            onClick={handleCreateJournal}
            disabled={!selectedDate}
            className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>Créer journal</span>
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <Receipt className="w-8 h-8 text-blue-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Journaux totaux</p>
              <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <CheckCircle className="w-8 h-8 text-green-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Validés</p>
              <p className="text-2xl font-bold text-gray-900">{stats.validated}</p>
            </div>
          </div>
        </div>

        {/* NEW: Tax-Exempt Products Total Card */}
        <div className="bg-white rounded-lg shadow-sm border border-red-200 p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <Shield className="w-8 h-8 text-red-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-red-600">Ventes exonérées</p>
              <p className="text-2xl font-bold text-red-700">{formatCurrency(exemptStats.totalTTC)}</p>
              <p className="text-xs text-red-500 mt-1">{exemptStats.linesCount} lignes</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <TrendingUp className="w-8 h-8 text-green-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Valeur totale</p>
              <p className="text-2xl font-bold text-gray-900">{formatCurrency(stats.totalValue)}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <FileText className="w-8 h-8 text-gray-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Lignes totales</p>
              <p className="text-2xl font-bold text-gray-900">{stats.totalLines}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="flex">
        <div className="relative flex-1">
          <Search className="w-5 h-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Rechercher journaux..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 pr-4 py-2 w-full border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
      </div>

      {/* Journals List */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Journal
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Statut
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Commandes
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Lignes
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Ventes exonérées
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Total HT
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Total TTC
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredJournals.map((journal) => {
                const exemptLines = journal.lines.filter(line => line.taxRate === 0);
                const exemptTotal = exemptLines.reduce((sum, line) => sum + line.totalTTC, 0);

                return (
                  <tr key={journal.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="flex-shrink-0 h-10 w-10 bg-blue-100 rounded-full flex items-center justify-center">
                          <Receipt className="w-6 h-6 text-blue-600" />
                        </div>
                        <div className="ml-4">
                          <div className="text-sm font-medium text-gray-900">{journal.number}</div>
                          <div className="text-xs text-gray-500">
                            Créé le {formatDate(journal.createdAt)}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center text-sm text-gray-900">
                        <Calendar className="w-4 h-4 mr-2 text-gray-500" />
                        {formatDate(journal.date)}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        {getStatusIcon(journal.status)}
                        <span className={`ml-2 inline-flex px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(journal.status)}`}>
                          {getStatusLabel(journal.status)}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {journal.ordersIncluded.length}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {journal.lines.length}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {exemptTotal > 0 ? (
                        <div className="flex items-center">
                          <Shield className="w-4 h-4 text-red-500 mr-1" />
                          <div>
                            <div className="text-sm font-medium text-red-600">{formatCurrency(exemptTotal)}</div>
                            <div className="text-xs text-red-500">{exemptLines.length} lignes</div>
                          </div>
                        </div>
                      ) : (
                        <span className="text-sm text-gray-400">-</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {formatCurrency(journal.totals.totalHT)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-blue-600">
                      {formatCurrency(journal.totals.totalTTC)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => handleViewJournal(journal)}
                          className="text-blue-600 hover:text-blue-900 p-1 hover:bg-blue-50 rounded"
                          title="Voir détails"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleExportJournal(journal)}
                          className="text-green-600 hover:text-green-900 p-1 hover:bg-green-50 rounded"
                          title="Exporter CSV"
                        >
                          <Download className="w-4 h-4" />
                        </button>
                        {journal.status === 'draft' && (
                          <button
                            onClick={() => handleValidateJournal(journal)}
                            className="text-orange-600 hover:text-orange-900 p-1 hover:bg-orange-50 rounded"
                            title="Valider"
                          >
                            <CheckCircle className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {filteredJournals.length === 0 && (
          <div className="text-center py-12">
            <Receipt className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">Aucun journal trouvé</h3>
            <p className="text-gray-500 mb-4">
              {journals.length === 0
                ? "Créez votre premier journal de vente en sélectionnant une date"
                : "Aucun journal ne correspond à vos critères de recherche"
              }
            </p>
            {journals.length === 0 && selectedDate && (
              <button
                onClick={handleCreateJournal}
                className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                <Plus className="w-4 h-4 mr-2" />
                Créer pour le {formatDate(selectedDate)}
              </button>
            )}
          </div>
        )}
      </div>

      {/* Info Box */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start space-x-3">
          <AlertCircle className="w-5 h-5 text-blue-500 mt-0.5" />
          <div>
            <h4 className="font-medium text-blue-900">À propos du journal de vente</h4>
            <div className="text-sm text-blue-700 mt-1 space-y-1">
              <p>• Le journal de vente extrait automatiquement toutes les lignes de commandes pour une date donnée</p>
              <p>• Chaque ligne contient : SKU, nom du produit, quantité, prix TTC, taux de TVA</p>
              <p>• Les totaux HT et les montants de TVA par taux sont calculés automatiquement</p>
              <p>• <strong>🛡️ Suivi spécial des produits exonérés (0% TVA)</strong> pour déclaration fiscale</p>
              <p>• Export CSV disponible pour l'intégration comptable</p>
              <p>• Un journal validé ne peut plus être modifié</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SalesJournalComponent;