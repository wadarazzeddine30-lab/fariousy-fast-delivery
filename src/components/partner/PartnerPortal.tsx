import React, { useMemo, useState } from 'react';
import { useDatabase } from '../../context/DatabaseContext';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../i18n/LanguageContext';
import { PACKAGE_STATUS_CONFIG, PackageItem, PackageStatus, Partner, PartnerSettlement } from '../../types';
import { formatDate, formatMAD } from '../../utils/barcode';
import { getPartnerCityFee, getPartnerFeeForPackage } from '../../utils/partnerTariffs';
import {
  Banknote,
  Calculator,
  CheckCircle2,
  Clock,
  Code2,
  CornerDownLeft,
  Eye,
  FileImage,
  Handshake,
  LayoutDashboard,
  Mail,
  MapPin,
  Package,
  Phone,
  PhoneCall,
  Plus,
  Printer,
  Receipt,
  RefreshCw,
  Search,
  Truck,
  Wallet,
  X
} from 'lucide-react';
import { ActiveTab } from '../Sidebar';

interface PartnerPortalProps {
  mode: 'dashboard' | 'packages' | 'relances' | 'returns' | 'payments' | 'receipts';
  onNavigateTab: (tab: ActiveTab) => void;
  onViewPackage: (pkg: PackageItem) => void;
}

const PARTNER_ALLOWED_STATUSES: PackageStatus[] = [
  'en_cours_livraison',
  'livre',
  'pas_de_reponse',
  'reporte',
  'refuse',
  'retour_en_cours',
  'retourne'
];

const RELANCE_STATUSES: PackageStatus[] = [
  'pas_de_reponse',
  'reporte',
  'probleme_livraison'
];

const RETURN_STATUSES: PackageStatus[] = [
  'retour_en_cours',
  'retourne',
  'refuse',
  'annule'
];

export const PartnerPortal: React.FC<PartnerPortalProps> = ({
  mode,
  onNavigateTab,
  onViewPackage
}) => {
  const { currentUser } = useAuth();
  const { partners, packages, transferReceipts, changePackageStatus, updatePackage } = useDatabase();
  const { t, translateStatus, isRtl } = useLanguage();

  const formatDh = (amount: number | undefined | null) =>
    `Dh ${Number(amount || 0).toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    })}`;

  const formatDateTimeParts = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) {
        return { date: dateStr, time: '' };
      }
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      const hh = String(d.getHours()).padStart(2, '0');
      const min = String(d.getMinutes()).padStart(2, '0');
      return { date: `${yyyy}-${mm}-${dd}`, time: `${hh}:${min}` };
    } catch {
      return { date: dateStr, time: '' };
    }
  };

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [relanceScope, setRelanceScope] = useState<'priority' | 'undelivered'>('priority');
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  // Relance action modal state
  const [relanceTarget, setRelanceTarget] = useState<PackageItem | null>(null);
  const [relanceStatus, setRelanceStatus] = useState<PackageStatus>('en_cours_livraison');
  const [relanceNote, setRelanceNote] = useState('');

  // Return request modal state
  const [isReturnModalOpen, setIsReturnModalOpen] = useState(false);
  const [returnParcelId, setReturnParcelId] = useState('');
  const [returnReason, setReturnReason] = useState('Client injoignable après 3 tentatives');
  const [returnCustomNote, setReturnCustomNote] = useState('');

  // Receipt preview modal state
  const [selectedSettlementReceipt, setSelectedSettlementReceipt] = useState<PartnerSettlement | null>(null);
  const [selectedImageReceiptUrl, setSelectedImageReceiptUrl] = useState<string | null>(null);

  const currentPartner = useMemo<Partner>(() => {
    const matched = partners.find(
      p =>
        p.id === currentUser?.id ||
        (currentUser?.email && p.email && p.email.toLowerCase() === currentUser.email.toLowerCase()) ||
        (currentUser?.companyName && p.name.toLowerCase() === currentUser.companyName.toLowerCase())
    );
    if (matched) return matched;
    return {
      id: currentUser?.id || 'partner',
      name: currentUser?.companyName || currentUser?.name || 'Partenaire',
      contactPerson: currentUser?.name || currentUser?.companyName || 'Contact',
      phone: currentUser?.phone || '',
      email: currentUser?.email || '',
      city: currentUser?.city || 'Casablanca',
      address: currentUser?.address,
      active: true,
      deliveryFee: 30,
      returnFee: 10,
      settlements: [],
      apiTokens: []
    };
  }, [partners, currentUser]);

  const finance = useMemo(() => {
    const partnerParcels = packages.filter(
      pkg =>
        pkg.partnerId === currentPartner.id ||
        pkg.destinationAgency === currentPartner.name ||
        pkg.destinationAgency === `Agence ${currentPartner.city}`
    );
    const deliveredParcels = partnerParcels.filter(
      pkg => pkg.status === 'livre' && pkg.deliveredBy !== 'admin'
    );
    const returnedParcels = partnerParcels.filter(pkg => RETURN_STATUSES.includes(pkg.status));
    const relanceParcels = partnerParcels.filter(pkg => RELANCE_STATUSES.includes(pkg.status));
    const inTransitParcels = partnerParcels.filter(pkg =>
      ['en_transit', 'arrive_destination', 'en_cours_livraison', 'attente_ramassage', 'ramasse', 'en_stock'].includes(
        pkg.status
      )
    );

    const totalDeliveredCod = deliveredParcels.reduce((sum, p) => sum + (p.codAmount || 0), 0);
    const deliveryRate = currentPartner.deliveryFee ?? 30;
    const returnRate = currentPartner.returnFee ?? 10;
    const deliveryFees = deliveredParcels.reduce(
      (sum, p) => sum + getPartnerFeeForPackage(currentPartner, p),
      0
    );
    const returnFees = returnedParcels.length * returnRate;
    const totalPartnerFees = deliveryFees + returnFees;
    const settlements = currentPartner.settlements || [];
    const totalSettlementsReceived = settlements.reduce((sum, s) => sum + (s.amount || 0), 0);
    const balance = totalDeliveredCod - totalPartnerFees - totalSettlementsReceived;

    return {
      partnerParcels,
      deliveredParcels,
      returnedParcels,
      relanceParcels,
      inTransitParcels,
      totalDeliveredCod,
      deliveryRate,
      returnRate,
      returnFees,
      totalPartnerFees,
      settlements,
      totalSettlementsReceived,
      balance
    };
  }, [packages, currentPartner]);

  const filteredParcels = useMemo(() => {
    const q = search.trim().toLowerCase();
    return finance.partnerParcels.filter(pkg => {
      if (statusFilter !== 'all' && pkg.status !== statusFilter) return false;
      if (!q) return true;
      return (
        pkg.trackingNumber.toLowerCase().includes(q) ||
        (pkg.recipientName || '').toLowerCase().includes(q) ||
        (pkg.recipientPhone || '').includes(q) ||
        (pkg.city || '').toLowerCase().includes(q)
      );
    });
  }, [finance.partnerParcels, search, statusFilter]);

  const relanceList = useMemo(() => {
    const q = search.trim().toLowerCase();
    return finance.partnerParcels.filter(pkg => {
      const inScope =
        relanceScope === 'priority'
          ? RELANCE_STATUSES.includes(pkg.status)
          : !['livre', ...RETURN_STATUSES].includes(pkg.status);
      if (!inScope) return false;
      if (!q) return true;
      return (
        pkg.trackingNumber.toLowerCase().includes(q) ||
        (pkg.recipientName || '').toLowerCase().includes(q) ||
        (pkg.recipientPhone || '').includes(q) ||
        (pkg.city || '').toLowerCase().includes(q)
      );
    });
  }, [finance.partnerParcels, relanceScope, search]);

  const eligibleForReturnParcels = useMemo(() => {
    return finance.partnerParcels.filter(
      pkg => !['livre', ...RETURN_STATUSES].includes(pkg.status)
    );
  }, [finance.partnerParcels]);

  const filteredReturnParcels = useMemo(() => {
    const q = search.trim().toLowerCase();
    return finance.returnedParcels.filter(pkg => {
      if (!q) return true;
      return (
        pkg.trackingNumber.toLowerCase().includes(q) ||
        (pkg.recipientName || '').toLowerCase().includes(q) ||
        (pkg.recipientPhone || '').includes(q) ||
        (pkg.city || '').toLowerCase().includes(q)
      );
    });
  }, [finance.returnedParcels, search]);

  const partnerTransferReceipts = useMemo(() => {
    const partnerEmail = (currentPartner.email || '').toLowerCase();
    const partnerName = (currentPartner.name || '').toLowerCase();
    return transferReceipts.filter(r => {
      const cid = (r.clientId || '').toLowerCase();
      const cname = (r.clientName || '').toLowerCase();
      const comp = (r.clientCompany || '').toLowerCase();
      return (
        cid === currentPartner.id.toLowerCase() ||
        (partnerEmail && (cname.includes(partnerEmail) || cid === partnerEmail)) ||
        (partnerName && (comp.includes(partnerName) || cname.includes(partnerName)))
      );
    });
  }, [transferReceipts, currentPartner]);

  const handleStatusChange = async (pkg: PackageItem, newStatus: PackageStatus, customComment?: string) => {
    setUpdatingId(pkg.id);
    try {
      if (newStatus === 'livre') {
        const fee = getPartnerCityFee(currentPartner, pkg.city, pkg.partnerDeliveryFee);
        updatePackage(pkg.id, {
          deliveredBy: 'partner',
          partnerDeliveryFee: fee
        });
      }
      await changePackageStatus(
        pkg.id,
        newStatus,
        customComment || `Mise à jour partenaire (${currentPartner.name})`
      );
    } finally {
      setUpdatingId(null);
    }
  };

  const handleConfirmRelance = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!relanceTarget) return;
    const noteText = relanceNote.trim()
      ? `Relance partenaire (${currentPartner.name}): ${relanceNote.trim()}`
      : `Relance effectuée par ${currentPartner.name}`;
    await handleStatusChange(relanceTarget, relanceStatus, noteText);
    setRelanceTarget(null);
    setRelanceNote('');
  };

  const handleSubmitReturnRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    const pkg = finance.partnerParcels.find(p => p.id === returnParcelId);
    if (!pkg) return;
    const detail = returnCustomNote.trim() ? `${returnReason} — ${returnCustomNote.trim()}` : returnReason;
    await handleStatusChange(pkg, 'retour_en_cours', `Demande de retour (${currentPartner.name}): ${detail}`);
    setIsReturnModalOpen(false);
    setReturnParcelId('');
    setReturnCustomNote('');
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12">
      {/* Partner Header Banner */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-2xs flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-red-50 border border-red-200 text-red-600 flex items-center justify-center shrink-0">
            <Handshake className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-black text-slate-900">{currentPartner.name}</h1>
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                Partenaire Actif
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500 mt-1">
              <span className="flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5 text-red-500" />
                {currentPartner.city}
              </span>
              {currentPartner.phone && (
                <span className="flex items-center gap-1 font-mono">
                  <Phone className="w-3.5 h-3.5 text-slate-400" />
                  {currentPartner.phone}
                </span>
              )}
              {currentPartner.email && (
                <span className="flex items-center gap-1">
                  <Mail className="w-3.5 h-3.5 text-slate-400" />
                  {currentPartner.email}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => onNavigateTab('partner_packages')}
            className={`px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition cursor-pointer ${
              mode === 'packages' ? 'bg-red-600 text-white' : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
            }`}
          >
            <Package className="w-3.5 h-3.5" />
            <span>Colis ({finance.partnerParcels.length})</span>
          </button>
          <button
            onClick={() => onNavigateTab('partner_relances')}
            className={`px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition cursor-pointer ${
              mode === 'relances' ? 'bg-red-600 text-white' : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
            }`}
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Relances ({finance.relanceParcels.length})</span>
          </button>
          <button
            onClick={() => onNavigateTab('partner_returns')}
            className={`px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition cursor-pointer ${
              mode === 'returns' ? 'bg-red-600 text-white' : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
            }`}
          >
            <CornerDownLeft className="w-3.5 h-3.5" />
            <span>Retours ({finance.returnedParcels.length})</span>
          </button>
          <button
            onClick={() => onNavigateTab('partner_payments')}
            className={`px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition cursor-pointer ${
              mode === 'payments' ? 'bg-red-600 text-white' : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
            }`}
          >
            <Wallet className="w-3.5 h-3.5" />
            <span>Paiements</span>
          </button>
          <button
            onClick={() => onNavigateTab('partner_receipts')}
            className={`px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition cursor-pointer ${
              mode === 'receipts' ? 'bg-red-600 text-white' : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>Reçus</span>
          </button>
          <button
            onClick={() => onNavigateTab('partner_api')}
            className="px-3 py-2 rounded-xl text-xs font-bold bg-slate-900 hover:bg-slate-800 text-white flex items-center gap-1.5 transition cursor-pointer"
          >
            <Code2 className="w-3.5 h-3.5 text-amber-400" />
            <span>Accès API</span>
          </button>
        </div>
      </div>

      {/* KPI Summary Cards */}
      {(mode === 'dashboard' || mode === 'payments') && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="p-4 bg-white border border-slate-200 rounded-2xl shadow-2xs">
            <span className="text-[11px] font-bold text-slate-500 uppercase block">Total Colis Confiés</span>
            <div className="mt-2 flex items-baseline justify-between">
              <span className="text-2xl font-black text-slate-900 font-mono">
                {finance.partnerParcels.length}
              </span>
              <span className="text-xs font-semibold text-emerald-700">
                {finance.deliveredParcels.length} livrés
              </span>
            </div>
          </div>

          <div className="p-4 bg-white border border-slate-200 rounded-2xl shadow-2xs">
            <span className="text-[11px] font-bold text-slate-500 uppercase block">CRBT Collecté</span>
            <div className="mt-2">
              <span className="text-2xl font-black text-slate-900 font-mono">
                {formatMAD(finance.totalDeliveredCod)}
              </span>
            </div>
          </div>

          <div className="p-4 bg-white border border-slate-200 rounded-2xl shadow-2xs">
            <span className="text-[11px] font-bold text-slate-500 uppercase block">Frais Partenaire</span>
            <div className="mt-2">
              <span className="text-2xl font-black text-amber-700 font-mono">
                {formatMAD(finance.totalPartnerFees)}
              </span>
              <span className="block text-[11px] text-slate-400 mt-0.5">
                {finance.deliveryRate} DH livr. / {finance.returnRate} DH ret.
              </span>
            </div>
          </div>

          <div
            className={`p-4 rounded-2xl border shadow-2xs ${
              finance.balance > 0
                ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                : finance.balance < 0
                ? 'bg-rose-50 border-rose-200 text-rose-900'
                : 'bg-slate-50 border-slate-200 text-slate-900'
            }`}
          >
            <span className="text-[11px] font-bold uppercase block">Solde Net Actuel</span>
            <div className="mt-2">
              <span className="text-2xl font-black font-mono">
                {formatMAD(Math.abs(finance.balance))}
              </span>
              <span className="block text-[11px] font-semibold mt-0.5">
                {finance.balance > 0
                  ? 'À reverser à Fariousy'
                  : finance.balance < 0
                  ? 'Solde en votre faveur'
                  : 'Compte soldé'}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Dashboard overview sections */}
      {mode === 'dashboard' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 bg-white border border-slate-200 rounded-2xl p-5 shadow-2xs space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-black text-slate-900 flex items-center gap-2">
                <LayoutDashboard className="w-4 h-4 text-red-600" />
                <span>Derniers colis affectés</span>
              </h2>
              <button
                onClick={() => onNavigateTab('partner_packages')}
                className="text-xs font-bold text-red-600 hover:underline cursor-pointer"
              >
                Voir tout ({finance.partnerParcels.length})
              </button>
            </div>

            {finance.partnerParcels.length === 0 ? (
              <div className="py-10 text-center text-xs text-slate-400 border border-dashed border-slate-200 rounded-xl">
                Aucun colis affecté à ce partenaire pour le moment.
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {finance.partnerParcels.slice(0, 6).map(pkg => {
                  const cfg = PACKAGE_STATUS_CONFIG[pkg.status];
                  return (
                    <div
                      key={pkg.id}
                      className="py-2.5 flex items-center justify-between gap-3 text-xs"
                    >
                      <div className="min-w-0">
                        <div className="font-mono font-bold text-slate-900">{pkg.trackingNumber}</div>
                        <div className="text-slate-500 truncate">
                          {pkg.recipientName} · {pkg.city}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="font-mono font-bold text-slate-800">
                          {formatMAD(pkg.codAmount || 0)}
                        </span>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${cfg?.badgeClass || 'bg-slate-100 text-slate-700'}`}>
                          {translateStatus(pkg.status)}
                        </span>
                        <button
                          onClick={() => onViewPackage(pkg)}
                          className="p-1.5 text-slate-500 hover:text-red-600 rounded-lg hover:bg-slate-100 cursor-pointer"
                          title="Détails"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-2xs space-y-3">
            <h2 className="text-sm font-black text-slate-900 flex items-center gap-2">
              <Calculator className="w-4 h-4 text-emerald-600" />
              <span>Conditions tarifaires & Suivi</span>
            </h2>
            <div className="space-y-2 text-xs">
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-between">
                <span className="text-slate-600 font-medium">Frais de livraison</span>
                <span className="font-mono font-black text-slate-900">{finance.deliveryRate} DH / colis</span>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-between">
                <span className="text-slate-600 font-medium">Frais de retour</span>
                <span className="font-mono font-black text-slate-900">{finance.returnRate} DH / colis</span>
              </div>
              <button
                type="button"
                onClick={() => onNavigateTab('partner_relances')}
                className="w-full p-3 rounded-xl bg-amber-50/70 hover:bg-amber-50 border border-amber-200 flex items-center justify-between cursor-pointer transition"
              >
                <span className="text-amber-900 font-bold">À relancer (Suivi)</span>
                <span className="font-mono font-black text-amber-700">{finance.relanceParcels.length}</span>
              </button>
              <button
                type="button"
                onClick={() => onNavigateTab('partner_returns')}
                className="w-full p-3 rounded-xl bg-rose-50/70 hover:bg-rose-50 border border-rose-200 flex items-center justify-between cursor-pointer transition"
              >
                <span className="text-rose-900 font-bold">Retours / Annulés</span>
                <span className="font-mono font-black text-rose-700">{finance.returnedParcels.length}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Packages Table */}
      {mode === 'packages' && (
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-2xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <h2 className="text-base font-black text-slate-900 flex items-center gap-2">
              <Truck className="w-4 h-4 text-red-600" />
              <span>Colis assignés à {currentPartner.name}</span>
            </h2>

            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search className={`w-3.5 h-3.5 absolute ${isRtl ? 'right-3' : 'left-3'} top-1/2 -translate-y-1/2 text-slate-400`} />
                <input
                  type="text"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Suivi, destinataire, ville..."
                  className={`${isRtl ? 'pr-8 pl-3' : 'pl-8 pr-3'} py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500`}
                />
              </div>
              <select
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value)}
                className="px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-700"
              >
                <option value="all">Tous les statuts ({finance.partnerParcels.length})</option>
                {Object.entries(PACKAGE_STATUS_CONFIG).map(([key]) => (
                  <option key={key} value={key}>
                    {translateStatus(key)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {filteredParcels.length === 0 ? (
            <div className="py-12 text-center text-xs text-slate-400 border border-dashed border-slate-200 rounded-xl">
              Aucun colis trouvé.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-y border-slate-200 text-slate-600 uppercase text-[10px] font-bold">
                  <tr>
                    <th className="py-2.5 px-3">Code Suivi</th>
                    <th className="py-2.5 px-3">Destinataire</th>
                    <th className="py-2.5 px-3">Ville</th>
                    <th className="py-2.5 px-3">COD</th>
                    <th className="py-2.5 px-3">Statut</th>
                    <th className="py-2.5 px-3">Changer statut</th>
                    <th className="py-2.5 px-3 text-right">Détails</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredParcels.map(pkg => {
                    const cfg = PACKAGE_STATUS_CONFIG[pkg.status];
                    return (
                      <tr key={pkg.id} className="hover:bg-slate-50/80">
                        <td className="py-2.5 px-3 font-mono font-bold text-slate-900 force-ltr">
                          {pkg.trackingNumber}
                        </td>
                        <td className="py-2.5 px-3">
                          <div className="font-semibold text-slate-800">{pkg.recipientName}</div>
                          <div className="text-[11px] font-mono text-slate-400 force-ltr">{pkg.recipientPhone}</div>
                        </td>
                        <td className="py-2.5 px-3 text-slate-700">{pkg.city}</td>
                        <td className="py-2.5 px-3 font-mono font-bold text-slate-900">
                          {formatMAD(pkg.codAmount || 0)}
                        </td>
                        <td className="py-2.5 px-3">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${cfg?.badgeClass || 'bg-slate-100 text-slate-700'}`}>
                            {translateStatus(pkg.status)}
                          </span>
                        </td>
                        <td className="py-2.5 px-3">
                          <div className="flex items-center gap-1.5">
                            <select
                              value={pkg.status}
                              disabled={updatingId === pkg.id}
                              onChange={e => handleStatusChange(pkg, e.target.value as PackageStatus)}
                              className="px-2 py-1 text-[11px] bg-white border border-slate-200 rounded-lg font-semibold text-slate-700"
                            >
                              {!PARTNER_ALLOWED_STATUSES.includes(pkg.status) && (
                                <option value={pkg.status}>{translateStatus(pkg.status)}</option>
                              )}
                              {PARTNER_ALLOWED_STATUSES.map(st => (
                                <option key={st} value={st}>
                                  {translateStatus(st)}
                                </option>
                              ))}
                            </select>
                            {updatingId === pkg.id && (
                              <RefreshCw className="w-3.5 h-3.5 text-red-600 animate-spin" />
                            )}
                          </div>
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          <button
                            onClick={() => onViewPackage(pkg)}
                            className="p-1.5 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition cursor-pointer"
                            title="Voir détails"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* RELANCES VIEW (Follow-ups & Re-delivery attempts) */}
      {mode === 'relances' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="p-4 bg-white border border-amber-200 rounded-2xl">
              <span className="text-[11px] font-bold text-amber-700 uppercase block">Pas de réponse</span>
              <span className="text-2xl font-black text-slate-900 font-mono mt-1 block">
                {finance.partnerParcels.filter(p => p.status === 'pas_de_reponse').length}
              </span>
            </div>
            <div className="p-4 bg-white border border-yellow-200 rounded-2xl">
              <span className="text-[11px] font-bold text-yellow-700 uppercase block">Livraisons reportées</span>
              <span className="text-2xl font-black text-slate-900 font-mono mt-1 block">
                {finance.partnerParcels.filter(p => p.status === 'reporte').length}
              </span>
            </div>
            <div className="p-4 bg-white border border-red-200 rounded-2xl">
              <span className="text-[11px] font-bold text-red-700 uppercase block">Problèmes signalés</span>
              <span className="text-2xl font-black text-slate-900 font-mono mt-1 block">
                {finance.partnerParcels.filter(p => p.status === 'probleme_livraison').length}
              </span>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-2xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-black text-slate-900 flex items-center gap-2">
                  <RefreshCw className="w-4 h-4 text-red-600" />
                  <span>Relances & Suivi des livraisons</span>
                </h2>
                <p className="text-xs text-slate-500">
                  Contactez le destinataire, reprogrammez une tentative ou mettez à jour le statut final.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <div className="relative">
                  <Search className={`w-3.5 h-3.5 absolute ${isRtl ? 'right-3' : 'left-3'} top-1/2 -translate-y-1/2 text-slate-400`} />
                  <input
                    type="text"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="N° suivi, téléphone, ville..."
                    className={`${isRtl ? 'pr-8 pl-3' : 'pl-8 pr-3'} py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500`}
                  />
                </div>
                <select
                  value={relanceScope}
                  onChange={e => setRelanceScope(e.target.value as 'priority' | 'undelivered')}
                  className="px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-700"
                >
                  <option value="priority">À relancer en priorité ({finance.relanceParcels.length})</option>
                  <option value="undelivered">Tous les colis non livrés</option>
                </select>
              </div>
            </div>

            {relanceList.length === 0 ? (
              <div className="py-12 text-center text-xs text-slate-400 border border-dashed border-slate-200 rounded-xl">
                Aucun colis à relancer actuellement.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 border-y border-slate-200 text-slate-600 uppercase text-[10px] font-bold">
                    <tr>
                      <th className="py-2.5 px-3">Code Suivi</th>
                      <th className="py-2.5 px-3">Destinataire & Tél</th>
                      <th className="py-2.5 px-3">Ville</th>
                      <th className="py-2.5 px-3">CRBT</th>
                      <th className="py-2.5 px-3">Statut</th>
                      <th className="py-2.5 px-3 text-right">Actions de relance</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {relanceList.map(pkg => {
                      const cfg = PACKAGE_STATUS_CONFIG[pkg.status];
                      return (
                        <tr key={pkg.id} className="hover:bg-slate-50/80">
                          <td className="py-2.5 px-3 font-mono font-bold text-slate-900 force-ltr">
                            {pkg.trackingNumber}
                          </td>
                          <td className="py-2.5 px-3">
                            <div className="font-semibold text-slate-800">{pkg.recipientName}</div>
                            <div className="text-[11px] font-mono text-slate-500 force-ltr">{pkg.recipientPhone}</div>
                          </td>
                          <td className="py-2.5 px-3 text-slate-700">{pkg.city}</td>
                          <td className="py-2.5 px-3 font-mono font-bold text-slate-900">
                            {formatMAD(pkg.codAmount || 0)}
                          </td>
                          <td className="py-2.5 px-3">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${cfg?.badgeClass || 'bg-slate-100 text-slate-700'}`}>
                              {translateStatus(pkg.status)}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-right">
                            <div className="inline-flex items-center gap-1.5">
                              {pkg.recipientPhone && (
                                <a
                                  href={`tel:${pkg.recipientPhone}`}
                                  className="px-2 py-1 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 font-bold inline-flex items-center gap-1"
                                  title="Appeler le client"
                                >
                                  <PhoneCall className="w-3 h-3" />
                                  <span>Appeler</span>
                                </a>
                              )}
                              <button
                                type="button"
                                onClick={() => {
                                  setRelanceTarget(pkg);
                                  setRelanceStatus('en_cours_livraison');
                                  setRelanceNote('');
                                }}
                                className="px-2.5 py-1 rounded-lg bg-red-600 hover:bg-red-700 text-white font-bold inline-flex items-center gap-1 cursor-pointer"
                              >
                                <RefreshCw className="w-3 h-3" />
                                <span>Relancer</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => onViewPackage(pkg)}
                                className="p-1.5 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg cursor-pointer"
                                title="Détails"
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
        </div>
      )}

      {/* DEMANDES DE RETOUR VIEW */}
      {mode === 'returns' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-4 bg-white border border-purple-200 rounded-2xl">
              <span className="text-[11px] font-bold text-purple-700 uppercase block">Retour en cours</span>
              <span className="text-2xl font-black text-slate-900 font-mono mt-1 block">
                {finance.returnedParcels.filter(p => p.status === 'retour_en_cours').length}
              </span>
            </div>
            <div className="p-4 bg-white border border-rose-200 rounded-2xl">
              <span className="text-[11px] font-bold text-rose-700 uppercase block">Retournés</span>
              <span className="text-2xl font-black text-slate-900 font-mono mt-1 block">
                {finance.returnedParcels.filter(p => p.status === 'retourne').length}
              </span>
            </div>
            <div className="p-4 bg-white border border-slate-200 rounded-2xl">
              <span className="text-[11px] font-bold text-slate-500 uppercase block">Refusés / Annulés</span>
              <span className="text-2xl font-black text-slate-900 font-mono mt-1 block">
                {finance.returnedParcels.filter(p => p.status === 'refuse' || p.status === 'annule').length}
              </span>
            </div>
            <div className="p-4 bg-white border border-slate-200 rounded-2xl">
              <span className="text-[11px] font-bold text-slate-500 uppercase block">Frais de retour</span>
              <span className="text-2xl font-black text-rose-600 font-mono mt-1 block">
                {formatMAD(finance.returnFees)}
              </span>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-2xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-black text-slate-900 flex items-center gap-2">
                  <CornerDownLeft className="w-4 h-4 text-red-600" />
                  <span>Demandes de retour</span>
                </h2>
                <p className="text-xs text-slate-500">
                  Suivez les colis refusés ou annulés et déclarez les retours vers le hub FARIOUSY.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <div className="relative">
                  <Search className={`w-3.5 h-3.5 absolute ${isRtl ? 'right-3' : 'left-3'} top-1/2 -translate-y-1/2 text-slate-400`} />
                  <input
                    type="text"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="Suivi, destinataire..."
                    className={`${isRtl ? 'pr-8 pl-3' : 'pl-8 pr-3'} py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500`}
                  />
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setReturnParcelId(eligibleForReturnParcels[0]?.id || '');
                    setIsReturnModalOpen(true);
                  }}
                  disabled={eligibleForReturnParcels.length === 0}
                  className="px-3.5 py-2 rounded-xl text-xs font-bold bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Demander un retour</span>
                </button>
              </div>
            </div>

            {filteredReturnParcels.length === 0 ? (
              <div className="py-12 text-center text-xs text-slate-400 border border-dashed border-slate-200 rounded-xl">
                Aucune demande de retour ou colis retourné pour le moment.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 border-y border-slate-200 text-slate-600 uppercase text-[10px] font-bold">
                    <tr>
                      <th className="py-2.5 px-3">Code Suivi</th>
                      <th className="py-2.5 px-3">Destinataire</th>
                      <th className="py-2.5 px-3">Ville</th>
                      <th className="py-2.5 px-3">Motif / Historique</th>
                      <th className="py-2.5 px-3">Statut</th>
                      <th className="py-2.5 px-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredReturnParcels.map(pkg => {
                      const cfg = PACKAGE_STATUS_CONFIG[pkg.status];
                      const lastNote = pkg.returnReason || pkg.history?.[0]?.comment || '—';
                      return (
                        <tr key={pkg.id} className="hover:bg-slate-50/80">
                          <td className="py-2.5 px-3 font-mono font-bold text-slate-900 force-ltr">
                            {pkg.trackingNumber}
                          </td>
                          <td className="py-2.5 px-3">
                            <div className="font-semibold text-slate-800">{pkg.recipientName}</div>
                            <div className="text-[11px] font-mono text-slate-400 force-ltr">{pkg.recipientPhone}</div>
                          </td>
                          <td className="py-2.5 px-3 text-slate-700">{pkg.city}</td>
                          <td className="py-2.5 px-3 text-slate-600 max-w-[220px] truncate">{lastNote}</td>
                          <td className="py-2.5 px-3">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${cfg?.badgeClass || 'bg-slate-100 text-slate-700'}`}>
                              {translateStatus(pkg.status)}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-right">
                            <div className="inline-flex items-center gap-1.5">
                              {pkg.status !== 'retourne' && (
                                <button
                                  type="button"
                                  disabled={updatingId === pkg.id}
                                  onClick={() =>
                                    handleStatusChange(pkg, 'retourne', `Retour confirmé au hub par ${currentPartner.name}`)
                                  }
                                  className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold inline-flex items-center gap-1 cursor-pointer"
                                >
                                  <CheckCircle2 className="w-3 h-3" />
                                  <span>Confirmer retour</span>
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => onViewPackage(pkg)}
                                className="p-1.5 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg cursor-pointer"
                                title="Détails"
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
        </div>
      )}

      {/* Payments & Settlements */}
      {mode === 'payments' && (
        <div className="space-y-5">
          {/* Page Title */}
          <h2 className="text-2xl font-bold text-slate-800">
            {t('partnerPayments.title')}
          </h2>

          {/* Info Banner */}
          <div className="bg-amber-50 border border-amber-200/80 rounded-xl px-4 py-3 text-xs sm:text-sm text-amber-800">
            {t('partnerPayments.infoBanner')}
          </div>

          {/* Main Balance Card */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-2xs space-y-6">
            <div className="space-y-1">
              <h3 className="text-lg font-bold text-slate-700">
                {t('partnerPayments.balanceCardTitle')}
              </h3>
              <p className="text-xs sm:text-sm text-slate-500">
                {t('partnerPayments.deliveredPendingLabel')}{' '}
                <span className="font-mono font-bold text-slate-700">
                  {finance.deliveredParcels.length}
                </span>
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x md:rtl:divide-x-reverse divide-slate-200">
              {/* Side 1: You owe admin */}
              <div className="py-4 md:py-2 md:px-6 flex flex-col items-center justify-center text-center">
                <div className="text-3xl sm:text-4xl font-bold text-red-600 tabular-nums force-ltr">
                  {formatDh(Math.max(0, finance.balance))}
                </div>
                <p className="text-xs sm:text-sm font-medium text-red-500 mt-2">
                  {t('partnerPayments.youOweLabel')}
                </p>
              </div>

              {/* Side 2: Admin owes you */}
              <div className="py-4 md:py-2 md:px-6 flex flex-col items-center justify-center text-center">
                <div className="text-3xl sm:text-4xl font-bold text-red-600 tabular-nums force-ltr">
                  {formatDh(finance.totalPartnerFees)}
                </div>
                <p className="text-xs sm:text-sm font-medium text-emerald-500 mt-2">
                  {t('partnerPayments.adminOwesLabel')}
                </p>
              </div>
            </div>
          </div>

          {/* Full-width Total Earnings Card */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-2xs space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm sm:text-base font-medium text-slate-500">
                {t('partnerPayments.totalEarningsTitle')}
              </span>
              <Banknote className="w-5 h-5 text-slate-400" />
            </div>
            <div className="text-2xl sm:text-3xl font-bold text-emerald-500 tabular-nums force-ltr">
              {formatDh(finance.totalSettlementsReceived)}
            </div>
            <p className="text-xs text-slate-400">
              {t('partnerPayments.totalEarningsSubtitle')}
            </p>
          </div>

          {/* Net Balance & Delivered Parcels 2-Column Summary */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-2xs space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm sm:text-base font-medium text-slate-500">
                  {t('partnerPayments.netBalanceTitle')}
                </span>
                <Wallet className="w-5 h-5 text-slate-400" />
              </div>
              <div className="text-2xl sm:text-3xl font-bold text-red-600 tabular-nums force-ltr">
                {formatDh(finance.totalDeliveredCod)}
              </div>
              <p className="text-xs text-slate-400">
                {t('partnerPayments.netBalanceSubtitle')}
              </p>
            </div>

            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-2xs space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm sm:text-base font-medium text-slate-500">
                  {t('partnerPayments.deliveredParcelsTitle')}
                </span>
                <Package className="w-5 h-5 text-slate-400" />
              </div>
              <div className="text-2xl sm:text-3xl font-bold text-slate-500 tabular-nums">
                {finance.deliveredParcels.length}
              </div>
              <p className="text-xs text-slate-400">
                {t('partnerPayments.deliveredParcelsSubtitle')}
              </p>
            </div>
          </div>

          {/* Payment History Table */}
          <div className="space-y-3 pt-2">
            <h3 className="text-lg font-bold text-slate-700">
              {t('partnerPayments.historyTitle')}
            </h3>

            <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-2xs">
              {finance.settlements.length === 0 ? (
                <div className="py-12 text-center text-xs sm:text-sm text-slate-400">
                  {t('partnerPayments.emptyHistory')}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs sm:text-sm">
                    <thead className="bg-white border-b border-slate-200 text-slate-800 font-bold">
                      <tr>
                        <th className="py-3.5 px-4 text-start">{t('partnerPayments.colType')}</th>
                        <th className="py-3.5 px-4 text-start">{t('partnerPayments.colDate')}</th>
                        <th className="py-3.5 px-4 text-center">{t('partnerPayments.colParcels')}</th>
                        <th className="py-3.5 px-4 text-center">{t('partnerPayments.colAmount')}</th>
                        <th className="py-3.5 px-4 text-end">{t('partnerPayments.colActions')}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {finance.settlements.map(s => {
                        const dt = formatDateTimeParts(s.date);
                        const isSettlementType = s.type === 'versement';
                        return (
                          <tr
                            key={s.id}
                            className="odd:bg-slate-100/80 even:bg-white hover:bg-slate-100 transition-colors"
                          >
                            <td className="py-3 px-4">
                              <span
                                className={`inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-semibold ${
                                  isSettlementType
                                    ? 'bg-blue-100 text-blue-700'
                                    : 'bg-emerald-100 text-emerald-600'
                                }`}
                              >
                                {isSettlementType
                                  ? t('partnerPayments.typeSettlement')
                                  : t('partnerPayments.typeEarnings')}
                              </span>
                            </td>
                            <td className="py-3 px-4">
                              <div className="font-mono font-semibold text-slate-900 force-ltr w-fit">
                                {dt.date}
                              </div>
                              {dt.time && (
                                <div className="font-mono text-[11px] text-slate-400 force-ltr w-fit">
                                  {dt.time}
                                </div>
                              )}
                            </td>
                            <td className="py-3 px-4 text-center font-mono font-semibold text-slate-700">
                              {s.packageCount ?? 1}
                            </td>
                            <td className="py-3 px-4 text-center font-mono font-bold text-slate-900 force-ltr">
                              {formatDh(s.amount)}
                            </td>
                            <td className="py-3 px-4 text-end">
                              <button
                                type="button"
                                onClick={() => setSelectedSettlementReceipt(s)}
                                title={t('partnerPayments.viewDetails')}
                                className="inline-flex items-center justify-center w-8 h-7 rounded-md border border-slate-300 bg-white hover:bg-slate-50 text-slate-500 hover:text-slate-900 transition cursor-pointer"
                              >
                                <Eye className="w-4 h-4" />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* HISTORIQUE DES REÇUS VIEW */}
      {mode === 'receipts' && (
        <div className="space-y-4">
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-2xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h2 className="text-base font-black text-slate-900 flex items-center gap-2">
                  <Clock className="w-4 h-4 text-red-600" />
                  <span>Historique des reçus</span>
                </h2>
                <p className="text-xs text-slate-500">
                  Justificatifs de règlements, bordereaux et preuves de virement archivés
                </p>
              </div>
              <span className="text-xs font-mono font-bold text-slate-700 bg-slate-100 px-3 py-1.5 rounded-xl">
                {finance.settlements.length + partnerTransferReceipts.length} reçu(s)
              </span>
            </div>

            {finance.settlements.length === 0 && partnerTransferReceipts.length === 0 ? (
              <div className="py-12 text-center text-xs text-slate-400 border border-dashed border-slate-200 rounded-xl">
                Aucun reçu ou justificatif de virement archivé pour le moment.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 border-y border-slate-200 text-slate-600 uppercase text-[10px] font-bold">
                    <tr>
                      <th className="py-2.5 px-3">Date</th>
                      <th className="py-2.5 px-3">Référence Reçu</th>
                      <th className="py-2.5 px-3">Type / Méthode</th>
                      <th className="py-2.5 px-3">Montant</th>
                      <th className="py-2.5 px-3">Remarque</th>
                      <th className="py-2.5 px-3 text-right">Document</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {finance.settlements.map(s => (
                      <tr key={`stl-${s.id}`} className="hover:bg-slate-50/80">
                        <td className="py-2.5 px-3 font-mono text-slate-600">{formatDate(s.date)}</td>
                        <td className="py-2.5 px-3 font-mono font-bold text-slate-900">{s.reference}</td>
                        <td className="py-2.5 px-3 capitalize text-slate-700">Règlement · {s.paymentMethod}</td>
                        <td className="py-2.5 px-3 font-mono font-black text-emerald-700">{formatMAD(s.amount)}</td>
                        <td className="py-2.5 px-3 text-slate-500">{s.notes || '—'}</td>
                        <td className="py-2.5 px-3 text-right">
                          <button
                            type="button"
                            onClick={() => setSelectedSettlementReceipt(s)}
                            className="px-2.5 py-1 rounded-lg bg-red-50 text-red-700 hover:bg-red-100 border border-red-200 font-bold inline-flex items-center gap-1 cursor-pointer"
                          >
                            <Printer className="w-3 h-3" />
                            <span>Reçu</span>
                          </button>
                        </td>
                      </tr>
                    ))}

                    {partnerTransferReceipts.map(r => (
                      <tr key={`tr-${r.id}`} className="hover:bg-slate-50/80">
                        <td className="py-2.5 px-3 font-mono text-slate-600">{formatDate(r.transferDate || r.createdAt)}</td>
                        <td className="py-2.5 px-3 font-mono font-bold text-slate-900">{r.reference || r.id}</td>
                        <td className="py-2.5 px-3 text-slate-700">Preuve virement · {r.bankName || 'Banque'}</td>
                        <td className="py-2.5 px-3 font-mono font-black text-emerald-700">{formatMAD(r.amount)}</td>
                        <td className="py-2.5 px-3 text-slate-500">{r.notes || '—'}</td>
                        <td className="py-2.5 px-3 text-right">
                          <button
                            type="button"
                            onClick={() => setSelectedImageReceiptUrl(r.imageUrl)}
                            className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-bold inline-flex items-center gap-1 cursor-pointer"
                          >
                            <FileImage className="w-3 h-3" />
                            <span>Image</span>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Relance Modal */}
      {relanceTarget && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-sm font-black text-slate-900">Relancer le colis</h3>
                <p className="text-xs font-mono text-red-600 font-bold">{relanceTarget.trackingNumber}</p>
              </div>
              <button
                type="button"
                onClick={() => setRelanceTarget(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleConfirmRelance} className="space-y-3 text-xs">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                <div className="font-bold text-slate-900">{relanceTarget.recipientName}</div>
                <div className="text-slate-500 font-mono force-ltr">{relanceTarget.recipientPhone} · {relanceTarget.city}</div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Nouveau statut après relance</label>
                <select
                  value={relanceStatus}
                  onChange={e => setRelanceStatus(e.target.value as PackageStatus)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-white font-semibold"
                >
                  {PARTNER_ALLOWED_STATUSES.map(st => (
                    <option key={st} value={st}>
                      {translateStatus(st)}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Compte-rendu de relance / RDV</label>
                <textarea
                  rows={3}
                  value={relanceNote}
                  onChange={e => setRelanceNote(e.target.value)}
                  placeholder="Ex: Client joignable, livraison confirmée pour demain matin..."
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setRelanceTarget(null)}
                  className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 font-bold text-slate-700 cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={updatingId === relanceTarget.id}
                  className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold cursor-pointer"
                >
                  Enregistrer la relance
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Demande de Retour Modal */}
      {isReturnModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-sm font-black text-slate-900">Nouvelle demande de retour</h3>
              <button
                type="button"
                onClick={() => setIsReturnModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmitReturnRequest} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Sélectionner le colis</label>
                <select
                  value={returnParcelId}
                  onChange={e => setReturnParcelId(e.target.value)}
                  required
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-white font-semibold"
                >
                  {eligibleForReturnParcels.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.trackingNumber} — {p.recipientName} ({p.city})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Motif du retour</label>
                <select
                  value={returnReason}
                  onChange={e => setReturnReason(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-white font-semibold"
                >
                  <option value="Client injoignable après 3 tentatives">Client injoignable après 3 tentatives</option>
                  <option value="Client a refusé le colis">Client a refusé le colis</option>
                  <option value="Adresse erronée / incomplète">Adresse erronée / incomplète</option>
                  <option value="Demande d'annulation client">Demande d'annulation client</option>
                  <option value="Autre">Autre motif</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Commentaire complémentaire</label>
                <textarea
                  rows={2}
                  value={returnCustomNote}
                  onChange={e => setReturnCustomNote(e.target.value)}
                  placeholder="Précisions pour le hub..."
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsReturnModalOpen(false)}
                  className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 font-bold text-slate-700 cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold cursor-pointer"
                >
                  Confirmer la demande
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Printable Settlement Receipt Modal */}
      {selectedSettlementReceipt && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div>
                <div className="text-[10px] font-bold uppercase tracking-wider text-red-600">FARIOUSY DELIVERY</div>
                <h3 className="text-base font-black text-slate-900">Reçu de Règlement Partenaire</h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedSettlementReceipt(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2.5 text-xs">
              <div className="flex justify-between py-1.5 border-b border-slate-100">
                <span className="text-slate-500">Partenaire</span>
                <span className="font-bold text-slate-900">{currentPartner.name}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-100">
                <span className="text-slate-500">Référence</span>
                <span className="font-mono font-bold text-slate-900">{selectedSettlementReceipt.reference || selectedSettlementReceipt.id}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-100">
                <span className="text-slate-500">Date</span>
                <span className="font-mono text-slate-800">{formatDate(selectedSettlementReceipt.date)}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-100">
                <span className="text-slate-500">{t('partnerPayments.colParcels')}</span>
                <span className="font-mono font-bold text-slate-800">{selectedSettlementReceipt.packageCount ?? 1}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-100">
                <span className="text-slate-500">Mode de paiement</span>
                <span className="capitalize font-semibold text-slate-800">{selectedSettlementReceipt.paymentMethod}</span>
              </div>
              <div className="flex justify-between py-2 bg-emerald-50 px-3 rounded-xl border border-emerald-200">
                <span className="font-bold text-emerald-900">Montant réglé</span>
                <span className="font-mono font-black text-emerald-700 text-sm force-ltr">
                  {formatMAD(selectedSettlementReceipt.amount)}
                </span>
              </div>
              {selectedSettlementReceipt.notes && (
                <div className="p-3 bg-slate-50 rounded-xl text-slate-600">
                  {selectedSettlementReceipt.notes}
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => window.print()}
                className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Imprimer</span>
              </button>
              <button
                type="button"
                onClick={() => setSelectedSettlementReceipt(null)}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold cursor-pointer"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Receipt Image Preview Modal */}
      {selectedImageReceiptUrl && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-4 shadow-2xl space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-black text-slate-900">Justificatif de virement</h3>
              <button
                type="button"
                onClick={() => setSelectedImageReceiptUrl(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <img
              src={selectedImageReceiptUrl}
              alt="Justificatif de virement"
              className="w-full max-h-[70vh] object-contain rounded-xl border border-slate-200 bg-slate-50"
            />
          </div>
        </div>
      )}
    </div>
  );
};
