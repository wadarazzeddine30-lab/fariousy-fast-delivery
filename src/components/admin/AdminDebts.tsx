import React, { useState, useMemo, useEffect } from 'react';
import { useDatabase } from '../../context/DatabaseContext';
import { UserProfile, PackageItem } from '../../types';
import { formatMAD, formatDate } from '../../utils/barcode';
import { compressImageFileToDataUrl, downloadImageUrl } from '../../utils/imageCompress';
import { exportCSV } from '../../utils/export';
import {
  Search,
  Plus,
  Download,
  ArrowLeft,
  X,
  CheckCircle2,
  Eye,
  Edit2,
  Trash2,
  Truck,
  ChevronDown,
  ChevronUp,
  Wallet,
  Box,
  MinusCircle,
  FileImage,
  Upload,
  Landmark,
  Calendar,
  ZoomIn,
  Clock
} from 'lucide-react';

const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;

function parseFlexibleTimestampMs(input?: string): number | null {
  if (!input) return null;
  const trimmed = String(input).trim();
  if (!trimmed) return null;

  if (/[Zz]$|[+-]\d{2}:?\d{2}$/.test(trimmed)) {
    const iso = new Date(trimmed);
    if (!Number.isNaN(iso.getTime())) return iso.getTime();
  }

  const ymd = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T\s]+(\d{2}):(\d{2})(?::(\d{2}))?)?/);
  if (ymd) {
    const d = new Date(
      Number(ymd[1]),
      Number(ymd[2]) - 1,
      Number(ymd[3]),
      Number(ymd[4] || 0),
      Number(ymd[5] || 0),
      Number(ymd[6] || 0)
    );
    if (!Number.isNaN(d.getTime())) return d.getTime();
  }

  const dmy = trimmed.match(/^(\d{2})\/(\d{2})\/(\d{4})(?:[,\s]+(\d{2}):(\d{2})(?::(\d{2}))?)?/);
  if (dmy) {
    const d = new Date(
      Number(dmy[3]),
      Number(dmy[2]) - 1,
      Number(dmy[1]),
      Number(dmy[4] || 0),
      Number(dmy[5] || 0),
      Number(dmy[6] || 0)
    );
    if (!Number.isNaN(d.getTime())) return d.getTime();
  }

  const parsed = new Date(trimmed);
  return Number.isNaN(parsed.getTime()) ? null : parsed.getTime();
}

function getPackageDeliveredTimestampMs(pkg: PackageItem): number | null {
  if (pkg.status !== 'livre') return null;

  if (Array.isArray(pkg.history) && pkg.history.length > 0) {
    for (let i = pkg.history.length - 1; i >= 0; i--) {
      const h = pkg.history[i];
      if (h?.status === 'livre' && h.timestamp) {
        const ms = parseFlexibleTimestampMs(h.timestamp);
        if (ms !== null) return ms;
      }
    }
  }

  return parseFlexibleTimestampMs(pkg.lastMovedAt) ?? parseFlexibleTimestampMs(pkg.createdAt);
}

function formatRemaining24hLabel(deliveredMs: number | null, nowMs: number): string {
  if (deliveredMs === null) return '< 24h';
  const remainingMs = Math.max(0, TWENTY_FOUR_HOURS_MS - (nowMs - deliveredMs));
  const totalMinutes = Math.ceil(remainingMs / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const mins = totalMinutes % 60;
  if (hours <= 0) return `متبقي ${mins} د`;
  return `متبقي ${hours}س ${mins}د`;
}

interface AdminDebtsProps {
  onViewPackage?: (pkg: PackageItem) => void;
}

export const AdminDebts: React.FC<AdminDebtsProps> = ({ onViewPackage }) => {
  const {
    users,
    packages,
    payments,
    clientDebts,
    transferReceipts,
    generateClientPayment,
    attachPaymentReceipt,
    addTransferReceipt,
    deleteTransferReceipt,
    addClientDebt,
    settleClientDebt,
    deleteClientDebt,
    addClient,
    addAuditLog
  } = useDatabase();

  // Search & Navigation state
  const [activeSubTab, setActiveSubTab] = useState<'receipts' | 'balances'>('receipts');
  const [searchTerm, setSearchTerm] = useState('');
  const [showAllClients, setShowAllClients] = useState(false);
  const [receiptSearchTerm, setReceiptSearchTerm] = useState('');
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNowMs(Date.now());
    }, 60000);
    return () => window.clearInterval(timer);
  }, []);

  // Modals state
  const [showUploadReceiptModal, setShowUploadReceiptModal] = useState(false);
  const [previewReceipt, setPreviewReceipt] = useState<{
    imageUrl: string;
    title: string;
    subtitle: string;
    fileName: string;
  } | null>(null);
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [showAddClientModal, setShowAddClientModal] = useState(false);
  const [showArticlesModal, setShowArticlesModal] = useState<any | null>(null);

  // Standalone Bank Transfer Receipt Upload State
  const [receiptClientId, setReceiptClientId] = useState('');
  const [receiptAmount, setReceiptAmount] = useState('');
  const [receiptReference, setReceiptReference] = useState('');
  const [receiptDate, setReceiptDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [receiptBankName, setReceiptBankName] = useState('');
  const [receiptNotes, setReceiptNotes] = useState('');
  const [receiptImageUrl, setReceiptImageUrl] = useState('');
  const [receiptFileName, setReceiptFileName] = useState('');
  const [isCompressingReceipt, setIsCompressingReceipt] = useState(false);

  // Withdraw Modal Receipt Attachment State
  const [withdrawReceiptUrl, setWithdrawReceiptUrl] = useState('');
  const [withdrawReceiptFileName, setWithdrawReceiptFileName] = useState('');

  // Deduction Form State (ثمن لومبلاج ومصاريف إضافية)
  const [deductionType, setDeductionType] = useState<'emballage' | 'frais_supplementaires' | 'frais_retour' | 'avance_fonds'>('emballage');
  const [deductionQty, setDeductionQty] = useState<string>('1');
  const [deductionUnitPrice, setDeductionUnitPrice] = useState<string>('');
  const [deductionAmount, setDeductionAmount] = useState<string>('');
  const [deductionReason, setDeductionReason] = useState<string>('');

  // Instant deduction inputs inside "Retirer" modal
  const [withdrawEmballage, setWithdrawEmballage] = useState<string>('0');
  const [withdrawExtra, setWithdrawExtra] = useState<string>('0');
  const [withdrawNote, setWithdrawNote] = useState<string>('');

  // Success Toast state (as seen in video)
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');

  // Accordion toggles for parcel status
  const [isLivreExpanded, setIsLivreExpanded] = useState(true);
  const [isInProgressExpanded, setIsInProgressExpanded] = useState(false);
  const [isRefusedExpanded, setIsRefusedExpanded] = useState(false);

  // Payment history pagination
  const [paymentPage, setPaymentPage] = useState(1);

  // Add client form state
  const [newClientName, setNewClientName] = useState('');
  const [newClientPhone, setNewClientPhone] = useState('');
  const [newClientEmail, setNewClientEmail] = useState('');
  const [newClientCompany, setNewClientCompany] = useState('');
  const [newClientCity, setNewClientCity] = useState('Laâyoune');
  const [newClientAddress, setNewClientAddress] = useState('');
  const [newClientBankRib, setNewClientBankRib] = useState('');

  // Local state for cleared balances in current session (to match instant 0.00 Dh UI response from video)
  const [clearedClientIds, setClearedClientIds] = useState<Set<string>>(new Set());
  const [localWithdrawals, setLocalWithdrawals] = useState<Record<string, any[]>>({});

  // 1. Gather all registered clients from DB
  const allClients: UserProfile[] = useMemo(() => {
    return users.filter(u => u.role === 'client');
  }, [users]);

  // Compute metrics per client (separating >= 24h payable balance from < 24h hold window)
  const clientFinancialSummaries = useMemo(() => {
    return allClients.map(client => {
      const clientShopId = (client as any).shopId;
      // Find real packages from DB
      const clientPkgs = packages.filter(
        p =>
          p.clientId === client.id ||
          (Boolean(p.shopId) &&
            (p.shopId === client.id || (Boolean(clientShopId) && p.shopId === clientShopId))) ||
          (p.clientPhone && client.phone && p.clientPhone === client.phone) ||
          (client.companyName && p.clientCompany === client.companyName)
      );

      const deliveredPkgs = clientPkgs.filter(p => p.status === 'livre');
      const inProgressPkgs = clientPkgs.filter(p =>
        ['en_transit', 'en_cours_transfert', 'en_distribution', 'en_stock', 'expedie_hub', 'nouveau', 'attente_ramassage', 'ramasse', 'arrive_destination', 'en_cours_livraison', 'pas_de_reponse', 'reporte', 'probleme_livraison'].includes(p.status)
      );
      const refusedPkgs = clientPkgs.filter(p =>
        ['retourne', 'retour_recu', 'retour_en_cours', 'annule', 'refuse'].includes(p.status)
      );

      const totalRevenue = deliveredPkgs.reduce((sum, p) => sum + (p.codAmount || 0), 0);
      const totalDeliveryFees = deliveredPkgs.reduce((sum, p) => sum + (p.deliveryFee ?? 45), 0);

      // Check if user has emptied the balance in this session
      const isCleared = clearedClientIds.has(client.id);

      // Split unpaid delivered packages into: >= 24h after delivery vs < 24h hold window
      const unpaidDelivered = deliveredPkgs.filter(p => !p.isPaidToClient);
      const eligibleUnpaidDelivered = unpaidDelivered.filter(p => {
        const deliveredMs = getPackageDeliveredTimestampMs(p);
        return deliveredMs !== null && nowMs - deliveredMs >= TWENTY_FOUR_HOURS_MS;
      });
      const pending24hDelivered = unpaidDelivered.filter(p => {
        const deliveredMs = getPackageDeliveredTimestampMs(p);
        return deliveredMs === null || nowMs - deliveredMs < TWENTY_FOUR_HOURS_MS;
      });

      const eligibleCalculatedNet = eligibleUnpaidDelivered.reduce(
        (sum, p) => sum + ((p.codAmount || 0) - (p.deliveryFee ?? 45)),
        0
      );
      const pending24hCalculatedNet = pending24hDelivered.reduce(
        (sum, p) => sum + ((p.codAmount || 0) - (p.deliveryFee ?? 45)),
        0
      );

      // Pending packaging & extra deductions for this client
      const clientAllDebts = clientDebts.filter(d => d.clientId === client.id);
      const pendingDebts = clientAllDebts.filter(d => !d.isSettled && d.status !== 'regle');
      const totalPendingDeductions = pendingDebts.reduce((sum, d) => sum + (d.amount || 0), 0);
      const packagingPending = pendingDebts
        .filter(d => d.debtType === 'emballage')
        .reduce((sum, d) => sum + (d.amount || 0), 0);
      const extrasPending = totalPendingDeductions - packagingPending;

      const grossSolde = isCleared ? 0 : Math.max(0, eligibleCalculatedNet);
      const solde = isCleared ? 0 : Math.max(0, grossSolde - totalPendingDeductions);
      const pending24hSolde = isCleared ? 0 : Math.max(0, pending24hCalculatedNet);

      return {
        client,
        grossSolde,
        solde,
        pending24hSolde,
        totalPendingDeductions,
        packagingPending,
        extrasPending,
        pendingDebts,
        clientAllDebts,
        unpaidDelivered,
        eligibleUnpaidDelivered,
        pending24hDelivered,
        totalRevenue,
        orderCount: clientPkgs.length,
        deliveredCount: deliveredPkgs.length,
        inProgressCount: inProgressPkgs.length,
        refusedCount: refusedPkgs.length,
        totalDeliveryFees,
        packages: clientPkgs,
        deliveredPkgs,
        inProgressPkgs,
        refusedPkgs
      };
    });
  }, [allClients, packages, clientDebts, clearedClientIds, nowMs]);

  // Global counts for eligible >=24h clients vs <24h hold window
  const eligibleClientsCount = useMemo(
    () => clientFinancialSummaries.filter(item => item.solde > 0).length,
    [clientFinancialSummaries]
  );

  const waiting24hClientsCount = useMemo(
    () => clientFinancialSummaries.filter(item => item.solde <= 0 && item.pending24hSolde > 0).length,
    [clientFinancialSummaries]
  );

  const totalEligibleBalance = useMemo(
    () => clientFinancialSummaries.reduce((sum, item) => sum + item.solde, 0),
    [clientFinancialSummaries]
  );

  const totalPending24hBalance = useMemo(
    () => clientFinancialSummaries.reduce((sum, item) => sum + item.pending24hSolde, 0),
    [clientFinancialSummaries]
  );

  // Only show clients owed money >= 24h after delivery by default (unless showAllClients is enabled)
  const filteredClientList = useMemo(() => {
    const q = searchTerm.toLowerCase().trim();
    return clientFinancialSummaries
      .filter(item => {
        if (!showAllClients && item.solde <= 0) {
          return false;
        }
        if (!q) return true;
        return (
          item.client.name.toLowerCase().includes(q) ||
          (item.client.companyName && item.client.companyName.toLowerCase().includes(q)) ||
          item.client.phone.includes(q) ||
          (item.client.city && item.client.city.toLowerCase().includes(q)) ||
          item.packages.some(p => p.trackingNumber.toLowerCase().includes(q))
        );
      })
      .sort((a, b) => b.solde - a.solde);
  }, [clientFinancialSummaries, searchTerm, showAllClients]);

  // Selected client object
  const selectedSummary = useMemo(() => {
    if (!selectedClientId) return null;
    return clientFinancialSummaries.find(s => s.client.id === selectedClientId) || null;
  }, [selectedClientId, clientFinancialSummaries]);

  // Payment history for selected client (real payments only)
  const clientPaymentHistory = useMemo(() => {
    if (!selectedSummary) return [];

    const realPayments = payments
      .filter(p => p.clientId === selectedSummary.client.id)
      .map(p => ({
        id: p.id,
        isRealPayment: true,
        reference: p.reference,
        type: 'Retrait' as const,
        date: formatDate(p.date),
        time: '12:00',
        solde: p.netAmount,
        tarif: p.totalDeliveryFees,
        receiptImageUrl: p.receiptImageUrl,
        receiptFileName: p.receiptFileName,
        packages: packages.filter(pkg => p.packageIds.includes(pkg.id))
      }));

    const local = localWithdrawals[selectedSummary.client.id] || [];

    return [...local, ...realPayments];
  }, [selectedSummary, payments, packages, localWithdrawals]);

  // Unified Bank Transfer Receipts list (standalone receipts + payments with receipt images)
  const allReceiptItems = useMemo(() => {
    const standalone = transferReceipts.map(r => ({
      id: r.id,
      kind: 'standalone' as const,
      clientId: r.clientId,
      clientName: r.clientName,
      clientCompany: r.clientCompany,
      clientPhone: r.clientPhone,
      bankName: r.bankName || r.clientBankName,
      bankRib: r.clientBankRib,
      reference: r.reference,
      amount: Number(r.amount || 0),
      date: r.transferDate || formatDate(r.createdAt),
      notes: r.notes,
      imageUrl: r.imageUrl,
      fileName: r.fileName || `virement_${r.reference}.jpg`,
      createdAt: r.createdAt
    }));

    const fromPayments = payments
      .filter(p => Boolean(p.receiptImageUrl))
      .map(p => {
        const matchedClient = allClients.find(c => c.id === p.clientId);
        return {
          id: p.id,
          kind: 'payment' as const,
          clientId: p.clientId,
          clientName: p.clientName,
          clientCompany: p.clientCompany,
          clientPhone: matchedClient?.phone,
          bankName: matchedClient?.bankName,
          bankRib: matchedClient?.bankRib,
          reference: p.reference,
          amount: Number(p.netAmount || 0),
          date: p.date,
          notes: p.notes,
          imageUrl: p.receiptImageUrl!,
          fileName: p.receiptFileName || `virement_${p.reference}.jpg`,
          createdAt: p.receiptUploadedAt || p.date
        };
      });

    return [...standalone, ...fromPayments].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }, [transferReceipts, payments, allClients]);

  const filteredReceiptItems = useMemo(() => {
    const q = receiptSearchTerm.toLowerCase().trim();
    if (!q) return allReceiptItems;
    return allReceiptItems.filter(
      r =>
        r.clientName.toLowerCase().includes(q) ||
        r.clientCompany.toLowerCase().includes(q) ||
        r.reference.toLowerCase().includes(q) ||
        (r.clientPhone && r.clientPhone.includes(q)) ||
        (r.notes && r.notes.toLowerCase().includes(q))
    );
  }, [allReceiptItems, receiptSearchTerm]);

  const triggerToast = (msg: string) => {
    setToastMessage(msg);
    setShowToast(true);
    setTimeout(() => setShowToast(false), 3800);
  };

  const handleReceiptFilePick = async (
    e: React.ChangeEvent<HTMLInputElement>,
    target: 'standalone' | 'withdraw'
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsCompressingReceipt(true);
    try {
      const compressed = await compressImageFileToDataUrl(file, 1200, 0.82);
      if (target === 'standalone') {
        setReceiptImageUrl(compressed);
        setReceiptFileName(file.name || 'recu_virement.jpg');
      } else {
        setWithdrawReceiptUrl(compressed);
        setWithdrawReceiptFileName(file.name || 'recu_virement.jpg');
      }
    } catch {
      triggerToast('تعذر قراءة الصورة، المرجو اختيار صورة صالحة.');
    } finally {
      setIsCompressingReceipt(false);
    }
    e.target.value = '';
  };

  const handlePaymentRowReceiptAttach = async (
    paymentId: string,
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const compressed = await compressImageFileToDataUrl(file, 1200, 0.82);
      attachPaymentReceipt(paymentId, {
        imageUrl: compressed,
        fileName: file.name || `recu_${paymentId}.jpg`
      });
      triggerToast('تم إرفاق صورة التحويل البنكي بنجاح وإشعار الزبون.');
    } catch {
      triggerToast('تعذر تحميل الصورة.');
    }
    e.target.value = '';
  };

  const handleUploadReceiptSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const client = allClients.find(c => c.id === receiptClientId);
    if (!client) {
      triggerToast('المرجو اختيار الزبون المستفيد.');
      return;
    }
    if (!receiptImageUrl) {
      triggerToast('المرجو اختيار صورة التحويل البنكي.');
      return;
    }

    const numericAmount = Math.max(0, Number(receiptAmount) || 0);
    const created = addTransferReceipt({
      clientId: client.id,
      clientName: client.name,
      clientCompany: client.companyName || client.name,
      clientPhone: client.phone,
      clientBankName: client.bankName,
      clientBankRib: client.bankRib,
      reference: receiptReference.trim() || undefined,
      amount: numericAmount,
      transferDate: receiptDate || new Date().toISOString().split('T')[0],
      bankName: receiptBankName.trim() || client.bankName,
      notes: receiptNotes.trim() || undefined,
      imageUrl: receiptImageUrl,
      fileName: receiptFileName || undefined
    });

    setShowUploadReceiptModal(false);
    setReceiptClientId('');
    setReceiptAmount('');
    setReceiptReference('');
    setReceiptBankName('');
    setReceiptNotes('');
    setReceiptImageUrl('');
    setReceiptFileName('');
    triggerToast(`تم إرسال صورة التحويل البنكي (${created.reference}) لمتجر ${created.clientCompany} بنجاح.`);
  };

  // Handle Adding a Packaging / Extra Deduction to Client Account
  const handleAddDeductionSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSummary) return;

    const qty = Math.max(1, Number(deductionQty) || 1);
    const unit = Number(deductionUnitPrice) || 0;
    const computedAmount = deductionAmount ? Number(deductionAmount) : qty * unit;

    if (!computedAmount || computedAmount <= 0) {
      triggerToast('المرجو إدخال مبلغ الاقتطاع بالدرهم.');
      return;
    }

    const defaultLabels: Record<string, string> = {
      emballage: `ثمن لومبلاج (Emballage${qty > 1 ? ` × ${qty}` : ''})`,
      frais_supplementaires: 'مصاريف إضافية (Frais supplémentaires)',
      frais_retour: 'مصاريف روتور (Frais retour)',
      avance_fonds: 'تسبيق / سلف نقدي (Avance)'
    };

    addClientDebt({
      clientId: selectedSummary.client.id,
      clientName: selectedSummary.client.name,
      clientCompany: selectedSummary.client.companyName || selectedSummary.client.name,
      debtType: deductionType,
      quantity: qty,
      unitPrice: unit > 0 ? unit : computedAmount,
      amount: computedAmount,
      reason: deductionReason.trim() || defaultLabels[deductionType],
      isSettled: false,
      status: 'en_attente'
    });

    setDeductionQty('1');
    setDeductionUnitPrice('');
    setDeductionAmount('');
    setDeductionReason('');

    setToastMessage(`تم خصم ${computedAmount.toFixed(2)} Dh (${defaultLabels[deductionType]}) من رصيد الزبون بنجاح.`);
    setShowToast(true);
    setTimeout(() => setShowToast(false), 3500);
  };

  // Handle Withdrawal ("Retirer" -> "Vider le solde du compte client ?")
  const handleConfirmWithdraw = () => {
    if (!selectedSummary) return;

    const instantEmballage = Math.max(0, Number(withdrawEmballage) || 0);
    const instantExtra = Math.max(0, Number(withdrawExtra) || 0);
    const finalNetWithdraw = Math.max(0, selectedSummary.solde - instantEmballage - instantExtra);

    const now = new Date();
    const dateStr = now.toLocaleDateString('fr-FR');
    const timeStr = now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

    // 1. Save any instant deductions entered in the withdrawal modal
    const createdInstantIds: string[] = [];
    if (instantEmballage > 0) {
      const embDebt = addClientDebt({
        clientId: selectedSummary.client.id,
        clientName: selectedSummary.client.name,
        clientCompany: selectedSummary.client.companyName || selectedSummary.client.name,
        debtType: 'emballage',
        amount: instantEmballage,
        reason: withdrawNote.trim() ? `ثمن لومبلاج: ${withdrawNote.trim()}` : 'ثمن لومبلاج مقتطع عند التحويل',
        isSettled: true,
        status: 'regle',
        settledAt: now.toISOString()
      });
      createdInstantIds.push(embDebt.id);
    }

    if (instantExtra > 0) {
      const extDebt = addClientDebt({
        clientId: selectedSummary.client.id,
        clientName: selectedSummary.client.name,
        clientCompany: selectedSummary.client.companyName || selectedSummary.client.name,
        debtType: 'frais_supplementaires',
        amount: instantExtra,
        reason: withdrawNote.trim() ? `مصاريف إضافية: ${withdrawNote.trim()}` : 'مصاريف إضافية مقتطعة عند التحويل',
        isSettled: true,
        status: 'regle',
        settledAt: now.toISOString()
      });
      createdInstantIds.push(extDebt.id);
    }

    // 2. If there are real unpaid delivered DB packages (>= 24h after delivery), create a formal ClientPayment
    const realUnpaidIds = selectedSummary.eligibleUnpaidDelivered
      .filter(p => !p.id.startsWith('pkg-oth-') && !p.id.startsWith('pkg-tour-'))
      .map(p => p.id);

    const pendingDebtIds = selectedSummary.pendingDebts.map(d => d.id);

    if (realUnpaidIds.length > 0) {
      generateClientPayment(
        selectedSummary.client.id,
        realUnpaidIds,
        'Virement bancaire',
        withdrawNote.trim() || 'Règlement après déduction emballage et frais',
        undefined,
        {
          packagingFees: instantEmballage,
          extraDeductions: instantExtra,
          deductionNotes: withdrawNote.trim() || undefined,
          settleDebtIds: pendingDebtIds,
          receiptImageUrl: withdrawReceiptUrl || undefined,
          receiptFileName: withdrawReceiptFileName || undefined
        }
      );
    } else {
      // Mark all pending debts as settled
      pendingDebtIds.forEach(dId => settleClientDebt(dId));
      // If user attached a receipt photo during a direct clearance, save as standalone receipt too
      if (withdrawReceiptUrl) {
        addTransferReceipt({
          clientId: selectedSummary.client.id,
          clientName: selectedSummary.client.name,
          clientCompany: selectedSummary.client.companyName || selectedSummary.client.name,
          clientPhone: selectedSummary.client.phone,
          clientBankName: selectedSummary.client.bankName,
          clientBankRib: selectedSummary.client.bankRib,
          amount: finalNetWithdraw,
          transferDate: now.toISOString().split('T')[0],
          bankName: selectedSummary.client.bankName,
          notes: withdrawNote.trim() || 'تحويل بنكي صافي الحساب',
          imageUrl: withdrawReceiptUrl,
          fileName: withdrawReceiptFileName || undefined
        });
      }
    }

    if (realUnpaidIds.length === 0) {
      // Mark client as cleared for instant feedback on manual adjustments
      setClearedClientIds(prev => new Set(prev).add(selectedSummary.client.id));

      // Add local record to history only when no formal ClientPayment was created
      const newRecord = {
        id: 'wit-' + Date.now(),
        isRealPayment: false,
        reference: `VIR-${now.getFullYear()}`,
        type: 'Retrait',
        date: dateStr,
        time: timeStr,
        solde: finalNetWithdraw,
        tarif: selectedSummary.totalDeliveryFees + selectedSummary.totalPendingDeductions + instantEmballage + instantExtra,
        receiptImageUrl: withdrawReceiptUrl || undefined,
        receiptFileName: withdrawReceiptFileName || undefined,
        packages: selectedSummary.deliveredPkgs
      };

      setLocalWithdrawals(prev => ({
        ...prev,
        [selectedSummary.client.id]: [newRecord, ...(prev[selectedSummary.client.id] || [])]
      }));
    }

    // Record audit log in database
    addAuditLog({
      action: 'Retrait solde client',
      entity: 'client',
      entityId: selectedSummary.client.id,
      details: `Virement net de ${formatMAD(finalNetWithdraw)} pour ${selectedSummary.client.companyName || selectedSummary.client.name} (Déductions لومبلاج/extras: -${formatMAD(selectedSummary.totalPendingDeductions + instantEmballage + instantExtra)})`
    });

    // Reset modal inputs & show toast
    setWithdrawEmballage('0');
    setWithdrawExtra('0');
    setWithdrawNote('');
    setWithdrawReceiptUrl('');
    setWithdrawReceiptFileName('');
    setShowWithdrawModal(false);
    setToastMessage(`تم التحويل بنجاح! الصافي المرسل: ${finalNetWithdraw.toFixed(2)} Dh (بعد خصم الاقتطاعات).`);
    setShowToast(true);

    setTimeout(() => {
      setShowToast(false);
    }, 4500);
  };

  // Add client submit
  const handleAddClientSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newClientName || !newClientPhone) return;

    addClient({
      name: newClientName,
      phone: newClientPhone,
      email: newClientEmail || `${newClientName.toLowerCase().replace(/\s+/g, '')}@gmail.com`,
      companyName: newClientCompany || newClientName,
      city: newClientCity,
      address: newClientAddress,
      bankName: 'التجاري وفا بنك',
      bankRib: newClientBankRib || '007293001210000281287000',
      role: 'client',
      status: 'active'
    });

    setShowAddClientModal(false);
    setNewClientName('');
    setNewClientPhone('');
    setNewClientEmail('');
    setNewClientCompany('');
    setNewClientAddress('');
    setNewClientBankRib('');

    setToastMessage('Nouveau client ajouté avec succès.');
    setShowToast(true);
    setTimeout(() => setShowToast(false), 3000);
  };

  const handleExportCSV = () => {
    const data = filteredClientList.map(item => ({
      Nom: item.client.name,
      Boutique: item.client.companyName || item.client.name,
      Telephone: item.client.phone,
      Ville: item.client.city,
      Adresse: item.client.address || '',
      Solde_MAD: item.solde,
      Revenu_Total_MAD: item.totalRevenue,
      Commandes_Total: item.orderCount,
      Colis_Livres: item.deliveredCount,
      Etat: 'Actif'
    }));
    exportCSV(data, `fariousy_clients_attente_paiement_${new Date().toISOString().substring(0, 10)}.csv`);
  };

  return (
    <div className="space-y-5">
      {/* ================= GREEN TOAST (Exact visual match from video 00:23) ================= */}
      {showToast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 bg-emerald-600 text-white px-5 py-3 rounded-2xl shadow-xl text-xs sm:text-sm font-bold animate-bounce transition-all">
          <CheckCircle2 className="w-5 h-5 shrink-0" />
          <span>{toastMessage}</span>
          <button
            onClick={() => setShowToast(false)}
            className="ml-3 p-1 hover:bg-emerald-700 rounded-lg transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* ================= SCREEN 1: صور التحويلات البنكية & أرصدة التجار ================= */}
      {!selectedSummary ? (
        <div className="space-y-5">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-slate-200">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                  صور التحويلات البنكية والمستحقات ({allReceiptItems.length})
                </h2>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                  تحويلات بنكية
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                إرسال وتنزيل صور وصولات التحويلات البنكية للزبناء، ومتابعة أرصدة التجار
              </p>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={() => {
                  if (allClients.length > 0 && !receiptClientId) {
                    const first = allClients[0];
                    setReceiptClientId(first.id);
                    setReceiptBankName(first.bankName || '');
                  }
                  setShowUploadReceiptModal(true);
                }}
                className="flex items-center gap-1.5 px-4 py-2.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 active:scale-95 rounded-xl shadow-xs transition-colors cursor-pointer"
              >
                <Upload className="w-4 h-4" />
                <span>إرسال صورة تحويل بنكي</span>
              </button>

              <button
                onClick={handleExportCSV}
                className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-xl shadow-2xs transition-colors cursor-pointer"
              >
                <Download className="w-4 h-4 text-slate-600" />
                <span>Exporter CSV</span>
              </button>

              <button
                onClick={() => setShowAddClientModal(true)}
                className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-white bg-red-600 hover:bg-red-700 active:scale-95 rounded-xl shadow-xs transition-colors cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Ajouter un client</span>
              </button>
            </div>
          </div>

          {/* Sub-Tabs Switch */}
          <div className="flex items-center gap-2 bg-slate-100 p-1.5 rounded-2xl w-fit border border-slate-200">
            <button
              type="button"
              onClick={() => setActiveSubTab('receipts')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
                activeSubTab === 'receipts'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <FileImage className="w-4 h-4 text-emerald-600" />
              <span>صور التحويلات البنكية ({allReceiptItems.length})</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveSubTab('balances')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
                activeSubTab === 'balances'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Wallet className="w-4 h-4 text-red-600" />
              <span>أرصدة التجار المستحقة +24h ({eligibleClientsCount})</span>
            </button>
          </div>

          {activeSubTab === 'receipts' ? (
            <div className="space-y-4">
              {/* Search Bar for Receipts */}
              <div className="bg-white p-3 border border-slate-200 rounded-2xl shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="relative w-full sm:w-96">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={receiptSearchTerm}
                    onChange={e => setReceiptSearchTerm(e.target.value)}
                    placeholder="ابحث باسم التاجر، المتجر، المرجع أو الهاتف..."
                    className="w-full pl-9 pr-8 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                  {receiptSearchTerm && (
                    <button
                      type="button"
                      onClick={() => setReceiptSearchTerm('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
                <div className="text-xs text-slate-500 font-mono">
                  {filteredReceiptItems.length} صورة تحويل مسجلة
                </div>
              </div>

              {/* Gallery of Uploaded Bank Transfer Receipt Images */}
              {filteredReceiptItems.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                  {filteredReceiptItems.map(item => (
                    <div
                      key={`${item.kind}-${item.id}`}
                      className="bg-white border border-slate-200 rounded-2xl shadow-2xs overflow-hidden flex flex-col hover:shadow-md transition-shadow"
                    >
                      <div
                        onClick={() =>
                          setPreviewReceipt({
                            imageUrl: item.imageUrl,
                            title: `${item.clientCompany} — ${item.reference}`,
                            subtitle: `${item.date} • ${formatMAD(item.amount)}`,
                            fileName: item.fileName
                          })
                        }
                        className="relative h-48 bg-slate-100 border-b border-slate-200 cursor-pointer group overflow-hidden"
                      >
                        <img
                          src={item.imageUrl}
                          alt={`وصل تحويل ${item.clientCompany}`}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
                          <span className="opacity-0 group-hover:opacity-100 transition-opacity inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/95 text-slate-900 text-xs font-bold shadow-lg">
                            <ZoomIn className="w-4 h-4 text-emerald-600" />
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

                      <div className="p-4 flex-1 flex flex-col justify-between space-y-3 text-xs">
                        <div className="space-y-1">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-black text-slate-900 text-sm truncate">
                              {item.clientCompany}
                            </span>
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-600 shrink-0">
                              {item.kind === 'payment' ? 'كشف CRBT' : 'تحويل مباشر'}
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-500">
                            {item.clientName}{item.clientPhone ? ` • ${item.clientPhone}` : ''}
                          </div>
                          <div className="flex items-center gap-1.5 text-[11px] text-slate-500 font-mono">
                            <Calendar className="w-3.5 h-3.5 text-slate-400" />
                            <span>{item.date}</span>
                            {item.bankName && <span>• {item.bankName}</span>}
                          </div>
                          {item.notes && (
                            <p className="text-[11px] text-slate-600 bg-slate-50 border border-slate-100 rounded-lg p-2 mt-1">
                              {item.notes}
                            </p>
                          )}
                        </div>

                        <div className="pt-2 border-t border-slate-100 flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() =>
                              setPreviewReceipt({
                                imageUrl: item.imageUrl,
                                title: `${item.clientCompany} — ${item.reference}`,
                                subtitle: `${item.date} • ${formatMAD(item.amount)}`,
                                fileName: item.fileName
                              })
                            }
                            className="flex-1 py-2 px-2.5 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition inline-flex items-center justify-center gap-1 cursor-pointer"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>معاينة</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => downloadImageUrl(item.imageUrl, item.fileName)}
                            className="flex-1 py-2 px-2.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-xs transition inline-flex items-center justify-center gap-1 cursor-pointer"
                          >
                            <Download className="w-3.5 h-3.5" />
                            <span>تنزيل</span>
                          </button>

                          {item.kind === 'standalone' && (
                            <button
                              type="button"
                              onClick={() => {
                                deleteTransferReceipt(item.id);
                                triggerToast('تم حذف صورة التحويل البنكي.');
                              }}
                              className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition cursor-pointer"
                              title="حذف الصورة"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center space-y-3">
                  <div className="w-14 h-14 mx-auto rounded-2xl bg-emerald-50 text-emerald-600 border border-emerald-200 flex items-center justify-center">
                    <FileImage className="w-7 h-7" />
                  </div>
                  <h3 className="text-sm font-bold text-slate-900">
                    لا توجد صور تحويلات بنكية مرفوعة بعد
                  </h3>
                  <p className="text-xs text-slate-500 max-w-md mx-auto">
                    اضغط على &laquo; إرسال صورة تحويل بنكي &raquo; لاختيار التاجر وتحميل صورة وصل التحويل ليتمكن الزبون من معاينتها وتنزيلها مباشرة من حسابه.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      if (allClients.length > 0 && !receiptClientId) {
                        const first = allClients[0];
                        setReceiptClientId(first.id);
                        setReceiptBankName(first.bankName || '');
                      }
                      setShowUploadReceiptModal(true);
                    }}
                    className="inline-flex items-center gap-1.5 px-4 py-2.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-xs cursor-pointer"
                  >
                    <Upload className="w-4 h-4" />
                    <span>رفع أول صورة تحويل بنكي</span>
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {/* Filter & Summary Bar: >= 24h after delivery only by default */}
              <div className="bg-white p-3.5 border border-slate-200 rounded-2xl shadow-2xs flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2.5">
                  <div className="relative w-full sm:w-80">
                    <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      value={searchTerm}
                      onChange={e => setSearchTerm(e.target.value)}
                      placeholder="Téléphone et Code de Colis..."
                      className="w-full pl-9 pr-8 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-500 font-mono"
                    />
                    {searchTerm && (
                      <button
                        type="button"
                        onClick={() => setSearchTerm('')}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs cursor-pointer"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => setShowAllClients(v => !v)}
                    className={`px-3 py-2 rounded-xl text-xs font-bold border transition cursor-pointer ${
                      showAllClients
                        ? 'bg-slate-900 text-white border-slate-900'
                        : 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100'
                    }`}
                  >
                    {showAllClients
                      ? `عرض الكل (${allClients.length}) — اضغط للرجوع للمستحقين +24h`
                      : `المستحقين بعد +24h فقط (${eligibleClientsCount})`}
                  </button>
                </div>

                <div className="flex flex-wrap items-center gap-2 text-[11px]">
                  <span className="px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200 font-bold font-mono">
                    صافي مستحق (+24h): {formatMAD(totalEligibleBalance)}
                  </span>
                  {waiting24hClientsCount > 0 && (
                    <span className="px-2.5 py-1 rounded-lg bg-amber-50 text-amber-800 border border-amber-200 font-bold inline-flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" />
                      <span>
                        {waiting24hClientsCount} تاجر أقل من 24h ({formatMAD(totalPending24hBalance)})
                      </span>
                    </span>
                  )}
                </div>
              </div>

          {/* Table */}
          <div className="bg-white border border-slate-200 rounded-2xl shadow-2xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50/80 text-slate-700 border-b border-slate-200 font-bold uppercase text-[11px] tracking-wider">
                    <th className="py-3 px-4">Nom</th>
                    <th className="py-3 px-3 text-center">Colis (+24h)</th>
                    <th className="py-3 px-4">Adresse</th>
                    <th className="py-3 px-4">Téléphone</th>
                    <th className="py-3 px-4">Boutique</th>
                    <th className="py-3 px-4 text-right">Solde (+24h)</th>
                    <th className="py-3 px-3 text-center">État</th>
                    <th className="py-3 px-4 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredClientList.map(item => {
                    const client = item.client;
                    const isEligible = item.solde > 0;
                    const isWaiting24h = !isEligible && item.pending24hSolde > 0;
                    return (
                      <tr
                        key={client.id}
                        onClick={() => setSelectedClientId(client.id)}
                        className="hover:bg-red-50/30 transition-colors cursor-pointer group"
                      >
                        {/* Nom with red avatar */}
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-full bg-red-100 text-red-600 border border-red-200 flex items-center justify-center font-bold text-xs shrink-0 group-hover:scale-105 transition-transform">
                              {client.name.charAt(0).toUpperCase()}
                            </div>
                            <span className="font-extrabold text-slate-900 group-hover:text-red-600 transition-colors">
                              {client.name}
                            </span>
                          </div>
                        </td>

                        {/* Colis (+24h) */}
                        <td className="py-3.5 px-3 text-center font-mono font-bold text-slate-700">
                          {item.eligibleUnpaidDelivered.length}
                        </td>

                        {/* Adresse */}
                        <td className="py-3.5 px-4 text-slate-600 truncate max-w-[200px]">
                          {client.address || client.city}
                        </td>

                        {/* Téléphone */}
                        <td className="py-3.5 px-4 font-mono font-semibold text-slate-800">
                          {client.phone}
                        </td>

                        {/* Boutique */}
                        <td className="py-3.5 px-4 font-medium text-slate-700">
                          {client.companyName || client.name}
                        </td>

                        {/* Solde (Big bold text + deductions & <24h notice) */}
                        <td className="py-3.5 px-4 text-right font-mono font-black text-slate-900 text-sm">
                          <span>{item.solde.toFixed(2)} Dh</span>
                          {item.totalPendingDeductions > 0 && (
                            <span className="block text-[10px] font-bold text-rose-600">
                              (-{item.totalPendingDeductions.toFixed(2)} Dh لومبلاج/إضافي)
                            </span>
                          )}
                          {item.pending24hSolde > 0 && (
                            <span className="block text-[10px] font-bold text-amber-600">
                              (+{item.pending24hSolde.toFixed(2)} Dh أقل من 24h)
                            </span>
                          )}
                        </td>

                        {/* État */}
                        <td className="py-3.5 px-3 text-center">
                          {isEligible ? (
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-200">
                              مستحق (+24h)
                            </span>
                          ) : isWaiting24h ? (
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-100 text-amber-800 border border-amber-200">
                              أقل من 24h
                            </span>
                          ) : (
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-slate-100 text-slate-600 border border-slate-200">
                              0.00 Dh
                            </span>
                          )}
                        </td>

                        {/* Actions */}
                        <td className="py-3.5 px-4 text-center">
                          <button
                            onClick={e => {
                              e.stopPropagation();
                              setSelectedClientId(client.id);
                            }}
                            className="p-1.5 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition cursor-pointer"
                            title="Consulter le solde et les commandes"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {filteredClientList.length === 0 && (
              <div className="p-12 text-center space-y-2">
                <p className="text-slate-600 font-bold text-xs">
                  {searchTerm
                    ? `لا توجد نتائج مطابقة لـ « ${searchTerm} ».`
                    : 'لا يوجد أي تاجر كيسال الفلوس بعد مرور 24 ساعة على التوصيل حالياً.'}
                </p>
                {!showAllClients && waiting24hClientsCount > 0 && (
                  <p className="text-[11px] text-amber-700 font-medium">
                    يوجد {waiting24hClientsCount} تاجر عندهم طلبات مسلّمة أقل من 24 ساعة ({formatMAD(totalPending24hBalance)}) سيظهرون تلقائياً بعد إتمام 24 ساعة.
                  </p>
                )}
              </div>
            )}
          </div>
            </div>
          )}
        </div>
      ) : (
        /* ================= SCREEN 2: PROFIT & CLIENT FINANCIAL PROFILE (As seen in video 00:10 - 00:26) ================= */
        <div className="space-y-5">
          {/* Back Button */}
          <button
            onClick={() => setSelectedClientId(null)}
            className="flex items-center gap-1.5 text-xs font-bold text-slate-600 hover:text-red-600 transition cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Retour à la liste des clients en attente de paiement</span>
          </button>

          {/* Title & Subtitle */}
          <div>
            <h2 className="text-xl font-black text-slate-900 tracking-tight">
              Profit
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Le solde total du client, vous pouvez cliquer sur le Retirer avec succès.
            </p>
          </div>

          {/* Top Client Profile Banner (Exact visual match from video 00:11) */}
          <div className="p-5 bg-white border border-slate-200 rounded-2xl shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-2xl bg-red-500 text-white flex items-center justify-center font-black text-2xl shadow-xs shrink-0">
                {selectedSummary.client.name.charAt(0).toUpperCase()}
              </div>

              <div>
                <h3 className="text-xl font-extrabold text-slate-900">
                  {selectedSummary.client.name}
                </h3>
                <span className="text-xs text-slate-500 font-medium block mt-0.5">
                  {selectedSummary.client.companyName || 'Lokan'}
                </span>

                <div className="flex items-center gap-4 mt-1.5 text-xs">
                  <div>
                    <span className="font-mono font-black text-slate-900 text-sm">
                      {selectedSummary.totalRevenue} Dh
                    </span>
                    <span className="text-[10px] text-slate-400 block">Revenu total</span>
                  </div>
                  <div className="w-px h-6 bg-slate-200"></div>
                  <div>
                    <span className="font-mono font-black text-slate-900 text-sm">
                      {selectedSummary.orderCount}
                    </span>
                    <span className="text-[10px] text-slate-400 block">Nombre de commandes</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Action Buttons on top right */}
            <div className="flex items-center gap-2 self-start sm:self-center">
              <button
                type="button"
                onClick={() => {
                  setReceiptClientId(selectedSummary.client.id);
                  setReceiptBankName(selectedSummary.client.bankName || '');
                  setReceiptAmount(selectedSummary.solde > 0 ? String(selectedSummary.solde) : '');
                  setShowUploadReceiptModal(true);
                }}
                className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition cursor-pointer"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>إرسال صورة تحويل</span>
              </button>

              <button
                type="button"
                onClick={() => triggerToast(`ملف التاجر: ${selectedSummary.client.companyName || selectedSummary.client.name} — RIB: ${selectedSummary.client.bankRib || 'غير مسجل'}`)}
                className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-red-600 bg-white border border-red-500 hover:bg-red-50 rounded-xl transition cursor-pointer"
              >
                <Edit2 className="w-3.5 h-3.5" />
                <span>Modifier</span>
              </button>

              <button
                type="button"
                onClick={() => setSelectedClientId(null)}
                className="px-4 py-2 text-xs font-bold text-white bg-red-600 hover:bg-red-700 rounded-xl transition cursor-pointer"
              >
                Fermer
              </button>
            </div>
          </div>

          {/* ================= 3 CARDS: Informations du client / Solde temporaire / Solde du client ================= */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* 1. Informations du client */}
            <div className="p-5 bg-white border border-slate-200 rounded-2xl shadow-2xs space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 pb-2 border-b border-slate-100">
                Informations du client
              </h4>

              <div className="space-y-2 text-xs text-slate-600">
                <div className="flex justify-between">
                  <span className="text-slate-400">Nom complet :</span>
                  <span className="font-bold text-slate-900">{selectedSummary.client.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Mobile :</span>
                  <span className="font-mono font-bold text-slate-900">{selectedSummary.client.phone}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">E-mail :</span>
                  <span className="text-slate-700 truncate max-w-[160px]">{selectedSummary.client.email}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Adresse :</span>
                  <span className="text-slate-800 text-right truncate max-w-[170px]">
                    {selectedSummary.client.address || selectedSummary.client.city}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Boutique :</span>
                  <span className="font-bold text-slate-900">{selectedSummary.client.companyName || selectedSummary.client.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Lieu de la boutique :</span>
                  <span className="text-slate-700">{selectedSummary.client.city || '—'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Banque :</span>
                  <span className="font-bold text-slate-900">{selectedSummary.client.bankName || 'التجاري وفا بنك'}</span>
                </div>
              </div>
            </div>

            {/* 2. Solde temporaire (< 24h après livraison) */}
            <div className="p-5 bg-white border border-slate-200 rounded-2xl shadow-2xs flex flex-col justify-between text-center">
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 pb-2 border-b border-slate-100">
                  Solde temporaire (&lt; 24h)
                </h4>
                <p className="text-[11px] text-amber-600 font-semibold mt-2">
                  طلبات مسلّمة أقل من 24 ساعة (قيد الانتظار)
                </p>
                <div className="my-3 text-3xl font-black font-mono text-amber-600">
                  {selectedSummary.pending24hSolde.toFixed(2)} Dh
                </div>
                <p className="text-xs text-slate-500 font-medium">
                  {selectedSummary.pending24hDelivered.length} colis en attente de délai 24h
                </p>
              </div>

              <div className="pt-4">
                <button
                  type="button"
                  onClick={() =>
                    triggerToast(
                      selectedSummary.pending24hDelivered.length > 0
                        ? `${selectedSummary.pending24hDelivered.length} طرد مازال ففترة الانتظار ديال 24 ساعة (${selectedSummary.pending24hSolde.toFixed(2)} Dh).`
                        : 'لا توجد طلبات قيد الانتظار أقل من 24 ساعة.'
                    )
                  }
                  className="w-full py-2.5 px-4 text-xs font-bold text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-xl transition cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <Clock className="w-3.5 h-3.5 text-amber-600" />
                  <span>قيد التحقق (24h)</span>
                </button>
              </div>
            </div>

            {/* 3. Solde du client (With deductions summary & "Retirer" button) */}
            <div className="p-5 bg-white border border-slate-200 rounded-2xl shadow-2xs flex flex-col justify-between text-center">
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 pb-2 border-b border-slate-100">
                  Solde exigible +24h (الصافي للتحويل)
                </h4>
                <p className="text-[11px] text-slate-500 font-mono mt-2 truncate">
                  RIB : <strong>{selectedSummary.client.bankRib || '007293001210000281287376'}</strong>
                </p>
                <div className="my-2.5 text-3xl font-black font-mono text-red-600">
                  {selectedSummary.solde.toFixed(2)} Dh
                </div>
                <div className="text-[11px] space-y-0.5 bg-slate-50 p-2 rounded-xl border border-slate-100">
                  <div className="flex justify-between text-slate-600">
                    <span>رصيد الطرود (+24h) :</span>
                    <span className="font-mono font-bold">{selectedSummary.grossSolde.toFixed(2)} Dh</span>
                  </div>
                  <div className="flex justify-between text-rose-600">
                    <span>خصم لومبلاج وإضافي :</span>
                    <span className="font-mono font-bold">-{selectedSummary.totalPendingDeductions.toFixed(2)} Dh</span>
                  </div>
                </div>
              </div>

              <div className="pt-4">
                <button
                  type="button"
                  disabled={selectedSummary.grossSolde <= 0 && selectedSummary.solde <= 0}
                  onClick={() => {
                    setWithdrawEmballage('0');
                    setWithdrawExtra('0');
                    setWithdrawNote('');
                    setShowWithdrawModal(true);
                  }}
                  className="w-full py-2.5 px-4 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed rounded-xl transition cursor-pointer flex items-center justify-center gap-1.5 shadow-xs"
                >
                  <Wallet className="w-3.5 h-3.5" />
                  <span>Retirer / إرسال الصافي</span>
                </button>
              </div>
            </div>
          </div>

          {/* ================= DEDUCTIONS: ثمن لومبلاج ومصاريف إضافية (Déductions Emballage & Extras) ================= */}
          <div className="bg-white border border-slate-200 rounded-2xl shadow-2xs p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-rose-50 text-rose-600 border border-rose-200 flex items-center justify-center">
                  <MinusCircle className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-sm font-black text-slate-900">
                    اقتطاعات ثمن لومبلاج وأي مصاريف زايدة (Déductions avant envoi)
                  </h4>
                  <p className="text-[11px] text-slate-500">
                    نقص ثمن لومبلاج أو أي مبلغ إضافي من حساب الزبون مباشرة قبل إرسال التحويل البنكي
                  </p>
                </div>
              </div>
              <div className="text-right font-mono text-xs font-black text-rose-600 bg-rose-50 px-3 py-1.5 rounded-xl border border-rose-200">
                إجمالي المقتطع : -{selectedSummary.totalPendingDeductions.toFixed(2)} Dh
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
              {/* Left: Quick Add Form */}
              <form onSubmit={handleAddDeductionSubmit} className="lg:col-span-5 bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3 text-xs">
                <div className="font-bold text-slate-800">إضافة اقتطاع جديد من الحساب :</div>

                <div className="grid grid-cols-2 gap-1.5">
                  <button
                    type="button"
                    onClick={() => setDeductionType('emballage')}
                    className={`py-2 px-2.5 rounded-lg font-bold border text-[11px] transition cursor-pointer ${
                      deductionType === 'emballage'
                        ? 'bg-red-600 text-white border-red-600 shadow-2xs'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    📦 ثمن لومبلاج
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeductionType('frais_supplementaires')}
                    className={`py-2 px-2.5 rounded-lg font-bold border text-[11px] transition cursor-pointer ${
                      deductionType === 'frais_supplementaires'
                        ? 'bg-red-600 text-white border-red-600 shadow-2xs'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    ➕ مصاريف زايدة
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeductionType('frais_retour')}
                    className={`py-2 px-2.5 rounded-lg font-bold border text-[11px] transition cursor-pointer ${
                      deductionType === 'frais_retour'
                        ? 'bg-red-600 text-white border-red-600 shadow-2xs'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    ↩️ مصاريف روتور
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeductionType('avance_fonds')}
                    className={`py-2 px-2.5 rounded-lg font-bold border text-[11px] transition cursor-pointer ${
                      deductionType === 'avance_fonds'
                        ? 'bg-red-600 text-white border-red-600 shadow-2xs'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    💸 تسبيق / سلف
                  </button>
                </div>

                {deductionType === 'emballage' && (
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 mb-1">
                        الكمية (عدد الكرطون/الأكياس)
                      </label>
                      <input
                        type="number"
                        min="1"
                        value={deductionQty}
                        onChange={e => {
                          const q = e.target.value;
                          setDeductionQty(q);
                          if (deductionUnitPrice) {
                            setDeductionAmount(String((Number(q) || 0) * (Number(deductionUnitPrice) || 0)));
                          }
                        }}
                        className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 mb-1">
                        ثمن الوحدة (DH)
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="0.5"
                        placeholder="مثلاً: 5"
                        value={deductionUnitPrice}
                        onChange={e => {
                          const u = e.target.value;
                          setDeductionUnitPrice(u);
                          setDeductionAmount(String((Number(deductionQty) || 1) * (Number(u) || 0)));
                        }}
                        className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg font-mono"
                      />
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    المبلغ المراد اقتطاعه (DH) *
                  </label>
                  <input
                    type="number"
                    min="0.5"
                    step="0.5"
                    required
                    value={deductionAmount}
                    onChange={e => setDeductionAmount(e.target.value)}
                    placeholder="مثلاً: 25"
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg font-mono font-bold text-rose-600"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    السبب / التفاصيل (اختياري)
                  </label>
                  <input
                    type="text"
                    value={deductionReason}
                    onChange={e => setDeductionReason(e.target.value)}
                    placeholder="مثلاً: 5 كرطونات + سكتش التغليف، زيادة الوزن..."
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full py-2.5 px-4 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-xl shadow-xs transition cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <Plus className="w-4 h-4 text-rose-400" />
                  <span>خصم من حساب الزبون</span>
                </button>
              </form>

              {/* Right: List of Recorded Deductions */}
              <div className="lg:col-span-7 flex flex-col">
                <div className="text-xs font-bold text-slate-800 mb-2">
                  سجل الاقتطاعات المسجلة على حساب {selectedSummary.client.companyName || selectedSummary.client.name} :
                </div>
                <div className="flex-1 border border-slate-200 rounded-xl overflow-hidden bg-white">
                  <div className="max-h-64 overflow-y-auto divide-y divide-slate-100 text-xs">
                    {selectedSummary.clientAllDebts.map(debt => {
                      const isSettled = debt.isSettled || debt.status === 'regle';
                      const typeBadge =
                        debt.debtType === 'emballage'
                          ? '📦 لومبلاج'
                          : debt.debtType === 'frais_retour'
                          ? '↩️ روتور'
                          : debt.debtType === 'avance_fonds'
                          ? '💸 تسبيق'
                          : '➕ مصاريف زايدة';

                      return (
                        <div key={debt.id} className={`p-3 flex items-center justify-between gap-3 ${isSettled ? 'opacity-60 bg-slate-50/70' : ''}`}>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-rose-50 text-rose-700 border border-rose-200">
                                {typeBadge}
                              </span>
                              <span className="font-bold text-slate-900 truncate">
                                {debt.reason || 'اقتطاع من الحساب'}
                              </span>
                            </div>
                            <div className="text-[10px] text-slate-400 mt-0.5 font-mono">
                              {formatDate(debt.createdAt)}
                              {debt.quantity && debt.quantity > 1 ? ` • ${debt.quantity} × ${debt.unitPrice} DH` : ''}
                              {isSettled ? ' • تمت تصفيته عند التحويل' : ' • سيُقتطع قبل التحويل'}
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            <span className="font-mono font-black text-rose-600 text-sm">
                              -{Number(debt.amount).toFixed(2)} Dh
                            </span>
                            {!isSettled && (
                              <button
                                type="button"
                                onClick={() => deleteClientDebt(debt.id)}
                                className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                                title="حذف هذا الاقتطاع"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}

                    {selectedSummary.clientAllDebts.length === 0 && (
                      <div className="py-10 text-center text-slate-400 text-xs">
                        لا توجد اقتطاعات لومبلاج أو مصاريف إضافية مسجلة حالياً لهذا الزبون.
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ================= HISTORIQUE DES PAIEMENTS ================= */}
          <div className="bg-white border border-slate-200 rounded-2xl shadow-2xs p-5 space-y-4">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
              Historique des paiements
            </h4>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 text-slate-600 border-b border-slate-200 uppercase text-[10px] font-bold">
                    <th className="py-2.5 px-3">Type</th>
                    <th className="py-2.5 px-3">Date</th>
                    <th className="py-2.5 px-3">Heure</th>
                    <th className="py-2.5 px-3 text-right">Solde</th>
                    <th className="py-2.5 px-3 text-right">Tarif</th>
                    <th className="py-2.5 px-3 text-center">صورة التحويل</th>
                    <th className="py-2.5 px-3 text-center">Colis</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {clientPaymentHistory.map(hist => (
                    <tr key={hist.id} className="hover:bg-slate-50">
                      <td className="py-2.5 px-3">
                        <span
                          className={`font-bold ${
                            hist.type === 'Retrait' ? 'text-red-600' : 'text-emerald-600'
                          }`}
                        >
                          {hist.type}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 font-mono text-slate-600">{hist.date}</td>
                      <td className="py-2.5 px-3 font-mono text-slate-500">{hist.time}</td>
                      <td className="py-2.5 px-3 font-mono font-black text-right text-slate-900">
                        {hist.solde.toFixed(2)} Dh
                      </td>
                      <td className="py-2.5 px-3 font-mono text-right text-slate-600">
                        {hist.tarif.toFixed(2)} Dh
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        {hist.receiptImageUrl ? (
                          <div className="inline-flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() =>
                                setPreviewReceipt({
                                  imageUrl: hist.receiptImageUrl!,
                                  title: `${selectedSummary.client.companyName || selectedSummary.client.name} — ${hist.reference || hist.date}`,
                                  subtitle: `${hist.date} • ${hist.solde.toFixed(2)} Dh`,
                                  fileName: hist.receiptFileName || `virement_${hist.id}.jpg`
                                })
                              }
                              className="px-2 py-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 rounded-lg inline-flex items-center gap-1 cursor-pointer"
                            >
                              <Eye className="w-3 h-3" />
                              <span>معاينة</span>
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                downloadImageUrl(
                                  hist.receiptImageUrl!,
                                  hist.receiptFileName || `virement_${hist.id}.jpg`
                                )
                              }
                              className="p-1 text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg cursor-pointer"
                              title="تنزيل صورة التحويل"
                            >
                              <Download className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : hist.isRealPayment ? (
                          <label className="px-2 py-1 text-[11px] font-bold text-amber-800 bg-amber-50 border border-amber-200 hover:bg-amber-100 rounded-lg inline-flex items-center gap-1 cursor-pointer">
                            <Upload className="w-3 h-3" />
                            <span>+ صورة</span>
                            <input
                              type="file"
                              accept="image/*"
                              onChange={e => handlePaymentRowReceiptAttach(hist.id, e)}
                              className="hidden"
                            />
                          </label>
                        ) : (
                          <span className="text-[11px] text-slate-400">—</span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <button
                          type="button"
                          onClick={() => setShowArticlesModal(hist)}
                          className="px-3 py-1 text-[11px] font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-2xs transition cursor-pointer"
                        >
                          Articles
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls (As seen in video: Précédent 1 2 Suivant) */}
            <div className="flex items-center justify-center gap-1.5 pt-2 text-xs">
              <button
                type="button"
                onClick={() => setPaymentPage(p => Math.max(1, p - 1))}
                className="px-3 py-1 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100"
              >
                Précédent
              </button>
              <button
                type="button"
                onClick={() => setPaymentPage(1)}
                className={`px-3 py-1 rounded-lg font-bold ${
                  paymentPage === 1 ? 'bg-red-600 text-white' : 'border border-slate-200 text-slate-700'
                }`}
              >
                1
              </button>
              <button
                type="button"
                onClick={() => setPaymentPage(2)}
                className={`px-3 py-1 rounded-lg font-bold ${
                  paymentPage === 2 ? 'bg-red-600 text-white' : 'border border-slate-200 text-slate-700'
                }`}
              >
                2
              </button>
              <button
                type="button"
                onClick={() => setPaymentPage(p => p + 1)}
                className="px-3 py-1 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100"
              >
                Suivant
              </button>
            </div>
          </div>

          {/* ================= COLLAPSIBLE STATUS BUTTONS (Livré / En cours / Refusé) ================= */}
          <div className="space-y-3">
            {/* Livré */}
            <div className="bg-white border border-slate-200 rounded-2xl shadow-2xs overflow-hidden">
              <button
                type="button"
                onClick={() => setIsLivreExpanded(v => !v)}
                className="w-full p-4 flex items-center justify-between hover:bg-slate-50 transition cursor-pointer"
              >
                <div className="flex items-center gap-2.5 text-xs font-bold text-slate-900">
                  <span className="w-7 h-7 rounded-lg bg-red-100 text-red-600 flex items-center justify-center">
                    <Truck className="w-4 h-4" />
                  </span>
                  <span>Livré ({selectedSummary.deliveredCount})</span>
                </div>
                {isLivreExpanded ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
              </button>
            </div>

            {/* En cours */}
            <div className="bg-white border border-slate-200 rounded-2xl shadow-2xs overflow-hidden">
              <button
                type="button"
                onClick={() => setIsInProgressExpanded(v => !v)}
                className="w-full p-4 flex items-center justify-between hover:bg-slate-50 transition cursor-pointer"
              >
                <div className="flex items-center gap-2.5 text-xs font-bold text-slate-900">
                  <span className="w-7 h-7 rounded-lg bg-red-100 text-red-600 flex items-center justify-center">
                    <Truck className="w-4 h-4" />
                  </span>
                  <span>En cours ({selectedSummary.inProgressCount})</span>
                </div>
                {isInProgressExpanded ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
              </button>
            </div>

            {/* Refusé et annulé */}
            <div className="bg-white border border-slate-200 rounded-2xl shadow-2xs overflow-hidden">
              <button
                type="button"
                onClick={() => setIsRefusedExpanded(v => !v)}
                className="w-full p-4 flex items-center justify-between hover:bg-slate-50 transition cursor-pointer"
              >
                <div className="flex items-center gap-2.5 text-xs font-bold text-slate-900">
                  <span className="w-7 h-7 rounded-lg bg-red-100 text-red-600 flex items-center justify-center">
                    <X className="w-4 h-4" />
                  </span>
                  <span>Refusé et annulé ({selectedSummary.refusedCount})</span>
                </div>
                {isRefusedExpanded ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
              </button>
            </div>
          </div>

          {/* ================= COLIS DU CLIENT TABLE (As seen in video 00:17) ================= */}
          <div className="bg-white border border-slate-200 rounded-2xl shadow-2xs p-5 space-y-4">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
              Colis du client
            </h4>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 text-slate-600 border-b border-slate-200 uppercase text-[10px] font-bold">
                    <th className="py-2.5 px-3">Code</th>
                    <th className="py-2.5 px-3">Destinataire</th>
                    <th className="py-2.5 px-3">Téléphone</th>
                    <th className="py-2.5 px-3 text-right">Prix</th>
                    <th className="py-2.5 px-3 text-center">Statut</th>
                    <th className="py-2.5 px-3 text-center">Payé</th>
                    <th className="py-2.5 px-3 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {selectedSummary.packages.map(pkg => {
                    const isLivre = pkg.status === 'livre';
                    const isPaye = Boolean(pkg.isPaidToClient);
                    const deliveredMs = isLivre ? getPackageDeliveredTimestampMs(pkg) : null;
                    const isPast24h =
                      isLivre && deliveredMs !== null && nowMs - deliveredMs >= TWENTY_FOUR_HOURS_MS;

                    return (
                      <tr key={pkg.id} className="hover:bg-slate-50">
                        {/* Code */}
                        <td className="py-3 px-3 font-mono font-bold text-slate-900">
                          {pkg.trackingNumber}
                        </td>

                        {/* Destinataire */}
                        <td className="py-3 px-3 text-slate-800 font-semibold">
                          {pkg.recipientName || 'Zakaria najhi'}
                        </td>

                        {/* Téléphone */}
                        <td className="py-3 px-3 font-mono text-slate-600">
                          {pkg.recipientPhone}
                        </td>

                        {/* Prix & Frais */}
                        <td className="py-3 px-3 text-right">
                          <span className="font-mono font-black text-slate-900 block">
                            {(pkg.codAmount || 0).toFixed(2)} Dh
                          </span>
                          <span className="text-[10px] font-mono text-red-500 block">
                            (-{(pkg.deliveryFee ?? 45).toFixed(2)} DH)
                          </span>
                        </td>

                        {/* Statut */}
                        <td className="py-3 px-3 text-center">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                              isLivre
                                ? 'bg-emerald-100 text-emerald-800'
                                : pkg.status === 'annule'
                                ? 'bg-rose-100 text-rose-800'
                                : 'bg-cyan-100 text-cyan-800'
                            }`}
                          >
                            {isLivre ? 'LIVRÉ' : pkg.status === 'annule' ? 'ANNULÉ' : 'EN COURS'}
                          </span>
                        </td>

                        {/* Payé & 24h Status */}
                        <td className="py-3 px-3 text-center">
                          {isPaye ? (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-emerald-100 text-emerald-800">
                              Payé
                            </span>
                          ) : isLivre && !isPast24h ? (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 inline-block">
                              &lt;24h ({formatRemaining24hLabel(deliveredMs, nowMs)})
                            </span>
                          ) : isLivre ? (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-800">
                              مستحق (+24h)
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-slate-100 text-slate-600">
                              Non payé
                            </span>
                          )}
                        </td>

                        {/* Action */}
                        <td className="py-3 px-3 text-center">
                          <button
                            type="button"
                            onClick={() => {
                              if (onViewPackage) {
                                onViewPackage(pkg);
                              } else {
                                triggerToast(`الطرد ${pkg.trackingNumber} (${pkg.recipientName})`);
                              }
                            }}
                            className="p-1 text-slate-400 hover:text-red-600 rounded"
                            title="Voir le colis"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ================= MODAL: VIDER LE SOLDE DU COMPTE CLIENT (مع اقتطاع لومبلاج وإضافي) ================= */}
      {showWithdrawModal && selectedSummary && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs no-print">
          <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden animate-scale-in">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 bg-slate-50">
              <div>
                <h3 className="text-sm font-extrabold text-slate-900">
                  تحويل الرصيد وتصفية الحساب (Retirer)
                </h3>
                <p className="text-[11px] text-slate-500">
                  {selectedSummary.client.companyName || selectedSummary.client.name} — RIB: {selectedSummary.client.bankRib || '—'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowWithdrawModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 text-xs text-slate-700 space-y-4">
              {/* Breakdown Box */}
              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-1.5">
                <div className="flex justify-between">
                  <span>رصيد الطرود المسلّمة +24h (صافي التوصيل) :</span>
                  <span className="font-mono font-bold text-slate-900">
                    {selectedSummary.grossSolde.toFixed(2)} Dh
                  </span>
                </div>
                {selectedSummary.totalPendingDeductions > 0 && (
                  <div className="flex justify-between text-rose-600">
                    <span>اقتطاعات مسجلة مسبقاً (لومبلاج / ديون) :</span>
                    <span className="font-mono font-bold">
                      -{selectedSummary.totalPendingDeductions.toFixed(2)} Dh
                    </span>
                  </div>
                )}
              </div>

              {/* Instant Deduction Fields before sending */}
              <div className="p-3.5 bg-rose-50/50 border border-rose-200 rounded-xl space-y-3">
                <div className="font-bold text-slate-900 flex items-center gap-1.5">
                  <Box className="w-4 h-4 text-rose-600" />
                  <span>اقتطاعات فورية قبل الإرسال (اختياري) :</span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      ثمن لومبلاج (Emballage - DH)
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="0.5"
                      value={withdrawEmballage}
                      onChange={e => setWithdrawEmballage(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg font-mono font-bold text-rose-600"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      أي حاجة زايدة أخرى (DH)
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="0.5"
                      value={withdrawExtra}
                      onChange={e => setWithdrawExtra(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg font-mono font-bold text-rose-600"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    تفاصيل / ملاحظة التحويل :
                  </label>
                  <input
                    type="text"
                    value={withdrawNote}
                    onChange={e => setWithdrawNote(e.target.value)}
                    placeholder="مثلاً: خصم ثمن الكرطون والتغليف، تحويل بنكي..."
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg"
                  />
                </div>
              </div>

              {/* Upload Bank Transfer Receipt inside Withdraw Modal */}
              <div className="p-3.5 bg-emerald-50/60 border border-emerald-200 rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-emerald-950 flex items-center gap-1.5">
                    <FileImage className="w-4 h-4 text-emerald-600" />
                    <span>صورة التحويل البنكي للزبون (اختياري)</span>
                  </span>
                  {withdrawReceiptUrl && (
                    <button
                      type="button"
                      onClick={() => {
                        setWithdrawReceiptUrl('');
                        setWithdrawReceiptFileName('');
                      }}
                      className="text-[11px] font-bold text-rose-600 hover:underline cursor-pointer"
                    >
                      إزالة
                    </button>
                  )}
                </div>
                {withdrawReceiptUrl ? (
                  <div className="flex items-center gap-3 bg-white p-2 rounded-lg border border-emerald-200">
                    <img
                      src={withdrawReceiptUrl}
                      alt="وصل التحويل"
                      className="w-14 h-14 object-cover rounded border border-slate-200"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="font-bold text-slate-800 truncate">{withdrawReceiptFileName}</div>
                      <div className="text-[10px] text-emerald-700">سيتمكن الزبون من تنزيل الصورة مباشرة</div>
                    </div>
                  </div>
                ) : (
                  <label className="flex items-center justify-center gap-2 py-2.5 px-3 border-2 border-dashed border-emerald-300 bg-white hover:bg-emerald-50/40 rounded-xl cursor-pointer transition">
                    <Upload className="w-4 h-4 text-emerald-600" />
                    <span className="font-bold text-emerald-800">إرفاق صورة وصل التحويل البنكي</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={e => handleReceiptFilePick(e, 'withdraw')}
                      className="hidden"
                    />
                  </label>
                )}
              </div>

              {/* Final Net Amount */}
              <div className="p-4 bg-slate-900 text-white rounded-xl flex items-center justify-between">
                <span className="font-bold text-sm">الصافي النهائي للتحويل للزبون :</span>
                <span className="font-mono font-black text-emerald-400 text-xl">
                  {Math.max(0, selectedSummary.solde - (Number(withdrawEmballage) || 0) - (Number(withdrawExtra) || 0)).toFixed(2)} Dh
                </span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 px-5 py-3.5 bg-slate-50 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowWithdrawModal(false)}
                className="px-4 py-2 text-xs font-bold text-slate-700 bg-white border border-slate-300 hover:bg-slate-100 rounded-xl transition cursor-pointer"
              >
                إلغاء (Annuler)
              </button>
              <button
                type="button"
                onClick={handleConfirmWithdraw}
                className="px-5 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 active:scale-95 rounded-xl shadow-xs transition cursor-pointer"
              >
                تأكيد التحويل وتصفية الحساب
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= ARTICLES MODAL ================= */}
      {showArticlesModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs no-print">
          <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 bg-slate-50">
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Colis inclus dans le règlement ({showArticlesModal.date})
                </h3>
                <span className="text-[11px] text-slate-500 font-mono">
                  Montant : {showArticlesModal.solde.toFixed(2)} Dh
                </span>
              </div>
              <button
                type="button"
                onClick={() => setShowArticlesModal(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 overflow-y-auto space-y-2 text-xs">
              {(showArticlesModal.packages || []).map((p: any, idx: number) => (
                <div key={p.id || idx} className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between">
                  <div>
                    <div className="font-mono font-bold text-slate-900">{p.trackingNumber}</div>
                    <div className="text-[11px] text-slate-500">{p.recipientName} • {p.city}</div>
                  </div>
                  <div className="text-right">
                    <span className="font-mono font-bold text-slate-900 block">{(p.codAmount || 0)} DH</span>
                    <span className="text-[10px] text-emerald-600 font-bold">Payé</span>
                  </div>
                </div>
              ))}
            </div>

            <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-end">
              <button
                type="button"
                onClick={() => setShowArticlesModal(null)}
                className="px-4 py-2 text-xs font-bold text-slate-700 bg-white border border-slate-300 rounded-xl hover:bg-slate-100"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= ADD CLIENT MODAL ================= */}
      {showAddClientModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs no-print">
          <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 bg-slate-50">
              <h3 className="text-sm font-bold text-slate-900">Ajouter un nouveau client</h3>
              <button
                type="button"
                onClick={() => setShowAddClientModal(false)}
                className="p-1 text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddClientSubmit} className="p-5 space-y-3 text-xs">
              <div>
                <label className="block text-slate-700 font-bold mb-1">Nom complet *</label>
                <input
                  type="text"
                  required
                  value={newClientName}
                  onChange={e => setNewClientName(e.target.value)}
                  placeholder="Ex: Othman El Idrissi"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-bold mb-1">Téléphone *</label>
                  <input
                    type="tel"
                    required
                    value={newClientPhone}
                    onChange={e => setNewClientPhone(e.target.value)}
                    placeholder="0600000000"
                    className="w-full px-3 py-2 font-mono bg-slate-50 border border-slate-300 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-bold mb-1">Nom de la boutique</label>
                  <input
                    type="text"
                    value={newClientCompany}
                    onChange={e => setNewClientCompany(e.target.value)}
                    placeholder="Ex: Lokan Shop"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-bold mb-1">Email</label>
                  <input
                    type="email"
                    value={newClientEmail}
                    onChange={e => setNewClientEmail(e.target.value)}
                    placeholder="client@gmail.com"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-bold mb-1">Ville</label>
                  <input
                    type="text"
                    value={newClientCity}
                    onChange={e => setNewClientCity(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">RIB Bancaire (24 chiffres)</label>
                <input
                  type="text"
                  value={newClientBankRib}
                  onChange={e => setNewClientBankRib(e.target.value)}
                  placeholder="007293001210000281287376"
                  className="w-full px-3 py-2 font-mono bg-slate-50 border border-slate-300 rounded-xl"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setShowAddClientModal(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-bold text-white bg-red-600 hover:bg-red-700 rounded-xl shadow-xs"
                >
                  Enregistrer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= UPLOAD BANK TRANSFER RECEIPT MODAL ================= */}
      {showUploadReceiptModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs no-print">
          <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 bg-slate-50">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
                  <FileImage className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900">
                    إرسال صورة التحويل البنكي للزبون
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    ستظهر الصورة في حساب الزبون مع زر التنزيل المباشر
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowUploadReceiptModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleUploadReceiptSubmit} className="p-5 overflow-y-auto space-y-3.5 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  الزبون / المتجر المستفيد *
                </label>
                <select
                  required
                  value={receiptClientId}
                  onChange={e => {
                    const cid = e.target.value;
                    setReceiptClientId(cid);
                    const cl = allClients.find(c => c.id === cid);
                    if (cl?.bankName) setReceiptBankName(cl.bankName);
                  }}
                  className="w-full px-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl font-bold text-slate-900"
                >
                  <option value="">-- اختر التاجر --</option>
                  {allClients.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.companyName || c.name} — {c.phone}
                    </option>
                  ))}
                </select>
                {receiptClientId && (
                  (() => {
                    const cl = allClients.find(c => c.id === receiptClientId);
                    return cl?.bankRib ? (
                      <div className="mt-1.5 px-2.5 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-[11px] font-mono text-slate-600 flex items-center gap-1.5">
                        <Landmark className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span>{cl.bankName || 'البنك'} : <strong>{cl.bankRib}</strong></span>
                      </div>
                    ) : null;
                  })()
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    المبلغ المحوّل (MAD) *
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    required
                    value={receiptAmount}
                    onChange={e => setReceiptAmount(e.target.value)}
                    placeholder="مثلاً: 1450"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-mono font-bold text-emerald-700"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    تاريخ التحويل *
                  </label>
                  <input
                    type="date"
                    required
                    value={receiptDate}
                    onChange={e => setReceiptDate(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    رقم مرجع التحويل (اختياري)
                  </label>
                  <input
                    type="text"
                    value={receiptReference}
                    onChange={e => setReceiptReference(e.target.value)}
                    placeholder="مثلاً: VIR-CIH-8821"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-mono"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    اسم البنك (اختياري)
                  </label>
                  <input
                    type="text"
                    value={receiptBankName}
                    onChange={e => setReceiptBankName(e.target.value)}
                    placeholder="CIH / Attijari / BMCE..."
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  ملاحظات (اختياري)
                </label>
                <input
                  type="text"
                  value={receiptNotes}
                  onChange={e => setReceiptNotes(e.target.value)}
                  placeholder="مثلاً: تحويل مستحقات الأسبوع..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl"
                />
              </div>

              {/* Image Picker */}
              <div>
                <label className="block font-bold text-slate-700 mb-1.5">
                  صورة وصل التحويل البنكي *
                </label>
                {receiptImageUrl ? (
                  <div className="space-y-2 p-3 bg-emerald-50 border border-emerald-200 rounded-xl">
                    <img
                      src={receiptImageUrl}
                      alt="معاينة التحويل"
                      className="max-h-52 w-full object-contain rounded-lg bg-white border border-emerald-200"
                    />
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="font-mono text-emerald-800 truncate">{receiptFileName}</span>
                      <button
                        type="button"
                        onClick={() => {
                          setReceiptImageUrl('');
                          setReceiptFileName('');
                        }}
                        className="font-bold text-rose-600 hover:underline cursor-pointer"
                      >
                        تغيير الصورة
                      </button>
                    </div>
                  </div>
                ) : (
                  <label className="flex flex-col items-center justify-center gap-2 py-7 px-4 border-2 border-dashed border-emerald-300 bg-emerald-50/40 hover:bg-emerald-50 rounded-2xl cursor-pointer transition">
                    <Upload className="w-7 h-7 text-emerald-600" />
                    <span className="font-bold text-emerald-900">
                      {isCompressingReceipt ? 'جاري تجهيز الصورة...' : 'اضغط هنا لاختيار صورة التحويل البنكي'}
                    </span>
                    <span className="text-[11px] text-slate-500">PNG, JPG, WebP</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={e => handleReceiptFilePick(e, 'standalone')}
                      className="hidden"
                    />
                  </label>
                )}
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowUploadReceiptModal(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={!receiptClientId || !receiptImageUrl || isCompressingReceipt}
                  className="px-5 py-2.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 rounded-xl shadow-xs cursor-pointer inline-flex items-center gap-1.5"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>حفظ وإرسال للزبون</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= PREVIEW RECEIPT LIGHTBOX ================= */}
      {previewReceipt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs no-print">
          <div className="relative w-full max-w-3xl bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 bg-slate-50">
              <div>
                <h3 className="text-sm font-black text-slate-900">{previewReceipt.title}</h3>
                <p className="text-[11px] text-slate-500 font-mono">{previewReceipt.subtitle}</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => downloadImageUrl(previewReceipt.imageUrl, previewReceipt.fileName)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-xs cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  <span>تنزيل الصورة</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewReceipt(null)}
                  className="p-2 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
            <div className="p-5 bg-slate-900/5 overflow-auto flex items-center justify-center">
              <img
                src={previewReceipt.imageUrl}
                alt={previewReceipt.title}
                className="max-h-[72vh] w-auto object-contain rounded-xl shadow-sm bg-white"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
