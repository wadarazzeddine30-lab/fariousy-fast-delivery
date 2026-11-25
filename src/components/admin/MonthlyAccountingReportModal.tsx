import React, { useMemo, useState } from 'react';
import { X, Printer, Download, Calendar, FileText, TrendingUp, Banknote, Package } from 'lucide-react';
import { useDatabase } from '../../context/DatabaseContext';
import { formatDate, formatMAD } from '../../utils/barcode';
import { exportCSV } from '../../utils/export';

interface MonthlyAccountingReportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const getDefaultMonth = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
};

const formatMonthLabelFr = (ym: string): string => {
  const [y, m] = ym.split('-').map(Number);
  if (!y || !m) return ym;
  const d = new Date(y, m - 1, 1);
  return d.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
};

export const MonthlyAccountingReportModal: React.FC<MonthlyAccountingReportModalProps> = ({
  isOpen,
  onClose
}) => {
  const { packages, payments, clientDebts, clientStockInvoices, companySettings } = useDatabase();
  const [selectedMonth, setSelectedMonth] = useState<string>(getDefaultMonth);

  const report = useMemo(() => {
    const matchesMonth = (rawDate?: string) => {
      if (!rawDate) return false;
      const trimmed = rawDate.trim();
      if (trimmed.slice(0, 7) === selectedMonth) return true;
      const ddmmyyyy = trimmed.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
      if (ddmmyyyy) {
        return `${ddmmyyyy[3]}-${ddmmyyyy[2]}` === selectedMonth;
      }
      return false;
    };

    const monthCreatedPackages = packages.filter(p => matchesMonth(p.createdAt));
    const monthDeliveredPackages = packages.filter(
      p => p.status === 'livre' && matchesMonth(p.lastMovedAt || p.createdAt)
    );
    const monthReturnedPackages = packages.filter(
      p => ['retourne', 'refuse', 'retour_en_cours'].includes(p.status) && matchesMonth(p.lastMovedAt || p.createdAt)
    );

    const totalCodCollected = monthDeliveredPackages.reduce((s, p) => s + (p.codAmount || 0), 0);
    const totalDeliveryRevenue = monthDeliveredPackages.reduce((s, p) => s + (p.deliveryFee || 0), 0);
    const returnFeeRevenue = packages
      .filter(p => p.status === 'retourne' && matchesMonth(p.lastMovedAt || p.createdAt))
      .reduce((s, p) => s + (companySettings.defaultReturnFee || 0), 0);

    const monthPayments = payments.filter(p => p.status !== 'annule' && matchesMonth(p.date));
    const paidMerchantTotal = monthPayments
      .filter(p => p.status === 'paye')
      .reduce((s, p) => s + (p.netAmount || 0), 0);
    const pendingMerchantTotal = monthPayments
      .filter(p => p.status === 'en_attente')
      .reduce((s, p) => s + (p.netAmount || 0), 0);
    const totalPackagingAndExtras = monthPayments.reduce(
      (s, p) => s + (p.packagingFees || 0) + (p.extraDeductions || 0),
      0
    );

    const monthDebts = clientDebts.filter(d => matchesMonth(d.createdAt));
    const settledDebtsAmount = monthDebts
      .filter(d => d.isSettled || d.status === 'regle')
      .reduce((s, d) => s + (d.amount || 0), 0);
    const unsettledDebtsAmount = monthDebts
      .filter(d => !d.isSettled && d.status !== 'regle')
      .reduce((s, d) => s + (d.amount || 0), 0);

    const monthStockInvoices = clientStockInvoices.filter(i => matchesMonth(i.createdAt));
    const stockInvoicesValue = monthStockInvoices.reduce((s, i) => s + (i.productsValue || 0), 0);

    const deliveryRate =
      monthCreatedPackages.length > 0
        ? Math.round((monthDeliveredPackages.length / monthCreatedPackages.length) * 100)
        : monthDeliveredPackages.length > 0
        ? 100
        : 0;

    // Group delivered parcels & payouts by merchant
    const merchantMap = new Map<
      string,
      {
        name: string;
        deliveredCount: number;
        codTotal: number;
        feesTotal: number;
        netDue: number;
      }
    >();

    for (const p of monthDeliveredPackages) {
      const key = p.clientId || p.clientCompany || p.clientName;
      const existing = merchantMap.get(key) || {
        name: p.clientCompany || p.clientName || 'Marchand',
        deliveredCount: 0,
        codTotal: 0,
        feesTotal: 0,
        netDue: 0
      };
      existing.deliveredCount += 1;
      existing.codTotal += p.codAmount || 0;
      existing.feesTotal += p.deliveryFee || 0;
      existing.netDue += (p.codAmount || 0) - (p.deliveryFee || 0);
      merchantMap.set(key, existing);
    }

    const merchantBreakdown = Array.from(merchantMap.values()).sort((a, b) => b.codTotal - a.codTotal);

    return {
      monthCreatedPackages,
      monthDeliveredPackages,
      monthReturnedPackages,
      totalCodCollected,
      totalDeliveryRevenue,
      returnFeeRevenue,
      totalCompanyRevenue: totalDeliveryRevenue + totalPackagingAndExtras + returnFeeRevenue,
      monthPayments,
      paidMerchantTotal,
      pendingMerchantTotal,
      totalPackagingAndExtras,
      monthDebts,
      settledDebtsAmount,
      unsettledDebtsAmount,
      monthStockInvoices,
      stockInvoicesValue,
      deliveryRate,
      merchantBreakdown
    };
  }, [packages, payments, clientDebts, clientStockInvoices, companySettings.defaultReturnFee, selectedMonth]);

  if (!isOpen) return null;

  const handlePrintPDF = () => {
    const el = document.getElementById('printable-monthly-accounting-report');
    if (!el) return;

    const oldFrame = document.getElementById('fariousy-monthly-report-iframe');
    if (oldFrame) oldFrame.remove();

    const iframe = document.createElement('iframe');
    iframe.id = 'fariousy-monthly-report-iframe';
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
    if (!doc) return;

    doc.open();
    doc.write(`
      <!DOCTYPE html>
      <html lang="fr">
        <head>
          <meta charset="utf-8" />
          <title>Bilan Comptable ${selectedMonth} - ${companySettings.companyName}</title>
          <style>
            * { box-sizing: border-box; margin: 0; padding: 0; }
            body {
              font-family: 'Plus Jakarta Sans', Arial, sans-serif;
              color: #0f172a;
              background: #fff;
              padding: 20px;
              font-size: 11px;
              line-height: 1.4;
            }
            .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #0f172a; padding-bottom: 12px; margin-bottom: 16px; }
            .title { font-size: 18px; font-weight: 900; color: #b91c1c; }
            .sub { font-size: 11px; color: #475569; }
            .kpis { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 16px; }
            .kpi { border: 1px solid #cbd5e1; border-radius: 8px; padding: 10px; background: #f8fafc; }
            .kpi-label { font-size: 9px; text-transform: uppercase; color: #64748b; font-weight: 700; }
            .kpi-val { font-size: 14px; font-weight: 900; margin-top: 4px; font-family: monospace; }
            .section-title { font-size: 12px; font-weight: 800; margin: 14px 0 6px; padding-bottom: 4px; border-bottom: 1px solid #e2e8f0; text-transform: uppercase; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 12px; }
            th, td { border: 1px solid #cbd5e1; padding: 6px 8px; text-align: left; }
            th { background: #f1f5f9; font-size: 10px; text-transform: uppercase; }
            .num { text-align: right; font-family: monospace; font-weight: 700; }
            .footer { margin-top: 20px; padding-top: 10px; border-top: 1px dashed #cbd5e1; display: flex; justify-content: space-between; font-size: 10px; color: #64748b; }
            @page { size: A4; margin: 12mm; }
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

  const handleExportMonthlyCSV = () => {
    const rows = report.merchantBreakdown.map(m => ({
      Mois: selectedMonth,
      Marchand: m.name,
      ColisLivres: m.deliveredCount,
      TotalCRBT_MAD: m.codTotal,
      FraisLivraison_MAD: m.feesTotal,
      NetMarchand_MAD: m.netDue
    }));
    exportCSV(rows, `fariousy_bilan_comptable_${selectedMonth}.csv`);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2.5 sm:p-4 bg-black/65 backdrop-blur-xs no-print">
      <div className="bg-white rounded-2xl max-w-4xl w-full shadow-2xl overflow-hidden flex flex-col max-h-[92dvh]">
        {/* Top Modal Controls */}
        <div className="shrink-0 px-3.5 py-3 sm:px-5 sm:py-4 bg-slate-900 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <FileText className="w-5 h-5 text-red-400 shrink-0" />
            <div className="min-w-0">
              <h3 className="text-xs sm:text-sm font-black truncate">
                Bilan Mensuel Comptable PDF — التقرير المحاسبي الشهري
              </h3>
              <p className="text-[10px] sm:text-[11px] text-slate-400 truncate">
                Synthèse CRBT, Chiffre d’affaires livraison, Reversements marchands & Factures Stock
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
            <div className="flex items-center gap-1.5 bg-slate-800 border border-slate-700 rounded-xl px-2.5 py-1.5">
              <Calendar className="w-3.5 h-3.5 text-slate-400" />
              <input
                type="month"
                value={selectedMonth}
                onChange={e => setSelectedMonth(e.target.value)}
                className="bg-transparent text-xs font-bold text-white focus:outline-none"
              />
            </div>

            <button
              type="button"
              onClick={handleExportMonthlyCSV}
              className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl border border-slate-700 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>CSV</span>
            </button>

            <button
              type="button"
              onClick={handlePrintPDF}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold bg-red-600 hover:bg-red-700 text-white rounded-xl shadow-xs cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>PDF</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Scrollable Preview & Printable Area */}
        <div className="flex-1 min-h-0 p-3 sm:p-6 overflow-y-auto overscroll-contain bg-slate-50 space-y-4 sm:space-y-5">
          <div id="printable-monthly-accounting-report" className="bg-white border border-slate-200 rounded-2xl p-3.5 sm:p-6 space-y-5 shadow-2xs">
            {/* Printable Header */}
            <div className="header flex flex-col sm:flex-row sm:items-start justify-between gap-4 border-b-2 border-slate-900 pb-4">
              <div>
                <div className="title text-lg font-black text-red-600 uppercase tracking-tight">
                  {companySettings.companyName}
                </div>
                <p className="sub text-xs text-slate-600 mt-0.5">{companySettings.address}</p>
                <p className="sub text-[11px] font-mono text-slate-500 mt-0.5">
                  ICE: {companySettings.ice} • RC: {companySettings.rc} • IF: {companySettings.ifNumber}
                </p>
              </div>
              <div className="sm:text-right">
                <span className="inline-block px-3 py-1 bg-slate-900 text-white text-xs font-black rounded-lg uppercase">
                  Bilan Comptable Mensuel
                </span>
                <div className="text-sm font-black text-slate-900 mt-1 capitalize">
                  {formatMonthLabelFr(selectedMonth)}
                </div>
                <div className="text-[11px] text-slate-500 font-mono">
                  Édité le {new Date().toLocaleDateString('fr-FR')}
                </div>
              </div>
            </div>

            {/* KPIs */}
            <div className="kpis grid grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="kpi p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                <div className="kpi-label flex items-center gap-1 text-[10px] font-bold text-slate-500 uppercase">
                  <Banknote className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Total CRBT Encaissé</span>
                </div>
                <div className="kpi-val text-lg font-black font-mono text-slate-900 mt-1">
                  {formatMAD(report.totalCodCollected)}
                </div>
                <div className="text-[10px] text-slate-500 mt-0.5">
                  {report.monthDeliveredPackages.length} colis livrés ({report.deliveryRate}%)
                </div>
              </div>

              <div className="kpi p-3.5 rounded-xl bg-red-50/60 border border-red-200">
                <div className="kpi-label flex items-center gap-1 text-[10px] font-bold text-red-800 uppercase">
                  <TrendingUp className="w-3.5 h-3.5 text-red-600" />
                  <span>Revenu Net Société</span>
                </div>
                <div className="kpi-val text-lg font-black font-mono text-red-700 mt-1">
                  {formatMAD(report.totalCompanyRevenue)}
                </div>
                <div className="text-[10px] text-red-700/80 mt-0.5">
                  Livraison: {formatMAD(report.totalDeliveryRevenue)}
                </div>
              </div>

              <div className="kpi p-3.5 rounded-xl bg-emerald-50/60 border border-emerald-200">
                <div className="kpi-label text-[10px] font-bold text-emerald-800 uppercase">
                  Reversé aux Marchands
                </div>
                <div className="kpi-val text-lg font-black font-mono text-emerald-700 mt-1">
                  {formatMAD(report.paidMerchantTotal)}
                </div>
                <div className="text-[10px] text-emerald-700/80 mt-0.5">
                  En attente: {formatMAD(report.pendingMerchantTotal)}
                </div>
              </div>

              <div className="kpi p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                <div className="kpi-label flex items-center gap-1 text-[10px] font-bold text-slate-500 uppercase">
                  <Package className="w-3.5 h-3.5 text-slate-700" />
                  <span>Activité & Stock</span>
                </div>
                <div className="kpi-val text-lg font-black font-mono text-slate-900 mt-1">
                  {report.monthCreatedPackages.length} colis
                </div>
                <div className="text-[10px] text-slate-500 mt-0.5">
                  Retours: {report.monthReturnedPackages.length} • Fact. Stock: {report.monthStockInvoices.length}
                </div>
              </div>
            </div>

            {/* Section 1: Breakdown by Merchant */}
            <div>
              <h4 className="section-title text-xs font-black text-slate-800 uppercase border-b border-slate-200 pb-1.5 mb-2">
                1. Ventilation des Livraisons par Marchand ({report.merchantBreakdown.length})
              </h4>
              <table className="w-full text-xs border-collapse border border-slate-200">
                <thead className="bg-slate-100 text-slate-700 font-bold">
                  <tr>
                    <th className="border border-slate-200 px-3 py-2 text-left">Boutique / Marchand</th>
                    <th className="border border-slate-200 px-3 py-2 text-right">Colis Livrés</th>
                    <th className="border border-slate-200 px-3 py-2 text-right">CRBT Brut</th>
                    <th className="border border-slate-200 px-3 py-2 text-right">Frais Livraison</th>
                    <th className="border border-slate-200 px-3 py-2 text-right">Net Marchand</th>
                  </tr>
                </thead>
                <tbody>
                  {report.merchantBreakdown.map(m => (
                    <tr key={m.name}>
                      <td className="border border-slate-200 px-3 py-1.5 font-semibold text-slate-900">
                        {m.name}
                      </td>
                      <td className="num border border-slate-200 px-3 py-1.5 text-right font-mono">
                        {m.deliveredCount}
                      </td>
                      <td className="num border border-slate-200 px-3 py-1.5 text-right font-mono">
                        {formatMAD(m.codTotal)}
                      </td>
                      <td className="num border border-slate-200 px-3 py-1.5 text-right font-mono text-red-600">
                        {formatMAD(m.feesTotal)}
                      </td>
                      <td className="num border border-slate-200 px-3 py-1.5 text-right font-mono text-emerald-700">
                        {formatMAD(m.netDue)}
                      </td>
                    </tr>
                  ))}
                  {report.merchantBreakdown.length === 0 && (
                    <tr>
                      <td colSpan={5} className="border border-slate-200 px-3 py-4 text-center text-slate-400">
                        Aucune livraison enregistrée pour {formatMonthLabelFr(selectedMonth)}.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Section 2: Merchant Payout Statements issued in month */}
            <div>
              <h4 className="section-title text-xs font-black text-slate-800 uppercase border-b border-slate-200 pb-1.5 mb-2">
                2. Relevés & Virements Émis ({report.monthPayments.length})
              </h4>
              <table className="w-full text-xs border-collapse border border-slate-200">
                <thead className="bg-slate-100 text-slate-700 font-bold">
                  <tr>
                    <th className="border border-slate-200 px-3 py-2 text-left">Référence</th>
                    <th className="border border-slate-200 px-3 py-2 text-left">Date</th>
                    <th className="border border-slate-200 px-3 py-2 text-left">Marchand</th>
                    <th className="border border-slate-200 px-3 py-2 text-left">Mode</th>
                    <th className="border border-slate-200 px-3 py-2 text-right">Net Versé</th>
                    <th className="border border-slate-200 px-3 py-2 text-left">Statut</th>
                  </tr>
                </thead>
                <tbody>
                  {report.monthPayments.map(pay => (
                    <tr key={pay.id}>
                      <td className="border border-slate-200 px-3 py-1.5 font-mono font-bold">
                        {pay.reference}
                      </td>
                      <td className="border border-slate-200 px-3 py-1.5 text-slate-600">
                        {formatDate(pay.date)}
                      </td>
                      <td className="border border-slate-200 px-3 py-1.5 font-semibold">
                        {pay.clientCompany || pay.clientName}
                      </td>
                      <td className="border border-slate-200 px-3 py-1.5">{pay.paymentMethod}</td>
                      <td className="num border border-slate-200 px-3 py-1.5 text-right font-mono">
                        {formatMAD(pay.netAmount)}
                      </td>
                      <td className="border border-slate-200 px-3 py-1.5 font-bold">
                        {pay.status === 'paye' ? 'Payé' : 'En attente'}
                      </td>
                    </tr>
                  ))}
                  {report.monthPayments.length === 0 && (
                    <tr>
                      <td colSpan={6} className="border border-slate-200 px-3 py-4 text-center text-slate-400">
                        Aucun relevé de virement généré sur ce mois.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Section 3: Summary of Debts & Stock Invoices */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs space-y-1">
                <div className="font-black text-slate-800">Dettes & Imputations du mois</div>
                <div className="flex justify-between text-slate-600">
                  <span>Dettes réglées :</span>
                  <strong className="font-mono text-emerald-700">{formatMAD(report.settledDebtsAmount)}</strong>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Dettes en cours :</span>
                  <strong className="font-mono text-rose-700">{formatMAD(report.unsettledDebtsAmount)}</strong>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Frais d’emballage / extra :</span>
                  <strong className="font-mono">{formatMAD(report.totalPackagingAndExtras)}</strong>
                </div>
              </div>

              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs space-y-1">
                <div className="font-black text-slate-800">Facturation Stock Fulfillment</div>
                <div className="flex justify-between text-slate-600">
                  <span>Nombre de factures :</span>
                  <strong className="font-mono">{report.monthStockInvoices.length}</strong>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Valeur marchande sortie :</span>
                  <strong className="font-mono text-slate-900">{formatMAD(report.stockInvoicesValue)}</strong>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Frais de retour appliqués :</span>
                  <strong className="font-mono">{formatMAD(report.returnFeeRevenue)}</strong>
                </div>
              </div>
            </div>

            {/* Printable Footer */}
            <div className="footer flex justify-between text-[10px] text-slate-400 border-t border-dashed border-slate-300 pt-3">
              <span>Document comptable généré automatiquement — {companySettings.companyName}</span>
              <span>{companySettings.phone} • {companySettings.email}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
