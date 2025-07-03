import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  Edit, 
  Eye, 
  Trash2, 
  Download,
  Search,
  FileText,
  Clock,
  Calendar,
  Users,
  CheckCircle,
  AlertTriangle,
  X,
  TrendingUp,
  Loader2
} from 'lucide-react';
import { quoteService } from '../services/quoteService';
import { invoiceService } from '../services/invoiceService';
import { Quote } from '../types';
import { formatCurrency, formatDate } from '../utils/formatters';
import QuoteForm from './QuoteForm';

const Quotes: React.FC = () => {
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingQuote, setEditingQuote] = useState<Quote | null>(null);
  const [selectedQuote, setSelectedQuote] = useState<Quote | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadQuotes();
    // Check expired quotes on component mount
    checkExpiredQuotes();
  }, []);

  const loadQuotes = async () => {
    try {
      setLoading(true);
      const loadedQuotes = await quoteService.getQuotes();
      setQuotes(loadedQuotes);
    } catch (error) {
      console.error('Error loading quotes:', error);
    } finally {
      setLoading(false);
    }
  };

  // Check expired quotes and update their status
  const checkExpiredQuotes = async () => {
    try {
      const expiredQuotes = await quoteService.checkExpiredQuotes();
      if (expiredQuotes.length > 0) {
        console.log(`${expiredQuotes.length} quotes have expired and been updated`);
      }
    } catch (error) {
      console.error('Error checking expired quotes:', error);
    }
  };

  const handleCreateQuote = () => {
    setEditingQuote(null);
    setShowForm(true);
  };

  const handleEditQuote = (quote: Quote) => {
    setEditingQuote(quote);
    setShowForm(true);
  };

  const handleDeleteQuote = async (quoteId: string) => {
    if (window.confirm('Êtes-vous sûr de vouloir supprimer ce devis ?')) {
      try {
        await quoteService.deleteQuote(quoteId);
        await loadQuotes();
      } catch (error) {
        console.error('Error deleting quote:', error);
        alert('Erreur lors de la suppression du devis');
      }
    }
  };

  const handleSaveQuote = async (quote: Quote) => {
    try {
      await quoteService.saveQuote(quote);
      await loadQuotes();
      setShowForm(false);
      setEditingQuote(null);
    } catch (error) {
      console.error('Error saving quote:', error);
      alert('Erreur lors de la sauvegarde du devis');
    }
  };

  const handleAcceptQuote = async (quoteId: string) => {
    try {
      await quoteService.acceptQuote(quoteId);
      await loadQuotes();
      // Close modal if open
      if (selectedQuote && selectedQuote.id === quoteId) {
        setSelectedQuote(null);
      }
    } catch (error) {
      console.error('Error accepting quote:', error);
      alert('Erreur lors de l\'acceptation du devis');
    }
  };

  const handleRejectQuote = async (quoteId: string) => {
    const reason = prompt('Raison du rejet :');
    if (reason !== null) {
      try {
        await quoteService.rejectQuote(quoteId, reason);
        await loadQuotes();
        // Close modal if open
        if (selectedQuote && selectedQuote.id === quoteId) {
          setSelectedQuote(null);
        }
      } catch (error) {
        console.error('Error rejecting quote:', error);
        alert('Erreur lors du rejet du devis');
      }
    }
  };

  const handleConvertToInvoice = async (quote: Quote) => {
    try {
      if (quote.status !== 'accepted') {
        if (!window.confirm('Ce devis n\'est pas marqué comme accepté. Voulez-vous le convertir en facture quand même ?')) {
          return;
        }
      }
      
      // Create invoice data from quote
      const invoiceData = quoteService.convertToInvoice(quote.id);
      
      // Save new invoice
      await invoiceService.saveInvoice(invoiceData);
      
      alert(`Le devis a été converti en facture avec succès !`);
      
      // Redirect to invoices page
      window.location.href = '#invoices';
    } catch (error) {
      console.error('Error converting quote to invoice:', error);
      alert('Erreur lors de la conversion du devis en facture');
    }
  };

  const handleExportQuote = (quote: Quote) => {
    const exportData = JSON.stringify(quote, null, 2);
    const blob = new Blob([exportData], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `devis-${quote.number}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Filter quotes
  const filteredQuotes = quotes.filter(quote => {
    const matchesSearch = quote.number.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         quote.customer.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         quote.customer.email.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || quote.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'draft':
        return 'bg-gray-100 text-gray-800';
      case 'sent':
        return 'bg-blue-100 text-blue-800';
      case 'accepted':
        return 'bg-green-100 text-green-800';
      case 'rejected':
        return 'bg-red-100 text-red-800';
      case 'expired':
        return 'bg-yellow-100 text-yellow-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'draft':
        return <FileText className="w-4 h-4" />;
      case 'sent':
        return <Clock className="w-4 h-4" />;
      case 'accepted':
        return <CheckCircle className="w-4 h-4" />;
      case 'rejected':
        return <X className="w-4 h-4" />;
      case 'expired':
        return <AlertTriangle className="w-4 h-4" />;
      default:
        return <FileText className="w-4 h-4" />;
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'draft':
        return 'Brouillon';
      case 'sent':
        return 'Envoyé';
      case 'accepted':
        return 'Accepté';
      case 'rejected':
        return 'Rejeté';
      case 'expired':
        return 'Expiré';
      default:
        return status;
    }
  };

  const isQuoteExpired = (validUntil: string) => {
    const now = new Date();
    const expiryDate = new Date(validUntil);
    return now > expiryDate;
  };

  const canBeConverted = (quote: Quote) => {
    return quote.status === 'accepted' || quote.status === 'sent';
  };

  if (showForm) {
    return (
      <QuoteForm
        editingQuote={editingQuote}
        onSave={handleSaveQuote}
        onCancel={() => {
          setShowForm(false);
          setEditingQuote(null);
        }}
      />
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600">Chargement des devis...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center space-y-4 sm:space-y-0">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Devis</h1>
          <p className="text-gray-600">Gérez vos devis et convertissez-les en factures</p>
        </div>

        <button
          onClick={handleCreateQuote}
          className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          <span>Nouveau devis</span>
        </button>
      </div>

      {/* Stats Cards */}
      <StatsCards />

      {/* Filters */}
      <div className="flex flex-col md:flex-row space-y-4 md:space-y-0 md:space-x-4">
        <div className="relative md:flex-grow">
          <Search className="w-5 h-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Rechercher devis..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 pr-4 py-2 w-full border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
        
        <div className="md:w-64">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 appearance-none bg-white"
          >
            <option value="all">Tous les statuts</option>
            <option value="draft">Brouillons</option>
            <option value="sent">Envoyés</option>
            <option value="accepted">Acceptés</option>
            <option value="rejected">Rejetés</option>
            <option value="expired">Expirés</option>
          </select>
        </div>
      </div>

      {/* Quotes List */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Devis
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Client
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Validité
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Statut
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Total
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredQuotes.map((quote) => {
                const isExpired = isQuoteExpired(quote.validUntil) && quote.status !== 'accepted' && quote.status !== 'rejected';
                
                return (
                  <tr key={quote.id} className={`hover:bg-gray-50 ${isExpired ? 'bg-yellow-50' : ''}`}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="flex-shrink-0 h-10 w-10 bg-blue-100 rounded-full flex items-center justify-center">
                          <FileText className="w-6 h-6 text-blue-600" />
                        </div>
                        <div className="ml-4">
                          <div className="text-sm font-medium text-gray-900">{quote.number}</div>
                          <div className="text-xs text-gray-500">
                            Créé le {formatDate(quote.date)}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm font-medium text-gray-900">{quote.customer.name}</div>
                      <div className="text-xs text-gray-500">{quote.customer.email}</div>
                      {quote.customer.company && (
                        <div className="text-xs text-gray-500">{quote.customer.company}</div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center text-sm text-gray-900">
                        <Calendar className="w-4 h-4 mr-2 text-gray-500" />
                        {formatDate(quote.date)}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className={`flex items-center text-sm ${isExpired ? 'text-red-600' : 'text-gray-900'}`}>
                        <Clock className={`w-4 h-4 mr-2 ${isExpired ? 'text-red-500' : 'text-gray-500'}`} />
                        {formatDate(quote.validUntil)}
                        {isExpired && (
                          <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800">
                            Expiré
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        {getStatusIcon(quote.status)}
                        <span className={`ml-2 inline-flex px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(quote.status)}`}>
                          {getStatusLabel(quote.status)}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {formatCurrency(quote.total)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => setSelectedQuote(quote)}
                          className="text-blue-600 hover:text-blue-900 p-1 hover:bg-blue-50 rounded"
                          title="Voir détails"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        {quote.status === 'draft' && (
                          <button
                            onClick={() => handleEditQuote(quote)}
                            className="text-green-600 hover:text-green-900 p-1 hover:bg-green-50 rounded"
                            title="Modifier"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                        )}
                        {canBeConverted(quote) && (
                          <button
                            onClick={() => handleConvertToInvoice(quote)}
                            className="text-purple-600 hover:text-purple-900 p-1 hover:bg-purple-50 rounded"
                            title="Convertir en facture"
                          >
                            <TrendingUp className="w-4 h-4" />
                          </button>
                        )}
                        <button
                          onClick={() => handleDeleteQuote(quote.id)}
                          className="text-red-600 hover:text-red-900 p-1 hover:bg-red-50 rounded"
                          title="Supprimer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {filteredQuotes.length === 0 && (
          <div className="text-center py-12">
            <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">Aucun devis trouvé</h3>
            <p className="text-gray-500 mb-4">
              {quotes.length === 0 
                ? "Créez votre premier devis"
                : "Aucun devis ne correspond à vos critères de recherche"
              }
            </p>
            {quotes.length === 0 && (
              <button
                onClick={handleCreateQuote}
                className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                <Plus className="w-4 h-4 mr-2" />
                Ajouter maintenant
              </button>
            )}
          </div>
        )}
      </div>

      {/* Quote Details Modal */}
      {selectedQuote && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
              <h3 className="text-lg font-semibold">Devis {selectedQuote.number}</h3>
              <div className="flex items-center space-x-3">
                <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(selectedQuote.status)}`}>
                  {getStatusIcon(selectedQuote.status)}
                  <span className="ml-1">{getStatusLabel(selectedQuote.status)}</span>
                </span>
                <button
                  onClick={() => setSelectedQuote(null)}
                  className="text-gray-400 hover:text-gray-600 text-2xl"
                >
                  ×
                </button>
              </div>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                <div>
                  <h4 className="font-medium text-gray-900 mb-3 flex items-center">
                    <Users className="w-4 h-4 mr-2" />
                    Informations client
                  </h4>
                  <div className="space-y-2 text-sm">
                    <p><span className="text-gray-600">Nom:</span> {selectedQuote.customer.name}</p>
                    <p><span className="text-gray-600">Email:</span> {selectedQuote.customer.email}</p>
                    {selectedQuote.customer.company && (
                      <p><span className="text-gray-600">Entreprise:</span> {selectedQuote.customer.company}</p>
                    )}
                    <p><span className="text-gray-600">Adresse:</span> {selectedQuote.customer.address}, {selectedQuote.customer.city}</p>
                  </div>
                </div>
                <div>
                  <h4 className="font-medium text-gray-900 mb-3 flex items-center">
                    <Calendar className="w-4 h-4 mr-2" />
                    Détails devis
                  </h4>
                  <div className="space-y-2 text-sm">
                    <p><span className="text-gray-600">Date:</span> {formatDate(selectedQuote.date)}</p>
                    <p><span className="text-gray-600">Valable jusqu'au:</span> {formatDate(selectedQuote.validUntil)}</p>
                    <p><span className="text-gray-600">Statut:</span> {getStatusLabel(selectedQuote.status)}</p>
                    {isQuoteExpired(selectedQuote.validUntil) && selectedQuote.status !== 'accepted' && selectedQuote.status !== 'rejected' && (
                      <p className="text-red-600 flex items-center">
                        <AlertTriangle className="w-4 h-4 mr-1" />
                        Ce devis a expiré
                      </p>
                    )}
                  </div>
                </div>
              </div>

              <div>
                <h4 className="font-medium text-gray-900 mb-3">Articles</h4>
                <div className="space-y-2">
                  {selectedQuote.items.map((item, index) => (
                    <div key={index} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                      <div>
                        <p className="font-medium text-gray-900">{item.description}</p>
                        <p className="text-sm text-gray-600">Quantité: {item.quantity}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-medium">{formatCurrency(item.total)}</p>
                        <p className="text-xs text-gray-500">({formatCurrency(item.unitPrice)} unité)</p>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-6 p-4 bg-gray-50 rounded-lg">
                  <div className="flex justify-between mb-2">
                    <span className="text-gray-600">Sous-total HT:</span>
                    <span>{formatCurrency(selectedQuote.subtotal)}</span>
                  </div>
                  <div className="flex justify-between mb-2">
                    <span className="text-gray-600">TVA:</span>
                    <span>{formatCurrency(selectedQuote.tax)}</span>
                  </div>
                  <div className="flex justify-between font-bold text-lg border-t border-gray-200 pt-2 mt-2">
                    <span>Total TTC:</span>
                    <span>{formatCurrency(selectedQuote.total)}</span>
                  </div>
                </div>

                {selectedQuote.conditions && (
                  <div className="mt-4 p-3 bg-blue-50 rounded-lg">
                    <h5 className="font-medium text-blue-900 mb-2">Conditions</h5>
                    <p className="text-sm text-blue-800">{selectedQuote.conditions}</p>
                  </div>
                )}

                {selectedQuote.notes && (
                  <div className="mt-4">
                    <h5 className="font-medium text-gray-900 mb-2">Notes</h5>
                    <p className="text-sm bg-gray-50 p-3 rounded-lg">{selectedQuote.notes}</p>
                  </div>
                )}
              </div>

              <div className="mt-8 flex flex-wrap justify-end gap-3">
                {selectedQuote.status === 'draft' && (
                  <button
                    onClick={() => handleEditQuote(selectedQuote)}
                    className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300"
                  >
                    Modifier
                  </button>
                )}

                {canBeConverted(selectedQuote) && (
                  <button
                    onClick={() => handleConvertToInvoice(selectedQuote)}
                    className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
                  >
                    Convertir en facture
                  </button>
                )}

                {selectedQuote.status === 'sent' && (
                  <>
                    <button
                      onClick={() => handleAcceptQuote(selectedQuote.id)}
                      className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                    >
                      Marquer comme accepté
                    </button>
                    <button
                      onClick={() => handleRejectQuote(selectedQuote.id)}
                      className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
                    >
                      Marquer comme rejeté
                    </button>
                  </>
                )}

                <button
                  onClick={() => handleExportQuote(selectedQuote)}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Exporter
                </button>

                <button
                  onClick={() => setSelectedQuote(null)}
                  className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Fermer
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Stats cards component
const StatsCards: React.FC = () => {
  const [stats, setStats] = useState({
    total: 0,
    draft: 0,
    sent: 0,
    accepted: 0,
    rejected: 0,
    expired: 0,
    totalValue: 0,
    acceptedValue: 0,
    pendingValue: 0
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadStats = async () => {
      try {
        setLoading(true);
        const quoteStats = await quoteService.getQuoteStats();
        setStats(quoteStats);
      } catch (error) {
        console.error('Error loading quote stats:', error);
      } finally {
        setLoading(false);
      }
    };

    loadStats();
  }, []);

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {[...Array(4)].map((_, index) => (
          <div key={index} className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 animate-pulse">
            <div className="h-4 bg-gray-200 rounded w-1/3 mb-2"></div>
            <div className="h-6 bg-gray-300 rounded w-1/4"></div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex items-center">
          <div className="flex-shrink-0">
            <FileText className="w-8 h-8 text-blue-600" />
          </div>
          <div className="ml-4">
            <p className="text-sm font-medium text-gray-600">Total devis</p>
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
            <p className="text-sm font-medium text-gray-600">Acceptés</p>
            <p className="text-2xl font-bold text-gray-900">{stats.accepted}</p>
            <p className="text-xs text-green-600 mt-1">
              {formatCurrency(stats.acceptedValue)}
            </p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex items-center">
          <div className="flex-shrink-0">
            <Clock className="w-8 h-8 text-orange-600" />
          </div>
          <div className="ml-4">
            <p className="text-sm font-medium text-gray-600">En attente</p>
            <p className="text-2xl font-bold text-gray-900">{stats.sent}</p>
            <p className="text-xs text-orange-600 mt-1">
              {formatCurrency(stats.pendingValue)}
            </p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex items-center">
          <div className="flex-shrink-0">
            <TrendingUp className="w-8 h-8 text-blue-600" />
          </div>
          <div className="ml-4">
            <p className="text-sm font-medium text-gray-600">Valeur totale</p>
            <p className="text-2xl font-bold text-gray-900">{formatCurrency(stats.totalValue)}</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Quotes;