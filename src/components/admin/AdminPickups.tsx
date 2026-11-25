import React, { useState } from 'react';
import { useDatabase } from '../../context/DatabaseContext';
import { useAuth } from '../../context/AuthContext';
import { PickupRequest } from '../../types';
import { exportCSV } from '../../utils/export';
import { suggestDriversForTarget, getBestDriverForTarget } from '../../utils/driverMatcher';
import { isCityAllowedForUser } from '../../utils/employeePermissions';
import {
  CalendarCheck,
  Truck,
  Check,
  X,
  Clock,
  MapPin,
  Phone,
  Building,
  AlertCircle,
  Search,
  Filter,
  Download,
  Sparkles,
  Trash2
} from 'lucide-react';

export const AdminPickups: React.FC = () => {
  const { pickups, users, cities, packages, updatePickupStatus, deletePickupRequest } = useDatabase();
  const { currentUser } = useAuth();

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'en_attente' | 'affectee' | 'terminee' | 'refusee'>('all');

  const [assigningPickup, setAssigningPickup] = useState<PickupRequest | null>(null);
  const [selectedDriverId, setSelectedDriverId] = useState('');
  const [rejectingPickup, setRejectingPickup] = useState<PickupRequest | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');

  const isEmployeeUser = currentUser?.role === 'employee';
  const drivers = users.filter(
    u => u.role === 'driver' && (!isEmployeeUser || isCityAllowedForUser(currentUser, u.city))
  );

  const filteredPickups = pickups.filter(p => {
    if (isEmployeeUser && !isCityAllowedForUser(currentUser, p.city)) return false;
    const matchesSearch =
      p.trackingId.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.clientCompany.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.city.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (p.driverName && p.driverName.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesStatus = statusFilter === 'all' || p.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const handleAssignSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const driver = drivers.find(d => d.id === selectedDriverId);
    if (assigningPickup && driver) {
      updatePickupStatus(assigningPickup.id, 'affectee', driver.id, driver.name);
      setAssigningPickup(null);
    }
  };

  const handleRejectSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (rejectingPickup) {
      updatePickupStatus(rejectingPickup.id, 'refusee', undefined, undefined, rejectionReason || 'Créneau indisponible');
      setRejectingPickup(null);
      setRejectionReason('');
    }
  };

  const handleComplete = (id: string) => {
    updatePickupStatus(id, 'terminee');
  };

  const handleExportCSV = () => {
    const data = filteredPickups.map(p => ({
      Ref: p.trackingId,
      Boutique: p.clientCompany,
      Telephone: p.clientPhone,
      Ville: p.city,
      Adresse: p.address,
      Nombre_Colis: p.packageCount,
      Date: p.requestedDate,
      Creneau: p.timeSlot,
      Livreur: p.driverName || 'Non assigné',
      Statut: p.status
    }));
    exportCSV(data, `fariousy_ramassages_${new Date().toISOString().substring(0, 10)}.csv`);
  };

  return (
    <div className="space-y-5">
      {/* Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <h2 className="text-xl font-black text-slate-900 tracking-tight">
            Gestion des Demandes de Ramassage
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Validation des demandes de collecte chez les e-commerçants et dispatching vers les livreurs
          </p>
        </div>

        <button
          onClick={handleExportCSV}
          className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-xl shadow-2xs transition-colors self-start sm:self-auto cursor-pointer"
        >
          <Download className="w-3.5 h-3.5 text-slate-600" />
          <span>Exporter Ramassages</span>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-3 border border-slate-200 rounded-2xl shadow-2xs">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            placeholder="Rechercher par réf, boutique, ville, livreur..."
            className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-500"
          />
        </div>

        <div className="flex items-center gap-2">
          <Filter className="w-3.5 h-3.5 text-slate-400" />
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value as any)}
            className="text-xs font-semibold px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-red-500"
          >
            <option value="all">Tous les statuts ({pickups.length})</option>
            <option value="en_attente">En attente</option>
            <option value="affectee">Affectée au livreur</option>
            <option value="terminee">Terminée</option>
            <option value="refusee">Refusée</option>
          </select>
        </div>
      </div>

      {/* Pickups Table */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-2xs overflow-hidden">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
            <tr>
              <th className="py-3 px-4">Réf. Demande</th>
              <th className="py-3 px-4">Marchand (Client)</th>
              <th className="py-3 px-4">Adresse de Collecte</th>
              <th className="py-3 px-4 text-center">Nombre Colis</th>
              <th className="py-3 px-4">Date & Créneau</th>
              <th className="py-3 px-4">Livreur Assigné</th>
              <th className="py-3 px-4">Statut</th>
              <th className="py-3 px-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredPickups.map(req => (
              <tr key={req.id} className="hover:bg-slate-50">
                <td className="py-3 px-4 font-mono font-bold text-slate-900">{req.trackingId}</td>
                <td className="py-3 px-4">
                  <span className="font-extrabold text-slate-900 block">{req.clientCompany}</span>
                  <span className="text-[11px] text-slate-500">{req.clientPhone}</span>
                </td>
                <td className="py-3 px-4 max-w-[220px]">
                  <span className="font-bold text-slate-800 block">{req.city}</span>
                  <span className="text-slate-500 text-[11px] truncate block">{req.address}</span>
                  {req.notes && <span className="text-[10px] text-amber-700 italic block mt-0.5">Note: {req.notes}</span>}
                </td>
                <td className="py-3 px-4 text-center font-mono font-black text-slate-900 text-sm">
                  {req.packageCount}
                </td>
                <td className="py-3 px-4 font-medium text-slate-700">
                  <div className="flex items-center gap-1 font-mono text-[11px]">
                    <Clock className="w-3.5 h-3.5 text-slate-400" />
                    <span>{req.requestedDate}</span>
                  </div>
                  <span className="text-[10px] text-slate-500 capitalize">{req.timeSlot.replace('_', ' ')}</span>
                </td>
                <td className="py-3 px-4">
                  {req.driverName ? (
                    <div className="flex items-center gap-1 font-semibold text-slate-800">
                      <Truck className="w-3.5 h-3.5 text-slate-500" />
                      <span>{req.driverName}</span>
                    </div>
                  ) : (
                    <span className="text-slate-400 italic">En attente</span>
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
                      ? 'À affecter'
                      : req.status === 'affectee'
                      ? 'Livreur en route'
                      : req.status === 'terminee'
                      ? 'Ramassé ✓'
                      : 'Refusée'}
                  </span>
                </td>
                <td className="py-3 px-4 text-right">
                  <div className="flex items-center justify-end gap-1.5">
                    {req.status === 'en_attente' && (
                      <>
                        <button
                          onClick={() => {
                            setAssigningPickup(req);
                            const best = getBestDriverForTarget({
                              targetCity: req.city,
                              targetAddress: req.address,
                              drivers,
                              cities,
                              packages
                            });
                            setSelectedDriverId(best?.driver.id || drivers[0]?.id || '');
                          }}
                          className="px-2.5 py-1.5 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-lg cursor-pointer"
                        >
                          Affecter livreur
                        </button>
                        <button
                          onClick={() => setRejectingPickup(req)}
                          className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </>
                    )}
                    {req.status === 'affectee' && (
                      <button
                        onClick={() => handleComplete(req.id)}
                        className="px-2.5 py-1.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg cursor-pointer"
                      >
                        ✓ Marquer Ramassé
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => deletePickupRequest(req.id)}
                      title="Supprimer cette demande de ramassage"
                      className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {filteredPickups.length === 0 && (
              <tr>
                <td colSpan={8} className="py-12 text-center text-slate-400">
                  <CalendarCheck className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                  <p className="text-xs font-semibold text-slate-500">
                    Aucune demande de ramassage enregistrée pour le moment.
                  </p>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Assign Driver Modal */}
      {assigningPickup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs no-print">
          <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50">
              <h3 className="text-base font-bold text-slate-900">Affecter un Livreur au Ramassage</h3>
              <button onClick={() => setAssigningPickup(null)} className="p-2 text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAssignSubmit} className="p-6 space-y-4">
              <div className="text-xs text-slate-600 p-3 bg-slate-50 rounded-xl space-y-1">
                <p>
                  Marchand : <strong>{assigningPickup.clientCompany}</strong>
                </p>
                <p>
                  Volume : <strong>{assigningPickup.packageCount} colis</strong> à {assigningPickup.city}
                </p>
                <p>Adresse : {assigningPickup.address}</p>
              </div>

              {(() => {
                const suggestions = suggestDriversForTarget({
                  targetCity: assigningPickup.city,
                  targetAddress: assigningPickup.address,
                  drivers,
                  cities,
                  packages
                });
                const best = suggestions[0];
                return (
                  <div className="space-y-3">
                    {best && (
                      <div className="p-2.5 bg-indigo-50 border border-indigo-200 rounded-xl flex items-center justify-between gap-2 text-xs">
                        <div className="flex items-start gap-2">
                          <Sparkles className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
                          <div>
                            <div className="font-extrabold text-indigo-950">
                              ⚡ أقرب سائق لـ {assigningPickup.city} : {best.driver.name}
                            </div>
                            <div className="text-[11px] text-indigo-700">{best.matchReason}</div>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => setSelectedDriverId(best.driver.id)}
                          className="px-2.5 py-1 bg-indigo-600 text-white text-[10px] font-bold rounded-lg shrink-0 cursor-pointer"
                        >
                          اختيار
                        </button>
                      </div>
                    )}
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Sélectionner le livreur (مرتبين حسب القرب) :
                      </label>
                      <select
                        value={selectedDriverId}
                        onChange={e => setSelectedDriverId(e.target.value)}
                        className="w-full text-xs font-semibold bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-900"
                      >
                        {suggestions.map(s => (
                          <option key={s.driver.id} value={s.driver.id}>
                            {s.driver.name} ({s.driver.city} - {s.driver.driverVehicle || 'Véhicule'}) [{s.matchLabel}]
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                );
              })()}

              <div className="pt-3 border-t flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setAssigningPickup(null)}
                  className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-xl"
                >
                  Confirmer l'affectation
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reject Modal */}
      {rejectingPickup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs no-print">
          <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50">
              <h3 className="text-base font-bold text-slate-900">Refuser la Demande</h3>
              <button onClick={() => setRejectingPickup(null)} className="p-2 text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleRejectSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Motif du refus</label>
                <textarea
                  rows={3}
                  required
                  value={rejectionReason}
                  onChange={e => setRejectionReason(e.target.value)}
                  placeholder="Ex: Hors zone de couverture pour aujourd'hui, reporté à demain..."
                  className="w-full text-xs bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-900"
                />
              </div>

              <div className="pt-3 border-t flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setRejectingPickup(null)}
                  className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl"
                >
                  Refuser
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
