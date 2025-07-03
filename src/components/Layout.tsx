import React, { useState, useEffect } from 'react';
import {
  LayoutDashboard,
  ShoppingCart,
  FileText,
  Truck,
  RotateCcw,
  Menu,
  Settings,
  Download,
  Bell,
  User,
  Package,
  Building,
  Users,
  Receipt,
  BookOpen,
  LogOut
} from 'lucide-react';
import { useLocation, useNavigate, Outlet } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { wooCommerceService } from '../services/woocommerce';
import SyncStatus from './SyncStatus';

const Layout: React.FC = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { user, signOut } = useAuthStore();
  const location = useLocation();
  const navigate = useNavigate();

  const [syncStatus, setSyncStatus] = useState({
    isConnected: true,
    isSyncing: false,
    lastSyncTime: wooCommerceService.getLastSyncTime(),
    newOrdersCount: 0,
    onManualSync: async () => {
      setSyncStatus(prev => ({ ...prev, isSyncing: true }));

      try {
        await wooCommerceService.triggerManualSync();

        setSyncStatus(prev => ({
          ...prev,
          isSyncing: false,
          lastSyncTime: wooCommerceService.getLastSyncTime(),
          isConnected: true
        }));

        if ('Notification' in window && Notification.permission === 'granted') {
          new Notification('Synchronisation terminée', {
            body: 'Les commandes ont été synchronisées avec succès',
            icon: '/favicon.ico'
          });
        }

      } catch (error) {
        console.error('Manual sync failed:', error);

        setSyncStatus(prev => ({
          ...prev,
          isSyncing: false,
          isConnected: false
        }));

        if ('Notification' in window && Notification.permission === 'granted') {
          new Notification('Erreur de synchronisation', {
            body: 'La synchronisation a échoué. Vérifiez votre connexion.',
            icon: '/favicon.ico'
          });
        }
      }
    }
  });

  useEffect(() => {
    // Start WooCommerce sync
    wooCommerceService.startRealTimeSync(2); // Sync every 2 minutes

    // Subscribe to sync updates
    wooCommerceService.onSyncUpdate((orders, isNewOrders) => {
      setSyncStatus(prev => ({
        ...prev,
        lastSyncTime: wooCommerceService.getLastSyncTime(),
        isConnected: true,
        newOrdersCount: isNewOrders ? prev.newOrdersCount + orders.length : prev.newOrdersCount
      }));
    });

    // Check WooCommerce connection immediately
    const checkConnection = async () => {
      try {
        await wooCommerceService.fetchOrders({ per_page: 1 });
        setSyncStatus(prev => ({ ...prev, isConnected: true }));
      } catch (err) {
        setSyncStatus(prev => ({ ...prev, isConnected: false }));
      }
    };
    checkConnection();

    // Set up periodic connection checks
    const intervalId = setInterval(checkConnection, 30000); // Check every 30 seconds

    // Clean up
    return () => {
      wooCommerceService.stopRealTimeSync();
      clearInterval(intervalId);
    };
  }, []);

  const getCurrentPage = () => {
    const path = location.pathname;
    if (path === '/' || path === '/dashboard') return 'dashboard';
    if (path.startsWith('/invoices')) return 'invoices';
    if (path.startsWith('/orders')) return 'orders';
    if (path.startsWith('/quotes')) return 'quotes';
    if (path.startsWith('/sales-journal')) return 'sales-journal';
    if (path.startsWith('/delivery')) return 'delivery';
    if (path.startsWith('/returns')) return 'returns';
    if (path.startsWith('/purchase-orders')) return 'purchase-orders';
    if (path.startsWith('/suppliers')) return 'suppliers';
    if (path.startsWith('/clients')) return 'clients';
    if (path.startsWith('/settings')) return 'settings';
    return 'dashboard';
  };

  const currentPage = getCurrentPage();

  const menuItems = [
    { id: 'dashboard', label: 'Tableau de bord', icon: LayoutDashboard, path: '/dashboard' },
    {
      id: 'orders',
      label: 'Commandes',
      icon: ShoppingCart,
      path: '/orders',
      badge: syncStatus.newOrdersCount > 0 ? syncStatus.newOrdersCount : undefined
    },
    { id: 'quotes', label: 'Devis', icon: Receipt, path: '/quotes' },
    { id: 'invoices', label: 'Factures', icon: FileText, path: '/invoices' },
    { id: 'sales-journal', label: 'Journal de vente', icon: BookOpen, path: '/sales-journal' },
    { id: 'delivery', label: 'Bons de livraison', icon: Truck, path: '/delivery' },
    { id: 'returns', label: 'Bons de retour', icon: RotateCcw, path: '/returns' },
    { id: 'purchase-orders', label: 'Bons de commande', icon: Package, path: '/purchase-orders' },
    { id: 'suppliers', label: 'Fournisseurs', icon: Building, path: '/suppliers' },
    { id: 'clients', label: 'Clients', icon: Users, path: '/clients' },
  ];

  const handleSignOut = async () => {
    await signOut();
  };

  const handleNavigation = (path: string) => {
    navigate(path);
    setSidebarOpen(false);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b border-gray-200 fixed top-0 left-0 right-0 z-50 h-16">
        <div className="flex items-center justify-between px-6 h-full">
          <div className="flex items-center space-x-6">
            <div className="flex items-center">
              <img
                src="https://pub-237d2da54b564d23aaa1c3826e1d4e65.r2.dev/gepronet/gepronet.png"
                alt="GeproNet"
                className="h-12 w-auto object-contain"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                  e.currentTarget.nextElementSibling?.classList.remove('hidden');
                }}
              />
              <div className="hidden bg-blue-600 p-3 rounded-lg">
                <LayoutDashboard className="w-8 h-8 text-white" />
              </div>
            </div>

            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-2 rounded-md hover:bg-gray-100 transition-colors"
            >
              <Menu className="w-5 h-5 text-gray-600" />
            </button>
          </div>

          <div className="flex items-center space-x-4">
            <SyncStatus {...syncStatus} />

            <button className="relative p-2 rounded-lg hover:bg-gray-100 transition-colors">
              <Bell className="w-5 h-5 text-gray-600" />
              {syncStatus.newOrdersCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                  {syncStatus.newOrdersCount > 9 ? '9+' : syncStatus.newOrdersCount}
                </span>
              )}
            </button>

            <button className="hidden sm:flex items-center space-x-2 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
              <Download className="w-4 h-4" />
              <span>Exporter</span>
            </button>

            <div className="flex items-center space-x-3">
              <div className="flex items-center space-x-2 p-2 rounded-lg">
                <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                  <User className="w-4 h-4 text-blue-600" />
                </div>
                <div className="hidden sm:block">
                  <span className="text-sm font-medium text-gray-700">
                    {user?.email?.split('@')[0] || 'Utilisateur'}
                  </span>
                  <p className="text-xs text-gray-500">{user?.email}</p>
                </div>
              </div>

              <button
                onClick={handleSignOut}
                className="p-2 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                title="Déconnexion"
              >
                <LogOut className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </header>

      <aside className={`fixed top-16 left-0 h-[calc(100vh-4rem)] bg-white shadow-lg border-r border-gray-200 z-40 transition-all duration-300 ${
        sidebarOpen ? 'w-64' : 'w-16'
      } lg:w-64`}>
        <div className="flex flex-col h-full">
          <nav className="flex-1 p-4">
            <div className="space-y-2">
              {menuItems.map((item) => {
                const Icon = item.icon;
                const isActive = currentPage === item.id;

                return (
                  <button
                    key={item.id}
                    onClick={() => handleNavigation(item.path)}
                    className={`w-full group flex items-center px-3 py-3 text-sm font-medium rounded-lg transition-all duration-200 ${
                      isActive
                        ? 'bg-blue-50 text-blue-700 border-r-2 border-blue-700'
                        : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                    }`}
                  >
                    <Icon className={`w-5 h-5 ${sidebarOpen ? 'mr-3' : 'mx-auto'} lg:mr-3 ${
                      isActive ? 'text-blue-700' : 'text-gray-400 group-hover:text-gray-500'
                    }`} />
                    <span className={`${sidebarOpen ? 'block' : 'hidden'} lg:block flex-1 text-left`}>
                      {item.label}
                    </span>
                    {item.badge && (
                      <span className={`${sidebarOpen ? 'block' : 'hidden'} lg:block bg-orange-100 text-orange-800 text-xs font-medium px-2 py-0.5 rounded-full`}>
                        {item.badge > 99 ? '99+' : item.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </nav>

          <div className="p-4 border-t border-gray-200">
            <button
              onClick={() => handleNavigation('/settings')}
              className={`w-full group flex items-center px-3 py-3 text-sm font-medium rounded-lg transition-colors ${
                currentPage === 'settings'
                  ? 'bg-blue-50 text-blue-700 border-r-2 border-blue-700'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              } ${sidebarOpen ? '' : 'justify-center'} lg:justify-start`}
            >
              <Settings className={`w-5 h-5 ${sidebarOpen ? 'mr-3' : 'mx-auto'} lg:mr-3 ${
                currentPage === 'settings' ? 'text-blue-700' : 'text-gray-400 group-hover:text-gray-500'
              }`} />
              <span className={`${sidebarOpen ? 'block' : 'hidden'} lg:block`}>
                Paramètres
              </span>
            </button>
          </div>
        </div>
      </aside>

      <main className={`transition-all duration-300 ${sidebarOpen ? 'ml-64' : 'ml-16'} lg:ml-64 pt-16`}>
        <div className="p-6">
          <Outlet context={{ syncStatus }} />
        </div>
      </main>

      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-30 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}
    </div>
  );
};

export default Layout;