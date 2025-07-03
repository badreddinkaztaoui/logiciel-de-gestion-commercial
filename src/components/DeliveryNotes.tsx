import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  Edit, 
  Eye, 
  Trash2, 
  Download, 
  Search,
  FileText,
  Truck,
  Calendar,
  User,
  Package,
  CheckCircle,
  X,
  AlertCircle,
  Printer,
  Loader2,
  Clock
} from 'lucide-react';
import { deliveryNoteService } from '../services/deliveryNoteService';
import { orderService } from '../services/orderService';
import { DeliveryNote, WooCommerceOrder } from '../types';
import { formatCurrency, formatDate } from '../utils/formatters';
import DeliveryNoteForm from './DeliveryNoteForm';

const DeliveryNotes: React.FC = () => {
  const [deliveryNotes, setDeliveryNotes] = useState<DeliveryNote[]>([]);
  const [orders, setOrders] = useState<WooCommerceOrder[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingNote, setEditingNote] = useState<DeliveryNote | null>(null);
  const [sourceOrder, setSourceOrder] = useState<WooCommerceOrder | null>(null);
  const [selectedNote, setSelectedNote] = useState<DeliveryNote | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const savedNotes = await deliveryNoteService.getDeliveryNotes();
      const savedOrders = await orderService.getOrders();
      
      setDeliveryNotes(savedNotes);
      setOrders(savedOrders);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateNote = () => {
    setEditingNote(null);
    setSourceOrder(null);
    setShowForm(true);
  };

  const handleCreateFromOrder = (order: WooCommerceOrder) => {
    setEditingNote(null);
    setSourceOrder(order);
    setShowForm(true);
  };

  const handleEditNote = (note: DeliveryNote) => {
    setEditingNote(note);
    setSourceOrder(null);
    setShowForm(true);
  };

  const handleSaveNote = async (note: DeliveryNote) => {
    try {
      await deliveryNoteService.saveDeliveryNote(note);
      await loadData();
      setShowForm(false);
      setEditingNote(null);
      setSourceOrder(null);
    } catch (error) {
      console.error('Error saving note:', error);
      alert('Erreur lors de la sauvegarde du bon de livraison');
    }
  };

  const handleCancelForm = () => {
    setShowForm(false);
    setEditingNote(null);
    setSourceOrder(null);
  };

  const handleDeleteNote = async (noteId: string) => {
    if (window.confirm('Êtes-vous sûr de vouloir supprimer ce bon de livraison ?')) {
      try {
        await deliveryNoteService.deleteDeliveryNote(noteId);
        await loadData();
      } catch (error) {
        console.error('Error deleting note:', error);
        alert('Erreur lors de la suppression du bon de livraison');
      }
    }
  };

  const handleUpdateStatus = async (note: DeliveryNote, newStatus: 'pending' | 'in_transit' | 'delivered' | 'cancelled') => {
    try {
      const updatedNote = { ...note, status: newStatus };
      
      if (newStatus === 'delivered') {
        // Add delivery date if not present
        updatedNote.notes = (updatedNote.notes || '') + 
          `\nLivré le ${new Date().toLocaleDateString('fr-FR')}`;
          
        // If linked to a WooCommerce order, update its status
        if (updatedNote.orderId) {
          try {
            await wooCommerceService.updateOrderStatus(updatedNote.orderId, 'completed');
            console.log(`WooCommerce order status updated: Order #${updatedNote.orderId} marked as completed`);
          } catch (error) {
            console.error('Error updating WooCommerce order status:', error);
          }
        }
      }
      
      await deliveryNoteService.saveDeliveryNote(updatedNote);
      await loadData();
      
      // Update selected note if open
      if (selectedNote?.id === note.id) {
        setSelectedNote(updatedNote);
      }
    } catch (error) {
      console.error('Error updating delivery note status:', error);
      alert('Erreur lors de la mise à jour du statut');
    }
  };

  const handlePrintNote = (note: DeliveryNote) => {
    // Create print-friendly version
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
              ${note.estimatedDeliveryDate ? `<div><strong>Livraison estimée :</strong> ${formatDate(note.estimatedDeliveryDate)}</div>` : ''}
              <div><strong>Statut :</strong> <span class="status-badge status-${note.status}">${getStatusLabel(note.status)}</span></div>
            </div>
          </div>
          
          <div class="customer-details">
            <div><strong>Client :</strong> ${note.customer.name}</div>
            ${note.customer.company ? `<div><strong>Entreprise :</strong> ${note.customer.company}</div>` : ''}
            <div><strong>Adresse de livraison :</strong> ${note.customer.address}, ${note.customer.city}, ${note.customer.postalCode}</div>
            <div>${note.customer.country}</div>
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
                         note.customer.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (note.customer.company && note.customer.company.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const matchesStatus = statusFilter === 'all' || note.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
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
      case 'pending':
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
      case 'pending':
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

  if (showForm) {
    return (
      <DeliveryNoteForm
        editingNote={editingNote}
        sourceOrder={sourceOrder}
        onSave={handleSaveNote}
        onCancel={handleCancelForm}
      />
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600">Chargement des bons de livraison...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center space-y-4 sm:space-y-0">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Bons de Livraison</h1>
          <p className="text-gray-600">Gérez les livraisons à vos clients</p>
        </div>

        <button
          onClick={handleCreateNote}
          className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          <span>Nouveau bon de livraison</span>
        </button>
      </div>

      {/* Stats Overview */}
      <DeliveryStats />

      {/* Filters */}
      <div className="flex flex-col md:flex-row space-y-4 md:space-y-0 md:space-x-4">
        <div className="relative md:flex-grow">
          <Search className="w-5 h-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Rechercher bons de livraison..."
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
            <option value="pending">En attente</option>
            <option value="in_transit">En transit</option>
            <option value="delivered">Livrés</option>
            <option value="cancelled">Annulés</option>
          </select>
        </div>
      </div>

      {/* Delivery Notes List */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Bon de Livraison
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Client
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Livraison estimée
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Statut
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Nb articles
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredNotes.map((note) => (
                <tr key={note.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="flex-shrink-0 h-10 w-10 bg-green-100 rounded-full flex items-center justify-center">
                        <Truck className="w-6 h-6 text-green-600" />
                      </div>
                      <div className="ml-4">
                        <div className="text-sm font-medium text-gray-900">{note.number}</div>
                        <div className="text-xs text-gray-500">
                          {note.orderId && (
                            <span className="inline-block">Commande #{note.orderId}</span>
                          )}
                          {note.invoiceId && (
                            <span className="inline-block ml-2">Facture liée</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm font-medium text-gray-900">{note.customer.name}</div>
                    {note.customer.company && (
                      <div className="text-xs text-gray-500">{note.customer.company}</div>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center text-sm text-gray-900">
                      <Calendar className="w-4 h-4 mr-2 text-gray-500" />
                      {formatDate(note.date)}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center text-sm text-gray-900">
                      <Truck className="w-4 h-4 mr-2 text-gray-500" />
                      {note.estimatedDeliveryDate ? formatDate(note.estimatedDeliveryDate) : 'Non définie'}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      {getStatusIcon(note.status)}
                      <span className={`ml-2 inline-flex px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(note.status)}`}>
                        {getStatusLabel(note.status)}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-center font-medium">
                    {note.items.length}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => setSelectedNote(note)}
                        className="text-blue-600 hover:text-blue-900 p-1 hover:bg-blue-50 rounded"
                        title="Voir détails"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      {note.status === 'pending' && (
                        <>
                          <button
                            onClick={() => handleEditNote(note)}
                            className="text-green-600 hover:text-green-900 p-1 hover:bg-green-50 rounded"
                            title="Modifier"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleUpdateStatus(note, 'in_transit')}
                            className="text-blue-600 hover:text-blue-900 p-1 hover:bg-blue-50 rounded"
                            title="Marquer en transit"
                          >
                            <Truck className="w-4 h-4" />
                          </button>
                        </>
                      )}
                      {note.status === 'in_transit' && (
                        <button
                          onClick={() => handleUpdateStatus(note, 'delivered')}
                          className="text-green-600 hover:text-green-900 p-1 hover:bg-green-50 rounded"
                          title="Marquer comme livré"
                        >
                          <CheckCircle className="w-4 h-4" />
                        </button>
                      )}
                      <button
                        onClick={() => handlePrintNote(note)}
                        className="text-purple-600 hover:text-purple-900 p-1 hover:bg-purple-50 rounded"
                        title="Imprimer"
                      >
                        <Printer className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteNote(note.id)}
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

        {filteredNotes.length === 0 && (
          <div className="text-center py-12">
            <Truck className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">Aucun bon de livraison trouvé</h3>
            <p className="text-gray-500 mb-4">
              {deliveryNotes.length === 0 
                ? "Créez votre premier bon de livraison"
                : "Aucun bon de livraison ne correspond à vos critères de recherche"
              }
            </p>
            {deliveryNotes.length === 0 && (
              <button
                onClick={handleCreateNote}
                className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                <Plus className="w-4 h-4 mr-2" />
                Ajouter maintenant
              </button>
            )}
          </div>
        )}
      </div>

      {/* Order Selection Section */}
      {orders.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Créer à partir d'une commande</h2>
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
                    Action
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {orders
                  .filter(order => order.status === 'processing' || order.status === 'on-hold')
                  .slice(0, 5)
                  .map((order) => (
                    <tr key={order.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">#{order.number}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">{order.billing.first_name} {order.billing.last_name}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {formatDate(order.date_created)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800">
                          {order.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <button
                          onClick={() => handleCreateFromOrder(order)}
                          className="text-blue-600 hover:text-blue-900"
                        >
                          Créer bon de livraison
                        </button>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Delivery Note Details Modal */}
      {selectedNote && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
              <h3 className="text-lg font-semibold">Bon de livraison {selectedNote.number}</h3>
              <div className="flex items-center space-x-3">
                <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(selectedNote.status)}`}>
                  {getStatusIcon(selectedNote.status)}
                  <span className="ml-1">{getStatusLabel(selectedNote.status)}</span>
                </span>
                <button
                  onClick={() => setSelectedNote(null)}
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
                    <User className="w-4 h-4 mr-2" />
                    Informations client
                  </h4>
                  <div className="space-y-2 text-sm">
                    <p><span className="text-gray-600">Nom:</span> {selectedNote.customer.name}</p>
                    {selectedNote.customer.company && (
                      <p><span className="text-gray-600">Entreprise:</span> {selectedNote.customer.company}</p>
                    )}
                    <p><span className="text-gray-600">Adresse:</span> {selectedNote.customer.address}, {selectedNote.customer.city}</p>
                  </div>
                </div>
                <div>
                  <h4 className="font-medium text-gray-900 mb-3 flex items-center">
                    <Calendar className="w-4 h-4 mr-2" />
                    Détails livraison
                  </h4>
                  <div className="space-y-2 text-sm">
                    <p><span className="text-gray-600">Date de création:</span> {formatDate(selectedNote.date)}</p>
                    {selectedNote.estimatedDeliveryDate && (
                      <p><span className="text-gray-600">Livraison estimée:</span> {formatDate(selectedNote.estimatedDeliveryDate)}</p>
                    )}
                    <p><span className="text-gray-600">Statut:</span> {getStatusLabel(selectedNote.status)}</p>
                    {selectedNote.orderId && (
                      <p><span className="text-gray-600">Commande liée:</span> #{selectedNote.orderId}</p>
                    )}
                  </div>
                </div>
              </div>

              <div>
                <h4 className="font-medium text-gray-900 mb-3">Articles</h4>
                <div className="space-y-2">
                  {selectedNote.items.map((item, index) => (
                    <div key={index} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                      <div>
                        <p className="font-medium text-gray-900">{item.description}</p>
                        <p className="text-sm text-gray-600">Quantité: {item.quantity}</p>
                      </div>
                      {item.delivered !== undefined && (
                        <div className="text-right">
                          <p className="text-sm text-gray-600">Livrés: {item.delivered}/{item.quantity}</p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {selectedNote.notes && (
                  <div className="mt-4">
                    <h5 className="font-medium text-gray-900 mb-2">Notes</h5>
                    <p className="text-sm bg-gray-50 p-3 rounded-lg whitespace-pre-line">{selectedNote.notes}</p>
                  </div>
                )}
              </div>

              <div className="mt-8 flex flex-wrap justify-end gap-3">
                {selectedNote.status === 'pending' && (
                  <>
                    <button
                      onClick={() => handleEditNote(selectedNote)}
                      className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300"
                    >
                      Modifier
                    </button>
                    <button
                      onClick={() => handleUpdateStatus(selectedNote, 'in_transit')}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                    >
                      Marquer en transit
                    </button>
                    <button
                      onClick={() => handleUpdateStatus(selectedNote, 'cancelled')}
                      className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
                    >
                      Annuler
                    </button>
                  </>
                )}

                {selectedNote.status === 'in_transit' && (
                  <button
                    onClick={() => handleUpdateStatus(selectedNote, 'delivered')}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                  >
                    Marquer comme livré
                  </button>
                )}

                <button
                  onClick={() => handlePrintNote(selectedNote)}
                  className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
                >
                  Imprimer
                </button>

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

// Stats component
const DeliveryStats = () => {
  const [stats, setStats] = useState({
    total: 0,
    pending: 0,
    inTransit: 0,
    delivered: 0,
    cancelled: 0
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadStats = async () => {
      try {
        setLoading(true);
        const noteStats = await deliveryNoteService.getDeliveryNoteStats();
        setStats(noteStats);
      } catch (error) {
        console.error('Error loading delivery note stats:', error);
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
            <p className="text-sm font-medium text-gray-600">Total</p>
            <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
          </div>
        </div>
      </div>
      
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex items-center">
          <div className="flex-shrink-0">
            <Clock className="w-8 h-8 text-yellow-600" />
          </div>
          <div className="ml-4">
            <p className="text-sm font-medium text-gray-600">En attente</p>
            <p className="text-2xl font-bold text-gray-900">{stats.pending}</p>
          </div>
        </div>
      </div>
      
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex items-center">
          <div className="flex-shrink-0">
            <Truck className="w-8 h-8 text-blue-600" />
          </div>
          <div className="ml-4">
            <p className="text-sm font-medium text-gray-600">En transit</p>
            <p className="text-2xl font-bold text-gray-900">{stats.inTransit}</p>
          </div>
        </div>
      </div>
      
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex items-center">
          <div className="flex-shrink-0">
            <CheckCircle className="w-8 h-8 text-green-600" />
          </div>
          <div className="ml-4">
            <p className="text-sm font-medium text-gray-600">Livrés</p>
            <p className="text-2xl font-bold text-gray-900">{stats.delivered}</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DeliveryNotes;