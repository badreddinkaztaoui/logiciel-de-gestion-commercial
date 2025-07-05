import React, { useState, useEffect } from 'react';
import {
  Plus,
  Edit,
  Eye,
  Trash2,
  Search,
  Building,
  CheckCircle,
  Clock,
  AlertCircle,
  Ban,
  TrendingUp,
  Receipt,
  Truck,
  Send,
  FileCheck,
  Package,
  Filter
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
  const [_, setSelectedOrder] = useState<PurchaseOrder | null>(null);
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

    if (searchTerm) {
      filtered = filtered.filter(order =>
        order.number.toLowerCase().includes(searchTerm.toLowerCase()) ||
        order.items.some(item =>
          item.description.toLowerCase().includes(searchTerm.toLowerCase())
        )
      );
    }

    if (statusFilter !== 'all') {
      filtered = filtered.filter(order => order.status === statusFilter);
    }

    if (supplierFilter !== 'all') {
      filtered = filtered.filter(order => order.supplier_id === supplierFilter);
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
      case 'sent':
        return <Send className="w-4 h-4 text-blue-500" />;
      case 'confirmed':
        return <FileCheck className="w-4 h-4 text-green-500" />;
      case 'received':
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
      sent: 'bg-blue-100 text-blue-800',
      confirmed: 'bg-green-100 text-green-800',
      received: 'bg-green-100 text-green-800',
      cancelled: 'bg-red-100 text-red-800'
    };

    const labelMap = {
      draft: 'Brouillon',
      sent: 'Envoyé',
      confirmed: 'Confirmé',
      received: 'Reçu',
      cancelled: 'Annulé'
    };

    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${colorMap[status as keyof typeof colorMap] || 'bg-gray-100 text-gray-800'}`}>
        {getStatusIcon(status)}
        <span className="ml-1">{labelMap[status as keyof typeof labelMap] || status}</span>
      </span>
    );
  };

  const getSupplierName = (supplierId: string | undefined) => {
    if (!supplierId) return 'Fournisseur inconnu';
    const supplier = suppliers.find(s => s.id === supplierId);
    return supplier ? supplier.name : 'Fournisseur inconnu';
  };

  const orderStats = {
    total: purchaseOrders.length,
    draft: purchaseOrders.filter(o => o.status === 'draft').length,
    pending: purchaseOrders.filter(o => o.status === 'sent').length,
    partial: purchaseOrders.filter(o => o.status === 'confirmed').length,
    complete: purchaseOrders.filter(o => o.status === 'received').length,
    totalValue: purchaseOrders.reduce((sum, order) => sum + order.total, 0)
  };

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center bg-gray-50">
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
    <div className="h-full flex flex-col bg-gray-50">
      {/* Header */}
      <div className="flex-none bg-white border-b border-gray-200 px-8 py-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Bons de commande</h1>
            <p className="mt-1 text-sm text-gray-600">
              Gérez vos commandes fournisseurs et suivez les réceptions
            </p>
          </div>
          <div>
            <button
              onClick={handleCreateOrder}
              className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Plus className="w-5 h-5" />
              <span>Nouveau bon de commande</span>
            </button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
          <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total</p>
                <p className="text-2xl font-bold text-gray-900">{orderStats.total}</p>
              </div>
              <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                <Receipt className="w-5 h-5 text-blue-600" />
              </div>
            </div>
          </div>

          <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Brouillons</p>
                <p className="text-2xl font-bold text-gray-900">{orderStats.draft}</p>
              </div>
              <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center">
                <Edit className="w-5 h-5 text-gray-600" />
              </div>
            </div>
          </div>

          <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Envoyés</p>
                <p className="text-2xl font-bold text-gray-900">{orderStats.pending}</p>
              </div>
              <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                <Send className="w-5 h-5 text-blue-600" />
              </div>
            </div>
          </div>

          <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Confirmés</p>
                <p className="text-2xl font-bold text-gray-900">{orderStats.partial}</p>
              </div>
              <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                <FileCheck className="w-5 h-5 text-green-600" />
              </div>
            </div>
          </div>

          <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Reçus</p>
                <p className="text-2xl font-bold text-gray-900">{orderStats.complete}</p>
              </div>
              <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                <CheckCircle className="w-5 h-5 text-green-600" />
              </div>
            </div>
          </div>

          <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Valeur totale</p>
                <p className="text-2xl font-bold text-blue-600">{formatCurrency(orderStats.totalValue)}</p>
              </div>
              <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-blue-600" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex-none bg-white border-b border-gray-200 px-8 py-4">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex-1 min-w-[240px]">
            <div className="relative">
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Rechercher par numéro ou description..."
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              <Search className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 transform -translate-y-1/2" />
            </div>
          </div>

          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <Filter className="w-4 h-4 text-gray-400" />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="pl-3 pr-8 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="all">Tous les statuts</option>
                <option value="draft">Brouillons</option>
                <option value="sent">Envoyés</option>
                <option value="confirmed">Confirmés</option>
                <option value="received">Reçus</option>
                <option value="cancelled">Annulés</option>
              </select>
            </div>

            <div className="flex items-center space-x-2">
              <Building className="w-4 h-4 text-gray-400" />
              <select
                value={supplierFilter}
                onChange={(e) => setSupplierFilter(e.target.value)}
                className="pl-3 pr-8 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
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
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 px-8 py-6 overflow-auto">
        {purchaseOrders.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mb-4">
              <Package className="w-8 h-8 text-blue-600" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              Aucun bon de commande
            </h3>
            <p className="text-gray-600 mb-6">
              Commencez par créer votre premier bon de commande
            </p>
            <button
              onClick={handleCreateOrder}
              className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Plus className="w-5 h-5" />
              <span>Nouveau bon de commande</span>
            </button>
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
              <Search className="w-8 h-8 text-gray-400" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              Aucun résultat trouvé
            </h3>
            <p className="text-gray-600">
              Essayez de modifier vos critères de recherche
            </p>
          </div>
        ) : (
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Numéro
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Fournisseur
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Date
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Statut
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Total
                    </th>
                    <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredOrders.map((order) => (
                    <tr key={order.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {order.number}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="flex-shrink-0 h-8 w-8 bg-blue-100 rounded-full flex items-center justify-center">
                            <Building className="w-4 h-4 text-blue-600" />
                          </div>
                          <div className="ml-3">
                            <div className="text-sm font-medium text-gray-900">
                              {getSupplierName(order.supplier_id)}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {formatDate(order.date)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {getStatusBadge(order.status)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-blue-600">
                        {formatCurrency(order.total)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex items-center justify-end space-x-2">
                          <button
                            onClick={() => handleEditOrder(order)}
                            className="p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title="Modifier"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          {order.status === 'confirmed' && (
                            <button
                              onClick={() => handleReceiveItems(order)}
                              className="p-2 text-gray-600 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                              title="Réceptionner"
                            >
                              <Truck className="w-4 h-4" />
                            </button>
                          )}
                          <button
                            onClick={() => handleDeleteOrder(order.id)}
                            className="p-2 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
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
          </div>
        )}
      </div>
    </div>
  );
};

export default PurchaseOrders;