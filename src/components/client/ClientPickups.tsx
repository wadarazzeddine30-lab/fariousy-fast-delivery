import React, { useState } from 'react';
import { useDatabase } from '../../context/DatabaseContext';
import { useAuth } from '../../context/AuthContext';
import { CalendarCheck, Plus, Clock, MapPin, CheckCircle2, AlertCircle, X } from 'lucide-react';

export const ClientPickups: React.FC = () => {
  const { currentUser } = useAuth();
  const { pickups, createPickupRequest } = useDatabase();

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [address, setAddress] = useState(currentUser?.address || 'Angle Bd Zerktouni & Rue Normandie');
  const [city, setCity] = useState(currentUser?.city || 'Casablanca');
  const [packageCount, setPackageCount] = useState<number>(5);
  const [requestedDate, setRequestedDate] = useState(() => {
    const d = new Date();
    return d.toISOString().split('T')[0];
  });
  const [timeSlot, setTimeSlot] = useState<'matin' | 'apres_midi' | 'urgent'>('apres_midi');
  const [notes, setNotes] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  // Strict isolation
  const myPickups = pickups.filter(p => p.clientId === currentUser?.id);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (!address.trim()) {
      setFormError('Veuillez renseigner votre adresse de ramassage.');
      return;
    }

    createPickupRequest({
      clientId: currentUser?.id || 'usr-client-1',
      clientName: currentUser?.name || 'Client',
      clientPhone: currentUser?.phone || '',
      clientCompany: currentUser?.companyName || currentUser?.name || 'Entreprise',
      address,
      city,
      packageCount,
      requestedDate,
      timeSlot,
      notes: notes || undefined
    });

    setShowCreateModal(false);
    setNotes('');
  };

  return (
    <div className="space-y-5">
      {/* Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <h2 className="text-xl font-black text-slate-900 tracking-tight">
            Demandes de Ramassage à Domicile
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Planifiez le passage de nos livreurs pour récupérer vos colis prêts à être expédiés
          </p>
        </div>

        <button
          onClick={() => {
            setFormError(null);
            setShowCreateModal(true);
          }}
          className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-red-600 hover:bg-red-700 rounded-xl shadow-xs transition-colors self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>Nouvelle Demande de Ramassage</span>
        </button>
      </div>

      {/* Pickups Table */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-2xs overflow-hidden">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
            <tr>
              <th className="py-3 px-4">Réf. Demande</th>
              <th className="py-3 px-4">Adresse de Collecte</th>
              <th className="py-3 px-4 text-center">Nombre de Colis</th>
              <th className="py-3 px-4">Date & Créneau Souhaité</th>
              <th className="py-3 px-4">Livreur Désigné</th>
              <th className="py-3 px-4">Statut de la Demande</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {myPickups.map(req => (
              <tr key={req.id} className="hover:bg-slate-50">
                <td className="py-3 px-4 font-mono font-bold text-slate-900">{req.trackingId}</td>
                <td className="py-3 px-4">
                  <span className="font-bold text-slate-900 block">{req.city}</span>
                  <span className="text-slate-500 text-[11px] block">{req.address}</span>
                  {req.notes && (
                    <span className="text-[10px] text-amber-700 block italic">Note : {req.notes}</span>
                  )}
                </td>
                <td className="py-3 px-4 text-center font-mono font-black text-slate-900 text-sm">
                  {req.packageCount} colis
                </td>
                <td className="py-3 px-4">
                  <span className="font-mono text-slate-800 font-semibold block">{req.requestedDate}</span>
                  <span className="text-[10px] text-slate-500 capitalize">
                    {req.timeSlot === 'urgent' ? '⚡ Urgent (moins de 2h)' : req.timeSlot.replace('_', ' ')}
                  </span>
                </td>
                <td className="py-3 px-4">
                  {req.driverName ? (
                    <span className="font-semibold text-slate-800">🚚 {req.driverName}</span>
                  ) : (
                    <span className="text-slate-400 italic">En attente d'affectation</span>
                  )}
                </td>
                <td className="py-3 px-4">
                  <span
                    className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
                      req.status === 'en_attente'
                        ? 'bg-amber-100 text-amber-800'
                        : req.status === 'affectee'
                        ? 'bg-blue-100 text-blue-800'
                        : req.status === 'terminee'
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-rose-100 text-rose-800'
                    }`}
                  >
                    {req.status === 'en_attente'
                      ? 'Demande reçue'
                      : req.status === 'affectee'
                      ? 'Livreur en route'
                      : req.status === 'terminee'
                      ? 'Colis Ramassés ✓'
                      : 'Non disponible'}
                  </span>
                  {req.rejectionReason && (
                    <span className="text-[10px] text-rose-600 block mt-0.5">{req.rejectionReason}</span>
                  )}
                </td>
              </tr>
            ))}

            {myPickups.length === 0 && (
              <tr>
                <td colSpan={6} className="py-12 text-center text-slate-400">
                  Vous n'avez aucune demande de ramassage enregistrée.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Create Pickup Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs no-print">
          <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50">
              <h3 className="text-base font-bold text-slate-900">Demander un Ramassage de Colis</h3>
              <button onClick={() => setShowCreateModal(false)} className="p-2 text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {formError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs font-semibold text-rose-700 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Adresse complète du point de ramassage *
                </label>
                <textarea
                  rows={2}
                  required
                  value={address}
                  onChange={e => setAddress(e.target.value)}
                  placeholder="Adresse de votre magasin, entrepôt ou domicile..."
                  className="w-full text-xs bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-slate-900"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Ville</label>
                  <input
                    type="text"
                    required
                    value={city}
                    onChange={e => setCity(e.target.value)}
                    className="w-full text-xs bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-900"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Nombre estimé de colis *</label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={packageCount}
                    onChange={e => setPackageCount(parseInt(e.target.value) || 1)}
                    className="w-full text-xs font-mono font-bold bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-900"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Date souhaitée *</label>
                  <input
                    type="date"
                    required
                    value={requestedDate}
                    onChange={e => setRequestedDate(e.target.value)}
                    className="w-full text-xs font-mono bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-900"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Créneau horaire *</label>
                  <select
                    value={timeSlot}
                    onChange={e => setTimeSlot(e.target.value as any)}
                    className="w-full text-xs bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-900"
                  >
                    <option value="matin">Matin (09h00 - 13h00)</option>
                    <option value="apres_midi">Après-midi (14h00 - 19h00)</option>
                    <option value="urgent">Urgent (&lt; 2h)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Instructions ou remarques</label>
                <input
                  type="text"
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  placeholder="Ex: Sonner à l'interphone 2, demander Karim..."
                  className="w-full text-xs bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2 text-slate-900"
                />
              </div>

              <div className="pt-3 border-t flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 text-xs font-bold text-white bg-red-600 hover:bg-red-700 rounded-xl shadow-xs"
                >
                  Envoyer la demande
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
