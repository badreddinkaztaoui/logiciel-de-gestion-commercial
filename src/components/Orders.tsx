import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import {
  Plus,
  Eye,
  Download,
  Search,
  RefreshCw,
  Truck,
  FileText,
  AlertCircle,
  CheckCircle,
  Filter,
  Calendar,
  User,
  Package,
  ShoppingCart,
  Loader2,
  Database
} from 'lucide-react';
import { orderService } from '../services/orderService';
import { wooCommerceService } from '../services/woocommerce';
import { WooCommerceOrder } from '../types';
import { formatCurrency, formatDate } from '../utils/formatters';

interface LayoutContext {
  syncStatus: {
    isConnected: boolean;
    isSyncing: boolean;
    lastSyncTime: string | null;
    newOrdersCount: number;
    onManualSync: () => void;
  };
}

const OrderRowSkeleton: React.FC = () => (
  <tr className="animate-pulse">
    <td className="px-6 py-4 whitespace-nowrap">
      <div className="h-4 w-16 bg-gray-200 rounded"></div>
    </td>
    <td className="px-6 py-4 whitespace-nowrap">
      <div className="space-y-2">
        <div className="h-4 w-32 bg-gray-200 rounded"></div>
        <div className="h-3 w-24 bg-gray-200 rounded"></div>
      </div>
    </td>
    <td className="px-6 py-4 whitespace-nowrap">
      <div className="h-4 w-24 bg-gray-200 rounded"></div>
    </td>
    <td className="px-6 py-4 whitespace-nowrap">
      <div className="h-6 w-20 bg-gray-200 rounded-full"></div>
    </td>
    <td className="px-6 py-4 whitespace-nowrap">
      <div className="h-4 w-20 bg-gray-200 rounded"></div>
    </td>
    <td className="px-6 py-4 whitespace-nowrap text-right">
      <div className="flex justify-end space-x-2">
        <div className="h-4 w-4 bg-gray-200 rounded"></div>
        <div className="h-4 w-4 bg-gray-200 rounded"></div>
      </div>
    </td>
  </tr>
);

const Orders: React.FC = () => {
  const [orders, setOrders] = useState<WooCommerceOrder[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [dateFilter, setDateFilter] = useState<string>('all');
  const [selectedOrder, setSelectedOrder] = useState<WooCommerceOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [stats, setStats] = useState({
    total: 0,
    pending: 0,
    processing: 0,
    completed: 0,
    totalValue: 0,
    avgOrderValue: 0
  });
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  const observer = useRef<IntersectionObserver>();
  const lastOrderElementRef = useCallback((node: HTMLElement | null) => {
    if (loading) return;
    if (observer.current) observer.current.disconnect();
    observer.current = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && hasMore) {
        setPage(prevPage => prevPage + 1);
      }
    });
    if (node) observer.current.observe(node);
  }, [loading, hasMore]);

  const navigate = useNavigate();
  const { syncStatus } = useOutletContext<LayoutContext>();

  useEffect(() => {
    // Initial data fetch and sync when component mounts
    const initialLoad = async () => {
      await loadOrders();
      if (syncStatus.isConnected && !syncStatus.isSyncing) {
        syncStatus.onManualSync();
      }
    };
    initialLoad();
  }, []);

  useEffect(() => {
    if (page > 1) {
      loadMoreOrders();
    }
  }, [page]);

  const loadOrders = async () => {
    try {
      setLoading(true);
      const response = await orderService.getOrders(1, 20);
      setOrders(response.data);
      setTotalCount(response.count || 0);
      setHasMore(response.data.length === 20 && response.data.length < (response.count || 0));
      updateStats(response.data);
    } catch (error) {
      console.error('Error loading orders:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadMoreOrders = async () => {
    try {
      setIsLoadingMore(true);
      const response = await orderService.getOrders(page, 20);
      setOrders(prevOrders => [...prevOrders, ...response.data]);
      setHasMore(response.data.length === 20 && orders.length < (response.count || 0));
      updateStats([...orders, ...response.data]);
    } catch (error) {
      console.error('Error loading more orders:', error);
    } finally {
      setIsLoadingMore(false);
    }
  };

  const updateStats = (ordersData: WooCommerceOrder[]) => {
    const orderStats = {
      total: ordersData.length,
      pending: ordersData.filter(o => o.status === 'pending').length,
      processing: ordersData.filter(o => o.status === 'processing').length,
      completed: ordersData.filter(o => o.status === 'completed').length,
      totalValue: ordersData.reduce((sum, o) => sum + parseFloat(o.total || '0'), 0),
      avgOrderValue: ordersData.length > 0 ?
        ordersData.reduce((sum, o) => sum + parseFloat(o.total || '0'), 0) / ordersData.length : 0
    };
    setStats(orderStats);
  };

  const handleCreateInvoiceFromOrder = (order: WooCommerceOrder) => {
    // Navigate to invoice creation with order data
    navigate('/invoices/create', { state: { sourceOrder: order } });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'processing': return 'bg-blue-100 text-blue-800';
      case 'on-hold': return 'bg-orange-100 text-orange-800';
      case 'completed': return 'bg-green-100 text-green-800';
      case 'cancelled': return 'bg-red-100 text-red-800';
      case 'refunded': return 'bg-purple-100 text-purple-800';
      case 'failed': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'pending': return 'En attente';
      case 'processing': return 'En cours';
      case 'on-hold': return 'En attente';
      case 'completed': return 'Terminée';
      case 'cancelled': return 'Annulée';
      case 'refunded': return 'Remboursée';
      case 'failed': return 'Échouée';
      default: return status;
    }
  };

  const filteredOrders = orders.filter(order => {
    const matchesSearch =
      order.number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.id.toString().includes(searchTerm) ||
      (order.billing?.first_name?.toLowerCase() + ' ' + order.billing?.last_name?.toLowerCase()).includes(searchTerm.toLowerCase()) ||
      order.billing?.email?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus = statusFilter === 'all' || order.status === statusFilter;

    let matchesDate = true;
    if (dateFilter !== 'all') {
      const orderDate = new Date(order.date_created);
      const today = new Date();

      switch (dateFilter) {
        case 'today':
          matchesDate = orderDate.toDateString() === today.toDateString();
          break;
        case 'week':
          const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
          matchesDate = orderDate >= weekAgo;
          break;
        case 'month':
          const monthAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
          matchesDate = orderDate >= monthAgo;
          break;
      }
    }

    return matchesSearch && matchesStatus && matchesDate;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center space-y-4 sm:space-y-0">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Commandes</h1>
          <p className="text-gray-600 mt-2">Gérez vos commandes WooCommerce</p>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={syncStatus.onManualSync}
            disabled={syncStatus.isSyncing}
            className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${syncStatus.isSyncing ? 'animate-spin' : ''}`} />
            <span>{syncStatus.isSyncing ? 'Synchronisation...' : 'Synchroniser'}</span>
          </button>
        </div>
      </div>

      {/* Sync Status */}
      {syncStatus.lastSyncTime && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="flex items-center space-x-2">
            <CheckCircle className="w-5 h-5 text-green-600" />
            <span className="text-sm text-green-800">
              Dernière synchronisation: {new Date(syncStatus.lastSyncTime).toLocaleString()}
            </span>
          </div>
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total</p>
              <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
            </div>
            <div className="p-3 bg-blue-100 rounded-full">
              <ShoppingCart className="w-6 h-6 text-blue-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">En cours</p>
              <p className="text-2xl font-bold text-blue-600">{stats.processing}</p>
            </div>
            <div className="p-3 bg-blue-100 rounded-full">
              <Package className="w-6 h-6 text-blue-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Terminées</p>
              <p className="text-2xl font-bold text-green-600">{stats.completed}</p>
            </div>
            <div className="p-3 bg-green-100 rounded-full">
              <CheckCircle className="w-6 h-6 text-green-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Valeur totale</p>
              <p className="text-2xl font-bold text-gray-900">{formatCurrency(stats.totalValue)}</p>
            </div>
            <div className="p-3 bg-purple-100 rounded-full">
              <Database className="w-6 h-6 text-purple-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
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
            <option value="pending">En attente</option>
            <option value="processing">En cours</option>
            <option value="completed">Terminées</option>
            <option value="cancelled">Annulées</option>
          </select>

          <select
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="all">Toutes les dates</option>
            <option value="today">Aujourd'hui</option>
            <option value="week">Cette semaine</option>
            <option value="month">Ce mois</option>
          </select>
        </div>
      </div>

      {/* Orders Table */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Commande
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
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Total
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredOrders.map((order, index) => (
                <tr
                  key={order.id}
                  ref={index === filteredOrders.length - 1 ? lastOrderElementRef : null}
                  className="hover:bg-gray-50 transition-colors"
                >
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">
                      #{order.number || order.id}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">
                      {order.billing?.first_name} {order.billing?.last_name}
                    </div>
                    {order.billing?.email && (
                      <div className="text-sm text-gray-500">{order.billing.email}</div>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {formatDate(order.date_created)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(order.status)}`}>
                      {getStatusLabel(order.status)}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {formatCurrency(parseFloat(order.total || '0'))}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <div className="flex justify-end space-x-2">
                      <button
                        onClick={() => setSelectedOrder(order)}
                        className="text-blue-600 hover:text-blue-900"
                        title="Voir détails"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleCreateInvoiceFromOrder(order)}
                        className="text-green-600 hover:text-green-900"
                        title="Créer facture"
                      >
                        <FileText className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {isLoadingMore && (
                <>
                  <OrderRowSkeleton />
                  <OrderRowSkeleton />
                  <OrderRowSkeleton />
                </>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* No more orders indicator */}
      {!loading && !hasMore && orders.length > 0 && (
        <div className="text-center py-4 text-gray-500">
          Plus de commandes à charger
        </div>
      )}

      {/* Order Detail Modal */}
      {selectedOrder && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-start mb-6">
                <h2 className="text-2xl font-bold text-gray-900">
                  Commande #{selectedOrder.number || selectedOrder.id}
                </h2>
                <button
                  onClick={() => setSelectedOrder(null)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <span className="text-2xl">&times;</span>
                </button>
              </div>

              {/* Order Details */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">Informations client</h3>
                  <div className="space-y-2">
                    <p><strong>Nom:</strong> {selectedOrder.billing?.first_name} {selectedOrder.billing?.last_name}</p>
                    {selectedOrder.billing?.company && (
                      <p><strong>Société:</strong> {selectedOrder.billing.company}</p>
                    )}
                    <p><strong>Email:</strong> {selectedOrder.billing?.email}</p>
                    <p><strong>Téléphone:</strong> {selectedOrder.billing?.phone}</p>
                    <p><strong>Adresse:</strong> {selectedOrder.billing?.address_1}</p>
                    <p><strong>Ville:</strong> {selectedOrder.billing?.city}</p>
                    <p><strong>Code postal:</strong> {selectedOrder.billing?.postcode}</p>
                  </div>
                </div>

                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">Détails de la commande</h3>
                  <div className="space-y-2">
                    <p><strong>Date:</strong> {formatDate(selectedOrder.date_created)}</p>
                    <p><strong>Statut:</strong>
                      <span className={`ml-2 inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(selectedOrder.status)}`}>
                        {getStatusLabel(selectedOrder.status)}
                      </span>
                    </p>
                    <p><strong>Mode de paiement:</strong> {(selectedOrder as any).payment_method_title || 'Non spécifié'}</p>
                    <p><strong>Total:</strong> {formatCurrency(parseFloat(selectedOrder.total?.toString() || '0'))}</p>
                  </div>
                </div>
              </div>

              {/* Order Items */}
              {selectedOrder.line_items && selectedOrder.line_items.length > 0 && (
                <div className="mb-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">Articles</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full border border-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                            Produit
                          </th>
                          <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">
                            Quantité
                          </th>
                          <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">
                            Prix
                          </th>
                          <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">
                            Total
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {selectedOrder.line_items.map((item, index) => (
                          <tr key={index}>
                            <td className="px-4 py-2 text-sm text-gray-900">
                              {item.name}
                            </td>
                            <td className="px-4 py-2 text-sm text-gray-900 text-right">
                              {item.quantity}
                            </td>
                            <td className="px-4 py-2 text-sm text-gray-900 text-right">
                              {formatCurrency(parseFloat(item.price?.toString() || '0'))}
                            </td>
                            <td className="px-4 py-2 text-sm text-gray-900 text-right">
                              {formatCurrency(parseFloat(item.total || '0'))}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="mt-8 flex justify-end space-x-3">
                <button
                  onClick={() => handleCreateInvoiceFromOrder(selectedOrder)}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Créer facture
                </button>
                <button
                  onClick={() => setSelectedOrder(null)}
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

export default Orders;