import React, { useState } from 'react';
import {
  PackageItem,
  PackageStatus,
  PACKAGE_STATUS_CONFIG,
  UserRole
} from '../types';
import { useDatabase } from '../context/DatabaseContext';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../i18n/LanguageContext';
import { formatMAD } from '../utils/barcode';
import { suggestDriversForTarget } from '../utils/driverMatcher';
import {
  buildRecipientConfirmationWhatsAppUrl,
  hasValidRecipientWhatsApp
} from '../utils/supportWhatsApp';
import {
  X,
  Printer,
  Truck,
  MapPin,
  Clock,
  ArrowRightLeft,
  ChevronDown,
  MessageSquare,
  AlertTriangle,
  Camera,
  CheckCircle2,
  Zap,
  Sparkles,
  ZoomIn,
  MessageCircle,
  ChevronLeft,
  ChevronRight,
  Trash2,
  Edit2,
  Copy,
  Check
} from 'lucide-react';
import {
  buildLiveTrackingUrl,
  buildWhatsAppDirectLink,
  renderWhatsAppStatusMessage
} from '../utils/trackingNotifications';
import { CreateClientMessageModal } from './client/CreateClientMessageModal';
import { OrderWhatsAppSupportModal } from './client/OrderWhatsAppSupportModal';
import { ConfirmActionModal } from './common/ConfirmActionModal';
import { EditPackageModal } from './common/EditPackageModal';
import { PartnerDeliveryChoiceModal, PartnerDeliveryChoiceResult } from './common/PartnerDeliveryChoiceModal';
import { hasEmployeePermission } from '../utils/employeePermissions';
import {
  getPartnerFeeForPackage,
  isPackageAssignedToPartner,
  resolvePackagePartner
} from '../utils/partnerTariffs';

interface PackageDetailsModalProps {
  packageItem: PackageItem | null;
  isOpen: boolean;
  onClose: () => void;
  onOpenThermalLabel: (pkg: PackageItem) => void;
}

export const PackageDetailsModal: React.FC<PackageDetailsModalProps> = ({
  packageItem: initialPackageItem,
  isOpen,
  onClose,
  onOpenThermalLabel
}) => {
  const {
    users,
    cities,
    packages,
    partners,
    agencies,
    companySettings,
    updatePackage,
    changePackageStatus,
    assignPackageToDriver,
    transferPackageAgency,
    resolvePackageProblem,
    deletePackage
  } = useDatabase();
  const { currentUser, isClient, isAdmin, isEmployee } = useAuth();
  const { translateStatus, isRtl } = useLanguage();

  const packageItem = initialPackageItem
    ? packages.find(p => p.id === initialPackageItem.id) || initialPackageItem
    : null;

  const [selectedStatus, setSelectedStatus] = useState<PackageStatus>(packageItem?.status || 'nouveau');
  const [statusComment, setStatusComment] = useState('');
  const [showStatusChanger, setShowStatusChanger] = useState(false);

  const [selectedDriverId, setSelectedDriverId] = useState('');
  const [showDriverAssign, setShowDriverAssign] = useState(false);

  const [selectedAgency, setSelectedAgency] = useState('');
  const [showTransfer, setShowTransfer] = useState(false);
  const [isMessageModalOpen, setIsMessageModalOpen] = useState(false);
  const [isSupportModalOpen, setIsSupportModalOpen] = useState(false);

  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [statusFeedback, setStatusFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [zoomedPhotoUrl, setZoomedPhotoUrl] = useState<string | null>(null);
  const [resolveNote, setResolveNote] = useState('');
  const [isResolvingProblem, setIsResolvingProblem] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeletingPkg, setIsDeletingPkg] = useState(false);
  const [showPartnerDeliveryModal, setShowPartnerDeliveryModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editFeedback, setEditFeedback] = useState<string | null>(null);
  const [copiedLiveLink, setCopiedLiveLink] = useState(false);

  if (!isOpen || !packageItem) return null;

  const currentConfig = PACKAGE_STATUS_CONFIG[packageItem.status] || {
    label: packageItem.status,
    badgeClass: 'bg-slate-100 text-slate-700 border border-slate-200',
    dotColor: '#64748b'
  };
  const drivers = users.filter(u => u.role === 'driver');
  const driverSuggestions = suggestDriversForTarget({
    targetCity: packageItem.city,
    targetAddress: packageItem.address,
    drivers,
    cities,
    packages
  });
  const topSuggestedDriver = driverSuggestions[0] || null;
  const problemPhoto = packageItem.problemReport?.photoBase64 || packageItem.callProofUrl;
  const canEditPackage =
    isAdmin ||
    (isEmployee && hasEmployeePermission(currentUser, 'can_edit')) ||
    (isClient && ['nouveau', 'attente_ramassage'].includes(packageItem.status));
  const canDeletePackage =
    isAdmin ||
    (isEmployee && hasEmployeePermission(currentUser, 'can_delete')) ||
    (isClient && ['nouveau', 'attente_ramassage', 'annule'].includes(packageItem.status));

  const handleConfirmDeletePackage = async (reason?: string) => {
    setShowDeleteConfirm(false);
    setIsDeletingPkg(true);
    setStatusFeedback(null);
    try {
      const res = await deletePackage(
        packageItem.id,
        reason || 'Suppression depuis les détails du colis',
        currentUser ? { name: currentUser.name, role: currentUser.role, id: currentUser.id } : undefined
      );
      if (res.success) {
        onClose();
      } else {
        setStatusFeedback({ type: 'error', message: res.message || 'تعذر مسح الكوليا.' });
      }
    } catch (err: any) {
      setStatusFeedback({ type: 'error', message: err?.message || 'تعذر مسح الكوليا.' });
    } finally {
      setIsDeletingPkg(false);
    }
  };

  const handleUpdateStatus = async () => {
    if (
      !isClient &&
      selectedStatus === 'livre' &&
      packageItem.status !== 'livre' &&
      isPackageAssignedToPartner(packageItem, partners)
    ) {
      setShowPartnerDeliveryModal(true);
      return;
    }

    setIsUpdatingStatus(true);
    setStatusFeedback(null);
    try {
      const res = await changePackageStatus(
        packageItem.id,
        selectedStatus,
        statusComment || `Statut mis à jour vers ${PACKAGE_STATUS_CONFIG[selectedStatus]?.label || selectedStatus}`,
        currentUser?.city || packageItem.currentAgency,
        currentUser ? { name: currentUser.name, role: currentUser.role } : undefined
      );

      if (res && res.error) {
        setStatusFeedback({ type: 'error', message: res.error });
      } else {
        setStatusFeedback({
          type: 'success',
          message: res?.message || `Statut mis à jour avec succès et enregistré dans Supabase Production.`
        });
        setTimeout(() => {
          setShowStatusChanger(false);
          setStatusComment('');
          setStatusFeedback(null);
        }, 1400);
      }
    } catch (err: any) {
      setStatusFeedback({ type: 'error', message: err.message || 'Erreur lors de la mise à jour du statut.' });
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const handleConfirmPartnerDelivery = async (result: PartnerDeliveryChoiceResult) => {
    const matchedPartner = resolvePackagePartner(packageItem, partners);
    const partnerLabel = matchedPartner?.name || packageItem.partnerName || packageItem.destinationAgency || 'الشريك';

    setIsUpdatingStatus(true);
    setStatusFeedback(null);
    try {
      updatePackage(
        packageItem.id,
        {
          deliveredBy: result.deliveredBy,
          partnerDeliveryFee: result.deliveredBy === 'partner' ? result.partnerFee : 0
        },
        currentUser ? { name: currentUser.name, role: currentUser.role, id: currentUser.id } : undefined
      );

      const comment =
        statusComment.trim() ||
        (result.deliveredBy === 'partner'
          ? `تم التوصيل من طرف الشريك (${partnerLabel}) — أتعاب الشريك: ${result.partnerFee} DH | الربح الصافي: ${result.profit} DH`
          : `تم التوصيل من طرف الإدارة (FARIOUSY) — أتعاب الشريك: 0 DH | الربح الصافي: ${result.profit} DH`);

      const res = await changePackageStatus(
        packageItem.id,
        'livre',
        comment,
        currentUser?.city || packageItem.currentAgency,
        currentUser ? { name: currentUser.name, role: currentUser.role } : undefined
      );

      setShowPartnerDeliveryModal(false);

      if (res && res.error) {
        setStatusFeedback({ type: 'error', message: res.error });
      } else {
        setStatusFeedback({
          type: 'success',
          message:
            result.deliveredBy === 'partner'
              ? `تم التسليم من طرف الشريك (${partnerLabel}) — توصيل الشريك: ${result.partnerFee} DH | ربحك الصافي: +${result.profit} DH`
              : `تم التسليم من طرف الإدارة — أتعاب الشريك: 0 DH | ربحك الصافي: +${result.profit} DH`
        });
        setTimeout(() => {
          setShowStatusChanger(false);
          setStatusComment('');
          setStatusFeedback(null);
        }, 2200);
      }
    } catch (err: any) {
      setShowPartnerDeliveryModal(false);
      setStatusFeedback({ type: 'error', message: err.message || 'Erreur lors de la mise à jour.' });
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const handleAssignDriver = () => {
    const driver = drivers.find(d => d.id === selectedDriverId);
    if (driver) {
      assignPackageToDriver(
        packageItem.id,
        driver.id,
        driver.name,
        false,
        currentUser ? { name: currentUser.name, role: currentUser.role } : undefined
      );
      setShowDriverAssign(false);
    }
  };

  const handleTransfer = () => {
    if (selectedAgency) {
      transferPackageAgency(
        packageItem.id,
        selectedAgency,
        undefined,
        `Transfert de ${packageItem.currentAgency} vers ${selectedAgency}`,
        currentUser ? { name: currentUser.name, role: currentUser.role } : undefined
      );
      setShowTransfer(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2.5 sm:p-4 bg-black/60 backdrop-blur-xs no-print">
      <div className="relative w-full max-w-3xl bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92dvh]">
        {/* Header */}
        <div className="shrink-0 flex flex-wrap items-center justify-between gap-2 px-3.5 py-3 sm:px-6 sm:py-4 border-b border-slate-100 bg-slate-50">
          <div className="flex flex-wrap items-center gap-2 sm:gap-3 min-w-0">
            <span className="text-base sm:text-xl font-mono font-extrabold text-slate-900 force-ltr">
              {packageItem.trackingNumber}
            </span>
            <span className={`px-2.5 py-0.5 sm:px-3 sm:py-1 rounded-full text-[11px] sm:text-xs font-bold ${currentConfig.badgeClass}`}>
              {translateStatus(packageItem.status)}
            </span>
          </div>
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            <button
              type="button"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(
                    buildLiveTrackingUrl(packageItem.trackingNumber, companySettings.website)
                  );
                  setCopiedLiveLink(true);
                  setTimeout(() => setCopiedLiveLink(false), 2000);
                } catch {}
              }}
              title="نسخ رابط التتبع المباشر"
              className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg shadow-2xs transition-colors cursor-pointer"
            >
              {copiedLiveLink ? (
                <Check className="w-3.5 h-3.5 text-emerald-600" />
              ) : (
                <Copy className="w-3.5 h-3.5 text-slate-600" />
              )}
              <span className="hidden md:inline">{copiedLiveLink ? 'تم النسخ' : 'رابط التتبع'}</span>
            </button>
            <a
              href={buildWhatsAppDirectLink(
                packageItem.recipientPhone,
                renderWhatsAppStatusMessage(companySettings.whatsappCustomTemplate, {
                  companyName: companySettings.companyName,
                  trackingNumber: packageItem.trackingNumber,
                  recipientName: packageItem.recipientName,
                  status: packageItem.status,
                  statusLabel: translateStatus(packageItem.status),
                  city: packageItem.city,
                  codAmount: packageItem.codAmount,
                  driverName: packageItem.driverName,
                  trackingUrl: buildLiveTrackingUrl(packageItem.trackingNumber, companySettings.website)
                })
              )}
              target="_blank"
              rel="noopener noreferrer"
              title="إرسال تحديث الحالة عبر واتساب"
              className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-2xs transition-colors"
            >
              <MessageCircle className="w-3.5 h-3.5" />
              <span className="hidden md:inline">إشعار واتساب</span>
            </a>
            <button
              type="button"
              onClick={() => onOpenThermalLabel(packageItem)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 sm:px-3 text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg shadow-2xs transition-colors cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5 text-red-600" />
              <span className="hidden sm:inline">Imprimer l'étiquette</span>
              <span className="sm:hidden">Étiquette</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 sm:p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 min-h-0 p-3.5 sm:p-6 overflow-y-auto overscroll-contain space-y-5 sm:space-y-6">
          {editFeedback && (
            <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{editFeedback}</span>
              </div>
              <button
                type="button"
                onClick={() => setEditFeedback(null)}
                className="p-1 text-emerald-700 hover:bg-emerald-100 rounded-lg cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Delivery Problem Alert Banner with Photo (مشكلة في التوصيل) */}
          {(packageItem.problemReport || packageItem.status === 'probleme_livraison' || problemPhoto) && (
            <div className={`p-4 rounded-xl border-2 shadow-xs space-y-3 ${
              packageItem.problemReport?.resolved
                ? 'bg-emerald-50 border-emerald-300'
                : 'bg-red-50 border-red-400'
            }`}>
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className={`p-2 rounded-xl shrink-0 ${
                    packageItem.problemReport?.resolved ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white'
                  }`}>
                    {packageItem.problemReport?.resolved ? (
                      <CheckCircle2 className="w-5 h-5" />
                    ) : (
                      <AlertTriangle className="w-5 h-5" />
                    )}
                  </div>
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`text-xs font-black px-2 py-0.5 rounded ${
                        packageItem.problemReport?.resolved
                          ? 'bg-emerald-200 text-emerald-950'
                          : 'bg-red-600 text-white'
                      }`}>
                        {packageItem.problemReport?.resolved
                          ? '✓ تمت معالجة مشكلة التوصيل'
                          : '🚨 تقرير مشكلة في التوصيل (مبلغ من السائق)'}
                      </span>
                      {packageItem.problemReport?.categoryLabel && (
                        <span className="text-xs font-bold text-slate-900 bg-white border border-red-200 px-2 py-0.5 rounded">
                          {packageItem.problemReport.categoryLabel}
                        </span>
                      )}
                    </div>
                    <p className="text-xs font-semibold text-slate-900">
                      {packageItem.problemReport?.description || packageItem.driverComment || 'تم الإبلاغ عن إشكال أثناء التوصيل'}
                    </p>
                    <div className="text-[11px] text-slate-600 flex flex-wrap items-center gap-3">
                      {packageItem.problemReport?.reportedBy && (
                        <span>السائق : <strong>{packageItem.problemReport.reportedBy}</strong></span>
                      )}
                      {packageItem.problemReport?.reportedAt && (
                        <span className="font-mono">
                          {new Date(packageItem.problemReport.reportedAt).toLocaleString('fr-FR')}
                        </span>
                      )}
                    </div>
                    {packageItem.problemReport?.resolved && packageItem.problemReport?.adminNote && (
                      <div className="text-[11px] text-emerald-900 bg-white/80 border border-emerald-200 px-2.5 py-1.5 rounded-lg mt-1">
                        ملاحظة الإدارة ({packageItem.problemReport.resolvedBy}) : {packageItem.problemReport.adminNote}
                      </div>
                    )}
                  </div>
                </div>

                {problemPhoto && (
                  <button
                    type="button"
                    onClick={() => setZoomedPhotoUrl(problemPhoto)}
                    className="group relative shrink-0 rounded-xl overflow-hidden border-2 border-red-300 bg-black w-28 h-24 cursor-pointer shadow-xs"
                    title="اضغط لتكبير الصورة"
                  >
                    <img src={problemPhoto} alt="صورة المشكلة" className="w-full h-full object-cover group-hover:opacity-85 transition" />
                    <span className="absolute bottom-1 right-1 bg-black/75 text-white text-[9px] px-1.5 py-0.5 rounded flex items-center gap-1 font-bold">
                      <ZoomIn className="w-3 h-3" />
                      تكبير
                    </span>
                  </button>
                )}
              </div>

              {!isClient && !packageItem.problemReport?.resolved && (
                <div className="pt-2 border-t border-red-200 flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                  <input
                    type="text"
                    value={resolveNote}
                    onChange={e => setResolveNote(e.target.value)}
                    placeholder="ملاحظة المعالجة (اختياري): مثلاً تم التواصل مع الزبون وإعادة التوجيه..."
                    className="flex-1 text-xs bg-white border border-red-200 rounded-lg px-3 py-1.5 text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                  <button
                    type="button"
                    disabled={isResolvingProblem}
                    onClick={async () => {
                      setIsResolvingProblem(true);
                      try {
                        await resolvePackageProblem(
                          packageItem.id,
                          resolveNote.trim() || undefined,
                          currentUser?.name || 'Administrateur'
                        );
                        setResolveNote('');
                      } finally {
                        setIsResolvingProblem(false);
                      }
                    }}
                    className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-bold rounded-lg flex items-center justify-center gap-1.5 shrink-0 cursor-pointer"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>{isResolvingProblem ? 'جاري التأكيد...' : 'تأكيد معالجة المشكلة'}</span>
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Delivery Options Strip (Ouvrir le colis / Essayage / Échange / Attention FRAGILE) */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            <div className={`p-3 rounded-xl border flex items-center justify-between ${packageItem.allowOpen ? 'bg-emerald-50 border-emerald-200' : 'bg-slate-50 border-slate-200'}`}>
              <div>
                <span className="text-[11px] font-bold text-slate-600 block">Ouvrir le colis</span>
                <span className="text-[10px] text-slate-400">فتح الطرد</span>
              </div>
              <span className={`px-2 py-0.5 rounded-md text-xs font-black ${packageItem.allowOpen ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-700'}`}>
                {packageItem.allowOpen ? 'Oui' : 'Non'}
              </span>
            </div>

            <div className={`p-3 rounded-xl border flex items-center justify-between ${packageItem.allowTry ? 'bg-blue-50 border-blue-200' : 'bg-slate-50 border-slate-200'}`}>
              <div>
                <span className="text-[11px] font-bold text-slate-600 block">Essayage</span>
                <span className="text-[10px] text-slate-400">القياس</span>
              </div>
              <span className={`px-2 py-0.5 rounded-md text-xs font-black ${packageItem.allowTry ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-700'}`}>
                {packageItem.allowTry ? 'Oui' : 'Non'}
              </span>
            </div>

            <div className={`p-3 rounded-xl border flex items-center justify-between ${packageItem.isExchange ? 'bg-amber-50 border-amber-300' : 'bg-slate-50 border-slate-200'}`}>
              <div>
                <span className="text-[11px] font-bold text-slate-600 block">Échange</span>
                <span className="text-[10px] text-slate-400">استبدال</span>
              </div>
              <span className={`px-2 py-0.5 rounded-md text-xs font-black ${packageItem.isExchange ? 'bg-amber-600 text-white' : 'bg-slate-200 text-slate-700'}`}>
                {packageItem.isExchange ? 'Oui' : 'Non'}
              </span>
            </div>

            <div className={`p-3 rounded-xl border flex items-center justify-between ${packageItem.isFragile ? 'bg-rose-50 border-rose-300' : 'bg-slate-50 border-slate-200'}`}>
              <div>
                <span className="text-[11px] font-bold text-slate-700 block">Attention FRAGILE</span>
                <span className="text-[10px] text-slate-400">قابل للكسر</span>
              </div>
              <span className={`px-2 py-0.5 rounded-md text-xs font-black ${packageItem.isFragile ? 'bg-rose-600 text-white' : 'bg-slate-200 text-slate-700'}`}>
                {packageItem.isFragile ? 'Oui' : 'Non'}
              </span>
            </div>
          </div>

          {/* Fragile Warning Banner (طرد قابل للكسر) */}
          {packageItem.isFragile && (
            <div className="p-3.5 bg-rose-50 border-2 border-rose-400 rounded-xl flex items-center gap-3 shadow-xs">
              <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />
              <div className="flex-1 text-xs">
                <span className="font-black uppercase tracking-wider text-rose-900 bg-rose-200 px-2 py-0.5 rounded mr-2">
                  ATTENTION FRAGILE
                </span>
                <span className="font-bold text-rose-900">
                  طرد قابل للكسر — يُرجى التعامل معه بعناية فائقة أثناء الفرز والنقل والتسليم.
                </span>
              </div>
            </div>
          )}

          {/* Exchange Warning Banner (طرد استبدال) */}
          {packageItem.isExchange && (
            <div className="p-4 bg-amber-50 border-2 border-amber-400 rounded-xl flex items-start gap-3 shadow-xs">
              <span className="text-2xl shrink-0">🔄</span>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-black uppercase tracking-wider text-amber-900 bg-amber-200 px-2 py-0.5 rounded">
                    طرد استبدال (Colis d'échange / Change)
                  </span>
                  {packageItem.exchangeTrackingNumber && (
                    <span className="text-xs font-mono font-bold text-amber-950 bg-white border border-amber-300 px-2 py-0.5 rounded">
                      رقم الطرد المسترجع : {packageItem.exchangeTrackingNumber}
                    </span>
                  )}
                </div>
                <div className="mt-1 text-xs text-amber-900 font-semibold">
                  <span>سبب الاستبدال : </span>
                  <span className="font-bold">{packageItem.exchangeReason || 'Non précisé'}</span>
                  {packageItem.exchangeItemDescription && (
                    <span className="mr-2"> | المنتوج المسترجع : <strong>{packageItem.exchangeItemDescription}</strong></span>
                  )}
                </div>
                <div className="text-[11px] text-amber-800 mt-1">
                  تنبيه لليفرور : يجب استلام الطرد القديم من الزبون قبل تسليمه هذا الطرد.
                </div>
              </div>
            </div>
          )}

          {/* Warehouse Stock Position Banner (ربط السطوك) */}
          {packageItem.stockPosition && (
            <div className="p-3 bg-indigo-50 border border-indigo-200 rounded-xl flex items-center justify-between text-xs text-indigo-900 shadow-2xs">
              <div className="flex items-center gap-2">
                <span className="text-lg">📦</span>
                <div>
                  <span className="font-bold text-indigo-950 block">موقع الطرد في السطوك (Emplacement Stock Magasin) :</span>
                  <span className="font-mono font-semibold text-indigo-700">{packageItem.stockPosition}</span>
                </div>
              </div>
              <span className="bg-indigo-600 text-white font-bold text-[10px] px-2 py-1 rounded-md">
                سطوك مربوط
              </span>
            </div>
          )}

          {/* Quick Info Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Destinataire */}
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-2">
                Destinataire
              </span>
              <div className="font-bold text-sm text-slate-900">{packageItem.recipientName}</div>
              <div className="font-mono text-xs text-red-600 font-semibold my-1">
                📞 {packageItem.recipientPhone}
              </div>
              <div className="text-xs text-slate-600 flex items-start gap-1 mt-1">
                <MapPin className="w-3.5 h-3.5 shrink-0 mt-0.5 text-slate-400" />
                <span>
                  <strong className="text-slate-900">{packageItem.city}</strong> — {packageItem.address}
                </span>
              </div>
              {hasValidRecipientWhatsApp(packageItem.recipientPhone) && (
                <a
                  href={buildRecipientConfirmationWhatsAppUrl(packageItem, companySettings?.companyName)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-3 w-full inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-2xs transition-colors"
                >
                  <MessageCircle className="w-3.5 h-3.5 shrink-0" />
                  <span>تأكيد الطلبية عبر واتساب</span>
                </a>
              )}
            </div>

            {/* Expéditeur / Client */}
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-2">
                Expéditeur (Client)
              </span>
              <div className="font-bold text-sm text-slate-900">
                {packageItem.clientCompany || packageItem.clientName}
              </div>
              <div className="text-xs text-slate-600 font-mono my-1">📞 {packageItem.clientPhone}</div>
              <div className="text-xs text-slate-600 mt-1">
                Agence actuelle : <span className="font-semibold text-slate-800">{packageItem.currentAgency}</span>
              </div>
              {packageItem.driverName && (
                <div className="text-xs text-slate-700 mt-1 flex items-center gap-1 font-medium">
                  <Truck className="w-3.5 h-3.5 text-amber-600" />
                  <span>Livreur : {packageItem.driverName}</span>
                </div>
              )}
            </div>

            {/* Finances */}
            <div className="p-4 bg-slate-900 text-white rounded-xl">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-2">
                Informations Financières
              </span>
              <div className="flex justify-between items-center mb-1">
                <span className="text-xs text-slate-300">Prix article :</span>
                <span className="font-mono font-semibold">{formatMAD(packageItem.productPrice)}</span>
              </div>
              <div className="flex justify-between items-center mb-1">
                <span className="text-xs text-slate-300">Frais livraison :</span>
                <span className="font-mono font-semibold text-red-400">
                  {formatMAD(packageItem.deliveryFee)}
                </span>
              </div>
              <div className="pt-2 mt-2 border-t border-slate-800 flex justify-between items-center">
                <span className="text-xs font-bold text-slate-200">Total COD à encaisser :</span>
                <span className="font-mono font-bold text-base text-emerald-400">
                  {formatMAD(packageItem.codAmount)}
                </span>
              </div>
              <div className="mt-2 text-[11px] text-slate-400">
                Statut règlement :{' '}
                <span className={packageItem.isPaidToClient ? 'text-emerald-400 font-bold' : 'text-amber-400 font-bold'}>
                  {packageItem.isPaidToClient ? 'Versé au client' : 'Non encore versé'}
                </span>
              </div>
              {!isClient && isPackageAssignedToPartner(packageItem, partners) && (() => {
                const pObj = resolvePackagePartner(packageItem, partners);
                const pFee = getPartnerFeeForPackage(pObj, packageItem);
                const pDriver = packageItem.driverId ? drivers.find(d => d.id === packageItem.driverId) : undefined;
                const dFee = packageItem.deliveredBy === 'admin' && pDriver ? Number(pDriver.driverFeePerDelivery ?? 0) : 0;
                const netProfit = Number(packageItem.deliveryFee || 0) - (packageItem.deliveredBy === 'admin' ? dFee : pFee);
                return (
                  <div className="mt-2 pt-2 border-t border-slate-800 space-y-1 text-[11px]">
                    <div className="flex justify-between text-slate-300">
                      <span>الشريك ({pObj?.name || packageItem.partnerName || packageItem.destinationAgency}) :</span>
                      <span className="font-mono font-bold text-amber-300">
                        {packageItem.deliveredBy === 'admin'
                          ? 'توصيل الإدارة (0 DH)'
                          : `-${formatMAD(pFee)}`}
                      </span>
                    </div>
                    <div className="flex justify-between text-slate-200 font-bold">
                      <span>ربحك الصافي :</span>
                      <span className="font-mono text-emerald-400">+{formatMAD(netProfit)}</span>
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>

          {/* Description & Remarques */}
          <div className="p-4 bg-white border border-slate-200 rounded-xl space-y-1">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
              Contenu du Colis & Remarques
            </span>
            <p className="text-sm font-medium text-slate-800">{packageItem.description}</p>
            {packageItem.notes && (
              <p className="text-xs text-amber-800 bg-amber-50 p-2 rounded-lg mt-2 font-medium">
                Note de livraison : {packageItem.notes}
              </p>
            )}
            {packageItem.returnReason && (
              <p className="text-xs text-rose-800 bg-rose-50 p-2 rounded-lg mt-2 font-medium">
                Motif du retour : {packageItem.returnReason}
              </p>
            )}
          </div>

          {/* Admin Operations Toolbar */}
          {!isClient && (
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                  Actions de Gestion du Colis
                </span>
                <div className="flex flex-wrap items-center gap-2">
                  {canEditPackage && (
                    <button
                      type="button"
                      onClick={() => setShowEditModal(true)}
                      className="px-3 py-1.5 text-xs font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 hover:bg-indigo-100 rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                      <span>تعديل الكموند</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => {
                      setShowStatusChanger(!showStatusChanger);
                      setShowDriverAssign(false);
                      setShowTransfer(false);
                    }}
                    className="px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg transition-colors flex items-center gap-1"
                  >
                    <span>Changer Statut</span>
                    <ChevronDown className="w-3.5 h-3.5" />
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setShowDriverAssign(!showDriverAssign);
                      setShowStatusChanger(false);
                      setShowTransfer(false);
                    }}
                    className="px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg transition-colors flex items-center gap-1"
                  >
                    <Truck className="w-3.5 h-3.5 text-slate-600" />
                    <span>Affecter Livreur</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setShowTransfer(!showTransfer);
                      setShowStatusChanger(false);
                      setShowDriverAssign(false);
                    }}
                    className="px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg transition-colors flex items-center gap-1"
                  >
                    <ArrowRightLeft className="w-3.5 h-3.5 text-slate-600" />
                    <span>Transférer Agence</span>
                  </button>
                </div>
              </div>

              {/* Status Changer Sub-panel */}
              {showStatusChanger && (
                <div className="p-3 bg-white border border-slate-200 rounded-lg space-y-3">
                  {statusFeedback && (
                    <div
                      className={`p-2.5 rounded-lg text-xs font-semibold flex items-center gap-2 ${
                        statusFeedback.type === 'success'
                          ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                          : 'bg-rose-50 text-rose-800 border border-rose-200'
                      }`}
                    >
                      <span>{statusFeedback.type === 'success' ? '✓' : '⚠️'}</span>
                      <span>{statusFeedback.message}</span>
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Nouveau statut (13 statuts officiels) :
                      </label>
                      <select
                        value={selectedStatus}
                        disabled={isUpdatingStatus}
                        onChange={e => setSelectedStatus(e.target.value as PackageStatus)}
                        className="w-full text-xs font-medium bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-red-500 disabled:opacity-50"
                      >
                        {Object.entries(PACKAGE_STATUS_CONFIG).map(([key, config]) => (
                          <option key={key} value={key}>
                            {config.step}. {translateStatus(key)}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Commentaire / Motif :
                      </label>
                      <input
                        type="text"
                        value={statusComment}
                        disabled={isUpdatingStatus}
                        onChange={e => setStatusComment(e.target.value)}
                        placeholder="Ex: Destinataire absent, convenu pour demain..."
                        className="w-full text-xs bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-red-500 disabled:opacity-50"
                      />
                    </div>
                  </div>

                  <div className="flex justify-between items-center pt-1">
                    <span className="text-[11px] text-slate-400">
                      Enregistrement direct dans Supabase Production (<code className="font-mono">public.packages</code>)
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        disabled={isUpdatingStatus}
                        onClick={() => {
                          setShowStatusChanger(false);
                          setStatusFeedback(null);
                        }}
                        className="px-3 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg disabled:opacity-50 cursor-pointer"
                      >
                        Annuler
                      </button>
                      <button
                        type="button"
                        disabled={isUpdatingStatus}
                        onClick={handleUpdateStatus}
                        className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-bold text-white bg-red-600 hover:bg-red-700 rounded-lg shadow-xs transition-colors disabled:opacity-50 cursor-pointer"
                      >
                        {isUpdatingStatus ? (
                          <>
                            <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            <span>Enregistrement Supabase...</span>
                          </>
                        ) : (
                          <span>Enregistrer le nouveau statut</span>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Assign Driver Sub-panel */}
              {showDriverAssign && (
                <div className="p-3 bg-white border border-slate-200 rounded-lg space-y-3">
                  {topSuggestedDriver && (
                    <div className="p-2.5 bg-indigo-50 border border-indigo-200 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="flex items-center gap-2 text-xs">
                        <Sparkles className="w-4 h-4 text-indigo-600 shrink-0" />
                        <div>
                          <div className="font-extrabold text-indigo-950">
                            ⚡ السائق المقترح تلقائياً : {topSuggestedDriver.driver.name}
                          </div>
                          <div className="text-[11px] text-indigo-700">
                            {topSuggestedDriver.matchLabel} — {topSuggestedDriver.matchReason}
                          </div>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          assignPackageToDriver(
                            packageItem.id,
                            topSuggestedDriver.driver.id,
                            topSuggestedDriver.driver.name,
                            true,
                            currentUser ? { name: currentUser.name, role: currentUser.role } : undefined
                          );
                          setShowDriverAssign(false);
                        }}
                        className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-bold rounded-lg flex items-center gap-1 shrink-0 cursor-pointer"
                      >
                        <Zap className="w-3 h-3" />
                        <span>تعيين تلقائي فوري</span>
                      </button>
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Sélectionner le livreur (مرتبين حسب القرب) :
                      </label>
                      <select
                        value={selectedDriverId}
                        onChange={e => setSelectedDriverId(e.target.value)}
                        className="w-full text-xs font-medium bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-red-500"
                      >
                        <option value="">-- Choisir un livreur --</option>
                        {driverSuggestions.map(s => (
                          <option key={s.driver.id} value={s.driver.id}>
                            {s.driver.name} ({s.driver.city}) — {s.matchLabel}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setShowDriverAssign(false)}
                      className="px-3 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg"
                    >
                      Annuler
                    </button>
                    <button
                      type="button"
                      onClick={handleAssignDriver}
                      disabled={!selectedDriverId}
                      className="px-4 py-1.5 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-lg disabled:opacity-50"
                    >
                      Affecter et lancer la tournée
                    </button>
                  </div>
                </div>
              )}

              {/* Transfer Agency Sub-panel */}
              {showTransfer && (
                <div className="p-3 bg-white border border-slate-200 rounded-lg space-y-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Agence de destination :
                    </label>
                    <select
                      value={selectedAgency}
                      onChange={e => setSelectedAgency(e.target.value)}
                      className="w-full text-xs font-medium bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-red-500"
                    >
                      <option value="">-- Choisir l'agence --</option>
                      {agencies.map(a => (
                        <option key={a.id} value={a.name}>
                          {a.name} ({a.city})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setShowTransfer(false)}
                      className="px-3 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg"
                    >
                      Annuler
                    </button>
                    <button
                      type="button"
                      onClick={handleTransfer}
                      disabled={!selectedAgency}
                      className="px-4 py-1.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg disabled:opacity-50"
                    >
                      Valider le transfert
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Chronological Movement History (Required in Specs!) */}
          <div>
            <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-3 flex items-center gap-2">
              <Clock className="w-4 h-4 text-slate-500" />
              <span>Historique Chronologique des Mouvements ({packageItem.history.length})</span>
            </h4>

            <div className={`relative ${isRtl ? 'border-r-2 mr-3' : 'border-l-2 ml-3'} border-slate-200 space-y-4 py-1`}>
              {packageItem.history.map((h, index) => {
                const stepMeta = PACKAGE_STATUS_CONFIG[h.status] || {
                  label: h.statusLabel,
                  dotColor: '#475569'
                };
                const isLatest = index === packageItem.history.length - 1;

                return (
                  <div key={h.id || index} className={`relative ${isRtl ? 'pr-6' : 'pl-6'}`}>
                    {/* Timeline bullet */}
                    <div
                      className={`absolute ${isRtl ? '-right-[9px]' : '-left-[9px]'} top-1.5 w-4 h-4 rounded-full border-2 border-white shadow-2xs`}
                      style={{ backgroundColor: stepMeta.dotColor }}
                    />

                    <div className="flex items-center justify-between">
                      <span className="font-bold text-xs text-slate-900">
                        {translateStatus(h.status)}
                        {isLatest && (
                          <span className={`${isRtl ? 'mr-2' : 'ml-2'} text-[10px] bg-red-100 text-red-700 font-semibold px-2 py-0.5 rounded-full`}>
                            Actuel
                          </span>
                        )}
                      </span>
                      <span className="font-mono text-[11px] text-slate-400">{h.timestamp}</span>
                    </div>

                    <p className="text-xs text-slate-600 mt-0.5">{h.comment}</p>

                    {h.photoUrl && (
                      <button
                        type="button"
                        onClick={() => setZoomedPhotoUrl(h.photoUrl!)}
                        className="mt-1.5 inline-flex items-center gap-2 p-1.5 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 transition cursor-pointer"
                      >
                        <img src={h.photoUrl} alt="صورة مرفقة" className="w-10 h-10 rounded object-cover" />
                        <span className="text-[10px] font-bold text-red-700 flex items-center gap-1">
                          <Camera className="w-3 h-3" />
                          <span>معاينة الصورة المرفقة</span>
                        </span>
                      </button>
                    )}

                    <div className="text-[10px] text-slate-400 mt-1 flex items-center gap-3">
                      <span>Par : <strong className="text-slate-600">{h.updatedBy}</strong> ({h.role})</span>
                      <span>Lieu : <strong className="text-slate-600">{h.location}</strong></span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-slate-100 bg-slate-50 flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            {hasValidRecipientWhatsApp(packageItem.recipientPhone) && (
              <a
                href={buildRecipientConfirmationWhatsAppUrl(packageItem, companySettings?.companyName)}
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-xs transition-colors flex items-center gap-2"
              >
                <MessageCircle className="w-4 h-4" />
                <span>تأكيد الطلبية (واتساب للزبون)</span>
              </a>
            )}
            {isClient && (
              <button
                onClick={() => setIsSupportModalOpen(true)}
                className="px-4 py-2 text-xs font-bold text-white bg-[#1f9d55] hover:bg-[#198748] rounded-xl shadow-xs transition-colors flex items-center gap-2 cursor-pointer"
              >
                <MessageCircle className="w-4 h-4" />
                <span>Contacter le support / Réclamation</span>
                {isRtl ? <ChevronLeft className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
              </button>
            )}
            {canEditPackage && (
              <button
                type="button"
                onClick={() => setShowEditModal(true)}
                className="px-4 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <Edit2 className="w-4 h-4" />
                <span>تعديل الكموند</span>
              </button>
            )}
            {canDeletePackage && (
              <button
                type="button"
                disabled={isDeletingPkg}
                onClick={() => setShowDeleteConfirm(true)}
                className="px-4 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-60"
              >
                <Trash2 className="w-4 h-4" />
                <span>{isDeletingPkg ? 'جاري الحذف...' : 'حذف الكموند'}</span>
              </button>
            )}
          </div>

          <button
            onClick={onClose}
            className="px-5 py-2 text-xs font-bold text-slate-700 bg-white border border-slate-300 hover:bg-slate-100 rounded-xl transition-colors"
          >
            Fermer
          </button>
        </div>
      </div>

      {showDeleteConfirm && (
        <ConfirmActionModal
          isOpen={showDeleteConfirm}
          title="حذف الكموند نهائياً من كلشي"
          description={`هل أنت متأكد من حذف الكوليا ${packageItem.trackingNumber} (${packageItem.recipientName} - ${packageItem.city}) نهائياً من كلشي (قاعدة البيانات، البونات، الحسابات، السطوك والرسائل)؟ لا يمكن التراجع عن هذا الإجراء.`}
          confirmLabel="حذف نهائي من كلشي"
          requireReason={false}
          onConfirm={reason => void handleConfirmDeletePackage(reason || 'حذف نهائي للكموند')}
          onClose={() => setShowDeleteConfirm(false)}
        />
      )}

      {/* WhatsApp Regional Support Modal */}
      <OrderWhatsAppSupportModal
        isOpen={isSupportModalOpen}
        onClose={() => setIsSupportModalOpen(false)}
        packageItem={packageItem}
        onOpenInternalMessage={() => setIsMessageModalOpen(true)}
      />

      {/* Message Modal */}
      <CreateClientMessageModal
        isOpen={isMessageModalOpen}
        onClose={() => setIsMessageModalOpen(false)}
        preselectedPackage={packageItem}
      />

      {/* Fullscreen Photo Preview Modal */}
      {zoomedPhotoUrl && (
        <div
          onClick={() => setZoomedPhotoUrl(null)}
          className="fixed inset-0 z-[70] bg-black/85 flex items-center justify-center p-4 backdrop-blur-xs"
        >
          <div className="relative max-w-2xl w-full bg-slate-950 rounded-2xl overflow-hidden border border-slate-700 shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800 text-white">
              <span className="text-xs font-bold flex items-center gap-2">
                <Camera className="w-4 h-4 text-red-400" />
                <span>صورة إثبات مشكلة التوصيل — {packageItem.trackingNumber}</span>
              </span>
              <button
                type="button"
                onClick={() => setZoomedPhotoUrl(null)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-3 flex items-center justify-center bg-black">
              <img src={zoomedPhotoUrl} alt="صورة مشكلة التوصيل" className="max-h-[75vh] w-auto object-contain rounded-lg" />
            </div>
          </div>
        </div>
      )}

      {/* Partner vs Admin Delivery Attribution Modal */}
      {showPartnerDeliveryModal && (() => {
        const matchedPartner = resolvePackagePartner(packageItem, partners);
        const matchedDriver = packageItem.driverId
          ? drivers.find(d => d.id === packageItem.driverId)
          : undefined;
        return (
          <PartnerDeliveryChoiceModal
            isOpen={showPartnerDeliveryModal}
            pkg={packageItem}
            partner={matchedPartner}
            driverFeePerDelivery={Number(matchedDriver?.driverFeePerDelivery ?? 0)}
            isSubmitting={isUpdatingStatus}
            onCancel={() => setShowPartnerDeliveryModal(false)}
            onConfirm={result => void handleConfirmPartnerDelivery(result)}
          />
        );
      })()}
      <EditPackageModal
        packageItem={packageItem}
        isOpen={showEditModal}
        onClose={() => setShowEditModal(false)}
        onSaved={() => {
          setEditFeedback('تم تعديل بيانات الكموند وحفظها بنجاح.');
          setTimeout(() => setEditFeedback(null), 4000);
        }}
      />
    </div>
  );
};
