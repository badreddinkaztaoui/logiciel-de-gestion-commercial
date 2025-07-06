import React, { useState, useEffect } from 'react';
import {
  Plus,
  Edit,
  Eye,
  Search,
  RotateCcw,
  CheckCircle,
  Clock,
  XCircle,
  Package,
  TrendingUp,
  Truck,
  Receipt
} from 'lucide-react';
import { returnNoteService } from '../services/returnNoteService';
import { ReturnNote } from '../types';
import { formatCurrency, formatDate } from '../utils/formatters';
import ReturnNoteForm from './ReturnNoteForm';

const ReturnNotes: React.FC = () => {
  const [returnNotes, setReturnNotes] = useState<ReturnNote[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingNote, setEditingNote] = useState<ReturnNote | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedNote, setSelectedNote] = useState<ReturnNote | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const savedNotes = await returnNoteService.getReturnNotes();
      setReturnNotes(savedNotes);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredNotes = returnNotes.filter(note => {
    const matchesSearch =
      note.number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (note.customer_data?.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (note.customer_data?.email || '').toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus = statusFilter === 'all' || note.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const getStatusBadge = (status: string) => {
    const statusConfig: { [key: string]: { bg: string; text: string; label: string } } = {
      'draft': { bg: 'bg-orange-100', text: 'text-orange-800', label: 'Brouillon' },
      'processed': { bg: 'bg-green-100', text: 'text-green-800', label: 'Traité' },
      'cancelled': { bg: 'bg-red-100', text: 'text-red-800', label: 'Annulé' }
    };

    const config = statusConfig[status] || { bg: 'bg-gray-100', text: 'text-gray-800', label: status };

    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${config.bg} ${config.text}`}>
        {config.label}
      </span>
    );
  };

  const handleCreateNote = () => {
    setEditingNote(null);
    setShowForm(true);
  };

  const handleEditNote = (note: ReturnNote) => {
    setEditingNote(note);
    setShowForm(true);
  };

  const handleSaveNote = async (savedNote: ReturnNote) => {
    try {
      // The note is already saved by the form, just update UI state
      await loadData(); // Reload to get fresh data
      setShowForm(false);
      setEditingNote(null);
    } catch (error) {
      console.error('Error handling saved note:', error);
      alert('Erreur lors de la mise à jour de l\'affichage');
    }
  };

  const handleCancelForm = () => {
    setShowForm(false);
    setEditingNote(null);
  };

  const handleCancelNote = async (noteId: string) => {
    if (window.confirm('Êtes-vous sûr de vouloir annuler ce bon de retour ?')) {
      try {
        await returnNoteService.cancelReturnNote(noteId);
        await loadData();
      } catch (error) {
        console.error('Error cancelling note:', error);
        alert('Erreur lors de l\'annulation du bon de retour');
      }
    }
  };

  const returnStats = {
    total: returnNotes.length,
    draft: returnNotes.filter(n => n.status === 'draft').length,
    processed: returnNotes.filter(n => n.status === 'processed').length,
    cancelled: returnNotes.filter(n => n.status === 'cancelled').length,
    totalValue: returnNotes.reduce((sum, note) =>
      sum + (note.items || []).reduce((itemSum: number, item: any) => itemSum + (item.refundAmount || 0), 0), 0)
  };

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Chargement des bons de retour...</p>
        </div>
      </div>
    );
  }

  if (showForm) {
    return (
      <ReturnNoteForm
        editingNote={editingNote}
        onSave={handleSaveNote}
        onCancel={handleCancelForm}
      />
    );
  }

  return (
    <div className="h-screen flex flex-col overflow-hidden pb-20">
      {/* Header */}
      <div className="flex-none p-6 bg-white border-b">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Bons de retour</h1>
            <p className="text-gray-600 mt-1">Gérez vos retours clients et remboursements</p>
          </div>
          <button
            onClick={handleCreateNote}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-lg shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            <Plus className="h-5 w-5 mr-2" />
            Nouveau retour
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Stats Section */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Total des retours</p>
                  <p className="text-2xl font-semibold text-gray-900">{returnStats.total}</p>
                </div>
                <div className="p-3 bg-blue-100 rounded-full">
                  <Package className="w-6 h-6 text-blue-600" />
                </div>
              </div>
              <div className="mt-4">
                <div className="flex items-center">
                  <TrendingUp className="w-4 h-4 text-green-500 mr-1" />
                  <span className="text-sm text-gray-600">
                    {formatCurrency(returnStats.totalValue)}
                  </span>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Brouillons</p>
                  <p className="text-2xl font-semibold text-gray-900">{returnStats.draft}</p>
                </div>
                <div className="p-3 bg-orange-100 rounded-full">
                  <Clock className="w-6 h-6 text-orange-600" />
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Traités</p>
                  <p className="text-2xl font-semibold text-gray-900">{returnStats.processed}</p>
                </div>
                <div className="p-3 bg-green-100 rounded-full">
                  <CheckCircle className="w-6 h-6 text-green-600" />
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Annulés</p>
                  <p className="text-2xl font-semibold text-gray-900">{returnStats.cancelled}</p>
                </div>
                <div className="p-3 bg-red-100 rounded-full">
                  <XCircle className="w-6 h-6 text-red-600" />
                </div>
              </div>
            </div>
          </div>

          {/* Search and Filters */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200">
            <div className="p-4">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Search className="h-5 w-5 text-gray-400" />
                    </div>
                    <input
                      type="text"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      placeholder="Rechercher par numéro ou client..."
                      className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <div className="min-w-[200px]">
                    <select
                      value={statusFilter}
                      onChange={(e) => setStatusFilter(e.target.value)}
                      className="block w-full pl-3 pr-10 py-2 text-base border border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-lg"
                    >
                      <option value="all">Tous les statuts</option>
                      <option value="draft">Brouillon</option>
                      <option value="processed">Traité</option>
                      <option value="cancelled">Annulé</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Table */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Numéro
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Client
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Documents liés
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Date
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Statut
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
                        <div className="text-sm font-medium text-gray-900">{note.number}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">{note.customer_data?.name || 'N/A'}</div>
                        <div className="text-xs text-gray-500">{note.customer_data?.email}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center space-x-2">
                          {note.invoice_id && (
                            <div className="flex items-center text-xs text-blue-600">
                              <Receipt className="w-4 h-4 mr-1" />
                              Facture
                            </div>
                          )}
                          {note.delivery_note_id && (
                            <div className="flex items-center text-xs text-green-600">
                              <Truck className="w-4 h-4 mr-1" />
                              BL
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">{formatDate(note.date)}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {getStatusBadge(note.status)}
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
                          {note.status !== 'cancelled' && (
                            <button
                              onClick={() => handleCancelNote(note.id)}
                              className="text-red-600 hover:text-red-900 p-1 hover:bg-red-50 rounded"
                              title="Annuler"
                            >
                              <XCircle className="w-4 h-4" />
                            </button>
                          )}
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
                    className="inline-flex items-center px-4 py-2 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Créer un bon de retour
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Details Modal */}
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
                    {selectedNote.invoice_id && (
                      <p className="flex items-center">
                        <Receipt className="w-4 h-4 text-blue-600 mr-1" />
                        <span className="text-gray-600">Facture liée</span>
                      </p>
                    )}
                    {selectedNote.delivery_note_id && (
                      <p className="flex items-center">
                        <Truck className="w-4 h-4 text-green-600 mr-1" />
                        <span className="text-gray-600">Bon de livraison lié</span>
                      </p>
                    )}
                  </div>
                </div>

                <div>
                  <h4 className="font-semibold text-gray-900 mb-3">Informations client</h4>
                  <div className="space-y-2 text-sm">
                    <p><span className="text-gray-600">Nom:</span> {selectedNote.customer_data?.name || 'N/A'}</p>
                    <p><span className="text-gray-600">Email:</span> {selectedNote.customer_data?.email || 'N/A'}</p>
                    {selectedNote.customer_data?.company && (
                      <p><span className="text-gray-600">Entreprise:</span> {selectedNote.customer_data.company}</p>
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
                        <th className="px-4 py-2 text-left text-sm font-medium text-gray-900">Raison</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {selectedNote.items.map((item: any) => (
                        <tr key={item.id}>
                          <td className="px-4 py-2 text-sm text-gray-900">
                            {item.description}
                          </td>
                          <td className="px-4 py-2 text-sm text-gray-900">{item.quantity}</td>
                          <td className="px-4 py-2 text-sm text-gray-600">{item.reason}</td>
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
                {selectedNote.status === 'draft' && (
                  <>
                    <button
                      onClick={() => handleEditNote(selectedNote)}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      Modifier
                    </button>
                  </>
                )}
                {selectedNote.status !== 'cancelled' && selectedNote.status !== 'draft' && (
                  <button
                    onClick={() => {
                      handleCancelNote(selectedNote.id);
                      setSelectedNote(null);
                    }}
                    className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors"
                  >
                    Annuler
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