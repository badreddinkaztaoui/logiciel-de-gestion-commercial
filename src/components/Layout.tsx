import React, { useState, useEffect } from 'react';
import {
  LayoutDashboard,
  ShoppingCart,
  FileText,
  Truck,
  RotateCcw,
  Menu,
  Settings,
  User,
  Package,
  Building,
  Users,
  Receipt,
  BookOpen,
  LogOut,
  RefreshCw,
  CheckCircle,
  AlertCircle
} from 'lucide-react';
import { useLocation, useNavigate, Outlet } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { syncService, SyncState } from '../services/syncService';
import { toast } from 'react-hot-toast';

const Layout: React.FC = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { user, signOut } = useAuthStore();
  const location = useLocation();
  const navigate = useNavigate();

  const [syncState, setSyncState] = useState<SyncState>({
    isInitialSyncComplete: false,
    lastSyncTime: null,
    isSyncing: false,
    syncError: null
  });

  const [showSyncNotification, setShowSyncNotification] = useState(false);

  useEffect(() => {
    let mounted = true;

    const initializeSync = async () => {
      try {
        // Load current sync state
        const currentState = syncService.getSyncState();
        if (mounted) {
          setSyncState(currentState);
        }

        // Check if initial sync is needed
        const shouldSync = await syncService.shouldPerformInitialSync();

        if (shouldSync && mounted) {
          setShowSyncNotification(true);

          // Show initial sync notification
          toast.loading('Synchronisation initiale avec WooCommerce en cours...', {
            duration: 0,
            id: 'initial-sync'
          });

          // Perform initial sync
          const result = await syncService.performInitialSync();

          if (mounted) {
            toast.dismiss('initial-sync');

            if (result.success) {
              toast.success(
                `Synchronisation réussie ! ${result.customersImported} clients et ${result.ordersImported} commandes importés.`,
                { duration: 5000 }
              );
            } else {
              toast.error(`Erreur de synchronisation: ${result.error}`, { duration: 5000 });
            }

            setShowSyncNotification(false);
          }
        }
      } catch (error) {
        if (mounted) {
          console.error('Error during initial sync:', error);
          toast.dismiss('initial-sync');
          toast.error('Erreur lors de la synchronisation initiale', { duration: 5000 });
          setShowSyncNotification(false);
        }
      }
    };

    // Subscribe to sync state changes
    const handleSyncStateChange = (newState: SyncState) => {
      if (mounted) {
        setSyncState(newState);
      }
    };

    syncService.onSyncStateChange(handleSyncStateChange);
    initializeSync();

    return () => {
      mounted = false;
      syncService.offSyncStateChange(handleSyncStateChange);
    };
  }, []);

  const handleManualSync = async () => {
    try {
      toast.loading('Synchronisation manuelle en cours...', {
        duration: 0,
        id: 'manual-sync'
      });

      const result = await syncService.performManualSync();

      toast.dismiss('manual-sync');

      if (result.success) {
        const message = `Synchronisation réussie ! ${result.customersImported + result.customersUpdated} clients et ${result.ordersImported + result.ordersUpdated} commandes synchronisés.`;
        toast.success(message, { duration: 5000 });
      } else {
        toast.error(`Erreur de synchronisation: ${result.error}`, { duration: 5000 });
      }
    } catch (error) {
      toast.dismiss('manual-sync');
      toast.error('Erreur lors de la synchronisation manuelle', { duration: 5000 });
    }
  };

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
    {
      id: 'orders',
      label: 'Commandes',
      icon: ShoppingCart,
      path: '/orders',
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

  const formatSyncTime = (timestamp: string | null) => {
    if (!timestamp) return 'Jamais';

    const date = new Date(timestamp);
    const now = new Date();
    const diffMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));

    if (diffMinutes < 1) return 'À l\'instant';
    if (diffMinutes < 60) return `Il y a ${diffMinutes} min`;
    if (diffMinutes < 1440) return `Il y a ${Math.floor(diffMinutes / 60)} h`;
    return date.toLocaleDateString('fr-FR');
  };

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      {/* Fixed Header */}
      <header className="flex-none bg-white shadow-sm border-b border-gray-200 z-50 h-16">
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
            {/* Sync Status and Controls */}
            <div className="flex items-center space-x-2">
              {/* Sync Status Indicator */}
              <div className="flex items-center space-x-2 px-3 py-1 rounded-full bg-gray-100">
                {syncState.isSyncing ? (
                  <RefreshCw className="w-4 h-4 text-blue-600 animate-spin" />
                ) : syncState.syncError ? (
                  <AlertCircle className="w-4 h-4 text-red-600" />
                ) : syncState.isInitialSyncComplete ? (
                  <CheckCircle className="w-4 h-4 text-green-600" />
                ) : (
                  <RefreshCw className="w-4 h-4 text-gray-400" />
                )}
                <span className="text-xs text-gray-600">
                  {syncState.isSyncing ? 'Sync...' : formatSyncTime(syncState.lastSyncTime)}
                </span>
              </div>

              {/* Manual Sync Button */}
              <button
                onClick={handleManualSync}
                disabled={syncState.isSyncing}
                className="flex items-center space-x-1 px-3 py-1 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                title="Synchroniser manuellement avec WooCommerce"
              >
                <RefreshCw className={`w-4 h-4 ${syncState.isSyncing ? 'animate-spin' : ''}`} />
                <span className="text-sm">Sync</span>
              </button>
            </div>

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

      {/* Initial Sync Notification */}
      {showSyncNotification && (
        <div className="flex-none bg-blue-50 border-b border-blue-200 px-6 py-3">
          <div className="flex items-center space-x-3">
            <RefreshCw className="w-5 h-5 text-blue-600 animate-spin" />
            <div>
              <p className="text-sm font-medium text-blue-900">
                Synchronisation initiale avec WooCommerce en cours...
              </p>
              <p className="text-xs text-blue-700">
                Importation des commandes et clients, veuillez patienter.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Error Notification */}
      {syncState.syncError && (
        <div className="flex-none bg-red-50 border-b border-red-200 px-6 py-3">
          <div className="flex items-center space-x-3">
            <AlertCircle className="w-5 h-5 text-red-600" />
            <div>
              <p className="text-sm font-medium text-red-900">
                Erreur de synchronisation WooCommerce
              </p>
              <p className="text-xs text-red-700">
                {syncState.syncError}
              </p>
            </div>
            <button
              onClick={handleManualSync}
              className="text-sm text-red-600 hover:text-red-800 underline"
            >
              Réessayer
            </button>
          </div>
        </div>
      )}

      {/* Sidebar */}
      <div className="flex flex-1 overflow-hidden">
        <aside className={`flex-none bg-white shadow-lg border-r border-gray-200 z-40 transition-all duration-300 ${
          sidebarOpen ? 'w-64' : 'w-16'
        } lg:w-64`}>
          <div className="flex flex-col h-full">
            <nav className="flex-1 p-4 overflow-y-auto">
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
                    </button>
                  );
                })}
              </div>
            </nav>

            <div className="flex-none p-4 border-t border-gray-200">
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

        {/* Main Content */}
        <main className={`flex-1 overflow-hidden bg-gray-50`}>
          <div className="h-full">
            <Outlet context={{ syncState, handleManualSync }} />
          </div>
        </main>
      </div>

      {/* Mobile Overlay */}
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