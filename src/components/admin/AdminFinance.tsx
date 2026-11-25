import React, { useState } from 'react';
import { useDatabase } from '../../context/DatabaseContext';
import { ClientPayment } from '../../types';
import { formatMAD, formatDate } from '../../utils/barcode';
import { exportFinancialStatementToCSV, exportCSV } from '../../utils/export';
import { ConfirmActionModal } from '../common/ConfirmActionModal';
import {
  BadgeDollarSign,
  Banknote,
  Download,
  Plus,
  Printer,
  CheckCircle2,
  Clock,
  X,
  Search,
  Filter,
  Ban,
  FileText,
  FileImage,
  Upload,
  Eye
} from 'lucide-react';
import { compressImageFileToDataUrl, downloadImageUrl } from '../../utils/imageCompress';
import { MonthlyAccountingReportModal } from './MonthlyAccountingReportModal';

interface AdminFinanceProps {
  onOpenReleveModal: (payment: ClientPayment) => void;
}

export const AdminFinance: React.FC<AdminFinanceProps> = ({ onOpenReleveModal }) => {
  const {
    packages,
    payments,
    users,
    clientDebts,
    generateClientPayment,
    attachPaymentReceipt,
    cancelPayment
  } = useDatabase();

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'paye' | 'en_attente' | 'annule'>('all');

  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [showMonthlyReportModal, setShowMonthlyReportModal] = useState(false);
  const [selectedClientId, setSelectedClientId] = useState('');
  const [selectedPackageIds, setSelectedPackageIds] = useState<string[]>([]);
  const [selectedDebtIds, setSelectedDebtIds] = useState<string[]>([]);
  const [packagingFees, setPackagingFees] = useState<string>('0');
  const [extraDeductions, setExtraDeductions] = useState<string>('0');
  const [deductionNotes, setDeductionNotes] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<ClientPayment['paymentMethod']>('Virement bancaire');
  const [paymentNotes, setPaymentNotes] = useState('');
  const [modalReceiptUrl, setModalReceiptUrl] = useState<string>('');
  const [modalReceiptFileName, setModalReceiptFileName] = useState<string>('');
  const [previewReceipt, setPreviewReceipt] = useState<{ imageUrl: string; title: string; fileName: string } | null>(null);

  // Cancellation State
  const [paymentToCancel, setPaymentToCancel] = useState<ClientPayment | null>(null);

  const clients = users.filter(u => u.role === 'client');

  // Delivered packages not yet paid to clients
  const unpaidDeliveredPackages = packages.filter(p => p.status === 'livre' && !p.isPaidToClient);

  // Global calculations
  const totalCollectedAllTime = packages
    .filter(p => p.status === 'livre')
    .reduce((acc, p) => acc + (p.codAmount || 0), 0);

  const totalDeliveryFeesAllTime = packages
    .filter(p => p.status === 'livre')
    .reduce((acc, p) => acc + (p.deliveryFee || 0), 0);

  const totalPaidOutToClients = payments
    .filter(p => p.status === 'paye')
    .reduce((acc, p) => acc + p.netAmount, 0);

  const totalPendingPayout = unpaidDeliveredPackages
    .reduce((acc, p) => acc + ((p.codAmount || 0) - (p.deliveryFee || 0)), 0);

  // Filter packages & pending debts for selected client in payout generator modal
  const clientAvailablePackages = unpaidDeliveredPackages.filter(p => p.clientId === selectedClientId);
  const clientPendingDebts = clientDebts.filter(
    d => d.clientId === selectedClientId && !d.isSettled && d.status !== 'regle'
  );

  const handleSelectClient = (clientId: string) => {
    setSelectedClientId(clientId);
    const available = unpaidDeliveredPackages.filter(p => p.clientId === clientId).map(p => p.id);
    setSelectedPackageIds(available); // select all by default
    const pendingDebtsIds = clientDebts
      .filter(d => d.clientId === clientId && !d.isSettled && d.status !== 'regle')
      .map(d => d.id);
    setSelectedDebtIds(pendingDebtsIds);
    setPackagingFees('0');
    setExtraDeductions('0');
    setDeductionNotes('');
  };

  const handleTogglePackage = (pkgId: string) => {
    if (selectedPackageIds.includes(pkgId)) {
      setSelectedPackageIds(selectedPackageIds.filter(id => id !== pkgId));
    } else {
      setSelectedPackageIds([...selectedPackageIds, pkgId]);
    }
  };

  const handleToggleDebt = (debtId: string) => {
    if (selectedDebtIds.includes(debtId)) {
      setSelectedDebtIds(selectedDebtIds.filter(id => id !== debtId));
    } else {
      setSelectedDebtIds([...selectedDebtIds, debtId]);
    }
  };

  const handleGenerateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClientId || selectedPackageIds.length === 0) {
      alert('Veuillez sélectionner un client et au moins un colis à inclure.');
      return;
    }

    const createdPayment = generateClientPayment(
      selectedClientId,
      selectedPackageIds,
      paymentMethod,
      paymentNotes,
      undefined,
      {
        packagingFees: Number(packagingFees) || 0,
        extraDeductions: Number(extraDeductions) || 0,
        deductionNotes: deductionNotes.trim() || undefined,
        settleDebtIds: selectedDebtIds,
        receiptImageUrl: modalReceiptUrl || undefined,
        receiptFileName: modalReceiptFileName || undefined
      }
    );

    setShowGenerateModal(false);
    setSelectedClientId('');
    setSelectedPackageIds([]);
    setSelectedDebtIds([]);
    setPackagingFees('0');
    setExtraDeductions('0');
    setDeductionNotes('');
    setModalReceiptUrl('');
    setModalReceiptFileName('');
    onOpenReleveModal(createdPayment);
  };

  const handleModalReceiptPick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const compressed = await compressImageFileToDataUrl(file, 1200, 0.82);
      setModalReceiptUrl(compressed);
      setModalReceiptFileName(file.name || 'recu_virement.jpg');
    } catch {
      // ignore invalid file
    }
    e.target.value = '';
  };

  const handleRowReceiptPick = async (paymentId: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const compressed = await compressImageFileToDataUrl(file, 1200, 0.82);
      attachPaymentReceipt(paymentId, {
        imageUrl: compressed,
        fileName: file.name || `recu_${paymentId}.jpg`
      });
    } catch {
      // ignore invalid file
    }
    e.target.value = '';
  };

  const handleConfirmCancelPayment = (reason?: string) => {
    if (!paymentToCancel) return;
    cancelPayment(paymentToCancel.id, reason || 'Annulation administrative');
    setPaymentToCancel(null);
  };

  const handleExportCSV = () => {
    exportFinancialStatementToCSV(
      payments,
      `fariousy_releves_${new Date().toISOString().substring(0, 10)}.csv`
    );
  };

  const filteredPayments = payments.filter(p => {
    const q = searchTerm.toLowerCase();
    const matchesSearch =
      (p.reference || '').toLowerCase().includes(q) ||
      (p.clientName || '').toLowerCase().includes(q) ||
      (p.clientCompany || '').toLowerCase().includes(q);
    const matchesStatus = statusFilter === 'all' || p.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  // Preview totals in modal
  const modalSelectedPackages = packages.filter(p => selectedPackageIds.includes(p.id));
  const previewCollected = modalSelectedPackages.reduce((acc, p) => acc + (p.codAmount || 0), 0);
  const previewFees = modalSelectedPackages.reduce((acc, p) => acc + (p.deliveryFee || 0), 0);
  const previewSelectedDebts = clientPendingDebts
    .filter(d => selectedDebtIds.includes(d.id))
    .reduce((acc, d) => acc + (d.amount || 0), 0);
  const previewPackaging = Math.max(0, Number(packagingFees) || 0);
  const previewExtras = Math.max(0, Number(extraDeductions) || 0);
  const previewNet = previewCollected - previewFees - previewSelectedDebts - previewPackaging - previewExtras;

  return (
    <div className="space-y-6">
      {/* Title & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <h2 className="text-xl font-black text-slate-900 tracking-tight">
            Gestion Financière & Règlements Marchands
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Encaissements COD, déduction des frais, relevés de virement, annulations sécurisées et historique complet
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setShowMonthlyReportModal(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-slate-900 bg-amber-50 border border-amber-300 hover:bg-amber-100 rounded-xl shadow-2xs transition-colors cursor-pointer"
          >
            <FileText className="w-3.5 h-3.5 text-amber-700" />
            <span>Bilan Mensuel PDF (المحاسبة)</span>
          </button>

          <button
            onClick={handleExportCSV}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-xl shadow-2xs transition-colors cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 text-slate-600" />
            <span>Exporter Relevés CSV</span>
          </button>

          <button
            onClick={() => {
              setShowGenerateModal(true);
              if (clients.length > 0 && !selectedClientId) {
                handleSelectClient(clients[0].id);
              }
            }}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-red-600 hover:bg-red-700 rounded-xl shadow-xs transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Générer un Relevé Client</span>
          </button>
        </div>
      </div>

      {/* Financial Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Collecté Brut */}
        <div className="p-5 bg-slate-900 text-white rounded-2xl shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              Total Encaissé Brut
            </span>
            <Banknote className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="mt-2 text-2xl font-black font-mono text-emerald-400 tabular-nums">
            {formatMAD(totalCollectedAllTime)}
          </div>
          <p className="text-[11px] text-slate-400 mt-1">Cash On Delivery collecté</p>
        </div>

        {/* Commissions FARIOUSY */}
        <div className="p-5 bg-white border border-slate-200 rounded-2xl shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              Frais Livraison Déduits
            </span>
            <BadgeDollarSign className="w-4 h-4 text-red-600" />
          </div>
          <div className="mt-2 text-2xl font-black font-mono text-red-600 tabular-nums">
            {formatMAD(totalDeliveryFeesAllTime)}
          </div>
          <p className="text-[11px] text-slate-500 mt-1">Chiffre d'affaires prestations</p>
        </div>

        {/* Déjà versé aux marchands */}
        <div className="p-5 bg-white border border-slate-200 rounded-2xl shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              Total Déjà Versé
            </span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="mt-2 text-2xl font-black font-mono text-slate-900 tabular-nums">
            {formatMAD(totalPaidOutToClients)}
          </div>
          <p className="text-[11px] text-slate-500 mt-1">Règlements virés aux marchands</p>
        </div>

        {/* Solde en cours à verser */}
        <div className="p-5 bg-amber-50/70 border border-amber-200 rounded-2xl shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-amber-900 uppercase tracking-wider">
              Solde Restant à Verser
            </span>
            <Clock className="w-4 h-4 text-amber-600" />
          </div>
          <div className="mt-2 text-2xl font-black font-mono text-amber-700 tabular-nums">
            {formatMAD(totalPendingPayout)}
          </div>
          <p className="text-[11px] text-amber-800 mt-1">
            {unpaidDeliveredPackages.length} colis livrés en attente de virement
          </p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-3 border border-slate-200 rounded-2xl shadow-2xs">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            placeholder="Rechercher par référence, client..."
            className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-500"
          />
        </div>

        <div className="flex items-center gap-2">
          <Filter className="w-3.5 h-3.5 text-slate-400" />
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value as any)}
            className="text-xs font-semibold px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-red-500"
          >
            <option value="all">Tous les statuts ({payments.length})</option>
            <option value="paye">Réglés / Payés</option>
            <option value="en_attente">En attente de virement</option>
            <option value="annule">Opérations Annulées</option>
          </select>
        </div>
      </div>

      {/* History of Relevés / Payout Invoices */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-2xs overflow-hidden space-y-3">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-900">Historique des Relevés et Règlements</h3>
            <p className="text-xs text-slate-500">Tous les bordereaux de paiement édités pour les marchands</p>
          </div>
          <span className="text-xs font-mono font-semibold text-slate-500">
            {filteredPayments.length} relevé(s) affiché(s)
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200 uppercase text-[10px] tracking-wider">
              <tr>
                <th className="py-3 px-4">Réf. Relevé</th>
                <th className="py-3 px-4">Date Émission</th>
                <th className="py-3 px-4">Client Bénéficiaire</th>
                <th className="py-3 px-4 text-center">Colis Inclus</th>
                <th className="py-3 px-4 text-right">Total Encaissé</th>
                <th className="py-3 px-4 text-right">Frais Prestation</th>
                <th className="py-3 px-4 text-right">Net Versé</th>
                <th className="py-3 px-4">Statut Opération</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredPayments.map(payment => (
                <tr
                  key={payment.id}
                  className={`hover:bg-slate-50 transition-colors ${
                    payment.status === 'annule' ? 'opacity-60 bg-rose-50/20' : ''
                  }`}
                >
                  <td className="py-3 px-4 font-mono font-bold text-slate-900">{payment.reference}</td>
                  <td className="py-3 px-4 text-slate-600 font-mono">{payment.date}</td>
                  <td className="py-3 px-4">
                    <span className="font-extrabold text-slate-900 block">{payment.clientCompany}</span>
                    <span className="text-[11px] text-slate-500">{payment.clientName}</span>
                  </td>
                  <td className="py-3 px-4 text-center font-mono font-semibold text-slate-700">
                    {payment.packageCount}
                  </td>
                  <td className="py-3 px-4 text-right font-mono text-slate-700">
                    {formatMAD(payment.totalCollected)}
                  </td>
                  <td className="py-3 px-4 text-right font-mono text-red-600">
                    <span>-{formatMAD(payment.totalDeliveryFees)}</span>
                    {((payment.packagingFees || 0) + (payment.extraDeductions || 0)) > 0 && (
                      <span className="block text-[10px] text-rose-600 font-bold">
                        -{formatMAD((payment.packagingFees || 0) + (payment.extraDeductions || 0))} لومبلاج/إضافي
                      </span>
                    )}
                  </td>
                  <td className="py-3 px-4 text-right font-mono font-black text-emerald-700 text-sm">
                    {formatMAD(payment.netAmount)}
                  </td>
                  <td className="py-3 px-4">
                    <span className="font-medium text-slate-800 block text-[11px]">{payment.paymentMethod}</span>
                    {payment.status === 'annule' ? (
                      <span className="inline-block mt-0.5 px-2 py-0.2 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-200">
                        Annulé
                      </span>
                    ) : payment.status === 'paye' ? (
                      <span className="inline-block mt-0.5 px-2 py-0.2 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                        Réglé
                      </span>
                    ) : (
                      <span className="inline-block mt-0.5 px-2 py-0.2 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">
                        En attente
                      </span>
                    )}
                  </td>
                  <td className="py-3 px-4 text-right">
                    <div className="flex items-center justify-end gap-1.5 flex-wrap">
                      {payment.receiptImageUrl ? (
                        <>
                          <button
                            type="button"
                            onClick={() =>
                              setPreviewReceipt({
                                imageUrl: payment.receiptImageUrl!,
                                title: `${payment.reference} — ${payment.clientCompany}`,
                                fileName: payment.receiptFileName || `virement_${payment.reference}.jpg`
                              })
                            }
                            className="px-2 py-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 rounded-lg inline-flex items-center gap-1 cursor-pointer"
                            title="عرض صورة التحويل البنكي"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>صورة التحويل</span>
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              downloadImageUrl(
                                payment.receiptImageUrl!,
                                payment.receiptFileName || `virement_${payment.reference}.jpg`
                              )
                            }
                            className="p-1.5 text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg cursor-pointer"
                            title="تنزيل صورة التحويل البنكي"
                          >
                            <Download className="w-3.5 h-3.5" />
                          </button>
                        </>
                      ) : (
                        <label
                          className="px-2 py-1 text-[11px] font-bold text-slate-700 bg-amber-50 border border-amber-200 hover:bg-amber-100 rounded-lg inline-flex items-center gap-1 cursor-pointer"
                          title="إرفاق صورة التحويل البنكي"
                        >
                          <Upload className="w-3.5 h-3.5 text-amber-700" />
                          <span>+ صورة</span>
                          <input
                            type="file"
                            accept="image/*"
                            onChange={e => handleRowReceiptPick(payment.id, e)}
                            className="hidden"
                          />
                        </label>
                      )}

                      <button
                        onClick={() => onOpenReleveModal(payment)}
                        className="px-2.5 py-1 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors inline-flex items-center gap-1 cursor-pointer"
                      >
                        <Printer className="w-3.5 h-3.5 text-red-600" />
                        <span>Relevé</span>
                      </button>

                      {payment.status !== 'annule' && (
                        <button
                          onClick={() => setPaymentToCancel(payment)}
                          className="p-1 text-slate-400 hover:text-rose-600 rounded"
                          title="Annuler cette opération financière"
                        >
                          <Ban className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {filteredPayments.length === 0 && (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-slate-400">
                    Aucune opération financière trouvée.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Generate Relevé Modal */}
      {showGenerateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs no-print">
          <div className="relative w-full max-w-3xl bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Générer un Relevé de Paiement Client
                </h3>
                <p className="text-xs text-slate-500">
                  Règlement des colis livrés et déduction automatique des frais de livraison
                </p>
              </div>
              <button onClick={() => setShowGenerateModal(false)} className="p-2 text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleGenerateSubmit} className="p-6 overflow-y-auto space-y-4">
              {/* Select Client */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Sélectionner le Client E-commerce *
                </label>
                <select
                  value={selectedClientId}
                  onChange={e => handleSelectClient(e.target.value)}
                  className="w-full text-xs font-bold bg-slate-50 border border-slate-300 rounded-xl px-3 py-2.5 text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-500"
                >
                  <option value="">-- Choisir un marchand --</option>
                  {clients.map(c => {
                    const count = unpaidDeliveredPackages.filter(p => p.clientId === c.id).length;
                    return (
                      <option key={c.id} value={c.id}>
                        {c.companyName || c.name} — ({count} colis livrés à régler)
                      </option>
                    );
                  })}
                </select>
              </div>

              {selectedClientId && (
                <>
                  {/* Select packages list */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-xs font-bold text-slate-700">
                        Colis livrés à inclure dans ce virement :
                      </label>
                      <button
                        type="button"
                        onClick={() => {
                          if (selectedPackageIds.length === clientAvailablePackages.length) {
                            setSelectedPackageIds([]);
                          } else {
                            setSelectedPackageIds(clientAvailablePackages.map(p => p.id));
                          }
                        }}
                        className="text-[11px] font-bold text-red-600 hover:underline cursor-pointer"
                      >
                        {selectedPackageIds.length === clientAvailablePackages.length
                          ? 'Tout désélectionner'
                          : 'Tout sélectionner'}
                      </button>
                    </div>

                    <div className="border border-slate-200 rounded-xl max-h-48 overflow-y-auto divide-y divide-slate-100 text-xs">
                      {clientAvailablePackages.map(pkg => (
                        <label
                          key={pkg.id}
                          className="flex items-center justify-between p-2.5 hover:bg-slate-50 cursor-pointer"
                        >
                          <div className="flex items-center gap-2.5">
                            <input
                              type="checkbox"
                              checked={selectedPackageIds.includes(pkg.id)}
                              onChange={() => handleTogglePackage(pkg.id)}
                              className="rounded-sm border-slate-300 text-red-600 focus:ring-red-500"
                            />
                            <div>
                              <span className="font-mono font-bold text-slate-900">
                                {pkg.trackingNumber}
                              </span>
                              <span className="text-slate-400 mx-1.5">·</span>
                              <span className="text-slate-700">{pkg.recipientName}</span>
                              <span className="text-slate-400 mx-1.5">·</span>
                              <span className="text-slate-500">{pkg.city}</span>
                            </div>
                          </div>
                          <div className="text-right">
                            <span className="font-mono font-bold text-slate-900 block">
                              {formatMAD(pkg.codAmount)}
                            </span>
                            <span className="text-[10px] text-red-600 font-mono">
                              -{formatMAD(pkg.deliveryFee)} frais
                            </span>
                          </div>
                        </label>
                      ))}

                      {clientAvailablePackages.length === 0 && (
                        <div className="py-6 text-center text-slate-400">
                          Aucun colis livré non encore réglé pour ce marchand.
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Pending Client Deductions (Emballage / Extras) + Manual Input */}
                  <div className="p-4 bg-rose-50/50 border border-rose-200 rounded-xl space-y-3 text-xs">
                    <div className="font-bold text-slate-900">
                      📦 اقتطاع ثمن لومبلاج والمصاريف الإضافية (Déductions Emballage &amp; Extras) :
                    </div>

                    {clientPendingDebts.length > 0 && (
                      <div className="bg-white border border-rose-200 rounded-lg divide-y divide-slate-100 max-h-32 overflow-y-auto">
                        {clientPendingDebts.map(debt => (
                          <label key={debt.id} className="flex items-center justify-between p-2 hover:bg-rose-50/40 cursor-pointer">
                            <div className="flex items-center gap-2">
                              <input
                                type="checkbox"
                                checked={selectedDebtIds.includes(debt.id)}
                                onChange={() => handleToggleDebt(debt.id)}
                                className="rounded-sm border-slate-300 text-red-600 focus:ring-red-500"
                              />
                              <span className="font-semibold text-slate-800">{debt.reason || debt.debtType}</span>
                            </div>
                            <span className="font-mono font-bold text-rose-600">-{formatMAD(debt.amount)}</span>
                          </label>
                        ))}
                      </div>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 mb-1">
                          ثمن لومبلاج (Emballage - DH)
                        </label>
                        <input
                          type="number"
                          min="0"
                          step="0.5"
                          value={packagingFees}
                          onChange={e => setPackagingFees(e.target.value)}
                          className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg font-mono font-bold text-rose-600"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 mb-1">
                          مصاريف زايدة أخرى (DH)
                        </label>
                        <input
                          type="number"
                          min="0"
                          step="0.5"
                          value={extraDeductions}
                          onChange={e => setExtraDeductions(e.target.value)}
                          className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg font-mono font-bold text-rose-600"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 mb-1">
                          سبب / تفاصيل الاقتطاع
                        </label>
                        <input
                          type="text"
                          value={deductionNotes}
                          onChange={e => setDeductionNotes(e.target.value)}
                          placeholder="مثلاً: كرطون التغليف..."
                          className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Summary preview */}
                  {selectedPackageIds.length > 0 && (
                    <div className="p-4 bg-slate-900 text-white rounded-xl space-y-2 text-xs">
                      <div className="flex justify-between text-slate-400">
                        <span>Colis sélectionnés :</span>
                        <span className="font-mono font-bold text-white">
                          {selectedPackageIds.length} colis
                        </span>
                      </div>
                      <div className="flex justify-between text-slate-400">
                        <span>Total Cash Collecté Brut (COD) :</span>
                        <span className="font-mono font-bold text-white">
                          {formatMAD(previewCollected)}
                        </span>
                      </div>
                      <div className="flex justify-between text-slate-400">
                        <span>Déduction Frais de Livraison FARIOUSY :</span>
                        <span className="font-mono font-bold text-red-400">
                          -{formatMAD(previewFees)}
                        </span>
                      </div>
                      {(previewPackaging > 0 || previewExtras > 0 || previewSelectedDebts > 0) && (
                        <div className="flex justify-between text-rose-300">
                          <span>Déduction Emballage (لومبلاج) &amp; Extras :</span>
                          <span className="font-mono font-bold">
                            -{formatMAD(previewPackaging + previewExtras + previewSelectedDebts)}
                          </span>
                        </div>
                      )}
                      <div className="pt-2 border-t border-slate-800 flex justify-between text-sm">
                        <span className="font-bold text-white">Net à Virer au Marchand :</span>
                        <span className="font-mono font-black text-emerald-400 text-base">
                          {formatMAD(previewNet)}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Payment Method */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Mode de règlement
                      </label>
                      <select
                        value={paymentMethod}
                        onChange={e => setPaymentMethod(e.target.value as any)}
                        className="w-full text-xs bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-900 font-semibold"
                      >
                        <option value="Virement bancaire">Virement bancaire</option>
                        <option value="Espèces">Espèces (Au bureau)</option>
                        <option value="Chèque">Chèque bancaire</option>
                        <option value="Mise à disposition">Mise à disposition</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Notes & Réf. Virement (Optionnel)
                      </label>
                      <input
                        type="text"
                        value={paymentNotes}
                        onChange={e => setPaymentNotes(e.target.value)}
                        placeholder="Ex: N° Opération Attijari..."
                        className="w-full text-xs bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-900"
                      />
                    </div>
                  </div>

                  {/* Upload Bank Transfer Receipt Photo */}
                  <div className="p-3.5 bg-emerald-50/50 border border-emerald-200 rounded-xl space-y-2 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-emerald-950 flex items-center gap-1.5">
                        <FileImage className="w-4 h-4 text-emerald-600" />
                        <span>صورة التحويل البنكي (Preuve de virement - Optionnel)</span>
                      </span>
                      {modalReceiptUrl && (
                        <button
                          type="button"
                          onClick={() => {
                            setModalReceiptUrl('');
                            setModalReceiptFileName('');
                          }}
                          className="text-[11px] font-bold text-rose-600 hover:underline cursor-pointer"
                        >
                          إزالة الصورة
                        </button>
                      )}
                    </div>
                    {modalReceiptUrl ? (
                      <div className="flex items-center gap-3 bg-white p-2 rounded-lg border border-emerald-200">
                        <img
                          src={modalReceiptUrl}
                          alt="Aperçu virement"
                          className="w-16 h-16 object-cover rounded border border-slate-200"
                        />
                        <div className="min-w-0 flex-1">
                          <div className="font-bold text-slate-800 truncate">{modalReceiptFileName}</div>
                          <div className="text-[10px] text-emerald-700">سيتمكن الزبون من معاينة الصورة وتنزيلها مباشرة</div>
                        </div>
                      </div>
                    ) : (
                      <label className="flex items-center justify-center gap-2 py-3 px-4 border-2 border-dashed border-emerald-300 bg-white hover:bg-emerald-50/40 rounded-xl cursor-pointer transition">
                        <Upload className="w-4 h-4 text-emerald-600" />
                        <span className="font-bold text-emerald-800">اختر صورة وصل التحويل البنكي (اختياري)</span>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleModalReceiptPick}
                          className="hidden"
                        />
                      </label>
                    )}
                  </div>
                </>
              )}

              <div className="pt-3 border-t flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowGenerateModal(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={selectedPackageIds.length === 0}
                  className="px-5 py-2.5 text-xs font-bold text-white bg-red-600 hover:bg-red-700 disabled:bg-slate-300 rounded-xl shadow-xs transition-colors cursor-pointer"
                >
                  Générer le Relevé & Valider
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Cancel Payment Confirmation Modal (Section 4: Sécurité des opérations financières) */}
      {paymentToCancel && (
        <ConfirmActionModal
          isOpen={true}
          title={`Annulation du Relevé ${paymentToCancel.reference}`}
          message={`L'annulation de ce relevé de ${formatMAD(paymentToCancel.netAmount)} déverrouillera automatiquement les ${paymentToCancel.packageCount} colis inclus pour permettre une réédition ultérieure. Une trace sera enregistrée dans le journal d'activité.`}
          confirmLabel="Confirmer l'annulation financière"
          isDestructive={false}
          requireReason={true}
          onConfirm={handleConfirmCancelPayment}
          onCancel={() => setPaymentToCancel(null)}
        />
      )}

      {/* Monthly Accounting PDF Report Modal */}
      <MonthlyAccountingReportModal
        isOpen={showMonthlyReportModal}
        onClose={() => setShowMonthlyReportModal(false)}
      />

      {/* Preview Receipt Modal */}
      {previewReceipt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs">
          <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100 bg-slate-50">
              <div className="flex items-center gap-2 text-sm font-bold text-slate-900">
                <FileImage className="w-4 h-4 text-emerald-600" />
                <span>{previewReceipt.title}</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => downloadImageUrl(previewReceipt.imageUrl, previewReceipt.fileName)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>تنزيل الصورة</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewReceipt(null)}
                  className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div className="p-4 bg-slate-900/5 overflow-auto flex items-center justify-center">
              <img
                src={previewReceipt.imageUrl}
                alt={previewReceipt.title}
                className="max-h-[70vh] w-auto object-contain rounded-xl shadow-xs"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
