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
  Receipt,
  Shield,
  Loader2,
  X
} from 'lucide-react';
import { toast, Toaster } from 'react-hot-toast';
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
      toast.error('Veuillez sélectionner une date');
      return;
    }

    try {
      const [year, month, day] = selectedDate.split('-');
      const formattedDate = `${day}/${month}/${year}`;

      const exists = await salesJournalService.journalExistsForDate(selectedDate);
      if (exists) {
        toast.error(`Un journal existe déjà pour le ${formatDate(selectedDate)}. Impossible d'en créer un nouveau.`);
        return;
      }

      const { journal, ordersFound } = await salesJournalService.generateSalesJournal(formattedDate);

      if (!ordersFound) {
        toast(() => (
          <div className="flex items-center">
            <AlertCircle className="w-5 h-5 text-orange-500 mr-2" />
            <span>Aucune commande trouvée pour le {formatDate(selectedDate)}</span>
          </div>
        ), {
          style: {
            borderRadius: '10px',
            background: '#fff8ed',
            color: '#9a3412',
            border: '1px solid #fed7aa',
          },
        });
        return;
      }

      const savedJournal = await salesJournalService.saveSalesJournal(journal!);
      setSelectedJournal(savedJournal);
      setShowForm(true);
      await loadJournals();

      toast.success('Journal de vente créé avec succès');
    } catch (error) {
      console.error('Error creating sales journal:', error);
      toast.error('Erreur lors de la création du journal de vente');
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

      const csvContent = exportData.csvData.map(row =>
        row.map(field => `"${field}"`).join(',')
      ).join('\n');

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
        toast.success('Journal validé avec succès');
        await loadJournals();
      } catch (error) {
        console.error('Error validating journal:', error);
        toast.error(error instanceof Error ? error.message : 'Erreur lors de la validation du journal');
      }
    }
  };

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
      <div className="h-full flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <Toaster position="top-right" />
      {/* Fixed Header Section */}
      <div className="flex-none space-y-2">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center space-y-4 sm:space-y-0 bg-white px-6 py-4 border-b">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Journal de vente</h1>
            <p className="text-sm text-gray-600">Gérez vos journaux de vente et exportez-les pour la comptabilité</p>
          </div>

          <div className="flex items-center space-x-2">
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            <button
              onClick={handleCreateJournal}
              className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>Nouveau journal</span>
            </button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="px-6">
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-gray-600">Total</p>
                  <p className="text-lg font-bold text-gray-900">{stats.total}</p>
                </div>
                <div className="p-2 bg-blue-100 rounded-full">
                  <FileText className="w-4 h-4 text-blue-600" />
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-gray-600">Validés</p>
                  <p className="text-lg font-bold text-green-600">{stats.validated}</p>
                </div>
                <div className="p-2 bg-green-100 rounded-full">
                  <CheckCircle className="w-4 h-4 text-green-600" />
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-gray-600">Lignes</p>
                  <p className="text-lg font-bold text-blue-600">{stats.totalLines}</p>
                </div>
                <div className="p-2 bg-blue-100 rounded-full">
                  <Receipt className="w-4 h-4 text-blue-600" />
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-gray-600">Valeur totale</p>
                  <p className="text-lg font-bold text-gray-900">{formatCurrency(stats.totalValue)}</p>
                </div>
                <div className="p-2 bg-purple-100 rounded-full">
                  <TrendingUp className="w-4 h-4 text-purple-600" />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="px-6">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type="text"
                  placeholder="Rechercher par numéro, date..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Scrollable Table Section */}
      <div className="flex-1 px-6 overflow-hidden mt-4">
        <div className="h-full bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden flex flex-col">
          {/* Fixed Table Header */}
          <div className="flex-none">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th scope="col" className="sticky top-0 px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider w-32 bg-gray-50">
                    Numéro
                  </th>
                  <th scope="col" className="sticky top-0 px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider w-40 bg-gray-50">
                    Date
                  </th>
                  <th scope="col" className="sticky top-0 px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider w-32 bg-gray-50">
                    Statut
                  </th>
                  <th scope="col" className="sticky top-0 px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider w-32 bg-gray-50">
                    Lignes
                  </th>
                  <th scope="col" className="sticky top-0 px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider w-40 bg-gray-50">
                    Total
                  </th>
                  <th scope="col" className="sticky top-0 px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider w-32 bg-gray-50">
                    Actions
                  </th>
                </tr>
              </thead>
            </table>
          </div>

          {/* Scrollable Table Body */}
          <div className="flex-1 overflow-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredJournals.map((journal) => (
                  <tr key={journal.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap w-32">
                      <div className="text-sm font-medium text-gray-900 text-center">
                        #{journal.number}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 w-40 text-center">
                      {formatDate(journal.date)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap w-32">
                      <div className="flex justify-center">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(journal.status)}`}>
                          {getStatusLabel(journal.status)}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 w-32 text-center">
                      {journal.lines.length}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 w-40 text-center">
                      {formatCurrency(journal.totals.totalTTC)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap w-32">
                      <div className="flex justify-center space-x-2">
                        <button
                          onClick={() => handleViewJournal(journal)}
                          className="text-blue-600 hover:text-blue-900"
                          title="Voir détails"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        {journal.status !== 'validated' && (
                          <button
                            onClick={() => handleValidateJournal(journal)}
                            className="text-green-600 hover:text-green-900"
                            title="Valider"
                          >
                            <Shield className="w-4 h-4" />
                          </button>
                        )}
                        <button
                          onClick={() => handleExportJournal(journal)}
                          className="text-purple-600 hover:text-purple-900"
                          title="Exporter"
                        >
                          <Download className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}

                {filteredJournals.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-6 py-4 text-center text-gray-500">
                      Aucun journal trouvé
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Form Modal */}
      {showForm && selectedJournal && (
        <SalesJournalForm
          journal={selectedJournal}
          onClose={handleCloseForm}
          onValidate={handleValidateJournal}
          onExport={handleExportJournal}
        />
      )}
    </div>
  );
};

export default SalesJournalComponent;