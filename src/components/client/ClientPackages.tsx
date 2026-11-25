import React, { useState, useEffect } from 'react';
import { useDatabase } from '../../context/DatabaseContext';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../i18n/LanguageContext';
import { PackageItem, PACKAGE_STATUS_CONFIG } from '../../types';
import { formatMAD, formatDate } from '../../utils/barcode';
import { exportPackagesToCSV } from '../../utils/export';
import {
  buildRecipientConfirmationWhatsAppUrl,
  hasValidRecipientWhatsApp,
  isPendingConfirmationStatus
} from '../../utils/supportWhatsApp';
import {
  Search,
  Plus,
  Printer,
  Download,
  Eye,
  Edit2,
  Trash2,
  X,
  Save,
  CheckCircle2,
  AlertCircle,
  MessageSquare,
  RefreshCw,
  Package,
  FileSpreadsheet,
  MessageCircle,
  ChevronLeft,
  ChevronRight,
  ShieldAlert,
  Ban,
  Warehouse
} from 'lucide-react';
import { CreateClientMessageModal } from './CreateClientMessageModal';
import { OrderWhatsAppSupportModal } from './OrderWhatsAppSupportModal';
import { ConfirmActionModal } from '../common/ConfirmActionModal';

interface ClientPackagesProps {
  onOpenAddPackage: () => void;
  onOpenImportExcel?: () => void;
  onViewPackage: (pkg: PackageItem) => void;
  onPrintThermalLabel: (pkg: PackageItem) => void;
  onReportToBlacklist?: (pkg: PackageItem) => void;
  externalSearchQuery?: { query: string; nonce: number } | null;
}

export const ClientPackages: React.FC<ClientPackagesProps> = ({
  onOpenAddPackage,
  onOpenImportExcel,
  onViewPackage,
  onPrintThermalLabel,
  onReportToBlacklist,
  externalSearchQuery
}) => {
  const { currentUser } = useAuth();
  const { packages, cities, companySettings, updatePackage, deletePackage, isPackagesLoading, refreshPackages, findBlacklistMatches } =
    useDatabase();
  const { translateStatus, isRtl } = useLanguage();

  const [search, setSearch] = useState('');

  useEffect(() => {
    if (externalSearchQuery?.query) {
      setSearch(externalSearchQuery.query);
    }
  }, [externalSearchQuery?.nonce, externalSearchQuery?.query]);

  const [statusFilter, setStatusFilter] = useState('all');
  const [isManualRefreshing, setIsManualRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [statusNotification, setStatusNotification] = useState<{ message: string; isError?: boolean } | null>(null);
  const [editingPackage, setEditingPackage] = useState<PackageItem | null>(null);
  const [deletingPackage, setDeletingPackage] = useState<PackageItem | null>(null);
  const [selectedMessagePackage, setSelectedMessagePackage] = useState<PackageItem | null>(null);
  const [selectedSupportPackage, setSelectedSupportPackage] = useState<PackageItem | null>(null);

  // Synchronisation périodique automatique (Étape 89 : Suivi en direct)
  useEffect(() => {
    const interval = setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible' && !isPackagesLoading) {
        refreshPackages().catch(() => {});
      }
    }, 20000);

    const onFocus = () => {
      if (!isPackagesLoading) {
        refreshPackages().catch(() => {});
      }
    };

    window.addEventListener('focus', onFocus);
    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', onFocus);
    };
  }, [refreshPackages, isPackagesLoading]);

  const handleRefresh = async () => {
    setIsManualRefreshing(true);
    setErrorMessage(null);
    try {
      await refreshPackages();
    } catch (err: any) {
      setErrorMessage(err.message || "Erreur lors de l'actualisation des colis.");
    } finally {
      setIsManualRefreshing(false);
    }
  };

  // Filter packages for this client only (strict isolation by user ID or shop ID)
  const myShopId = (currentUser as any)?.shopId;
  const myPackages = packages.filter(
    p =>
      p.clientId === currentUser?.id ||
      (Boolean(p.shopId) && (p.shopId === currentUser?.id || (Boolean(myShopId) && p.shopId === myShopId))) ||
      (Boolean(myShopId) && p.clientId === myShopId)
  );

  const filtered = myPackages.filter(p => {
    const matchesSearch =
      search === '' ||
      p.trackingNumber.toLowerCase().includes(search.toLowerCase()) ||
      p.recipientName.toLowerCase().includes(search.toLowerCase()) ||
      p.recipientPhone.includes(search) ||
      p.city.toLowerCase().includes(search.toLowerCase());

    const matchesStatus = statusFilter === 'all' || p.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingPackage) {
      updatePackage(editingPackage.id, {
        recipientName: editingPackage.recipientName,
        recipientPhone: editingPackage.recipientPhone,
        recipientPhone2: editingPackage.recipientPhone2,
        city: editingPackage.city,
        address: editingPackage.address,
        productPrice: editingPackage.productPrice,
        codAmount: editingPackage.codAmount,
        description: editingPackage.description,
        notes: editingPackage.notes
      });
      setEditingPackage(null);
    }
  };

  const handleExportCSV = () => {
    exportPackagesToCSV(filtered, `mes_colis_${new Date().toISOString().substring(0, 10)}.csv`);
  };

  const handleConfirmDelete = async () => {
    if (!deletingPackage) return;
    const target = deletingPackage;
    setDeletingPackage(null);
    const result = await deletePackage(
      target.id,
      'Suppression demandée par le marchand (Mes Colis)',
      currentUser ? { name: currentUser.name, role: currentUser.role, id: currentUser.id } : undefined
    );
    setStatusNotification({
      message: result.message,
      isError: !result.success
    });
    if (result.success) {
      setTimeout(() => setStatusNotification(null), 4000);
    }
  };

  return (
    <div className="space-y-5">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <h2 className="text-xl font-black text-slate-900 tracking-tight">
            Mes Colis Expédiés & Bordereaux
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Gérez vos expéditions, éditez vos étiquettes et suivez la livraison en temps réel
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleRefresh}
            disabled={isPackagesLoading || isManualRefreshing}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-xl shadow-2xs transition-colors disabled:opacity-50 cursor-pointer"
            title="Actualiser vos colis depuis Supabase Production"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-slate-600 ${isPackagesLoading || isManualRefreshing ? 'animate-spin' : ''}`} />
            <span>Actualiser</span>
          </button>

          <button
            onClick={handleExportCSV}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-xl shadow-2xs transition-colors cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 text-slate-600" />
            <span>Exporter CSV</span>
          </button>

          <button
            onClick={onOpenImportExcel || onOpenAddPackage}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 rounded-xl shadow-2xs transition-colors cursor-pointer"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
            <span>Importer Excel</span>
          </button>

          <button
            onClick={onOpenAddPackage}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-red-600 hover:bg-red-700 rounded-xl shadow-xs transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Nouveau Colis (Unitaire / Grille)</span>
          </button>
        </div>
      </div>

      {/* Status Notification */}
      {statusNotification && (
        <div
          className={`p-3.5 rounded-xl border text-xs flex items-center justify-between ${
            statusNotification.isError
              ? 'bg-rose-50 border-rose-200 text-rose-800'
              : 'bg-emerald-50 border-emerald-200 text-emerald-800 font-bold'
          }`}
        >
          <div className="flex items-center gap-2">
            {statusNotification.isError ? (
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            ) : (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            )}
            <span>{statusNotification.message}</span>
          </div>
          <button onClick={() => setStatusNotification(null)} className="p-1 opacity-70 hover:opacity-100 cursor-pointer">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Error Message Alert */}
      {errorMessage && (
        <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span className="font-medium">{errorMessage}</span>
          </div>
          <button
            onClick={handleRefresh}
            className="px-2.5 py-1 bg-white border border-rose-200 text-rose-700 font-bold rounded-lg hover:bg-rose-100 cursor-pointer"
          >
            Réessayer
          </button>
        </div>
      )}

      {/* Filter Tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
        <button
          onClick={() => setStatusFilter('all')}
          className={`px-3 py-1.5 rounded-lg font-bold shrink-0 transition-colors ${
            statusFilter === 'all'
              ? 'bg-slate-900 text-white'
              : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
          }`}
        >
          Tous mes colis ({myPackages.length})
        </button>

        {Object.entries(PACKAGE_STATUS_CONFIG).map(([key]) => {
          const count = myPackages.filter(p => p.status === key).length;
          if (count === 0 && statusFilter !== key) return null; // show active ones

          return (
            <button
              key={key}
              onClick={() => setStatusFilter(key)}
              className={`px-2.5 py-1.5 rounded-lg font-semibold shrink-0 transition-colors flex items-center gap-1.5 ${
                statusFilter === key
                  ? 'bg-red-600 text-white font-bold'
                  : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              <span>{translateStatus(key)}</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded-full font-mono bg-slate-100 text-slate-600">
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Search Input */}
      <div className="p-3 bg-white border border-slate-200 rounded-xl shadow-2xs flex items-center gap-3">
        <Search className="w-4 h-4 text-slate-400 ml-2" />
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Rechercher par N° de suivi (FAR-...), nom du client destinataire, téléphone..."
          className="flex-1 text-xs bg-transparent border-none focus:outline-none font-medium text-slate-900"
        />
      </div>

      {/* Packages Table */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-2xs overflow-hidden">
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
              <tr>
                <th className="py-3 px-4">N° Suivi</th>
                <th className="py-3 px-4">Destinataire</th>
                <th className="py-3 px-4">Ville & Adresse</th>
                <th className="py-3 px-4 text-right">Prix Produit</th>
                <th className="py-3 px-4 text-right">Frais Livraison</th>
                <th className="py-3 px-4 text-right font-black">Total CRBT</th>
                <th className="py-3 px-4">Statut</th>
                <th className="py-3 px-4 text-right sticky right-0 z-10 bg-slate-50 shadow-[-6px_0_12px_-6px_rgba(0,0,0,0.06)]">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isPackagesLoading || isManualRefreshing ? (
                <tr>
                  <td colSpan={8} className="py-16 text-center">
                    <div className="flex flex-col items-center justify-center gap-2.5">
                      <RefreshCw className="w-7 h-7 text-red-600 animate-spin" />
                      <span className="text-xs font-bold text-slate-800">
                        Chargement de vos colis depuis Supabase Production...
                      </span>
                      <span className="text-[11px] text-slate-400">
                        Isolation sécurisée appliquée à votre boutique marchande
                      </span>
                    </div>
                  </td>
                </tr>
              ) : myPackages.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-16 text-center">
                    <div className="w-14 h-14 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-3 text-slate-400">
                      <Package className="w-7 h-7 text-slate-400" />
                    </div>
                    <h3 className="text-base font-bold text-slate-800">Aucun colis enregistré</h3>
                    <p className="text-xs text-slate-500 max-w-md mx-auto mt-1">
                      Aucun colis n'est actuellement enregistré pour votre boutique dans Supabase Production.
                    </p>
                    <div className="mt-4 flex items-center justify-center gap-2">
                      <button
                        onClick={handleRefresh}
                        disabled={isPackagesLoading || isManualRefreshing}
                        className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors shadow-2xs cursor-pointer"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${isPackagesLoading || isManualRefreshing ? 'animate-spin' : ''}`} />
                        <span>Actualiser</span>
                      </button>
                      <button
                        onClick={onOpenAddPackage}
                        className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors shadow-xs cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Créer un colis</span>
                      </button>
                    </div>
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    Aucun colis ne correspond à vos critères de recherche.
                  </td>
                </tr>
              ) : (
                filtered.map(pkg => {
                  const config = PACKAGE_STATUS_CONFIG[pkg.status] || {
                    label: pkg.status || 'Inconnu',
                    badgeClass: 'bg-slate-100 text-slate-700'
                  };
                  // Can only edit if still in 'nouveau' or 'attente_ramassage' before carrier pickup!
                  const canEdit = ['nouveau', 'attente_ramassage'].includes(pkg.status);

                  return (
                    <tr key={pkg.id} className="hover:bg-slate-50">
                      <td className="py-3 px-4">
                        <span className="font-mono font-bold text-slate-900 block">{pkg.trackingNumber}</span>
                        <span className="text-[10px] text-slate-400 font-mono block">
                          {(pkg.createdAt || '').substring(0, 10)}
                        </span>
                      </td>

                      <td className="py-3 px-4">
                        <span className="font-bold text-slate-900 block">{pkg.recipientName}</span>
                        <span className="font-mono text-red-600 text-xs font-semibold block">{pkg.recipientPhone}</span>
                        {(() => {
                          const bl = findBlacklistMatches(pkg.recipientPhone);
                          if (bl.reportCount === 0) return null;
                          return (
                            <span
                              title={`هاد الزبون فاللائحة السوداء (${bl.reportCount}): ${bl.latestComment}`}
                              className="mt-1 inline-flex items-center gap-1 px-2 py-0.5 rounded bg-rose-100 border border-rose-300 text-rose-800 text-[10px] font-black"
                            >
                              <ShieldAlert className="w-3 h-3 shrink-0" />
                              <span>اللائحة السوداء ({bl.reportCount})</span>
                            </span>
                          );
                        })()}
                        {hasValidRecipientWhatsApp(pkg.recipientPhone) && (
                          <a
                            href={buildRecipientConfirmationWhatsAppUrl(pkg, companySettings?.companyName)}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={e => e.stopPropagation()}
                            title="إرسال رسالة تأكيد الطلبية للزبون عبر واتساب"
                            className={`mt-1 inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold transition-colors ${
                              isPendingConfirmationStatus(pkg.status)
                                ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-2xs'
                                : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200'
                            }`}
                          >
                            <MessageCircle className="w-3 h-3 shrink-0" />
                            <span>تأكيد الزبون (واتساب)</span>
                          </a>
                        )}
                      </td>

                      <td className="py-3 px-4 max-w-[200px]">
                        <span className="font-bold text-slate-800 block">{pkg.city}</span>
                        <span className="text-slate-500 text-[11px] truncate block">{pkg.address}</span>
                      </td>

                      <td className="py-3 px-4 text-right font-mono text-slate-700">
                        {formatMAD(pkg.productPrice)}
                      </td>

                      <td className="py-3 px-4 text-right font-mono text-slate-500">
                        {formatMAD(pkg.deliveryFee)}
                      </td>

                      <td className="py-3 px-4 text-right font-mono font-black text-slate-900 tabular-nums">
                        {formatMAD(pkg.codAmount)}
                      </td>

                      <td className="py-3 px-4">
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${config.badgeClass}`}>
                          {translateStatus(pkg.status)}
                        </span>
                        {pkg.currentAgency &&
                          ['en_stock', 'arrive_destination', 'ramasse', 'en_transit'].includes(pkg.status) && (
                            <span className="mt-1 inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                              <Warehouse className="w-3 h-3 shrink-0" />
                              <span>فلاجونص: {pkg.currentAgency}</span>
                            </span>
                          )}
                        {pkg.isPaidToClient && (
                          <span className="block text-[10px] text-emerald-600 font-bold mt-0.5">
                            ✓ Virement effectué
                          </span>
                        )}
                      </td>

                      <td className="py-3 px-4 text-right sticky right-0 z-10 bg-white shadow-[-6px_0_12px_-6px_rgba(0,0,0,0.06)]">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Thermal Label Print */}
                          <button
                            onClick={() => onPrintThermalLabel(pkg)}
                            title="Imprimer l'étiquette thermique (100x150 mm)"
                            className="p-1.5 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                          >
                            <Printer className="w-4 h-4" />
                          </button>

                          {/* Edit before pickup */}
                          {canEdit && (
                            <button
                              onClick={() => setEditingPackage(pkg)}
                              title="تعديل الكموند (Modifier avant prise en charge)"
                              className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-lg transition-colors cursor-pointer"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                              <span>تعديل</span>
                            </button>
                          )}

                          {/* Delete before pickup */}
                          {['nouveau', 'attente_ramassage', 'annule'].includes(pkg.status) && (
                            <button
                              onClick={() => setDeletingPackage(pkg)}
                              title="حذف الكموند نهائياً من كلشي (Supprimer le colis)"
                              className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg transition-colors cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              <span>حذف</span>
                            </button>
                          )}

                          {/* Support WhatsApp régional / Réclamation sur ce colis */}
                          <button
                            onClick={() => setSelectedSupportPackage(pkg)}
                            title="Contacter le support WhatsApp de la région de cette commande"
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold text-white bg-[#1f9d55] hover:bg-[#198748] rounded-lg shadow-2xs transition-colors cursor-pointer"
                          >
                            <MessageCircle className="w-3.5 h-3.5 shrink-0" />
                            <span className="hidden xl:inline">Contacter le support</span>
                            <span className="xl:hidden">Support</span>
                            {isRtl ? (
                              <ChevronLeft className="w-3 h-3 shrink-0" />
                            ) : (
                              <ChevronRight className="w-3 h-3 shrink-0" />
                            )}
                          </button>

                          {/* Report to Blacklist */}
                          {onReportToBlacklist && (
                            <button
                              onClick={() => onReportToBlacklist(pkg)}
                              title="إضافة هذا الزبون للائحة السوداء (Blacklist)"
                              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                            >
                              <Ban className="w-4 h-4" />
                            </button>
                          )}

                          {/* Tracking Details */}
                          <button
                            onClick={() => onViewPackage(pkg)}
                            title="Voir historique et statut"
                            className="px-2.5 py-1 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
                          >
                            Suivre
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile Cards View */}
        <div className="block md:hidden divide-y divide-slate-100">
          {filtered.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-400">Aucun colis trouvé</div>
          ) : (
            filtered.map(pkg => {
              const config = PACKAGE_STATUS_CONFIG[pkg.status] || {
                label: pkg.status || 'Inconnu',
                badgeClass: 'bg-slate-100 text-slate-700'
              };
              const canEdit = ['nouveau', 'attente_ramassage'].includes(pkg.status);
              const canDelete = ['nouveau', 'attente_ramassage', 'annule'].includes(pkg.status);
              return (
                <div key={pkg.id} className="p-4 space-y-2.5 bg-white">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="font-mono font-bold text-slate-900 text-sm block">{pkg.trackingNumber}</span>
                      <span className="text-[11px] text-slate-500">{(pkg.createdAt || '').substring(0, 10)}</span>
                    </div>
                    <div className="text-right">
                      <span className="font-mono font-black text-slate-900 text-sm block">{formatMAD(pkg.codAmount)}</span>
                      <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold mt-0.5 ${config.badgeClass}`}>
                        {translateStatus(pkg.status)}
                      </span>
                      {pkg.currentAgency &&
                        ['en_stock', 'arrive_destination', 'ramasse', 'en_transit'].includes(pkg.status) && (
                          <span className="mt-1 inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                            <Warehouse className="w-3 h-3 shrink-0" />
                            <span>فلاجونص: {pkg.currentAgency}</span>
                          </span>
                        )}
                    </div>
                  </div>
                  <div className="bg-slate-50 p-2.5 rounded-xl text-xs space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-900">{pkg.recipientName}</span>
                      <span className="font-mono text-red-600 font-semibold">{pkg.recipientPhone}</span>
                    </div>
                    <div className="text-[11px] text-slate-600">{pkg.city} — {pkg.address}</div>
                  </div>
                  <div className="flex items-center justify-between gap-1.5 pt-1 flex-wrap">
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => onPrintThermalLabel(pkg)}
                        className="p-1.5 text-slate-600 bg-slate-100 rounded-lg cursor-pointer"
                        title="Imprimer"
                      >
                        <Printer className="w-4 h-4 text-red-600" />
                      </button>
                      {canEdit && (
                        <button
                          onClick={() => setEditingPackage(pkg)}
                          className="inline-flex items-center gap-1 px-2 py-1.5 text-[11px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 rounded-lg cursor-pointer"
                          title="تعديل الكموند"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                          <span>تعديل</span>
                        </button>
                      )}
                      {canDelete && (
                        <button
                          onClick={() => setDeletingPackage(pkg)}
                          className="inline-flex items-center gap-1 px-2 py-1.5 text-[11px] font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg cursor-pointer"
                          title="حذف الكموند نهائياً من كلشي"
                        >
                          <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                          <span>حذف</span>
                        </button>
                      )}
                      {onReportToBlacklist && (
                        <button
                          onClick={() => onReportToBlacklist(pkg)}
                          className="p-1.5 text-slate-500 bg-slate-100 rounded-lg cursor-pointer"
                          title="لائحة سوداء"
                        >
                          <Ban className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                    <button
                      onClick={() => onViewPackage(pkg)}
                      className="px-3 py-1.5 text-xs font-bold text-slate-700 bg-slate-100 rounded-lg cursor-pointer"
                    >
                      Suivre
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer info bar */}
        <div className="p-3.5 border-t border-slate-100 bg-slate-50 text-xs text-slate-500 flex justify-between items-center">
          <span>
            Affichage de <strong>{filtered.length}</strong> sur <strong>{myPackages.length}</strong> colis
          </span>
          <span className="font-mono">
            Total CRBT filtré : <strong>{formatMAD(filtered.reduce((acc, p) => acc + (p.codAmount || 0), 0))}</strong>
          </span>
        </div>
      </div>

      {/* Edit Package Modal (Before Pickup) */}
      {editingPackage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs no-print">
          <div className="relative w-full max-w-xl bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Modifier le Colis {editingPackage.trackingNumber}
                </h3>
                <p className="text-xs text-slate-500">
                  Possible uniquement avant la prise en charge par le transporteur
                </p>
              </div>
              <button onClick={() => setEditingPackage(null)} className="p-2 text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="p-6 overflow-y-auto space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Destinataire *</label>
                  <input
                    type="text"
                    required
                    value={editingPackage.recipientName}
                    onChange={e => setEditingPackage({ ...editingPackage, recipientName: e.target.value })}
                    className="w-full text-xs bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-900"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Téléphone *</label>
                  <input
                    type="tel"
                    required
                    value={editingPackage.recipientPhone}
                    onChange={e => setEditingPackage({ ...editingPackage, recipientPhone: e.target.value })}
                    className="w-full text-xs font-mono bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-900"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Ville de destination</label>
                <select
                  value={editingPackage.city}
                  onChange={e => setEditingPackage({ ...editingPackage, city: e.target.value })}
                  className="w-full text-xs bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-900"
                >
                  {cities.map(c => (
                    <option key={c.id} value={c.name}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Adresse complète</label>
                <textarea
                  rows={2}
                  value={editingPackage.address}
                  onChange={e => setEditingPackage({ ...editingPackage, address: e.target.value })}
                  className="w-full text-xs bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-900"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Montant à encaisser (MAD)</label>
                  <input
                    type="number"
                    min="0"
                    step="5"
                    value={editingPackage.codAmount}
                    onChange={e => {
                      const val = parseFloat(e.target.value) || 0;
                      setEditingPackage({ ...editingPackage, codAmount: val, productPrice: val });
                    }}
                    className="w-full text-xs font-mono font-bold bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-900"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Remarques</label>
                  <input
                    type="text"
                    value={editingPackage.notes || ''}
                    onChange={e => setEditingPackage({ ...editingPackage, notes: e.target.value })}
                    placeholder="Horaires, instructions..."
                    className="w-full text-xs bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-900"
                  />
                </div>
              </div>

              <div className="pt-3 border-t flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditingPackage(null)}
                  className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-xl shadow-xs"
                >
                  Enregistrer les modifications
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* WhatsApp Regional Support Modal */}
      <OrderWhatsAppSupportModal
        isOpen={Boolean(selectedSupportPackage)}
        onClose={() => setSelectedSupportPackage(null)}
        packageItem={selectedSupportPackage}
        onOpenInternalMessage={pkg => setSelectedMessagePackage(pkg)}
      />

      {/* Message Modal */}
      <CreateClientMessageModal
        isOpen={Boolean(selectedMessagePackage)}
        onClose={() => setSelectedMessagePackage(null)}
        preselectedPackage={selectedMessagePackage}
      />

      {/* Delete Package Confirmation Modal */}
      {deletingPackage && (
        <ConfirmActionModal
          isOpen={Boolean(deletingPackage)}
          title="حذف الكموند نهائياً من كلشي"
          description={`هل أنت متأكد من حذف الكوليا ${deletingPackage.trackingNumber} (${deletingPackage.recipientName} - ${deletingPackage.city}) نهائياً من كلشي (قاعدة البيانات، البونات، السطوك والرسائل)؟ لا يمكن التراجع عن هذا الإجراء.`}
          confirmLabel="حذف نهائي من كلشي"
          requireReason={false}
          onConfirm={() => void handleConfirmDelete()}
          onClose={() => setDeletingPackage(null)}
        />
      )}
    </div>
  );
};
