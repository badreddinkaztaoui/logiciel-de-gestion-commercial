import { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { useAuthStore } from './stores/authStore';
import LoginPage from './components/auth/LoginPage';
import ProtectedRoute from './components/auth/ProtectedRoute';
import Layout from './components/Layout';
import Orders from './components/Orders';
import Quotes from './components/Quotes';
import QuoteForm from './components/QuoteForm';
import Invoices from './components/Invoices';
import InvoiceForm from './components/InvoiceForm';
import DeliveryNotes from './components/DeliveryNotes';
import DeliveryNoteForm from './components/DeliveryNoteForm';
import ReturnNotes from './components/ReturnNotes';
import ReturnNoteForm from './components/ReturnNoteForm';
import Settings from './components/Settings';
import PurchaseOrders from './components/PurchaseOrders';
import Suppliers from './components/Suppliers';
import Customers from './components/Customers';
import SalesJournal from './components/SalesJournal';
import { deliveryNoteService } from './services/deliveryNoteService';
import { returnNoteService } from './services/returnNoteService';
import { toast } from 'react-hot-toast';
import { Toaster } from 'react-hot-toast';

const DeliveryNoteFormPage: React.FC = () => {
  const navigate = useNavigate();

  const handleSave = async (note: any) => {
    try {
      await deliveryNoteService.createDeliveryNote(note);
      toast.success('Bon de livraison créé avec succès');
      navigate('/delivery-notes');
    } catch (error) {
      console.error('Error saving delivery note:', error);
      toast.error('Erreur lors de la sauvegarde du bon de livraison');
    }
  };

  const handleCancel = () => {
    navigate('/delivery-notes');
  };

  return <DeliveryNoteForm onSave={handleSave} onCancel={handleCancel} />;
};

const ReturnNoteFormPage: React.FC = () => {
  const navigate = useNavigate();

  const handleSave = async (note: any) => {
    try {
      await returnNoteService.createReturnNote(note);
      toast.success('Bon de retour créé avec succès');
      navigate('/return-notes');
    } catch (error) {
      console.error('Error saving return note:', error);
      toast.error('Erreur lors de la sauvegarde du bon de retour');
    }
  };

  const handleCancel = () => {
    navigate('/return-notes');
  };

  return <ReturnNoteForm onSave={handleSave} onCancel={handleCancel} />;
};

const App: React.FC = () => {
  const { user, loading, initialize } = useAuthStore();

  useEffect(() => {
    initialize();
  }, [initialize]);

  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Chargement...</p>
        </div>
      </div>
    );
  }

  return (
    <Router>
      <Toaster position="top-right" />
      <Routes>
        {!user ? (
          <>
            <Route path="/login" element={<LoginPage />} />
            <Route path="*" element={<Navigate to="/login" replace />} />
          </>
        ) : (
          <>
            <Route path="/login" element={<Navigate to="/orders" replace />} />
            <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
              <Route index element={<Navigate to="/orders" replace />} />
              <Route path="dashboard" element={<Navigate to="/orders" replace />} />
              <Route path="orders" element={<Orders />} />
              <Route path="quotes" element={<Quotes />} />
              <Route path="quotes/new" element={<QuoteForm />} />
              <Route path="quotes/:id" element={<QuoteForm />} />
              <Route path="invoices" element={<Invoices />} />
              <Route path="invoices/create" element={<InvoiceForm />} />
              <Route path="invoices/edit/:id" element={<InvoiceForm />} />
              <Route path="sales-journal" element={<SalesJournal />} />
              <Route path="delivery" element={<DeliveryNotes />} />
              <Route path="delivery-notes" element={<DeliveryNotes />} />
              <Route path="delivery-notes/create" element={<DeliveryNoteFormPage />} />
              <Route path="returns" element={<ReturnNotes />} />
              <Route path="return-notes" element={<ReturnNotes />} />
              <Route path="return-notes/create" element={<ReturnNoteFormPage />} />
              <Route path="purchase-orders" element={<PurchaseOrders />} />
              <Route path="suppliers" element={<Suppliers />} />
              <Route path="clients" element={<Customers />} />
              <Route path="settings" element={<Settings />} />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </>
        )}
      </Routes>
    </Router>
  );
};

export default App;