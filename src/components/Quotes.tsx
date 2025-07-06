import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus,
  Edit,
  Eye,
  Search,
  FileText,
  Clock,
  CheckCircle,
  X,
  TrendingUp,
  Loader2,
  XCircle,
} from 'lucide-react';
import { quoteService } from '../services/quoteService';
import { Quote } from '../types';
import { formatCurrency, formatDate } from '../utils/formatters';
import { toast, Toaster } from 'react-hot-toast';

const Quotes: React.FC = () => {
  const navigate = useNavigate();
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedQuote, setSelectedQuote] = useState<Quote | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    total: 0,
    draft: 0,
    sent: 0,
    accepted: 0,
    rejected: 0,
    expired: 0,
    totalValue: 0
  });

  useEffect(() => {
    loadQuotes();
    checkExpiredQuotes();
  }, []);

  const loadQuotes = async () => {
    try {
      setLoading(true);
      const loadedQuotes = await quoteService.getQuotes();

      const activeQuotes = loadedQuotes.filter(quote => quote.status !== 'deleted');
      setQuotes(activeQuotes);

      const stats = {
        total: activeQuotes.length,
        draft: activeQuotes.filter(q => q.status === 'draft').length,
        sent: activeQuotes.filter(q => q.status === 'sent').length,
        accepted: activeQuotes.filter(q => q.status === 'accepted').length,
        rejected: activeQuotes.filter(q => q.status === 'rejected').length,
        expired: activeQuotes.filter(q => q.status === 'expired').length,
        totalValue: activeQuotes.reduce((sum, q) => sum + q.total, 0)
      };
      setStats(stats);
    } catch (error) {
      toast.error('Erreur lors du chargement des devis');
      console.error('Error loading quotes:', error);
    } finally {
      setLoading(false);
    }
  };

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
    navigate('/quotes/new');
  };

  const handleEditQuote = (quote: Quote) => {
    navigate(`/quotes/${quote.id}`);
  };

  const handleCancelQuote = async (quoteId: string) => {
    if (window.confirm('Êtes-vous sûr de vouloir annuler ce devis ?')) {
      try {
        await quoteService.cancelQuote(quoteId);
        toast.success('Devis annulé avec succès');
        await loadQuotes();
      } catch (error) {
        console.error('Error cancelling quote:', error);
        toast.error('Erreur lors de l\'annulation du devis');
      }
    }
  };



  const handleAcceptQuote = async (quoteId: string) => {
    try {
      await quoteService.acceptQuote(quoteId);
      await loadQuotes();
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

      // Navigate to invoice form with the quote data
      navigate('/invoices/create', { state: { sourceQuote: quote } });
    } catch (error) {
      console.error('Error converting quote to invoice:', error);
      toast.error('Erreur lors de la conversion du devis en facture');
    }
  };

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
      case 'cancelled':
        return 'bg-orange-100 text-orange-800';
      default:
        return 'bg-gray-100 text-gray-800';
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
      case 'cancelled':
        return 'Annulé';
      default:
        return status;
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
      <div className="flex-none space-y-2">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center space-y-4 sm:space-y-0 bg-white px-6 py-4 border-b">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Devis</h1>
            <p className="text-sm text-gray-600">Gérez vos devis et suivez leur statut</p>
          </div>

          <button
            onClick={handleCreateQuote}
            className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>Nouveau devis</span>
          </button>
        </div>

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
                  <p className="text-xs font-medium text-gray-600">Acceptés</p>
                  <p className="text-lg font-bold text-green-600">{stats.accepted}</p>
                </div>
                <div className="p-2 bg-green-100 rounded-full">
                  <CheckCircle className="w-4 h-4 text-green-600" />
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-gray-600">En attente</p>
                  <p className="text-lg font-bold text-blue-600">{stats.sent}</p>
                </div>
                <div className="p-2 bg-blue-100 rounded-full">
                  <Clock className="w-4 h-4 text-blue-600" />
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

        <div className="px-6">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type="text"
                  placeholder="Rechercher par numéro, client..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="all">Tous les statuts</option>
                <option value="draft">Brouillon</option>
                <option value="sent">Envoyé</option>
                <option value="accepted">Accepté</option>
                <option value="rejected">Rejeté</option>
                <option value="expired">Expiré</option>
                <option value="cancelled">Annulé</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 px-6 overflow-hidden mt-4">
        <div className="h-full bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden flex flex-col">
          <div className="flex-none">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th scope="col" className="sticky top-0 px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider w-32 bg-gray-50">
                    Numéro
                  </th>
                  <th scope="col" className="sticky top-0 px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider w-64 bg-gray-50">
                    Client
                  </th>
                  <th scope="col" className="sticky top-0 px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider w-40 bg-gray-50">
                    Date
                  </th>
                  <th scope="col" className="sticky top-0 px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider w-40 bg-gray-50">
                    Validité
                  </th>
                  <th scope="col" className="sticky top-0 px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider w-32 bg-gray-50">
                    Statut
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

          <div className="flex-1 overflow-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredQuotes.map((quote) => (
                  <tr key={quote.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap w-32">
                      <div className="text-sm font-medium text-gray-900 text-center">
                        #{quote.number}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap w-64">
                      <div className="flex flex-col items-center text-center">
                        <div className="text-sm text-gray-900">
                          {quote.customer.name}
                        </div>
                        {quote.customer.company && (
                          <div className="text-sm text-gray-500 truncate max-w-xs">
                            {quote.customer.company}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 w-40 text-center">
                      {formatDate(quote.date)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 w-40 text-center">
                      {formatDate(quote.validUntil)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap w-32">
                      <div className="flex justify-center">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(quote.status)}`}>
                          {getStatusLabel(quote.status)}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 w-40 text-center">
                      {formatCurrency(quote.total)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap w-32">
                      <div className="flex justify-center space-x-2">
                        <button
                          onClick={() => handleEditQuote(quote)}
                          className="text-blue-600 hover:text-blue-900"
                          title="Modifier"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setSelectedQuote(quote)}
                          className="text-green-600 hover:text-green-900"
                          title="Voir détails"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleCancelQuote(quote.id)}
                          className="text-red-600 hover:text-red-900"
                          title="Annuler"
                        >
                          <XCircle className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}

                {filteredQuotes.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-6 py-4 text-center text-gray-500">
                      Aucun devis trouvé
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {selectedQuote && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-start mb-6">
                <h2 className="text-2xl font-bold text-gray-900">
                  Devis {selectedQuote.number}
                </h2>
                <button
                  onClick={() => setSelectedQuote(null)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              {/* Quote Details */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">Informations client</h3>
                  <div className="space-y-2">
                    <p><strong>Nom:</strong> {selectedQuote.customer.name}</p>
                    {selectedQuote.customer.company && (
                      <p><strong>Société:</strong> {selectedQuote.customer.company}</p>
                    )}
                    <p><strong>Email:</strong> {selectedQuote.customer.email}</p>
                    <p><strong>Adresse:</strong> {selectedQuote.customer.address}</p>
                    <p><strong>Ville:</strong> {selectedQuote.customer.city}</p>
                  </div>
                </div>

                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">Détails du devis</h3>
                  <div className="space-y-2">
                    <p><strong>Date:</strong> {formatDate(selectedQuote.date)}</p>
                    <p><strong>Validité:</strong> {formatDate(selectedQuote.validUntil)}</p>
                    <p><strong>Statut:</strong>
                      <span className={`ml-2 inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(selectedQuote.status)}`}>
                        {getStatusLabel(selectedQuote.status)}
                      </span>
                    </p>
                  </div>
                </div>
              </div>

              {/* Items */}
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-3">Articles</h3>
                <div className="overflow-x-auto">
                  <table className="w-full border border-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                          Description
                        </th>
                        <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">
                          Quantité
                        </th>
                        <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">
                          Prix unitaire
                        </th>
                        <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">
                          Total
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {selectedQuote.items.map((item, index) => (
                        <tr key={index}>
                          <td className="px-4 py-2 text-sm text-gray-900">
                            {item.description}
                          </td>
                          <td className="px-4 py-2 text-sm text-gray-900 text-right">
                            {item.quantity}
                          </td>
                          <td className="px-4 py-2 text-sm text-gray-900 text-right">
                            {formatCurrency(item.unitPrice)}
                          </td>
                          <td className="px-4 py-2 text-sm text-gray-900 text-right">
                            {formatCurrency(item.total)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Totals */}
              <div className="flex justify-end">
                <div className="w-64 space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Sous-total HT:</span>
                    <span className="text-sm font-medium text-gray-900">
                      {formatCurrency(selectedQuote.subtotal)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">TVA:</span>
                    <span className="text-sm font-medium text-gray-900">
                      {formatCurrency(selectedQuote.tax)}
                    </span>
                  </div>
                  <div className="flex justify-between border-t pt-2">
                    <span className="text-base font-semibold text-gray-900">Total TTC:</span>
                    <span className="text-base font-semibold text-gray-900">
                      {formatCurrency(selectedQuote.total)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="mt-8 flex justify-end space-x-3">
                {selectedQuote.status === 'sent' && (
                  <>
                    <button
                      onClick={() => handleAcceptQuote(selectedQuote.id)}
                      className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                    >
                      Accepter
                    </button>
                    <button
                      onClick={() => handleRejectQuote(selectedQuote.id)}
                      className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
                    >
                      Rejeter
                    </button>
                  </>
                )}
                {selectedQuote.status === 'accepted' && (
                  <button
                    onClick={() => handleConvertToInvoice(selectedQuote)}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  >
                    Convertir en facture
                  </button>
                )}
                <button
                  onClick={() => handleEditQuote(selectedQuote)}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Modifier
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

export default Quotes;