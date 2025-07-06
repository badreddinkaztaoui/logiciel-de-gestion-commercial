import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus,
  Edit,
  Eye,
  Search,
  FileText,
  Users,
  CheckCircle,
  AlertTriangle,
  X,
  Loader2,
  Truck,
  RefreshCw,
  RotateCcw
} from 'lucide-react';
import { toast, Toaster } from 'react-hot-toast';
import { invoiceService } from '../services/invoiceService';
import { wooCommerceService } from '../services/woocommerce';
import { Invoice } from '../types/index';
import { formatCurrency, formatDate } from '../utils/formatters';

interface InvoiceStats {
  total: number;
  draft: number;
  sent: number;
  paid: number;
  overdue: number;
  totalValue: number;
  paidValue: number;
  pendingValue: number;
}

const Invoices: React.FC = () => {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<InvoiceStats>({
    total: 0,
    draft: 0,
    sent: 0,
    paid: 0,
    overdue: 0,
    totalValue: 0,
    paidValue: 0,
    pendingValue: 0
  });

  const navigate = useNavigate();

  useEffect(() => {
    loadInvoices();
  }, []);

  const loadInvoices = async () => {
    try {
      setLoading(true);
      const loadedInvoices = await invoiceService.getInvoices();
      setInvoices(loadedInvoices);

      // Load stats
      const invoiceStats = await invoiceService.getInvoiceStats();
      setStats(invoiceStats);
    } catch (error) {
      toast.error('Erreur lors du chargement des factures');
      console.error('Error loading invoices:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateInvoice = () => {
    navigate('/invoices/create');
  };

  const handleEditInvoice = (invoice: Invoice) => {
    navigate(`/invoices/edit/${invoice.id}`);
  };

  const handleCancelInvoice = async (id: string) => {
    if (confirm('Êtes-vous sûr de vouloir annuler cette facture ? Les articles seront retournés au stock WooCommerce.')) {
      try {
        const invoice = await invoiceService.getInvoiceById(id);
        if (!invoice) {
          toast.error('Facture introuvable');
          return;
        }

        // Cancel the invoice
        const updatedInvoice = await invoiceService.cancelInvoice(id);

        // Return items to WooCommerce stock if there's a linked order
        if (invoice.orderId && invoice.items.length > 0) {
          let stockUpdatesCount = 0;

          for (const item of invoice.items) {
            if (item.productId) {
              try {
                await wooCommerceService.increaseProductStock(item.productId, item.quantity);
                stockUpdatesCount++;
              } catch (error) {
                console.error(`Error returning stock for product ${item.productId}:`, error);
                // Continue with other items even if one fails
              }
            }
          }

          // Add note to WooCommerce order
          if (stockUpdatesCount > 0) {
            try {
              await wooCommerceService.addOrderNote(
                invoice.orderId,
                `Facture ${invoice.number} annulée - ${stockUpdatesCount} article(s) retourné(s) au stock`,
                true
              );
            } catch (error) {
              console.error('Error adding order note:', error);
            }
          }

          toast.success(`Facture annulée avec succès. ${stockUpdatesCount} article(s) retourné(s) au stock WooCommerce.`);
        } else {
          toast.success('Facture annulée avec succès');
        }

        setInvoices(invoices.map(inv => inv.id === id ? updatedInvoice : inv));
      } catch (error: any) {
        console.error('Error cancelling invoice:', error);
        toast.error(error.message || 'Erreur lors de l\'annulation de la facture');
      }
    }
  };

  const handleCreateDeliveryNote = async (invoiceId: string) => {
    try {
      const invoice = await invoiceService.getInvoiceById(invoiceId);
      if (!invoice) {
        toast.error('Facture introuvable');
        return;
      }

      // Navigate to delivery note form with invoice data
      navigate('/delivery-notes/create', { state: { sourceInvoice: invoice } });
    } catch (error: any) {
      console.error('Error loading invoice:', error);
      toast.error(error.message || 'Erreur lors du chargement de la facture');
    }
  };

  const handleCreateReturnNote = async (invoiceId: string) => {
    try {
      const invoice = await invoiceService.getInvoiceById(invoiceId);
      if (!invoice) {
        toast.error('Facture introuvable');
        return;
      }

      // Navigate to return note form with invoice data
      navigate('/return-notes/create', { state: { sourceInvoice: invoice } });
    } catch (error: any) {
      console.error('Error loading invoice:', error);
      toast.error(error.message || 'Erreur lors du chargement de la facture');
    }
  };

  const canCreateDeliveryNote = (invoice: Invoice) => {
    return invoice.status !== 'cancelled';
  };

  const canCreateReturnNote = (invoice: Invoice) => {
    return invoice.status === 'paid' || invoice.status === 'cancelled';
  };

  const canCancelInvoice = (invoice: Invoice) => {
    return invoice.status !== 'cancelled';
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'draft': return 'bg-gray-100 text-gray-800';
      case 'sent': return 'bg-blue-100 text-blue-800';
      case 'paid': return 'bg-green-100 text-green-800';
      case 'overdue': return 'bg-red-100 text-red-800';
      case 'cancelled': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'draft': return 'Brouillon';
      case 'sent': return 'Envoyée';
      case 'paid': return 'Payée';
      case 'overdue': return 'En retard';
      case 'cancelled': return 'Annulée';
      default: return status;
    }
  };

  const filteredInvoices = invoices.filter(invoice => {
    const matchesSearch = invoice.number.toLowerCase().includes(searchTerm.toLowerCase()) ||
                        invoice.customer.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                        invoice.customer.company?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus = statusFilter === 'all' || invoice.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

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
            <h1 className="text-2xl font-bold text-gray-900">Factures</h1>
            <p className="text-sm text-gray-600">Gérez vos factures et suivez vos paiements</p>
          </div>

          <button
            onClick={handleCreateInvoice}
            className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>Nouvelle facture</span>
          </button>
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
                  <p className="text-xs font-medium text-gray-600">Payées</p>
                  <p className="text-lg font-bold text-green-600">{stats.paid}</p>
                </div>
                <div className="p-2 bg-green-100 rounded-full">
                  <CheckCircle className="w-4 h-4 text-green-600" />
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-gray-600">En retard</p>
                  <p className="text-lg font-bold text-red-600">{stats.overdue}</p>
                </div>
                <div className="p-2 bg-red-100 rounded-full">
                  <AlertTriangle className="w-4 h-4 text-red-600" />
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-gray-600">Brouillons</p>
                  <p className="text-lg font-bold text-gray-600">{stats.draft}</p>
                </div>
                <div className="p-2 bg-gray-100 rounded-full">
                  <FileText className="w-4 h-4 text-gray-600" />
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-gray-600">Envoyées</p>
                  <p className="text-lg font-bold text-blue-600">{stats.sent}</p>
                </div>
                <div className="p-2 bg-blue-100 rounded-full">
                  <Users className="w-4 h-4 text-blue-600" />
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-gray-600">Valeur totale</p>
                  <p className="text-lg font-bold text-gray-900">{formatCurrency(stats.totalValue)}</p>
                </div>
                <div className="p-2 bg-green-100 rounded-full">
                  <CheckCircle className="w-4 h-4 text-green-600" />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="px-6">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <input
                  type="text"
                  placeholder="Rechercher par numéro, nom ou société..."
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <select
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="all">Tous les statuts</option>
                <option value="draft">Brouillon</option>
                <option value="sent">Envoyée</option>
                <option value="paid">Payée</option>
                <option value="overdue">En retard</option>
                <option value="cancelled">Annulée</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-auto">
        <div className="px-6 pb-6">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Numéro
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Client
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Statut
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Montant
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredInvoices.map((invoice) => (
                  <tr key={invoice.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{invoice.number}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{invoice.customer.name}</div>
                      <div className="text-sm text-gray-500">{invoice.customer.company}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatDate(invoice.date)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(invoice.status)}`}>
                        {getStatusLabel(invoice.status)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 w-40 text-center">
                      {formatCurrency(invoice.total)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 w-48 text-center">
                      <div className="flex justify-center space-x-2">
                        <button
                          onClick={() => handleEditInvoice(invoice)}
                          className="text-blue-600 hover:text-blue-900"
                          title="Modifier"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setSelectedInvoice(invoice)}
                          className="text-green-600 hover:text-green-900"
                          title="Voir détails"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        {canCreateDeliveryNote(invoice) && (
                          <button
                            onClick={() => handleCreateDeliveryNote(invoice.id)}
                            className="text-purple-600 hover:text-purple-900"
                            title="Créer bon de livraison"
                          >
                            <Truck className="w-4 h-4" />
                          </button>
                        )}
                        {canCreateReturnNote(invoice) && (
                          <button
                            onClick={() => handleCreateReturnNote(invoice.id)}
                            className="text-orange-600 hover:text-orange-900"
                            title="Créer bon de retour"
                          >
                            <RefreshCw className="w-4 h-4" />
                          </button>
                        )}
                        {canCancelInvoice(invoice) && (
                          <button
                            onClick={() => handleCancelInvoice(invoice.id)}
                            className="text-red-600 hover:text-red-900"
                            title="Annuler la facture"
                          >
                            <RotateCcw className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}

                {filteredInvoices.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-6 py-4 text-center text-gray-500">
                      Aucune facture trouvée
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Invoice Detail Modal */}
      {selectedInvoice && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-start mb-6">
                <h2 className="text-2xl font-bold text-gray-900">
                  Facture {selectedInvoice.number}
                </h2>
                <button
                  onClick={() => setSelectedInvoice(null)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              {/* Invoice Details */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">Informations client</h3>
                  <div className="space-y-2">
                    <p><strong>Nom:</strong> {selectedInvoice.customer.name}</p>
                    {selectedInvoice.customer.company && (
                      <p><strong>Société:</strong> {selectedInvoice.customer.company}</p>
                    )}
                    <p><strong>Email:</strong> {selectedInvoice.customer.email}</p>
                    <p><strong>Adresse:</strong> {selectedInvoice.customer.address}</p>
                    <p><strong>Ville:</strong> {selectedInvoice.customer.city}</p>
                    <p><strong>Code postal:</strong> {selectedInvoice.customer.postal_code}</p>
                  </div>
                </div>

                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">Détails de la facture</h3>
                  <div className="space-y-2">
                    <p><strong>Date:</strong> {formatDate(selectedInvoice.date)}</p>
                    <p><strong>Échéance:</strong> {formatDate(selectedInvoice.dueDate)}</p>
                    <p><strong>Statut:</strong>
                      <span className={`ml-2 inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(selectedInvoice.status)}`}>
                        {getStatusLabel(selectedInvoice.status)}
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
                          Prix unitaire HT
                        </th>
                        <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">
                          Prix unitaire TTC
                        </th>
                        <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">
                          Total HT
                        </th>
                        <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">
                          TVA
                        </th>
                        <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">
                          Total TTC
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {selectedInvoice.items.map((item) => (
                        <tr key={item.id}>
                          <td className="px-4 py-2 text-sm text-gray-900">
                            {item.description}
                          </td>
                          <td className="px-4 py-2 text-sm text-gray-900 text-right">
                            {item.quantity}
                          </td>
                          <td className="px-4 py-2 text-sm text-gray-900 text-right">
                            {formatCurrency(item.unitPriceHT)}
                          </td>
                          <td className="px-4 py-2 text-sm text-gray-900 text-right">
                            {formatCurrency(item.unitPrice)}
                          </td>
                          <td className="px-4 py-2 text-sm text-gray-900 text-right">
                            {formatCurrency(item.totalHT)}
                          </td>
                          <td className="px-4 py-2 text-sm text-gray-900 text-right">
                            {formatCurrency(item.taxAmount)}
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
                      {formatCurrency(selectedInvoice.subtotal)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">TVA:</span>
                    <span className="text-sm font-medium text-gray-900">
                      {formatCurrency(selectedInvoice.tax)}
                    </span>
                  </div>
                  <div className="flex justify-between border-t pt-2">
                    <span className="text-base font-semibold text-gray-900">Total TTC:</span>
                    <span className="text-base font-semibold text-gray-900">
                      {formatCurrency(selectedInvoice.total)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="mt-8 flex justify-end space-x-3">
                <button
                  onClick={() => handleEditInvoice(selectedInvoice)}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Modifier
                </button>
                {canCreateDeliveryNote(selectedInvoice) && (
                  <button
                    onClick={() => handleCreateDeliveryNote(selectedInvoice.id)}
                    className="flex items-center space-x-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
                  >
                    <Truck className="w-4 h-4" />
                    <span>Bon de livraison</span>
                  </button>
                )}
                {canCreateReturnNote(selectedInvoice) && (
                  <button
                    onClick={() => handleCreateReturnNote(selectedInvoice.id)}
                    className="flex items-center space-x-2 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors"
                  >
                    <RefreshCw className="w-4 h-4" />
                    <span>Bon de retour</span>
                  </button>
                )}
                {canCancelInvoice(selectedInvoice) && (
                  <button
                    onClick={() => {
                      handleCancelInvoice(selectedInvoice.id);
                      setSelectedInvoice(null);
                    }}
                    className="flex items-center space-x-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                  >
                    <RotateCcw className="w-4 h-4" />
                    <span>Annuler</span>
                  </button>
                )}
                <button
                  onClick={() => setSelectedInvoice(null)}
                  className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
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

export default Invoices;