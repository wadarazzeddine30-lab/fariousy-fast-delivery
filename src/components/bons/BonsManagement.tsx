import React, { useState, useMemo } from 'react';
import { useDatabase } from '../../context/DatabaseContext';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../i18n/LanguageContext';
import { BonItem, BonStatus, BonType, PackageItem, UserProfile } from '../../types';
import { BonPrintModal } from './BonPrintModal';
import { 
  Truck, 
  Package, 
  Plus, 
  Printer, 
  Search, 
  Filter, 
  CheckCircle2, 
  Clock, 
  X, 
  FileSpreadsheet, 
  Trash2, 
  Eye, 
  Calendar, 
  Check, 
  Scan, 
  MapPin, 
  Phone, 
  ArrowUpDown,
  Building,
  RotateCcw
} from 'lucide-react';
import { formatMAD, formatDate, formatDateTime } from '../../utils/barcode';

interface BonsManagementProps {
  externalSubTab?: { tab: BonType; nonce: number } | null;
}

export const BonsManagement: React.FC<BonsManagementProps> = ({ externalSubTab }) => {
  const { bons, packages, users, createBonDelivery, createBonClient, updateBonStatus, deleteBon } = useDatabase();
  const { currentUser } = useAuth();
  const { t, isRtl } = useLanguage();

  const [activeSubTab, setActiveSubTab] = useState<BonType>('delivery');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedPrintBon, setSelectedPrintBon] = useState<BonItem | null>(null);
  const [selectedDetailBon, setSelectedDetailBon] = useState<BonItem | null>(null);

  React.useEffect(() => {
    if (externalSubTab?.nonce) {
      setActiveSubTab(externalSubTab.tab);
      setStatusFilter('all');
    }
  }, [externalSubTab?.nonce, externalSubTab?.tab]);

  // New Bon Delivery Modal State
  const [isDeliveryModalOpen, setIsDeliveryModalOpen] = useState(false);
  const [selectedDriverId, setSelectedDriverId] = useState('');
  const [selectedCity, setSelectedCity] = useState('');
  const [deliveryNotes, setDeliveryNotes] = useState('');
  const [selectedPackageIds, setSelectedPackageIds] = useState<string[]>([]);
  const [pkgSearchTerm, setPkgSearchTerm] = useState('');
  const [barcodeInput, setBarcodeInput] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // New Bon Client Modal State
  const [isClientModalOpen, setIsClientModalOpen] = useState(false);
  const [selectedClientId, setSelectedClientId] = useState('');
  const [clientNotes, setClientNotes] = useState('');
  const [selectedClientPkgIds, setSelectedClientPkgIds] = useState<string[]>([]);

  // Drivers and Clients lists
  const drivers: UserProfile[] = useMemo(() => {
    return users.filter(u => u.role === 'driver');
  }, [users]);

  const clients: UserProfile[] = useMemo(() => {
    return users.filter(u => u.role === 'client');
  }, [users]);

  // Packages available for assigning to a Bon Delivery (not yet delivered/returned)
  const availableDeliveryPackages: PackageItem[] = useMemo(() => {
    return packages.filter(p => {
      // Must not be delivered or returned
      if (p.status === 'livre' || p.status === 'retourne' || p.status === 'annule') return false;
      // Filter by city if selected
      if (selectedCity && p.city.toLowerCase() !== selectedCity.toLowerCase()) return false;
      // Filter by search term
      if (pkgSearchTerm) {
        const q = pkgSearchTerm.toLowerCase();
        return (
          p.trackingNumber.toLowerCase().includes(q) ||
          p.recipientName.toLowerCase().includes(q) ||
          p.recipientPhone.includes(q) ||
          p.city.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [packages, selectedCity, pkgSearchTerm]);

  // Packages available for a Bon Client (from the selected client and not yet delivered/cancelled)
  const availableClientPackages: PackageItem[] = useMemo(() => {
    if (!selectedClientId) return [];
    return packages.filter(p => p.clientId === selectedClientId && (p.status === 'nouveau' || p.status === 'attente_ramassage'));
  }, [packages, selectedClientId]);

  // Filtered Bons for current tab
  const filteredBons: BonItem[] = useMemo(() => {
    return bons.filter(b => {
      if (b.type !== activeSubTab) return false;
      if (statusFilter !== 'all' && b.status !== statusFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          b.bonNumber.toLowerCase().includes(q) ||
          (b.driverName && b.driverName.toLowerCase().includes(q)) ||
          (b.clientName && b.clientName.toLowerCase().includes(q)) ||
          (b.city && b.city.toLowerCase().includes(q))
        );
      }
      return true;
    });
  }, [bons, activeSubTab, statusFilter, searchQuery]);

  // Stats
  const deliveryBonsCount = bons.filter(b => b.type === 'delivery').length;
  const clientBonsCount = bons.filter(b => b.type === 'client').length;
  const activeDeliveryBons = bons.filter(b => b.type === 'delivery' && b.status === 'en_cours').length;
  const totalPackagesUnderBon = bons.reduce((sum, b) => sum + b.totalPackages, 0);
  const totalCodUnderBon = bons.reduce((sum, b) => sum + b.totalCodAmount, 0);

  // Quick scan barcode handler to add package to Bon Delivery selection
  const handleBarcodeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!barcodeInput.trim()) return;
    const clean = barcodeInput.trim().toUpperCase();
    const found = packages.find(p => p.trackingNumber.toUpperCase() === clean || p.id.toUpperCase() === clean);
    if (found) {
      if (!selectedPackageIds.includes(found.id)) {
        setSelectedPackageIds(prev => [found.id, ...prev]);
        setBarcodeInput('');
        setFormError(null);
      } else {
        setFormError(`Le colis ${found.trackingNumber} est déjà ajouté à la sélection.`);
      }
    } else {
      setFormError(`Colis introuvable pour le code ${clean}`);
    }
  };

  // Toggle select all packages for delivery
  const handleSelectAllDeliveryPackages = () => {
    if (selectedPackageIds.length === availableDeliveryPackages.length) {
      setSelectedPackageIds([]);
    } else {
      setSelectedPackageIds(availableDeliveryPackages.map(p => p.id));
    }
  };

  // Submit Bon Delivery Creation
  const handleCreateBonDeliverySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (!selectedDriverId) {
      setFormError('Veuillez sélectionner un livreur.');
      return;
    }
    if (selectedPackageIds.length === 0) {
      setFormError('Veuillez sélectionner au moins un colis.');
      return;
    }

    setIsCreating(true);
    const res = await createBonDelivery(
      {
        driverId: selectedDriverId,
        packageIds: selectedPackageIds,
        notes: deliveryNotes,
        city: selectedCity
      },
      currentUser ? { name: currentUser.name, role: currentUser.role } : undefined
    );
    setIsCreating(false);

    if (res.success && res.bon) {
      setIsDeliveryModalOpen(false);
      setSelectedPackageIds([]);
      setDeliveryNotes('');
      setSelectedDriverId('');
      setSelectedCity('');
      setSelectedPrintBon(res.bon); // Offer immediate printing
    } else {
      setFormError(res.error || 'Erreur lors de la création du bon.');
    }
  };

  // Submit Bon Client Creation
  const handleCreateBonClientSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (!selectedClientId) {
      setFormError('Veuillez sélectionner un client.');
      return;
    }
    if (selectedClientPkgIds.length === 0) {
      setFormError('Veuillez sélectionner au moins un colis pour ce bon client.');
      return;
    }

    setIsCreating(true);
    const res = await createBonClient(
      {
        clientId: selectedClientId,
        packageIds: selectedClientPkgIds,
        notes: clientNotes
      },
      currentUser ? { name: currentUser.name, role: currentUser.role } : undefined
    );
    setIsCreating(false);

    if (res.success && res.bon) {
      setIsClientModalOpen(false);
      setSelectedClientPkgIds([]);
      setClientNotes('');
      setSelectedClientId('');
      setSelectedPrintBon(res.bon);
    } else {
      setFormError(res.error || 'Erreur lors de la création du bon.');
    }
  };

  // Close / Clôturer Tournée
  const handleCloseTournee = async (bon: BonItem) => {
    if (confirm(`Voulez-vous clôturer la tournée ${bon.bonNumber} du livreur ${bon.driverName} ?`)) {
      await updateBonStatus(bon.id, 'termine', undefined, currentUser ? { name: currentUser.name, role: currentUser.role } : undefined);
    }
  };

  // Delete Bon
  const handleDeleteBon = async (bon: BonItem) => {
    if (confirm(`Êtes-vous sûr de vouloir supprimer définitivement le bon ${bon.bonNumber} ?`)) {
      await deleteBon(bon.id);
    }
  };

  return (
    <div className="space-y-6">
      {/* ================= 1. PAGE HEADER & STATS ================= */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-red-600 text-white flex items-center justify-center font-bold shadow-xs">
              <Truck className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-black text-slate-900 leading-tight">
                إدارة البونات ومستندات التوزيع (Gestion des Bons)
              </h1>
              <p className="text-xs text-slate-500 mt-0.5">
                Bons de livraison pour les livreurs (Feuilles de tournée) & Bons d'expédition / ramassage pour les clients
              </p>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          {activeSubTab === 'delivery' ? (
            <button
              type="button"
              onClick={() => {
                setFormError(null);
                setSelectedPackageIds([]);
                setIsDeliveryModalOpen(true);
              }}
              className="flex items-center gap-2 px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold shadow-xs transition cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Nouveau Bon Delivery (Livreur)</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => {
                setFormError(null);
                setSelectedClientPkgIds([]);
                setIsClientModalOpen(true);
              }}
              className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-xs transition cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Nouveau Bon Client (Ramassage)</span>
            </button>
          )}
        </div>
      </div>

      {/* KPI Stats Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Bons Delivery (Livreurs)</span>
          <div className="text-2xl font-black text-slate-900 mt-1 flex items-baseline gap-2">
            <span>{deliveryBonsCount}</span>
            <span className="text-xs text-red-600 font-bold">({activeDeliveryBons} en tournée)</span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Bons Client (Ramassage)</span>
          <div className="text-2xl font-black text-indigo-600 mt-1">
            {clientBonsCount}
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Total Colis sous Bon</span>
          <div className="text-2xl font-black text-slate-900 mt-1">
            {totalPackagesUnderBon} <span className="text-xs font-bold text-slate-500">Colis</span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Valeur CRBT Totale</span>
          <div className="text-2xl font-black text-emerald-600 mt-1">
            {formatMAD(totalCodUnderBon)}
          </div>
        </div>
      </div>

      {/* ================= 2. SUBTABS & FILTER BAR ================= */}
      <div className="space-y-4">
        {/* Subtabs switcher */}
        <div className="flex border-b border-slate-200 bg-white rounded-t-xl px-4 pt-2">
          <button
            type="button"
            onClick={() => {
              setActiveSubTab('delivery');
              setStatusFilter('all');
            }}
            className={`flex items-center gap-2 px-5 py-3 text-xs sm:text-sm font-bold border-b-2 transition cursor-pointer ${
              activeSubTab === 'delivery'
                ? 'border-red-600 text-red-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Truck className="w-4 h-4" />
            <span>Bon delivery (Feuilles de Tournée Livreurs)</span>
            <span className="text-xs font-mono bg-slate-100 px-1.5 py-0.5 rounded-full text-slate-700">
              {deliveryBonsCount}
            </span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveSubTab('client');
              setStatusFilter('all');
            }}
            className={`flex items-center gap-2 px-5 py-3 text-xs sm:text-sm font-bold border-b-2 transition cursor-pointer ${
              activeSubTab === 'client'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Package className="w-4 h-4" />
            <span>Bon client (Bordereaux de Ramassage & Dépôt)</span>
            <span className="text-xs font-mono bg-slate-100 px-1.5 py-0.5 rounded-full text-slate-700">
              {clientBonsCount}
            </span>
          </button>
        </div>

        {/* Filter bar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-4 rounded-b-xl border border-t-0 border-slate-200 shadow-2xs">
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder={activeSubTab === 'delivery' ? 'Rechercher par N° Bon, Livreur, Ville...' : 'Rechercher par N° Bon, Client...'}
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-red-500/20"
            />
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <div className="flex items-center gap-1.5 text-xs text-slate-500">
              <Filter className="w-3.5 h-3.5" />
              <span>Statut :</span>
            </div>
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className="text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-bold text-slate-700"
            >
              <option value="all">Tous les statuts</option>
              <option value="en_cours">En cours (En tournée)</option>
              <option value="en_attente">En attente</option>
              <option value="valide">Validé</option>
              <option value="termine">Clôturé / Terminé</option>
            </select>
          </div>
        </div>
      </div>

      {/* ================= 3. BONS TABLE / LIST ================= */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
        {filteredBons.length === 0 ? (
          <div className="p-12 text-center text-slate-400 space-y-3">
            <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto text-slate-400">
              {activeSubTab === 'delivery' ? <Truck className="w-6 h-6" /> : <Package className="w-6 h-6" />}
            </div>
            <h3 className="font-bold text-slate-700 text-sm">
              {activeSubTab === 'delivery' ? 'Aucun Bon de Livraison trouvé' : 'Aucun Bon Client trouvé'}
            </h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              {activeSubTab === 'delivery'
                ? 'Créez un nouveau bon de livraison pour assigner un lot de colis à un livreur avec la feuille de tournée.'
                : 'Créez un bon client pour valider la prise en charge des colis reçus de vos expéditeurs.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider text-[10px]">
                  <th className="py-3 px-4">N° du Bon</th>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">
                    {activeSubTab === 'delivery' ? 'Livreur & Véhicule' : 'Client & Expéditeur'}
                  </th>
                  <th className="py-3 px-4">Zone / Ville</th>
                  <th className="py-3 px-4 text-center">Nombre Colis</th>
                  <th className="py-3 px-4 text-right">Total CRBT</th>
                  <th className="py-3 px-4 text-center">Statut</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredBons.map(bon => {
                  const bonPkgs = packages.filter(p => bon.packageIds.includes(p.id));
                  const deliveredCount = bonPkgs.filter(p => p.status === 'livre').length;
                  const progressPct = bonPkgs.length > 0 ? Math.round((deliveredCount / bonPkgs.length) * 100) : 0;

                  return (
                    <tr key={bon.id} className="hover:bg-slate-50/80 transition-colors">
                      {/* Bon Number */}
                      <td className="py-3 px-4 font-mono font-bold text-slate-900">
                        <span className="text-red-600 bg-red-50 border border-red-200 px-2 py-0.5 rounded">
                          {bon.bonNumber}
                        </span>
                      </td>

                      {/* Date */}
                      <td className="py-3 px-4 text-slate-600 font-mono">
                        {formatDate(bon.date)}
                      </td>

                      {/* Beneficiary */}
                      <td className="py-3 px-4">
                        {activeSubTab === 'delivery' ? (
                          <div>
                            <span className="font-bold text-slate-900 block">{bon.driverName || 'Livreur inconnu'}</span>
                            <span className="text-[10px] text-slate-500 font-mono">{bon.driverPhone} • {bon.driverVehicle || 'Moto'}</span>
                          </div>
                        ) : (
                          <div>
                            <span className="font-bold text-slate-900 block">{bon.clientCompany || bon.clientName}</span>
                            <span className="text-[10px] text-slate-500 font-mono">{bon.clientPhone}</span>
                          </div>
                        )}
                      </td>

                      {/* City */}
                      <td className="py-3 px-4 text-slate-700 font-semibold">
                        {bon.city || 'Laâyoune'}
                      </td>

                      {/* Packages count & Delivery progress */}
                      <td className="py-3 px-4 text-center">
                        <span className="font-black text-slate-900 font-mono text-sm block">
                          {bonPkgs.length}
                        </span>
                        {activeSubTab === 'delivery' && (
                          <div className="w-20 mx-auto mt-1">
                            <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                              <div
                                className="bg-emerald-500 h-full transition-all"
                                style={{ width: `${progressPct}%` }}
                              />
                            </div>
                            <span className="text-[9px] text-slate-500 font-mono block mt-0.5">
                              {deliveredCount}/{bonPkgs.length} ({progressPct}%)
                            </span>
                          </div>
                        )}
                      </td>

                      {/* Total CRBT */}
                      <td className="py-3 px-4 text-right font-black font-mono text-slate-900">
                        {formatMAD(bon.totalCodAmount)}
                      </td>

                      {/* Status */}
                      <td className="py-3 px-4 text-center">
                        <span className={`inline-block px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                          bon.status === 'termine' || bon.status === 'valide'
                            ? 'bg-emerald-100 text-emerald-800'
                            : bon.status === 'en_cours'
                            ? 'bg-amber-100 text-amber-900 animate-pulse'
                            : 'bg-slate-100 text-slate-700'
                        }`}>
                          {bon.status === 'en_cours' ? 'En Tournée' : bon.status === 'termine' ? 'Clôturé' : bon.status}
                        </span>
                      </td>

                      {/* Action buttons */}
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Print Button */}
                          <button
                            type="button"
                            onClick={() => setSelectedPrintBon(bon)}
                            className="p-1.5 text-slate-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition cursor-pointer"
                            title="طباعة البون (Imprimer le Bon A4)"
                          >
                            <Printer className="w-4 h-4" />
                          </button>

                          {/* Details Button */}
                          <button
                            type="button"
                            onClick={() => setSelectedDetailBon(bon)}
                            className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition cursor-pointer"
                            title="Consulter les colis de ce bon"
                          >
                            <Eye className="w-4 h-4" />
                          </button>

                          {/* Close Tournée Button (for delivery) */}
                          {activeSubTab === 'delivery' && bon.status === 'en_cours' && (
                            <button
                              type="button"
                              onClick={() => handleCloseTournee(bon)}
                              className="p-1.5 text-slate-600 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition cursor-pointer"
                              title="Clôturer la tournée du livreur"
                            >
                              <CheckCircle2 className="w-4 h-4" />
                            </button>
                          )}

                          {/* Delete Button */}
                          <button
                            type="button"
                            onClick={() => handleDeleteBon(bon)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                            title="Supprimer le bon"
                          >
                            <Trash2 className="w-4 h-4" />
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

      {/* ================= 4. MODAL: NOUVEAU BON DELIVERY (LIVREUR) ================= */}
      {isDeliveryModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/75 backdrop-blur-xs overflow-y-auto">
          <div className="relative w-full max-w-3xl bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col my-auto max-h-[95vh]">
            <form onSubmit={handleCreateBonDeliverySubmit} className="flex flex-col h-full">
              {/* Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-red-600 text-white flex items-center justify-center font-bold">
                    <Truck className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-900 leading-tight">
                      إنشاء بون توصيل جديد (Nouveau Bon Delivery)
                    </h3>
                    <p className="text-xs text-slate-500">
                      Générer une feuille de tournée et assigner les colis au livreur
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsDeliveryModalOpen(false)}
                  className="p-2 text-slate-400 hover:text-slate-600 rounded-lg"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Form Content */}
              <div className="p-6 overflow-y-auto space-y-5">
                {formError && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs font-bold text-red-600 flex items-center gap-2">
                    <X className="w-4 h-4 shrink-0" />
                    <span>{formError}</span>
                  </div>
                )}

                {/* Step 1: Select Driver & City */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      1. اختر الموزع (Livreur) *
                    </label>
                    <select
                      value={selectedDriverId}
                      onChange={e => {
                        setSelectedDriverId(e.target.value);
                        const drv = drivers.find(d => d.id === e.target.value);
                        if (drv && drv.city) setSelectedCity(drv.city);
                      }}
                      required
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-800"
                    >
                      <option value="">-- Sélectionner un livreur --</option>
                      {drivers.map(d => (
                        <option key={d.id} value={d.id}>
                          {d.name} ({d.phone}) - {d.city || 'Laâyoune'} [{d.vehicleType || 'Moto'}]
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      2. المدينة / المنطقة (Ville / Zone de distribution)
                    </label>
                    <input
                      type="text"
                      value={selectedCity}
                      onChange={e => setSelectedCity(e.target.value)}
                      placeholder="Ex: Laâyoune, Agadir, Casablanca..."
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800"
                    />
                  </div>
                </div>

                {/* Step 2: Barcode Quick Scan Input */}
                <div className="bg-slate-100 p-3 rounded-xl border border-slate-200 flex flex-col sm:flex-row items-center gap-2">
                  <div className="flex items-center gap-2 text-xs font-bold text-slate-700 shrink-0">
                    <Scan className="w-4 h-4 text-red-600" />
                    <span>إضافة سريعة بالباركود (Scanner) :</span>
                  </div>
                  <div className="flex-1 flex items-center gap-2 w-full">
                    <input
                      type="text"
                      placeholder="Scanner ou taper le code de suivi (ex: 7DF6285CDC9446)..."
                      value={barcodeInput}
                      onChange={e => setBarcodeInput(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleBarcodeSubmit(e);
                        }
                      }}
                      className="flex-1 bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-xs font-mono font-bold"
                    />
                    <button
                      type="button"
                      onClick={handleBarcodeSubmit}
                      className="px-3 py-1.5 bg-slate-900 text-white rounded-lg text-xs font-bold shrink-0 cursor-pointer"
                    >
                      Ajouter
                    </button>
                  </div>
                </div>

                {/* Step 3: Packages Selection Table */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-bold text-slate-700">
                      3. حدد الطرود التي سيتسلمها الموزع (Sélection des Colis) *
                    </label>
                    <button
                      type="button"
                      onClick={handleSelectAllDeliveryPackages}
                      className="text-xs text-red-600 hover:text-red-700 font-bold cursor-pointer"
                    >
                      {selectedPackageIds.length === availableDeliveryPackages.length && availableDeliveryPackages.length > 0
                        ? 'Désélectionner tout'
                        : `Tout sélectionner (${availableDeliveryPackages.length})`}
                    </button>
                  </div>

                  <div className="border border-slate-200 rounded-xl overflow-hidden max-h-60 overflow-y-auto">
                    {availableDeliveryPackages.length === 0 ? (
                      <div className="p-6 text-center text-xs text-slate-400">
                        Aucun colis disponible pour cette ville/filtre.
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
                          {availableDeliveryPackages.map(pkg => {
                            const isSelected = selectedPackageIds.includes(pkg.id);
                            return (
                              <tr
                                key={pkg.id}
                                onClick={() => {
                                  setSelectedPackageIds(prev =>
                                    isSelected ? prev.filter(id => id !== pkg.id) : [...prev, pkg.id]
                                  );
                                }}
                                className={`cursor-pointer transition-colors ${isSelected ? 'bg-red-50/70' : 'hover:bg-slate-50'}`}
                              >
                                <td className="p-2 text-center">
                                  <input
                                    type="checkbox"
                                    checked={isSelected}
                                    onChange={() => {}}
                                    className="rounded text-red-600 focus:ring-red-500"
                                  />
                                </td>
                                <td className="p-2 font-mono font-bold text-slate-900">{pkg.trackingNumber}</td>
                                <td className="p-2">
                                  <span className="font-bold block text-slate-800">{pkg.recipientName}</span>
                                  <span className="text-[10px] text-slate-500 font-mono">{pkg.recipientPhone}</span>
                                </td>
                                <td className="p-2 text-slate-700">{pkg.city}</td>
                                <td className="p-2 text-right font-black font-mono text-slate-900">{pkg.codAmount || 0} DH</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    )}
                  </div>

                  {/* Selected Summary Bar */}
                  <div className="mt-2 p-2.5 bg-slate-900 text-white rounded-xl flex items-center justify-between text-xs">
                    <div>
                      <span className="text-slate-400">Colis sélectionnés : </span>
                      <strong className="text-white text-sm font-black">{selectedPackageIds.length} Colis</strong>
                    </div>
                    <div>
                      <span className="text-slate-400">Total CRBT à encaisser : </span>
                      <strong className="text-emerald-400 text-sm font-black font-mono">
                        {formatMAD(
                          packages.filter(p => selectedPackageIds.includes(p.id)).reduce((sum, p) => sum + (p.codAmount || 0), 0)
                        )}
                      </strong>
                    </div>
                  </div>
                </div>

                {/* Step 4: Notes */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    4. ملاحظات أو تعليمات خاصة للموزع (Instructions)
                  </label>
                  <textarea
                    rows={2}
                    value={deliveryNotes}
                    onChange={e => setDeliveryNotes(e.target.value)}
                    placeholder="Instructions particulières de livraison, zone prioritaire..."
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-xs"
                  />
                </div>
              </div>

              {/* Modal Footer */}
              <div className="flex items-center justify-between px-6 py-4 border-t border-slate-200 bg-slate-50">
                <button
                  type="button"
                  onClick={() => setIsDeliveryModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-200 rounded-xl transition"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={isCreating || selectedPackageIds.length === 0}
                  className="flex items-center gap-2 px-6 py-2.5 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold shadow-xs transition cursor-pointer"
                >
                  <Check className="w-4 h-4" />
                  <span>{isCreating ? 'En cours de création...' : 'Créer et Imprimer le Bon Delivery'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= 5. MODAL: NOUVEAU BON CLIENT (RAMASSAGE / DÉPÔT) ================= */}
      {isClientModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/75 backdrop-blur-xs overflow-y-auto">
          <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col my-auto max-h-[95vh]">
            <form onSubmit={handleCreateBonClientSubmit} className="flex flex-col h-full">
              {/* Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-bold">
                    <Package className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-900 leading-tight">
                      إنشاء بون زبون جديد (Nouveau Bon Client)
                    </h3>
                    <p className="text-xs text-slate-500">
                      Bordereau de ramassage ou de dépôt pour valider la prise en charge
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsClientModalOpen(false)}
                  className="p-2 text-slate-400 hover:text-slate-600 rounded-lg"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Form Content */}
              <div className="p-6 overflow-y-auto space-y-4">
                {formError && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs font-bold text-red-600">
                    {formError}
                  </div>
                )}

                {/* Client Selector */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    1. اختر الزبون / التاجر (Client Expéditeur) *
                  </label>
                  <select
                    value={selectedClientId}
                    onChange={e => {
                      setSelectedClientId(e.target.value);
                      setSelectedClientPkgIds([]);
                    }}
                    required
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-800"
                  >
                    <option value="">-- Sélectionner un client --</option>
                    {clients.map(c => (
                      <option key={c.id} value={c.id}>
                        {c.companyName || c.name} ({c.phone}) - {c.city || 'Laâyoune'}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Packages Selection */}
                {selectedClientId && (
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-xs font-bold text-slate-700">
                        2. طرود الزبون الجاهزة للراماساج (Colis prêts) *
                      </label>
                      <button
                        type="button"
                        onClick={() => {
                          if (selectedClientPkgIds.length === availableClientPackages.length) {
                            setSelectedClientPkgIds([]);
                          } else {
                            setSelectedClientPkgIds(availableClientPackages.map(p => p.id));
                          }
                        }}
                        className="text-xs text-indigo-600 hover:text-indigo-700 font-bold cursor-pointer"
                      >
                        {selectedClientPkgIds.length === availableClientPackages.length && availableClientPackages.length > 0
                          ? 'Désélectionner tout'
                          : `Tout sélectionner (${availableClientPackages.length})`}
                      </button>
                    </div>

                    <div className="border border-slate-200 rounded-xl overflow-hidden max-h-56 overflow-y-auto">
                      {availableClientPackages.length === 0 ? (
                        <div className="p-6 text-center text-xs text-slate-400">
                          Ce client n'a aucun nouveau colis en attente de ramassage.
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
                            {availableClientPackages.map(pkg => {
                              const isSelected = selectedClientPkgIds.includes(pkg.id);
                              return (
                                <tr
                                  key={pkg.id}
                                  onClick={() => {
                                    setSelectedClientPkgIds(prev =>
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
                  </div>
                )}

                {/* Notes */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    3. ملاحظات (Notes)
                  </label>
                  <textarea
                    rows={2}
                    value={clientNotes}
                    onChange={e => setClientNotes(e.target.value)}
                    placeholder="Notes ou détails sur le dépôt/ramassage..."
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-xs"
                  />
                </div>
              </div>

              {/* Modal Footer */}
              <div className="flex items-center justify-between px-6 py-4 border-t border-slate-200 bg-slate-50">
                <button
                  type="button"
                  onClick={() => setIsClientModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-200 rounded-xl transition"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={isCreating || selectedClientPkgIds.length === 0}
                  className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold shadow-xs transition cursor-pointer"
                >
                  <Check className="w-4 h-4" />
                  <span>{isCreating ? 'En cours...' : 'Générer le Bon Client'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= 6. MODAL: DETAILS DU BON ================= */}
      {selectedDetailBon && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/75 backdrop-blur-xs overflow-y-auto">
          <div className="relative w-full max-w-3xl bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col my-auto max-h-[92vh]">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50">
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <span>Détails du Bon {selectedDetailBon.bonNumber}</span>
                  <span className="text-xs bg-slate-200 text-slate-800 px-2 py-0.5 rounded font-bold font-mono">
                    {selectedDetailBon.type === 'delivery' ? 'Bon Delivery' : 'Bon Client'}
                  </span>
                </h3>
                <p className="text-xs text-slate-500">
                  {selectedDetailBon.packageIds.length} colis associés • Total CRBT : {formatMAD(selectedDetailBon.totalCodAmount)}
                </p>
              </div>
              <button
                onClick={() => setSelectedDetailBon(null)}
                className="p-2 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-4">
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold">
                    <tr>
                      <th className="p-2.5">Code Suivi</th>
                      <th className="p-2.5">Destinataire</th>
                      <th className="p-2.5">Téléphone</th>
                      <th className="p-2.5">Ville</th>
                      <th className="p-2.5 text-right">CRBT</th>
                      <th className="p-2.5 text-center">Statut Actuel</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {packages
                      .filter(p => selectedDetailBon.packageIds.includes(p.id))
                      .map(pkg => (
                        <tr key={pkg.id}>
                          <td className="p-2.5 font-mono font-bold text-slate-900">{pkg.trackingNumber}</td>
                          <td className="p-2.5 font-bold text-slate-800">{pkg.recipientName}</td>
                          <td className="p-2.5 font-mono text-slate-600">{pkg.recipientPhone}</td>
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
                  const bon = selectedDetailBon;
                  setSelectedDetailBon(null);
                  setSelectedPrintBon(bon);
                }}
                className="flex items-center gap-2 px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold shadow-xs transition cursor-pointer"
              >
                <Printer className="w-4 h-4" />
                <span>Imprimer ce Bon</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= 7. MODAL D'IMPRESSION DU BON ================= */}
      <BonPrintModal
        bon={selectedPrintBon}
        isOpen={!!selectedPrintBon}
        onClose={() => setSelectedPrintBon(null)}
      />
    </div>
  );
};
