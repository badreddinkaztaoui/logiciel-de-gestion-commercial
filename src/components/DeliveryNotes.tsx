import React, { useState, useEffect } from 'react';
import {
  Plus,
  Edit,
  Eye,
  Trash2,
  Search,
  FileText,
  Truck,
  CheckCircle,
  X,
  Printer,
  Loader2,
  Clock,
  Download,
  Filter
} from 'lucide-react';
import { toast, Toaster } from 'react-hot-toast';
import { deliveryNoteService } from '../services/deliveryNoteService';
import { DeliveryNote } from '../types';
import { formatDate } from '../utils/formatters';
import DeliveryNoteForm from './DeliveryNoteForm';

const DeliveryNotes: React.FC = () => {
  const [deliveryNotes, setDeliveryNotes] = useState<DeliveryNote[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingNote, setEditingNote] = useState<DeliveryNote | null>(null);
  const [selectedNote, setSelectedNote] = useState<DeliveryNote | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    total: 0,
    pending: 0,
    inTransit: 0,
    delivered: 0,
    cancelled: 0
  });

  // Subscribe to real-time updates
  useEffect(() => {
    const subscription = deliveryNoteService.subscribeToDeliveryNotes((payload) => {
      loadData(); // Reload data when changes occur
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const savedNotes = await deliveryNoteService.getDeliveryNotes();

      setDeliveryNotes(savedNotes);

      const stats = {
        total: savedNotes.length,
        pending: savedNotes.filter(n => n.status === 'draft').length,
        inTransit: savedNotes.filter(n => n.status === 'in_transit').length,
        delivered: savedNotes.filter(n => n.status === 'delivered').length,
        cancelled: savedNotes.filter(n => n.status === 'cancelled').length
      };
      setStats(stats);
    } catch (error) {
      toast.error('Erreur lors du chargement des bons de livraison');
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateNote = () => {
    setEditingNote(null);
    setShowForm(true);
  };

  const handleEditNote = (note: DeliveryNote) => {
    setEditingNote(note);
    setShowForm(true);
  };

  const handleSaveNote = async (note: DeliveryNote) => {
    try {
      if (note.id) {
        await deliveryNoteService.updateDeliveryNote(note.id, note);
        toast.success('Bon de livraison mis à jour avec succès');
      } else {
        await deliveryNoteService.createDeliveryNote(note);
        toast.success('Bon de livraison créé avec succès');
      }
      await loadData();
      setShowForm(false);
      setEditingNote(null);
    } catch (error) {
      console.error('Error saving note:', error);
      toast.error('Erreur lors de la sauvegarde du bon de livraison');
    }
  };

  const handleCancelForm = () => {
    setShowForm(false);
    setEditingNote(null);
  };

  const handleDeleteNote = async (noteId: string) => {
    if (window.confirm('Êtes-vous sûr de vouloir supprimer ce bon de livraison ?')) {
      try {
        await deliveryNoteService.deleteDeliveryNote(noteId);
        toast.success('Bon de livraison supprimé avec succès');
        await loadData();
      } catch (error) {
        console.error('Error deleting note:', error);
        toast.error('Erreur lors de la suppression du bon de livraison');
      }
    }
  };

  const handleUpdateStatus = async (note: DeliveryNote, newStatus: 'draft' | 'in_transit' | 'delivered' | 'cancelled') => {
    try {
      let updatedNote;

      switch (newStatus) {
        case 'delivered':
          updatedNote = await deliveryNoteService.markAsDelivered(note.id);
          break;
        case 'in_transit':
          updatedNote = await deliveryNoteService.markAsInTransit(note.id);
          break;
        case 'cancelled':
          updatedNote = await deliveryNoteService.cancelDeliveryNote(note.id);
          break;
        default:
          note.status = newStatus;
          updatedNote = await deliveryNoteService.updateDeliveryNote(note.id, note);
      }

      await loadData();
      toast.success('Statut mis à jour avec succès');

      // Update selected note if open
      if (selectedNote?.id === note.id) {
        setSelectedNote(updatedNote);
      }
    } catch (error) {
      console.error('Error updating delivery note status:', error);
      toast.error('Erreur lors de la mise à jour du statut');
    }
  };

  const handlePrintNote = (note: DeliveryNote) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const printContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>Bon de Livraison ${note.number}</title>
          <style>
            body {
              font-family: Arial, sans-serif;
              margin: 0;
              padding: 20px;
            }
            .delivery-header {
              display: flex;
              justify-content: space-between;
              margin-bottom: 30px;
            }
            .delivery-title {
              font-size: 24px;
              font-weight: bold;
              color: #2563EB;
            }
            .delivery-details {
              margin-bottom: 20px;
            }
            .customer-details {
              margin-bottom: 20px;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              margin: 20px 0;
            }
            th, td {
              border: 1px solid #ddd;
              padding: 12px;
              text-align: left;
            }
            th {
              background-color: #f8f9fa;
              font-weight: bold;
            }
            .text-right {
              text-align: right;
            }
            .status-badge {
              display: inline-block;
              padding: 4px 8px;
              border-radius: 4px;
              font-size: 12px;
              font-weight: bold;
            }
            .status-pending {
              background-color: #FEF3C7;
              color: #92400E;
            }
            .status-transit {
              background-color: #DBEAFE;
              color: #1E40AF;
            }
            .status-delivered {
              background-color: #D1FAE5;
              color: #065F46;
            }
            .status-cancelled {
              background-color: #FEE2E2;
              color: #B91C1C;
            }
            .signature-section {
              margin-top: 40px;
              display: flex;
              justify-content: space-between;
            }
            .signature-box {
              border-top: 1px solid #ddd;
              width: 200px;
              padding-top: 10px;
              text-align: center;
            }
          </style>
        </head>
        <body>
          <div class="delivery-header">
            <div>
              <div class="delivery-title">BON DE LIVRAISON</div>
              <div>${note.number}</div>
            </div>
            <div>
              <div><strong>Date :</strong> ${formatDate(note.date)}</div>
              ${note.estimated_delivery_date ? `<div><strong>Livraison estimée :</strong> ${formatDate(note.estimated_delivery_date)}</div>` : ''}
              <div><strong>Statut :</strong> <span class="status-badge status-${note.status}">${getStatusLabel(note.status)}</span></div>
            </div>
          </div>

          <div class="customer-details">
            <div><strong>Client :</strong> ${note.customer_data?.name}</div>
            ${note.customer_data?.company ? `<div><strong>Entreprise :</strong> ${note.customer_data.company}</div>` : ''}
            <div><strong>Adresse de livraison :</strong> ${note.customer_data?.address}, ${note.customer_data?.city}, ${note.customer_data?.postalCode}</div>
            <div>${note.customer_data?.country}</div>
          </div>

          <table>
            <thead>
              <tr>
                <th>Description</th>
                <th>Quantité</th>
              </tr>
            </thead>
            <tbody>
              ${note.items.map(item => `
                <tr>
                  <td>${item.description}</td>
                  <td>${item.quantity}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>

          ${note.notes ? `
            <div style="margin-top: 30px; padding: 15px; background-color: #f8f9fa; border-radius: 5px;">
              <strong>Notes :</strong><br>
              ${note.notes.replace(/\n/g, '<br>')}
            </div>
          ` : ''}

          <div class="signature-section">
            <div class="signature-box">
              <p>Signature du livreur</p>
            </div>
            <div class="signature-box">
              <p>Signature du client</p>
            </div>
          </div>
        </body>
      </html>
    `;

    printWindow.document.write(printContent);
    printWindow.document.close();
    printWindow.onload = () => {
      printWindow.print();
    };
  };

  // Filter delivery notes
  const filteredNotes = deliveryNotes.filter(note => {
    const matchesSearch = note.number.toLowerCase().includes(searchTerm.toLowerCase()) ||
                        note.customer_data?.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || note.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'draft':
        return 'bg-yellow-100 text-yellow-800';
      case 'in_transit':
        return 'bg-blue-100 text-blue-800';
      case 'delivered':
        return 'bg-green-100 text-green-800';
      case 'cancelled':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'draft':
        return <Clock className="w-4 h-4" />;
      case 'in_transit':
        return <Truck className="w-4 h-4" />;
      case 'delivered':
        return <CheckCircle className="w-4 h-4" />;
      case 'cancelled':
        return <X className="w-4 h-4" />;
      default:
        return <FileText className="w-4 h-4" />;
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'draft':
        return 'En attente';
      case 'in_transit':
        return 'En transit';
      case 'delivered':
        return 'Livré';
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

  if (showForm) return (
    <DeliveryNoteForm
      editingNote={editingNote}
      onSave={handleSaveNote}
      onCancel={handleCancelForm}
    />
  );

  return (
    <div className="h-full flex flex-col">
      <Toaster position="top-right" />

      {/* Fixed Header Section */}
      <div className="flex-none space-y-2">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center space-y-4 sm:space-y-0 bg-white px-6 py-4 border-b">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Bons de livraison</h1>
            <p className="text-sm text-gray-600">Gérez vos bons de livraison et suivez leur statut</p>
          </div>

          <div className="flex items-center space-x-3">
            <button
              onClick={() => {/* TODO: Export functionality */}}
              className="flex items-center space-x-2 px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <Download className="w-4 h-4" />
              <span>Exporter</span>
            </button>

            <button
              onClick={handleCreateNote}
              className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>Nouveau bon</span>
            </button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="px-6">
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
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
                  <p className="text-xs font-medium text-gray-600">En attente</p>
                  <p className="text-lg font-bold text-orange-600">{stats.pending}</p>
                </div>
                <div className="p-2 bg-orange-100 rounded-full">
                  <Clock className="w-4 h-4 text-orange-600" />
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-gray-600">En transit</p>
                  <p className="text-lg font-bold text-blue-600">{stats.inTransit}</p>
                </div>
                <div className="p-2 bg-blue-100 rounded-full">
                  <Truck className="w-4 h-4 text-blue-600" />
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-gray-600">Livrés</p>
                  <p className="text-lg font-bold text-green-600">{stats.delivered}</p>
                </div>
                <div className="p-2 bg-green-100 rounded-full">
                  <CheckCircle className="w-4 h-4 text-green-600" />
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-gray-600">Annulés</p>
                  <p className="text-lg font-bold text-red-600">{stats.cancelled}</p>
                </div>
                <div className="p-2 bg-red-100 rounded-full">
                  <X className="w-4 h-4 text-red-600" />
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
                  placeholder="Rechercher par numéro, client..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div className="relative">
                <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="all">Tous les statuts</option>
                  <option value="draft">En attente</option>
                  <option value="in_transit">En transit</option>
                  <option value="delivered">Livré</option>
                  <option value="cancelled">Annulé</option>
                </select>
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
                  <th scope="col" className="sticky top-0 px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider w-64 bg-gray-50">
                    Client
                  </th>
                  <th scope="col" className="sticky top-0 px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider w-40 bg-gray-50">
                    Date
                  </th>
                  <th scope="col" className="sticky top-0 px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider w-32 bg-gray-50">
                    Statut
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
                {filteredNotes.map((note) => (
                  <tr key={note.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap w-32">
                      <div className="text-sm font-medium text-gray-900 text-center">
                        #{note.number}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap w-64">
                      <div className="flex flex-col items-center text-center">
                        <div className="text-sm text-gray-900">
                          {note.customer_data?.name}
                        </div>
                        {note.customer_data?.company && (
                          <div className="text-sm text-gray-500 truncate max-w-xs">
                            {note.customer_data.company}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 w-40 text-center">
                      {formatDate(note.date)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap w-32">
                      <div className="flex justify-center">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(note.status)}`}>
                          {getStatusLabel(note.status)}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap w-32">
                      <div className="flex justify-center space-x-2">
                        <button
                          onClick={() => handleEditNote(note)}
                          className="text-blue-600 hover:text-blue-900"
                          title="Modifier"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setSelectedNote(note)}
                          className="text-green-600 hover:text-green-900"
                          title="Voir détails"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        {note.status !== 'cancelled' && (
                          <button
                            onClick={() => handleUpdateStatus(note, 'cancelled')}
                            className="text-red-600 hover:text-red-900"
                            title="Annuler"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}

                {filteredNotes.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-6 py-4 text-center text-gray-500">
                      Aucun bon de livraison trouvé
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* View Modal */}
      {selectedNote && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-start mb-6">
                <h2 className="text-2xl font-bold text-gray-900">
                  Bon de livraison {selectedNote.number}
                </h2>
                <button
                  onClick={() => setSelectedNote(null)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              {/* Delivery Note Details */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">Informations client</h3>
                  <div className="space-y-2">
                    <p><strong>Nom:</strong> {selectedNote.customer_data?.name}</p>
                    {selectedNote.customer_data?.company && (
                      <p><strong>Société:</strong> {selectedNote.customer_data.company}</p>
                    )}
                    <p><strong>Email:</strong> {selectedNote.customer_data?.email}</p>
                    <p><strong>Adresse:</strong> {selectedNote.customer_data?.address}</p>
                    <p><strong>Ville:</strong> {selectedNote.customer_data?.city}</p>
                  </div>
                </div>

                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">Détails de livraison</h3>
                  <div className="space-y-2">
                    <p><strong>Date:</strong> {formatDate(selectedNote.date)}</p>
                    <p><strong>Statut:</strong>
                      <span className={`ml-2 inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(selectedNote.status)}`}>
                        {getStatusLabel(selectedNote.status)}
                      </span>
                    </p>
                    {selectedNote.orderId && (
                      <p><strong>Commande liée:</strong> #{selectedNote.orderId}</p>
                    )}
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
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {selectedNote.items.map((item, index) => (
                        <tr key={index}>
                          <td className="px-4 py-2 text-sm text-gray-900">
                            {item.description}
                          </td>
                          <td className="px-4 py-2 text-sm text-gray-900 text-right">
                            {item.quantity}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Actions */}
              <div className="mt-8 flex justify-end space-x-3">
                <button
                  onClick={() => handlePrintNote(selectedNote)}
                  className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
                >
                  <div className="flex items-center space-x-2">
                    <Printer className="w-4 h-4" />
                    <span>Imprimer</span>
                  </div>
                </button>
                <button
                  onClick={() => handleEditNote(selectedNote)}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Modifier
                </button>
                {selectedNote.status !== 'cancelled' && (
                  <button
                    onClick={() => {
                      handleUpdateStatus(selectedNote, 'cancelled');
                      setSelectedNote(null);
                    }}
                    className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
                  >
                    Annuler
                  </button>
                )}
                <button
                  onClick={() => setSelectedNote(null)}
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

export default DeliveryNotes;