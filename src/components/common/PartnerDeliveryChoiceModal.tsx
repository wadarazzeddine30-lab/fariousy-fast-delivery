import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { PackageItem, Partner } from '../../types';
import { formatMAD } from '../../utils/barcode';
import { getPartnerCityFee } from '../../utils/partnerTariffs';
import { Building2, CheckCircle2, Handshake, ShieldCheck, TrendingUp, Truck, X } from 'lucide-react';

export interface PartnerDeliveryChoiceResult {
  deliveredBy: 'partner' | 'admin';
  partnerFee: number;
  profit: number;
}

interface PartnerDeliveryChoiceModalProps {
  isOpen: boolean;
  pkg: PackageItem | null;
  partner?: Partner | null;
  driverFeePerDelivery?: number;
  isSubmitting?: boolean;
  onCancel: () => void;
  onConfirm: (result: PartnerDeliveryChoiceResult) => void;
}

export const PartnerDeliveryChoiceModal: React.FC<PartnerDeliveryChoiceModalProps> = ({
  isOpen,
  pkg,
  partner,
  driverFeePerDelivery = 0,
  isSubmitting = false,
  onCancel,
  onConfirm
}) => {
  const [choice, setChoice] = useState<'partner' | 'admin'>('partner');
  const [partnerFeeInput, setPartnerFeeInput] = useState<string>('0');

  useEffect(() => {
    if (!isOpen || !pkg) return;
    const defaultTariff = getPartnerCityFee(
      partner,
      pkg.city,
      pkg.deliveredBy === 'admin' ? undefined : pkg.partnerDeliveryFee
    );
    setChoice(pkg.deliveredBy === 'admin' ? 'admin' : 'partner');
    setPartnerFeeInput(String(defaultTariff));
  }, [isOpen, pkg, partner]);

  if (!isOpen || !pkg) return null;

  const clientDeliveryFee = Number(pkg.deliveryFee || 0);
  const parsedPartnerFee = Math.max(0, Number(partnerFeeInput) || 0);
  const partnerProfit = clientDeliveryFee - parsedPartnerFee;
  const adminExpense = pkg.driverId ? Math.max(0, Number(driverFeePerDelivery || 0)) : 0;
  const adminProfit = clientDeliveryFee - adminExpense;
  const netFromPartner = (pkg.codAmount || 0) - parsedPartnerFee;
  const partnerLabel = partner?.name || pkg.partnerName || pkg.destinationAgency || 'الشريك';

  const handleConfirm = () => {
    if (choice === 'partner') {
      onConfirm({
        deliveredBy: 'partner',
        partnerFee: parsedPartnerFee,
        profit: partnerProfit
      });
    } else {
      onConfirm({
        deliveredBy: 'admin',
        partnerFee: 0,
        profit: adminProfit
      });
    }
  };

  const modalContent = (
    <div
      dir="rtl"
      className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-4 bg-black/70 backdrop-blur-xs no-print"
    >
      <div className="relative w-full max-w-lg max-h-[calc(100dvh-2rem)] sm:max-h-[90dvh] flex flex-col bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
        {/* Header (Always visible) */}
        <div className="shrink-0 flex items-center justify-between gap-2 px-3.5 py-3 sm:px-5 sm:py-4 bg-slate-900 text-white">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/40 flex items-center justify-center shrink-0">
              <Handshake className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <div className="min-w-0">
              <h3 className="text-[13px] sm:text-sm font-black truncate">تأكيد جهة توصيل الطرد (Livré)</h3>
              <p className="text-[10px] sm:text-[11px] text-slate-300 font-mono truncate">
                {pkg.trackingNumber} • {pkg.city} • الشريك: {partnerLabel}
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

        {/* Scrollable Content */}
        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-3 sm:p-5 space-y-2.5 sm:space-y-4 text-xs">
          {/* Parcel Quick Summary */}
          <div className="p-2.5 sm:p-3 bg-slate-50 border border-slate-200 rounded-xl flex flex-wrap items-center justify-between gap-2">
            <div className="min-w-0">
              <span className="text-slate-500 block text-[10px] sm:text-[11px]">المستلم :</span>
              <span className="font-bold text-slate-900 truncate block">{pkg.recipientName}</span>
            </div>
            <div className="text-left">
              <span className="text-slate-500 block text-[10px] sm:text-[11px]">مبلغ COD / ثمن التوصيل :</span>
              <div className="font-mono font-black text-slate-900 flex items-center gap-1.5 justify-end flex-wrap">
                <span dir="ltr">{formatMAD(pkg.codAmount)}</span>
                <span className="text-red-600 font-bold text-[11px]">
                  (<span dir="ltr">{formatMAD(clientDeliveryFee)}</span> توصيل)
                </span>
              </div>
            </div>
          </div>

          <div className="font-black text-[13px] sm:text-sm text-slate-900 text-center leading-snug">
            واش هاد الكوموند تليفرات من طرف الشريك ولا من طرف الإدارة؟
          </div>

          {/* 2 Choices — side-by-side on mobile too so full modal fits comfortably */}
          <div className="grid grid-cols-2 gap-2 sm:gap-3">
            {/* Option 1: Partner */}
            <button
              type="button"
              disabled={isSubmitting}
              onClick={() => setChoice('partner')}
              className={`p-2.5 sm:p-3.5 rounded-xl border-2 text-right transition cursor-pointer flex flex-col justify-between gap-1.5 sm:gap-2 ${
                choice === 'partner'
                  ? 'border-amber-500 bg-amber-50/70 shadow-xs'
                  : 'border-slate-200 bg-white hover:bg-slate-50'
              }`}
            >
              <div className="flex items-center justify-between w-full">
                <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
                  <Truck className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                </div>
                {choice === 'partner' && <CheckCircle2 className="w-4 h-4 sm:w-5 sm:h-5 text-amber-600 shrink-0" />}
              </div>
              <div>
                <div className="font-black text-slate-900 text-[11px] sm:text-xs leading-tight">
                  ليفري من طرف الشريك
                </div>
                <div className="text-[10px] sm:text-[11px] text-slate-600 mt-0.5 leading-snug">
                  احتساب ثمن التوصيل للشريك والربح الصافي
                </div>
              </div>
            </button>

            {/* Option 2: Admin */}
            <button
              type="button"
              disabled={isSubmitting}
              onClick={() => setChoice('admin')}
              className={`p-2.5 sm:p-3.5 rounded-xl border-2 text-right transition cursor-pointer flex flex-col justify-between gap-1.5 sm:gap-2 ${
                choice === 'admin'
                  ? 'border-emerald-600 bg-emerald-50/70 shadow-xs'
                  : 'border-slate-200 bg-white hover:bg-slate-50'
              }`}
            >
              <div className="flex items-center justify-between w-full">
                <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                  <Building2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                </div>
                {choice === 'admin' && <CheckCircle2 className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-600 shrink-0" />}
              </div>
              <div>
                <div className="font-black text-slate-900 text-[11px] sm:text-xs leading-tight">
                  ليفري من طرف الإدارة
                </div>
                <div className="text-[10px] sm:text-[11px] text-slate-600 mt-0.5 leading-snug">
                  توصيل مباشر (أتعاب الشريك = 0 DH)
                </div>
              </div>
            </button>
          </div>

          {/* Partner Fee Input & Live Profit Calculation */}
          {choice === 'partner' ? (
            <div className="p-3 sm:p-4 bg-amber-50/60 border border-amber-200 rounded-xl space-y-2.5 sm:space-y-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-800 mb-1">
                  بشحال حاسب ليك الشريك التوصيل لمدينة « {pkg.city} » (DH) :
                </label>
                <input
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="0.5"
                  value={partnerFeeInput}
                  disabled={isSubmitting}
                  onChange={e => setPartnerFeeInput(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-amber-300 rounded-lg font-mono font-black text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div className="bg-white p-2.5 sm:p-3 rounded-xl border border-amber-200/80 space-y-1.5">
                <div className="flex justify-between items-center gap-2 text-slate-600">
                  <span>ثمن التوصيل للزبون :</span>
                  <span dir="ltr" className="font-mono font-bold text-slate-900 shrink-0">
                    {formatMAD(clientDeliveryFee)}
                  </span>
                </div>
                <div className="flex justify-between items-center gap-2 text-rose-600">
                  <span className="truncate">ثمن توصيل الشريك ({partnerLabel}) :</span>
                  <span dir="ltr" className="font-mono font-bold shrink-0">
                    - {formatMAD(parsedPartnerFee)}
                  </span>
                </div>
                <div className="pt-1.5 border-t border-slate-100 flex justify-between items-center gap-2">
                  <span className="font-black text-slate-900 flex items-center gap-1">
                    <TrendingUp className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <span>الربح الصافي ديالك :</span>
                  </span>
                  <span
                    dir="ltr"
                    className={`font-mono font-black text-sm sm:text-base shrink-0 ${
                      partnerProfit >= 0 ? 'text-emerald-600' : 'text-rose-600'
                    }`}
                  >
                    {partnerProfit >= 0 ? `+${formatMAD(partnerProfit)}` : formatMAD(partnerProfit)}
                  </span>
                </div>
                <div className="flex justify-between items-center gap-2 text-[10px] sm:text-[11px] text-slate-500 pt-1">
                  <span>الصافي المستحق من الشريك (COD - التوصيل) :</span>
                  <span dir="ltr" className="font-mono font-bold text-slate-800 shrink-0">
                    {formatMAD(netFromPartner)}
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <div className="p-3 sm:p-4 bg-emerald-50/70 border border-emerald-200 rounded-xl space-y-2">
              <div className="flex items-center gap-1.5 font-bold text-emerald-900">
                <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>توصيل من طرف الإدارة (بدون اقتطاع أتعاب الشريك)</span>
              </div>
              <div className="bg-white p-2.5 sm:p-3 rounded-xl border border-emerald-200/80 space-y-1.5">
                <div className="flex justify-between items-center gap-2 text-slate-600">
                  <span>ثمن التوصيل للزبون :</span>
                  <span dir="ltr" className="font-mono font-bold text-slate-900 shrink-0">
                    {formatMAD(clientDeliveryFee)}
                  </span>
                </div>
                <div className="flex justify-between items-center gap-2 text-slate-600">
                  <span>أتعاب الشريك :</span>
                  <span dir="ltr" className="font-mono font-bold text-slate-900 shrink-0">
                    0.00 DH
                  </span>
                </div>
                {adminExpense > 0 && (
                  <div className="flex justify-between items-center gap-2 text-rose-600">
                    <span className="truncate">عمولة السائق ({pkg.driverName}) :</span>
                    <span dir="ltr" className="font-mono font-bold shrink-0">
                      - {formatMAD(adminExpense)}
                    </span>
                  </div>
                )}
                <div className="pt-1.5 border-t border-slate-100 flex justify-between items-center gap-2">
                  <span className="font-black text-slate-900">الربح الصافي ديالك :</span>
                  <span dir="ltr" className="font-mono font-black text-sm sm:text-base text-emerald-600 shrink-0">
                    +{formatMAD(adminProfit)}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Buttons (Always pinned & visible) */}
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
            type="button"
            disabled={isSubmitting}
            onClick={handleConfirm}
            className="flex-1 sm:flex-none justify-center px-5 py-2.5 sm:py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 active:scale-95 rounded-xl shadow-xs transition cursor-pointer disabled:opacity-50 inline-flex items-center gap-1.5"
          >
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{isSubmitting ? 'جاري التسجيل...' : 'تأكيد التسليم (Livré)'}</span>
          </button>
        </div>
      </div>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(modalContent, document.body) : modalContent;
};
