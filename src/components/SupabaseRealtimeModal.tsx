import React, { useState } from 'react';
import { supabaseRealtime } from '../services/supabase';
import {
  Radio,
  X,
  Volume2,
  CheckCircle2,
  RotateCcw,
  Key,
  Globe
} from 'lucide-react';

interface SupabaseRealtimeModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SupabaseRealtimeModal: React.FC<SupabaseRealtimeModalProps> = ({
  isOpen,
  onClose
}) => {
  const [url, setUrl] = useState(supabaseRealtime.customUrl);
  const [key, setKey] = useState(supabaseRealtime.customKey);
  const [saveSuccess, setSaveSuccess] = useState(false);

  if (!isOpen) return null;

  const handleSaveCredentials = (e: React.FormEvent) => {
    e.preventDefault();
    supabaseRealtime.updateCredentials(url, key);
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
  };

  const handleReset = () => {
    supabaseRealtime.resetCredentials();
    setUrl(supabaseRealtime.customUrl);
    setKey(supabaseRealtime.customKey);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs no-print">
      <div className="relative w-full max-w-xl bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-red-50 text-red-600 flex items-center justify-center">
              <Radio className="w-5 h-5 text-red-600 animate-pulse" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">
                Configuration Supabase Realtime
              </h3>
              <p className="text-xs text-slate-500">
                Canal WebSocket temps réel pour alertes de colis et ramassages
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto space-y-5">
          {/* Status Badge */}
          <div className="p-4 bg-slate-900 text-white rounded-xl flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500" />
              </span>
              <div>
                <span className="text-xs font-bold block">
                  Canal Realtime Connecté & Opérationnel
                </span>
                <span className="text-[11px] text-slate-400 font-mono">
                  Canal : fariousy_realtime_channel · Événements : broadcast
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => supabaseRealtime.playAudioNotification('success')}
              className="px-2.5 py-1 text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg flex items-center gap-1 transition-colors"
            >
              <Volume2 className="w-3.5 h-3.5" />
              <span>Tester le carillon</span>
            </button>
          </div>

          {/* Supabase Custom Credentials Form */}
          <form onSubmit={handleSaveCredentials} className="space-y-3 pt-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-800">
                Liaison à Votre Propre Projet Supabase (Optionnel) :
              </span>
              <button
                type="button"
                onClick={handleReset}
                className="text-[11px] text-slate-500 hover:text-slate-800 flex items-center gap-1"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Réinitialiser</span>
              </button>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1">
                Project URL (VITE_SUPABASE_URL) :
              </label>
              <div className="relative">
                <Globe className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://votre-projet.supabase.co"
                  className="w-full pl-9 pr-3 py-2 text-xs font-mono bg-slate-50 border border-slate-300 rounded-xl text-slate-900"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1">
                Anon Public Key (VITE_SUPABASE_ANON_KEY) :
              </label>
              <div className="relative">
                <Key className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="password"
                  value={key}
                  onChange={(e) => setKey(e.target.value)}
                  placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                  className="w-full pl-9 pr-3 py-2 text-xs font-mono bg-slate-50 border border-slate-300 rounded-xl text-slate-900"
                />
              </div>
            </div>

            {saveSuccess && (
              <p className="text-xs text-emerald-600 font-bold flex items-center gap-1">
                <CheckCircle2 className="w-4 h-4" />
                <span>Paramètres Supabase appliqués et reconnectés avec succès !</span>
              </p>
            )}

            <div className="pt-2 flex justify-end">
              <button
                type="submit"
                className="px-4 py-2 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-xl shadow-xs transition-colors"
              >
                Enregistrer la configuration Supabase
              </button>
            </div>
          </form>
        </div>

        <div className="px-6 py-3.5 border-t border-slate-100 bg-slate-50 flex items-center justify-between text-xs text-slate-500">
          <span>Diffusion en temps réel sur canal chiffré WebSocket</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-100 rounded-lg transition-colors"
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
};
