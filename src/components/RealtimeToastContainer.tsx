import React, { useEffect, useState } from 'react';
import { supabaseRealtime, RealtimeToastItem } from '../services/supabase';
import { useAuth } from '../context/AuthContext';
import { triggerBrowserPushNotification } from '../utils/trackingNotifications';
import { Package, CalendarCheck, X, Volume2, VolumeX, Radio, ArrowRight } from 'lucide-react';

interface RealtimeToastContainerProps {
  onSelectPackageId?: (pkgId: string) => void;
  onNavigateTab?: (tab: any) => void;
}

export const RealtimeToastContainer: React.FC<RealtimeToastContainerProps> = ({
  onSelectPackageId,
  onNavigateTab
}) => {
  const { currentUser } = useAuth();
  const [toasts, setToasts] = useState<RealtimeToastItem[]>([]);
  const [audioEnabled, setAudioEnabled] = useState(supabaseRealtime.audioEnabled);

  useEffect(() => {
    const unsubscribe = supabaseRealtime.onToast((newToast) => {
      // Enforce tenant/client isolation: clients only receive live status alerts for their own parcels
      if (currentUser?.role === 'client') {
        if (newToast.type === 'new_pickup') return;
        const myShopId = (currentUser as any)?.shopId;
        if (
          newToast.clientId &&
          newToast.clientId !== currentUser.id &&
          (!myShopId || newToast.clientId !== myShopId)
        ) {
          return;
        }
      }

      setToasts((prev) => [newToast, ...prev.slice(0, 3)]); // Keep maximum 4 concurrent toasts
      triggerBrowserPushNotification(newToast.title, newToast.message, newToast.targetId || newToast.id);

      // Auto dismiss after 6.5s
      setTimeout(() => {
        setToasts((current) => current.filter((t) => t.id !== newToast.id));
      }, 6500);
    });

    return () => {
      unsubscribe();
    };
  }, [currentUser?.id, currentUser?.role, (currentUser as any)?.shopId]);

  const handleDismiss = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  const handleToggleAudio = () => {
    const next = !audioEnabled;
    supabaseRealtime.audioEnabled = next;
    setAudioEnabled(next);
    if (next) {
      supabaseRealtime.playAudioNotification('info');
    }
  };

  if (toasts.length === 0) return null;

  return (
    <aside aria-label="Notifications en temps réel" className="fixed top-20 right-4 z-50 flex flex-col gap-2.5 max-w-sm w-full pointer-events-none no-print">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className="pointer-events-auto bg-slate-900 text-white rounded-2xl p-4 shadow-2xl border border-slate-700/80 backdrop-blur-md transition-all animate-in slide-in-from-right-4 duration-300"
        >
          {/* Header */}
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-red-600 rounded-lg text-white">
                {toast.type === 'new_pickup' ? (
                  <CalendarCheck className="w-4 h-4" />
                ) : (
                  <Package className="w-4 h-4" />
                )}
              </div>
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-red-400 flex items-center gap-1">
                  <Radio className="w-3 h-3 text-red-500 animate-pulse" />
                  <span>Supabase Realtime</span>
                </span>
                <h4 className="text-xs font-bold text-white leading-tight mt-0.5">
                  {toast.title}
                </h4>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={handleToggleAudio}
                title={audioEnabled ? 'Désactiver le son' : 'Activer le son'}
                className="p-1 text-slate-400 hover:text-white rounded-md transition-colors"
              >
                {audioEnabled ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
              </button>
              <button
                type="button"
                onClick={() => handleDismiss(toast.id)}
                className="p-1 text-slate-400 hover:text-white rounded-md transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Body message */}
          <p className="text-xs text-slate-300 mt-2 leading-relaxed">
            {toast.message}
          </p>

          {/* Footer action */}
          <div className="mt-3 pt-2.5 border-t border-slate-800 flex items-center justify-between text-[11px]">
            <span className="text-slate-400 font-mono">{toast.timestamp.substring(11)}</span>
            {toast.targetId && onSelectPackageId && toast.type === 'status_changed' && (
              <button
                type="button"
                onClick={() => {
                  onSelectPackageId(toast.targetId!);
                  handleDismiss(toast.id);
                }}
                className="text-red-400 hover:text-red-300 font-bold flex items-center gap-1 transition-colors"
              >
                <span>Voir le colis</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            )}
            {toast.type === 'new_pickup' && onNavigateTab && (
              <button
                type="button"
                onClick={() => {
                  onNavigateTab('admin_pickups');
                  handleDismiss(toast.id);
                }}
                className="text-amber-400 hover:text-amber-300 font-bold flex items-center gap-1 transition-colors"
              >
                <span>Gérer les ramassages</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>
      ))}
    </aside>
  );
};
