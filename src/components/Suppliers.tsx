import React, { useState, useEffect } from 'react';
import {
  Plus,
  Edit,
  Eye,
  Trash2,
  Search,
  Building,
  Mail,
  Phone,
  MapPin,
  Package,
  FileText,
  Loader2
} from 'lucide-react';
import { supplierService } from '../services/supplierService';
import { Supplier } from '../types';
import { formatDate } from '../utils/formatters';
import SupplierForm from './SupplierForm';

const Suppliers: React.FC = () => {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    total: 0,
    withCompany: 0,
    withICE: 0
  });

  useEffect(() => {
    loadSuppliers();
  }, []);

  const loadSuppliers = async () => {
    try {
      setLoading(true);
      const savedSuppliers = await supplierService.getSuppliers();
      setSuppliers(savedSuppliers);

      // Calculate stats
      setStats({
        total: savedSuppliers.length,
        withCompany: savedSuppliers.filter(s => s.company).length,
        withICE: savedSuppliers.filter(s => s.ice).length
      });
    } catch (error) {
      console.error('Error loading suppliers:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredSuppliers = suppliers.filter(supplier => {
    const searchLower = searchTerm.toLowerCase();
    return (
      supplier.name.toLowerCase().includes(searchLower) ||
      (supplier.company && supplier.company.toLowerCase().includes(searchLower)) ||
      (supplier.email && supplier.email.toLowerCase().includes(searchLower))
    );
  });

  const handleCreateSupplier = () => {
    setEditingSupplier(null);
    setShowForm(true);
  };

  const handleEditSupplier = (supplier: Supplier) => {
    setEditingSupplier(supplier);
    setShowForm(true);
  };

  const handleDeleteSupplier = async (supplierId: string) => {
    if (window.confirm('Êtes-vous sûr de vouloir supprimer ce fournisseur ?')) {
      try {
        await supplierService.deleteSupplier(supplierId);
        await loadSuppliers();
      } catch (error) {
        console.error('Error deleting supplier:', error);
        alert('Erreur lors de la suppression du fournisseur');
      }
    }
  };

  const handleSaveSupplier = async (supplier: Supplier) => {
    try {
      await supplierService.saveSupplier(supplier);
      await loadSuppliers();
      setShowForm(false);
      setEditingSupplier(null);
    } catch (error) {
      console.error('Error saving supplier:', error);
      alert('Erreur lors de la sauvegarde du fournisseur');
    }
  };

  if (showForm) {
    return (
      <SupplierForm
        editingSupplier={editingSupplier}
        onSave={() => handleSaveSupplier(editingSupplier as Supplier)}
        onCancel={() => {
          setShowForm(false);
          setEditingSupplier(null);
        }}
      />
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600">Chargement des fournisseurs...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col p-6 space-y-6 overflow-y-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center space-y-4 sm:space-y-0">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Fournisseurs</h1>
          <p className="text-gray-600 text-sm">Gérez vos fournisseurs pour les bons de commande</p>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={handleCreateSupplier}
            className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>Nouveau fournisseur</span>
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
          <div className="flex items-center">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <Building className="w-5 h-5 text-blue-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Total fournisseurs</p>
              <p className="text-2xl font-semibold text-gray-900">{stats.total}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
          <div className="flex items-center">
            <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
              <Package className="w-5 h-5 text-green-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Avec entreprise</p>
              <p className="text-2xl font-semibold text-gray-900">{stats.withCompany}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
          <div className="flex items-center">
            <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
              <FileText className="w-5 h-5 text-orange-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Avec ICE</p>
              <p className="text-2xl font-semibold text-gray-900">{stats.withICE}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Search Bar */}
      <div className="flex">
        <div className="relative flex-1">
          <Search className="w-5 h-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Rechercher fournisseurs..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 pr-4 py-2 w-full border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
          />
        </div>
      </div>

      {/* Suppliers Table */}
      <div className="flex-1 bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Fournisseur
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
              {filteredSuppliers.map((supplier) => (
                <tr key={supplier.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                        <Building className="w-5 h-5 text-blue-600" />
                      </div>
                      <div className="ml-4">
                        <div className="text-sm font-medium text-gray-900">{supplier.name}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">
                      <div className="flex items-center">
                        <Mail className="w-4 h-4 mr-2 text-gray-400" />
                        {supplier.email || '-'}
                      </div>
                      {supplier.phone && (
                        <div className="flex items-center mt-1">
                          <Phone className="w-4 h-4 mr-2 text-gray-400" />
                          {supplier.phone}
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">
                      {supplier.company ? (
                        <div className="flex items-center">
                          <Building className="w-4 h-4 mr-2 text-gray-400" />
                          {supplier.company}
                        </div>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {supplier.address ? (
                      <div className="text-sm text-gray-900 flex items-center">
                        <MapPin className="w-4 h-4 mr-2 text-gray-400" />
                        {supplier.city || supplier.address}
                      </div>
                    ) : (
                      <span className="text-sm text-gray-400">-</span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">
                      {supplier.ice ? supplier.ice : <span className="text-gray-400">-</span>}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => setSelectedSupplier(supplier)}
                        className="text-blue-600 hover:text-blue-900 p-1 hover:bg-blue-50 rounded"
                        title="Voir détails"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleEditSupplier(supplier)}
                        className="text-green-600 hover:text-green-900 p-1 hover:bg-green-50 rounded"
                        title="Modifier"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteSupplier(supplier.id)}
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

        {filteredSuppliers.length === 0 && (
          <div className="text-center py-12">
            <Building className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">Aucun fournisseur trouvé</h3>
            <p className="text-gray-500 mb-4">
              {suppliers.length === 0
                ? "Ajoutez votre premier fournisseur"
                : "Aucun fournisseur ne correspond à vos critères de recherche"
              }
            </p>
            {suppliers.length === 0 && (
              <button
                onClick={handleCreateSupplier}
                className="inline-flex items-center px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700"
              >
                <Plus className="w-4 h-4 mr-2" />
                Ajouter un fournisseur
              </button>
            )}
          </div>
        )}
      </div>

      {/* Supplier Details Modal */}
      {selectedSupplier && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-2xl w-full">
            <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
              <h3 className="text-lg font-semibold text-gray-900">{selectedSupplier.name}</h3>
              <button
                onClick={() => setSelectedSupplier(null)}
                className="text-gray-400 hover:text-gray-600 text-2xl"
              >
                ×
              </button>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h4 className="font-medium text-gray-900 mb-3 flex items-center">
                    <Building className="w-4 h-4 mr-2" />
                    Informations fournisseur
                  </h4>
                  <div className="space-y-2 text-sm">
                    <p><span className="text-gray-500">Nom:</span> {selectedSupplier.name}</p>
                    {selectedSupplier.company && (
                      <p><span className="text-gray-500">Entreprise:</span> {selectedSupplier.company}</p>
                    )}
                    {selectedSupplier.ice && (
                      <p><span className="text-gray-500">ICE:</span> {selectedSupplier.ice}</p>
                    )}
                  </div>
                </div>
                <div>
                  <h4 className="font-medium text-gray-900 mb-3 flex items-center">
                    <Mail className="w-4 h-4 mr-2" />
                    Contact
                  </h4>
                  <div className="space-y-2 text-sm">
                    {selectedSupplier.email && (
                      <p><span className="text-gray-500">Email:</span> {selectedSupplier.email}</p>
                    )}
                    {selectedSupplier.phone && (
                      <p><span className="text-gray-500">Téléphone:</span> {selectedSupplier.phone}</p>
                    )}
                  </div>
                </div>
              </div>
              <div className="mt-6">
                <h4 className="font-medium text-gray-900 mb-3 flex items-center">
                  <MapPin className="w-4 h-4 mr-2" />
                  Adresse
                </h4>
                {selectedSupplier.address ? (
                  <div className="space-y-1 text-sm">
                    <p>{selectedSupplier.address}</p>
                    {selectedSupplier.postal_code && selectedSupplier.city && (
                      <p>{selectedSupplier.postal_code} {selectedSupplier.city}</p>
                    )}
                    <p>{selectedSupplier.country}</p>
                  </div>
                ) : (
                  <p className="text-sm text-gray-400">Aucune adresse renseignée</p>
                )}
              </div>
              {selectedSupplier.notes && (
                <div className="mt-6">
                  <h4 className="font-medium text-gray-900 mb-2">Notes</h4>
                  <p className="text-sm bg-gray-50 p-3 rounded-lg">{selectedSupplier.notes}</p>
                </div>
              )}
              <div className="mt-6 text-sm text-gray-500">
                {selectedSupplier.created_at && <p>Créé le {formatDate(selectedSupplier.created_at)}</p>}
                {selectedSupplier.updated_at && <p>Dernière mise à jour le {formatDate(selectedSupplier.updated_at)}</p>}
              </div>
              <div className="mt-8 flex justify-end space-x-3">
                <button
                  onClick={() => handleEditSupplier(selectedSupplier)}
                  className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700"
                >
                  Modifier
                </button>
                <button
                  onClick={() => setSelectedSupplier(null)}
                  className="px-4 py-2 border border-gray-200 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50"
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

export default Suppliers;