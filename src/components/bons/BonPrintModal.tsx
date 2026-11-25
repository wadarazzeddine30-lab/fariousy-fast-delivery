import React, { useState, useEffect } from 'react';
import { BonItem, PackageItem } from '../../types';
import { useDatabase } from '../../context/DatabaseContext';
import { useLanguage } from '../../i18n/LanguageContext';
import QRCode from 'qrcode';
import { Printer, X, Download, FileSpreadsheet, CheckCircle2, Truck, Package, Building, Calendar, Phone, MapPin, Loader2 } from 'lucide-react';
import { formatMAD, formatDate, formatDateTime } from '../../utils/barcode';

interface BonPrintModalProps {
  bon: BonItem | null;
  isOpen: boolean;
  onClose: () => void;
}

export const BonPrintModal: React.FC<BonPrintModalProps> = ({
  bon,
  isOpen,
  onClose
}) => {
  const { packages, companySettings } = useDatabase();
  const { isRtl } = useLanguage();
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [isPrinting, setIsPrinting] = useState(false);

  useEffect(() => {
    if (bon) {
      QRCode.toDataURL(bon.bonNumber, {
        margin: 1,
        width: 160,
        color: { dark: '#000000', light: '#ffffff' },
        errorCorrectionLevel: 'M'
      })
        .then(url => setQrDataUrl(url))
        .catch(err => console.error('Failed to generate Bon QR code', err));
    }
  }, [bon]);

  if (!isOpen || !bon) return null;

  // Find all packages belonging to this Bon
  const bonPackages: PackageItem[] = packages.filter(p => bon.packageIds.includes(p.id));
  const isDelivery = bon.type === 'delivery';

  const handlePrint = () => {
    setIsPrinting(true);
    try {
      const el = document.getElementById('printable-bon-sheet');
      if (!el) {
        window.print();
        setIsPrinting(false);
        return;
      }

      const existingFrame = document.getElementById('fariousy-bon-print-iframe');
      if (existingFrame) existingFrame.remove();

      const iframe = document.createElement('iframe');
      iframe.id = 'fariousy-bon-print-iframe';
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
        setIsPrinting(false);
        return;
      }

      frameDoc.open();
      frameDoc.write(`
        <!DOCTYPE html>
        <html dir="ltr" lang="fr">
          <head>
            <meta charset="utf-8">
            <title>${bon.bonNumber}</title>
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
              @media print {
                body { padding: 0; }
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
          console.warn('Iframe print error fallback:', e);
          window.print();
        } finally {
          setIsPrinting(false);
        }
      }, 400);
    } catch (e) {
      console.warn(e);
      window.print();
      setIsPrinting(false);
    }
  };

  const exportCSV = () => {
    const headers = ['N°', 'Code Suivi', 'Destinataire', 'Téléphone', 'Ville', 'Adresse', 'Montant CRBT (MAD)', 'Statut'];
    const rows = bonPackages.map((pkg, idx) => [
      idx + 1,
      pkg.trackingNumber,
      `"${pkg.recipientName.replace(/"/g, '""')}"`,
      pkg.recipientPhone,
      `"${pkg.city.replace(/"/g, '""')}"`,
      `"${pkg.address.replace(/"/g, '""')}"`,
      pkg.codAmount || 0,
      pkg.status
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `${bon.bonNumber}_${bon.date}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <>
      {/* ================= SCREEN MODAL PREVIEW ================= */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/75 backdrop-blur-xs no-print overflow-y-auto">
        <div className="relative w-full max-w-4xl bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col my-auto max-h-[96vh]">
          {/* Header Bar */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-white shadow-xs ${
                isDelivery ? 'bg-red-600' : 'bg-indigo-600'
              }`}>
                {isDelivery ? <Truck className="w-5 h-5" /> : <Package className="w-5 h-5" />}
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <span>{isDelivery ? 'Bon de Livraison (Feuille de Tournée)' : "Bon d'Expédition & Ramassage Client"}</span>
                  <span className="font-mono text-xs bg-slate-200 text-slate-800 px-2 py-0.5 rounded font-black">{bon.bonNumber}</span>
                </h3>
                <p className="text-xs text-slate-500">
                  {formatDate(bon.date)} • {bonPackages.length} colis • Total CRBT : <strong className="text-slate-900">{formatMAD(bon.totalCodAmount)}</strong>
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={exportCSV}
                className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-100 rounded-xl transition cursor-pointer"
                title="Exporter sous format Excel / CSV"
              >
                <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                <span className="hidden sm:inline">Export CSV</span>
              </button>
              <button
                type="button"
                onClick={handlePrint}
                disabled={isPrinting}
                className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-red-600 hover:bg-red-700 rounded-xl shadow-xs transition cursor-pointer disabled:opacity-50"
              >
                {isPrinting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Printer className="w-4 h-4" />}
                <span>{isPrinting ? 'جاري فتح الطباعة...' : 'طباعة البون (Imprimer A4)'}</span>
              </button>
              <button
                onClick={onClose}
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Printable Document Preview Area */}
          <div className="p-4 sm:p-8 overflow-y-auto bg-slate-200/60 flex justify-center">
            {/* The A4 Sheet */}
            <div
              id="printable-bon-sheet"
              className="w-full max-w-[800px] bg-white border border-slate-300 p-6 sm:p-8 shadow-md text-slate-900 text-xs flex flex-col justify-between"
              style={{ minHeight: '1050px', fontFamily: "'Plus Jakarta Sans', 'Cairo', Arial, sans-serif" }}
            >
              {/* 1. Header: Logo, Company Info, QR & Title */}
              <div>
                <div className="flex items-start justify-between border-b-2 border-slate-900 pb-4">
                  {/* Company Logo & Identity */}
                  <div className="flex items-center gap-3">
                    <img
                      src="/fariousy-logo.jpeg"
                      alt="FARIOUSY DELIVERY"
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

                  {/* Bon Title & QR */}
                  <div className="text-right flex items-center gap-3">
                    <div className="text-right">
                      <span className="inline-block px-2.5 py-1 bg-slate-900 text-white font-black text-xs uppercase tracking-wider rounded">
                        {isDelivery ? 'BON DE LIVRAISON' : "BON D'EXPÉDITION CLIENT"}
                      </span>
                      <div className="text-base font-black font-mono text-red-600 mt-1">
                        {bon.bonNumber}
                      </div>
                      <div className="text-[10px] text-slate-500 font-mono">
                        Date : {bon.date}
                      </div>
                    </div>
                    {qrDataUrl && (
                      <img src={qrDataUrl} alt={bon.bonNumber} className="w-16 h-16 object-contain border border-slate-200 p-0.5 rounded" />
                    )}
                  </div>
                </div>

                {/* 2. Meta Information Box */}
                <div className="my-4 grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 border border-slate-200 p-3 rounded-lg">
                  {isDelivery ? (
                    <>
                      <div>
                        <span className="text-[10px] text-slate-500 font-bold block uppercase">Livreur Assigné</span>
                        <span className="font-extrabold text-xs text-slate-900 block truncate">{bon.driverName || 'Non assigné'}</span>
                        <span className="text-[10px] text-slate-600 font-mono">{bon.driverPhone}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-500 font-bold block uppercase">Zone / Ville</span>
                        <span className="font-bold text-xs text-slate-900 block">{bon.city || 'Laâyoune'}</span>
                        <span className="text-[10px] text-slate-500">{bon.driverVehicle || 'Moto'}</span>
                      </div>
                    </>
                  ) : (
                    <>
                      <div>
                        <span className="text-[10px] text-slate-500 font-bold block uppercase">Client / Expéditeur</span>
                        <span className="font-extrabold text-xs text-slate-900 block truncate">{bon.clientCompany || bon.clientName}</span>
                        <span className="text-[10px] text-slate-600 font-mono">{bon.clientPhone}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-500 font-bold block uppercase">Statut Bon</span>
                        <span className="font-bold text-xs text-emerald-700 block uppercase">{bon.status.replace('_', ' ')}</span>
                        <span className="text-[10px] text-slate-500">Pris en charge</span>
                      </div>
                    </>
                  )}

                  <div>
                    <span className="text-[10px] text-slate-500 font-bold block uppercase">Total Colis</span>
                    <span className="font-black text-sm text-slate-900 block">{bonPackages.length} Colis</span>
                    <span className="text-[10px] text-slate-500">Pris en compte</span>
                  </div>

                  <div>
                    <span className="text-[10px] text-slate-500 font-bold block uppercase">Total CRBT (À Encaisser)</span>
                    <span className="font-black text-sm text-red-600 block">{formatMAD(bon.totalCodAmount)}</span>
                    <span className="text-[10px] text-emerald-600 font-semibold">Espèces (Cash)</span>
                  </div>
                </div>

                {/* 3. Itemized Table of Packages */}
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse border border-slate-300 text-[11px]">
                    <thead>
                      <tr className="bg-slate-900 text-white font-bold">
                        <th className="p-2 border border-slate-700 w-8 text-center">N°</th>
                        <th className="p-2 border border-slate-700 w-28">N° Suivi (Tracking)</th>
                        <th className="p-2 border border-slate-700">Destinataire & Téléphone</th>
                        <th className="p-2 border border-slate-700">Ville & Adresse</th>
                        <th className="p-2 border border-slate-700 w-24 text-right">CRBT (MAD)</th>
                        <th className="p-2 border border-slate-700 w-24 text-center">Statut</th>
                        <th className="p-2 border border-slate-700 w-28 text-center">Émargement</th>
                      </tr>
                    </thead>
                    <tbody>
                      {bonPackages.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="p-4 text-center text-slate-400">
                            Aucun colis associé à ce bon.
                          </td>
                        </tr>
                      ) : (
                        bonPackages.map((pkg, idx) => (
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
                              <span className="text-[9px] px-1.5 py-0.5 rounded bg-slate-200 text-slate-800 font-bold uppercase">
                                {pkg.status === 'livre' ? 'Livré' : pkg.status === 'en_cours_livraison' ? 'En cours' : pkg.status}
                              </span>
                            </td>
                            <td className="p-2 border border-slate-300 text-center">
                              <div className="h-6 border-b border-dashed border-slate-300"></div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                    <tfoot>
                      <tr className="bg-slate-100 font-black text-slate-900 border-t-2 border-slate-900">
                        <td colSpan={4} className="p-2 text-right uppercase">
                          TOTAL GÉNÉRAL ({bonPackages.length} COLIS) :
                        </td>
                        <td className="p-2 text-right font-mono text-sm text-red-600 border border-slate-300">
                          {formatMAD(bon.totalCodAmount)}
                        </td>
                        <td colSpan={2} className="p-2 border border-slate-300"></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>

                {/* 4. Notes / Instructions */}
                {bon.notes && (
                  <div className="mt-3 p-2 bg-amber-50 border border-amber-200 rounded text-[10px] text-amber-900">
                    <span className="font-bold">Instructions particulières : </span>
                    <span>{bon.notes}</span>
                  </div>
                )}
              </div>

              {/* 5. Footer Terms & Dual Signature Stamps */}
              <div className="pt-6 border-t-2 border-slate-900 mt-6">
                <p className="text-[9px] text-slate-500 text-center mb-6 italic leading-relaxed">
                  {isDelivery
                    ? "Le livreur certifie sur l'honneur avoir pris possession des colis mentionnés ci-dessus en parfait état et s'engage à reverser l'intégralité des fonds encaissés (CRBT) à l'agence le jour même."
                    : "L'agent FARIOUSY certifie la réception physique des colis mentionnés ci-dessus, sous réserve de vérification de conformité, d'emballage et de pesée définitive en plateforme logistique."}
                </p>

                <div className="grid grid-cols-2 gap-8 text-center text-xs">
                  {/* Left Block */}
                  <div className="border border-slate-300 rounded-lg p-3 h-28 flex flex-col justify-between bg-slate-50/50">
                    <span className="font-bold uppercase text-[10px] text-slate-700">
                      {isDelivery ? 'Signature et Émargement du Livreur' : "Signature et Cachet de l'Expéditeur"}
                    </span>
                    <div className="text-[9px] text-slate-400">Date et mention « Bon pour accord »</div>
                  </div>

                  {/* Right Block */}
                  <div className="border border-slate-300 rounded-lg p-3 h-28 flex flex-col justify-between bg-slate-50/50">
                    <span className="font-bold uppercase text-[10px] text-slate-700">
                      Signature et Cachet de l'Agence FARIOUSY
                    </span>
                    <div className="text-[9px] text-slate-400">Responsable Logistique & Opérations</div>
                  </div>
                </div>

                <div className="mt-4 pt-2 border-t border-slate-200 text-center text-[9px] text-slate-400 font-mono">
                  Document officiel généré par le système FARIOUSY DELIVERY • {formatDateTime(new Date().toISOString())} • Réf : {bon.id}
                </div>
              </div>
            </div>
          </div>

          {/* Modal Footer Controls */}
          <div className="flex items-center justify-between px-6 py-3.5 border-t border-slate-200 bg-white">
            <span className="text-xs text-slate-500">
              Format d'impression recommandé : A4 Portrait (100%) ou Thermique Déplié
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition"
              >
                Fermer
              </button>
              <button
                type="button"
                onClick={handlePrint}
                disabled={isPrinting}
                className="flex items-center gap-2 px-5 py-2.5 text-xs font-bold text-white bg-red-600 hover:bg-red-700 rounded-xl shadow-xs transition cursor-pointer disabled:opacity-50"
              >
                {isPrinting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Printer className="w-4 h-4" />}
                <span>{isPrinting ? 'جاري إعداد الطباعة...' : 'طباعة البون الرسمي (Imprimer A4)'}</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ================= DEDICATED PRINT VIEW (@media print) ================= */}
      <div className="print-only print-ticket-area">
        <div
          className="w-full max-w-[800px] bg-white p-6 text-slate-900 text-xs flex flex-col justify-between mx-auto"
          style={{ fontFamily: "'Plus Jakarta Sans', 'Cairo', Arial, sans-serif" }}
        >
          {/* Header */}
          <div>
            <div className="flex items-start justify-between border-b-2 border-black pb-3">
              <div className="flex items-center gap-3">
                <img
                  src="/fariousy-logo.jpeg"
                  alt="FARIOUSY"
                  className="w-14 h-14 object-contain shrink-0"
                />
                <div>
                  <h1 className="text-lg font-black tracking-tight text-black leading-none">
                    FARIOUSY DELIVERY
                  </h1>
                  <span className="text-[9px] font-bold text-red-600 uppercase tracking-widest block mt-0.5">
                    FAST & SECURE LOGISTICS
                  </span>
                  <p className="text-[9px] text-black mt-1 leading-tight">
                    {companySettings?.address || 'Lotissement al aouda, Laâyoune / Casablanca'} • Tél : {companySettings?.phone || '+212 522 89 40 10'}
                  </p>
                </div>
              </div>

              <div className="text-right flex items-center gap-3">
                <div>
                  <span className="inline-block px-2 py-0.5 bg-black text-white font-black text-xs uppercase tracking-wider">
                    {isDelivery ? 'BON DE LIVRAISON' : "BON D'EXPÉDITION CLIENT"}
                  </span>
                  <div className="text-sm font-black font-mono text-black mt-0.5">
                    {bon.bonNumber}
                  </div>
                  <div className="text-[9px] text-black font-mono">
                    Date : {bon.date}
                  </div>
                </div>
                {qrDataUrl && (
                  <img src={qrDataUrl} alt={bon.bonNumber} className="w-14 h-14 object-contain" />
                )}
              </div>
            </div>

            {/* Meta */}
            <div className="my-3 grid grid-cols-4 gap-2 bg-slate-100 border border-black p-2 text-[10px]">
              {isDelivery ? (
                <>
                  <div>
                    <strong className="block">LIVREUR :</strong>
                    <span>{bon.driverName}</span>
                    <span className="block font-mono">{bon.driverPhone}</span>
                  </div>
                  <div>
                    <strong className="block">ZONE / VILLE :</strong>
                    <span>{bon.city}</span>
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <strong className="block">CLIENT :</strong>
                    <span>{bon.clientCompany || bon.clientName}</span>
                    <span className="block font-mono">{bon.clientPhone}</span>
                  </div>
                  <div>
                    <strong className="block">STATUT :</strong>
                    <span>{bon.status}</span>
                  </div>
                </>
              )}
              <div>
                <strong className="block">NBRE COLIS :</strong>
                <span className="text-sm font-black">{bonPackages.length} Colis</span>
              </div>
              <div>
                <strong className="block">TOTAL CRBT :</strong>
                <span className="text-sm font-black text-black">{formatMAD(bon.totalCodAmount)}</span>
              </div>
            </div>

            {/* Table */}
            <table className="w-full text-left border-collapse border border-black text-[10px]">
              <thead>
                <tr className="bg-black text-white font-bold">
                  <th className="p-1.5 border border-black w-6 text-center">N°</th>
                  <th className="p-1.5 border border-black w-24">N° Suivi</th>
                  <th className="p-1.5 border border-black">Destinataire & Téléphone</th>
                  <th className="p-1.5 border border-black">Ville & Adresse</th>
                  <th className="p-1.5 border border-black w-20 text-right">CRBT</th>
                  <th className="p-1.5 border border-black w-20 text-center">Statut</th>
                  <th className="p-1.5 border border-black w-24 text-center">Signature</th>
                </tr>
              </thead>
              <tbody>
                {bonPackages.map((pkg, idx) => (
                  <tr key={pkg.id}>
                    <td className="p-1 border border-black text-center font-bold">{idx + 1}</td>
                    <td className="p-1 border border-black font-mono font-bold">{pkg.trackingNumber}</td>
                    <td className="p-1 border border-black">
                      <strong>{pkg.recipientName}</strong> - {pkg.recipientPhone}
                    </td>
                    <td className="p-1 border border-black">
                      {pkg.city} - {pkg.address}
                    </td>
                    <td className="p-1 border border-black text-right font-black font-mono">
                      {pkg.codAmount || 0} DH
                    </td>
                    <td className="p-1 border border-black text-center uppercase text-[9px]">
                      {pkg.status === 'livre' ? 'Livré' : pkg.status}
                    </td>
                    <td className="p-1 border border-black"></td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-slate-200 font-black text-black border-t-2 border-black">
                  <td colSpan={4} className="p-1.5 text-right uppercase">
                    TOTAL ({bonPackages.length} COLIS) :
                  </td>
                  <td className="p-1.5 text-right font-mono text-xs border border-black">
                    {formatMAD(bon.totalCodAmount)}
                  </td>
                  <td colSpan={2} className="p-1.5 border border-black"></td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Footer & Signatures */}
          <div className="pt-4 border-t-2 border-black mt-6">
            <div className="grid grid-cols-2 gap-6 text-center text-xs">
              <div className="border border-black p-2 h-24 flex flex-col justify-between">
                <span className="font-bold uppercase text-[9px]">
                  {isDelivery ? 'Signature du Livreur' : "Signature de l'Expéditeur"}
                </span>
              </div>
              <div className="border border-black p-2 h-24 flex flex-col justify-between">
                <span className="font-bold uppercase text-[9px]">
                  Signature & Cachet Agence FARIOUSY
                </span>
              </div>
            </div>
            <div className="mt-3 text-center text-[8px] text-black font-mono">
              FARIOUSY DELIVERY • {bon.bonNumber} • Imprimé le {formatDateTime(new Date().toISOString())}
            </div>
          </div>
        </div>
      </div>
    </>
  );
};
