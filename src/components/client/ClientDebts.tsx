import React, { useMemo, useState } from 'react';
import { useDatabase } from '../../context/DatabaseContext';
import { useAuth } from '../../context/AuthContext';
import { formatMAD, formatDate } from '../../utils/barcode';
import { downloadImageUrl } from '../../utils/imageCompress';
import {
  FileImage,
  Download,
  Eye,
  X,
  Search,
  Landmark,
  CheckCircle2,
  Calendar,
  Hash,
  ZoomIn
} from 'lucide-react';

interface UnifiedReceiptItem {
  id: string;
  source: 'standalone' | 'payment';
  reference: string;
  amount: number;
  date: string;
  bankName?: string;
  bankRib?: string;
  notes?: string;
  imageUrl: string;
  fileName: string;
  createdAt: string;
}

export const ClientDebts: React.FC = () => {
  const { currentUser } = useAuth();
  const { payments, transferReceipts } = useDatabase();

  const [searchTerm, setSearchTerm] = useState('');
  const [previewItem, setPreviewItem] = useState<UnifiedReceiptItem | null>(null);

  // Merge standalone transfer receipts + payments with attached receipt image for this client
  const myReceipts = useMemo<UnifiedReceiptItem[]>(() => {
    if (!currentUser) return [];

    const matchesClient = (clientId?: string, clientPhone?: string) =>
      clientId === currentUser.id ||
      (Boolean(currentUser.phone) && Boolean(clientPhone) && clientPhone === currentUser.phone);

    const standalone: UnifiedReceiptItem[] = transferReceipts
      .filter(r => matchesClient(r.clientId, r.clientPhone))
      .map(r => ({
        id: r.id,
        source: 'standalone',
        reference: r.reference,
        amount: Number(r.amount || 0),
        date: r.transferDate || formatDate(r.createdAt),
        bankName: r.bankName || r.clientBankName || currentUser.bankName,
        bankRib: r.clientBankRib || currentUser.bankRib,
        notes: r.notes,
        imageUrl: r.imageUrl,
        fileName: r.fileName || `virement_${r.reference}.jpg`,
        createdAt: r.createdAt
      }));

    const fromPayments: UnifiedReceiptItem[] = payments
      .filter(p => p.clientId === currentUser.id && Boolean(p.receiptImageUrl))
      .map(p => ({
        id: `pay-${p.id}`,
        source: 'payment',
        reference: p.reference,
        amount: Number(p.netAmount || 0),
        date: p.date,
        bankName: currentUser.bankName,
        bankRib: currentUser.bankRib,
        notes: p.notes || `كشف الدفع ${p.reference} (${p.packageCount} طرود)`,
        imageUrl: p.receiptImageUrl!,
        fileName: p.receiptFileName || `virement_${p.reference}.jpg`,
        createdAt: p.receiptUploadedAt || p.date
      }));

    return [...standalone, ...fromPayments].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }, [currentUser, transferReceipts, payments]);

  const filteredReceipts = useMemo(() => {
    const q = searchTerm.toLowerCase().trim();
    if (!q) return myReceipts;
    return myReceipts.filter(
      item =>
        item.reference.toLowerCase().includes(q) ||
        item.date.toLowerCase().includes(q) ||
        (item.notes && item.notes.toLowerCase().includes(q)) ||
        (item.bankName && item.bankName.toLowerCase().includes(q))
    );
  }, [myReceipts, searchTerm]);

  const totalTransferredAmount = useMemo(
    () => myReceipts.reduce((sum, r) => sum + (r.amount || 0), 0),
    [myReceipts]
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="pb-3 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-black text-slate-900 tracking-tight">
              صور التحويلات البنكية (Reçus de Virement)
            </h2>
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
              {myReceipts.length} وثيقة
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            تصفح وتنزيل جميع صور وصولات التحويلات البنكية المرسلة من طرف إدارة FARIOUSY DELIVERY إلى حسابكم
          </p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-5 bg-white border border-slate-200 rounded-2xl shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider block">
              صور التحويلات المتوفرة للتنزيل
            </span>
            <div className="mt-1 text-2xl font-black font-mono text-slate-900">
              {myReceipts.length}
            </div>
            <span className="text-[11px] text-emerald-700 font-semibold mt-0.5 block">
              جاهزة للمعاينة والتحميل المباشر
            </span>
          </div>
          <div className="w-11 h-11 rounded-2xl bg-emerald-50 text-emerald-600 border border-emerald-200 flex items-center justify-center shrink-0">
            <FileImage className="w-5 h-5" />
          </div>
        </div>

        <div className="p-5 bg-emerald-950 text-white rounded-2xl shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[10px] text-emerald-300 uppercase font-bold tracking-wider block">
              إجمالي التحويلات الموثقة بالصور
            </span>
            <div className="mt-1 text-2xl font-black font-mono text-emerald-300">
              {formatMAD(totalTransferredAmount)}
            </div>
            <span className="text-[11px] text-emerald-200 mt-0.5 block">
              مجموع المبالغ المثبتة بوصل بنكي
            </span>
          </div>
          <div className="w-11 h-11 rounded-2xl bg-emerald-900/80 text-emerald-300 border border-emerald-700 flex items-center justify-center shrink-0">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        </div>

        <div className="p-5 bg-white border border-slate-200 rounded-2xl shadow-2xs flex items-center justify-between">
          <div className="min-w-0">
            <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider block">
              الحساب البنكي المعتمد (RIB)
            </span>
            <div className="mt-1 text-sm font-black text-slate-900 truncate">
              {currentUser?.bankName || 'غير محدد'}
            </div>
            <span className="text-[11px] text-slate-600 font-mono mt-0.5 block truncate">
              {currentUser?.bankRib || 'المرجو إضافة RIB من ملفكم الشخصي'}
            </span>
          </div>
          <div className="w-11 h-11 rounded-2xl bg-slate-100 text-slate-700 border border-slate-200 flex items-center justify-center shrink-0">
            <Landmark className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Search Bar */}
      <div className="bg-white p-3 border border-slate-200 rounded-2xl shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="relative w-full sm:w-96">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            placeholder="ابحث بالمرجع، التاريخ أو الملاحظة..."
            className="w-full pl-9 pr-8 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-500"
          />
          {searchTerm && (
            <button
              type="button"
              onClick={() => setSearchTerm('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
        <div className="text-xs text-slate-500 font-mono">
          {filteredReceipts.length} صورة تحويل معروضة
        </div>
      </div>

      {/* Receipts Gallery */}
      {filteredReceipts.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredReceipts.map(item => (
            <div
              key={item.id}
              className="bg-white border border-slate-200 rounded-2xl shadow-2xs overflow-hidden flex flex-col hover:shadow-md transition-shadow"
            >
              {/* Image Preview Thumbnail */}
              <div
                onClick={() => setPreviewItem(item)}
                className="relative h-52 bg-slate-100 border-b border-slate-200 cursor-pointer group overflow-hidden"
              >
                <img
                  src={item.imageUrl}
                  alt={`وصل التحويل ${item.reference}`}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
                  <span className="opacity-0 group-hover:opacity-100 transition-opacity inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/95 text-slate-900 text-xs font-bold shadow-lg">
                    <ZoomIn className="w-4 h-4 text-red-600" />
                    <span>تكبير الصورة</span>
                  </span>
                </div>
                <span className="absolute top-2.5 left-2.5 px-2.5 py-1 rounded-lg bg-slate-900/85 text-white font-mono text-[11px] font-bold">
                  {item.reference}
                </span>
                <span className="absolute top-2.5 right-2.5 px-2.5 py-1 rounded-lg bg-emerald-600 text-white font-mono text-xs font-black shadow-xs">
                  {formatMAD(item.amount)}
                </span>
              </div>

              {/* Details & Actions */}
              <div className="p-4 flex-1 flex flex-col justify-between space-y-3 text-xs">
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-slate-600">
                    <span className="inline-flex items-center gap-1 font-mono">
                      <Calendar className="w-3.5 h-3.5 text-slate-400" />
                      {item.date}
                    </span>
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-500">
                      <Hash className="w-3 h-3" />
                      {item.source === 'payment' ? 'كشف مالي' : 'تحويل بنكي'}
                    </span>
                  </div>

                  {item.bankName && (
                    <div className="text-[11px] text-slate-700 font-semibold">
                      البنك : {item.bankName}
                    </div>
                  )}

                  {item.notes && (
                    <p className="text-slate-600 bg-slate-50 border border-slate-100 rounded-lg p-2 leading-relaxed">
                      {item.notes}
                    </p>
                  )}
                </div>

                <div className="pt-2 border-t border-slate-100 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setPreviewItem(item)}
                    className="flex-1 py-2 px-3 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition inline-flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>معاينة</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => downloadImageUrl(item.imageUrl, item.fileName)}
                    className="flex-1 py-2 px-3 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 active:scale-95 rounded-xl shadow-xs transition inline-flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>تنزيل الصورة</span>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center space-y-2">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center">
            <FileImage className="w-7 h-7" />
          </div>
          <h3 className="text-sm font-bold text-slate-800">
            لا توجد صور تحويلات بنكية متاحة حالياً
          </h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            بمجرد قيام الإدارة بإرسال تحويل بنكي وإرفاق صورة الوصل لحسابكم، ستظهر هنا مباشرة لتتمكنوا من معاينتها وتنزيلها بضغطة زر.
          </p>
        </div>
      )}

      {/* Fullscreen Lightbox Preview */}
      {previewItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs">
          <div className="relative w-full max-w-3xl bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 bg-slate-50">
              <div>
                <h3 className="text-sm font-black text-slate-900">
                  وصل التحويل البنكي — {previewItem.reference}
                </h3>
                <p className="text-[11px] text-slate-500 font-mono">
                  {previewItem.date} • المبلغ : <strong className="text-emerald-700">{formatMAD(previewItem.amount)}</strong>
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => downloadImageUrl(previewItem.imageUrl, previewItem.fileName)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-xs cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  <span>تنزيل الصورة</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewItem(null)}
                  className="p-2 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="p-5 bg-slate-900/5 overflow-auto flex items-center justify-center">
              <img
                src={previewItem.imageUrl}
                alt={`وصل التحويل ${previewItem.reference}`}
                className="max-h-[72vh] w-auto object-contain rounded-xl shadow-sm bg-white"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
