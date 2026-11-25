import React, { useState, useEffect } from 'react';
import { PackageItem } from '../types';
import QRCode from 'qrcode';
import {
  Printer,
  X,
  Copy,
  Check,
  Settings2,
  Download,
  Share2,
  CheckCircle2,
  Loader2,
  FileText,
  Smartphone
} from 'lucide-react';
import {
  downloadTicketPdf,
  downloadTicketPng,
  getMoroccanRegion,
  printTicket100x100,
  TicketRenderOptions
} from '../utils/thermalTicketPdf';

interface ThermalLabelModalProps {
  packageItem: PackageItem | null;
  isOpen: boolean;
  onClose: () => void;
}

export const ThermalLabelModal: React.FC<ThermalLabelModalProps> = ({
  packageItem,
  isOpen,
  onClose
}) => {
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [copied, setCopied] = useState(false);
  const [canOpen, setCanOpen] = useState(true);
  const [allowTry, setAllowTry] = useState(false);
  const [isFragile, setIsFragile] = useState(false);
  const [showOptions, setShowOptions] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);
  const [isDownloadingPng, setIsDownloadingPng] = useState(false);
  const [printSuccessNotice, setPrintSuccessNotice] = useState<string | null>(null);

  // Customizable ticket fields with smart defaults
  const [vendeurName, setVendeurName] = useState('');
  const [vendeurPhone, setVendeurPhone] = useState('');
  const [vendeurAddress, setVendeurAddress] = useState('');
  const [productName, setProductName] = useState('كرطونة');
  const [quantity, setQuantity] = useState('1');
  const [comment, setComment] = useState('شكرا لثقتكم');
  const [codAmount, setCodAmount] = useState<number>(0);
  const [agencyAddress, setAgencyAddress] = useState('Lotissement al aouda');

  useEffect(() => {
    if (packageItem) {
      setVendeurName(packageItem.clientCompany || packageItem.clientName || 'FARIOUSY CLIENT');
      setVendeurPhone(packageItem.clientPhone || '--');
      setVendeurAddress(packageItem.currentAgency || '--');
      setProductName(packageItem.description || 'كرطونة');
      setQuantity('1');
      setComment(packageItem.notes || 'شكرا لثقتكم');
      setCodAmount(packageItem.codAmount ?? 0);
      setCanOpen(packageItem.allowOpen !== undefined ? Boolean(packageItem.allowOpen) : true);
      setAllowTry(Boolean(packageItem.allowTry));
      setIsFragile(Boolean(packageItem.isFragile));

      // Generate Crisp QR Code
      QRCode.toDataURL(packageItem.trackingNumber, {
        margin: 1,
        width: 256,
        color: {
          dark: '#000000',
          light: '#ffffff'
        },
        errorCorrectionLevel: 'M'
      })
        .then(url => setQrDataUrl(url))
        .catch(err => console.error('Failed to generate QR code', err));
    }
  }, [packageItem]);

  if (!isOpen || !packageItem) return null;

  const ticketOptions: TicketRenderOptions = {
    vendeurName,
    vendeurPhone,
    vendeurAddress,
    productName,
    quantity,
    comment,
    codAmount,
    agencyAddress,
    canOpen,
    allowTry,
    isFragile
  };

  const handlePrint = async () => {
    setIsPrinting(true);
    setPrintSuccessNotice(null);
    try {
      await printTicket100x100(packageItem, ticketOptions);
      setPrintSuccessNotice('تم إرسال التيكي بمقاس 100×100 مم للطابعة بنجاح');
      setTimeout(() => setPrintSuccessNotice(null), 3500);
    } catch (e) {
      console.error(e);
      window.print();
    } finally {
      setIsPrinting(false);
    }
  };

  const handleDownloadPDF = async () => {
    setIsDownloadingPdf(true);
    setPrintSuccessNotice(null);
    try {
      await downloadTicketPdf(packageItem, ticketOptions);
      setPrintSuccessNotice('تم تحميل ملف PDF بمقاس 100×100 مم بنجاح');
      setTimeout(() => setPrintSuccessNotice(null), 3500);
    } catch (err) {
      console.error('Failed to export PDF ticket:', err);
    } finally {
      setIsDownloadingPdf(false);
    }
  };

  const handleDownloadPNG = async () => {
    setIsDownloadingPng(true);
    setPrintSuccessNotice(null);
    try {
      await downloadTicketPng(packageItem, ticketOptions);
      setPrintSuccessNotice('تم تنزيل صورة التذكرة 100×100 (PNG) بنجاح');
      setTimeout(() => setPrintSuccessNotice(null), 3500);
    } catch (err) {
      console.error('Failed to export PNG ticket:', err);
    } finally {
      setIsDownloadingPng(false);
    }
  };

  const handleCopyTracking = () => {
    navigator.clipboard.writeText(packageItem.trackingNumber);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShareWhatsApp = () => {
    if (!packageItem) return;
    const msg = `📦 *تذكرة الشحن FARIOUSY DELIVERY (100×100)*\n` +
      `🔢 رقم التتبع : *${packageItem.trackingNumber}*\n` +
      `👤 المشتري : *${packageItem.recipientName}*\n` +
      `📱 الهاتف : ${packageItem.recipientPhone}\n` +
      `📍 المدينة : ${packageItem.city}\n` +
      `💰 المبلغ المطلوب (CRBT) : *${codAmount} DH*\n` +
      `🏢 البائع : ${vendeurName}\n` +
      `📦 فتح الطرد : ${canOpen ? 'Oui (نعم)' : 'Non (لا)'} | القياس : ${allowTry ? 'Oui (نعم)' : 'Non (لا)'}\n` +
      (isFragile ? `⚠️ *ATTENTION FRAGILE* — طرد قابل للكسر\n` : '') +
      (packageItem.isExchange ? `🔄 *طرد استبدال* - استرجاع الطرد السابق\n` : '') +
      `🌐 رابط التتبع المباشر : https://fariousy.com/track/${packageItem.trackingNumber}`;

    const url = `https://wa.me/?text=${encodeURIComponent(msg)}`;
    window.open(url, '_blank');
  };

  const regionName = getMoroccanRegion(packageItem.city);

  return (
    <>
      {/* ================= SCREEN MODAL ================= */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/70 backdrop-blur-xs no-print overflow-y-auto">
        <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col my-auto max-h-[95vh]">
          {/* Modal Header */}
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100 bg-slate-50">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-red-600 text-white flex items-center justify-center font-bold">
                <Printer className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm sm:text-base font-bold text-slate-900 leading-tight">
                  تذكرة الشحن الحرارية (100×100 مم)
                </h3>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-xs font-mono font-bold text-red-600">{packageItem.trackingNumber}</span>
                  <span className="text-[11px] font-semibold text-slate-500">• مقاس 100×100 مم مضبوط على الورقة الحرارية</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setShowOptions(!showOptions)}
                className={`p-2 rounded-lg border text-xs font-medium flex items-center gap-1 transition-colors cursor-pointer ${
                  showOptions ? 'bg-red-50 border-red-200 text-red-600' : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                }`}
                title="تعديل خيارات التذكرة"
              >
                <Settings2 className="w-4 h-4" />
                <span className="hidden sm:inline">خيارات التيكي</span>
              </button>
              <button
                onClick={onClose}
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                title="إغلاق"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Quick Options Bar (collapsible) */}
          {showOptions && (
            <div className="px-5 py-3 bg-slate-50 border-b border-slate-200 text-xs text-slate-700 grid grid-cols-1 sm:grid-cols-3 gap-3 animate-fadeIn">
              <div>
                <label className="block font-bold text-slate-800 mb-1">فتح الطرد (Ouvrir) :</label>
                <select
                  value={canOpen ? 'yes' : 'no'}
                  onChange={e => setCanOpen(e.target.value === 'yes')}
                  className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 font-bold"
                >
                  <option value="yes">Oui — OUVRIR LE COLIS (مسموح بالفتح)</option>
                  <option value="no">Non — NE PAS OUVRIR (ممنوع الفتح)</option>
                </select>
              </div>
              <div>
                <label className="block font-bold text-slate-800 mb-1">القياس (Essayage) :</label>
                <select
                  value={allowTry ? 'yes' : 'no'}
                  onChange={e => setAllowTry(e.target.value === 'yes')}
                  className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 font-bold"
                >
                  <option value="yes">Oui — ESSAYAGE AUTORISÉ (مسموح)</option>
                  <option value="no">Non — PAS D&apos;ESSAYAGE (ممنوع)</option>
                </select>
              </div>
              <div>
                <label className="block font-bold text-rose-700 mb-1">Attention FRAGILE (قابل للكسر) :</label>
                <select
                  value={isFragile ? 'yes' : 'no'}
                  onChange={e => setIsFragile(e.target.value === 'yes')}
                  className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 font-bold"
                >
                  <option value="yes">Oui — ATTENTION FRAGILE (قابل للكسر)</option>
                  <option value="no">Non — Standard (عادي)</option>
                </select>
              </div>
              <div>
                <label className="block font-bold text-slate-800 mb-1">اسم المنتوج (Produit) :</label>
                <input
                  type="text"
                  value={productName}
                  onChange={e => setProductName(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 font-medium"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-800 mb-1">الكمية (Quantité) :</label>
                <input
                  type="text"
                  value={quantity}
                  onChange={e => setQuantity(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 font-medium"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-800 mb-1">ملاحظة التيكي (Commentaire) :</label>
                <input
                  type="text"
                  value={comment}
                  onChange={e => setComment(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 font-medium"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-800 mb-1">المبلغ عند الاستلام (CRBT) :</label>
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    value={codAmount}
                    onChange={e => setCodAmount(Number(e.target.value))}
                    className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 font-bold text-red-600"
                  />
                  <span className="font-bold">DH</span>
                </div>
              </div>
              <div>
                <label className="block font-bold text-slate-800 mb-1">عنوان الفرع / الإيداع :</label>
                <input
                  type="text"
                  value={agencyAddress}
                  onChange={e => setAgencyAddress(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5"
                />
              </div>
            </div>
          )}

          {/* Ticket Preview Container (100x100 Square Aspect Ratio) */}
          <div className="p-4 sm:p-5 overflow-y-auto flex flex-col items-center justify-center bg-slate-200/80">
            <div className="mb-2 flex items-center justify-between w-full max-w-[420px] text-[11px] text-slate-700 px-1">
              <span className="font-bold">معاينة التذكرة (مقاس 100×100 مم كامل)</span>
              <button
                type="button"
                onClick={handleCopyTracking}
                className="flex items-center gap-1 text-red-600 hover:text-red-700 font-bold cursor-pointer"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'تم النسخ!' : 'نسخ الكود'}</span>
              </button>
            </div>

            {/* ================= THE 100x100 SQUARE THERMAL TICKET PREVIEW ================= */}
            <div className="bg-white shadow-lg border border-slate-300 p-1">
              <div
                id="fariousy-thermal-ticket"
                dir="ltr"
                className="w-[340px] sm:w-[420px] aspect-square bg-white border-[2.5px] border-black text-black font-sans select-none flex flex-col"
                style={{
                  fontFamily: "'Cairo', 'Plus Jakarta Sans', Arial, sans-serif"
                }}
              >
                {/* TOP ROW (~27% height): LEFT DOUBLE-BOXED GRID + RIGHT QR COLUMN */}
                <div className="grid grid-cols-[2.72fr_1fr] h-[27%] border-b-[2px] border-black shrink-0">
                  {/* Left & Middle Double-Boxed Grid */}
                  <div className="border-r-[2px] border-black flex flex-col h-full">
                    {/* Top Sub-Row: Logo/Brand + CRBT */}
                    <div className="grid grid-cols-[1.52fr_1fr] flex-[1.9] border-b border-black">
                      <div className="p-[2px] border-r border-black">
                        <div className="border border-black p-1.5 h-full flex items-center gap-2">
                          <div className="w-11 h-9 sm:w-12 sm:h-10 relative overflow-hidden shrink-0">
                            <img
                              src="/fariousy-logo.jpeg"
                              alt="FARIOUSY"
                              className="absolute max-w-none"
                              style={{ width: '208%', height: '250%', left: '-47%', top: '-64%' }}
                            />
                          </div>
                          <div className="flex flex-col leading-tight min-w-0 text-[8.5px]">
                            <span className="font-extrabold text-[10px] text-black uppercase">
                              FARIOUSY
                            </span>
                            <span className="font-medium text-black truncate">
                              fariousy.com
                            </span>
                            <span className="font-medium text-black leading-tight line-clamp-2">
                              {agencyAddress || 'Lotissement al aouda'}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="p-[2px]">
                        <div className="border border-black p-1 h-full flex flex-col items-center justify-center text-center">
                          <span className="text-[9px] font-extrabold uppercase text-black leading-tight">
                            CRBT
                          </span>
                          <span className="text-[14px] sm:text-[15px] font-black text-black leading-tight mt-0.5">
                            {codAmount} DH
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Bottom Sub-Row: Region | --- | OUVRIR LE COLIS */}
                    <div className="grid grid-cols-[1.18fr_0.34fr_1fr] flex-1">
                      <div className="p-[2px] border-r border-black">
                        <div className="border border-black px-1 py-0.5 h-full flex items-center justify-center text-center">
                          <span className="font-extrabold text-[9.5px] sm:text-[10.5px] text-black truncate leading-tight">
                            {regionName}
                          </span>
                        </div>
                      </div>
                      <div className="p-[2px] border-r border-black">
                        <div className="border border-black px-1 py-0.5 h-full flex items-center justify-center text-center">
                          <span className="font-extrabold text-[10px] text-black leading-tight">
                            ---
                          </span>
                        </div>
                      </div>
                      <div className="p-[2px]">
                        <div className="border border-black px-1 py-0.5 h-full flex flex-col items-center justify-center text-center leading-tight">
                          <span className="font-extrabold text-[7.5px] sm:text-[8.5px] text-black uppercase leading-tight">
                            {canOpen ? 'OUVRIR LE COLIS' : 'NE PAS OUVRIR LE COLIS'}
                          </span>
                          <span className="font-extrabold text-[7px] sm:text-[8px] text-black uppercase leading-tight mt-0.5">
                            {allowTry ? 'ESSAYAGE : OUI' : 'ESSAYAGE : NON'}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Right: QR Code + Tracking Number */}
                  <div className="p-1.5 flex flex-col items-center justify-between text-center h-full">
                    {qrDataUrl ? (
                      <img
                        src={qrDataUrl}
                        alt={packageItem.trackingNumber}
                        className="w-[68px] h-[68px] sm:w-[78px] sm:h-[78px] object-contain"
                      />
                    ) : (
                      <div className="w-[68px] h-[68px] bg-slate-100 flex items-center justify-center text-[9px] font-mono">
                        QR...
                      </div>
                    )}
                    <span className="text-[7.5px] sm:text-[8.5px] font-extrabold tracking-tight text-black leading-none truncate max-w-full">
                      {packageItem.trackingNumber}
                    </span>
                  </div>
                </div>

                {/* FRAGILE BANNER IF APPLICABLE */}
                {isFragile && (
                  <div className="bg-black text-white px-2 py-0.5 border-b-[2px] border-black text-center font-black shrink-0">
                    <div className="text-[9.5px] tracking-wider uppercase leading-tight">
                      ⚠ ATTENTION FRAGILE — قابل للكسر
                    </div>
                  </div>
                )}

                {/* EXCHANGE BANNER IF APPLICABLE */}
                {packageItem.isExchange && (
                  <div className="bg-black text-white px-2 py-1 border-b-[2px] border-black text-center font-black shrink-0">
                    <div className="text-[9px] tracking-wide uppercase leading-tight">
                      COLIS D&apos;ÉCHANGE (طرد استبدال)
                    </div>
                    <div className="text-[8px] font-mono font-bold leading-tight">
                      REPRENDRE : {packageItem.exchangeTrackingNumber || 'NON PRÉCISÉ'}
                    </div>
                  </div>
                )}

                {/* SECOND ROW (~37% height): VENDEUR VS CLIENT */}
                <div className="grid grid-cols-2 flex-[1.5] border-b-[2px] border-black min-h-0">
                  {/* Left: Vendeur */}
                  <div className="p-2.5 border-r-[2px] border-black text-black flex flex-col justify-start">
                    <div className="font-extrabold text-[14px] sm:text-[15px] text-black leading-tight mb-1.5">
                      vendeur &lrm;(البائع)&lrm; :
                    </div>
                    <div className="font-extrabold text-[11.5px] sm:text-[12.5px] text-black leading-snug line-clamp-2">
                      {vendeurName}
                    </div>
                    <div className="font-extrabold text-[11.5px] sm:text-[12.5px] text-black leading-snug">
                      {vendeurPhone}
                    </div>
                    {vendeurAddress && vendeurAddress !== '--' && (
                      <div className="font-bold text-[10.5px] sm:text-[11.5px] text-black leading-snug line-clamp-2">
                        {vendeurAddress}
                      </div>
                    )}
                  </div>

                  {/* Right: Client */}
                  <div className="p-2.5 text-black flex flex-col justify-start">
                    <div className="font-extrabold text-[14px] sm:text-[15px] text-black leading-tight mb-1.5">
                      client &lrm;( المشتري )&lrm; :
                    </div>
                    <div className="font-extrabold text-[11.5px] sm:text-[12.5px] text-black leading-snug line-clamp-2">
                      {packageItem.recipientName}
                    </div>
                    <div className="text-[10.5px] sm:text-[11.5px] text-black leading-snug">
                      <span className="font-bold">Téléphone : </span>
                      <span className="font-medium">
                        {packageItem.recipientPhone}
                        {packageItem.recipientPhone2 ? ` / ${packageItem.recipientPhone2}` : ''}
                      </span>
                    </div>
                    <div className="text-[10.5px] sm:text-[11.5px] text-black leading-snug line-clamp-3">
                      <span className="font-bold">Adresse : </span>
                      <span className="font-medium">{packageItem.address}</span>
                    </div>
                    <div className="text-[10.5px] sm:text-[11.5px] text-black leading-snug">
                      <span className="font-bold">Ville : </span>
                      <span className="font-medium">{packageItem.city}</span>
                    </div>
                  </div>
                </div>

                {/* THIRD ROW (~24% height): PRODUIT & QUANTITÉ VS CENTERED COMMENTAIRE */}
                <div className="grid grid-cols-2 flex-1 border-b-[2px] border-black min-h-0">
                  <div className="p-2.5 border-r-[2px] border-black text-black flex flex-col justify-center gap-1.5">
                    <div className="text-[10.5px] sm:text-[11px] text-black leading-tight line-clamp-2">
                      <span className="font-bold">Produit : </span>
                      <span className="font-medium">{productName}</span>
                    </div>
                    <div className="text-[10.5px] sm:text-[11px] text-black leading-tight">
                      <span className="font-bold">Quantité : </span>
                      <span className="font-medium">{quantity}</span>
                    </div>
                  </div>
                  <div className="p-2.5 text-black flex flex-col items-center justify-center text-center">
                    <div className="font-bold text-[10.5px] sm:text-[11px] text-black leading-tight">
                      Commentaire :
                    </div>
                    <div className="text-[10.5px] sm:text-[11px] text-black font-medium leading-tight line-clamp-2 mt-1.5">
                      {comment}
                    </div>
                  </div>
                </div>

                {/* FOURTH ROW (~12% height): 2-LINE ARABIC FOOTER DISCLAIMER */}
                <div className="h-[12%] px-2 text-center text-black bg-white shrink-0 flex flex-col items-center justify-center" dir="rtl">
                  <div className="font-extrabold text-[12px] sm:text-[13px] text-black leading-tight">
                    ملاحظة
                  </div>
                  <div className="font-semibold text-[10px] sm:text-[11px] text-black leading-tight mt-0.5">
                    فاريوسي شركة مكلفة بالتوصيل فقط
                  </div>
                </div>
              </div>
            </div>
            {/* ================= END 100x100 SQUARE THERMAL TICKET ================= */}
          </div>

          {/* Success / Status Feedback Alert */}
          {printSuccessNotice && (
            <div className="mx-5 my-2 px-3 py-2 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs flex items-center justify-between animate-fadeIn">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span className="font-bold">{printSuccessNotice}</span>
              </div>
              <span className="text-[10px] font-bold text-emerald-700">100×100 mm</span>
            </div>
          )}

          {/* Modal Footer Controls */}
          <div className="flex flex-col sm:flex-row items-center justify-between px-5 py-3.5 border-t border-slate-100 bg-white gap-3">
            <div className="text-[11px] text-slate-500 text-center sm:text-left flex items-center gap-1.5">
              <Smartphone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <span>مقاس حراري مضبوط 100×100 مم يملأ الورقة بالكامل (طابعات التيكي + PDF)</span>
            </div>

            <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto justify-end">
              <button
                type="button"
                onClick={handleShareWhatsApp}
                className="flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-xl transition cursor-pointer"
                title="مشاركة تفاصيل الطرد عبر الواتساب"
              >
                <Share2 className="w-3.5 h-3.5" />
                <span>واتساب</span>
              </button>

              <button
                type="button"
                onClick={handleDownloadPNG}
                disabled={isDownloadingPng}
                className="flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded-xl transition cursor-pointer disabled:opacity-50"
                title="تنزيل التيكي كصورة حرارية عالية الدقة"
              >
                {isDownloadingPng ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5 text-blue-600" />}
                <span>PNG</span>
              </button>

              <button
                type="button"
                onClick={handleDownloadPDF}
                disabled={isDownloadingPdf}
                className="flex items-center justify-center gap-1.5 px-3.5 py-2 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 active:scale-95 rounded-xl shadow-sm transition-all cursor-pointer disabled:opacity-50"
                title="تحميل التذكرة بصيغة PDF مقاس 100×100 مم"
              >
                {isDownloadingPdf ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileText className="w-3.5 h-3.5 text-red-400" />}
                <span>{isDownloadingPdf ? 'جاري التحويل...' : 'تحميل PDF'}</span>
              </button>

              <button
                type="button"
                onClick={handlePrint}
                disabled={isPrinting}
                className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 text-xs font-bold text-white bg-red-600 hover:bg-red-700 active:scale-95 rounded-xl shadow-md transition-all cursor-pointer disabled:opacity-50"
              >
                {isPrinting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Printer className="w-4 h-4" />}
                <span>{isPrinting ? 'جاري فتح الطابعة...' : 'طباعة التيكي'}</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ================= PRINT DEDICATED FALLBACK VIEW (@media print) ================= */}
      <div className="print-only print-ticket-area" dir="ltr">
        <div
          className="w-[98mm] h-[98mm] bg-white border-[2.5px] border-black text-black font-sans mx-auto flex flex-col"
          style={{
            fontFamily: "'Cairo', 'Plus Jakarta Sans', Arial, sans-serif"
          }}
        >
          {/* TOP ROW (~27%) */}
          <div className="grid grid-cols-[2.72fr_1fr] h-[27%] border-b-[2px] border-black shrink-0">
            <div className="border-r-[2px] border-black flex flex-col h-full">
              <div className="grid grid-cols-[1.52fr_1fr] flex-[1.9] border-b border-black">
                <div className="p-[2px] border-r border-black">
                  <div className="border border-black p-1.5 h-full flex items-center gap-2">
                    <div className="w-11 h-9 relative overflow-hidden shrink-0">
                      <img
                        src="/fariousy-logo.jpeg"
                        alt="FARIOUSY"
                        className="absolute max-w-none"
                        style={{ width: '208%', height: '250%', left: '-47%', top: '-64%' }}
                      />
                    </div>
                    <div className="flex flex-col leading-tight text-[8.5px]">
                      <span className="font-extrabold text-[10px] uppercase">FARIOUSY</span>
                      <span className="font-medium">fariousy.com</span>
                      <span className="font-medium leading-tight">{agencyAddress || 'Lotissement al aouda'}</span>
                    </div>
                  </div>
                </div>

                <div className="p-[2px]">
                  <div className="border border-black p-1 h-full flex flex-col items-center justify-center text-center">
                    <span className="text-[9px] font-extrabold uppercase leading-tight">CRBT</span>
                    <span className="text-[14px] font-black leading-tight mt-0.5">{codAmount} DH</span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-[1.18fr_0.34fr_1fr] flex-1">
                <div className="p-[2px] border-r border-black">
                  <div className="border border-black px-1 py-0.5 h-full flex items-center justify-center text-center">
                    <span className="font-extrabold text-[10px] leading-tight">{regionName}</span>
                  </div>
                </div>
                <div className="p-[2px] border-r border-black">
                  <div className="border border-black px-1 py-0.5 h-full flex items-center justify-center text-center">
                    <span className="font-extrabold text-[10px] leading-tight">---</span>
                  </div>
                </div>
                <div className="p-[2px]">
                  <div className="border border-black px-1 py-0.5 h-full flex flex-col items-center justify-center text-center leading-tight">
                    <span className="font-extrabold text-[8px] uppercase leading-tight">
                      {canOpen ? 'OUVRIR LE COLIS' : 'NE PAS OUVRIR LE COLIS'}
                    </span>
                    <span className="font-extrabold text-[7.5px] uppercase leading-tight mt-0.5">
                      {allowTry ? 'ESSAYAGE : OUI' : 'ESSAYAGE : NON'}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-1.5 flex flex-col items-center justify-between text-center h-full">
              {qrDataUrl && (
                <img
                  src={qrDataUrl}
                  alt={packageItem.trackingNumber}
                  className="w-[18mm] h-[18mm] object-contain"
                />
              )}
              <span className="text-[8px] font-extrabold leading-none">
                {packageItem.trackingNumber}
              </span>
            </div>
          </div>

          {/* FRAGILE BANNER */}
          {isFragile && (
            <div className="bg-black text-white px-2 py-0.5 border-b-[2px] border-black text-center font-black shrink-0">
              <div className="text-[9.5px] uppercase tracking-wider">⚠ ATTENTION FRAGILE — قابل للكسر</div>
            </div>
          )}

          {/* EXCHANGE BANNER */}
          {packageItem.isExchange && (
            <div className="bg-black text-white px-2 py-1 border-b-[2px] border-black text-center font-black shrink-0">
              <div className="text-[9.5px] uppercase">COLIS D&apos;ÉCHANGE (طرد استبدال)</div>
              <div className="text-[8px] font-mono font-bold">
                REPRENDRE : {packageItem.exchangeTrackingNumber || 'NON PRÉCISÉ'}
              </div>
            </div>
          )}

          {/* VENDEUR VS CLIENT (~37%) */}
          <div className="grid grid-cols-2 flex-[1.5] border-b-[2px] border-black min-h-0">
            <div className="p-2.5 border-r-[2px] border-black">
              <div className="font-extrabold text-[14px] leading-tight mb-1.5">vendeur &lrm;(البائع)&lrm; :</div>
              <div className="font-extrabold text-[12px] leading-snug">{vendeurName}</div>
              <div className="font-extrabold text-[12px] leading-snug">{vendeurPhone}</div>
              {vendeurAddress && vendeurAddress !== '--' && (
                <div className="font-bold text-[11px] leading-snug">{vendeurAddress}</div>
              )}
            </div>
            <div className="p-2.5">
              <div className="font-extrabold text-[14px] leading-tight mb-1.5">client &lrm;( المشتري )&lrm; :</div>
              <div className="font-extrabold text-[12px] leading-snug">{packageItem.recipientName}</div>
              <div className="text-[11px] leading-snug">
                <span className="font-bold">Téléphone : </span>
                <span className="font-medium">
                  {packageItem.recipientPhone}
                  {packageItem.recipientPhone2 ? ` / ${packageItem.recipientPhone2}` : ''}
                </span>
              </div>
              <div className="text-[11px] leading-snug">
                <span className="font-bold">Adresse : </span>
                <span className="font-medium">{packageItem.address}</span>
              </div>
              <div className="text-[11px] leading-snug">
                <span className="font-bold">Ville : </span>
                <span className="font-medium">{packageItem.city}</span>
              </div>
            </div>
          </div>

          {/* PRODUIT & COMMENTAIRE (~24%) */}
          <div className="grid grid-cols-2 flex-1 border-b-[2px] border-black min-h-0">
            <div className="p-2.5 border-r-[2px] border-black flex flex-col justify-center gap-1.5">
              <div className="text-[11px] leading-tight">
                <span className="font-bold">Produit : </span>
                <span className="font-medium">{productName}</span>
              </div>
              <div className="text-[11px] leading-tight">
                <span className="font-bold">Quantité : </span>
                <span className="font-medium">{quantity}</span>
              </div>
            </div>
            <div className="p-2.5 flex flex-col items-center justify-center text-center">
              <div className="font-bold text-[11px] leading-tight">Commentaire :</div>
              <div className="text-[11px] font-medium leading-tight mt-1.5">{comment}</div>
            </div>
          </div>

          {/* FOOTER (~12%) */}
          <div className="h-[12%] px-2 text-center shrink-0 flex flex-col items-center justify-center" dir="rtl">
            <div className="font-extrabold text-[12.5px] leading-tight">ملاحظة</div>
            <div className="font-semibold text-[10.5px] leading-tight mt-0.5">
              فاريوسي شركة مكلفة بالتوصيل فقط
            </div>
          </div>
        </div>
      </div>
    </>
  );
};
