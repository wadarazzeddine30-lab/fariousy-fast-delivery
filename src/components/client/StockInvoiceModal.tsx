import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { ClientStockInvoice } from '../../types';
import { useDatabase } from '../../context/DatabaseContext';
import { useLanguage } from '../../i18n/LanguageContext';
import { formatDateTime, formatMAD } from '../../utils/barcode';
import { Printer, X, CheckCircle2, FileText, PackageCheck, Building2 } from 'lucide-react';

interface StockInvoiceModalProps {
  invoice: ClientStockInvoice | null;
  isOpen: boolean;
  onClose: () => void;
  canMarkPaid?: boolean;
}

export const StockInvoiceModal: React.FC<StockInvoiceModalProps> = ({
  invoice,
  isOpen,
  onClose,
  canMarkPaid = false
}) => {
  const { companySettings, updateClientStockInvoiceStatus } = useDatabase();
  const { language, isRtl } = useLanguage();
  const isAr = language === 'ar';
  const [qrUrl, setQrUrl] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);

  useEffect(() => {
    if (invoice) {
      QRCode.toDataURL(`${invoice.invoiceNumber}|${invoice.trackingNumber}`, {
        margin: 1,
        width: 140,
        color: { dark: '#0f172a', light: '#ffffff' }
      })
        .then(setQrUrl)
        .catch(() => setQrUrl(''));
    }
  }, [invoice]);

  if (!isOpen || !invoice) return null;

  const handlePrint = () => {
    const el = document.getElementById('printable-stock-invoice');
    if (!el) {
      window.print();
      return;
    }

    const oldFrame = document.getElementById('fariousy-stock-invoice-iframe');
    if (oldFrame) oldFrame.remove();

    const iframe = document.createElement('iframe');
    iframe.id = 'fariousy-stock-invoice-iframe';
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '10px';
    iframe.style.height = '10px';
    iframe.style.opacity = '0';
    iframe.style.border = '0';
    iframe.style.pointerEvents = 'none';
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow?.document || iframe.contentDocument;
    if (!doc) {
      window.print();
      return;
    }

    doc.open();
    doc.write(`
      <!DOCTYPE html>
      <html dir="${isAr ? 'rtl' : 'ltr'}" lang="${isAr ? 'ar' : 'fr'}">
        <head>
          <meta charset="utf-8" />
          <title>${invoice.invoiceNumber}</title>
          <style>
            * { box-sizing: border-box; margin: 0; padding: 0; }
            body {
              font-family: 'Cairo', 'Plus Jakarta Sans', Arial, sans-serif;
              color: #0f172a;
              background: #fff;
              padding: 24px;
              font-size: 12px;
            }
            .card { border: 1px solid #cbd5e1; border-radius: 12px; padding: 20px; }
            .row { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; }
            .grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin: 16px 0; }
            .box { border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px 12px; background: #f8fafc; }
            table { width: 100%; border-collapse: collapse; margin-top: 12px; }
            th, td { border: 1px solid #cbd5e1; padding: 8px 10px; text-align: ${isAr ? 'right' : 'left'}; vertical-align: top; }
            th { background: #f1f5f9; font-size: 11px; text-transform: uppercase; }
            .mono { font-family: monospace; }
            .badge { display: inline-block; padding: 2px 6px; border-radius: 4px; background: #e2e8f0; font-size: 10px; margin: 2px; font-family: monospace; }
            .totals { margin-top: 16px; width: 280px; margin-${isAr ? 'right' : 'left'}: auto; border: 1px solid #cbd5e1; border-radius: 8px; padding: 12px; background: #f8fafc; }
            .totals-row { display: flex; justify-content: space-between; margin-bottom: 6px; }
            .totals-final { border-top: 2px solid #0f172a; padding-top: 8px; margin-top: 6px; font-weight: 900; font-size: 14px; color: #b91c1c; }
            img.thumb { width: 42px; height: 42px; object-fit: cover; border-radius: 6px; border: 1px solid #cbd5e1; }
            @media print { body { padding: 10px; } }
          </style>
        </head>
        <body>
          ${el.innerHTML}
        </body>
      </html>
    `);
    doc.close();
    setTimeout(() => {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
    }, 300);
  };

  const handleTogglePaid = async () => {
    setIsUpdating(true);
    await updateClientStockInvoiceStatus(invoice.id, invoice.status === 'payee' ? 'generee' : 'payee');
    setIsUpdating(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/65 backdrop-blur-xs no-print">
      <div className="bg-white rounded-2xl max-w-3xl w-full shadow-2xl overflow-hidden flex flex-col max-h-[92vh]" dir={isRtl ? 'rtl' : 'ltr'}>
        {/* Top Modal Controls */}
        <div className="px-5 py-3.5 bg-slate-900 text-white flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <FileText className="w-5 h-5 text-red-400" />
            <div>
              <h3 className="text-sm font-black">
                {isAr ? `فاتورة سحب السطوك — ${invoice.invoiceNumber}` : `Facture Stock — ${invoice.invoiceNumber}`}
              </h3>
              <p className="text-[11px] text-slate-400 font-mono">{invoice.trackingNumber}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {canMarkPaid && (
              <button
                type="button"
                disabled={isUpdating}
                onClick={handleTogglePaid}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold cursor-pointer transition ${
                  invoice.status === 'payee'
                    ? 'bg-emerald-600 text-white hover:bg-emerald-500'
                    : 'bg-amber-500 text-slate-950 hover:bg-amber-400'
                }`}
              >
                {invoice.status === 'payee'
                  ? isAr
                    ? '✓ مؤداة'
                    : '✓ Payée'
                  : isAr
                  ? 'تأشير كمؤداة'
                  : 'Marquer payée'}
              </button>
            )}
            <button
              type="button"
              onClick={handlePrint}
              className="px-3.5 py-1.5 bg-red-600 hover:bg-red-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>{isAr ? 'طباعة الفاتورة' : 'Imprimer'}</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable Invoice Content */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-5 bg-slate-50">
          <div id="printable-stock-invoice" className="card bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 space-y-5 shadow-2xs">
            {/* Header */}
            <div className="row flex flex-wrap justify-between items-start gap-4 pb-4 border-b border-slate-200">
              <div className="flex items-center gap-3">
                <img
                  src="/fariousy-logo.jpeg"
                  alt="FARIOUSY"
                  className="w-12 h-12 rounded-full border border-slate-200 object-contain bg-white p-0.5"
                />
                <div>
                  <h2 className="text-lg font-black text-slate-900">
                    {companySettings?.companyName || 'FARIOUSY DELIVERY SARL'}
                  </h2>
                  <p className="text-[11px] text-slate-500">
                    {companySettings?.address || 'Casablanca / Laâyoune, Maroc'}
                  </p>
                  <p className="text-[11px] text-slate-500 font-mono force-ltr">
                    Tél: {companySettings?.phone || '+212 522 89 40 10'} · WhatsApp: {companySettings?.whatsapp || '+212 661 00 00 01'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className={isAr ? 'text-left' : 'text-right'}>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                    {isAr ? 'فاتورة سحب من السطوك' : 'FACTURE DE SORTIE STOCK'}
                  </span>
                  <div className="text-base font-black font-mono text-red-600">{invoice.invoiceNumber}</div>
                  <div className="text-[11px] text-slate-500">{formatDateTime(invoice.createdAt, language)}</div>
                  <span
                    className={`inline-block mt-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      invoice.status === 'payee'
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-blue-100 text-blue-800'
                    }`}
                  >
                    {invoice.status === 'payee'
                      ? isAr
                        ? 'مؤداة (Payée)'
                        : 'Payée'
                      : isAr
                      ? 'صادرة أوتوماتيكياً'
                      : 'Générée automatiquement'}
                  </span>
                </div>
                {qrUrl && <img src={qrUrl} alt="QR" className="w-16 h-16 border border-slate-200 rounded-lg p-0.5" />}
              </div>
            </div>

            {/* Client & Package Meta */}
            <div className="grid2 grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="box p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
                <span className="text-[10px] font-bold uppercase text-slate-400 flex items-center gap-1">
                  <Building2 className="w-3.5 h-3.5 text-red-500" />
                  {isAr ? 'صاحب السطوك / المتجر' : 'Marchand / Propriétaire du Stock'}
                </span>
                <div className="font-black text-sm text-slate-900">
                  {invoice.clientCompany || invoice.clientName}
                </div>
                {invoice.clientPhone && (
                  <div className="text-xs font-mono text-slate-600 force-ltr">{invoice.clientPhone}</div>
                )}
              </div>

              <div className="box p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
                <span className="text-[10px] font-bold uppercase text-slate-400 flex items-center gap-1">
                  <PackageCheck className="w-3.5 h-3.5 text-emerald-600" />
                  {isAr ? 'معلومات الكوليا المرتبطة' : 'Colis d’expédition lié'}
                </span>
                <div className="font-mono font-black text-sm text-red-700 force-ltr">{invoice.trackingNumber}</div>
                <div className="text-xs text-slate-700">
                  {invoice.recipientName} — <span className="font-bold">{invoice.recipientCity}</span>
                </div>
              </div>
            </div>

            {/* Items Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-100 text-slate-700">
                    <th className="p-2.5 border border-slate-200 text-start">{isAr ? 'المنتوج' : 'Produit'}</th>
                    <th className="p-2.5 border border-slate-200 text-start">{isAr ? 'أكواد القطع المسحوبة' : 'Codes Unités Déduits'}</th>
                    <th className="p-2.5 border border-slate-200 text-center">{isAr ? 'العدد' : 'Qté'}</th>
                    <th className="p-2.5 border border-slate-200 text-end">{isAr ? 'ثمن الوحدة' : 'P.U'}</th>
                    <th className="p-2.5 border border-slate-200 text-end">{isAr ? 'المجموع' : 'Total'}</th>
                  </tr>
                </thead>
                <tbody>
                  {invoice.items.map((item, idx) => (
                    <tr key={`${item.productId}-${idx}`} className="border-b border-slate-200">
                      <td className="p-2.5 border border-slate-200">
                        <div className="flex items-center gap-2.5">
                          {item.photoUrl && (
                            <img
                              src={item.photoUrl}
                              alt={item.productName}
                              className="thumb w-10 h-10 rounded-lg object-cover border border-slate-200 shrink-0"
                            />
                          )}
                          <div>
                            <div className="font-bold text-slate-900">{item.productName}</div>
                            <div className="text-[10px] font-mono text-slate-500">{item.skuCode}</div>
                          </div>
                        </div>
                      </td>
                      <td className="p-2.5 border border-slate-200">
                        <div className="flex flex-wrap gap-1">
                          {item.unitCodes.map(code => (
                            <span
                              key={code}
                              className="badge px-1.5 py-0.5 rounded bg-slate-100 border border-slate-200 font-mono text-[10px] font-bold text-slate-800 force-ltr"
                            >
                              {code}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="p-2.5 border border-slate-200 text-center font-black force-ltr">
                        {item.quantity}
                      </td>
                      <td className="p-2.5 border border-slate-200 text-end font-mono force-ltr">
                        {formatMAD(item.unitPrice, language)}
                      </td>
                      <td className="p-2.5 border border-slate-200 text-end font-mono font-bold force-ltr">
                        {formatMAD(item.subtotal, language)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Financial Totals */}
            <div className="totals ms-auto w-full sm:w-72 p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2 text-xs">
              <div className="totals-row flex justify-between">
                <span className="text-slate-600">{isAr ? 'مجموع القطع المسحوبة:' : 'Total unités :'}</span>
                <span className="font-bold force-ltr">{invoice.totalQuantity}</span>
              </div>
              <div className="totals-row flex justify-between">
                <span className="text-slate-600">{isAr ? 'قيمة السلع من السطوك:' : 'Valeur produits :'}</span>
                <span className="font-mono font-bold force-ltr">{formatMAD(invoice.productsValue, language)}</span>
              </div>
              <div className="totals-row flex justify-between">
                <span className="text-slate-600">{isAr ? 'مصاريف التوصيل:' : 'Frais de livraison :'}</span>
                <span className="font-mono font-bold force-ltr">{formatMAD(invoice.deliveryFee, language)}</span>
              </div>
              <div className="totals-final flex justify-between pt-2 border-t-2 border-slate-900 font-black text-sm text-red-700">
                <span>{isAr ? 'مجموع الكوليا (CRBT):' : 'Total CRBT Colis :'}</span>
                <span className="font-mono force-ltr">{formatMAD(invoice.totalCodAmount, language)}</span>
              </div>
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-slate-200 text-[10px] text-slate-400">
              <span className="flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                {isAr
                  ? 'تم خصم القطع تلقائياً من سطوك الزبون وتوليد هذه الفاتورة.'
                  : 'Unités déduites automatiquement du stock client et facturées.'}
              </span>
              <span className="font-mono">FARIOUSY FULFILLMENT SYSTEM</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
