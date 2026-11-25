import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useDatabase } from '../../context/DatabaseContext';
import { PackageItem } from '../../types';
import { formatMAD, formatDate, getStatusBadgeColor, getStatusLabel } from '../../utils/barcode';
import { supabaseRealtime } from '../../services/supabase';
import {
  buildLiveTrackingUrl,
  buildWhatsAppDirectLink,
  getTrackingProgressStages,
  renderWhatsAppStatusMessage
} from '../../utils/trackingNotifications';
import {
  Search,
  Package,
  Clock,
  MapPin,
  Phone,
  CheckCircle2,
  AlertCircle,
  Truck,
  User,
  Eye,
  Radio,
  Bell,
  BellRing,
  Copy,
  Check,
  MessageCircle,
  ExternalLink
} from 'lucide-react';

interface ClientTrackingProps {
  onViewPackage: (pkg: PackageItem) => void;
}

export const ClientTracking: React.FC<ClientTrackingProps> = ({ onViewPackage }) => {
  const { currentUser } = useAuth();
  const { packages, companySettings, whatsappLogs } = useDatabase();

  const myShopId = (currentUser as any)?.shopId;
  const myPackages = useMemo(
    () =>
      packages.filter(
        p =>
          p.clientId === currentUser?.id ||
          (Boolean(p.shopId) && (p.shopId === currentUser?.id || (Boolean(myShopId) && p.shopId === myShopId))) ||
          (Boolean(myShopId) && p.clientId === myShopId)
      ),
    [packages, currentUser?.id, myShopId]
  );

  const [searchTracking, setSearchTracking] = useState('');
  const [searchError, setSearchError] = useState<string | null>(null);
  const [selectedPackageId, setSelectedPackageId] = useState<string | null>(myPackages[0]?.id || null);
  const [realtimeStatus, setRealtimeStatus] = useState<'connected' | 'connecting' | 'disconnected'>(
    supabaseRealtime.connectionStatus
  );
  const [copiedTracking, setCopiedTracking] = useState(false);
  const [lastLivePulse, setLastLivePulse] = useState<string | null>(null);
  const [pushPerm, setPushPerm] = useState<NotificationPermission | 'unsupported'>(() => {
    if (typeof window === 'undefined' || typeof Notification === 'undefined') return 'unsupported';
    return Notification.permission;
  });

  // Always derive the live package object from live `myPackages` so Realtime status updates appear instantaneously
  const selectedPackage = useMemo(() => {
    if (myPackages.length === 0) return null;
    if (selectedPackageId) {
      const match = myPackages.find(p => p.id === selectedPackageId);
      if (match) return match;
    }
    return myPackages[0];
  }, [myPackages, selectedPackageId]);

  useEffect(() => {
    const unsubConn = supabaseRealtime.onStatusChange(status => setRealtimeStatus(status));
    const unsubPkg = supabaseRealtime.onPackageStatusChanged(ev => {
      if (
        selectedPackage &&
        (ev.packageId === selectedPackage.id || ev.trackingNumber === selectedPackage.trackingNumber)
      ) {
        setLastLivePulse(`${ev.newStatusLabel} · ${new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`);
      }
    });
    return () => {
      unsubConn();
      unsubPkg();
    };
  }, [selectedPackage?.id, selectedPackage?.trackingNumber]);

  const handleEnablePush = async () => {
    if (typeof window === 'undefined' || typeof Notification === 'undefined') return;
    try {
      const result = await Notification.requestPermission();
      setPushPerm(result);
    } catch {}
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setSearchError(null);
    const clean = searchTracking.trim().toUpperCase();
    if (!clean) return;

    const found = myPackages.find(
      p =>
        p.trackingNumber.toUpperCase().includes(clean) ||
        p.id.toUpperCase().includes(clean) ||
        p.recipientPhone.includes(clean) ||
        p.recipientName.toLowerCase().includes(clean.toLowerCase())
    );

    if (found) {
      setSelectedPackageId(found.id);
    } else {
      setSearchError(`لم يتم العثور على أي طرد مطابق لـ "${searchTracking}" ضمن شحناتك.`);
    }
  };

  const handleCopyTrackingLink = async (pkg: PackageItem) => {
    const url = buildLiveTrackingUrl(pkg.trackingNumber, companySettings.website);
    try {
      await navigator.clipboard.writeText(url);
      setCopiedTracking(true);
      setTimeout(() => setCopiedTracking(false), 2500);
    } catch {}
  };

  const selectedProgress = selectedPackage ? getTrackingProgressStages(selectedPackage.status) : null;
  const selectedParcelWaLogs = useMemo(() => {
    if (!selectedPackage) return [];
    return (whatsappLogs || []).filter(
      l =>
        l.packageId === selectedPackage.id ||
        (l.trackingNumber && l.trackingNumber.toUpperCase() === selectedPackage.trackingNumber.toUpperCase())
    );
  }, [whatsappLogs, selectedPackage?.id, selectedPackage?.trackingNumber]);

  const selectedWaDirectHref = useMemo(() => {
    if (!selectedPackage) return '#';
    const msg = renderWhatsAppStatusMessage(companySettings.whatsappCustomTemplate, {
      companyName: companySettings.companyName,
      trackingNumber: selectedPackage.trackingNumber,
      recipientName: selectedPackage.recipientName,
      status: selectedPackage.status,
      statusLabel: getStatusLabel(selectedPackage.status),
      city: selectedPackage.city,
      codAmount: selectedPackage.codAmount,
      driverName: selectedPackage.driverName,
      trackingUrl: buildLiveTrackingUrl(selectedPackage.trackingNumber, companySettings.website)
    });
    return buildWhatsAppDirectLink(selectedPackage.recipientPhone, msg);
  }, [selectedPackage, companySettings]);

  return (
    <div className="space-y-6 max-w-6xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-slate-200">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-xl font-black text-slate-900 tracking-tight">
              Suivi des Colis en Temps Réel
            </h2>
            <span
              className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border ${
                realtimeStatus === 'connected'
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  : 'bg-amber-50 text-amber-700 border-amber-200'
              }`}
            >
              <Radio
                className={`w-3 h-3 ${
                  realtimeStatus === 'connected' ? 'text-emerald-600 animate-pulse' : 'text-amber-600'
                }`}
              />
              <span>{realtimeStatus === 'connected' ? 'LIVE المباشر' : 'Connexion...'}</span>
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            التتبع الحي والمباشر + إشعارات فورية تلقائية عند تغيّر الحالة (Ramassé · En cours · Livré · Retour)
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {pushPerm !== 'unsupported' && (
            <button
              type="button"
              onClick={handleEnablePush}
              disabled={pushPerm === 'granted'}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition-colors cursor-pointer ${
                pushPerm === 'granted'
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200 cursor-default'
                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
              }`}
            >
              {pushPerm === 'granted' ? (
                <>
                  <BellRing className="w-3.5 h-3.5 text-emerald-600" />
                  <span>الإشعارات الفورية مفعّلة</span>
                </>
              ) : (
                <>
                  <Bell className="w-3.5 h-3.5 text-red-600" />
                  <span>تفعيل إشعارات المتصفح</span>
                </>
              )}
            </button>
          )}
          <div className="text-xs font-mono bg-white border border-slate-200 px-3 py-1.5 rounded-xl font-bold text-slate-700">
            Total Expédiés : <strong className="text-red-600">{myPackages.length}</strong>
          </div>
        </div>
      </div>

      {/* Search Bar */}
      <div className="p-4 sm:p-5 bg-white border border-slate-200 rounded-2xl shadow-2xs space-y-2.5">
        <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchTracking}
              onChange={e => {
                setSearchTracking(e.target.value);
                if (searchError) setSearchError(null);
              }}
              placeholder="Rechercher par N° de suivi (ex: FAR-2601-8491), nom ou téléphone du destinataire..."
              className="w-full pl-9 pr-4 py-2.5 text-xs bg-slate-50 border border-slate-300 rounded-xl text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-500 font-mono"
            />
          </div>
          <button
            type="submit"
            className="px-5 py-2.5 text-xs font-bold text-white bg-red-600 hover:bg-red-700 rounded-xl shadow-xs transition-colors shrink-0 cursor-pointer"
          >
            Rechercher le Colis
          </button>
        </form>
        {searchError && (
          <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{searchError}</span>
          </div>
        )}
      </div>

      {/* Main Grid: Package List + Tracking Detail Card */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Quick select recent packages */}
        <div className="space-y-3">
          <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
            Mes Derniers Colis ({myPackages.length})
          </h3>

          <div className="space-y-2 max-h-[620px] overflow-y-auto pr-1">
            {myPackages.map(pkg => {
              const isSelected = selectedPackage?.id === pkg.id;
              return (
                <div
                  key={pkg.id}
                  onClick={() => {
                    setSelectedPackageId(pkg.id);
                    setLastLivePulse(null);
                  }}
                  className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-red-50/60 border-red-300 shadow-xs'
                      : 'bg-white border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="font-mono font-bold text-xs text-slate-900 force-ltr">
                      {pkg.trackingNumber}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0 ${getStatusBadgeColor(
                        pkg.status
                      )}`}
                    >
                      {getStatusLabel(pkg.status)}
                    </span>
                  </div>

                  <div className="text-xs text-slate-700 font-medium truncate">
                    {pkg.recipientName}
                  </div>

                  <div className="flex items-center justify-between mt-2 text-[11px] text-slate-500">
                    <span className="flex items-center gap-1">
                      <MapPin className="w-3 h-3 text-slate-400" />
                      <span>{pkg.city}</span>
                    </span>
                    <span className="font-mono font-bold text-slate-900">
                      {formatMAD(pkg.codAmount)}
                    </span>
                  </div>
                </div>
              );
            })}

            {myPackages.length === 0 && (
              <div className="p-8 text-center bg-white border border-slate-200 rounded-2xl text-xs text-slate-400">
                Vous n'avez pas encore créé de colis.
              </div>
            )}
          </div>
        </div>

        {/* Right: Detailed Package Live Stepper, Share Actions & Timeline */}
        <div className="lg:col-span-2">
          {selectedPackage && selectedProgress ? (
            <div className="bg-white border border-slate-200 rounded-2xl shadow-2xs overflow-hidden space-y-6 p-4 sm:p-6">
              {/* Header Info */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono font-black text-lg text-slate-900 force-ltr">
                      {selectedPackage.trackingNumber}
                    </span>
                    <span
                      className={`px-2.5 py-1 rounded-full text-xs font-black uppercase tracking-wider ${getStatusBadgeColor(
                        selectedPackage.status
                      )}`}
                    >
                      {getStatusLabel(selectedPackage.status)}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    Créé le {selectedPackage.createdAt} • Agence : {selectedPackage.currentAgency}
                  </p>
                  {lastLivePulse && (
                    <p className="text-[11px] font-bold text-emerald-700 mt-1 flex items-center gap-1">
                      <Radio className="w-3 h-3 animate-pulse" />
                      <span>تم التحديث مباشرة الآن: {lastLivePulse}</span>
                    </p>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleCopyTrackingLink(selectedPackage)}
                    className="px-3 py-2 text-xs font-bold text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer"
                  >
                    {copiedTracking ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                        <span className="text-emerald-700">تم نسخ الرابط</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5 text-slate-600" />
                        <span>رابط التتبع</span>
                      </>
                    )}
                  </button>
                  <a
                    href={selectedWaDirectHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition-colors flex items-center gap-1.5"
                  >
                    <MessageCircle className="w-3.5 h-3.5" />
                    <span>إرسال واتساب للزبون</span>
                  </a>
                  <button
                    type="button"
                    onClick={() => onViewPackage(selectedPackage)}
                    className="px-3 py-2 text-xs font-bold text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer"
                  >
                    <Eye className="w-4 h-4 text-slate-600" />
                    <span>Fiche</span>
                  </button>
                </div>
              </div>

              {/* Live 4-Stage Progress Bar */}
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                <div className="flex items-center justify-between text-[11px] font-bold text-slate-600">
                  <span className="flex items-center gap-1.5">
                    <Truck className="w-3.5 h-3.5 text-red-600" />
                    <span>مراحل التوصيل المباشرة (Suivi Live)</span>
                  </span>
                  <span className="font-mono text-slate-900">{selectedProgress.percent}%</span>
                </div>
                <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      selectedProgress.isDelivered
                        ? 'bg-emerald-500'
                        : selectedProgress.isReturnOrIssue
                        ? 'bg-amber-500'
                        : 'bg-red-600'
                    }`}
                    style={{ width: `${selectedProgress.percent}%` }}
                  />
                </div>
                <div className="grid grid-cols-4 gap-2 pt-1">
                  {selectedProgress.stages.map(stage => {
                    const dotCls =
                      stage.state === 'completed'
                        ? 'bg-emerald-500 text-white'
                        : stage.state === 'current'
                        ? 'bg-red-600 text-white ring-4 ring-red-100'
                        : stage.state === 'issue'
                        ? 'bg-amber-500 text-white ring-4 ring-amber-100'
                        : 'bg-slate-200 text-slate-500';
                    return (
                      <div key={stage.id} className="text-center space-y-1">
                        <div className={`w-6 h-6 rounded-full mx-auto flex items-center justify-center text-[10px] font-black ${dotCls}`}>
                          {stage.state === 'completed' ? (
                            <CheckCircle2 className="w-3.5 h-3.5" />
                          ) : stage.state === 'issue' ? (
                            <AlertCircle className="w-3.5 h-3.5" />
                          ) : (
                            <span className="w-2 h-2 rounded-full bg-current" />
                          )}
                        </div>
                        <div className="text-[11px] font-bold text-slate-800 leading-tight">{stage.labelFr}</div>
                        <div className="text-[10px] text-slate-500 leading-tight">{stage.labelAr}</div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Coordinates Overview */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-2">
                  <div className="flex items-center gap-2 text-slate-900 font-bold">
                    <User className="w-4 h-4 text-red-600" />
                    <span>Destinataire du Colis</span>
                  </div>
                  <div className="text-slate-800 font-semibold">{selectedPackage.recipientName}</div>
                  <div className="text-slate-600 font-mono flex items-center gap-1.5 force-ltr">
                    <Phone className="w-3.5 h-3.5 text-slate-400" />
                    <span>{selectedPackage.recipientPhone}</span>
                  </div>
                  <div className="text-slate-600 flex items-start gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                    <span>
                      {selectedPackage.city} — {selectedPackage.address}
                    </span>
                  </div>
                </div>

                <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-2">
                  <div className="flex items-center gap-2 text-slate-900 font-bold">
                    <Package className="w-4 h-4 text-slate-700" />
                    <span>Détails & Finance</span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span className="text-slate-500">Marchandise :</span>
                    <strong className="text-slate-900 truncate">{selectedPackage.description}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Montant CRBT / COD :</span>
                    <strong className="text-slate-900 font-mono text-sm">
                      {formatMAD(selectedPackage.codAmount)}
                    </strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Frais de livraison :</span>
                    <span className="text-red-600 font-mono font-bold">
                      {formatMAD(selectedPackage.deliveryFee)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Net commerçant :</span>
                    <span className="text-emerald-700 font-mono font-black">
                      {formatMAD(selectedPackage.codAmount - selectedPackage.deliveryFee)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Automatic WhatsApp Notifications sent for this parcel */}
              {selectedParcelWaLogs.length > 0 && (
                <div className="p-4 rounded-xl bg-emerald-50/50 border border-emerald-200 space-y-2">
                  <div className="text-xs font-bold text-emerald-900 flex items-center gap-1.5">
                    <MessageCircle className="w-4 h-4 text-emerald-600" />
                    <span>إشعارات واتساب التلقائية لهذا الطرد ({selectedParcelWaLogs.length})</span>
                  </div>
                  <div className="space-y-1.5">
                    {selectedParcelWaLogs.slice(0, 4).map(log => (
                      <div
                        key={log.id}
                        className="p-2.5 bg-white rounded-lg border border-emerald-100 text-[11px] flex items-center justify-between gap-2"
                      >
                        <div className="min-w-0">
                          <span className="font-bold text-slate-900">{log.statusLabel}</span>
                          <span className="text-slate-400"> · {formatDate(log.createdAt)}</span>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              log.deliveryState === 'sent'
                                ? 'bg-emerald-100 text-emerald-800'
                                : log.deliveryState === 'failed'
                                ? 'bg-rose-100 text-rose-700'
                                : 'bg-amber-100 text-amber-800'
                            }`}
                          >
                            {log.deliveryState === 'sent'
                              ? 'تم الإرسال API'
                              : log.deliveryState === 'failed'
                              ? 'فشل API'
                              : 'رابط جاهز'}
                          </span>
                          {log.whatsappDirectUrl && (
                            <a
                              href={log.whatsappDirectUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-emerald-700 hover:text-emerald-900 font-bold inline-flex items-center gap-0.5"
                            >
                              <span>WhatsApp</span>
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Timeline of events */}
              <div>
                <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-3 flex items-center gap-2">
                  <Clock className="w-4 h-4 text-red-600" />
                  <span>Historique des Mouvements & Suivi d'Étape</span>
                </h4>

                <div className="relative pl-6 border-l-2 border-slate-200 space-y-6 text-xs">
                  {selectedPackage.history?.map((step, idx) => (
                    <div key={step.id || idx} className="relative">
                      {/* Timeline dot */}
                      <span
                        className={`absolute -left-[31px] top-0.5 w-4 h-4 rounded-full border-2 border-white shadow-xs ${
                          idx === selectedPackage.history.length - 1
                            ? 'bg-red-600 ring-4 ring-red-100'
                            : 'bg-slate-400'
                        }`}
                      />

                      <div className="flex items-center justify-between gap-2">
                        <span className="font-bold text-slate-900">{step.statusLabel || step.status}</span>
                        <span className="font-mono text-[11px] text-slate-400 shrink-0">
                          {formatDate(step.timestamp)}
                        </span>
                      </div>

                      <p className="text-slate-600 mt-1">{step.comment || 'Étape validée par le système.'}</p>
                      <div className="text-[10px] text-slate-400 mt-0.5">
                        Intervenant : {step.updatedBy} • Lieu : {step.location}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="p-12 text-center bg-white border border-slate-200 rounded-2xl text-xs text-slate-400">
              Sélectionnez un colis pour afficher son suivi détaillé.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
