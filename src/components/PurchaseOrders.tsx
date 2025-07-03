import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  Edit, 
  Eye, 
  Trash2, 
  Search,
  Filter,
  Building,
  Mail,
  Phone,
  MapPin,
  User,
  Calendar,
  CheckCircle,
  Clock,
  AlertCircle,
  Ban,
  TrendingUp,
  Receipt,
  Truck,
  Package
} from 'lucide-react';
import { purchaseOrderService } from '../services/purchaseOrderService';
import { supplierService } from '../services/supplierService';
import { PurchaseOrder, Supplier } from '../types';
import { formatCurrency, formatDate } from '../utils/formatters';
import PurchaseOrderForm from './PurchaseOrderForm';
import ReceiveItemsForm from './ReceiveItemsForm';

const PurchaseOrders: React.FC = () => {
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [filteredOrders, setFilteredOrders] = useState<PurchaseOrder[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [supplierFilter, setSupplierFilter] = useState<string>('all');
  const [showForm, setShowForm] = useState(false);
  const [editingOrder, setEditingOrder] = useState<PurchaseOrder | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<PurchaseOrder | null>(null);
  const [showReceiveForm, setShowReceiveForm] = useState(false);
  const [selectedOrderForReceive, setSelectedOrderForReceive] = useState<PurchaseOrder | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    filterOrders();
  }, [purchaseOrders, searchTerm, statusFilter, supplierFilter]);

  const loadData = async () => {
    try {
      setLoading(true);
      const savedOrders = await purchaseOrderService.getPurchaseOrders();
      setPurchaseOrders(savedOrders);
      
      const savedSuppliers = await supplierService.getSuppliers();
      setSuppliers(savedSuppliers);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const filterOrders = () => {
    let filtered = purchaseOrders;

    // Filter by search term
    if (searchTerm) {
      filtered = filtered.filter(order =>
        order.number.toLowerCase().includes(searchTerm.toLowerCase()) ||
        order.items.some(item => 
          item.description.toLowerCase().includes(searchTerm.toLowerCase())
        )
      );
    }

    // Filter by status
    if (statusFilter !== 'all') {
      filtered = filtered.filter(order => order.status === statusFilter);
    }

    // Filter by supplier
    if (supplierFilter !== 'all') {
      filtered = filtered.filter(order => order.supplierId === supplierFilter);
    }

    setFilteredOrders(filtered);
  };

  const handleCreateOrder = () => {
    setEditingOrder(null);
    setShowForm(true);
  };

  const handleEditOrder = (order: PurchaseOrder) => {
    setEditingOrder(order);
    setShowForm(true);
  };

  const handleDeleteOrder = async (orderId: string) => {
    if (window.confirm('Êtes-vous sûr de vouloir supprimer ce bon de commande ?')) {
      try {
        await purchaseOrderService.deletePurchaseOrder(orderId);
        loadData();
      } catch (error) {
        console.error('Error deleting order:', error);
        alert('Erreur lors de la suppression du bon de commande');
      }
    }
  };

  const handleSaveOrder = async (order: PurchaseOrder) => {
    try {
      await purchaseOrderService.savePurchaseOrder(order);
      setShowForm(false);
      setEditingOrder(null);
      loadData();
    } catch (error) {
      console.error('Error saving purchase order:', error);
      alert('Error saving purchase order: ' + (error as Error).message);
    }
  };

  const handleCancelForm = () => {
    setShowForm(false);
    setEditingOrder(null);
  };

  const handleReceiveItems = (order: PurchaseOrder) => {
    setSelectedOrderForReceive(order);
    setShowReceiveForm(true);
    setSelectedOrder(null);
  };

  const handleSaveReceive = () => {
    setShowReceiveForm(false);
    setSelectedOrderForReceive(null);
    loadData();
  };

  const handleCancelReceive = () => {
    setShowReceiveForm(false);
    setSelectedOrderForReceive(null);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'draft':
        return <Edit className="w-4 h-4 text-gray-500" />;
      case 'ordered':
        return <Clock className="w-4 h-4 text-blue-500" />;
      case 'partial':
        return <TrendingUp className="w-4 h-4 text-orange-500" />;
      case 'complete':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'cancelled':
        return <Ban className="w-4 h-4 text-red-500" />;
      default:
        return <AlertCircle className="w-4 h-4 text-gray-500" />;
    }
  };

  const getStatusBadge = (status: string) => {
    const colorMap = {
      draft: 'bg-gray-100 text-gray-800',
      ordered: 'bg-blue-100 text-blue-800',
      partial: 'bg-orange-100 text-orange-800',
      complete: 'bg-green-100 text-green-800',
      cancelled: 'bg-red-100 text-red-800'
    };

    const labelMap = {
      draft: 'Brouillon',
      ordered: 'Commandé',
      partial: 'Partiel',
      complete: 'Terminé',
      cancelled: 'Annulé'
    };

    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${colorMap[status as keyof typeof colorMap] || 'bg-gray-100 text-gray-800'}`}>
        {getStatusIcon(status)}
        <span className="ml-1">{labelMap[status as keyof typeof labelMap] || status}</span>
      </span>
    );
  };

  const getSupplierName = (supplierId: string) => {
    const supplier = suppliers.find(s => s.id === supplierId);
    return supplier ? supplier.name : 'Fournisseur inconnu';
  };

  const canReceiveItems = (order: PurchaseOrder) => {
    // Only ordered or partial orders can receive items
    return order.status === 'ordered' || order.status === 'partial';
  };

  const orderStats = {
    total: purchaseOrders.length,
    draft: purchaseOrders.filter(o => o.status === 'draft').length,
    ordered: purchaseOrders.filter(o => o.status === 'ordered').length,
    partial: purchaseOrders.filter(o => o.status === 'partial').length,
    complete: purchaseOrders.filter(o => o.status === 'complete').length,
    totalValue: purchaseOrders.reduce((sum, order) => sum + order.total, 0)
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Chargement des bons de commande...</p>
        </div>
      </div>
    );
  }

  if (showForm) {
    return (
      <PurchaseOrderForm
        editingOrder={editingOrder}
        onSave={handleSaveOrder}
        onCancel={handleCancelForm}
      />
    );
  }

  if (showReceiveForm && selectedOrderForReceive) {
    return (
      <ReceiveItemsForm
        purchaseOrder={selectedOrderForReceive}
        onSave={handleSaveReceive}
        onCancel={handleCancelReceive}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center space-y-4 sm:space-y-0">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Bons de commande</h1>
          <p className="text-gray-600">Gérez vos commandes fournisseurs avec prix TTC</p>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={handleCreateOrder}
            className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>Nouveau bon de commande</span>
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total</p>
              <p className="text-2xl font-bold text-gray-900">{orderStats.total}</p>
            </div>
            <Receipt className="w-8 h-8 text-gray-500" />
          </div>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Commandés</p>
              <p className="text-2xl font-bold text-gray-900">{orderStats.ordered}</p>
            </div>
            <Clock className="w-8 h-8 text-blue-500" />
          </div>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Partiels</p>
              <p className="text-2xl font-bold text-gray-900">{orderStats.partial}</p>
            </div>
            <TrendingUp className="w-8 h-8 text-orange-500" />
          </div>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Terminés</p>
              <p className="text-2xl font-bold text-gray-900">{orderStats.complete}</p>
            </div>
            <CheckCircle className="w-8 h-8 text-green-500" />
          </div>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Valeur TTC</p>
              <p className="text-2xl font-bold text-gray-900">{formatCurrency(orderStats.totalValue)}</p>
            </div>
            <Receipt className="w-8 h-8 text-purple-500" />
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row space-y-3 sm:space-y-0 sm:space-x-4">
        <div className="relative flex-1">
          <Search className="w-5 h-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Rechercher par numéro, produit..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 pr-4 py-2 w-full border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
        <div className="flex items-center space-x-2">
          <Filter className="w-5 h-5 text-gray-400" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="all">Tous les statuts</option>
            <option value="draft">Brouillon</option>
            <option value="ordered">Commandé</option>
            <option value="partial">Partiel</option>
            <option value="complete">Terminé</option>
            <option value="cancelled">Annulé</option>
          </select>
          <select
            value={supplierFilter}
            onChange={(e) => setSupplierFilter(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="all">Tous les fournisseurs</option>
            {suppliers.map((supplier) => (
              <option key={supplier.id} value={supplier.id}>
                {supplier.name}
              </option>
            ))}
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
                  Bon de commande
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Fournisseur
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Statut
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Total HT
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  TVA
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
              {filteredOrders.map((order) => (
                <tr key={order.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">#{order.number}</div>
                    <div className="text-sm text-gray-500">{order.items.length} article(s)</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="flex-shrink-0 h-8 w-8 bg-gray-100 rounded-full flex items-center justify-center">
                        <Building className="w-4 h-4 text-gray-600" />
                      </div>
                      <div className="ml-3">
                        <div className="text-sm font-medium text-gray-900">
                          {getSupplierName(order.supplierId)}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    <div className="flex items-center">
                      <Calendar className="w-4 h-4 text-gray-400 mr-2" />
                      {formatDate(order.date)}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {getStatusBadge(order.status)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {formatCurrency(order.subtotal)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-blue-600">
                    {formatCurrency(order.tax)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900">
                    {formatCurrency(order.total)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => setSelectedOrder(order)}
                        className="text-blue-600 hover:text-blue-900 p-1 hover:bg-blue-50 rounded"
                        title="Voir détails"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      {canReceiveItems(order) && (
                        <button
                          onClick={() => handleReceiveItems(order)}
                          className="text-green-600 hover:text-green-900 p-1 hover:bg-green-50 rounded"
                          title="Réceptionner articles"
                        >
                          <Truck className="w-4 h-4" />
                        </button>
                      )}
                      <button
                        onClick={() => handleEditOrder(order)}
                        className="text-green-600 hover:text-green-900 p-1 hover:bg-green-50 rounded"
                        title="Modifier"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteOrder(order.id)}
                        className="text-red-600 hover:text-red-900 p-1 hover:bg-red-50 rounded"
                        title="Supprimer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {filteredOrders.length === 0 && (
          <div className="text-center py-12">
            <Receipt className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">Aucun bon de commande trouvé</h3>
            <p className="text-gray-500 mb-4">
              {purchaseOrders.length === 0 
                ? "Créez votre premier bon de commande avec prix TTC"
                : "Aucun bon de commande ne correspond à vos critères de recherche"
              }
            </p>
            {purchaseOrders.length === 0 && (
              <button
                onClick={handleCreateOrder}
                className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                <Plus className="w-4 h-4 mr-2" />
                Créer maintenant
              </button>
            )}
          </div>
        )}
      </div>

      {/* Order Details Modal */}
      {selectedOrder && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
              <h3 className="text-lg font-semibold">Bon de commande #{selectedOrder.number}</h3>
              <button
                onClick={() => setSelectedOrder(null)}
                className="text-gray-400 hover:text-gray-600 text-2xl"
              >
                ×
              </button>
            </div>
            <div className="p-6 overflow-y-auto max-h-[80vh]">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Order Info */}
                <div>
                  <h4 className="font-medium text-gray-900 mb-4 flex items-center">
                    <Receipt className="w-4 h-4 mr-2" />
                    Informations commande
                  </h4>
                  <div className="space-y-3 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Numéro:</span>
                      <span className="font-medium">#{selectedOrder.number}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Date:</span>
                      <span className="font-medium">{formatDate(selectedOrder.date)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Livraison prévue:</span>
                      <span className="font-medium">{formatDate(selectedOrder.expectedDeliveryDate)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Statut:</span>
                      {getStatusBadge(selectedOrder.status)}
                    </div>
                  </div>
                </div>

                {/* Supplier Info */}
                <div>
                  <h4 className="font-medium text-gray-900 mb-4 flex items-center">
                    <Building className="w-4 h-4 mr-2" />
                    Fournisseur
                  </h4>
                  <div className="space-y-3 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Nom:</span>
                      <span className="font-medium">{getSupplierName(selectedOrder.supplierId)}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Order Items */}
              <div className="mt-8">
                <h4 className="font-medium text-gray-900 mb-4">Articles commandés</h4>
                <div className="overflow-x-auto">
                  <table className="min-w-full border border-gray-200 rounded-lg">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-2 text-left text-sm font-medium text-gray-900">Produit</th>
                        <th className="px-4 py-2 text-left text-sm font-medium text-gray-900">Qté</th>
                        <th className="px-4 py-2 text-left text-sm font-medium text-gray-900">Reçu</th>
                        <th className="px-4 py-2 text-left text-sm font-medium text-gray-900">Reste</th>
                        <th className="px-4 py-2 text-left text-sm font-medium text-gray-900">Prix unit. TTC</th>
                        <th className="px-4 py-2 text-left text-sm font-medium text-gray-900">TVA</th>
                        <th className="px-4 py-2 text-left text-sm font-medium text-gray-900">Total TTC</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {selectedOrder.items.map((item) => {
                        const taxRate = item.taxRate || 20;
                        const unitPriceHT = item.unitPrice / (1 + taxRate / 100);
                        const taxAmount = item.taxAmount || (unitPriceHT * (taxRate / 100) * item.quantity);
                        const remainingQuantity = item.quantity - (item.received || 0);
                        
                        return (
                          <tr key={item.id}>
                            <td className="px-4 py-2">
                              <div className="text-sm font-medium text-gray-900">{item.description}</div>
                              {item.sku && (
                                <div className="text-xs text-gray-500">SKU: {item.sku}</div>
                              )}
                            </td>
                            <td className="px-4 py-2 text-sm text-gray-900">{item.quantity}</td>
                            <td className="px-4 py-2 text-sm text-gray-900">{item.received || 0}</td>
                            <td className="px-4 py-2 text-sm">
                              {remainingQuantity > 0 ? (
                                <span className="text-blue-600 font-medium">{remainingQuantity}</span>
                              ) : (
                                <span className="bg-green-100 text-green-800 text-xs font-medium px-2 py-0.5 rounded">Complet</span>
                              )}
                            </td>
                            <td className="px-4 py-2 text-sm text-gray-900">
                              {formatCurrency(item.unitPrice)}
                            </td>
                            <td className="px-4 py-2 text-sm text-blue-600">
                              {formatCurrency(taxAmount)} ({taxRate}%)
                            </td>
                            <td className="px-4 py-2 text-sm font-medium text-gray-900">
                              {formatCurrency(item.total)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Order Totals */}
              <div className="mt-8 bg-gray-50 rounded-lg p-4">
                <h4 className="font-medium text-gray-900 mb-4">Récapitulatif (prix TTC)</h4>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Sous-total HT:</span>
                    <span className="font-medium">{formatCurrency(selectedOrder.subtotal)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">TVA:</span>
                    <span className="font-medium text-blue-600">{formatCurrency(selectedOrder.tax)}</span>
                  </div>
                  <div className="border-t border-gray-200 pt-2">
                    <div className="flex justify-between text-lg font-bold">
                      <span>Total TTC:</span>
                      <span className="text-blue-600">{formatCurrency(selectedOrder.total)}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="mt-8 flex justify-end space-x-3">
                {canReceiveItems(selectedOrder) && (
                  <button
                    onClick={() => {
                      handleReceiveItems(selectedOrder);
                    }}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center space-x-2"
                  >
                    <Truck className="w-4 h-4" />
                    <span>Réceptionner articles</span>
                  </button>
                )}
                <button
                  onClick={() => {
                    handleEditOrder(selectedOrder);
                    setSelectedOrder(null);
                  }}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center space-x-2"
                >
                  <Edit className="w-4 h-4" />
                  <span>Modifier</span>
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

export default PurchaseOrders;