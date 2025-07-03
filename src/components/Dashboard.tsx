import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus } from 'lucide-react';

const Dashboard: React.FC = () => {
  const navigate = useNavigate();

  const handleCreateInvoice = () => {
    navigate('/invoices/create');
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center space-y-4 sm:space-y-0">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Tableau de bord</h1>
          <p className="text-gray-600 mt-2">Bienvenue dans votre espace de gestion commercial</p>
        </div>

        <button
          onClick={handleCreateInvoice}
          className="flex items-center space-x-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
        >
          <Plus className="w-5 h-5" />
          <span>Nouvelle facture</span>
        </button>
      </div>

      {/* Main Content Area */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8">
        <div className="text-center py-12">
          <div className="max-w-md mx-auto">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              Gestion commerciale simplifiée
            </h2>
            <p className="text-gray-600 leading-relaxed">
              Utilisez le menu de navigation pour accéder aux différentes fonctionnalités :
              commandes, factures, clients, et bien plus encore.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;