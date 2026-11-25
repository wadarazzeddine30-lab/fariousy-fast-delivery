import React, { useState, useEffect, useRef } from 'react';
import { useDatabase } from '../../context/DatabaseContext';
import { useLanguage } from '../../i18n/LanguageContext';
import { PackageItem, Partner } from '../../types';
import { formatMAD, formatDate, formatDateTime } from '../../utils/barcode';
import { getPartnerCityFee, isCityCoveredByPartner } from '../../utils/partnerTariffs';
import QRCode from 'qrcode';
import {
  Search,
  Truck,
  Send,
  X,
  Plus,
  Check,
  CheckCircle2,
  Copy,
  Printer,
  FileSpreadsheet,
  Scan,
  Share2,
  AlertCircle,
  Building,
  Phone,
  Mail,
  MapPin,
  Barcode,
  ArrowRightLeft,
  ChevronRight,
  ChevronDown,
  Loader2,
  ListFilter,
  Calculator,
  Wallet,
  Receipt,
  DollarSign
} from 'lucide-react';

interface AdminPartnerDispatchProps {
  onOpenScanner?: () => void;
  onViewPackage?: (pkg: PackageItem) => void;
  onBackToList?: () => void;
  preselectedPackageIds?: string[];
}

export const AdminPartnerDispatch: React.FC<AdminPartnerDispatchProps> = ({
  onOpenScanner,
  onViewPackage,
  onBackToList,
  preselectedPackageIds = []
}) => {
  const {
    partners,
    refreshPartners,
    packages,
    companySettings,
    transferPackageToPartner,
    dispatchPackagesToPartner,
    addAuditLog,
    triggerNewOrderNotification
  } = useDatabase();
  const { t, isRtl } = useLanguage();

  // Partner selection state
  const [partnerQuery, setPartnerQuery] = useState('');
  const [selectedPartner, setSelectedPartner] = useState<Partner | null>(null);
  const [isPartnerDropdownOpen, setIsPartnerDropdownOpen] = useState(false);
  const partnerDropdownRef = useRef<HTMLDivElement | null>(null);
  const partnerInputRef = useRef<HTMLInputElement | null>(null);
  const hasAutoSelectedRef = useRef(false);

  // Package search state
  const [packageSearchQuery, setPackageSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<PackageItem[]>([]);
  const [hasSearched, setHasSearched] = useState(false);

  // Ready to send queue
  const [queuePackages, setQueuePackages] = useState<PackageItem[]>([]);
  const [copiedTracking, setCopiedTracking] = useState<string | null>(null);

  // Action states
  const [isSending, setIsSending] = useState(false);
  const [dispatchedSuccess, setDispatchedSuccess] = useState<{
    partner: Partner;
    count: number;
    totalCod: number;
    partnerFee: number;
    totalPartnerFee: number;
    netToRecover: number;
    packageIds: string[];
    manifestNumber: string;
    timestamp: string;
  } | null>(null);

  // Manifest Print state
  const [showManifestModal, setShowManifestModal] = useState(false);
  const [manifestQr, setManifestQr] = useState<string>('');
  const [isPrintingManifest, setIsPrintingManifest] = useState(false);

  // Initialize preselected packages if passed
  useEffect(() => {
    if (preselectedPackageIds && preselectedPackageIds.length > 0) {
      const matched = packages.filter(p => preselectedPackageIds.includes(p.id));
      if (matched.length > 0) {
        setQueuePackages(prev => {
          const existingIds = new Set(prev.map(p => p.id));
          const newOnes = matched.filter(p => !existingIds.has(p.id));
          return [...prev, ...newOnes];
        });
      }
    }
  }, [preselectedPackageIds, packages]);

  // Refresh partners from server when opening dispatch screen
  useEffect(() => {
    refreshPartners();
  }, [refreshPartners]);

  // Close partner dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (partnerDropdownRef.current && !partnerDropdownRef.current.contains(event.target as Node)) {
        setIsPartnerDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Default once to first active partner (or Oliv if available) on initial load
  useEffect(() => {
    if (!hasAutoSelectedRef.current && !selectedPartner && partners.length > 0) {
      const oliv = partners.find(p => (p.name || '').toLowerCase().includes('oliv'));
      if (oliv) {
        setSelectedPartner(oliv);
        hasAutoSelectedRef.current = true;
      }
    }
  }, [partners, selectedPartner]);

  // Filter partners for dropdown
  const activePartners = partners.filter(p => p.active !== false);
  const basePartnersList = activePartners.length > 0 ? activePartners : partners;
  const filteredPartners = partners.filter(p => {
    const q = partnerQuery.trim().toLowerCase();
    if (!q) {
      return activePartners.length > 0 ? p.active !== false : true;
    }
    return (
      (p.name || '').toLowerCase().includes(q) ||
      (p.city || '').toLowerCase().includes(q) ||
      (p.phone || '').toLowerCase().includes(q) ||
      (p.email || '').toLowerCase().includes(q) ||
      (p.contactPerson || '').toLowerCase().includes(q) ||
      (p.id || '').toLowerCase().includes(q)
    );
  });

  // Handle Search for packages
  const handleSearchPackages = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const query = packageSearchQuery.trim().toLowerCase();
    if (!query) {
      setSearchResults([]);
      setHasSearched(false);
      return;
    }

    setHasSearched(true);
    const matched = packages.filter(pkg => {
      const trk = (pkg.trackingNumber || '').toLowerCase();
      const id = (pkg.id || '').toLowerCase();
      const recip = (pkg.recipientName || '').toLowerCase();
      const phone = (pkg.recipientPhone || '').toLowerCase();
      const city = (pkg.city || '').toLowerCase();
      const client = (pkg.clientCompany || pkg.clientName || '').toLowerCase();

      return (
        trk === query ||
        trk.includes(query) ||
        id === query ||
        recip.includes(query) ||
        phone.includes(query) ||
        city.includes(query) ||
        client.includes(query)
      );
    });

    setSearchResults(matched);

    // If exact match by tracking code and only 1 found, automatically add it or highlight
    if (matched.length === 1 && matched[0].trackingNumber.toLowerCase() === query) {
      handleAddToQueue(matched[0]);
    }
  };

  const handleAddToQueue = (pkg: PackageItem) => {
    setQueuePackages(prev => {
      if (prev.some(p => p.id === pkg.id)) return prev;
      return [pkg, ...prev];
    });
  };

  const handleRemoveFromQueue = (packageId: string) => {
    setQueuePackages(prev => prev.filter(p => p.id !== packageId));
  };

  const handleAddAllSearchResults = () => {
    setQueuePackages(prev => {
      const existingIds = new Set(prev.map(p => p.id));
      const toAdd = searchResults.filter(p => !existingIds.has(p.id));
      return [...toAdd, ...prev];
    });
  };

  const handleCopyCode = (tracking: string) => {
    navigator.clipboard.writeText(tracking);
    setCopiedTracking(tracking);
    setTimeout(() => setCopiedTracking(null), 2000);
  };

  // Dispatch all packages in the queue to selected partner
  const handleDispatch = async () => {
    if (!selectedPartner || queuePackages.length === 0) return;

    setIsSending(true);
    const manifestRef = `TRF-PART-${Date.now().toString().slice(-6)}`;
    const nowIso = new Date().toISOString();
    const dispatchedIds: string[] = [];
    let totalCod = 0;
    let totalPartnerFee = 0;
    const defaultPartnerFee = selectedPartner.deliveryFee ?? 30;

    try {
      for (const pkg of queuePackages) {
        const pkgPartnerFee = getPartnerCityFee(selectedPartner, pkg.city);
        totalCod += pkg.codAmount || 0;
        totalPartnerFee += pkgPartnerFee;
        dispatchedIds.push(pkg.id);
        await transferPackageToPartner(
          pkg.id,
          selectedPartner.name,
          manifestRef,
          selectedPartner.id,
          pkgPartnerFee
        );
      }

      if (selectedPartner.apiConfig?.enabled && selectedPartner.apiConfig?.autoDispatch) {
        await dispatchPackagesToPartner(selectedPartner.id, dispatchedIds);
      }

      const netToRecover = totalCod - totalPartnerFee;
      const avgPartnerFee = queuePackages.length > 0 ? Math.round((totalPartnerFee / queuePackages.length) * 100) / 100 : defaultPartnerFee;

      addAuditLog({
        action: 'Expédition partenaire',
        entity: 'colis',
        entityId: manifestRef,
        details: `Lot de ${queuePackages.length} colis confié au transporteur ${selectedPartner.name} (Réf : ${manifestRef}) - Total frais partenaire : ${totalPartnerFee} DH`
      });

      // Generate Manifest QR
      try {
        const qrUrl = await QRCode.toDataURL(manifestRef, {
          margin: 1,
          width: 180,
          color: { dark: '#000000', light: '#ffffff' }
        });
        setManifestQr(qrUrl);
      } catch (err) {
        console.warn('QR gen notice:', err);
      }

      setDispatchedSuccess({
        partner: selectedPartner,
        count: queuePackages.length,
        totalCod,
        partnerFee: avgPartnerFee,
        totalPartnerFee,
        netToRecover,
        packageIds: dispatchedIds,
        manifestNumber: manifestRef,
        timestamp: formatDateTime(nowIso)
      });

      // Clear queue
      setQueuePackages([]);
      setSearchResults([]);
      setPackageSearchQuery('');
      setHasSearched(false);
    } catch (err) {
      console.error('Dispatch error:', err);
    } finally {
      setIsSending(false);
    }
  };

  // Helper to print manifest using dedicated iframe
  const handlePrintManifest = () => {
    setIsPrintingManifest(true);
    try {
      const el = document.getElementById('partner-dispatch-manifest-sheet');
      if (!el) {
        window.print();
        setIsPrintingManifest(false);
        return;
      }

      const existing = document.getElementById('manifest-print-iframe');
      if (existing) existing.remove();

      const iframe = document.createElement('iframe');
      iframe.id = 'manifest-print-iframe';
      iframe.style.position = 'fixed';
      iframe.style.right = '0';
      iframe.style.bottom = '0';
      iframe.style.width = '10px';
      iframe.style.height = '10px';
      iframe.style.opacity = '0';
      iframe.style.border = '0';
      iframe.style.pointerEvents = 'none';
      document.body.appendChild(iframe);

      const frameDoc = iframe.contentWindow?.document || iframe.contentDocument;
      if (!frameDoc) {
        window.print();
        setIsPrintingManifest(false);
        return;
      }

      frameDoc.open();
      frameDoc.write(`
        <!DOCTYPE html>
        <html dir="ltr" lang="fr">
          <head>
            <meta charset="utf-8">
            <title>${dispatchedSuccess?.manifestNumber || 'Bordereau Partenaire'}</title>
            <style>
              * { box-sizing: border-box; margin: 0; padding: 0; }
              body {
                background: #ffffff;
                color: #000000;
                font-family: 'Plus Jakarta Sans', 'Cairo', Arial, sans-serif;
                padding: 15px;
                display: flex;
                justify-content: center;
                -webkit-print-color-adjust: exact;
                print-color-adjust: exact;
              }
              @page {
                size: A4 portrait;
                margin: 8mm;
              }
            </style>
            <link rel="stylesheet" href="/index.css">
          </head>
          <body>
            ${el.outerHTML}
          </body>
        </html>
      `);
      frameDoc.close();

      setTimeout(() => {
        try {
          iframe.contentWindow?.focus();
          iframe.contentWindow?.print();
        } catch (e) {
          console.warn('Iframe print fallback:', e);
          window.print();
        } finally {
          setIsPrintingManifest(false);
        }
      }, 350);
    } catch {
      window.print();
      setIsPrintingManifest(false);
    }
  };

  const handleShareWhatsApp = () => {
    if (!dispatchedSuccess) return;
    const msg =
      `📦 *FARIOUSY DELIVERY — BORDEREAU DE TRANSFERT*\n` +
      `🏢 Partenaire : *${dispatchedSuccess.partner.name}* (ID : ${dispatchedSuccess.partner.id.replace('part-', '')})\n` +
      `🔢 Réf Transfert : *${dispatchedSuccess.manifestNumber}*\n` +
      `📅 Date : ${dispatchedSuccess.timestamp}\n` +
      `📦 Nombre de Colis : *${dispatchedSuccess.count} colis*\n` +
      `💰 Total CRBT à Recouvrer : *${formatMAD(dispatchedSuccess.totalCod)}*\n` +
      `🚚 Frais Partenaire Déduits (${dispatchedSuccess.count} × ${dispatchedSuccess.partnerFee} DH) : *-${formatMAD(dispatchedSuccess.totalPartnerFee)}*\n` +
      `🟢 Net à Reverser à Fariousy (كنسالوك) : *${formatMAD(dispatchedSuccess.netToRecover)}*\n\n` +
      `Les colis ont été passés au statut *En transit* sous votre responsabilité.\n` +
      `Lien de suivi partenaire : https://fariousy.com/track`;

    const phone = dispatchedSuccess.partner.phone.replace(/[^0-9]/g, '');
    const cleanPhone = phone.startsWith('0') ? '212' + phone.substring(1) : phone;
    const url = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(msg)}`;
    window.open(url, '_blank');
  };

  const totalQueueCod = queuePackages.reduce((acc, p) => acc + (p.codAmount || 0), 0);
  const partnerRate = selectedPartner?.deliveryFee ?? 30;
  const returnRate = selectedPartner?.returnFee ?? 10;
  const totalQueuePartnerFee = queuePackages.reduce(
    (acc, p) => acc + getPartnerCityFee(selectedPartner, p.city),
    0
  );
  const totalQueueClientFee = queuePackages.reduce((acc, p) => acc + Number(p.deliveryFee || 0), 0);
  const netQueueProfit = queuePackages.reduce(
    (acc, p) => acc + Math.max(0, Number(p.deliveryFee || 0) - getPartnerCityFee(selectedPartner, p.city)),
    0
  );
  const netQueueToRecover = totalQueueCod - totalQueuePartnerFee;
  const coveredCitiesCount = selectedPartner?.cityTariffs ? Object.keys(selectedPartner.cityTariffs).length : 0;

  return (
    <div className="space-y-6">
      {/* ================= HEADER SECTION ================= */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
              Rechercher des colis
            </h2>
            <span className="text-xs px-2.5 py-0.5 rounded-full font-bold bg-red-100 text-red-700 font-mono">
              ربط الطرود بالشريك
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Recherchez des colis pour les marquer <strong>En transit</strong>, puis envoyez-les au partenaire.
          </p>
        </div>

        {onBackToList && (
          <button
            type="button"
            onClick={onBackToList}
            className="self-start sm:self-auto flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-xl transition cursor-pointer"
          >
            <span>Liste des partenaires</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* ================= STEP 1: SÉLECTIONNER UN PARTENAIRE ================= */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-2xs space-y-4">
        <div className="flex items-center justify-between">
          <label className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-700">
            <Truck className="w-4 h-4 text-red-600" />
            <span>Sélectionner un partenaire</span>
          </label>
          {selectedPartner && (
            <span className="text-[11px] text-emerald-600 font-bold flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Partenaire actif</span>
            </span>
          )}
        </div>

        {/* Selected Partner Card (As shown in video) */}
        {selectedPartner ? (
          <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-white border border-slate-200 flex items-center justify-center overflow-hidden p-1 shadow-2xs shrink-0">
                <img
                  src="/fariousy-logo.jpeg"
                  alt={selectedPartner.name}
                  className="w-full h-full object-contain"
                />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-extrabold text-sm sm:text-base text-slate-900">
                    {selectedPartner.name}
                  </span>
                  <span className="font-mono text-xs px-2 py-0.5 rounded-md bg-slate-200 text-slate-700 font-bold">
                    ID : {selectedPartner.id.replace('part-', '') || '13'}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-0.5 text-xs text-slate-500">
                  <span className="flex items-center gap-1">
                    <Mail className="w-3 h-3 text-slate-400" />
                    <span>{selectedPartner.email}</span>
                  </span>
                  <span className="flex items-center gap-1">
                    <MapPin className="w-3 h-3 text-red-500" />
                    <span>{selectedPartner.city}</span>
                  </span>
                  <span className="flex items-center gap-1 font-mono">
                    <Phone className="w-3 h-3 text-slate-400" />
                    <span>{selectedPartner.phone}</span>
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-2 mt-1.5 pt-1.5 border-t border-slate-200/60">
                  <span className="text-[11px] font-bold text-slate-700">سعر التوصيل المتفق عليه:</span>
                  <span className="text-xs font-black font-mono text-red-600 bg-red-50 px-2 py-0.5 rounded border border-red-200">
                    {partnerRate} DH / طرد
                  </span>
                  <span className="text-[10px] text-slate-500 font-mono">
                    (الروتور: {returnRate} DH)
                  </span>
                  {coveredCitiesCount > 0 && (
                    <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                      {coveredCitiesCount} مدينة مخصصة
                    </span>
                  )}
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                hasAutoSelectedRef.current = true;
                setSelectedPartner(null);
                setPartnerQuery('');
                setIsPartnerDropdownOpen(true);
                setTimeout(() => partnerInputRef.current?.focus(), 0);
              }}
              className="p-2 text-amber-600 hover:text-amber-700 hover:bg-amber-50 rounded-xl border border-amber-200 transition cursor-pointer shrink-0"
              title="Changer de partenaire"
            >
              <ArrowRightLeft className="w-4 h-4" />
            </button>
          </div>
        ) : (
          /* Partner Autocomplete Input & Selectable List */
          <div ref={partnerDropdownRef} className="space-y-2.5">
            <div className="relative">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                <input
                  ref={partnerInputRef}
                  type="text"
                  value={partnerQuery}
                  onFocus={() => setIsPartnerDropdownOpen(true)}
                  onChange={e => {
                    setPartnerQuery(e.target.value);
                    setIsPartnerDropdownOpen(true);
                  }}
                  placeholder="Nom, e-mail, téléphone ou ville du partenaire..."
                  className="w-full pl-10 pr-10 py-3 text-sm bg-slate-50 border border-slate-300 rounded-xl text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-500 transition"
                />
                <button
                  type="button"
                  onClick={() => setIsPartnerDropdownOpen(prev => !prev)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-700 rounded-lg cursor-pointer"
                  aria-label="Afficher la liste des partenaires"
                >
                  <ChevronDown className={`w-4 h-4 transition-transform ${isPartnerDropdownOpen ? 'rotate-180' : ''}`} />
                </button>
              </div>

              {/* Dropdown Options */}
              {isPartnerDropdownOpen && (
                <div className="absolute left-0 right-0 top-full mt-1.5 bg-white border border-slate-200 rounded-2xl shadow-xl z-30 max-h-64 overflow-y-auto divide-y divide-slate-100">
                  {filteredPartners.length === 0 ? (
                    <div className="p-4 text-center text-xs text-slate-500">
                      Aucun partenaire trouvé. Vérifiez le nom, la ville ou le téléphone.
                    </div>
                  ) : (
                    filteredPartners.map(p => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => {
                          setSelectedPartner(p);
                          setIsPartnerDropdownOpen(false);
                        }}
                        className="w-full p-3 text-left hover:bg-slate-50 flex items-center justify-between gap-3 transition cursor-pointer"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-lg bg-red-50 text-red-600 flex items-center justify-center font-bold shrink-0">
                            <Truck className="w-4 h-4" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-xs text-slate-900">{(p.name || '').trim()}</span>
                              <span className="text-[10px] font-mono bg-slate-100 px-1.5 py-0.5 rounded text-slate-600 font-semibold">
                                ID : {(p.id || '').replace('part-', '')}
                              </span>
                            </div>
                            <div className="text-[11px] text-slate-500 flex flex-wrap items-center gap-2 mt-0.5">
                              {p.email && <span>{p.email}</span>}
                              {p.email && p.city && <span>•</span>}
                              {p.city && <span>📍 {p.city}</span>}
                              {p.phone && <span>•</span>}
                              {p.phone && <span className="font-mono">📞 {p.phone}</span>}
                            </div>
                          </div>
                        </div>
                        <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>

            {basePartnersList.length > 0 && (
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <span className="text-[11px] font-semibold text-slate-500">Partenaires disponibles :</span>
                {basePartnersList.map(p => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => {
                      setSelectedPartner(p);
                      setIsPartnerDropdownOpen(false);
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-red-50 text-red-700 border border-red-200 hover:bg-red-100 transition cursor-pointer"
                  >
                    <Truck className="w-3.5 h-3.5" />
                    <span>{(p.name || '').trim()}</span>
                    {p.city && <span className="text-[10px] text-red-500 font-normal">({p.city})</span>}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ================= STEP 2: RECHERCHE DE COLIS ================= */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-2xs space-y-4">
        <div className="flex items-center justify-between">
          <label className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-700">
            <Search className="w-4 h-4 text-red-600" />
            <span>Recherche de colis</span>
          </label>

          {onOpenScanner && (
            <button
              type="button"
              onClick={onOpenScanner}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl transition cursor-pointer"
            >
              <Scan className="w-3.5 h-3.5 text-red-600" />
              <span>Scanner code-barres</span>
            </button>
          )}
        </div>

        {/* Search Bar + Red Button (As in video) */}
        <form onSubmit={handleSearchPackages} className="flex items-center gap-2">
          <div className="relative flex-1">
            <input
              type="text"
              value={packageSearchQuery}
              onChange={e => setPackageSearchQuery(e.target.value)}
              placeholder="Rechercher par code, nom, téléphone, ville..."
              className="w-full px-4 py-3 text-sm bg-slate-50 border border-slate-300 rounded-xl text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-500 transition font-mono"
            />
            {packageSearchQuery && (
              <button
                type="button"
                onClick={() => {
                  setPackageSearchQuery('');
                  setSearchResults([]);
                  setHasSearched(false);
                }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          <button
            type="submit"
            className="flex items-center gap-1.5 px-5 py-3 text-xs sm:text-sm font-bold text-white bg-red-600 hover:bg-red-700 active:scale-95 rounded-xl shadow-xs transition cursor-pointer shrink-0"
          >
            <Search className="w-4 h-4" />
            <span>Rechercher</span>
          </button>
        </form>

        {/* ================= RÉSULTATS DE LA RECHERCHE ================= */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-600 uppercase tracking-wider">
              Résultats de la recherche {hasSearched ? `(${searchResults.length})` : ''}
            </span>
            {searchResults.length > 1 && (
              <button
                type="button"
                onClick={handleAddAllSearchResults}
                className="text-xs font-bold text-red-600 hover:underline cursor-pointer"
              >
                Tout ajouter au lot (+{searchResults.length})
              </button>
            )}
          </div>

          {!hasSearched ? (
            <div className="p-8 text-center bg-slate-50 border border-dashed border-slate-200 rounded-xl text-slate-400 text-xs">
              <Search className="w-6 h-6 mx-auto mb-2 text-slate-300" />
              <span>Entrez un code de suivi, un nom de client ou un numéro de téléphone pour rechercher.</span>
            </div>
          ) : searchResults.length === 0 ? (
            <div className="p-8 text-center bg-slate-50 border border-dashed border-slate-200 rounded-xl text-slate-500 text-xs">
              <AlertCircle className="w-6 h-6 mx-auto mb-2 text-amber-500" />
              <span className="font-bold block">Aucun colis correspondant trouvé</span>
              <span className="text-[11px] text-slate-400 mt-0.5">
                Vérifiez le numéro saisi « {packageSearchQuery} ».
              </span>
            </div>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {searchResults.map(pkg => {
                const isAlreadyInQueue = queuePackages.some(p => p.id === pkg.id);
                const pkgPartnerRate = getPartnerCityFee(selectedPartner, pkg.city);
                const pkgCovered = isCityCoveredByPartner(selectedPartner, pkg.city);
                const pkgMargin = Number(pkg.deliveryFee || 0) - pkgPartnerRate;
                return (
                  <div
                    key={pkg.id}
                    className={`p-3 rounded-xl border flex items-center justify-between gap-3 transition ${
                      isAlreadyInQueue
                        ? 'bg-emerald-50/60 border-emerald-200'
                        : 'bg-white border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
                        <Barcode className="w-4 h-4 text-slate-600" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono font-black text-xs text-slate-900 truncate">
                            {pkg.trackingNumber}
                          </span>
                          {selectedPartner && (
                            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 font-bold">
                              الشريك: {pkgPartnerRate} DH · ربحك: {pkgMargin >= 0 ? `+${pkgMargin}` : pkgMargin} DH
                            </span>
                          )}
                          {selectedPartner && !pkgCovered && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 font-bold">
                              خارج مدن الشريك
                            </span>
                          )}
                          <button
                            type="button"
                            onClick={() => handleCopyCode(pkg.trackingNumber)}
                            className="text-slate-400 hover:text-red-600"
                            title="Copier le code"
                          >
                            {copiedTracking === pkg.trackingNumber ? (
                              <Check className="w-3.5 h-3.5 text-emerald-600" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </div>
                        <div className="text-[11px] text-slate-500 truncate">
                          <span>{pkg.recipientName}</span> • <span>📞 {pkg.recipientPhone}</span> • <span>📍 {pkg.city}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      <span className="font-mono font-bold text-xs text-slate-900">
                        {pkg.codAmount || 0} DH
                      </span>
                      <button
                        type="button"
                        onClick={() => handleAddToQueue(pkg)}
                        disabled={isAlreadyInQueue}
                        className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                          isAlreadyInQueue
                            ? 'bg-emerald-100 text-emerald-800 cursor-default'
                            : 'bg-red-600 hover:bg-red-700 text-white'
                        }`}
                      >
                        {isAlreadyInQueue ? (
                          <>
                            <Check className="w-3.5 h-3.5" />
                            <span>Ajouté</span>
                          </>
                        ) : (
                          <>
                            <Plus className="w-3.5 h-3.5" />
                            <span>Ajouter</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ================= STEP 3: PRÊT À ENVOYER (EXACTLY AS IN VIDEO) ================= */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-2xs space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div>
            <h3 className="text-sm font-extrabold text-slate-900 uppercase tracking-wider flex items-center gap-2">
              <span>Prêt à envoyer</span>
              {queuePackages.length > 0 && (
                <span className="px-2 py-0.5 rounded-full text-xs font-mono font-black bg-red-600 text-white">
                  {queuePackages.length}
                </span>
              )}
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Les colis ci-dessous seront envoyés au partenaire{' '}
              <strong className="text-slate-800">{selectedPartner?.name || 'sélectionné'}</strong> et marqués{' '}
              <strong>En transit</strong>.
            </p>
          </div>

          <button
            type="button"
            onClick={handleDispatch}
            disabled={queuePackages.length === 0 || !selectedPartner || isSending}
            className="flex items-center gap-2 px-5 py-2.5 text-xs font-bold text-white bg-red-600 hover:bg-red-700 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed rounded-xl shadow-md transition cursor-pointer"
          >
            {isSending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
            <span>Envoyer {queuePackages.length > 0 ? `(${queuePackages.length})` : ''}</span>
          </button>
        </div>

        {/* Empty State (Exact visual match from video) */}
        {queuePackages.length === 0 ? (
          <div className="p-12 text-center border-2 border-dashed border-red-200 bg-red-50/20 rounded-2xl flex flex-col items-center justify-center">
            <div className="w-14 h-14 rounded-2xl border-2 border-red-500 text-red-600 flex items-center justify-center mb-3 bg-white shadow-2xs">
              <Scan className="w-7 h-7" />
            </div>
            <h4 className="font-extrabold text-sm text-slate-900">
              Aucun colis pour le moment
            </h4>
            <p className="text-xs text-slate-500 mt-1 max-w-sm">
              Entrez un code, nom, téléphone ou ville ci-dessus pour ajouter des colis à expédier au partenaire.
            </p>
          </div>
        ) : (
          /* Populated Ready Queue */
          <div className="space-y-4">
            {/* Automated Financial Calculation Card (عملية حسابية أوتوماتيكية فاش نعطيه كموند) */}
            <div className="p-4 bg-linear-to-r from-slate-900 via-slate-900 to-slate-800 text-white rounded-2xl shadow-sm border border-slate-700 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-700/80 pb-2.5">
                <span className="text-xs font-bold uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                  <Calculator className="w-4 h-4" />
                  <span>العملية الحسابية للشحنة (Décompte Financier Immédiat)</span>
                </span>
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-slate-300">سعر التوصيل للشريك:</span>
                  <span className="font-mono font-bold text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded border border-amber-400/30">
                    {partnerRate} DH / طرد
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="p-3 bg-slate-800/90 rounded-xl border border-slate-700 text-center">
                  <span className="text-[10px] text-slate-400 font-bold block uppercase">
                    1. إجمالي مبالغ التحصيل (CRBT)
                  </span>
                  <span className="text-base font-black font-mono text-white mt-1 block">
                    {formatMAD(totalQueueCod)}
                  </span>
                  <span className="text-[10px] text-slate-400 block mt-0.5">
                    مجموع {queuePackages.length} طرد
                  </span>
                </div>

                <div className="p-3 bg-slate-800/90 rounded-xl border border-slate-700 text-center">
                  <span className="text-[10px] text-slate-400 font-bold block uppercase">
                    2. أتعاب التوصيل للشريك
                  </span>
                  <span className="text-base font-black font-mono text-rose-400 mt-1 block">
                    - {formatMAD(totalQueuePartnerFee)}
                  </span>
                  <span className="text-[10px] text-slate-400 block mt-0.5">
                    حسب تعريفة كل مدينة
                  </span>
                </div>

                <div className="p-3 bg-emerald-950/60 rounded-xl border border-emerald-500/40 text-center">
                  <span className="text-[10px] text-emerald-300 font-bold block uppercase">
                    3. الصافي الذي كنسالوه للشريك
                  </span>
                  <span className="text-base font-black font-mono text-emerald-400 mt-1 block">
                    + {formatMAD(netQueueToRecover)}
                  </span>
                  <span className="text-[10px] text-emerald-300/80 block mt-0.5">
                    المبلغ الواجب استرجاعه بعد التحصيل
                  </span>
                </div>

                <div className="p-3 bg-amber-950/50 rounded-xl border border-amber-500/40 text-center">
                  <span className="text-[10px] text-amber-300 font-bold block uppercase">
                    4. ربحك الصافي من التوصيل
                  </span>
                  <span className="text-base font-black font-mono text-amber-400 mt-1 block">
                    + {formatMAD(netQueueProfit)}
                  </span>
                  <span className="text-[10px] text-amber-200/80 block mt-0.5">
                    توصيل الزبائن ({formatMAD(totalQueueClientFee)}) - الشريك
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between text-xs text-slate-500 px-1">
              <span>{queuePackages.length} colis prêts pour le transfert vers <strong>{selectedPartner?.name}</strong></span>
              <span className="font-bold text-slate-800">
                Total CRBT : <strong className="text-red-600">{formatMAD(totalQueueCod)}</strong>
              </span>
            </div>

            <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden max-h-80 overflow-y-auto">
              {queuePackages.map((pkg, idx) => {
                const pkgPartnerRate = getPartnerCityFee(selectedPartner, pkg.city);
                const pkgCovered = isCityCoveredByPartner(selectedPartner, pkg.city);
                const pkgMargin = Number(pkg.deliveryFee || 0) - pkgPartnerRate;
                return (
                <div key={pkg.id} className="p-3 bg-white flex items-center justify-between gap-3 hover:bg-slate-50">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="w-6 text-center font-mono text-xs font-bold text-slate-400">
                      {idx + 1}
                    </span>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono font-black text-xs text-slate-900">
                          {pkg.trackingNumber}
                        </span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 font-bold text-slate-600 uppercase">
                          {pkg.status}
                        </span>
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-red-50 text-red-700 font-bold">
                          الشريك: {pkgPartnerRate} DH
                        </span>
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 font-bold">
                          ربحك: {pkgMargin >= 0 ? `+${pkgMargin}` : pkgMargin} DH
                        </span>
                        {!pkgCovered && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 font-bold">
                            مدينة غير محددة للشريك
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-500 truncate mt-0.5">
                        <span className="font-semibold text-slate-700">{pkg.recipientName}</span> • <span>📞 {pkg.recipientPhone}</span> • <span>📍 {pkg.city}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <span className="font-mono font-black text-xs text-slate-900">
                      {pkg.codAmount || 0} DH
                    </span>
                    <button
                      type="button"
                      onClick={() => handleRemoveFromQueue(pkg.id)}
                      className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                      title="Retirer du lot"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* ================= SUCCESS MODAL & BORDEREAU DE TRANSFERT ================= */}
      {dispatchedSuccess && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs no-print overflow-y-auto">
          <div className="relative w-full max-w-xl bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col my-auto">
            <div className="p-6 text-center border-b border-slate-100 bg-emerald-50">
              <div className="w-16 h-16 rounded-full bg-emerald-600 text-white flex items-center justify-center mx-auto mb-3 shadow-md">
                <Check className="w-8 h-8" />
              </div>
              <h3 className="text-lg font-black text-slate-900">
                Colis expédiés avec succès au partenaire !
              </h3>
              <p className="text-xs text-emerald-800 mt-1 font-medium">
                {dispatchedSuccess.count} colis marqués <strong>En transit</strong> sous la responsabilité de{' '}
                <strong>{dispatchedSuccess.partner.name}</strong>.
              </p>
            </div>

            <div className="p-6 space-y-4 text-xs">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 bg-slate-50 p-3 rounded-xl border border-slate-200">
                <div>
                  <span className="text-[10px] text-slate-400 font-bold block uppercase">Partenaire</span>
                  <span className="font-extrabold text-slate-900 text-xs block truncate">
                    {dispatchedSuccess.partner.name}
                  </span>
                  <span className="text-[10px] text-slate-500">{dispatchedSuccess.partner.city}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 font-bold block uppercase">Réf. Transfert</span>
                  <span className="font-mono font-extrabold text-red-600 text-xs block">
                    {dispatchedSuccess.manifestNumber}
                  </span>
                  <span className="text-[10px] text-slate-500">{dispatchedSuccess.count} colis</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 font-bold block uppercase">Total CRBT</span>
                  <span className="font-black text-slate-900 text-xs block font-mono">
                    {formatMAD(dispatchedSuccess.totalCod)}
                  </span>
                  <span className="text-[10px] text-slate-500">واجبات: -{formatMAD(dispatchedSuccess.totalPartnerFee)}</span>
                </div>
                <div className="bg-emerald-50 p-1.5 rounded-lg border border-emerald-200">
                  <span className="text-[10px] text-emerald-800 font-bold block uppercase">كنسالوه (Net)</span>
                  <span className="font-black text-emerald-700 text-xs block font-mono">
                    +{formatMAD(dispatchedSuccess.netToRecover)}
                  </span>
                  <span className="text-[9px] text-emerald-600">بعد خصم التوصيل</span>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={handleShareWhatsApp}
                  className="flex items-center gap-1.5 px-4 py-2.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition cursor-pointer"
                >
                  <Share2 className="w-4 h-4" />
                  <span>Envoyer récapitulatif WhatsApp</span>
                </button>

                <button
                  type="button"
                  onClick={() => setShowManifestModal(true)}
                  className="flex items-center gap-1.5 px-4 py-2.5 text-xs font-bold text-white bg-slate-900 hover:bg-black rounded-xl transition cursor-pointer"
                >
                  <Printer className="w-4 h-4" />
                  <span>Imprimer le Bordereau Officiel</span>
                </button>
              </div>
            </div>

            <div className="px-6 py-3 bg-slate-50 border-t border-slate-100 flex justify-end">
              <button
                type="button"
                onClick={() => setDispatchedSuccess(null)}
                className="px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-200 rounded-xl transition cursor-pointer"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= PRINTABLE BORDEREAU DE TRANSFERT ================= */}
      {showManifestModal && dispatchedSuccess && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs no-print overflow-y-auto">
          <div className="relative w-full max-w-4xl bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col my-auto max-h-[96vh]">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50">
              <div className="flex items-center gap-2">
                <Printer className="w-5 h-5 text-red-600" />
                <h3 className="font-bold text-base text-slate-900">
                  Bordereau d'Expédition & Transfert Partenaire
                </h3>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handlePrintManifest}
                  disabled={isPrintingManifest}
                  className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-red-600 hover:bg-red-700 rounded-xl transition cursor-pointer disabled:opacity-50"
                >
                  {isPrintingManifest ? <Loader2 className="w-4 h-4 animate-spin" /> : <Printer className="w-4 h-4" />}
                  <span>Imprimer A4</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowManifestModal(false)}
                  className="p-2 text-slate-400 hover:text-slate-600 rounded-xl transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Document sheet */}
            <div className="p-6 overflow-y-auto bg-slate-200/60 flex justify-center">
              <div
                id="partner-dispatch-manifest-sheet"
                className="w-full max-w-[800px] bg-white border border-slate-300 p-8 shadow-md text-slate-900 text-xs flex flex-col justify-between"
                style={{ minHeight: '1050px', fontFamily: "'Plus Jakarta Sans', 'Cairo', Arial, sans-serif" }}
              >
                <div>
                  {/* Top Bar */}
                  <div className="flex items-start justify-between border-b-2 border-slate-900 pb-4">
                    <div className="flex items-center gap-3">
                      <img
                        src="/fariousy-logo.jpeg"
                        alt="FARIOUSY"
                        className="w-16 h-16 object-contain shrink-0"
                      />
                      <div>
                        <h1 className="text-xl font-black tracking-tight text-slate-900 leading-none">
                          FARIOUSY DELIVERY
                        </h1>
                        <span className="text-[10px] font-bold text-red-600 uppercase tracking-widest block mt-0.5">
                          FAST & SECURE LOGISTICS
                        </span>
                        <p className="text-[10px] text-slate-600 mt-1 leading-tight">
                          {companySettings?.address || 'Lotissement al aouda, Laâyoune / Casablanca, Maroc'}<br />
                          Tél : {companySettings?.phone || '+212 522 89 40 10'} • Web : {companySettings?.website || 'www.fariousy.com'}
                        </p>
                      </div>
                    </div>

                    <div className="text-right flex items-center gap-3">
                      <div>
                        <span className="inline-block px-2.5 py-1 bg-slate-900 text-white font-black text-xs uppercase tracking-wider rounded">
                          BORDEREAU TRANSFERT PARTENAIRE
                        </span>
                        <div className="text-base font-black font-mono text-red-600 mt-1">
                          {dispatchedSuccess.manifestNumber}
                        </div>
                        <div className="text-[10px] text-slate-500 font-mono">
                          Date : {dispatchedSuccess.timestamp}
                        </div>
                      </div>
                      {manifestQr && (
                        <img src={manifestQr} alt={dispatchedSuccess.manifestNumber} className="w-16 h-16 object-contain border border-slate-200 p-0.5 rounded" />
                      )}
                    </div>
                  </div>

                  {/* Partner Box with Detailed Financials */}
                  <div className="my-4 grid grid-cols-5 gap-2 bg-slate-50 border border-slate-200 p-3 rounded-lg text-xs">
                    <div>
                      <span className="text-[10px] text-slate-500 font-bold block uppercase">Société Partenaire</span>
                      <span className="font-extrabold text-xs text-slate-900 block truncate">
                        {dispatchedSuccess.partner.name}
                      </span>
                      <span className="text-[10px] text-slate-500">ID : {dispatchedSuccess.partner.id.replace('part-', '')}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-500 font-bold block uppercase">Zone & Contact</span>
                      <span className="font-bold text-xs text-slate-900 block">{dispatchedSuccess.partner.city}</span>
                      <span className="text-[10px] text-slate-600 font-mono">{dispatchedSuccess.partner.phone}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-500 font-bold block uppercase">Nombre de Colis</span>
                      <span className="font-black text-xs text-slate-900 block">{dispatchedSuccess.count} Colis</span>
                      <span className="text-[10px] text-slate-500">Tarif: {dispatchedSuccess.partnerFee} DH/colis</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-500 font-bold block uppercase">Total CRBT</span>
                      <span className="font-black text-xs text-slate-900 block font-mono">{formatMAD(dispatchedSuccess.totalCod)}</span>
                      <span className="text-[10px] text-red-600">Frais: -{formatMAD(dispatchedSuccess.totalPartnerFee)}</span>
                    </div>
                    <div className="bg-emerald-50/80 p-1.5 rounded border border-emerald-200">
                      <span className="text-[10px] text-emerald-800 font-bold block uppercase">Net à Reverser (كنسالوه)</span>
                      <span className="font-black text-xs text-emerald-700 block font-mono">+{formatMAD(dispatchedSuccess.netToRecover)}</span>
                      <span className="text-[9px] text-emerald-600">صافي المستحق</span>
                    </div>
                  </div>

                  {/* Itemized Table */}
                  <table className="w-full text-left border-collapse border border-slate-300 text-[11px] mt-4">
                    <thead>
                      <tr className="bg-slate-900 text-white font-bold">
                        <th className="p-2 border border-slate-700 w-8 text-center">N°</th>
                        <th className="p-2 border border-slate-700 w-28">N° Suivi</th>
                        <th className="p-2 border border-slate-700">Destinataire & Téléphone</th>
                        <th className="p-2 border border-slate-700">Ville & Adresse</th>
                        <th className="p-2 border border-slate-700 w-24 text-right">CRBT (MAD)</th>
                        <th className="p-2 border border-slate-700 w-24 text-center">Statut</th>
                        <th className="p-2 border border-slate-700 w-24 text-center">Émargement</th>
                      </tr>
                    </thead>
                    <tbody>
                      {packages
                        .filter(p => dispatchedSuccess.packageIds.includes(p.id))
                        .map((pkg, idx) => (
                          <tr key={pkg.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/70'}>
                            <td className="p-2 border border-slate-300 text-center font-bold text-slate-500">
                              {idx + 1}
                            </td>
                            <td className="p-2 border border-slate-300 font-mono font-bold text-slate-900">
                              {pkg.trackingNumber}
                            </td>
                            <td className="p-2 border border-slate-300">
                              <span className="font-bold text-slate-900 block">{pkg.recipientName}</span>
                              <span className="text-[10px] font-mono text-slate-600">📞 {pkg.recipientPhone}</span>
                            </td>
                            <td className="p-2 border border-slate-300">
                              <span className="font-bold text-slate-800">{pkg.city}</span>
                              <span className="text-[10px] text-slate-500 block truncate max-w-[200px]">{pkg.address}</span>
                            </td>
                            <td className="p-2 border border-slate-300 text-right font-black font-mono text-slate-900">
                              {pkg.codAmount || 0} DH
                            </td>
                            <td className="p-2 border border-slate-300 text-center font-medium">
                              <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 font-bold uppercase">
                                En transit
                              </span>
                            </td>
                            <td className="p-2 border border-slate-300">
                              <div className="h-6 border-b border-dashed border-slate-300"></div>
                            </td>
                          </tr>
                        ))}
                    </tbody>
                    <tfoot>
                      <tr className="bg-slate-100 font-bold text-slate-800 border-t-2 border-slate-900">
                        <td colSpan={4} className="p-2 text-right uppercase">
                          TOTAL GÉNÉRAL CRBT ({dispatchedSuccess.count} COLIS) :
                        </td>
                        <td className="p-2 text-right font-mono font-bold text-slate-900 border border-slate-300">
                          {formatMAD(dispatchedSuccess.totalCod)}
                        </td>
                        <td colSpan={2} className="p-2 border border-slate-300"></td>
                      </tr>
                      <tr className="bg-slate-50 font-bold text-slate-700">
                        <td colSpan={4} className="p-2 text-right uppercase">
                          DÉDUCTION FRAIS LIVRAISON PARTENAIRE ({dispatchedSuccess.count} × {dispatchedSuccess.partnerFee} DH) :
                        </td>
                        <td className="p-2 text-right font-mono font-bold text-red-600 border border-slate-300">
                          - {formatMAD(dispatchedSuccess.totalPartnerFee)}
                        </td>
                        <td colSpan={2} className="p-2 border border-slate-300 text-[10px] text-slate-500 text-center">Déduit</td>
                      </tr>
                      <tr className="bg-emerald-50 font-black text-emerald-950 border-t border-emerald-300">
                        <td colSpan={4} className="p-2 text-right uppercase">
                          NET À REVERSER À FARIOUSY DELIVERY (المبلغ الصافي المستحق بذمة الشريك) :
                        </td>
                        <td className="p-2 text-right font-mono font-black text-sm text-emerald-700 border border-slate-300">
                          + {formatMAD(dispatchedSuccess.netToRecover)}
                        </td>
                        <td colSpan={2} className="p-2 border border-slate-300 text-[10px] font-bold text-emerald-700 text-center">كنسالوه</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>

                {/* Signatures */}
                <div className="pt-6 border-t-2 border-slate-900 mt-6">
                  <div className="grid grid-cols-2 gap-8 text-center text-xs">
                    <div className="border border-slate-300 rounded-lg p-3 h-28 flex flex-col justify-between bg-slate-50/50">
                      <span className="font-bold uppercase text-[10px] text-slate-700">
                        Signature et Cachet du Partenaire {dispatchedSuccess.partner.name}
                      </span>
                      <div className="text-[9px] text-slate-400">Mention manuscrite « Colis reçus conformes »</div>
                    </div>
                    <div className="border border-slate-300 rounded-lg p-3 h-28 flex flex-col justify-between bg-slate-50/50">
                      <span className="font-bold uppercase text-[10px] text-slate-700">
                        Signature et Cachet Agence FARIOUSY DELIVERY
                      </span>
                      <div className="text-[9px] text-slate-400">Responsable Logistique & Expéditions</div>
                    </div>
                  </div>
                  <div className="mt-4 pt-2 border-t border-slate-200 text-center text-[9px] text-slate-400 font-mono">
                    Document officiel de transfert inter-agences • FARIOUSY DELIVERY • {formatDateTime(new Date().toISOString())}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
