import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useOutletContext, useLocation } from 'react-router-dom';
import {
  Eye,
  Search,
  RefreshCw,
  FileText,
  CheckCircle,
  Package,
  ShoppingCart,
  Database,
  XCircle,
  Clock,
} from 'lucide-react';
import { orderService } from '../services/orderService';
import { WooCommerceOrder } from '../types';
import { formatCurrency, formatDate } from '../utils/formatters';

interface LayoutContext {
  syncStatus: {
    isConnected: boolean;
    isSyncing: boolean;
    lastSyncTime: string | null;
    newOrdersCount: number;
    onManualSync: () => Promise<void>;
  };
}

const OrderRowSkeleton: React.FC = () => (
  <tr className="animate-pulse">
    <td className="px-6 py-4 whitespace-nowrap w-32">
      <div className="h-4 w-16 bg-gray-200 rounded"></div>
    </td>
    <td className="px-6 py-4 whitespace-nowrap w-64">
      <div className="space-y-2">
        <div className="h-4 w-32 bg-gray-200 rounded"></div>
        <div className="h-3 w-24 bg-gray-200 rounded"></div>
      </div>
    </td>
    <td className="px-6 py-4 whitespace-nowrap w-40">
      <div className="h-4 w-24 bg-gray-200 rounded"></div>
    </td>
    <td className="px-6 py-4 whitespace-nowrap w-32">
      <div className="h-6 w-20 bg-gray-200 rounded-full"></div>
    </td>
    <td className="px-6 py-4 whitespace-nowrap w-32">
      <div className="h-4 w-20 bg-gray-200 rounded"></div>
    </td>
    <td className="px-6 py-4 whitespace-nowrap text-right w-24">
      <div className="flex justify-end space-x-2">
        <div className="h-4 w-4 bg-gray-200 rounded"></div>
        <div className="h-4 w-4 bg-gray-200 rounded"></div>
      </div>
    </td>
  </tr>
);

const StatCardSkeleton: React.FC = () => (
  <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 animate-pulse">
    <div className="flex items-center justify-between">
      <div>
        <div className="h-4 w-16 bg-gray-200 rounded mb-2"></div>
        <div className="h-6 w-24 bg-gray-200 rounded"></div>
      </div>
      <div className="p-3 bg-gray-100 rounded-full">
        <div className="w-6 h-6 bg-gray-200 rounded"></div>
      </div>
    </div>
  </div>
);

const Orders: React.FC = () => {
  const [allOrders, setAllOrders] = useState<WooCommerceOrder[]>([]);
  const [filteredOrders, setFilteredOrders] = useState<WooCommerceOrder[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [dateFilter, setDateFilter] = useState<string>('all');
  const [selectedOrder, setSelectedOrder] = useState<WooCommerceOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(1);
  const [_, setTotalCount] = useState<number>(0);
  const [stats, setStats] = useState({
    total: 0,
    pending: 0,
    processing: 0,
    completed: 0,
    cancelled: 0,
    totalValue: 0,
    avgOrderValue: 0
  });
  const [isLoadingMore, __] = useState(false);
  const [isSyncing, ___] = useState(false);
  const [syncLoading, setSyncLoading] = useState(false);

  const observer = useRef<IntersectionObserver>();
  const navigate = useNavigate();
  const location = useLocation();
  const { syncStatus } = useOutletContext<LayoutContext>();

  const updateStats = useCallback((ordersData: WooCommerceOrder[]) => {
    const orderStats = {
      total: ordersData.length,
      pending: ordersData.filter(o => o.status === 'on-hold').length,
      processing: ordersData.filter(o => o.status === 'processing').length,
      completed: ordersData.filter(o => o.status === 'completed').length,
      cancelled: ordersData.filter(o => o.status === 'cancelled').length,
      totalValue: ordersData.reduce((sum, o) => sum + parseFloat(o.total || '0'), 0),
      avgOrderValue: ordersData.length > 0 ?
        ordersData.reduce((sum, o) => sum + parseFloat(o.total || '0'), 0) / ordersData.length : 0
    };
    setStats(orderStats);
  }, []);

  const applyFilters = useCallback(() => {
    let filtered = [...allOrders];

    if (statusFilter !== 'all') {
      filtered = filtered.filter(order => order.status === statusFilter);
    }

    if (dateFilter !== 'all') {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      filtered = filtered.filter(order => {
        const orderDate = new Date(order.date_created);
        switch (dateFilter) {
          case 'today':
            return orderDate.toDateString() === today.toDateString();
          case 'week': {
            const weekAgo = new Date(today);
            weekAgo.setDate(weekAgo.getDate() - 7);
            return orderDate >= weekAgo;
          }
          case 'month': {
            const monthAgo = new Date(today);
            monthAgo.setMonth(monthAgo.getMonth() - 1);
            return orderDate >= monthAgo;
          }
          default:
            return true;
        }
      });
    }

    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      filtered = filtered.filter(order =>
        order.number?.toLowerCase().includes(searchLower) ||
        order.id.toString().includes(searchLower) ||
        (order.billing?.first_name?.toLowerCase() + ' ' + order.billing?.last_name?.toLowerCase()).includes(searchLower) ||
        order.billing?.email?.toLowerCase().includes(searchLower)
      );
    }

    setFilteredOrders(filtered);
    setHasMore(filtered.length > 20);
    setTotalCount(filtered.length);
  }, [allOrders, statusFilter, dateFilter, searchTerm]);

  useEffect(() => {
    applyFilters();
  }, [applyFilters]);

  // Update stats whenever allOrders changes
  useEffect(() => {
    updateStats(allOrders);
  }, [allOrders, updateStats]);

  const loadOrders = async (shouldSync = true) => {
    try {
      if (!loading) setLoading(true);

      if (shouldSync && syncStatus.isConnected && !syncStatus.isSyncing) {
        setSyncLoading(true);
        try {
          await syncStatus.onManualSync();
        } catch (error) {
          console.error('Error syncing orders:', error);
        } finally {
          setSyncLoading(false);
        }
      }

      const response = await orderService.getOrders(1, 100); // Get more orders initially
      setAllOrders(response.data);
      applyFilters(); // This will set filteredOrders
    } catch (error) {
      console.error('Error loading orders:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleManualSync = async () => {
    if (syncStatus.isSyncing || isSyncing) return;

    setSyncLoading(true);
    try {
      await syncStatus.onManualSync();
      await loadOrders(false);
    } catch (error) {
      console.error('Error during manual sync:', error);
    } finally {
      setSyncLoading(false);
    }
  };

  // Handle filter changes
  const handleStatusFilterChange = (value: string) => {
    setStatusFilter(value);
    setPage(1);
  };

  const handleDateFilterChange = (value: string) => {
    setDateFilter(value);
    setPage(1);
  };

  const handleSearchChange = (value: string) => {
    setSearchTerm(value);
    setPage(1);
  };

  const resetFilters = () => {
    setStatusFilter('all');
    setDateFilter('all');
    setSearchTerm('');
    setPage(1);
  };

  // Get paginated orders for display
  const getPaginatedOrders = useCallback(() => {
    const startIndex = 0;
    const endIndex = page * 20;
    return filteredOrders.slice(startIndex, endIndex);
  }, [filteredOrders, page]);

  // Update infinite scroll
  const lastOrderElementRef = useCallback((node: HTMLElement | null) => {
    if (loading || isLoadingMore) return;
    if (observer.current) observer.current.disconnect();
    observer.current = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && hasMore) {
        setPage(prev => prev + 1);
      }
    });
    if (node) observer.current.observe(node);
  }, [loading, hasMore, isLoadingMore]);

  useEffect(() => {
    loadOrders();
  }, [location.pathname]);

  const handleCreateInvoiceFromOrder = (order: WooCommerceOrder) => {
    navigate('/invoices/create', { state: { sourceOrder: order } });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'on-hold': return 'bg-yellow-100 text-yellow-800';
      case 'processing': return 'bg-blue-100 text-blue-800';
      case 'completed': return 'bg-green-100 text-green-800';
      case 'cancelled': return 'bg-red-100 text-red-800';
      case 'refunded': return 'bg-purple-100 text-purple-800';
      case 'failed': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'on-hold': return 'En attente';
      case 'processing': return 'En cours';
      case 'completed': return 'Terminée';
      case 'cancelled': return 'Annulée';
      case 'refunded': return 'Remboursée';
      case 'failed': return 'Échouée';
      default: return status;
    }
  };

  if (loading && !syncLoading) {
    return (
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center space-y-4 sm:space-y-0">
          <div>
            <div className="h-8 w-48 bg-gray-200 rounded animate-pulse"></div>
            <div className="h-4 w-64 bg-gray-200 rounded mt-2 animate-pulse"></div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <StatCardSkeleton />
          <StatCardSkeleton />
          <StatCardSkeleton />
          <StatCardSkeleton />
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="sticky top-0 px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-32 bg-gray-50">
                    Commande
                  </th>
                  <th className="sticky top-0 px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-64 bg-gray-50">
                    Client
                  </th>
                  <th className="sticky top-0 px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-40 bg-gray-50">
                    Date
                  </th>
                  <th className="sticky top-0 px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-32 bg-gray-50">
                    Statut
                  </th>
                  <th className="sticky top-0 px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-32 bg-gray-50">
                    Total
                  </th>
                  <th className="sticky top-0 px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider w-24 bg-gray-50">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                <OrderRowSkeleton />
                <OrderRowSkeleton />
                <OrderRowSkeleton />
                <OrderRowSkeleton />
                <OrderRowSkeleton />
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Fixed Header Section */}
      <div className="flex-none space-y-2">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center space-y-4 sm:space-y-0 bg-white px-6 py-4 border-b">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Commandes</h1>
            <p className="text-sm text-gray-600">Gérez vos commandes WooCommerce</p>
          </div>

          <div className="flex items-center space-x-3">
            <button
              onClick={handleManualSync}
              disabled={syncStatus.isSyncing || isSyncing || syncLoading}
              className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              <RefreshCw className={`w-4 h-4 ${(syncStatus.isSyncing || isSyncing || syncLoading) ? 'animate-spin' : ''}`} />
              <span>{(syncStatus.isSyncing || isSyncing || syncLoading) ? 'Synchronisation...' : 'Synchroniser'}</span>
            </button>
          </div>
        </div>

        {/* Sync Status */}
        {syncStatus.lastSyncTime && (
          <div className="px-6">
            <div className="bg-green-50 border border-green-200 rounded-lg p-3">
              <div className="flex items-center space-x-2">
                <CheckCircle className="w-4 h-4 text-green-600" />
                <span className="text-sm text-green-800">
                  Dernière synchronisation: {new Date(syncStatus.lastSyncTime).toLocaleString()}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Stats Cards Grid */}
        <div className="px-6">
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {syncLoading ? (
              <>
                <StatCardSkeleton />
                <StatCardSkeleton />
                <StatCardSkeleton />
                <StatCardSkeleton />
                <StatCardSkeleton />
                <StatCardSkeleton />
              </>
            ) : (
              <>
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-medium text-gray-600">Total</p>
                      <p className="text-lg font-bold text-gray-900">{stats.total}</p>
                    </div>
                    <div className="p-2 bg-blue-100 rounded-full">
                      <ShoppingCart className="w-4 h-4 text-blue-600" />
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-medium text-gray-600">En cours</p>
                      <p className="text-lg font-bold text-blue-600">{stats.processing}</p>
                    </div>
                    <div className="p-2 bg-blue-100 rounded-full">
                      <Package className="w-4 h-4 text-blue-600" />
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-medium text-gray-600">Terminées</p>
                      <p className="text-lg font-bold text-green-600">{stats.completed}</p>
                    </div>
                    <div className="p-2 bg-green-100 rounded-full">
                      <CheckCircle className="w-4 h-4 text-green-600" />
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-medium text-gray-600">Annulées</p>
                      <p className="text-lg font-bold text-red-600">{stats.cancelled}</p>
                    </div>
                    <div className="p-2 bg-red-100 rounded-full">
                      <XCircle className="w-4 h-4 text-red-600" />
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-medium text-gray-600">En attente</p>
                      <p className="text-lg font-bold text-yellow-600">{stats.pending}</p>
                    </div>
                    <div className="p-2 bg-yellow-100 rounded-full">
                      <Clock className="w-4 h-4 text-yellow-600" />
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
                      <Database className="w-4 h-4 text-purple-600" />
                    </div>
                  </div>
                </div>
              </>
            )}
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
                  placeholder="Rechercher par numéro, client..."
                  value={searchTerm}
                  onChange={(e) => handleSearchChange(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <select
                value={statusFilter}
                onChange={(e) => handleStatusFilterChange(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="all">Tous les statuts</option>
                <option value="on-hold">En attente</option>
                <option value="processing">En cours</option>
                <option value="completed">Terminées</option>
                <option value="cancelled">Annulées</option>
                <option value="refunded">Remboursées</option>
              </select>

              <select
                value={dateFilter}
                onChange={(e) => handleDateFilterChange(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="all">Toutes les dates</option>
                <option value="today">Aujourd'hui</option>
                <option value="week">Cette semaine</option>
                <option value="month">Ce mois</option>
              </select>
            </div>

            {/* Filter summary */}
            {(statusFilter !== 'all' || dateFilter !== 'all' || searchTerm) && (
              <div className="mt-4 flex items-center gap-2 text-sm text-gray-600">
                <span className="font-medium">Filtres actifs:</span>
                {statusFilter !== 'all' && (
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(statusFilter)}`}>
                    {getStatusLabel(statusFilter)}
                  </span>
                )}
                {dateFilter !== 'all' && (
                  <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-xs font-medium">
                    {dateFilter === 'today' ? 'Aujourd\'hui' :
                     dateFilter === 'week' ? 'Cette semaine' :
                     'Ce mois'}
                  </span>
                )}
                {searchTerm && (
                  <span className="bg-gray-100 text-gray-800 px-2 py-1 rounded-full text-xs font-medium">
                    Recherche: {searchTerm}
                  </span>
                )}
                <button
                  onClick={resetFilters}
                  className="text-red-600 hover:text-red-800 text-xs ml-2"
                >
                  Réinitialiser les filtres
                </button>
              </div>
            )}
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
                  <th className="sticky top-0 px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-32 bg-gray-50">
                    Commande
                  </th>
                  <th className="sticky top-0 px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-64 bg-gray-50">
                    Client
                  </th>
                  <th className="sticky top-0 px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-40 bg-gray-50">
                    Date
                  </th>
                  <th className="sticky top-0 px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-32 bg-gray-50">
                    Statut
                  </th>
                  <th className="sticky top-0 px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-32 bg-gray-50">
                    Total
                  </th>
                  <th className="sticky top-0 px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider w-24 bg-gray-50">
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
                {syncLoading ? (
                  <>
                    <OrderRowSkeleton />
                    <OrderRowSkeleton />
                    <OrderRowSkeleton />
                    <OrderRowSkeleton />
                    <OrderRowSkeleton />
                  </>
                ) : (
                  <>
                    {getPaginatedOrders().map((order, index) => (
                      <tr
                        key={order.id}
                        ref={index === getPaginatedOrders().length - 1 ? lastOrderElementRef : null}
                        className="hover:bg-gray-50 transition-colors"
                      >
                        <td className="px-6 py-4 whitespace-nowrap w-32">
                          <div className="text-sm font-medium text-gray-900">
                            #{order.number || order.id}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap w-64">
                          <div className="text-sm text-gray-900">
                            {order.billing?.first_name} {order.billing?.last_name || ''}
                          </div>
                          {order.billing?.email && (
                            <div className="text-sm text-gray-500 truncate max-w-xs">
                              {order.billing.email}
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 w-40">
                          {formatDate(order.date_created)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap w-32">
                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(order.status)}`}>
                            {getStatusLabel(order.status)}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 w-32">
                          {formatCurrency(parseFloat(order.total || '0'))}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium w-24">
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
                  </>
                )}
              </tbody>
            </table>

            {!loading && !hasMore && filteredOrders.length > 0 && (
              <div className="text-center py-4 text-gray-500">
                Plus de commandes à charger
              </div>
            )}

            {!loading && filteredOrders.length === 0 && (
              <div className="text-center py-4 text-gray-500">
                Aucune commande trouvée
              </div>
            )}
          </div>
        </div>
      </div>

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
                              {formatCurrency(parseFloat(item.price || '0'))}
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