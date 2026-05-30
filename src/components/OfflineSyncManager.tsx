import React, { useState, useEffect } from 'react';
import { WifiOff, Wifi, RefreshCw, AlertTriangle, CheckCircle, Trash2, Layers } from 'lucide-react';
import { GlassCard } from './GlassCard';

interface OfflineAction {
  id: string;
  type: 'CHAT_MESSAGE' | 'ATTENDANCE_MARK' | 'HOMEWORK_NOTE';
  payload: any;
  timestamp: string;
}

export const OfflineSyncManager: React.FC = () => {
  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine);
  const [syncQueue, setSyncQueue] = useState<OfflineAction[]>(() => {
    try {
      const saved = localStorage.getItem('aegis_offline_sync_queue');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [simulatingOffline, setSimulatingOffline] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(null);

  // Sync state to localstorage
  useEffect(() => {
    localStorage.setItem('aegis_offline_sync_queue', JSON.stringify(syncQueue));
  }, [syncQueue]);

  // Monitor network status
  useEffect(() => {
    const handleOnline = () => {
      if (!simulatingOffline) {
        setIsOnline(true);
        triggerBackgroundSync();
      }
    };
    const handleOffline = () => {
      setIsOnline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [simulatingOffline]);

  // Replay actions
  const triggerBackgroundSync = async () => {
    if (syncQueue.length === 0) return;
    setIsSyncing(true);
    
    // Simulate replaying queued requests in background
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Resolve all
    setSyncQueue([]);
    setIsSyncing(false);
    setLastSyncTime(new Date().toLocaleTimeString());
    
    alert(`[PWA OFFLINE SYNC] Successfully reconciled ${syncQueue.length} queued action(s) with Supabase Database! Core states synchronized.`);
  };

  const simulateOfflineToggle = () => {
    if (simulatingOffline) {
      setSimulatingOffline(false);
      setIsOnline(navigator.onLine);
      if (navigator.onLine) {
        triggerBackgroundSync();
      }
    } else {
      setSimulatingOffline(true);
      setIsOnline(false);
    }
  };

  const addSimulatedAction = (type: 'CHAT_MESSAGE' | 'ATTENDANCE_MARK' | 'HOMEWORK_NOTE') => {
    let payload = {};
    if (type === 'CHAT_MESSAGE') {
      payload = { text: 'Hello, this is an offline secured message!', recipientId: 'u-teacher1' };
    } else if (type === 'ATTENDANCE_MARK') {
      payload = { studentId: 'st-1', status: 'PRESENT', date: new Date().toISOString().split('T')[0] };
    } else {
      payload = { title: 'Chapter 5 Vector calculus notes', content: 'Completed reading questions.' };
    }

    const newAction: OfflineAction = {
      id: Math.random().toString(36).substr(2, 6).toUpperCase(),
      type,
      payload,
      timestamp: new Date().toISOString()
    };

    setSyncQueue(prev => [...prev, newAction]);
  };

  const clearQueue = () => {
    setSyncQueue([]);
  };

  return (
    <div className="space-y-4">
      {/* 1. Global Sticky Offline Banner */}
      {!isOnline && (
        <div className="fixed top-0 left-0 right-0 z-[100] bg-amber-600 border-b border-amber-500/30 text-white py-2 px-4 flex items-center justify-between text-xs font-bold font-sans tracking-wide animate-bounce-subtle">
          <div className="flex items-center gap-2">
            <WifiOff size={14} className="animate-pulse" />
            <span>⚠️ OFFLINE MODE ACTIVE: Network connection severed. Actions are being secured in your local offline queue ({syncQueue.length} actions queued).</span>
          </div>
          <button 
            onClick={simulateOfflineToggle}
            className="px-2 py-0.5 bg-white/20 hover:bg-white/30 rounded border border-white/30 text-[9px] uppercase font-mono tracking-widest transition-all"
          >
            Reconnect
          </button>
        </div>
      )}

      {/* 2. Sync Manager Controller Panel Card */}
      <GlassCard className="border border-brand-500/10 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-850 pb-2.5">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-brand-500/10 border border-brand-500/20">
              <Layers className="text-brand-400" size={18} />
            </div>
            <div>
              <h4 className="font-bold text-slate-100 text-sm">PWA Offline Synchronization Console</h4>
              <p className="text-[10px] text-slate-400 mt-0.5 font-sans">Evaluate Aegis offline resilience and action replay capabilities safely within this local sandbox environment.</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className={`px-2 py-0.5 rounded text-[9px] font-mono font-bold border ${
              isOnline 
                ? 'bg-green-500/15 text-green-400 border-green-500/20' 
                : 'bg-amber-500/15 text-amber-400 border-amber-500/20'
            }`}>
              {isOnline ? 'ONLINE' : 'OFFLINE MODE'}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-3">
            <h5 className="text-xs font-bold text-slate-200 uppercase tracking-wider">Console Simulator</h5>
            <p className="text-[10px] text-slate-400 leading-normal">
              Click the "Disconnect" button to simulate internet disconnection. Submit offline mock actions (chat message, attendance sheet) and observe them queue locally.
            </p>

            <div className="flex flex-wrap gap-2 pt-1">
              <button 
                onClick={simulateOfflineToggle}
                className={`px-3 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all active:scale-[0.98] ${
                  isOnline 
                    ? 'bg-amber-600/10 hover:bg-amber-600/20 text-amber-400 border border-amber-500/20' 
                    : 'bg-green-600/10 hover:bg-green-600/20 text-green-400 border border-green-500/20'
                }`}
              >
                {isOnline ? (
                  <>
                    <WifiOff size={13} />
                    <span>Simulate Disconnection</span>
                  </>
                ) : (
                  <>
                    <Wifi size={13} />
                    <span>Simulate Reconnection</span>
                  </>
                )}
              </button>

              <button 
                onClick={triggerBackgroundSync}
                disabled={isOnline && syncQueue.length === 0 || isSyncing}
                className="px-3 py-1.5 bg-brand-600/15 hover:bg-brand-600/25 border border-brand-500/20 hover:border-brand-500/50 text-brand-400 text-xs font-bold rounded-xl flex items-center gap-1.5 transition-all active:scale-[0.98]"
              >
                <RefreshCw size={13} className={isSyncing ? 'animate-spin' : ''} />
                <span>Sync Now</span>
              </button>
            </div>
          </div>

          <div className="space-y-3">
            <h5 className="text-xs font-bold text-slate-200 uppercase tracking-wider">Queue Mock Injectors</h5>
            <p className="text-[10px] text-slate-400 leading-normal">
              Simulate submitting core form elements inside student or teacher consoles while network status is offline.
            </p>

            <div className="flex flex-wrap gap-2 pt-1">
              <button 
                onClick={() => addSimulatedAction('CHAT_MESSAGE')}
                disabled={isOnline}
                className="px-2.5 py-1.5 bg-slate-900 border border-slate-800 text-slate-350 hover:text-slate-100 rounded-xl text-[10px] font-bold transition-all disabled:opacity-40"
              >
                + Chat message payload
              </button>
              <button 
                onClick={() => addSimulatedAction('ATTENDANCE_MARK')}
                disabled={isOnline}
                className="px-2.5 py-1.5 bg-slate-900 border border-slate-800 text-slate-350 hover:text-slate-100 rounded-xl text-[10px] font-bold transition-all disabled:opacity-40"
              >
                + Attendance roll payload
              </button>
              <button 
                onClick={() => addSimulatedAction('HOMEWORK_NOTE')}
                disabled={isOnline}
                className="px-2.5 py-1.5 bg-slate-900 border border-slate-800 text-slate-350 hover:text-slate-100 rounded-xl text-[10px] font-bold transition-all disabled:opacity-40"
              >
                + Homework note payload
              </button>
            </div>
          </div>
        </div>

        {/* Sync Queue List Table */}
        <div className="pt-2 border-t border-slate-850 space-y-3">
          <div className="flex items-center justify-between">
            <h5 className="text-xs font-bold text-slate-200 flex items-center gap-2">
              <RefreshCw size={13} className={isSyncing ? 'animate-spin' : 'text-brand-400'} />
              Active Local Cache Sync Queue ({syncQueue.length})
            </h5>
            {syncQueue.length > 0 && (
              <button 
                onClick={clearQueue}
                className="flex items-center gap-1 text-[9px] font-bold text-red-400 hover:text-red-300"
              >
                <Trash2 size={11} /> Clear cache queue
              </button>
            )}
          </div>

          {syncQueue.length === 0 ? (
            <div className="p-6 bg-slate-900/10 border border-slate-900 rounded-xl text-center text-xs text-slate-500 flex flex-col items-center justify-center gap-1">
              <CheckCircle size={20} className="text-slate-650" />
              <span>All client cache is empty & fully reconciled.</span>
              {lastSyncTime && <span className="text-[9px] text-slate-600 font-mono">Last reconciled at: {lastSyncTime}</span>}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-850 text-slate-400 text-[10px] font-bold uppercase tracking-wider bg-slate-900/20">
                    <th className="py-2 px-3">Action ID</th>
                    <th className="py-2 px-3">Payload Category</th>
                    <th className="py-2 px-3">Secured Payload Preview</th>
                    <th className="py-2 px-3">Cache State</th>
                    <th className="py-2 px-3 text-right">Timestamp</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-850/50">
                  {syncQueue.map((act) => (
                    <tr key={act.id} className="hover:bg-slate-900/10 transition-colors">
                      <td className="py-2 px-3 font-mono text-[10px] text-slate-500">#{act.id}</td>
                      <td className="py-2 px-3">
                        <span className="px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20 text-[9px] font-bold">
                          {act.type}
                        </span>
                      </td>
                      <td className="py-2 px-3 font-mono text-[10px] text-slate-400 truncate max-w-[250px]">
                        {JSON.stringify(act.payload)}
                      </td>
                      <td className="py-2 px-3">
                        <span className="text-amber-400 font-bold text-[10px] flex items-center gap-1.5">
                          <AlertTriangle size={11} className="animate-pulse" />
                          QUEUED LOCALLY
                        </span>
                      </td>
                      <td className="py-2 px-3 text-right text-slate-500 font-mono text-[10px]">
                        {new Date(act.timestamp).toLocaleTimeString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </GlassCard>
    </div>
  );
};
