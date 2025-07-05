import React from 'react';
import { RefreshCw, Wifi, WifiOff, CheckCircle } from 'lucide-react';

interface SyncStatusProps {
  isConnected: boolean;
  isSyncing: boolean;
  lastSyncTime: string | null;
}

const SyncStatus: React.FC<SyncStatusProps> = ({
  isConnected,
  isSyncing,
  lastSyncTime,
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
    </div>
  );
};

export default SyncStatus;