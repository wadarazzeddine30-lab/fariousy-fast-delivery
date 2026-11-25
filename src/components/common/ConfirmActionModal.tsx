import React, { useState } from 'react';
import { AlertTriangle, Archive, Trash2, X, ShieldAlert } from 'lucide-react';

interface ConfirmActionModalProps {
  isOpen: boolean;
  title: string;
  description?: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  isDestructive?: boolean;
  isArchiveOrCancel?: boolean;
  requireReason?: boolean;
  onConfirm: (reason?: string) => void;
  onClose?: () => void;
  onCancel?: () => void;
}

export const ConfirmActionModal: React.FC<ConfirmActionModalProps> = ({
  isOpen,
  title,
  description,
  message,
  confirmLabel = 'Confirmer la suppression',
  cancelLabel = 'Annuler',
  isDestructive = true,
  isArchiveOrCancel = false,
  requireReason = false,
  onConfirm,
  onClose,
  onCancel
}) => {
  const actualDescription = description || message || '';
  const handleClose = onClose || onCancel || (() => {});
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (requireReason && !reason.trim()) {
      setError('Veuillez obligatoirement indiquer un motif pour cette opération sécurisée.');
      return;
    }
    onConfirm(reason.trim());
    setReason('');
    setError(null);
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs no-print">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50">
          <div className="flex items-center gap-2.5">
            <div
              className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                isArchiveOrCancel
                  ? 'bg-amber-100 text-amber-700'
                  : 'bg-rose-100 text-rose-700'
              }`}
            >
              {isArchiveOrCancel ? (
                <Archive className="w-5 h-5" />
              ) : (
                <AlertTriangle className="w-5 h-5" />
              )}
            </div>
            <div>
              <h3 className="text-sm font-extrabold text-slate-900">{title}</h3>
              <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">
                Sécurité des Opérations FARIOUSY
              </span>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <p className="text-xs text-slate-600 leading-relaxed">{actualDescription}</p>

          {isArchiveOrCancel && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-[11px] text-amber-900 flex items-start gap-2">
              <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <span>
                <strong>Recommandation de conformité :</strong> Cette opération sera archivée et
                tracée dans le journal d'audit administratif.
              </span>
            </div>
          )}

          {requireReason && (
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Motif obligatoire de l'opération *
              </label>
              <textarea
                rows={2}
                required
                value={reason}
                onChange={e => {
                  setReason(e.target.value);
                  if (error) setError(null);
                }}
                placeholder="Ex: Erreur de saisie opérateur, doublon, annulation demandée par le client..."
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-500"
              />
              {error && <p className="text-[11px] text-rose-600 font-bold mt-1">{error}</p>}
            </div>
          )}

          {/* Action buttons */}
          <div className="pt-2 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={handleClose}
              className="px-4 py-2 text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
            >
              {cancelLabel}
            </button>
            <button
              type="submit"
              className={`px-4 py-2 text-xs font-bold text-white rounded-xl shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer ${
                isArchiveOrCancel
                  ? 'bg-amber-600 hover:bg-amber-700'
                  : 'bg-rose-600 hover:bg-rose-700'
              }`}
            >
              {isArchiveOrCancel ? <Archive className="w-3.5 h-3.5" /> : <Trash2 className="w-3.5 h-3.5" />}
              <span>{confirmLabel}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
