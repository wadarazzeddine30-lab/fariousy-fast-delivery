import React, { useRef, useState } from 'react';
import { useDatabase } from '../../context/DatabaseContext';
import { useAuth } from '../../context/AuthContext';
import { PackageItem } from '../../types';
import { formatMAD } from '../../utils/barcode';
import { compressImageFileToDataUrl } from '../../utils/imageCompress';
import {
  Truck,
  MapPin,
  CheckCircle2,
  Scan,
  AlertTriangle,
  Camera,
  X,
  ShieldCheck,
  PhoneCall,
  Store,
  MessageSquare
} from 'lucide-react';

interface DriverTourProps {
  onOpenScanner: () => void;
  onViewPackage: (pkg: PackageItem) => void;
}

const TOUR_PROBLEM_CATEGORIES = [
  { id: 'adresse_introuvable', label: 'عنوان غير واضح / ناقص' },
  { id: 'client_injoignable', label: 'الزبون لا يجيب' },
  { id: 'client_absent', label: 'الزبون غائب' },
  { id: 'colis_endommage', label: 'الطرد متضرر / مكسور' },
  { id: 'refus_paiement', label: 'رفض الدفع' },
  { id: 'autre_probleme', label: 'مشكلة أخرى' }
];

export const DriverTour: React.FC<DriverTourProps> = ({
  onOpenScanner
}) => {
  const { currentUser } = useAuth();
  const { packages, users, changePackageStatus, reportPackageProblem } = useDatabase();

  const resolveMerchantContact = (pkg: PackageItem) => {
    const matchedClient = users.find(
      u =>
        (pkg.clientId && u.id === pkg.clientId) ||
        (pkg.clientCompany &&
          u.companyName &&
          u.companyName.trim().toLowerCase() === pkg.clientCompany.trim().toLowerCase()) ||
        (pkg.clientName &&
          u.name &&
          u.name.trim().toLowerCase() === pkg.clientName.trim().toLowerCase())
    );
    return {
      name:
        (pkg.clientCompany || '').trim() ||
        (pkg.clientName || '').trim() ||
        (matchedClient?.companyName || '').trim() ||
        (matchedClient?.name || '').trim() ||
        'التاجر',
      phone: (pkg.clientPhone || '').trim() || (matchedClient?.phone || '').trim()
    };
  };

  const [reportingPackage, setReportingPackage] = useState<PackageItem | null>(null);
  const [reportReason, setReportReason] = useState('');
  const [reportType, setReportType] = useState<'probleme_livraison' | 'reporte' | 'refuse'>('probleme_livraison');
  const [problemCategory, setProblemCategory] = useState('adresse_introuvable');
  const [problemPhoto, setProblemPhoto] = useState<string | null>(null);
  const [isSubmittingReport, setIsSubmittingReport] = useState(false);
  const photoInputRef = useRef<HTMLInputElement | null>(null);

  // Strict isolation: only parcels assigned to this driver!
  const myAssignedPackages = packages.filter(p => p.driverId === currentUser?.id);
  const activeDeliveries = myAssignedPackages.filter(p => p.status === 'en_cours_livraison');
  const deliveredToday = myAssignedPackages.filter(p => p.status === 'livre');

  const handleDeliver = (pkg: PackageItem) => {
    if (confirm(`Confirmer la livraison du colis ${pkg.trackingNumber} et l'encaissement de ${formatMAD(pkg.codAmount)} en espèces ?`)) {
      changePackageStatus(
        pkg.id,
        'livre',
        `Livré par ${currentUser?.name}. Espèces encaissées : ${pkg.codAmount} MAD`,
        currentUser?.city || pkg.city,
        currentUser ? { name: currentUser.name, role: currentUser.role } : undefined
      );
    }
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const compressed = await compressImageFileToDataUrl(file, 1024, 0.76);
      setProblemPhoto(compressed);
    } catch {
      const reader = new FileReader();
      reader.onloadend = () => setProblemPhoto(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleReportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reportingPackage) return;
    setIsSubmittingReport(true);
    try {
      if (reportType === 'probleme_livraison') {
        const cat = TOUR_PROBLEM_CATEGORIES.find(c => c.id === problemCategory) || TOUR_PROBLEM_CATEGORIES[0];
        await reportPackageProblem({
          packageId: reportingPackage.id,
          category: cat.id,
          categoryLabel: cat.label,
          description: reportReason.trim() || cat.label,
          photoBase64: problemPhoto || undefined,
          reportedBy: currentUser
            ? { id: currentUser.id, name: currentUser.name, role: currentUser.role }
            : undefined
        });
      } else {
        await changePackageStatus(
          reportingPackage.id,
          reportType,
          reportReason || (reportType === 'reporte' ? 'Client absent, reprogrammé' : 'Refusé par client'),
          currentUser?.city || reportingPackage.city,
          currentUser ? { name: currentUser.name, role: currentUser.role } : undefined
        );
      }
      setReportingPackage(null);
      setReportReason('');
      setProblemPhoto(null);
    } finally {
      setIsSubmittingReport(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-amber-600 uppercase tracking-wider">Feuille de Route Mobile</span>
          </div>
          <h2 className="text-xl font-black text-slate-900 tracking-tight">
            Ma Tournée de Livraison — {currentUser?.name}
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Véhicule : {currentUser?.driverVehicle || 'Fourgonnette'} — Matricule : {currentUser?.driverPlate || '26-A-1234'}
          </p>
        </div>

        <button
          onClick={onOpenScanner}
          className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-red-600 hover:bg-red-700 rounded-xl shadow-xs transition-colors self-start sm:self-auto"
        >
          <Scan className="w-4 h-4" />
          <span>Scanner pour Livrer</span>
        </button>
      </div>

      {/* Tour Progress Bar */}
      <div className="p-4 bg-slate-900 text-white rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-4">
        <div>
          <span className="text-xs text-slate-400 font-bold uppercase tracking-wider">Progression de la Tournée</span>
          <div className="text-lg font-black mt-0.5">
            {deliveredToday.length} / {myAssignedPackages.length} Colis Livrés
          </div>
        </div>

        <div className="w-full sm:w-64 h-3 bg-slate-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-emerald-500 rounded-full transition-all duration-300"
            style={{
              width: `${myAssignedPackages.length > 0 ? (deliveredToday.length / myAssignedPackages.length) * 100 : 0}%`
            }}
          />
        </div>
      </div>

      {/* Driver Rules / Charter Notice */}
      <div
        dir="rtl"
        className="no-translate bg-amber-50 border border-amber-300 rounded-2xl p-4 shadow-xs"
      >
        <div className="flex items-center gap-2 mb-2.5">
          <div className="w-7 h-7 rounded-xl bg-amber-100 border border-amber-300 flex items-center justify-center shrink-0">
            <ShieldCheck className="w-4 h-4 text-amber-700" />
          </div>
          <h3 className="text-xs font-black text-amber-900">
            تعليمات التوصيل الإلزامية للموزع
          </h3>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-slate-800">
          <div className="flex items-center gap-2 bg-white border border-amber-200/80 rounded-xl px-3 py-2">
            <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
            <span className="font-bold">ضرورة احترام الزبون</span>
          </div>
          <div className="flex items-center gap-2 bg-white border border-amber-200/80 rounded-xl px-3 py-2">
            <PhoneCall className="w-4 h-4 text-amber-600 shrink-0" />
            <span className="font-bold">ضرورة الاتصال بالزبون 3 مرات على الأقل</span>
          </div>
        </div>
      </div>

      {/* Parcels To Deliver (Active) */}
      <div className="space-y-3">
        <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
          <Truck className="w-4 h-4 text-orange-600" />
          <span>Colis à Livrer Maintenant ({activeDeliveries.length})</span>
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {activeDeliveries.map(pkg => (
            <div
              key={pkg.id}
              className="p-5 bg-white border-2 border-slate-200 rounded-2xl shadow-xs space-y-3 hover:border-slate-300 transition-all flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between">
                  <div>
                    <span className="font-mono font-bold text-slate-900 block">{pkg.trackingNumber}</span>
                    <h4 className="text-base font-extrabold text-slate-900 mt-1">{pkg.recipientName}</h4>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] text-slate-400 uppercase font-bold block">À Encaisser</span>
                    <span className="text-lg font-black font-mono text-emerald-600">
                      {formatMAD(pkg.codAmount)}
                    </span>
                  </div>
                </div>

                {/* Recipient Coordinates */}
                <div className="mt-3 space-y-1.5 text-xs text-slate-600">
                  <div className="flex items-center justify-between p-2 bg-slate-50 rounded-xl">
                    <span className="font-mono font-bold text-slate-900">📞 {pkg.recipientPhone}</span>
                    <a
                      href={`tel:${pkg.recipientPhone}`}
                      className="px-3 py-1 bg-emerald-600 text-white font-bold text-[11px] rounded-lg"
                    >
                      Appeler
                    </a>
                  </div>

                  {/* Merchant (Sender) Phone Number */}
                  {(() => {
                    const merchant = resolveMerchantContact(pkg);
                    const cleanMerchantPhone = merchant.phone.replace(/[^0-9]/g, '');
                    const waMerchantPhone = cleanMerchantPhone.startsWith('0')
                      ? `212${cleanMerchantPhone.slice(1)}`
                      : cleanMerchantPhone;
                    return (
                      <div
                        dir="rtl"
                        className="flex items-center justify-between gap-2 p-2 bg-amber-50 border border-amber-200/80 rounded-xl"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <Store className="w-3.5 h-3.5 text-amber-700 shrink-0" />
                          <div className="min-w-0">
                            <span className="text-[10px] font-bold text-amber-900 block leading-none truncate">
                              التاجر : {merchant.name}
                            </span>
                            <span dir="ltr" className="font-mono font-extrabold text-slate-900 text-xs block mt-0.5 truncate">
                              {merchant.phone || 'رقم غير متوفر'}
                            </span>
                          </div>
                        </div>
                        {merchant.phone && (
                          <div className="flex items-center gap-1.5 shrink-0">
                            <a
                              href={`tel:${merchant.phone.replace(/\s+/g, '')}`}
                              className="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white font-bold text-[11px] rounded-lg"
                            >
                              اتصال بالتاجر
                            </a>
                            <a
                              href={`https://wa.me/${waMerchantPhone}`}
                              target="_blank"
                              rel="noreferrer"
                              aria-label="واتساب التاجر"
                              className="p-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg"
                            >
                              <MessageSquare className="w-3.5 h-3.5" />
                            </a>
                          </div>
                        )}
                      </div>
                    );
                  })()}

                  <div className="flex items-start gap-1.5 pt-1">
                    <MapPin className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                    <span className="text-slate-800">
                      <strong>{pkg.city}</strong> — {pkg.address}
                    </span>
                  </div>

                  {pkg.notes && (
                    <div className="p-2 bg-amber-50 text-amber-800 text-[11px] rounded-lg font-medium">
                      Note client : {pkg.notes}
                    </div>
                  )}
                </div>
              </div>

              {/* Delivery Action Buttons */}
              <div className="pt-3 border-t border-slate-100 grid grid-cols-2 gap-2">
                <button
                  onClick={() => {
                    setReportingPackage(pkg);
                    setReportType('probleme_livraison');
                    setProblemPhoto(null);
                    setReportReason('');
                  }}
                  className="py-2.5 px-3 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 font-bold text-xs rounded-xl transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <AlertTriangle className="w-3.5 h-3.5" />
                  <span>مشكلة في التوصيل</span>
                </button>

                <button
                  onClick={() => handleDeliver(pkg)}
                  className="py-2.5 px-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Livré & Encaissé</span>
                </button>
              </div>
            </div>
          ))}

          {activeDeliveries.length === 0 && (
            <div className="col-span-2 py-12 text-center text-slate-400 bg-white rounded-2xl border border-slate-200">
              Aucun colis en attente de livraison pour cette tournée.
            </div>
          )}
        </div>
      </div>

      {/* Problem / Report Modal */}
      {reportingPackage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs no-print">
          <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50">
              <div>
                <h3 className="text-base font-bold text-slate-900">تبليغ عن مشكلة في التوصيل</h3>
                <span className="text-[11px] font-mono text-red-600 font-bold">{reportingPackage.trackingNumber}</span>
              </div>
              <button onClick={() => setReportingPackage(null)} className="p-2 text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleReportSubmit} className="p-6 space-y-4 overflow-y-auto">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">الحالة</label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setReportType('probleme_livraison')}
                    className={`p-2 rounded-xl text-[11px] font-bold border transition-colors cursor-pointer ${
                      reportType === 'probleme_livraison'
                        ? 'border-red-600 bg-red-50 text-red-800'
                        : 'border-slate-200 text-slate-700'
                    }`}
                  >
                    مشكلة في التوصيل
                  </button>
                  <button
                    type="button"
                    onClick={() => setReportType('reporte')}
                    className={`p-2 rounded-xl text-[11px] font-bold border transition-colors cursor-pointer ${
                      reportType === 'reporte'
                        ? 'border-amber-500 bg-amber-50 text-amber-800'
                        : 'border-slate-200 text-slate-700'
                    }`}
                  >
                    تأجيل (Reporté)
                  </button>
                  <button
                    type="button"
                    onClick={() => setReportType('refuse')}
                    className={`p-2 rounded-xl text-[11px] font-bold border transition-colors cursor-pointer ${
                      reportType === 'refuse'
                        ? 'border-rose-500 bg-rose-50 text-rose-800'
                        : 'border-slate-200 text-slate-700'
                    }`}
                  >
                    رفض (Refusé)
                  </button>
                </div>
              </div>

              {reportType === 'probleme_livraison' && (
                <>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">نوع المشكلة</label>
                    <div className="grid grid-cols-2 gap-1.5">
                      {TOUR_PROBLEM_CATEGORIES.map(cat => (
                        <button
                          key={cat.id}
                          type="button"
                          onClick={() => setProblemCategory(cat.id)}
                          className={`px-2.5 py-2 rounded-xl text-[11px] font-bold text-right border transition cursor-pointer ${
                            problemCategory === cat.id
                              ? 'bg-red-600 text-white border-red-600'
                              : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                          }`}
                        >
                          {cat.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                        <Camera className="w-3.5 h-3.5 text-red-600" />
                        <span>إرفاق صورة للمشكلة (يشاهدها المدير مباشرة)</span>
                      </label>
                      {problemPhoto && (
                        <button
                          type="button"
                          onClick={() => setProblemPhoto(null)}
                          className="text-[10px] font-bold text-rose-600 hover:underline cursor-pointer"
                        >
                          حذف
                        </button>
                      )}
                    </div>
                    <input
                      ref={photoInputRef}
                      type="file"
                      accept="image/*"
                      capture="environment"
                      onChange={handlePhotoUpload}
                      className="hidden"
                    />
                    {problemPhoto ? (
                      <div className="rounded-xl overflow-hidden border border-emerald-400 bg-slate-900">
                        <img src={problemPhoto} alt="صورة المشكلة" className="max-h-40 w-full object-contain mx-auto" />
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => photoInputRef.current?.click()}
                        className="w-full py-3.5 border-2 border-dashed border-red-300 hover:border-red-500 rounded-xl bg-red-50/40 flex flex-col items-center justify-center gap-1 text-red-700 cursor-pointer"
                      >
                        <Camera className="w-5 h-5" />
                        <span className="text-xs font-bold">📸 التقاط أو رفع صورة المشكلة</span>
                      </button>
                    )}
                  </div>
                </>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">تفاصيل المشكلة / السبب *</label>
                <textarea
                  rows={3}
                  required
                  value={reportReason}
                  onChange={e => setReportReason(e.target.value)}
                  placeholder="مثال: العنوان غير مكتمل والهاتف مغلق، أو الطرد وصَل مثقوب..."
                  className="w-full text-xs bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-900"
                />
              </div>

              <div className="pt-3 border-t flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setReportingPackage(null)}
                  className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingReport}
                  className="px-5 py-2.5 text-xs font-bold text-white bg-red-600 hover:bg-red-700 disabled:opacity-50 rounded-xl cursor-pointer"
                >
                  {isSubmittingReport ? 'جاري الإرسال...' : 'إرسال للمدير وحفظ الحالة'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

