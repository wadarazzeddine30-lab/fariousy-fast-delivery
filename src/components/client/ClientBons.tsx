import React, { useState, useMemo } from 'react';
import { useDatabase } from '../../context/DatabaseContext';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../i18n/LanguageContext';
import { BonItem, PackageItem } from '../../types';
import { BonPrintModal } from '../bons/BonPrintModal';
import { 
  Package, 
  Plus, 
  Printer, 
  Search, 
  Eye, 
  FileSpreadsheet, 
  CheckCircle2, 
  Clock, 
  X, 
  Calendar, 
  Check, 
  AlertCircle
} from 'lucide-react';
import { formatMAD, formatDate } from '../../utils/barcode';

export const ClientBons: React.FC = () => {
  const { bons, packages, createBonClient } = useDatabase();
  const { currentUser } = useAuth();
  const { t, isRtl } = useLanguage();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPrintBon, setSelectedPrintBon] = useState<BonItem | null>(null);
  const [selectedDetailBon, setSelectedDetailBon] = useState<BonItem | null>(null);

  // New Bon Client Creation Modal State
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedPackageIds, setSelectedPackageIds] = useState<string[]>([]);
  const [notes, setNotes] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Filter Bons for this client
  const myBons: BonItem[] = useMemo(() => {
    if (!currentUser) return [];
    return bons.filter(b => b.type === 'client' && b.clientId === currentUser.id);
  }, [bons, currentUser]);

  // Packages of this client ready for pickup (nouveau or attente_ramassage)
  const readyPackages: PackageItem[] = useMemo(() => {
    if (!currentUser) return [];
    return packages.filter(
      p => p.clientId === currentUser.id && (p.status === 'nouveau' || p.status === 'attente_ramassage')
    );
  }, [packages, currentUser]);

  // Filtered list by search
  const filteredBons = useMemo(() => {
    return myBons.filter(b => {
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return b.bonNumber.toLowerCase().includes(q) || b.date.includes(q);
      }
      return true;
    });
  }, [myBons, searchQuery]);

  // Select all ready packages
  const handleToggleSelectAll = () => {
    if (selectedPackageIds.length === readyPackages.length) {
      setSelectedPackageIds([]);
    } else {
      setSelectedPackageIds(readyPackages.map(p => p.id));
    }
  };

  // Submit Bon Client Creation
  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    if (!currentUser) return;
    if (selectedPackageIds.length === 0) {
      setErrorMessage('Veuillez sélectionner au moins un colis pour générer le bon.');
      return;
    }

    setIsCreating(true);
    const res = await createBonClient(
      {
        clientId: currentUser.id,
        packageIds: selectedPackageIds,
        notes
      },
      { name: currentUser.companyName || currentUser.name, role: 'client' }
    );
    setIsCreating(false);

    if (res.success && res.bon) {
      setIsCreateModalOpen(false);
      setSelectedPackageIds([]);
      setNotes('');
      setSelectedPrintBon(res.bon); // Offer immediate printing
    } else {
      setErrorMessage(res.error || 'Erreur lors de la génération du bon client.');
    }
  };

  return (
    <div className="space-y-6">
      {/* ================= 1. PAGE HEADER ================= */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-bold shadow-xs">
              <Package className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-black text-slate-900 leading-tight">
                البونات ديالي (Mes Bons d'Expédition & Ramassage)
              </h1>
              <p className="text-xs text-slate-500 mt-0.5">
                Générez et imprimez vos bordereaux de ramassage officiels pour les remettre au livreur FARIOUSY
              </p>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={() => {
            setErrorMessage(null);
            setSelectedPackageIds(readyPackages.map(p => p.id)); // Pre-select ready packages
            setIsCreateModalOpen(true);
          }}
          className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-xs transition cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>إنشاء بون إرسال جديد (Créer un Bon Client)</span>
        </button>
      </div>

      {/* KPI Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Total Bons Créés</span>
          <div className="text-2xl font-black text-slate-900 mt-1">{myBons.length}</div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Colis Prêts au Ramassage</span>
          <div className="text-2xl font-black text-indigo-600 mt-1">{readyPackages.length} Colis</div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Total Colis sous Bon</span>
          <div className="text-2xl font-black text-slate-900 mt-1">
            {myBons.reduce((sum, b) => sum + b.totalPackages, 0)}
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Valeur CRBT Totale</span>
          <div className="text-2xl font-black text-emerald-600 mt-1">
            {formatMAD(myBons.reduce((sum, b) => sum + b.totalCodAmount, 0))}
          </div>
        </div>
      </div>

      {/* Search Bar */}
      <div className="flex items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Rechercher par N° de bon ou date..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-hidden"
          />
        </div>
        <span className="text-xs text-slate-500 font-semibold">
          {filteredBons.length} bons d'expédition trouvés
        </span>
      </div>

      {/* Table of Bons */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
        {filteredBons.length === 0 ? (
          <div className="p-12 text-center text-slate-400 space-y-3">
            <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto text-slate-400">
              <Package className="w-6 h-6" />
            </div>
            <h3 className="font-bold text-slate-700 text-sm">Aucun bon client pour le moment</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              Cliquez sur "Créer un Bon Client" pour regrouper vos colis prêts et imprimer votre bordereau d'expédition à remettre au livreur.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider text-[10px]">
                  <th className="py-3 px-4">N° du Bon Client</th>
                  <th className="py-3 px-4">Date de Création</th>
                  <th className="py-3 px-4 text-center">Nombre de Colis</th>
                  <th className="py-3 px-4 text-right">Valeur CRBT Totale</th>
                  <th className="py-3 px-4 text-center">Statut</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredBons.map(bon => {
                  const bonPkgs = packages.filter(p => bon.packageIds.includes(p.id));
                  return (
                    <tr key={bon.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-4 font-mono font-bold text-slate-900">
                        <span className="text-indigo-600 bg-indigo-50 border border-indigo-200 px-2.5 py-0.5 rounded">
                          {bon.bonNumber}
                        </span>
                      </td>

                      <td className="py-3 px-4 text-slate-600 font-mono">
                        {formatDate(bon.date)}
                      </td>

                      <td className="py-3 px-4 text-center font-bold font-mono text-sm text-slate-900">
                        {bonPkgs.length} Colis
                      </td>

                      <td className="py-3 px-4 text-right font-black font-mono text-slate-900">
                        {formatMAD(bon.totalCodAmount)}
                      </td>

                      <td className="py-3 px-4 text-center">
                        <span className="inline-block px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-100 text-emerald-800">
                          {bon.status === 'en_attente' ? 'En attente de ramassage' : bon.status === 'valide' ? 'Pris en charge' : bon.status}
                        </span>
                      </td>

                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => setSelectedPrintBon(bon)}
                            className="flex items-center gap-1 px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-bold shadow-2xs transition cursor-pointer"
                            title="طباعة البون الرسمي (Imprimer A4)"
                          >
                            <Printer className="w-3.5 h-3.5" />
                            <span>طباعة (Imprimer)</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => setSelectedDetailBon(bon)}
                            className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition cursor-pointer"
                            title="Consulter les colis"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ================= 2. MODAL CRÉER UN BON CLIENT ================= */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/75 backdrop-blur-xs overflow-y-auto">
          <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col my-auto max-h-[92vh]">
            <form onSubmit={handleCreateSubmit} className="flex flex-col h-full">
              <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-bold">
                    <Package className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-900 leading-tight">
                      إنشاء بون إرسال جديد (Créer un Bon Client)
                    </h3>
                    <p className="text-xs text-slate-500">
                      Sélectionnez les colis que vous souhaitez remettre au livreur FARIOUSY
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="p-2 text-slate-400 hover:text-slate-600 rounded-lg"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6 overflow-y-auto space-y-4">
                {errorMessage && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs font-bold text-red-600 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{errorMessage}</span>
                  </div>
                )}

                {/* Packages Selection */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-bold text-slate-700">
                      الطرود المتوفرة للإرسال (Colis prêts pour expédition) :
                    </label>
                    <button
                      type="button"
                      onClick={handleToggleSelectAll}
                      className="text-xs text-indigo-600 hover:text-indigo-700 font-bold cursor-pointer"
                    >
                      {selectedPackageIds.length === readyPackages.length && readyPackages.length > 0
                        ? 'Désélectionner tout'
                        : `Tout sélectionner (${readyPackages.length})`}
                    </button>
                  </div>

                  <div className="border border-slate-200 rounded-xl overflow-hidden max-h-60 overflow-y-auto">
                    {readyPackages.length === 0 ? (
                      <div className="p-8 text-center text-xs text-slate-400">
                        Vous n'avez aucun nouveau colis prêt au ramassage. Ajoutez d'abord vos colis.
                      </div>
                    ) : (
                      <table className="w-full text-left text-xs border-collapse">
                        <thead className="bg-slate-50 sticky top-0 border-b border-slate-200">
                          <tr className="text-[10px] font-bold text-slate-500 uppercase">
                            <th className="p-2 text-center w-8">Choix</th>
                            <th className="p-2">Code Suivi</th>
                            <th className="p-2">Destinataire</th>
                            <th className="p-2">Ville</th>
                            <th className="p-2 text-right">CRBT</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {readyPackages.map(pkg => {
                            const isSelected = selectedPackageIds.includes(pkg.id);
                            return (
                              <tr
                                key={pkg.id}
                                onClick={() => {
                                  setSelectedPackageIds(prev =>
                                    isSelected ? prev.filter(id => id !== pkg.id) : [...prev, pkg.id]
                                  );
                                }}
                                className={`cursor-pointer transition-colors ${isSelected ? 'bg-indigo-50/70' : 'hover:bg-slate-50'}`}
                              >
                                <td className="p-2 text-center">
                                  <input
                                    type="checkbox"
                                    checked={isSelected}
                                    onChange={() => {}}
                                    className="rounded text-indigo-600"
                                  />
                                </td>
                                <td className="p-2 font-mono font-bold text-slate-900">{pkg.trackingNumber}</td>
                                <td className="p-2 font-bold text-slate-800">{pkg.recipientName}</td>
                                <td className="p-2 text-slate-700">{pkg.city}</td>
                                <td className="p-2 text-right font-black font-mono text-slate-900">{pkg.codAmount || 0} DH</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    )}
                  </div>

                  {/* Summary Bar */}
                  <div className="mt-2 p-2.5 bg-slate-900 text-white rounded-xl flex items-center justify-between text-xs">
                    <div>
                      <span className="text-slate-400">Colis dans ce bon : </span>
                      <strong className="text-white text-sm font-black">{selectedPackageIds.length} Colis</strong>
                    </div>
                    <div>
                      <span className="text-slate-400">Valeur totale : </span>
                      <strong className="text-emerald-400 text-sm font-black font-mono">
                        {formatMAD(
                          packages.filter(p => selectedPackageIds.includes(p.id)).reduce((sum, p) => sum + (p.codAmount || 0), 0)
                        )}
                      </strong>
                    </div>
                  </div>
                </div>

                {/* Notes */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    ملاحظات على البون (Notes ou remarques)
                  </label>
                  <textarea
                    rows={2}
                    value={notes}
                    onChange={e => setNotes(e.target.value)}
                    placeholder="Instructions particulières..."
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-xs"
                  />
                </div>
              </div>

              {/* Modal Footer */}
              <div className="flex items-center justify-between px-6 py-4 border-t border-slate-200 bg-slate-50">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-200 rounded-xl transition"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={isCreating || selectedPackageIds.length === 0}
                  className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold shadow-xs transition cursor-pointer"
                >
                  <Check className="w-4 h-4" />
                  <span>{isCreating ? 'En cours...' : 'تأكيد وإنشاء البون (Générer et Imprimer)'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= 3. MODAL DÉTAILS D'UN BON ================= */}
      {selectedDetailBon && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/75 backdrop-blur-xs overflow-y-auto">
          <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col my-auto max-h-[92vh]">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  تفاصيل البون {selectedDetailBon.bonNumber}
                </h3>
                <p className="text-xs text-slate-500">
                  {selectedDetailBon.packageIds.length} colis • Valeur CRBT : {formatMAD(selectedDetailBon.totalCodAmount)}
                </p>
              </div>
              <button
                onClick={() => setSelectedDetailBon(null)}
                className="p-2 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto">
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold">
                    <tr>
                      <th className="p-2.5">Code Suivi</th>
                      <th className="p-2.5">Destinataire</th>
                      <th className="p-2.5">Ville</th>
                      <th className="p-2.5 text-right">CRBT</th>
                      <th className="p-2.5 text-center">Statut</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {packages
                      .filter(p => selectedDetailBon.packageIds.includes(p.id))
                      .map(pkg => (
                        <tr key={pkg.id}>
                          <td className="p-2.5 font-mono font-bold text-slate-900">{pkg.trackingNumber}</td>
                          <td className="p-2.5 font-bold text-slate-800">{pkg.recipientName}</td>
                          <td className="p-2.5 text-slate-700">{pkg.city}</td>
                          <td className="p-2.5 text-right font-black font-mono text-slate-900">{pkg.codAmount || 0} DH</td>
                          <td className="p-2.5 text-center">
                            <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-slate-100 text-slate-800">
                              {pkg.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="flex items-center justify-between px-6 py-4 border-t border-slate-200 bg-slate-50">
              <button
                type="button"
                onClick={() => setSelectedDetailBon(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-200 rounded-xl transition"
              >
                Fermer
              </button>
              <button
                type="button"
                onClick={() => {
                  const b = selectedDetailBon;
                  setSelectedDetailBon(null);
                  setSelectedPrintBon(b);
                }}
                className="flex items-center gap-2 px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold shadow-xs transition cursor-pointer"
              >
                <Printer className="w-4 h-4" />
                <span>طباعة هذا البون (Imprimer)</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= 4. PRINT MODAL ================= */}
      <BonPrintModal
        bon={selectedPrintBon}
        isOpen={!!selectedPrintBon}
        onClose={() => setSelectedPrintBon(null)}
      />
    </div>
  );
};
