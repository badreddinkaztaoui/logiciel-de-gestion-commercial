import React from 'react';
import { RefreshCw, Wifi, WifiOff, CheckCircle, AlertCircle } from 'lucide-react';

interface SyncStatusProps {
  isConnected: boolean;
  isSyncing: boolean;
  lastSyncTime: string | null;
  newOrdersCount: number;
  onManualSync: () => void;
}

const SyncStatus: React.FC<SyncStatusProps> = ({
  isConnected,
  isSyncing,
  lastSyncTime,
  newOrdersCount,
  onManualSync
}) => {
  const formatSyncTime = (time: string | null) => {
    if (!time) return 'Jamais';
    const date = new Date(time);
    const now = new Date();
    const diffMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));
    
    if (diffMinutes < 1) return 'À l\'instant';
    if (diffMinutes < 60) return `Il y a ${diffMinutes} min`;
    if (diffMinutes < 1440) return `Il y a ${Math.floor(diffMinutes / 60)}h`;
    return date.toLocaleDateString('fr-FR');
  };

  return (
    <div className="flex items-center space-x-4">
      {/* Connection Status */}
      <div className="flex items-center space-x-2">
        {isConnected ? (
          <Wifi className="w-4 h-4 text-green-500" />
        ) : (
          <WifiOff className="w-4 h-4 text-red-500" />
        )}
        <span className={`text-sm ${isConnected ? 'text-green-600' : 'text-red-600'}`}>
          {isConnected ? 'Connecté' : 'Déconnecté'}
        </span>
      </div>

      {/* Sync Status */}
      <div className="flex items-center space-x-2">
        {isSyncing ? (
          <RefreshCw className="w-4 h-4 text-blue-500 animate-spin" />
        ) : (
          <CheckCircle className="w-4 h-4 text-green-500" />
        )}
        <span className="text-sm text-gray-600">
          Dernière sync: {formatSyncTime(lastSyncTime)}
        </span>
      </div>

      {/* New Orders Notification */}
      {newOrdersCount > 0 && (
        <div className="flex items-center space-x-2 bg-orange-50 px-3 py-1 rounded-full">
          <AlertCircle className="w-4 h-4 text-orange-500" />
          <span className="text-sm text-orange-700 font-medium">
            {newOrdersCount} nouvelle{newOrdersCount > 1 ? 's' : ''} commande{newOrdersCount > 1 ? 's' : ''}
          </span>
        </div>
      )}

      {/* Manual Sync Button */}
      <button
        onClick={onManualSync}
        disabled={isSyncing}
        className="flex items-center space-x-2 px-3 py-1 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
        <span className="text-sm">Synchroniser</span>
      </button>
    </div>
  );
};

export default SyncStatus;