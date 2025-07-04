import React, { useState, useEffect } from 'react';
import {
  Plus,
  Edit,
  Eye,
  Trash2,
  Search,
  RotateCcw,
  AlertCircle,
  CheckCircle,
  Clock,
  XCircle,
  DollarSign,
} from 'lucide-react';
import { orderService } from '../services/orderService';
import { returnNoteService } from '../services/returnNoteService';
import { wooCommerceService } from '../services/woocommerce';
import { ReturnNote, WooCommerceOrder } from '../types';
import { formatCurrency, formatDate } from '../utils/formatters';
import ReturnNoteForm from './ReturnNoteForm';

const ReturnNotes: React.FC = () => {
  const [returnNotes, setReturnNotes] = useState<ReturnNote[]>([]);
  const [orders, setOrders] = useState<WooCommerceOrder[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingNote, setEditingNote] = useState<ReturnNote | null>(null);
  const [sourceOrder, setSourceOrder] = useState<WooCommerceOrder | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedNote, setSelectedNote] = useState<ReturnNote | null>(null);
  const [processingNote, setProcessingNote] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const savedNotes = await returnNoteService.getReturnNotes();
      const { data: savedOrders } = await orderService.getOrders();
      setReturnNotes(savedNotes);
      setOrders(savedOrders);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredNotes = returnNotes.filter(note => {
    const matchesSearch =
      note.number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      note.customer.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      note.customer.email.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus = statusFilter === 'all' || note.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'approved':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'processed':
        return <CheckCircle className="w-4 h-4 text-blue-500" />;
      case 'pending':
        return <Clock className="w-4 h-4 text-orange-500" />;
      case 'rejected':
        return <XCircle className="w-4 h-4 text-red-500" />;
      default:
        return <AlertCircle className="w-4 h-4 text-gray-500" />;
    }
  };

  const getStatusBadge = (status: string) => {
    const statusConfig: { [key: string]: { bg: string; text: string; label: string } } = {
      'pending': { bg: 'bg-orange-100', text: 'text-orange-800', label: 'En attente' },
      'approved': { bg: 'bg-green-100', text: 'text-green-800', label: 'Approuvé' },
      'rejected': { bg: 'bg-red-100', text: 'text-red-800', label: 'Rejeté' },
      'processed': { bg: 'bg-blue-100', text: 'text-blue-800', label: 'Traité' },
    };

    const config = statusConfig[status] || { bg: 'bg-gray-100', text: 'text-gray-800', label: status };

    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${config.bg} ${config.text}`}>
        {config.label}
      </span>
    );
  };

  const getConditionBadge = (condition: string) => {
    const conditionConfig: { [key: string]: { bg: string; text: string; label: string } } = {
      'new': { bg: 'bg-green-100', text: 'text-green-800', label: 'Neuf' },
      'used': { bg: 'bg-yellow-100', text: 'text-yellow-800', label: 'Utilisé' },
      'damaged': { bg: 'bg-red-100', text: 'text-red-800', label: 'Endommagé' },
    };

    const config = conditionConfig[condition] || { bg: 'bg-gray-100', text: 'text-gray-800', label: condition };

    return (
      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${config.bg} ${config.text}`}>
        {config.label}
      </span>
    );
  };

  const handleCreateNote = async () => {
    setEditingNote(null);
    setSourceOrder(null);
    setShowForm(true);
  };

  const handleCreateFromOrder = (order: WooCommerceOrder) => {
    setSourceOrder(order);
    setEditingNote(null);
    setShowForm(true);
  };

  const handleEditNote = (note: ReturnNote) => {
    setEditingNote(note);
    setSourceOrder(null);
    setShowForm(true);
  };

  const handleSaveNote = async (note: ReturnNote) => {
    try {
      if (note.id) {
        await returnNoteService.updateReturnNote(note.id, note);
      } else {
        await returnNoteService.createReturnNote(note);
      }
      await loadData();
      setShowForm(false);
      setEditingNote(null);
      setSourceOrder(null);
    } catch (error) {
      console.error('Error saving note:', error);
      alert('Erreur lors de la sauvegarde du bon de retour');
    }
  };

  const handleCancelForm = () => {
    setShowForm(false);
    setEditingNote(null);
    setSourceOrder(null);
  };

  const handleDeleteNote = async (noteId: string) => {
    if (window.confirm('Êtes-vous sûr de vouloir supprimer ce bon de retour ?')) {
      try {
        await returnNoteService.deleteReturnNote(noteId);
        await loadData();
      } catch (error) {
        console.error('Error deleting note:', error);
        alert('Erreur lors de la suppression du bon de retour');
      }
    }
  };

  const areAllItemsReturned = (orderId: number): boolean => {
    const order = orders.find(o => o.id === orderId);
    if (!order) return false;

    const orderReturnNotes = returnNotes.filter(note => note.orderId === orderId &&
      (note.status === 'approved' || note.status === 'processed'));

    if (orderReturnNotes.length === 0) return false;

    const originalItemQuantities: Record<number, number> = {};
    order.line_items.forEach(item => {
      originalItemQuantities[item.product_id] = (originalItemQuantities[item.product_id] || 0) + item.quantity;
    });

    const returnedItemQuantities: Record<number, number> = {};
    orderReturnNotes.forEach(note => {
      note.items.forEach(item => {
        if (item.productId) {
          returnedItemQuantities[item.productId] = (returnedItemQuantities[item.productId] || 0) + item.quantity;
        }
      });
    });

    for (const productId in originalItemQuantities) {
      const originalQty = originalItemQuantities[productId];
      const returnedQty = returnedItemQuantities[productId] || 0;

      if (returnedQty < originalQty) {
        return false;
      }
    }

    return true;
  };

  const handleApproveNote = async (note: ReturnNote) => {
    if (window.confirm('Approuver ce bon de retour ? Le stock sera mis à jour automatiquement.')) {
      try {
        setProcessingNote(note.id);

        const updatedNote = { ...note, status: 'approved' as const };

        await processReturnUpdates(updatedNote);

        await returnNoteService.updateReturnNote(updatedNote.id, updatedNote);

        await loadData();

        if (selectedNote?.id === note.id) {
          setSelectedNote(updatedNote);
        }

        alert('Bon de retour approuvé avec succès ! Le stock WooCommerce a été mis à jour.');
      } catch (error) {
        console.error('Erreur lors de l\'approbation:', error);
        alert('Erreur lors de l\'approbation du bon de retour: ' + (error as Error).message);
      } finally {
        setProcessingNote(null);
      }
    }
  };

  const handleRejectNote = async (note: ReturnNote) => {
    const reason = window.prompt('Raison du rejet (optionnel):');
    if (reason !== null) {
      try {
        setProcessingNote(note.id);

        const updatedNote = {
          ...note,
          status: 'rejected' as const,
          notes: note.notes ? `${note.notes}\n\nRejeté: ${reason}` : `Rejeté: ${reason}`
        };
        await returnNoteService.updateReturnNote(updatedNote.id, updatedNote);

        if (note.orderId) {
          try {
            await wooCommerceService.addOrderNote(
              note.orderId,
              `Bon de retour ${note.number} rejeté. Raison: ${reason || 'Non spécifiée'}`,
              true
            );
          } catch (error) {
            console.error('Erreur lors de l\'ajout de la note à la commande:', error);
          }
        }

        await loadData();

        if (selectedNote?.id === note.id) {
          setSelectedNote(updatedNote);
        }
      } catch (error) {
        console.error('Erreur lors du rejet:', error);
        alert('Erreur lors du rejet du bon de retour');
      } finally {
        setProcessingNote(null);
      }
    }
  };

  const processReturnUpdates = async (note: ReturnNote) => {
    try {
      console.log('Traitement du retour:', note);

      for (const item of note.items) {
        if (item.productId && item.condition === 'new') {
          try {
            console.log(`Augmentation du stock pour le produit ${item.productId}: +${item.quantity}`);
            await wooCommerceService.increaseProductStock(item.productId, item.quantity);
            console.log(`Stock mis à jour avec succès pour le produit ${item.productId}`);
          } catch (error) {
            console.error(`Erreur lors de la mise à jour du stock pour le produit ${item.productId}:`, error);
          }
        }
      }

      if (note.orderId) {
        try {
          const noteText = `Bon de retour ${note.number} ${note.status === 'approved' ? 'approuvé' : 'traité'}. Raison: ${note.reason}. Articles retournés: ${note.items.length}`;
          await wooCommerceService.addOrderNote(note.orderId, noteText, true);
          console.log('Note ajoutée à la commande WooCommerce');
        } catch (error) {
          console.error('Erreur lors de l\'ajout de la note à la commande:', error);
        }
      }

      console.log('Traitement du retour terminé avec succès');
    } catch (error) {
      console.error('Erreur lors du traitement du retour:', error);
      throw error;
    }
  };

  const handleProcessNote = async (note: ReturnNote) => {
    if (window.confirm('Traiter ce bon de retour ? Cette action mettra à jour le stock WooCommerce et créera un remboursement.')) {
      try {
        setProcessingNote(note.id);

        if (note.orderId) {
          const shouldUpdateOrderStatus = areAllItemsReturned(note.orderId);

          try {
            const results = await wooCommerceService.processReturn(
              note.orderId,
              note.items,
              note.refundAmount || 0,
              note.reason || '',
              shouldUpdateOrderStatus
            );

            console.log('Return processed successfully:', results);

            if (shouldUpdateOrderStatus) {
              alert('Bon de retour traité avec succès ! Tous les articles ont été retournés, la commande a été marquée comme remboursée dans WooCommerce.');
            } else {
              alert('Bon de retour traité avec succès ! Le statut de la commande n\'a pas été modifié car tous les articles n\'ont pas été retournés.');
            }

          } catch (error) {
            console.error('Erreur WooCommerce:', error);
          }
        } else {
          await processReturnUpdates(note);
        }

        const updatedNote = { ...note, status: 'processed' as const };
        await returnNoteService.updateReturnNote(updatedNote.id, updatedNote);

        await loadData();

        if (selectedNote?.id === note.id) {
          setSelectedNote(updatedNote);
        }

      } catch (error) {
        console.error('Erreur lors du traitement:', error);
        alert('Erreur lors du traitement du bon de retour: ' + (error as Error).message);
      } finally {
        setProcessingNote(null);
      }
    }
  };

  const totalRefundAmount = returnNotes
    .filter(note => note.status === 'processed' && note.refundAmount)
    .reduce((sum, note) => sum + (note.refundAmount || 0), 0);

  if (showForm) {
    return (
      <ReturnNoteForm
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
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Chargement des bons de retour...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center space-y-4 sm:space-y-0">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Bons de retour</h1>
          <p className="text-gray-600">Gérez les retours de produits et remboursements</p>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={handleCreateNote}
            className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>Nouveau retour</span>
          </button>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Créer un retour à partir d'une commande</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {orders.slice(0, 6).map(order => (
            <div key={order.id} className="border border-gray-200 rounded-lg p-4 hover:border-blue-300 transition-colors">
              <div className="flex items-center justify-between mb-2">
                <span className="font-medium text-gray-900">#{order.number}</span>
                <span className="text-sm text-gray-500">{formatDate(order.date_created)}</span>
              </div>
              <p className="text-sm text-gray-600 mb-2">
                {order.billing.first_name} {order.billing.last_name}
              </p>
              <div className="flex items-center justify-between">
                <span className="font-medium text-gray-900">{formatCurrency(parseFloat(order.total))}</span>
                <button
                  onClick={() => handleCreateFromOrder(order)}
                  className="flex items-center space-x-1 px-3 py-1 bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition-colors"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span className="text-xs">Retour</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="w-5 h-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Rechercher bons de retour..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 pr-4 py-2 w-full border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        >
          <option value="all">Tous les statuts</option>
          <option value="pending">En attente</option>
          <option value="approved">Approuvés</option>
          <option value="rejected">Rejetés</option>
          <option value="processed">Traités</option>
        </select>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total retours</p>
              <p className="text-2xl font-bold text-gray-900">{returnNotes.length}</p>
            </div>
            <RotateCcw className="w-8 h-8 text-blue-600" />
          </div>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">En attente</p>
              <p className="text-2xl font-bold text-orange-600">
                {returnNotes.filter(note => note.status === 'pending').length}
              </p>
            </div>
            <Clock className="w-8 h-8 text-orange-600" />
          </div>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Approuvés</p>
              <p className="text-2xl font-bold text-green-600">
                {returnNotes.filter(note => note.status === 'approved').length}
              </p>
            </div>
            <CheckCircle className="w-8 h-8 text-green-600" />
          </div>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Remboursements</p>
              <p className="text-2xl font-bold text-purple-600">
                {formatCurrency(totalRefundAmount)}
              </p>
            </div>
            <DollarSign className="w-8 h-8 text-purple-600" />
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Bon de retour
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
                  Articles
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Remboursement
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
                      {getStatusIcon(note.status)}
                      <div className="ml-3">
                        <p className="text-sm font-medium text-gray-900">#{note.number}</p>
                        {note.orderId && (
                          <p className="text-sm text-gray-500">Commande #{note.orderId}</p>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div>
                      <p className="text-sm font-medium text-gray-900">{note.customer.name}</p>
                      <p className="text-sm text-gray-500">{note.customer.email}</p>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {formatDate(note.date)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {getStatusBadge(note.status)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {note.items.length} article(s)
                    <br />
                    <span className="text-xs text-gray-500">
                      {note.items.filter(item => item.productId && item.condition === 'new').length} remis en stock
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {note.refundAmount ? formatCurrency(note.refundAmount) : '-'}
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
                      <button
                        onClick={() => handleEditNote(note)}
                        className="text-green-600 hover:text-green-900 p-1 hover:bg-green-50 rounded"
                        title="Modifier"
                      >
                        <Edit className="w-4 h-4" />
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
            <RotateCcw className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">Aucun bon de retour trouvé</h3>
            <p className="text-gray-500 mb-4">
              {returnNotes.length === 0
                ? "Créez votre premier bon de retour"
                : "Aucun bon de retour ne correspond à vos critères de recherche"
              }
            </p>
            {returnNotes.length === 0 && (
              <button
                onClick={handleCreateNote}
                className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                <Plus className="w-4 h-4 mr-2" />
                Créer maintenant
              </button>
            )}
          </div>
        )}
      </div>

      {selectedNote && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center">
              <h3 className="text-lg font-semibold">Bon de retour #{selectedNote.number}</h3>
              <button
                onClick={() => setSelectedNote(null)}
                className="text-gray-400 hover:text-gray-600 text-2xl"
              >
                ×
              </button>
            </div>

            <div className="p-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h4 className="font-semibold text-gray-900 mb-3">Informations du retour</h4>
                  <div className="space-y-2 text-sm">
                    <p><span className="text-gray-600">Numéro:</span> #{selectedNote.number}</p>
                    <p><span className="text-gray-600">Date:</span> {formatDate(selectedNote.date)}</p>
                    <p><span className="text-gray-600">Statut:</span> {getStatusBadge(selectedNote.status)}</p>
                    <p><span className="text-gray-600">Raison:</span> {selectedNote.reason}</p>
                    {selectedNote.orderId && (
                      <p><span className="text-gray-600">Commande liée:</span> #{selectedNote.orderId}</p>
                    )}
                    {selectedNote.refundAmount && (
                      <p><span className="text-gray-600">Montant remboursé:</span> {formatCurrency(selectedNote.refundAmount)}</p>
                    )}
                  </div>
                </div>

                <div>
                  <h4 className="font-semibold text-gray-900 mb-3">Informations client</h4>
                  <div className="space-y-2 text-sm">
                    <p><span className="text-gray-600">Nom:</span> {selectedNote.customer.name}</p>
                    <p><span className="text-gray-600">Email:</span> {selectedNote.customer.email}</p>
                    {selectedNote.customer.company && (
                      <p><span className="text-gray-600">Entreprise:</span> {selectedNote.customer.company}</p>
                    )}
                  </div>
                </div>
              </div>

              <div>
                <h4 className="font-semibold text-gray-900 mb-3">Articles retournés</h4>
                <div className="overflow-x-auto">
                  <table className="min-w-full border border-gray-200 rounded-lg">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-2 text-left text-sm font-medium text-gray-900">Description</th>
                        <th className="px-4 py-2 text-left text-sm font-medium text-gray-900">Quantité</th>
                        <th className="px-4 py-2 text-left text-sm font-medium text-gray-900">État</th>
                        <th className="px-4 py-2 text-left text-sm font-medium text-gray-900">Stock</th>
                        <th className="px-4 py-2 text-left text-sm font-medium text-gray-900">Raison</th>
                        <th className="px-4 py-2 text-left text-sm font-medium text-gray-900">Remboursement</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {selectedNote.items.map((item) => (
                        <tr key={item.id}>
                          <td className="px-4 py-2 text-sm text-gray-900">
                            {item.description}
                            {item.productId && (
                              <p className="text-xs text-gray-500">ID: {item.productId}</p>
                            )}
                          </td>
                          <td className="px-4 py-2 text-sm text-gray-900">{item.quantity}</td>
                          <td className="px-4 py-2 text-sm">{getConditionBadge(item.condition)}</td>
                          <td className="px-4 py-2 text-sm">
                            {item.productId && item.condition === 'new' && (selectedNote.status === 'approved' || selectedNote.status === 'processed') ? (
                              <span className="text-green-600 font-medium">+{item.quantity} remis</span>
                            ) : (
                              <span className="text-gray-500">-</span>
                            )}
                          </td>
                          <td className="px-4 py-2 text-sm text-gray-600">{item.reason}</td>
                          <td className="px-4 py-2 text-sm font-medium text-gray-900">
                            {item.refundAmount ? formatCurrency(item.refundAmount) : '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {selectedNote.notes && (
                <div>
                  <h4 className="font-semibold text-gray-900 mb-3">Notes</h4>
                  <p className="text-sm text-gray-600 bg-gray-50 p-3 rounded-lg whitespace-pre-wrap">{selectedNote.notes}</p>
                </div>
              )}

              {/* Actions */}
              <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
                {selectedNote.status === 'pending' && (
                  <>
                    <button
                      onClick={() => handleApproveNote(selectedNote)}
                      disabled={processingNote === selectedNote.id}
                      className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
                    >
                      {processingNote === selectedNote.id ? 'Traitement...' : 'Approuver'}
                    </button>
                    <button
                      onClick={() => handleRejectNote(selectedNote)}
                      disabled={processingNote === selectedNote.id}
                      className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors"
                    >
                      Rejeter
                    </button>
                  </>
                )}
                {selectedNote.status === 'approved' && (
                  <button
                    onClick={() => handleProcessNote(selectedNote)}
                    disabled={processingNote === selectedNote.id}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                  >
                    {processingNote === selectedNote.id ? 'Traitement...' : 'Traiter retour'}
                  </button>
                )}
                <button
                  onClick={() => setSelectedNote(null)}
                  className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
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

export default ReturnNotes;