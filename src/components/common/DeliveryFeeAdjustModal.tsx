import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { PackageItem } from '../../types';
import { formatMAD } from '../../utils/barcode';
import {
  Banknote,
  CheckCircle2,
  Minus,
  Package,
  Plus,
  Scale,
  X
} from 'lucide-react';

export interface DeliveryFeeAdjustResult {
  deliveryFee: number;
  codAmount: number;
  productPrice: number;
  adjustCod: boolean;
  reason: string;
}

interface DeliveryFeeAdjustModalProps {
  isOpen: boolean;
  pkg: PackageItem | null;
  cityDefaultFee?: number;
  isSubmitting?: boolean;
  onCancel: () => void;
  onConfirm: (result: DeliveryFeeAdjustResult) => void;
}

export const DeliveryFeeAdjustModal: React.FC<DeliveryFeeAdjustModalProps> = ({
  isOpen,
  pkg,
  cityDefaultFee,
  isSubmitting = false,
  onCancel,
  onConfirm
}) => {
  const [feeInput, setFeeInput] = useState<string>('35');
  const [adjustCod, setAdjustCod] = useState<boolean>(false);
  const [reason, setReason] = useState<string>('');

  useEffect(() => {
    if (!isOpen || !pkg) return;
    setFeeInput(String(Number(pkg.deliveryFee ?? cityDefaultFee ?? 35)));
    setAdjustCod(false);
    setReason('');
  }, [isOpen, pkg, cityDefaultFee]);

  if (!isOpen || !pkg) return null;

  const currentFee = Math.max(0, Number(pkg.deliveryFee ?? 0));
  const currentCod = Math.max(0, Number(pkg.codAmount ?? 0));
  const baseFee = Math.max(0, Number(cityDefaultFee ?? currentFee));
  const origProductPrice =
    pkg.productPrice !== undefined && pkg.productPrice !== null
      ? Math.max(0, Number(pkg.productPrice))
      : Math.max(0, Math.round((currentCod - currentFee) * 100) / 100);

  const parsedFee = Math.max(0, Math.round((Number(feeInput) || 0) * 100) / 100);
  const feeDiff = Math.round((parsedFee - currentFee) * 100) / 100;

  // Mode 1 (default): Keep recipient COD identical, deduct extra delivery fee from merchant's net payout.
  // Mode 2: Add difference onto COD so recipient pays the updated total.
  const finalCod = adjustCod
    ? Math.max(0, Math.round((origProductPrice + parsedFee) * 100) / 100)
    : currentCod;
  const finalMerchantNet = Math.round((finalCod - parsedFee) * 100) / 100;

  const sizePresets = [
    { label: 'عادي', extra: 0, value: baseFee },
    { label: 'متوسط', extra: 10, value: baseFee + 10 },
    { label: 'كبير', extra: 20, value: baseFee + 20 },
    { label: 'كبير جداً', extra: 35, value: baseFee + 35 },
    { label: 'ثقيل', extra: 50, value: baseFee + 50 }
  ];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onConfirm({
      deliveryFee: parsedFee,
      codAmount: finalCod,
      productPrice: Math.max(0, finalMerchantNet),
      adjustCod,
      reason: reason.trim()
    });
  };

  const modalContent = (
    <div
      dir="rtl"
      onClick={onCancel}
      className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-4 bg-black/70 backdrop-blur-xs no-print"
    >
      <form
        onSubmit={handleSubmit}
        onClick={e => e.stopPropagation()}
        className="relative w-full max-w-lg max-h-[calc(100dvh-2rem)] sm:max-h-[90dvh] flex flex-col bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden"
      >
        {/* Header (Pinned) */}
        <div className="shrink-0 flex items-center justify-between gap-2 px-3.5 py-3 sm:px-5 sm:py-4 bg-slate-900 text-white">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/40 flex items-center justify-center shrink-0">
              <Scale className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <div className="min-w-0">
              <h3 className="text-[13px] sm:text-sm font-black truncate">
                تعديل ثمن التوصيل (حسب حجم الكموند)
              </h3>
              <p className="text-[10px] sm:text-[11px] text-slate-300 font-mono truncate">
                {pkg.trackingNumber} • {pkg.clientCompany || pkg.clientName || 'Boutique'} • {pkg.city}
              </p>
            </div>
          </div>
          <button
            type="button"
            disabled={isSubmitting}
            onClick={onCancel}
            aria-label="إغلاق"
            className="p-1.5 text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition cursor-pointer shrink-0 disabled:opacity-40"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-3 sm:p-5 space-y-3 text-xs">
          {/* Quick Parcel Info */}
          <div className="p-2.5 sm:p-3 bg-slate-50 border border-slate-200 rounded-xl flex flex-wrap items-center justify-between gap-2">
            <div className="min-w-0">
              <span className="text-slate-500 block text-[10px] sm:text-[11px]">المستلم / الوصف :</span>
              <span className="font-bold text-slate-900 truncate block">
                {pkg.recipientName}
                {pkg.description ? ` — ${pkg.description}` : ''}
              </span>
            </div>
            <div className="text-left">
              <span className="text-slate-500 block text-[10px] sm:text-[11px]">التسعيرة الحالية :</span>
              <div className="font-mono font-black text-slate-900 flex items-center gap-1.5 justify-end">
                <span dir="ltr" className="text-amber-700">{formatMAD(currentFee)}</span>
                <span className="text-[10px] text-slate-400">
                  (COD: <span dir="ltr">{formatMAD(currentCod)}</span>)
                </span>
              </div>
            </div>
          </div>

          {/* Quick Size Presets */}
          <div>
            <span className="block text-[11px] font-bold text-slate-700 mb-1.5 flex items-center gap-1">
              <Package className="w-3.5 h-3.5 text-amber-600 shrink-0" />
              <span>اختيار سريع حسب حجم أو وزن الطرد :</span>
            </span>
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-1.5">
              {sizePresets.map(preset => {
                const isSelected = Math.abs(parsedFee - preset.value) < 0.01;
                return (
                  <button
                    key={preset.label}
                    type="button"
                    disabled={isSubmitting}
                    onClick={() => {
                      setFeeInput(String(preset.value));
                      if (preset.extra > 0 && !reason) {
                        setReason(`تسعيرة طرد ${preset.label} (+${preset.extra} DH)`);
                      }
                    }}
                    className={`px-2 py-2 rounded-xl border text-center transition cursor-pointer ${
                      isSelected
                        ? 'bg-amber-50 border-amber-500 text-amber-900 shadow-2xs'
                        : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <div className="font-black text-[11px] leading-tight">{preset.label}</div>
                    <div dir="ltr" className="font-mono text-[10px] font-bold text-amber-700 mt-0.5">
                      {preset.value} DH
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Exact Delivery Fee Input with +/- 5 DH steppers */}
          <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-xl space-y-2.5">
            <label className="block text-[11px] font-black text-slate-800">
              ثمن التوصيل الجديد (DH) *
            </label>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={isSubmitting || parsedFee <= 0}
                onClick={() => setFeeInput(String(Math.max(0, parsedFee - 5)))}
                className="w-10 h-10 shrink-0 rounded-xl bg-white border border-amber-300 hover:bg-amber-100 text-slate-800 flex items-center justify-center cursor-pointer disabled:opacity-40"
                title="-5 DH"
              >
                <Minus className="w-4 h-4" />
              </button>
              <input
                type="number"
                inputMode="decimal"
                min="0"
                step="0.5"
                required
                value={feeInput}
                disabled={isSubmitting}
                onChange={e => setFeeInput(e.target.value)}
                className="flex-1 min-w-0 px-3 py-2 bg-white border border-amber-300 rounded-xl font-mono font-black text-base text-center text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
              <button
                type="button"
                disabled={isSubmitting}
                onClick={() => setFeeInput(String(parsedFee + 5))}
                className="w-10 h-10 shrink-0 rounded-xl bg-white border border-amber-300 hover:bg-amber-100 text-slate-800 flex items-center justify-center cursor-pointer disabled:opacity-40"
                title="+5 DH"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>

            {/* COD Handling Toggle */}
            <div className="grid grid-cols-2 gap-2 pt-1">
              <button
                type="button"
                disabled={isSubmitting}
                onClick={() => setAdjustCod(false)}
                className={`p-2 rounded-xl border text-right transition cursor-pointer ${
                  !adjustCod
                    ? 'bg-white border-emerald-500 ring-1 ring-emerald-500/30 text-slate-900'
                    : 'bg-white/60 border-amber-200 text-slate-600 hover:bg-white'
                }`}
              >
                <div className="font-black text-[11px] flex items-center justify-between gap-1">
                  <span>إبقاء COD كما هو</span>
                  {!adjustCod && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />}
                </div>
                <div className="text-[10px] text-slate-500 mt-0.5 leading-snug">
                  الفرق كيتقتطع من صافي التاجر
                </div>
              </button>

              <button
                type="button"
                disabled={isSubmitting}
                onClick={() => setAdjustCod(true)}
                className={`p-2 rounded-xl border text-right transition cursor-pointer ${
                  adjustCod
                    ? 'bg-white border-indigo-500 ring-1 ring-indigo-500/30 text-slate-900'
                    : 'bg-white/60 border-amber-200 text-slate-600 hover:bg-white'
                }`}
              >
                <div className="font-black text-[11px] flex items-center justify-between gap-1">
                  <span>تحديث مبلغ COD</span>
                  {adjustCod && <CheckCircle2 className="w-3.5 h-3.5 text-indigo-600 shrink-0" />}
                </div>
                <div className="text-[10px] text-slate-500 mt-0.5 leading-snug">
                  الزيادة كتتزاد على المستلم
                </div>
              </button>
            </div>
          </div>

          {/* Optional Reason */}
          <div>
            <label className="block text-[11px] font-bold text-slate-700 mb-1">
              سبب تغيير التسعيرة (اختياري) :
            </label>
            <input
              type="text"
              value={reason}
              disabled={isSubmitting}
              onChange={e => setReason(e.target.value)}
              placeholder="مثال: طرد كبير الحجم / وزن إضافي / تغليف خاص..."
              className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>

          {/* Live Calculation Summary */}
          <div className="bg-slate-50 p-2.5 sm:p-3 rounded-xl border border-slate-200 space-y-1.5">
            <div className="flex justify-between items-center gap-2 text-slate-600">
              <span>ثمن التوصيل :</span>
              <span className="font-mono font-bold text-slate-900 flex items-center gap-1.5">
                <span dir="ltr" className="line-through text-slate-400 text-[11px]">{formatMAD(currentFee)}</span>
                <span>←</span>
                <span dir="ltr" className="text-amber-700 font-black">{formatMAD(parsedFee)}</span>
                {feeDiff !== 0 && (
                  <span
                    dir="ltr"
                    className={`px-1.5 py-0.5 rounded text-[10px] font-black ${
                      feeDiff > 0 ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'
                    }`}
                  >
                    {feeDiff > 0 ? `+${feeDiff}` : feeDiff} DH
                  </span>
                )}
              </span>
            </div>
            <div className="flex justify-between items-center gap-2 text-slate-600">
              <span>مبلغ التحصيل عند التسليم (COD) :</span>
              <span dir="ltr" className="font-mono font-bold text-slate-900 shrink-0">
                {formatMAD(finalCod)}
              </span>
            </div>
            <div className="pt-1.5 border-t border-slate-200 flex justify-between items-center gap-2">
              <span className="font-black text-slate-900 flex items-center gap-1">
                <Banknote className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span>صافي المستحق للتاجر :</span>
              </span>
              <span
                dir="ltr"
                className={`font-mono font-black text-sm sm:text-base shrink-0 ${
                  finalMerchantNet >= 0 ? 'text-emerald-600' : 'text-rose-600'
                }`}
              >
                {formatMAD(finalMerchantNet)}
              </span>
            </div>
          </div>
        </div>

        {/* Footer Buttons (Pinned) */}
        <div className="shrink-0 flex items-center justify-end gap-2 px-3.5 py-2.5 sm:px-5 sm:py-3.5 bg-slate-50 border-t border-slate-200">
          <button
            type="button"
            disabled={isSubmitting}
            onClick={onCancel}
            className="px-4 py-2.5 sm:py-2 text-xs font-bold text-slate-700 bg-white border border-slate-300 hover:bg-slate-100 rounded-xl transition cursor-pointer disabled:opacity-40"
          >
            إلغاء
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="flex-1 sm:flex-none justify-center px-5 py-2.5 sm:py-2 text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 active:scale-95 rounded-xl shadow-xs transition cursor-pointer disabled:opacity-50 inline-flex items-center gap-1.5"
          >
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{isSubmitting ? 'جاري الحفظ...' : 'حفظ ثمن التوصيل'}</span>
          </button>
        </div>
      </form>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(modalContent, document.body) : modalContent;
};
