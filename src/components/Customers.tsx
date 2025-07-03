import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  Edit, 
  Eye, 
  Trash2, 
  Download, 
  Search,
  User,
  Mail,
  Phone,
  Building,
  MapPin,
  RefreshCw,
  Loader2,
  FileText,
  CheckCircle,
  AlertTriangle
} from 'lucide-react';
import { customerService } from '../services/customerService';
import { Customer } from '../types';
import { formatDate } from '../utils/formatters';
import CustomerForm from './CustomerForm';

const Customers: React.FC = () => {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'success' | 'error'>('idle');
  const [syncMessage, setSyncMessage] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    total: 0,
    withWooCommerceId: 0,
    withCompany: 0,
    withICE: 0
  });

  useEffect(() => {
    loadCustomers();
  }, []);

  const loadCustomers = async () => {
    try {
      setLoading(true);
      const savedCustomers = await customerService.getCustomers();
      setCustomers(savedCustomers);
      
      // Load stats
      const customerStats = await customerService.getCustomerStats();
      setStats(customerStats);
    } catch (error) {
      console.error('Error loading customers:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateCustomer = () => {
    setEditingCustomer(null);
    setShowForm(true);
  };

  const handleEditCustomer = (customer: Customer) => {
    setEditingCustomer(customer);
    setShowForm(true);
  };

  const handleDeleteCustomer = async (customerId: string) => {
    if (window.confirm('Êtes-vous sûr de vouloir supprimer ce client ?')) {
      try {
        await customerService.deleteCustomer(customerId);
        await loadCustomers();
      } catch (error) {
        console.error('Error deleting customer:', error);
        alert('Erreur lors de la suppression du client');
      }
    }
  };

  const handleSaveCustomer = async (customer: Customer) => {
    try {
      await customerService.saveCustomer(customer, false);
      await loadCustomers();
      setShowForm(false);
      setEditingCustomer(null);
    } catch (error) {
      console.error('Error saving customer:', error);
      alert('Erreur lors de la sauvegarde du client');
    }
  };

  const handleSyncWithWooCommerce = async () => {
    try {
      setSyncStatus('syncing');
      setSyncMessage('Synchronisation en cours avec WooCommerce...');
      
      const result = await customerService.syncWithWooCommerce();
      
      setSyncStatus('success');
      setSyncMessage(`Synchronisation réussie: ${result.importedCount} clients importés, ${result.updatedCount} mis à jour, ${result.skippedCount} ignorés.`);
      
      // Reload customers
      await loadCustomers();
      
      // Clear success message after 5 seconds
      setTimeout(() => {
        if (syncStatus === 'success') {
          setSyncStatus('idle');
        }
      }, 5000);
    } catch (error) {
      console.error('Error syncing with WooCommerce:', error);
      setSyncStatus('error');
      setSyncMessage('Erreur lors de la synchronisation avec WooCommerce');
    }
  };

  // Filter customers
  const filteredCustomers = customers.filter(customer => {
    return (
      customer.firstName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      customer.lastName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      customer.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (customer.company && customer.company.toLowerCase().includes(searchTerm.toLowerCase()))
    );
  });

  if (showForm) {
    return (
      <CustomerForm
        editingCustomer={editingCustomer}
        onSave={handleSaveCustomer}
        onCancel={() => {
          setShowForm(false);
          setEditingCustomer(null);
        }}
      />
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600">Chargement des clients...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center space-y-4 sm:space-y-0">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Clients</h1>
          <p className="text-gray-600">Gérez vos clients pour les factures et devis</p>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={handleSyncWithWooCommerce}
            className={`flex items-center space-x-2 px-4 py-2 border border-gray-300 rounded-lg ${
              syncStatus === 'syncing' ? 'bg-blue-50 border-blue-300' : 'hover:bg-gray-50'
            } transition-colors`}
            disabled={syncStatus === 'syncing'}
          >
            <RefreshCw className={`w-4 h-4 ${syncStatus === 'syncing' ? 'animate-spin text-blue-500' : ''}`} />
            <span>{syncStatus === 'syncing' ? 'Synchronisation...' : 'Sync WooCommerce'}</span>
          </button>
          <button
            onClick={handleCreateCustomer}
            className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>Nouveau client</span>
          </button>
        </div>
      </div>

      {/* Sync Status Message */}
      {syncStatus !== 'idle' && (
        <div className={`p-4 rounded-lg ${
          syncStatus === 'success' ? 'bg-green-50 border border-green-200' : 
          syncStatus === 'error' ? 'bg-red-50 border border-red-200' : 
          'bg-blue-50 border border-blue-200'
        }`}>
          <div className="flex items-center">
            {syncStatus === 'syncing' && <Loader2 className="w-5 h-5 mr-2 text-blue-500 animate-spin" />}
            {syncStatus === 'success' && <CheckCircle className="w-5 h-5 mr-2 text-green-500" />}
            {syncStatus === 'error' && <AlertTriangle className="w-5 h-5 mr-2 text-red-500" />}
            <p className={`text-sm ${
              syncStatus === 'success' ? 'text-green-700' : 
              syncStatus === 'error' ? 'text-red-700' : 
              'text-blue-700'
            }`}>
              {syncMessage}
            </p>
          </div>
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <User className="w-8 h-8 text-blue-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Total clients</p>
              <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <Building className="w-8 h-8 text-green-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Entreprises</p>
              <p className="text-2xl font-bold text-gray-900">{stats.withCompany}</p>
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <RefreshCw className="w-8 h-8 text-purple-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">WooCommerce</p>
              <p className="text-2xl font-bold text-gray-900">{stats.withWooCommerceId}</p>
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <FileText className="w-8 h-8 text-orange-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Avec ICE</p>
              <p className="text-2xl font-bold text-gray-900">{stats.withICE}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex">
        <div className="relative flex-1">
          <Search className="w-5 h-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Rechercher clients..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 pr-4 py-2 w-full border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
      </div>

      {/* Customers List */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Client
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Contact
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Entreprise
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Adresse
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  ICE
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredCustomers.map((customer) => (
                <tr key={customer.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="flex-shrink-0 h-10 w-10 bg-blue-100 rounded-full flex items-center justify-center">
                        <User className="w-6 h-6 text-blue-600" />
                      </div>
                      <div className="ml-4">
                        <div className="text-sm font-medium text-gray-900">{customer.firstName} {customer.lastName}</div>
                        {customer.wooCommerceId && (
                          <div className="text-xs text-purple-600">WooCommerce ID: {customer.wooCommerceId}</div>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">
                      <div className="flex items-center">
                        <Mail className="w-4 h-4 mr-2 text-gray-500" />
                        {customer.email}
                      </div>
                      {customer.phone && (
                        <div className="flex items-center mt-1">
                          <Phone className="w-4 h-4 mr-2 text-gray-500" />
                          {customer.phone}
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">
                      {customer.company ? (
                        <div className="flex items-center">
                          <Building className="w-4 h-4 mr-2 text-gray-500" />
                          {customer.company}
                        </div>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {customer.address ? (
                      <div className="text-sm text-gray-900 flex items-center">
                        <MapPin className="w-4 h-4 mr-2 text-gray-500" />
                        {customer.city || customer.address}
                      </div>
                    ) : (
                      <span className="text-sm text-gray-400">-</span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">
                      {customer.ice ? customer.ice : <span className="text-gray-400">-</span>}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => setSelectedCustomer(customer)}
                        className="text-blue-600 hover:text-blue-900 p-1 hover:bg-blue-50 rounded"
                        title="Voir détails"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleEditCustomer(customer)}
                        className="text-green-600 hover:text-green-900 p-1 hover:bg-green-50 rounded"
                        title="Modifier"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteCustomer(customer.id)}
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

        {filteredCustomers.length === 0 && (
          <div className="text-center py-12">
            <User className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">Aucun client trouvé</h3>
            <p className="text-gray-500 mb-4">
              {customers.length === 0 
                ? "Ajoutez votre premier client ou synchronisez avec WooCommerce"
                : "Aucun client ne correspond à vos critères de recherche"
              }
            </p>
            {customers.length === 0 && (
              <div className="flex flex-col sm:flex-row justify-center gap-2">
                <button
                  onClick={handleCreateCustomer}
                  className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Ajouter manuellement
                </button>
                <button
                  onClick={handleSyncWithWooCommerce}
                  className="inline-flex items-center px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
                >
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Synchroniser WooCommerce
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Customer Details Modal */}
      {selectedCustomer && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-2xl w-full">
            <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
              <h3 className="text-lg font-semibold">{selectedCustomer.firstName} {selectedCustomer.lastName}</h3>
              <button
                onClick={() => setSelectedCustomer(null)}
                className="text-gray-400 hover:text-gray-600 text-2xl"
              >
                ×
              </button>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h4 className="font-medium text-gray-900 mb-3 flex items-center">
                    <User className="w-4 h-4 mr-2" />
                    Informations personnelles
                  </h4>
                  <div className="space-y-2 text-sm">
                    <p><span className="text-gray-600">Nom complet:</span> {selectedCustomer.firstName} {selectedCustomer.lastName}</p>
                    <p><span className="text-gray-600">Email:</span> {selectedCustomer.email}</p>
                    {selectedCustomer.phone && (
                      <p><span className="text-gray-600">Téléphone:</span> {selectedCustomer.phone}</p>
                    )}
                    {selectedCustomer.wooCommerceId && (
                      <p className="flex items-center text-purple-600">
                        <RefreshCw className="w-3 h-3 mr-1" />
                        Synchronisé avec WooCommerce (ID: {selectedCustomer.wooCommerceId})
                      </p>
                    )}
                  </div>
                </div>
                <div>
                  <h4 className="font-medium text-gray-900 mb-3 flex items-center">
                    <Building className="w-4 h-4 mr-2" />
                    Informations entreprise
                  </h4>
                  <div className="space-y-2 text-sm">
                    {selectedCustomer.company ? (
                      <p><span className="text-gray-600">Entreprise:</span> {selectedCustomer.company}</p>
                    ) : (
                      <p className="text-gray-400">Aucune entreprise renseignée</p>
                    )}
                    {selectedCustomer.ice && (
                      <p><span className="text-gray-600">ICE:</span> {selectedCustomer.ice}</p>
                    )}
                  </div>
                </div>
              </div>
              <div className="mt-6">
                <h4 className="font-medium text-gray-900 mb-3 flex items-center">
                  <MapPin className="w-4 h-4 mr-2" />
                  Adresse
                </h4>
                {selectedCustomer.address ? (
                  <div className="space-y-1 text-sm">
                    <p>{selectedCustomer.address}</p>
                    {selectedCustomer.postalCode && selectedCustomer.city && (
                      <p>{selectedCustomer.postalCode} {selectedCustomer.city}</p>
                    )}
                    <p>{selectedCustomer.country}</p>
                  </div>
                ) : (
                  <p className="text-sm text-gray-400">Aucune adresse renseignée</p>
                )}
              </div>
              {selectedCustomer.notes && (
                <div className="mt-6">
                  <h4 className="font-medium text-gray-900 mb-2">Notes</h4>
                  <p className="text-sm bg-gray-50 p-3 rounded-lg">{selectedCustomer.notes}</p>
                </div>
              )}
              <div className="mt-6 text-sm text-gray-500">
                <p>Créé le {formatDate(selectedCustomer.createdAt)}</p>
                <p>Dernière mise à jour le {formatDate(selectedCustomer.updatedAt)}</p>
              </div>
              <div className="mt-8 flex justify-end space-x-3">
                <button
                  onClick={() => handleEditCustomer(selectedCustomer)}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Modifier
                </button>
                <button
                  onClick={() => setSelectedCustomer(null)}
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

export default Customers;