import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Activity, TrendingUp, Users, DollarSign, ShoppingCart, Package } from 'lucide-react';

const Dashboard: React.FC = () => {
  const navigate = useNavigate();

  const handleCreateInvoice = () => {
    navigate('/invoices/create');
  };

  return (
    <div className="h-full flex flex-col">
      {/* Fixed Header Section */}
      <div className="flex-none space-y-2">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center space-y-4 sm:space-y-0 bg-white px-6 py-4 border-b">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Tableau de bord</h1>
            <p className="text-sm text-gray-600">Bienvenue dans votre espace de gestion commercial</p>
          </div>

          <button
            onClick={handleCreateInvoice}
            className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>Nouvelle facture</span>
          </button>
        </div>

        {/* Stats Cards Grid */}
        <div className="px-6">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-gray-600">Chiffre d'affaires</p>
                  <p className="text-lg font-bold text-gray-900">0 €</p>
                </div>
                <div className="p-2 bg-blue-100 rounded-full">
                  <DollarSign className="w-4 h-4 text-blue-600" />
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-gray-600">Commandes</p>
                  <p className="text-lg font-bold text-gray-900">0</p>
                </div>
                <div className="p-2 bg-green-100 rounded-full">
                  <ShoppingCart className="w-4 h-4 text-green-600" />
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-gray-600">Clients</p>
                  <p className="text-lg font-bold text-gray-900">0</p>
                </div>
                <div className="p-2 bg-purple-100 rounded-full">
                  <Users className="w-4 h-4 text-purple-600" />
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-gray-600">Produits</p>
                  <p className="text-lg font-bold text-gray-900">0</p>
                </div>
                <div className="p-2 bg-yellow-100 rounded-full">
                  <Package className="w-4 h-4 text-yellow-600" />
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-gray-600">Croissance</p>
                  <p className="text-lg font-bold text-green-600">+0%</p>
                </div>
                <div className="p-2 bg-green-100 rounded-full">
                  <TrendingUp className="w-4 h-4 text-green-600" />
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-gray-600">Activité</p>
                  <p className="text-lg font-bold text-blue-600">Normal</p>
                </div>
                <div className="p-2 bg-blue-100 rounded-full">
                  <Activity className="w-4 h-4 text-blue-600" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Scrollable Content Section */}
      <div className="flex-1 px-6 overflow-hidden mt-4">
        <div className="h-full grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Recent Activity */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden flex flex-col">
            <div className="p-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">Activité récente</h2>
            </div>
            <div className="flex-1 p-4 overflow-auto">
              <div className="text-center text-gray-500 py-8">
                Aucune activité récente à afficher
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden flex flex-col">
            <div className="p-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">Actions rapides</h2>
            </div>
            <div className="flex-1 p-4">
              <div className="grid grid-cols-2 gap-4">
                <button
                  onClick={() => navigate('/orders')}
                  className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <ShoppingCart className="w-6 h-6 text-blue-600 mb-2" />
                  <span className="text-sm font-medium text-gray-900">Voir les commandes</span>
                </button>
                <button
                  onClick={() => navigate('/invoices')}
                  className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <DollarSign className="w-6 h-6 text-green-600 mb-2" />
                  <span className="text-sm font-medium text-gray-900">Gérer les factures</span>
                </button>
                <button
                  onClick={() => navigate('/customers')}
                  className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <Users className="w-6 h-6 text-purple-600 mb-2" />
                  <span className="text-sm font-medium text-gray-900">Voir les clients</span>
                </button>
                <button
                  onClick={() => navigate('/settings')}
                  className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <Package className="w-6 h-6 text-yellow-600 mb-2" />
                  <span className="text-sm font-medium text-gray-900">Gérer les produits</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;