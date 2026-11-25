import React, { useState, useEffect } from 'react';
import { useDatabase } from '../../context/DatabaseContext';
import { useAuth } from '../../context/AuthContext';
import { PackageItem, Partner, PartnerApiAdapterType, PartnerSettlement, UserProfile } from '../../types';
import { OLIVRAISON_BASE_URL, buildOlivraisonPresetConfig, extractTokenExpiryIso } from '../../services/partnerAdapters';
import { directSupabaseRequest } from '../../services/supabaseDirectGateway';
import { formatMAD, formatDate, formatDateTime } from '../../utils/barcode';
import { getPartnerFeeForPackage } from '../../utils/partnerTariffs';
import { exportCSV } from '../../utils/export';
import { ConfirmActionModal } from '../common/ConfirmActionModal';
import {
  Handshake,
  Plus,
  ArrowRightLeft,
  Truck,
  Phone,
  Mail,
  MapPin,
  X,
  Scan,
  Edit2,
  Trash2,
  Download,
  Search,
  Package,
  CheckCircle2,
  Network,
  ExternalLink,
  Send,
  Calculator,
  Receipt,
  Wallet,
  ArrowUpRight,
  ArrowDownRight,
  Printer,
  DollarSign,
  FileText,
  Calendar,
  AlertCircle,
  AlertTriangle,
  LogIn,
  Globe,
  Key,
  Copy,
  Check,
  Eye,
  EyeOff,
  ShieldCheck,
  RefreshCw,
  FileCode,
  Zap,
  Radio,
  RotateCcw,
  Settings,
  Lock,
  Building,
  Upload,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';

interface AdminPartnersProps {
  onOpenScanner: () => void;
  onViewPackage: (pkg: PackageItem) => void;
  onOpenApiIntegration?: () => void;
  onOpenDispatch?: (packageIds?: string[]) => void;
  openAddNonce?: number;
}

export const AdminPartners: React.FC<AdminPartnersProps> = ({
  onOpenScanner,
  onViewPackage,
  onOpenApiIntegration,
  onOpenDispatch,
  openAddNonce
}) => {
  const {
    partners,
    refreshPartners,
    packages,
    cities,
    addPartner,
    updatePartner,
    deletePartner,
    transferPackageAgency,
    addPartnerSettlement,
    testPartnerConnection,
    retryFailedPartnerTransmissions,
    regeneratePartnerWebhookToken,
    addAuditLog
  } = useDatabase();
  const { impersonateUser } = useAuth();

  useEffect(() => {
    refreshPartners();
  }, [refreshPartners]);

  const [searchTerm, setSearchTerm] = useState('');
  const [showAddPartnerModal, setShowAddPartnerModal] = useState(false);

  useEffect(() => {
    if (openAddNonce) {
      setShowAddPartnerModal(true);
    }
  }, [openAddNonce]);
  const [editingPartner, setEditingPartner] = useState<Partner | null>(null);
  const [partnerToDelete, setPartnerToDelete] = useState<Partner | null>(null);
  const [showDispatchModal, setShowDispatchModal] = useState<Partner | null>(null);
  const [dispatchSearch, setDispatchSearch] = useState('');

  // Partner Detail Modal state (Détails du partenaire - Olivraison)
  const [selectedPartnerDetail, setSelectedPartnerDetail] = useState<Partner | null>(null);
  const [revealedApiKey, setRevealedApiKey] = useState(false);
  const [revealedWebhookToken, setRevealedWebhookToken] = useState(false);
  const [copiedItem, setCopiedItem] = useState<string | null>(null);
  const [testApiStatus, setTestApiStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [testApiMessage, setTestApiMessage] = useState<string | null>(null);
  const [isRetryingFailed, setIsRetryingFailed] = useState(false);
  const [retryStatusMessage, setRetryStatusMessage] = useState<string | null>(null);

  // Inline API Configuration Modal State (Olivraison / Externe)
  const [apiConfigPartner, setApiConfigPartner] = useState<Partner | null>(null);
  const [cfgAdapterType, setCfgAdapterType] = useState<PartnerApiAdapterType>('olivraison');
  const [cfgBaseUrl, setCfgBaseUrl] = useState(OLIVRAISON_BASE_URL);
  const [cfgApiKey, setCfgApiKey] = useState('');
  const [cfgEnabled, setCfgEnabled] = useState(true);
  const [cfgAutoDispatch, setCfgAutoDispatch] = useState(true);
  const [cfgTokenExpiresAt, setCfgTokenExpiresAt] = useState('');
  const [cfgShowKeyPlain, setCfgShowKeyPlain] = useState(false);
  const [isSavingApiConfig, setIsSavingApiConfig] = useState(false);

  // Financial accounting modal state
  const [accountingPartner, setAccountingPartner] = useState<Partner | null>(null);
  const [accountingTab, setAccountingTab] = useState<'packages' | 'settlements'>('packages');
  const [showAddSettlement, setShowAddSettlement] = useState(false);
  const [settlementAmount, setSettlementAmount] = useState('');
  const [settlementMethod, setSettlementMethod] = useState<'virement' | 'especes' | 'cheque' | 'autre'>('virement');
  const [settlementRef, setSettlementRef] = useState('');
  const [settlementNotes, setSettlementNotes] = useState('');

  // Partner Form State
  const [name, setName] = useState('');
  const [contactPerson, setContactPerson] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [city, setCity] = useState('Casablanca');
  const [address, setAddress] = useState('');
  const [website, setWebsite] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [notes, setNotes] = useState('');
  const [deliveryFee, setDeliveryFee] = useState('30');
  const [returnFee, setReturnFee] = useState('10');
  const [cityTariffs, setCityTariffs] = useState<Record<string, number>>({});
  const [tariffSearch, setTariffSearch] = useState('');
  const [tariffPage, setTariffPage] = useState(1);
  const [formError, setFormError] = useState<string | null>(null);
  const [useOlivraisonPreset, setUseOlivraisonPreset] = useState(false);
  const [presetOlivraisonApiKey, setPresetOlivraisonApiKey] = useState('');

  const qSearch = searchTerm.trim().toLowerCase();
  const filteredPartners = partners.filter(
    p =>
      !qSearch ||
      (p.name || '').toLowerCase().includes(qSearch) ||
      (p.city || '').toLowerCase().includes(qSearch) ||
      (p.phone || '').toLowerCase().includes(qSearch) ||
      (p.email || '').toLowerCase().includes(qSearch) ||
      (p.contactPerson || '').toLowerCase().includes(qSearch)
  );

  // Financial calculation helper for any partner
  const calculatePartnerFinance = (partner: Partner) => {
    const partnerParcels = packages.filter(
      pkg =>
        pkg.partnerId === partner.id ||
        pkg.partnerName === partner.name ||
        pkg.destinationAgency === partner.name ||
        pkg.destinationAgency === `Partenaire: ${partner.name}` ||
        pkg.destinationAgency === `Agence ${partner.city}`
    );
    const deliveredParcels = partnerParcels.filter(
      pkg => pkg.status === 'livre' && pkg.deliveredBy !== 'admin'
    );
    const returnedParcels = partnerParcels.filter(pkg =>
      ['retourne', 'retour_recu', 'annule'].includes(pkg.status)
    );
    const inTransitParcels = partnerParcels.filter(pkg =>
      ['en_transit', 'en_cours_transfert'].includes(pkg.status)
    );

    const totalCodConfié = partnerParcels.reduce((sum, p) => sum + (p.codAmount || 0), 0);
    const totalDeliveredCod = deliveredParcels.reduce((sum, p) => sum + (p.codAmount || 0), 0);

    const deliveryRate = partner.deliveryFee ?? 30;
    const returnRate = partner.returnFee ?? 10;

    const deliveryFees = deliveredParcels.reduce(
      (sum, p) => sum + getPartnerFeeForPackage(partner, p),
      0
    );
    const totalClientDeliveryFees = deliveredParcels.reduce((sum, p) => sum + Number(p.deliveryFee || 0), 0);
    const netProfit = deliveredParcels.reduce((sum, p) => {
      const pFee = getPartnerFeeForPackage(partner, p);
      return sum + (Number(p.deliveryFee || 0) - pFee);
    }, 0);
    const returnFees = returnedParcels.length * returnRate;
    const totalPartnerFees = deliveryFees + returnFees;

    const settlements = partner.settlements || [];
    const totalSettlementsReceived = settlements.reduce((sum, s) => sum + (s.amount || 0), 0);

    // Balance calculation:
    // What the partner collected (totalDeliveredCod)
    // minus what the partner keeps as their delivery/return fees (totalPartnerFees)
    // minus settlements (versements) already transferred to us
    // If balance > 0: "كنسالوه" (Le partenaire nous doit cette somme)
    // If balance < 0: "كيسالنا" (Nous devons au partenaire)
    // If balance === 0: "الحساب متوازن"
    const balance = totalDeliveredCod - totalPartnerFees - totalSettlementsReceived;

    return {
      partnerParcels,
      deliveredParcels,
      returnedParcels,
      inTransitParcels,
      totalCodConfié,
      totalDeliveredCod,
      deliveryRate,
      returnRate,
      deliveryFees,
      totalClientDeliveryFees,
      netProfit,
      returnFees,
      totalPartnerFees,
      settlements,
      totalSettlementsReceived,
      balance
    };
  };

  // Global aggregate financials
  const globalFinance = filteredPartners.reduce(
    (acc, partner) => {
      const fin = calculatePartnerFinance(partner);
      acc.totalConfiés += fin.partnerParcels.length;
      acc.totalDeliveredCod += fin.totalDeliveredCod;
      acc.totalPartnerFees += fin.totalPartnerFees;
      acc.totalSettlementsReceived += fin.totalSettlementsReceived;
      acc.netBalance += fin.balance;
      return acc;
    },
    {
      totalConfiés: 0,
      totalDeliveredCod: 0,
      totalPartnerFees: 0,
      totalSettlementsReceived: 0,
      netBalance: 0
    }
  );

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setLogoUrl(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (!name.trim() || !phone.trim()) {
      setFormError('Le nom de la société et le téléphone sont obligatoires.');
      return;
    }
    if (password.trim()) {
      if (password.trim().length < 6) {
        setFormError('Le mot de passe doit contenir au moins 6 caractères.');
        return;
      }
      if (password.trim() !== confirmPassword.trim()) {
        setFormError('Les mots de passe ne correspondent pas.');
        return;
      }
    }

    const generatedWebhookToken =
      typeof crypto !== 'undefined' && crypto.getRandomValues
        ? btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32))))
        : `wh_${Date.now()}_${Math.random().toString(36).slice(2, 12)}`;

    addPartner({
      name: name.trim(),
      contactPerson: contactPerson.trim(),
      phone: phone.trim(),
      email: email.trim(),
      city: city.trim() || 'Casablanca',
      address: address.trim(),
      website: website.trim(),
      logoUrl: logoUrl || undefined,
      active: true,
      notes: notes.trim(),
      deliveryFee: Number(deliveryFee) || 30,
      returnFee: Number(returnFee) || 10,
      cityTariffs: Object.keys(cityTariffs).length > 0 ? cityTariffs : undefined,
      password: password.trim() || undefined,
      webhookToken: generatedWebhookToken,
      apiConfig: useOlivraisonPreset
        ? buildOlivraisonPresetConfig({
            apiKey: presetOlivraisonApiKey.trim(),
            webhookSecret: generatedWebhookToken,
            tokenExpiresAt: extractTokenExpiryIso(presetOlivraisonApiKey.trim())
          })
        : undefined
    });

    setShowAddPartnerModal(false);
    resetForm();
  };

  const resetForm = () => {
    setName('');
    setContactPerson('');
    setPhone('');
    setEmail('');
    setPassword('');
    setConfirmPassword('');
    setCity('Casablanca');
    setAddress('');
    setWebsite('');
    setLogoUrl('');
    setNotes('');
    setDeliveryFee('30');
    setReturnFee('10');
    setCityTariffs({});
    setTariffSearch('');
    setTariffPage(1);
    setFormError(null);
    setUseOlivraisonPreset(false);
    setPresetOlivraisonApiKey('');
  };

  const handleOpenEdit = (partner: Partner) => {
    setEditingPartner(partner);
    setName(partner.name || '');
    setContactPerson(partner.contactPerson || '');
    setPhone(partner.phone || '');
    setEmail(partner.email || '');
    setPassword('');
    setConfirmPassword('');
    setCity(partner.city || 'Casablanca');
    setAddress(partner.address || '');
    setWebsite(partner.website || '');
    setLogoUrl(partner.logoUrl || '');
    setNotes(partner.notes || '');
    setDeliveryFee(String(partner.deliveryFee ?? 30));
    setReturnFee(String(partner.returnFee ?? 10));
    setCityTariffs(partner.cityTariffs ? { ...partner.cityTariffs } : {});
    setTariffSearch('');
    setTariffPage(1);
    setFormError(null);
  };

  const handleUpdateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPartner) return;
    setFormError(null);

    if (!name.trim() || !phone.trim()) {
      setFormError('Le nom de la société et le téléphone sont obligatoires.');
      return;
    }
    if (password.trim()) {
      if (password.trim().length < 6) {
        setFormError('Le mot de passe doit contenir au moins 6 caractères.');
        return;
      }
      if (password.trim() !== confirmPassword.trim()) {
        setFormError('Les mots de passe ne correspondent pas.');
        return;
      }
    }

    updatePartner(editingPartner.id, {
      name: name.trim(),
      contactPerson: contactPerson.trim(),
      phone: phone.trim(),
      email: email.trim(),
      city: city.trim() || 'Casablanca',
      address: address.trim(),
      website: website.trim(),
      logoUrl: logoUrl || undefined,
      notes: notes.trim(),
      deliveryFee: Number(deliveryFee) || 30,
      returnFee: Number(returnFee) || 10,
      cityTariffs: { ...cityTariffs },
      password: password.trim() || undefined
    });

    const coveredCount = Object.keys(cityTariffs).length;
    addAuditLog({
      action: 'Modification partenaire',
      entity: 'partenaire',
      entityId: editingPartner.id,
      details: `Mise à jour du profil et tarifs de ${name.trim()} (${deliveryFee} DH par défaut${coveredCount > 0 ? `, ${coveredCount} villes configurées` : ''})`
    });

    setEditingPartner(null);
    resetForm();
  };

  const handleConfirmDelete = (reason?: string) => {
    if (!partnerToDelete) return;
    deletePartner(partnerToDelete.id, reason || 'Suppression demandée');
    setPartnerToDelete(null);
  };

  // Impersonate partner to access partner portal directly
  const handleImpersonatePartner = (partner: Partner) => {
    const partnerUser: UserProfile = {
      id: partner.id,
      name: partner.name,
      email: partner.email || `${partner.id.toLowerCase()}@partners.fariousy.ma`,
      phone: partner.phone,
      role: 'partner',
      city: partner.city,
      companyName: partner.name,
      address: partner.address || `${partner.city}, Maroc`,
      status: 'active',
      accountStatus: 'approuve',
      registeredAt: partner.registeredAt || '2024-07-28'
    };
    impersonateUser(partnerUser);
    if (selectedPartnerDetail) {
      setSelectedPartnerDetail(null);
    }
  };

  // Copy helper
  const handleCopyValue = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedItem(id);
    setTimeout(() => setCopiedItem(null), 2500);
  };

  // Test API connection via real backend proxy
  const handleTestPartnerApi = async (partner: Partner) => {
    setTestApiStatus('testing');
    setTestApiMessage(null);
    const result = await testPartnerConnection(partner.id);
    setTestApiStatus(result.success ? 'success' : 'error');
    setTestApiMessage(result.message);
    setTimeout(() => setTestApiStatus('idle'), 6000);
  };

  // Regenerate webhook Bearer token (cryptographic base64)
  const handleRegenerateWebhookToken = async (partner: Partner) => {
    const res = await regeneratePartnerWebhookToken(partner.id);
    if (!res.success) {
      const randomBytes =
        typeof crypto !== 'undefined' && crypto.getRandomValues
          ? btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32))))
          : `sec_wh_${partner.id}_${Math.random().toString(36).substring(2, 14)}`;
      updatePartner(partner.id, {
        webhookToken: randomBytes,
        apiConfig: partner.apiConfig
          ? { ...partner.apiConfig, webhookSecret: randomBytes }
          : undefined
      });
    }
  };

  // Retry failed outbound transmissions
  const handleRetryFailedTransmissions = async (partner: Partner) => {
    setIsRetryingFailed(true);
    setRetryStatusMessage(null);
    const res = await retryFailedPartnerTransmissions(partner.id);
    setIsRetryingFailed(false);
    if (res.sentCount > 0) {
      setRetryStatusMessage(`${res.sentCount} colis retransmis avec succès à ${partner.name}.`);
    } else if (res.errors?.length) {
      setRetryStatusMessage(res.errors[0]);
    }
    setTimeout(() => setRetryStatusMessage(null), 6000);
  };

  // Open inline API Config Modal for Partner
  const handleOpenApiConfigModal = (partner: Partner) => {
    setApiConfigPartner(partner);
    const cfg = partner.apiConfig;
    const isOliv = cfg?.adapterType === 'olivraison' || (partner.name || '').toLowerCase().includes('oliv');
    setCfgAdapterType(cfg?.adapterType || (isOliv ? 'olivraison' : 'generic_rest'));
    setCfgBaseUrl(cfg?.baseUrl || (isOliv ? OLIVRAISON_BASE_URL : 'https://api.partner.ma'));
    setCfgApiKey(cfg?.apiKey || '');
    setCfgEnabled(cfg?.enabled ?? true);
    setCfgAutoDispatch(cfg?.autoDispatch ?? true);
    setCfgTokenExpiresAt(cfg?.tokenExpiresAt ? cfg.tokenExpiresAt.slice(0, 16) : '');
    setCfgShowKeyPlain(false);
  };

  const handleSaveInlineApiConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!apiConfigPartner) return;
    setIsSavingApiConfig(true);

    const existingCfg = apiConfigPartner.apiConfig;
    const isOliv = cfgAdapterType === 'olivraison';
    const nextConfig = {
      ...(existingCfg || {}),
      enabled: cfgEnabled,
      baseUrl: cfgBaseUrl.trim() || OLIVRAISON_BASE_URL,
      authType: isOliv ? ('bearer' as const) : existingCfg?.authType || ('bearer' as const),
      adapterType: cfgAdapterType,
      apiKey: cfgApiKey.trim(),
      autoSync: existingCfg?.autoSync ?? true,
      autoDispatch: cfgAutoDispatch,
      tokenExpiresAt: cfgTokenExpiresAt ? new Date(cfgTokenExpiresAt).toISOString() : extractTokenExpiryIso(cfgApiKey.trim()) || existingCfg?.tokenExpiresAt,
      endpoints: existingCfg?.endpoints || {
        createShipment: isOliv ? '/api/v1/parcels' : '/shipments',
        getTracking: isOliv ? '/api/v1/parcels' : '/tracking',
        syncStatus: isOliv ? '/api/v1/parcels/state' : '/status',
        webhookInbound: isOliv ? `/api/webhooks/olivraison/${apiConfigPartner.id}` : `/api/webhooks/partners/${apiConfigPartner.id}/inbound`
      }
    };

    const webhookTok = apiConfigPartner.webhookToken || (typeof crypto !== 'undefined' && crypto.getRandomValues ? btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32)))) : `wh_${Date.now()}`);

    updatePartner(apiConfigPartner.id, {
      webhookToken: webhookTok,
      apiConfig: {
        ...nextConfig,
        webhookSecret: nextConfig.webhookSecret || webhookTok
      }
    });

    try {
      const putRes = await directSupabaseRequest(`partners/${encodeURIComponent(apiConfigPartner.id)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          webhookToken: webhookTok,
          apiConfig: { ...nextConfig, webhookSecret: nextConfig.webhookSecret || webhookTok }
        })
      });
      if (putRes.status === 404) {
        await directSupabaseRequest('partners', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...apiConfigPartner,
            webhookToken: webhookTok,
            apiConfig: { ...nextConfig, webhookSecret: nextConfig.webhookSecret || webhookTok }
          })
        });
      }
    } catch {
      // Handled gracefully
    } finally {
      setIsSavingApiConfig(false);
      setApiConfigPartner(null);
    }
  };

  // Handle adding new settlement received from partner
  const handleAddSettlementSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!accountingPartner || !settlementAmount) return;

    const amt = parseFloat(settlementAmount);
    if (isNaN(amt) || amt <= 0) {
      alert('Veuillez saisir un montant valide');
      return;
    }

    addPartnerSettlement(accountingPartner.id, {
      date: new Date().toISOString(),
      amount: amt,
      reference: settlementRef || `VRM-${Date.now().toString().slice(-6)}`,
      paymentMethod: settlementMethod,
      notes: settlementNotes
    });

    // Refresh accountingPartner reference from updated list
    const updated = partners.find(p => p.id === accountingPartner.id);
    if (updated) {
      setAccountingPartner(updated);
    }

    setSettlementAmount('');
    setSettlementRef('');
    setSettlementNotes('');
    setShowAddSettlement(false);
  };

  const handlePrintPartnerStatement = () => {
    if (!accountingPartner) return;
    const fin = calculatePartnerFinance(accountingPartner);
    const printableWindow = window.open('', '_blank');
    if (!printableWindow) {
      alert('Veuillez autoriser les fenêtres pop-up pour imprimer le relevé.');
      return;
    }

    printableWindow.document.write(`
      <!DOCTYPE html>
      <html dir="rtl" lang="ar">
        <head>
          <meta charset="utf-8">
          <title>كشف حساب الشريك - ${accountingPartner.name}</title>
          <style>
            * { box-sizing: border-box; font-family: 'Cairo', 'Segoe UI', sans-serif; }
            body { padding: 25px; color: #1e293b; background: #fff; }
            .header { border-bottom: 2px solid #e2e8f0; padding-bottom: 15px; margin-bottom: 20px; display: flex; justify-content: space-between; align-items: flex-start; }
            .logo { font-size: 22px; font-weight: 900; color: #dc2626; }
            .title { font-size: 18px; font-weight: bold; margin-top: 5px; }
            .meta { font-size: 13px; color: #64748b; margin-top: 4px; }
            .summary-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 25px; }
            .metric-box { border: 1px solid #cbd5e1; border-radius: 8px; padding: 12px; text-align: center; background: #f8fafc; }
            .metric-label { font-size: 11px; font-weight: bold; color: #64748b; margin-bottom: 5px; }
            .metric-value { font-size: 16px; font-weight: 900; }
            .balance-box { border: 2px solid ${fin.balance >= 0 ? '#10b981' : '#f43f5e'}; background: ${fin.balance >= 0 ? '#ecfdf5' : '#fff1f2'}; padding: 15px; border-radius: 10px; margin-bottom: 25px; text-align: center; }
            .balance-title { font-size: 14px; font-weight: bold; }
            .balance-amt { font-size: 24px; font-weight: 900; color: ${fin.balance >= 0 ? '#047857' : '#be123c'}; margin-top: 4px; }
            table { width: 100%; border-collapse: collapse; margin-top: 15px; font-size: 12px; }
            th, td { border: 1px solid #e2e8f0; padding: 8px 10px; text-align: right; }
            th { background: #f1f5f9; font-weight: bold; }
            .footer { margin-top: 40px; padding-top: 15px; border-top: 1px solid #e2e8f0; font-size: 11px; color: #94a3b8; display: flex; justify-content: space-between; }
            @media print {
              body { padding: 0; }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <div>
              <div class="logo">FARIOUSY DELIVERY</div>
              <div class="title">كشف حساب وتصفية مستحقات الشريك</div>
              <div class="meta">الشريك: <strong>${accountingPartner.name}</strong> | المدينة: ${accountingPartner.city} | هاتف: ${accountingPartner.phone}</div>
              <div class="meta">سعر التوصيل المتفق عليه: <strong>${fin.deliveryRate} درهم/طرد</strong> | سعر الإرجاع: <strong>${fin.returnRate} درهم/طرد</strong></div>
            </div>
            <div style="text-align: left; font-size: 12px; color: #64748b;">
              <div>تاريخ الإصدار: ${new Date().toLocaleDateString('fr-MA')}</div>
              <div>ساعة الإصدار: ${new Date().toLocaleTimeString('fr-MA')}</div>
            </div>
          </div>

          <div class="summary-grid">
            <div class="metric-box">
              <div class="metric-label">إجمالي الطرود المسندة</div>
              <div class="metric-value">${fin.partnerParcels.length} طرد (${fin.deliveredParcels.length} تم تسليمها)</div>
            </div>
            <div class="metric-box">
              <div class="metric-label">مجموع مبالغ CRBT المحصلة</div>
              <div class="metric-value">${formatMAD(fin.totalDeliveredCod)}</div>
            </div>
            <div class="metric-box">
              <div class="metric-label">أتعاب التوصيل للشريك</div>
              <div class="metric-value text-red-600">- ${formatMAD(fin.totalPartnerFees)}</div>
            </div>
            <div class="metric-box">
              <div class="metric-label">الدفعات المستلمة من الشريك</div>
              <div class="metric-value text-emerald-600">- ${formatMAD(fin.totalSettlementsReceived)}</div>
            </div>
          </div>

          <div class="balance-box">
            <div class="balance-title">
              ${fin.balance > 0 ? '🟢 المبلغ الصافي المستحق لنا بذمة الشريك (كنسالوه)' : fin.balance < 0 ? '🔴 المبلغ الصافي المستحق للشريك بذمتنا (كيسالنا)' : '⚪ الحساب متوازن ومسدد بالكامل'}
            </div>
            <div class="balance-amt">
              ${fin.balance > 0 ? '+ ' + formatMAD(fin.balance) : fin.balance < 0 ? '- ' + formatMAD(Math.abs(fin.balance)) : '0.00 DH'}
            </div>
            <div style="font-size: 11px; color: #64748b; margin-top: 4px;">
              العملية: مجموع الـ CRBT (${fin.totalDeliveredCod} DH) - أتعاب توصيل الشريك (${fin.totalPartnerFees} DH) - دفعات مسددة (${fin.totalSettlementsReceived} DH)
            </div>
          </div>

          <h3 style="font-size: 14px; font-weight: bold; margin-bottom: 8px;">جدول الطرود المفصل</h3>
          <table>
            <thead>
              <tr>
                <th>رقم التتبع</th>
                <th>المرسل إليه</th>
                <th>المدينة</th>
                <th>الحالة</th>
                <th>مبلغ CRBT</th>
                <th>أتعاب الشريك</th>
                <th>الصافي المستحق</th>
              </tr>
            </thead>
            <tbody>
              ${fin.partnerParcels.map(pkg => {
                const isAdminDelivered = pkg.status === 'livre' && pkg.deliveredBy === 'admin';
                const pkgPartnerRate = getPartnerFeeForPackage(accountingPartner, pkg);
                const fee = isAdminDelivered ? 0 : pkg.status === 'livre' ? pkgPartnerRate : ['retourne', 'retour_recu', 'annule'].includes(pkg.status) ? fin.returnRate : 0;
                const cod = pkg.status === 'livre' && !isAdminDelivered ? (pkg.codAmount || 0) : 0;
                const net = cod - fee;
                return `
                  <tr>
                    <td style="font-family: monospace; font-weight: bold;">${pkg.trackingNumber}</td>
                    <td>${pkg.recipientName || 'N/A'}</td>
                    <td>${pkg.city}</td>
                    <td>${isAdminDelivered ? 'livré (الإدارة)' : pkg.status}</td>
                    <td><strong>${isAdminDelivered ? '0 (الإدارة)' : `${pkg.codAmount || 0} DH`}</strong></td>
                    <td style="color: #dc2626;">-${fee} DH</td>
                    <td><strong>${net} DH</strong></td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>

          <div class="footer">
            <div>Fariousy Delivery SARL — نظام إدارة التوزيع السريع واللوجستيك</div>
            <div>توقيع وتأشيرة الإدارة / الشريك</div>
          </div>
        </body>
      </html>
    `);
    printableWindow.document.close();
    printableWindow.focus();
    setTimeout(() => {
      printableWindow.print();
    }, 500);
  };

  const handleExportCSV = () => {
    const data = filteredPartners.map(p => {
      const fin = calculatePartnerFinance(p);
      return {
        ID: p.id,
        Nom: p.name,
        Contact: p.contactPerson || 'N/A',
        Telephone: p.phone,
        Email: p.email || 'N/A',
        Ligne_Principale: p.city,
        Tarif_Livraison_DH: p.deliveryFee ?? 30,
        Tarif_Retour_DH: p.returnFee ?? 10,
        Colis_Total: fin.partnerParcels.length,
        Colis_Livres: fin.deliveredParcels.length,
        Total_CRBT_Livre: fin.totalDeliveredCod,
        Total_Frais_Partenaire: fin.totalPartnerFees,
        Versements_Recus: fin.totalSettlementsReceived,
        Solde_Net: fin.balance,
        Statut_Financier: fin.balance > 0 ? 'كنسالوه' : fin.balance < 0 ? 'كيسالنا' : 'متوازن'
      };
    });
    exportCSV(data, `fariousy_partenaires_comptabilite_${new Date().toISOString().substring(0, 10)}.csv`);
  };

  return (
    <div className="space-y-5">
      {/* Page Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-black text-slate-900 tracking-tight">
              Gestion des Partenaires & Comptabilité Inter-villes
            </h2>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800 font-mono">
              بشحال كنسالو / كيسالنا
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Suivi des tarifs négociés par colis, calcul automatique des décharges et gestion des versements
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleExportCSV}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-xl shadow-2xs transition-colors cursor-pointer"
          >
            <Download className="w-4 h-4 text-slate-600" />
            <span>Exporter CSV</span>
          </button>

          {onOpenApiIntegration && (
            <button
              onClick={onOpenApiIntegration}
              className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-300 rounded-xl shadow-2xs transition-colors cursor-pointer"
            >
              <Network className="w-4 h-4 text-amber-600" />
              <span>Passerelle API</span>
            </button>
          )}

          {onOpenDispatch && (
            <button
              onClick={() => onOpenDispatch()}
              className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-white bg-red-600 hover:bg-red-700 active:scale-95 rounded-xl shadow-xs transition-colors cursor-pointer"
              title="Rechercher des colis et les envoyer au partenaire (ربط الطرود بالشريك)"
            >
              <Send className="w-4 h-4" />
              <span>Envoyer des colis (ربط بالشريك)</span>
            </button>
          )}

          <button
            onClick={onOpenScanner}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-xl shadow-2xs transition-colors cursor-pointer"
          >
            <Scan className="w-4 h-4 text-red-600" />
            <span>Expédier par Scan</span>
          </button>

          <button
            onClick={() => {
              resetForm();
              setShowAddPartnerModal(true);
            }}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-red-600 hover:bg-red-700 rounded-xl shadow-xs transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Ajouter un Partenaire</span>
          </button>
        </div>
      </div>

      {/* Global Financial Metrics Bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="p-4 bg-white border border-slate-200 rounded-2xl shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase">الطرود عند الشركاء</span>
            <Package className="w-4 h-4 text-slate-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-xl font-extrabold text-slate-900 font-mono">
              {globalFinance.totalConfiés}
            </span>
            <span className="text-xs text-slate-500">طرد مسند</span>
          </div>
        </div>

        <div className="p-4 bg-white border border-slate-200 rounded-2xl shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase">مجموع الـ CRBT المحصل</span>
            <DollarSign className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-xl font-extrabold text-slate-900 font-mono">
              {formatMAD(globalFinance.totalDeliveredCod)}
            </span>
          </div>
        </div>

        <div className="p-4 bg-white border border-slate-200 rounded-2xl shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase">أتعاب التوصيل للشركاء</span>
            <Truck className="w-4 h-4 text-amber-600" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-xl font-extrabold text-amber-700 font-mono">
              {formatMAD(globalFinance.totalPartnerFees)}
            </span>
          </div>
        </div>

        <div
          className={`p-4 rounded-2xl border shadow-2xs ${
            globalFinance.netBalance > 0
              ? 'bg-emerald-50/80 border-emerald-200 text-emerald-900'
              : globalFinance.netBalance < 0
              ? 'bg-rose-50/80 border-rose-200 text-rose-900'
              : 'bg-slate-50 border-slate-200 text-slate-900'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase">
              {globalFinance.netBalance > 0
                ? '🟢 كنسالوهم (Net à recouvrer)'
                : globalFinance.netBalance < 0
                ? '🔴 كيسالونا (Net à verser)'
                : '⚪ الحساب العام متوازن'}
            </span>
            <Wallet className="w-4 h-4" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-xl font-black font-mono">
              {globalFinance.netBalance > 0
                ? `+ ${formatMAD(globalFinance.netBalance)}`
                : globalFinance.netBalance < 0
                ? `- ${formatMAD(Math.abs(globalFinance.netBalance))}`
                : '0.00 DH'}
            </span>
          </div>
        </div>
      </div>

      {/* Gateway Callout Banner */}
      {onOpenApiIntegration && (
        <div className="bg-linear-to-r from-slate-900 via-slate-900 to-slate-800 text-white p-4 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 border border-slate-700/80 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 shrink-0">
              <Network className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs font-bold text-white flex items-center gap-2">
                <span>Passerelle API REST & Webhooks Multi-Transporteurs</span>
                <span className="px-2 py-0.5 text-[10px] font-mono bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-full font-bold">
                  En ligne
                </span>
              </div>
              <p className="text-[11px] text-slate-300">
                Connectez Amana Express, CTM, Cathedis ou toute API REST pour l'envoi automatisé et le calcul de la balance financière.
              </p>
            </div>
          </div>
          <button
            onClick={onOpenApiIntegration}
            className="self-start sm:self-auto px-3.5 py-1.5 text-xs font-bold bg-red-600 hover:bg-red-700 text-white rounded-xl shadow-xs transition-colors cursor-pointer flex items-center gap-1.5 shrink-0"
          >
            <span>Ouvrir l'Espace API</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Search Bar */}
      <div className="bg-white p-3 border border-slate-200 rounded-2xl shadow-2xs">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            placeholder="Rechercher partenaire, ville ou contact..."
            className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-500"
          />
        </div>
      </div>

      {/* Partners List with Accounting Details */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredPartners.map(partner => {
          const fin = calculatePartnerFinance(partner);

          return (
            <div
              key={partner.id}
              className="p-5 bg-white border border-slate-200 rounded-2xl shadow-2xs space-y-4 hover:border-slate-300 transition-all flex flex-col justify-between"
            >
              <div>
                {/* Header */}
                <div className="flex flex-wrap items-start justify-between gap-2.5">
                  <button
                    type="button"
                    onClick={() => setSelectedPartnerDetail(partner)}
                    className="flex items-center gap-2.5 text-left group cursor-pointer min-w-0"
                    title="Ouvrir le profil du partenaire"
                  >
                    <div className="w-10 h-10 rounded-xl bg-cyan-50 text-cyan-700 flex items-center justify-center font-bold overflow-hidden border border-slate-200 group-hover:bg-red-50 group-hover:text-red-600 transition-colors shrink-0">
                      {partner.logoUrl ? (
                        <img src={partner.logoUrl} alt={partner.name} className="w-full h-full object-cover" />
                      ) : (
                        <Handshake className="w-5 h-5" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-base font-extrabold text-slate-900 group-hover:text-red-600 transition-colors truncate">{partner.name}</h3>
                      <p className="text-xs text-slate-500 flex items-center gap-1">
                        <MapPin className="w-3 h-3 text-red-500 shrink-0" />
                        <span className="truncate">Ligne : {partner.city}</span>
                      </p>
                    </div>
                  </button>

                  <div className="flex flex-wrap items-center gap-1.5">
                    <button
                      onClick={() => setSelectedPartnerDetail(partner)}
                      className="px-2 py-1 text-[11px] font-bold text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 rounded-lg flex items-center gap-1 transition cursor-pointer"
                      title="Détails du partenaire et configuration API"
                    >
                      <Zap className="w-3 h-3 text-red-600 shrink-0" />
                      <span>Détails & API</span>
                    </button>
                    <button
                      onClick={() => handleImpersonatePartner(partner)}
                      className="px-2 py-1 text-[11px] font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-lg flex items-center gap-1 transition cursor-pointer shadow-2xs active:scale-95"
                      title="Accès direct au compte de ce partenaire (دخول)"
                    >
                      <LogIn className="w-3 h-3 text-white shrink-0" />
                      <span>دخول</span>
                    </button>
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                      Conventionné
                    </span>
                    <button
                      onClick={() => handleOpenEdit(partner)}
                      className="p-1.5 text-slate-500 hover:text-blue-600 bg-slate-100 hover:bg-blue-50 rounded-lg cursor-pointer"
                      title="Modifier partenaire et tarifs"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => setPartnerToDelete(partner)}
                      className="p-1.5 text-slate-500 hover:text-rose-600 bg-slate-100 hover:bg-rose-50 rounded-lg cursor-pointer"
                      title="Supprimer partenaire"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Contact info & Tarifs */}
                <div className="mt-3 p-3 bg-slate-50 rounded-xl space-y-2 text-xs text-slate-600">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Phone className="w-3.5 h-3.5 text-slate-400" />
                      <span className="font-mono font-semibold text-slate-800">{partner.phone}</span>
                      {partner.contactPerson && (
                        <span className="text-slate-400">({partner.contactPerson})</span>
                      )}
                    </div>
                    {partner.email && (
                      <div className="flex items-center gap-1.5 text-slate-500">
                        <Mail className="w-3.5 h-3.5 text-slate-400" />
                        <span>{partner.email}</span>
                      </div>
                    )}
                  </div>

                  {/* Negotiated Pricing Banner (بشحال حاسب التوصيل) */}
                  <div className="pt-2 border-t border-slate-200/80 flex flex-wrap items-center justify-between gap-2 bg-white/70 p-2 rounded-lg">
                    <div className="flex items-center gap-1.5">
                      <Truck className="w-3.5 h-3.5 text-red-600" />
                      <span className="text-slate-700 font-bold">بشحال حاسب التوصيل:</span>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono font-black text-xs text-red-600 bg-red-50 px-2 py-0.5 rounded border border-red-200">
                        {fin.deliveryRate} DH / طرد
                      </span>
                      {partner.cityTariffs && Object.keys(partner.cityTariffs).length > 0 && (
                        <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                          {Object.keys(partner.cityTariffs).length} مدينة محددة
                        </span>
                      )}
                      <span className="font-mono text-[11px] text-slate-500">
                        روتور: <strong className="text-slate-700">{fin.returnRate} DH</strong>
                      </span>
                    </div>
                  </div>

                  {partner.notes && (
                    <p className="text-[11px] text-slate-500 italic">
                      « {partner.notes} »
                    </p>
                  )}
                </div>

                {/* Parcels summary breakdown */}
                <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
                  <div className="p-2 bg-slate-50 rounded-xl border border-slate-100">
                    <span className="text-[10px] text-slate-400 uppercase font-bold block">En Transit</span>
                    <span className="font-mono font-extrabold text-cyan-600 text-sm">
                      {fin.inTransitParcels.length}
                    </span>
                  </div>
                  <div className="p-2 bg-slate-50 rounded-xl border border-slate-100">
                    <span className="text-[10px] text-slate-400 uppercase font-bold block">Livrés</span>
                    <span className="font-mono font-extrabold text-emerald-600 text-sm">
                      {fin.deliveredParcels.length}
                    </span>
                  </div>
                  <div className="p-2 bg-slate-50 rounded-xl border border-slate-100">
                    <span className="text-[10px] text-slate-400 uppercase font-bold block">Total Confiés</span>
                    <span className="font-mono font-extrabold text-slate-800 text-sm">
                      {fin.partnerParcels.length}
                    </span>
                  </div>
                </div>

                {/* Financial Balance Card (كنسالوه / كيسالنا) */}
                <div
                  className={`mt-3 p-3 rounded-xl border transition-all ${
                    fin.balance > 0
                      ? 'bg-emerald-50/70 border-emerald-200'
                      : fin.balance < 0
                      ? 'bg-rose-50/70 border-rose-200'
                      : 'bg-slate-50 border-slate-200'
                  }`}
                >
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-extrabold flex items-center gap-1.5">
                      <Calculator className="w-3.5 h-3.5 text-slate-700" />
                      <span>الوضعية المالية الحالية :</span>
                    </span>
                    <span
                      className={`font-mono font-black text-sm px-2.5 py-0.5 rounded-lg border ${
                        fin.balance > 0
                          ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                          : fin.balance < 0
                          ? 'bg-rose-100 text-rose-800 border-rose-300'
                          : 'bg-slate-100 text-slate-700 border-slate-300'
                      }`}
                    >
                      {fin.balance > 0
                        ? `كنسالوه : +${formatMAD(fin.balance)}`
                        : fin.balance < 0
                        ? `كيسالنا : -${formatMAD(Math.abs(fin.balance))}`
                        : 'خالص (متوازن)'}
                    </span>
                  </div>

                  <div className="mt-2 grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] text-slate-600 border-t border-slate-200/60 pt-2">
                    <div>
                      <span className="text-slate-400 block text-[10px]">CRBT محصل:</span>
                      <strong className="font-mono text-slate-800">{formatMAD(fin.totalDeliveredCod)}</strong>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px]">أتعاب الشريك:</span>
                      <strong className="font-mono text-red-600">-{formatMAD(fin.totalPartnerFees)}</strong>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px]">دفعات سددها:</span>
                      <strong className="font-mono text-emerald-600">-{formatMAD(fin.totalSettlementsReceived)}</strong>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px]">ربحك الصافي:</span>
                      <strong className="font-mono text-amber-700">+{formatMAD(fin.netProfit)}</strong>
                    </div>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-3 border-t border-slate-100 grid grid-cols-2 sm:grid-cols-4 gap-2">
                <button
                  onClick={() => setSelectedPartnerDetail(partner)}
                  className="py-2 px-2 text-xs font-bold text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 rounded-xl transition-colors flex items-center justify-center gap-1 cursor-pointer"
                  title="Détails du partenaire, configuration API et Webhook"
                >
                  <Zap className="w-3.5 h-3.5 text-red-600" />
                  <span>Détails & API</span>
                </button>

                <button
                  onClick={() => setAccountingPartner(partner)}
                  className="py-2 px-2 text-xs font-bold text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors flex items-center justify-center gap-1 cursor-pointer"
                  title="Consulter le relevé de compte et les versements reçus"
                >
                  <Receipt className="w-3.5 h-3.5 text-slate-700" />
                  <span>كشف الحساب</span>
                </button>

                <button
                  onClick={() => {
                    if (onOpenDispatch) {
                      onOpenDispatch();
                    } else {
                      setShowDispatchModal(partner);
                    }
                  }}
                  className="py-2 px-2 text-xs font-bold text-cyan-800 bg-cyan-50 hover:bg-cyan-100 border border-cyan-200 rounded-xl transition-colors flex items-center justify-center gap-1 cursor-pointer"
                >
                  <Send className="w-3.5 h-3.5 text-cyan-700" />
                  <span>ربط طرود</span>
                </button>

                <button
                  onClick={() => handleImpersonatePartner(partner)}
                  className="py-2 px-2 text-xs font-bold text-white bg-red-600 hover:bg-red-700 rounded-xl transition-colors flex items-center justify-center gap-1 cursor-pointer shadow-2xs active:scale-95"
                  title="Se connecter directement sur le compte de ce partenaire (دخول)"
                >
                  <LogIn className="w-3.5 h-3.5" />
                  <span>دخول (Accès)</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* ================= PARTNER DETAILS MODAL (Détails du partenaire - Olivraison) ================= */}
      {selectedPartnerDetail && (() => {
        const livePartner = partners.find(p => p.id === selectedPartnerDetail.id) || selectedPartnerDetail;
        const fin = calculatePartnerFinance(livePartner);
        const cfg = livePartner.apiConfig;
        const isOlivraison = cfg?.adapterType === 'olivraison' || (livePartner.name || '').toLowerCase().includes('oliv');
        const providerLabel =
          cfg?.adapterType === 'olivraison'
            ? 'Olivraison'
            : cfg?.adapterType === 'amana_express'
            ? 'Amana Express'
            : cfg?.adapterType === 'chronopost_ctm'
            ? 'Chronopost CTM'
            : cfg?.adapterType === 'cathedis'
            ? 'Cathedis'
            : livePartner.name;
        const apiKey = cfg?.apiKey || 'Non configurée';
        const baseUrl = cfg?.baseUrl || (isOlivraison ? OLIVRAISON_BASE_URL : 'Non configurée');
        const webhookUrl = isOlivraison
          ? `${window.location.origin}/api/webhooks/olivraison/${livePartner.id}`
          : livePartner.webhookUrl || `${window.location.origin}/api/webhooks/delivery/${livePartner.id}`;
        const webhookToken = livePartner.webhookToken || cfg?.webhookSecret || `sec_wh_${livePartner.id}`;
        const address = livePartner.address || livePartner.city;
        const website = livePartner.website || '';
        const registeredDate = livePartner.registeredAt || '—';
        const isConnected = Boolean(cfg?.enabled && cfg?.apiKey && cfg?.lastTestStatus !== 'error');
        const createdCount = cfg?.createdParcelsCount ?? livePartner.totalSent ?? 0;
        const failedTransmissions = cfg?.failedTransmissions || [];
        const failedCount = failedTransmissions.length;
        const lastCheckStr = cfg?.lastTestedAt ? formatDateTime(cfg.lastTestedAt) : 'Non vérifiée';
        const tokenExpiresStr = cfg?.tokenExpiresAt ? formatDateTime(cfg.tokenExpiresAt) : 'Valide / Aucune expiration JWT';
        const lastWebhookStr = cfg?.lastWebhookAt ? formatDateTime(cfg.lastWebhookAt) : 'Aucune notification reçue';

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs no-print">
            <div className="relative w-full max-w-4xl bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
              {/* Top Red Header Card */}
              <div className="bg-linear-to-r from-red-700 via-red-600 to-rose-700 text-white p-4 sm:p-5 shrink-0">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-3 border-b border-white/20">
                  <div className="flex items-center justify-between gap-2 w-full sm:w-auto">
                    <span className="text-[11px] font-black uppercase tracking-wider text-red-100 truncate">
                      DÉTAILS DU PARTENAIRE · INFORMATIONS & API
                    </span>
                    <button
                      type="button"
                      onClick={() => setSelectedPartnerDetail(null)}
                      className="sm:hidden p-1.5 text-white bg-white/15 hover:bg-white/25 rounded-lg transition cursor-pointer shrink-0"
                      title="Fermer"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleImpersonatePartner(livePartner)}
                      className="px-3 py-1.5 text-xs font-black text-red-700 bg-white hover:bg-red-50 rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer active:scale-95"
                      title="Se connecter directement au compte de ce partenaire (دخول لحساب الشريك)"
                    >
                      <LogIn className="w-3.5 h-3.5 text-red-600 shrink-0" />
                      <span>دخول لحساب الشريك</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        handleOpenEdit(livePartner);
                        setSelectedPartnerDetail(null);
                      }}
                      className="px-3 py-1.5 text-xs font-bold text-white bg-white/20 hover:bg-white/30 rounded-xl transition flex items-center gap-1.5 cursor-pointer"
                    >
                      <Edit2 className="w-3.5 h-3.5 shrink-0" />
                      <span>Modifier</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setSelectedPartnerDetail(null)}
                      className="hidden sm:inline-flex p-1.5 text-white/80 hover:text-white rounded-lg hover:bg-white/20 transition cursor-pointer shrink-0"
                      title="Fermer"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                </div>

                <div className="mt-3 sm:mt-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl bg-white/20 border border-white/30 backdrop-blur-xs flex items-center justify-center text-white font-black text-lg sm:text-xl shadow-inner shrink-0">
                      {livePartner.name.charAt(0)}
                    </div>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-lg sm:text-xl font-black text-white tracking-tight truncate">
                          {livePartner.name}
                        </h2>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/30 text-emerald-100 border border-emerald-400/50 flex items-center gap-1 shrink-0">
                          <CheckCircle2 className="w-3 h-3 text-emerald-300 shrink-0" />
                          <span>Actif</span>
                        </span>
                      </div>
                      <p className="text-xs text-red-100 mt-0.5 truncate">
                        {livePartner.contactPerson || livePartner.name} · {livePartner.phone}
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:flex items-center gap-2">
                    <div className="px-3 py-1.5 rounded-xl bg-white/15 border border-white/20 backdrop-blur-xs text-right">
                      <span className="text-[10px] uppercase font-bold text-red-200 block">Frais partenaire</span>
                      <span className="font-mono font-black text-sm text-white">{formatMAD(fin.totalPartnerFees)}</span>
                    </div>
                    <div className="px-3 py-1.5 rounded-xl bg-emerald-500/25 border border-emerald-400/40 backdrop-blur-xs text-right">
                      <span className="text-[10px] uppercase font-bold text-emerald-200 block">Solde net</span>
                      <span className="font-mono font-black text-sm text-emerald-100">{formatMAD(fin.balance)}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Scrollable Content */}
              <div className="flex-1 overflow-y-auto p-5 space-y-4 bg-slate-50/50">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Card 1: Informations du partenaire */}
                  <div className="p-4 bg-white border border-slate-200 rounded-2xl shadow-2xs space-y-3">
                    <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                      <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                        <Globe className="w-4 h-4 text-red-600" />
                        <span>Informations du partenaire</span>
                      </h4>
                      <span className="text-[10px] font-mono text-slate-400">ID: {livePartner.id}</span>
                    </div>

                    <div className="space-y-2 text-xs">
                      <div className="flex items-center justify-between py-1 border-b border-slate-100">
                        <span className="text-slate-500">Société :</span>
                        <span className="font-bold text-slate-800">{livePartner.name}</span>
                      </div>
                      <div className="flex items-center justify-between py-1 border-b border-slate-100">
                        <span className="text-slate-500">Ville :</span>
                        <span className="font-bold text-slate-800 flex items-center gap-1">
                          <MapPin className="w-3 h-3 text-red-500" />
                          <span>{livePartner.city}</span>
                        </span>
                      </div>
                      <div className="flex items-center justify-between py-1 border-b border-slate-100">
                        <span className="text-slate-500">Téléphone :</span>
                        <span className="font-mono font-bold text-slate-800">{livePartner.phone}</span>
                      </div>
                      <div className="flex items-center justify-between py-1 border-b border-slate-100">
                        <span className="text-slate-500">E-mail :</span>
                        <span className="text-slate-700">{livePartner.email || '—'}</span>
                      </div>
                      <div className="flex items-center justify-between py-1 border-b border-slate-100">
                        <span className="text-slate-500">Adresse :</span>
                        <span className="text-slate-700 text-right">{address}</span>
                      </div>
                      {website && (
                        <div className="flex items-center justify-between py-1 border-b border-slate-100">
                          <span className="text-slate-500">Site web :</span>
                          <a
                            href={website}
                            target="_blank"
                            rel="noreferrer"
                            className="font-mono text-blue-600 hover:underline flex items-center gap-1"
                          >
                            <span>{website.replace(/^https?:\/\//, '')}</span>
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        </div>
                      )}
                      <div className="flex items-center justify-between py-1">
                        <span className="text-slate-500">Inscription :</span>
                        <span className="text-slate-600 font-medium">{registeredDate}</span>
                      </div>
                    </div>
                  </div>

                  {/* Card 2: Solde du partenaire */}
                  <div className="p-4 bg-white border border-slate-200 rounded-2xl shadow-2xs space-y-3 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                        <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                          <Wallet className="w-4 h-4 text-emerald-600" />
                          <span>Solde du partenaire</span>
                        </h4>
                        <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                          {fin.balance >= 0 ? 'À recouvrer' : 'À reverser'}
                        </span>
                      </div>

                      <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                        <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-100">
                          <span className="text-[10px] text-slate-400 uppercase font-bold block">Colis livrés</span>
                          <span className="font-mono font-black text-slate-900 text-sm">
                            {fin.deliveredParcels.length}
                          </span>
                        </div>
                        <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-100">
                          <span className="text-[10px] text-slate-400 uppercase font-bold block">Montant à recevoir</span>
                          <span className="font-mono font-black text-emerald-700 text-sm">
                            {formatMAD(fin.totalDeliveredCod)}
                          </span>
                        </div>
                        <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-100">
                          <span className="text-[10px] text-slate-400 uppercase font-bold block">Frais de livraison</span>
                          <span className="font-mono font-black text-red-600 text-sm">
                            {formatMAD(fin.totalPartnerFees)}
                          </span>
                        </div>
                        <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-100">
                          <span className="text-[10px] text-slate-400 uppercase font-bold block">Total collecté</span>
                          <span className="font-mono font-black text-slate-800 text-sm">
                            {formatMAD(fin.totalDeliveredCod)}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="pt-2 flex items-center justify-between border-t border-slate-100">
                      <span className="text-xs text-slate-500">
                        Solde net : <strong className="text-slate-900 font-mono">{formatMAD(fin.balance)}</strong>
                      </span>
                      <button
                        onClick={() => {
                          setAccountingPartner(livePartner);
                          setSelectedPartnerDetail(null);
                        }}
                        className="px-3 py-1.5 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition flex items-center gap-1.5 cursor-pointer"
                      >
                        <Receipt className="w-3.5 h-3.5 text-slate-600" />
                        <span>Réinitialiser / Relevé</span>
                      </button>
                    </div>
                  </div>
                </div>

                {/* Card 3: API de livraison externe (Olivraison) */}
                <div className="p-4 bg-white border border-slate-200 rounded-2xl shadow-2xs space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-100">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
                        <Key className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider">
                          API de livraison externe
                        </h4>
                        <p className="text-[11px] text-slate-500">
                          Transmettez les colis au propre système de livraison de ce partenaire.
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleTestPartnerApi(livePartner)}
                        disabled={testApiStatus === 'testing'}
                        className="px-3 py-1.5 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${testApiStatus === 'testing' ? 'animate-spin text-red-600' : 'text-slate-600'}`} />
                        <span>{testApiStatus === 'testing' ? 'Vérification...' : 'Tester la connexion'}</span>
                      </button>

                      <button
                        onClick={() => handleOpenApiConfigModal(livePartner)}
                        className="px-3 py-1.5 text-xs font-bold text-white bg-red-600 hover:bg-red-700 rounded-xl shadow-xs transition flex items-center gap-1.5 cursor-pointer"
                      >
                        <Settings className="w-3.5 h-3.5" />
                        <span>Configurer</span>
                      </button>
                    </div>
                  </div>

                  {/* Status Metrics Row matching Olivraison video */}
                  <div className="flex flex-wrap items-center gap-2 text-[11px] font-bold">
                    <span
                      className={`px-2.5 py-0.5 rounded-full border flex items-center gap-1.5 ${
                        isConnected
                          ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                          : cfg?.lastTestStatus === 'error'
                          ? 'bg-rose-50 text-rose-800 border-rose-200'
                          : 'bg-slate-100 text-slate-700 border-slate-200'
                      }`}
                    >
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${
                          isConnected ? 'bg-emerald-500' : cfg?.lastTestStatus === 'error' ? 'bg-rose-500' : 'bg-slate-400'
                        }`}
                      />
                      <span>{isConnected ? 'Connecté' : cfg?.enabled ? 'Configuré (Non vérifié)' : 'Désactivé'}</span>
                    </span>

                    <span
                      className={`px-2.5 py-0.5 rounded-full border ${
                        cfg?.autoDispatch
                          ? 'bg-blue-50 text-blue-800 border-blue-200'
                          : 'bg-slate-50 text-slate-500 border-slate-200'
                      }`}
                    >
                      {cfg?.autoDispatch ? 'Envoi automatique activé' : 'Envoi manuel'}
                    </span>

                    <span className="px-2.5 py-0.5 rounded-full bg-slate-50 text-slate-700 border border-slate-200 font-mono">
                      Colis créés : {createdCount}
                    </span>

                    <span
                      className={`px-2.5 py-0.5 rounded-full border font-mono ${
                        failedCount > 0
                          ? 'bg-rose-50 text-rose-700 border-rose-200'
                          : 'bg-slate-50 text-slate-600 border-slate-200'
                      }`}
                    >
                      Échecs : {failedCount}
                    </span>
                  </div>

                  {testApiMessage && (
                    <div
                      className={`p-2.5 rounded-xl border flex items-center gap-2 text-xs ${
                        testApiStatus === 'success'
                          ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                          : 'bg-rose-50 border-rose-200 text-rose-900'
                      }`}
                    >
                      {testApiStatus === 'success' ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      ) : (
                        <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                      )}
                      <span>{testApiMessage}</span>
                    </div>
                  )}

                  {/* Configuration Metadata Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-xs pt-1">
                    <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200/80">
                      <span className="text-[10px] font-bold text-slate-400 uppercase block">FOURNISSEUR</span>
                      <span className="font-bold text-slate-900 mt-0.5 block">{providerLabel}</span>
                    </div>

                    <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200/80 sm:col-span-2">
                      <span className="text-[10px] font-bold text-slate-400 uppercase block mb-0.5">CLÉ API</span>
                      <div className="flex items-center justify-between gap-2 bg-white px-2.5 py-1 rounded-lg border border-slate-200">
                        <span className="font-mono text-xs text-slate-800 truncate">
                          {revealedApiKey
                            ? apiKey
                            : apiKey.length > 8
                            ? `${apiKey.slice(0, 4)}••••••••${apiKey.slice(-4)}`
                            : apiKey}
                        </span>
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => setRevealedApiKey(!revealedApiKey)}
                            className="p-1 text-slate-400 hover:text-slate-600 cursor-pointer"
                            title={revealedApiKey ? 'Masquer' : 'Afficher'}
                          >
                            {revealedApiKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleCopyValue('apikey', apiKey)}
                            className="p-1 text-slate-400 hover:text-slate-600 cursor-pointer"
                            title="Copier la clé"
                          >
                            {copiedItem === 'apikey' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200/80">
                      <span className="text-[10px] font-bold text-slate-400 uppercase block">URL DE BASE DE L'API</span>
                      <span className="font-mono text-[11px] font-semibold text-slate-800 break-all mt-0.5 block">
                        {baseUrl}
                      </span>
                    </div>

                    <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200/80">
                      <span className="text-[10px] font-bold text-slate-400 uppercase block">DERNIÈRE VÉRIFICATION</span>
                      <span className="font-mono text-[11px] font-semibold text-slate-700 mt-0.5 block">
                        {lastCheckStr}
                      </span>
                    </div>

                    <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200/80">
                      <span className="text-[10px] font-bold text-slate-400 uppercase block">JETON VALABLE JUSQU'AU</span>
                      <span className="font-mono text-[11px] font-semibold text-slate-700 mt-0.5 block">
                        {tokenExpiresStr}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Card 4: WEBHOOK DE STATUT */}
                <div className="p-4 bg-white border border-slate-200 rounded-2xl shadow-2xs space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-100">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center font-bold">
                        <Radio className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider">
                          WEBHOOK DE STATUT
                        </h4>
                        <p className="text-[11px] text-slate-500">
                          Collez ces deux valeurs dans le tableau de bord Olivraison du partenaire, section Webhooks, et cochez « Activer les notifications webhook » ainsi que « Activer l'authentification Bearer Token ».
                        </p>
                      </div>
                    </div>

                    <button
                      onClick={() => handleRegenerateWebhookToken(livePartner)}
                      className="px-3 py-1.5 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition flex items-center gap-1.5 cursor-pointer shrink-0"
                    >
                      <RefreshCw className="w-3.5 h-3.5 text-slate-500" />
                      <span>Régénérer le token</span>
                    </button>
                  </div>

                  <div className="space-y-2.5 text-xs">
                    {/* URL */}
                    <div>
                      <span className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">URL DU WEBHOOK :</span>
                      <div className="flex items-center justify-between gap-2 bg-slate-50 px-3 py-2 rounded-xl border border-slate-200 font-mono text-[11px] text-slate-800">
                        <span className="truncate select-all">{webhookUrl}</span>
                        <button
                          onClick={() => handleCopyValue('webhookUrl', webhookUrl)}
                          className="px-2 py-1 bg-white border border-slate-200 rounded-lg text-[11px] font-sans font-bold text-slate-600 hover:text-slate-900 cursor-pointer shrink-0 flex items-center gap-1"
                          title="Copier l'URL"
                        >
                          {copiedItem === 'webhookUrl' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                          <span>{copiedItem === 'webhookUrl' ? 'Copié' : 'Copier'}</span>
                        </button>
                      </div>
                    </div>

                    {/* Token */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                      <div>
                        <span className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">BEARER TOKEN :</span>
                        <div className="flex items-center justify-between gap-2 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200 font-mono text-xs text-slate-800">
                          <span className="truncate select-all">
                            {revealedWebhookToken ? webhookToken : `${webhookToken.slice(0, 10)}••••••••`}
                          </span>
                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              type="button"
                              onClick={() => setRevealedWebhookToken(!revealedWebhookToken)}
                              className="p-1 text-slate-400 hover:text-slate-600 cursor-pointer"
                            >
                              {revealedWebhookToken ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                            </button>
                            <button
                              type="button"
                              onClick={() => handleCopyValue('webhookToken', webhookToken)}
                              className="p-1 text-slate-400 hover:text-slate-600 cursor-pointer"
                            >
                              {copiedItem === 'webhookToken' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                            </button>
                          </div>
                        </div>
                      </div>

                      <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200/80 flex flex-col justify-center">
                        <span className="text-[10px] text-slate-400 uppercase font-bold block">DERNIÈRE NOTIFICATION</span>
                        <span className="font-mono text-xs font-bold text-slate-800 mt-0.5">
                          {lastWebhookStr}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Card 4b: TRANSMISSIONS ÉCHOUÉES + Retry */}
                {failedTransmissions.length > 0 && (
                  <div className="p-4 bg-white border border-rose-200 rounded-2xl shadow-2xs space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-rose-100">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center">
                          <AlertTriangle className="w-4 h-4" />
                        </div>
                        <div>
                          <h4 className="text-xs font-black text-rose-900 uppercase tracking-wider">
                            TRANSMISSIONS ÉCHOUÉES ({failedTransmissions.length})
                          </h4>
                          <p className="text-[11px] text-rose-600">
                            Corrigez les données du colis (ex. contenu d'au moins 5 caractères) puis réessayez.
                          </p>
                        </div>
                      </div>

                      <button
                        onClick={() => handleRetryFailedTransmissions(livePartner)}
                        disabled={isRetryingFailed}
                        className="px-3.5 py-1.5 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl shadow-xs transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                      >
                        <RotateCcw className={`w-3.5 h-3.5 ${isRetryingFailed ? 'animate-spin' : ''}`} />
                        <span>{isRetryingFailed ? 'Réessai en cours...' : 'Réessayer les échecs'}</span>
                      </button>
                    </div>

                    {retryStatusMessage && (
                      <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-800 font-semibold">
                        {retryStatusMessage}
                      </div>
                    )}

                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {failedTransmissions.map(item => (
                        <div
                          key={item.id}
                          className="p-2.5 bg-rose-50/60 border border-rose-100 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
                        >
                          <div className="min-w-0">
                            <span className="font-mono font-bold text-slate-900">{item.trackingNumber}</span>
                            <span className="text-slate-400 mx-1.5">—</span>
                            <span className="text-rose-700 font-medium">{item.message}</span>
                          </div>
                          <span className="text-[10px] font-mono text-slate-400 shrink-0">
                            {formatDateTime(item.timestamp)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Card 5: Statistiques des colis */}
                <div className="p-4 bg-white border border-slate-200 rounded-2xl shadow-2xs space-y-3">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                    <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                      <Package className="w-4 h-4 text-cyan-600" />
                      <span>Statistiques des colis ({livePartner.name})</span>
                    </h4>
                    <span className="text-xs text-slate-500 font-mono font-bold">Total: {fin.partnerParcels.length}</span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-xs">
                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                      <span className="text-[10px] text-slate-400 uppercase font-bold block">Total Confiés</span>
                      <span className="font-mono font-black text-slate-900 text-base">{fin.partnerParcels.length}</span>
                    </div>
                    <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-100">
                      <span className="text-[10px] text-emerald-600 uppercase font-bold block">Livrés</span>
                      <span className="font-mono font-black text-emerald-700 text-base">{fin.deliveredParcels.length}</span>
                    </div>
                    <div className="p-3 bg-cyan-50 rounded-xl border border-cyan-100">
                      <span className="text-[10px] text-cyan-600 uppercase font-bold block">En Transit</span>
                      <span className="font-mono font-black text-cyan-700 text-base">{fin.inTransitParcels.length}</span>
                    </div>
                    <div className="p-3 bg-rose-50 rounded-xl border border-rose-100">
                      <span className="text-[10px] text-rose-600 uppercase font-bold block">Annulés / Retours</span>
                      <span className="font-mono font-black text-rose-700 text-base">{fin.returnedParcels.length}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="p-3.5 sm:p-4 border-t border-slate-200 bg-slate-50 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 shrink-0">
                <div className="flex items-center gap-2 text-[11px] sm:text-xs text-slate-500">
                  <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Partenaire conventionné · Intégration API & Webhooks {selectedPartnerDetail.apiConfig?.enabled ? 'active' : 'disponible'}</span>
                </div>

                <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                  {onOpenApiIntegration && (
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedPartnerDetail(null);
                        onOpenApiIntegration();
                      }}
                      className="flex-1 sm:flex-none px-3 py-2 text-xs font-bold text-slate-700 bg-white border border-slate-300 hover:bg-slate-100 rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Zap className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                      <span>Accès API</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => handleImpersonatePartner(selectedPartnerDetail)}
                    className="flex-1 sm:flex-none px-3 py-2 text-xs font-black text-white bg-red-600 hover:bg-red-700 rounded-xl shadow-xs transition flex items-center justify-center gap-1.5 cursor-pointer active:scale-95"
                  >
                    <LogIn className="w-3.5 h-3.5 shrink-0" />
                    <span>دخول الشريك</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSelectedPartnerDetail(null)}
                    className="px-4 py-2 text-xs font-bold text-slate-700 bg-slate-200 hover:bg-slate-300 rounded-xl transition cursor-pointer shrink-0"
                  >
                    Fermer
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ================= ACCOUNTING / RELEVÉ MODAL (كشف الحساب والمحاسبة) ================= */}
      {accountingPartner && (() => {
        const fin = calculatePartnerFinance(accountingPartner);
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-2.5 sm:p-4 bg-black/60 backdrop-blur-xs no-print">
            <div className="relative w-full max-w-4xl bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92dvh]">
              {/* Header (Compact & Pinned) */}
              <div className="shrink-0 flex items-start sm:items-center justify-between gap-2 px-3.5 py-3 sm:px-6 sm:py-4 border-b border-slate-200 bg-slate-50">
                <div className="flex items-start sm:items-center gap-2.5 sm:gap-3 min-w-0">
                  <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-red-100 text-red-600 flex items-center justify-center font-bold shrink-0">
                    <Receipt className="w-4 h-4 sm:w-5 sm:h-5" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-sm sm:text-base font-extrabold text-slate-900 flex flex-wrap items-center gap-1.5 leading-snug">
                      <span className="break-words">كشف حساب وتصفية مستحقات : {accountingPartner.name}</span>
                      {accountingPartner.city && (
                        <span className="font-mono text-[11px] px-2 py-0.5 rounded bg-slate-200 text-slate-700 shrink-0">
                          {accountingPartner.city}
                        </span>
                      )}
                    </h3>
                    <p className="text-[11px] sm:text-xs text-slate-500 mt-0.5 leading-snug">
                      سعر التوصيل: <strong className="text-slate-800">{fin.deliveryRate} DH/طرد</strong> • سعر الإرجاع: <strong className="text-slate-800">{fin.returnRate} DH/طرد</strong>
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                  <button
                    onClick={handlePrintPartnerStatement}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 sm:px-3 text-[11px] sm:text-xs font-bold text-slate-700 bg-white border border-slate-300 hover:bg-slate-100 rounded-xl transition cursor-pointer whitespace-nowrap"
                  >
                    <Printer className="w-3.5 h-3.5 text-slate-600 shrink-0" />
                    <span className="hidden xs:inline sm:inline">طباعة</span>
                    <span className="hidden sm:inline">الكشف</span>
                  </button>

                  <button
                    onClick={() => {
                      setAccountingPartner(null);
                      setShowAddSettlement(false);
                    }}
                    aria-label="إغلاق"
                    className="p-1.5 sm:p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 rounded-lg cursor-pointer"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Single Unified Scrollable Body (KPIs + Tabs + Settlement Form + Table) */}
              <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain">
                {/* Financial Balance Summary Banner */}
                <div className="p-3 sm:p-5 bg-slate-50/70 border-b border-slate-200">
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 sm:gap-3">
                    <div className="p-2.5 sm:p-3 bg-white border border-slate-200 rounded-xl">
                      <span className="text-[10px] text-slate-500 font-bold uppercase block">CRBT المحصل (مجموع)</span>
                      <span className="text-sm sm:text-base font-black font-mono text-slate-900 block mt-0.5">
                        {formatMAD(fin.totalDeliveredCod)}
                      </span>
                      <span className="text-[10px] text-slate-400 block mt-0.5">{fin.deliveredParcels.length} طرد تم تسليمها</span>
                    </div>

                    <div className="p-2.5 sm:p-3 bg-white border border-slate-200 rounded-xl">
                      <span className="text-[10px] text-slate-500 font-bold uppercase block">أتعاب التوصيل للشريك</span>
                      <span className="text-sm sm:text-base font-black font-mono text-red-600 block mt-0.5">
                        - {formatMAD(fin.totalPartnerFees)}
                      </span>
                      <span className="text-[10px] text-slate-400 block mt-0.5">مستحقات الشريك عن التوصيل</span>
                    </div>

                    <div className="p-2.5 sm:p-3 bg-white border border-slate-200 rounded-xl">
                      <span className="text-[10px] text-slate-500 font-bold uppercase block">الدفعات المستلمة</span>
                      <span className="text-sm sm:text-base font-black font-mono text-emerald-600 block mt-0.5">
                        - {formatMAD(fin.totalSettlementsReceived)}
                      </span>
                      <span className="text-[10px] text-slate-400 block mt-0.5">{fin.settlements.length} دفعة مسجلة</span>
                    </div>

                    <div className="p-2.5 sm:p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-950">
                      <span className="text-[10px] font-bold uppercase block text-amber-800">
                        💰 ربحك الصافي
                      </span>
                      <span className="text-sm sm:text-base font-black font-mono block mt-0.5 text-amber-900">
                        + {formatMAD(fin.netProfit)}
                      </span>
                      <span className="text-[10px] text-amber-700 block mt-0.5">
                        الفرق بين الزبون والشريك
                      </span>
                    </div>

                    <div
                      className={`col-span-2 sm:col-span-1 p-2.5 sm:p-3 rounded-xl border ${
                        fin.balance > 0
                          ? 'bg-emerald-50 border-emerald-200 text-emerald-950'
                          : fin.balance < 0
                          ? 'bg-rose-50 border-rose-200 text-rose-950'
                          : 'bg-slate-100 border-slate-200 text-slate-900'
                      }`}
                    >
                      <span className="text-[10px] font-bold uppercase block">
                        {fin.balance > 0 ? '🟢 كنسالوه (متبقي لنا)' : fin.balance < 0 ? '🔴 كيسالنا (متبقي له)' : '⚪ الحساب متوازن'}
                      </span>
                      <span className="text-sm sm:text-base font-black font-mono block mt-0.5">
                        {fin.balance > 0
                          ? `+ ${formatMAD(fin.balance)}`
                          : fin.balance < 0
                          ? `- ${formatMAD(Math.abs(fin.balance))}`
                          : '0.00 DH'}
                      </span>
                    </div>
                  </div>

                  {/* Action to record a settlement & tabs (responsive wrapping) */}
                  <div className="mt-3 sm:mt-4 flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                      <button
                        onClick={() => setAccountingTab('packages')}
                        className={`px-3 py-1.5 text-xs font-bold rounded-xl transition cursor-pointer ${
                          accountingTab === 'packages'
                            ? 'bg-red-600 text-white'
                            : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        تفاصيل الطرود ({fin.partnerParcels.length})
                      </button>
                      <button
                        onClick={() => setAccountingTab('settlements')}
                        className={`px-3 py-1.5 text-xs font-bold rounded-xl transition cursor-pointer ${
                          accountingTab === 'settlements'
                            ? 'bg-red-600 text-white'
                            : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        سجل الدفعات والتسويات ({fin.settlements.length})
                      </button>
                    </div>

                    <button
                      onClick={() => setShowAddSettlement(true)}
                      className="w-full sm:w-auto flex items-center justify-center gap-1.5 px-3.5 py-2 sm:py-1.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-xs transition cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5 shrink-0" />
                      <span>تسجيل دفعة جديدة من الشريك (توصلنا بالفلوس)</span>
                    </button>
                  </div>
                </div>

                {/* Record Settlement Subform Modal */}
                {showAddSettlement && (
                  <div className="p-3.5 sm:p-4 bg-emerald-50/70 border-b border-emerald-200">
                    <form onSubmit={handleAddSettlementSubmit} className="space-y-3">
                      <div className="flex items-center justify-between gap-2">
                        <h4 className="text-xs font-bold text-emerald-950 flex items-center gap-1.5">
                          <Wallet className="w-4 h-4 text-emerald-600 shrink-0" />
                          <span>تسجيل دفعة مالية مستلمة من الشريك {accountingPartner.name}</span>
                        </h4>
                        <button
                          type="button"
                          onClick={() => setShowAddSettlement(false)}
                          className="text-slate-500 hover:text-slate-700 text-xs font-bold shrink-0 cursor-pointer"
                        >
                          إلغاء
                        </button>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                        <div>
                          <label className="block text-[11px] font-bold text-slate-700 mb-1">المبلغ (DH) *</label>
                          <input
                            type="number"
                            step="0.01"
                            required
                            value={settlementAmount}
                            onChange={e => setSettlementAmount(e.target.value)}
                            placeholder="مثال: 1500"
                            className="w-full text-xs font-mono bg-white border border-slate-300 rounded-xl px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                          />
                        </div>

                        <div>
                          <label className="block text-[11px] font-bold text-slate-700 mb-1">طريقة الدفع</label>
                          <select
                            value={settlementMethod}
                            onChange={e => setSettlementMethod(e.target.value as any)}
                            className="w-full text-xs bg-white border border-slate-300 rounded-xl px-3 py-2 text-slate-900"
                          >
                            <option value="virement">تحويل بنكي (Virement)</option>
                            <option value="especes">نقداً (Espèces)</option>
                            <option value="cheque">شيك (Chèque)</option>
                            <option value="autre">أخرى</option>
                          </select>
                        </div>

                        <div>
                          <label className="block text-[11px] font-bold text-slate-700 mb-1">رقم المرجع / التحويل</label>
                          <input
                            type="text"
                            value={settlementRef}
                            onChange={e => setSettlementRef(e.target.value)}
                            placeholder="VRM-2026-..."
                            className="w-full text-xs font-mono bg-white border border-slate-300 rounded-xl px-3 py-2 text-slate-900"
                          />
                        </div>

                        <div>
                          <label className="block text-[11px] font-bold text-slate-700 mb-1">ملاحظات</label>
                          <input
                            type="text"
                            value={settlementNotes}
                            onChange={e => setSettlementNotes(e.target.value)}
                            placeholder="دفعة عن طرود الأسبوع..."
                            className="w-full text-xs bg-white border border-slate-300 rounded-xl px-3 py-2 text-slate-900"
                          />
                        </div>
                      </div>

                      <div className="flex justify-end pt-1">
                        <button
                          type="submit"
                          className="px-4 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-xs transition cursor-pointer"
                        >
                          تأكيد وحفظ الدفعة
                        </button>
                      </div>
                    </form>
                  </div>
                )}

                {/* Body Content (Packages / Settlements Tables) */}
                <div className="p-3 sm:p-4">
                  {accountingTab === 'packages' ? (
                    fin.partnerParcels.length === 0 ? (
                      <div className="p-6 sm:p-8 text-center text-slate-400 text-xs">
                        لا توجد طرود مسندة لهذا الشريك حالياً
                      </div>
                    ) : (
                      <div className="overflow-x-auto border border-slate-200 rounded-xl">
                        <table className="w-full text-xs text-right whitespace-nowrap">
                          <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
                            <tr>
                              <th className="p-2.5 text-center">#</th>
                              <th className="p-2.5">رقم التتبع</th>
                              <th className="p-2.5">المرسل إليه</th>
                              <th className="p-2.5">المدينة</th>
                              <th className="p-2.5">الحالة</th>
                              <th className="p-2.5">مبلغ CRBT</th>
                              <th className="p-2.5">أتعاب الشريك</th>
                              <th className="p-2.5">ربحك الصافي</th>
                              <th className="p-2.5">الصافي المستحق</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {fin.partnerParcels.map((pkg, idx) => {
                              const isLivre = pkg.status === 'livre';
                              const isAdminDelivered = isLivre && pkg.deliveredBy === 'admin';
                              const isPartnerDelivered = isLivre && !isAdminDelivered;
                              const isRetour = ['retourne', 'retour_recu', 'annule'].includes(pkg.status);
                              const pkgPartnerRate = getPartnerFeeForPackage(accountingPartner, pkg);
                              const fee = isPartnerDelivered ? pkgPartnerRate : isRetour ? fin.returnRate : 0;
                              const cod = isPartnerDelivered ? (pkg.codAmount || 0) : 0;
                              const net = cod - fee;
                              const parcelMargin = isLivre ? (Number(pkg.deliveryFee || 0) - fee) : 0;

                              return (
                                <tr key={pkg.id} className="hover:bg-slate-50">
                                  <td className="p-2.5 text-center font-mono text-slate-400">{idx + 1}</td>
                                  <td className="p-2.5 font-mono font-bold text-slate-900">{pkg.trackingNumber}</td>
                                  <td className="p-2.5 text-slate-700 font-medium">{pkg.recipientName || 'N/A'}</td>
                                  <td className="p-2.5 text-slate-600">{pkg.city}</td>
                                  <td className="p-2.5">
                                    <span
                                      className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                        isAdminDelivered
                                          ? 'bg-sky-100 text-sky-800'
                                          : isPartnerDelivered
                                          ? 'bg-emerald-100 text-emerald-800'
                                          : isRetour
                                          ? 'bg-rose-100 text-rose-800'
                                          : 'bg-cyan-100 text-cyan-800'
                                      }`}
                                    >
                                      {isAdminDelivered ? 'livré (الإدارة)' : pkg.status}
                                    </span>
                                  </td>
                                  <td className="p-2.5 font-mono font-bold text-slate-900">
                                    {pkg.codAmount || 0} DH
                                  </td>
                                  <td className="p-2.5 font-mono font-bold text-red-600">
                                    {fee > 0 ? `-${fee} DH` : '0 DH'}
                                  </td>
                                  <td className="p-2.5 font-mono font-bold text-amber-700">
                                    {isLivre ? `${parcelMargin >= 0 ? '+' : ''}${parcelMargin} DH` : '0 DH'}
                                  </td>
                                  <td className="p-2.5 font-mono font-extrabold text-slate-900">
                                    {isAdminDelivered ? (
                                      <span className="text-sky-700">توصيل الإدارة (0 DH)</span>
                                    ) : isPartnerDelivered ? (
                                      <span className="text-emerald-700">+{net} DH</span>
                                    ) : isRetour ? (
                                      <span className="text-rose-700">-{fee} DH</span>
                                    ) : (
                                      <span className="text-slate-400">في انتظار التسليم</span>
                                    )}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )
                  ) : (
                    /* Settlements Tab */
                    fin.settlements.length === 0 ? (
                      <div className="p-6 sm:p-8 text-center text-slate-400 text-xs">
                        لم يتم تسجيل أي دفعات أو تسويات مالية من هذا الشريك حتى الآن. اضغط على «تسجيل دفعة جديدة» لتسجيل ما تم استلامه.
                      </div>
                    ) : (
                      <div className="overflow-x-auto border border-slate-200 rounded-xl">
                        <table className="w-full text-xs text-right whitespace-nowrap">
                          <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
                            <tr>
                              <th className="p-2.5">التاريخ والوقت</th>
                              <th className="p-2.5">المبلغ المسدد</th>
                              <th className="p-2.5">طريقة الدفع</th>
                              <th className="p-2.5">رقم المرجع</th>
                              <th className="p-2.5">سجل بواسطة</th>
                              <th className="p-2.5">ملاحظات</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {fin.settlements.map(st => (
                              <tr key={st.id} className="hover:bg-slate-50">
                                <td className="p-2.5 text-slate-600 font-mono">{formatDateTime(st.date)}</td>
                                <td className="p-2.5 font-mono font-extrabold text-emerald-700 text-sm">
                                  {formatMAD(st.amount)}
                                </td>
                                <td className="p-2.5 font-medium text-slate-700">{st.paymentMethod}</td>
                                <td className="p-2.5 font-mono text-slate-600">{st.reference}</td>
                                <td className="p-2.5 text-slate-500">{st.registeredBy || 'Admin'}</td>
                                <td className="p-2.5 text-slate-500 italic">{st.notes || '—'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )
                  )}
                </div>
              </div>

              {/* Modal Footer (Compact & Pinned) */}
              <div className="shrink-0 px-3.5 py-3 sm:px-5 sm:py-3.5 border-t border-slate-200 bg-slate-50 flex flex-wrap items-center justify-between gap-2">
                <span className="text-[11px] sm:text-xs text-slate-600">
                  الحساب الصافي الحالي: <strong className="text-slate-900 font-mono">{fin.balance > 0 ? `كنسالوه +${formatMAD(fin.balance)}` : fin.balance < 0 ? `كيسالنا -${formatMAD(Math.abs(fin.balance))}` : 'متوازن'}</strong>
                </span>
                <button
                  onClick={() => {
                    setAccountingPartner(null);
                    setShowAddSettlement(false);
                  }}
                  className="px-4 py-2 text-xs font-bold text-slate-700 bg-white border border-slate-300 rounded-xl hover:bg-slate-100 cursor-pointer shrink-0"
                >
                  إغلاق
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Dispatch Modal to Partner */}
      {showDispatchModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2.5 sm:p-4 bg-black/60 backdrop-blur-xs no-print">
          <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90dvh]">
            <div className="shrink-0 flex items-center justify-between gap-2 px-4 py-3.5 sm:px-6 sm:py-4 border-b border-slate-100 bg-slate-50">
              <div className="min-w-0">
                <h3 className="text-sm sm:text-base font-bold text-slate-900">
                  Confier des colis au partenaire {showDispatchModal.name}
                </h3>
                <p className="text-[11px] sm:text-xs text-slate-500">
                  Sélectionnez les colis prêts en hub à acheminer vers {showDispatchModal.city} (سعر التوصيل: {showDispatchModal.deliveryFee ?? 30} DH)
                </p>
              </div>
              <button onClick={() => setShowDispatchModal(null)} className="p-2 text-slate-400 hover:text-slate-600 shrink-0 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="shrink-0 p-3 sm:p-4 border-b border-slate-100">
              <input
                type="text"
                value={dispatchSearch}
                onChange={e => setDispatchSearch(e.target.value)}
                placeholder="Filtrer par N° de suivi, ville..."
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-900"
              />
            </div>

            <div className="flex-1 min-h-0 p-3.5 sm:p-6 overflow-y-auto overscroll-contain space-y-2">
              {packages
                .filter(p => ['en_stock', 'expedie_hub', 'nouveau'].includes(p.status) && p.partnerId !== showDispatchModal.id)
                .filter(p => !dispatchSearch || (p.trackingNumber || '').includes(dispatchSearch) || (p.city || '').toLowerCase().includes(dispatchSearch.toLowerCase()))
                .map(p => (
                  <div
                    key={p.id}
                    className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex flex-wrap items-center justify-between gap-2 text-xs"
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                        <span className="font-mono font-bold text-slate-900">{p.trackingNumber}</span>
                        <span className="font-bold text-red-600">{p.city}</span>
                        <span className="text-slate-400">·</span>
                        <span className="text-slate-600 truncate">{p.recipientName}</span>
                      </div>
                      <div className="text-[11px] text-slate-500">
                        COD: <strong className="font-mono text-slate-900">{formatMAD(p.codAmount)}</strong>
                      </div>
                    </div>

                    <button
                      onClick={() => {
                        transferPackageAgency(p.id, `Agence ${showDispatchModal.city}`, showDispatchModal.id);
                        alert(`Colis ${p.trackingNumber} assigné au transporteur ${showDispatchModal.name}`);
                      }}
                      className="px-3 py-1.5 text-xs font-bold text-white bg-cyan-600 hover:bg-cyan-700 rounded-lg shadow-2xs transition-colors cursor-pointer shrink-0"
                    >
                      + Expédier
                    </button>
                  </div>
                ))}
            </div>

            <div className="shrink-0 p-3.5 sm:p-4 border-t border-slate-100 bg-slate-50 flex justify-end">
              <button
                onClick={() => setShowDispatchModal(null)}
                className="px-4 py-2 text-xs font-bold text-slate-700 bg-white border border-slate-300 rounded-xl cursor-pointer"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add / Edit Partner Modal — Profil complet & Attribution des tarifs par ville */}
      {(showAddPartnerModal || editingPartner) && (() => {
        const defaultFeeNum = Number(deliveryFee) || 30;
        const tQuery = tariffSearch.trim().toLowerCase();
        const activeCitiesList = cities.filter(c => c.active !== false);
        const filteredTariffCities = activeCitiesList.filter(
          c =>
            !tQuery ||
            (c.name || '').toLowerCase().includes(tQuery) ||
            (c.region || '').toLowerCase().includes(tQuery)
        );
        const pageSize = 12;
        const totalTariffPages = Math.max(1, Math.ceil(filteredTariffCities.length / pageSize));
        const safeTariffPage = Math.min(tariffPage, totalTariffPages);
        const paginatedTariffCities = filteredTariffCities.slice(
          (safeTariffPage - 1) * pageSize,
          safeTariffPage * pageSize
        );
        const selectedCityCount = Object.keys(cityTariffs).length;

        const toggleCitySelection = (cityName: string, fallbackPrice: number) => {
          setCityTariffs(prev => {
            const next = { ...prev };
            if (Object.prototype.hasOwnProperty.call(next, cityName)) {
              delete next[cityName];
            } else {
              next[cityName] = fallbackPrice;
            }
            return next;
          });
        };

        const setCityPrice = (cityName: string, rawVal: string) => {
          const parsed = rawVal === '' ? 0 : Math.max(0, Number(rawVal) || 0);
          setCityTariffs(prev => ({
            ...prev,
            [cityName]: parsed
          }));
        };

        const selectAllFiltered = () => {
          setCityTariffs(prev => {
            const next = { ...prev };
            filteredTariffCities.forEach(c => {
              if (!Object.prototype.hasOwnProperty.call(next, c.name)) {
                next[c.name] = defaultFeeNum;
              }
            });
            return next;
          });
        };

        const selectSouthCities = () => {
          setCityTariffs(prev => {
            const next = { ...prev };
            activeCitiesList.forEach(c => {
              const reg = (c.region || '').toLowerCase();
              if (reg === 'sud' || reg.includes('الجنوب') || reg.includes('sahara')) {
                next[c.name] = defaultFeeNum;
              }
            });
            return next;
          });
        };

        const applyDefaultPriceToSelected = () => {
          setCityTariffs(prev => {
            const next: Record<string, number> = {};
            Object.keys(prev).forEach(k => {
              next[k] = defaultFeeNum;
            });
            return next;
          });
        };

        return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2.5 sm:p-4 bg-black/60 backdrop-blur-xs no-print">
          <div className="relative w-full max-w-3xl bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92dvh]">
            <div className="flex items-center justify-between gap-2 px-4 py-3.5 sm:px-6 sm:py-4 border-b border-slate-200 bg-slate-50 shrink-0">
              <div className="min-w-0">
                <h3 className="text-sm sm:text-base font-extrabold text-slate-900">
                  {editingPartner ? `Modifier le partenaire : ${editingPartner.name}` : 'Nouveau Partenaire Transporteur'}
                </h3>
                <p className="text-[11px] text-slate-500">
                  Profil, identifiants, villes couvertes et tarifs négociés par zone
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowAddPartnerModal(false);
                  setEditingPartner(null);
                }}
                className="p-2 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer shrink-0"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form
              onSubmit={editingPartner ? handleUpdateSubmit : handleAddSubmit}
              className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-3.5 sm:p-6 space-y-4 bg-slate-50/60"
            >
              {formError && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs font-bold text-rose-700 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              {/* Section 1: LOGO DU PARTENAIRE */}
              <div className="p-4 bg-white border border-slate-200 rounded-2xl space-y-3">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block">
                  Logo du partenaire
                </span>
                <div className="flex flex-col items-center justify-center py-2">
                  <label className="group cursor-pointer flex flex-col items-center gap-2">
                    <div className="w-24 h-24 rounded-full border-2 border-dashed border-slate-300 group-hover:border-red-500 bg-slate-50 flex items-center justify-center overflow-hidden transition-colors relative">
                      {logoUrl ? (
                        <img src={logoUrl} alt="Logo partenaire" className="w-full h-full object-cover" />
                      ) : (
                        <div className="flex flex-col items-center text-slate-400 group-hover:text-red-500">
                          <Upload className="w-5 h-5 mb-1" />
                          <span className="text-[10px] font-semibold">Logo</span>
                        </div>
                      )}
                    </div>
                    <input type="file" accept="image/*" onChange={handleLogoUpload} className="hidden" />
                    <span className="text-xs text-slate-500 group-hover:text-red-600 font-medium">
                      Cliquer sur l&apos;image pour changer
                    </span>
                  </label>
                  {logoUrl && (
                    <button
                      type="button"
                      onClick={() => setLogoUrl('')}
                      className="mt-1 text-[11px] text-rose-600 hover:underline cursor-pointer"
                    >
                      Supprimer le logo
                    </button>
                  )}
                </div>
              </div>

              {/* Section 2: IDENTIFIANTS DU COMPTE */}
              <div className="p-4 bg-white border border-slate-200 rounded-2xl space-y-3">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block">
                  Identifiants du compte
                </span>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    E-mail <span className="text-slate-400">(obligatoire pour accès portail)</span>
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="email"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      placeholder="olivraison@gmail.com"
                      className="w-full text-xs bg-slate-50 border border-slate-300 rounded-xl pl-9 pr-3.5 py-2.5 text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Mot de passe {editingPartner && <span className="text-slate-400">(laisser vide pour conserver)</span>}
                    </label>
                    <div className="relative">
                      <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        type="password"
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        placeholder="Min. 6 caractères"
                        className="w-full text-xs bg-slate-50 border border-slate-300 rounded-xl pl-9 pr-3.5 py-2.5 text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-500"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Confirmer le mot de passe
                    </label>
                    <div className="relative">
                      <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        type="password"
                        value={confirmPassword}
                        onChange={e => setConfirmPassword(e.target.value)}
                        placeholder="Répéter le mot de passe"
                        className="w-full text-xs bg-slate-50 border border-slate-300 rounded-xl pl-9 pr-3.5 py-2.5 text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-500"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Section 3: INFORMATIONS GÉNÉRALES */}
              <div className="p-4 bg-white border border-slate-200 rounded-2xl space-y-3">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block">
                  Informations générales
                </span>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Nom de la société <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <Building className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        type="text"
                        required
                        value={name}
                        onChange={e => setName(e.target.value)}
                        placeholder="Ex: Olivraison / Oliv"
                        className="w-full text-xs bg-slate-50 border border-slate-300 rounded-xl pl-9 pr-3.5 py-2.5 text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-500"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Responsable contact
                    </label>
                    <input
                      type="text"
                      value={contactPerson}
                      onChange={e => setContactPerson(e.target.value)}
                      placeholder="Nom du responsable"
                      className="w-full text-xs bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Ville <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <MapPin className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        type="text"
                        required
                        value={city}
                        onChange={e => setCity(e.target.value)}
                        placeholder="Laâyoune / Casablanca"
                        className="w-full text-xs bg-slate-50 border border-slate-300 rounded-xl pl-9 pr-3.5 py-2.5 text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-500"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Téléphone de contact <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <Phone className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        type="tel"
                        required
                        value={phone}
                        onChange={e => setPhone(e.target.value)}
                        placeholder="0760-660167"
                        className="w-full text-xs font-mono bg-slate-50 border border-slate-300 rounded-xl pl-9 pr-3.5 py-2.5 text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-500"
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Adresse
                  </label>
                  <div className="relative">
                    <MapPin className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="text"
                      value={address}
                      onChange={e => setAddress(e.target.value)}
                      placeholder="Laâyoune rue smara"
                      className="w-full text-xs bg-slate-50 border border-slate-300 rounded-xl pl-9 pr-3.5 py-2.5 text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Site web <span className="text-slate-400">(optionnel)</span>
                  </label>
                  <div className="relative">
                    <Globe className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="text"
                      value={website}
                      onChange={e => setWebsite(e.target.value)}
                      placeholder="https://example.com"
                      className="w-full text-xs bg-slate-50 border border-slate-300 rounded-xl pl-9 pr-3.5 py-2.5 text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Description <span className="text-slate-400">(optionnel)</span>
                  </label>
                  <textarea
                    rows={2}
                    value={notes}
                    onChange={e => setNotes(e.target.value)}
                    placeholder="Brève description du partenaire — services offerts, zone de couverture, etc."
                    className="w-full text-xs bg-slate-50 border border-slate-300 rounded-xl p-3 text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-500"
                  />
                </div>

                {/* Default Tariff Fallback (Livraison / Retour) */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 bg-red-50/50 border border-red-200/60 rounded-xl">
                  <div>
                    <label className="block text-xs font-bold text-red-900 mb-1">
                      السعر الافتراضي للتوصيل (DH)
                    </label>
                    <input
                      type="number"
                      step="0.5"
                      min="0"
                      required
                      value={deliveryFee}
                      onChange={e => setDeliveryFee(e.target.value)}
                      placeholder="30"
                      className="w-full text-xs font-mono font-bold bg-white border border-red-300 rounded-xl px-3.5 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-red-500"
                    />
                    <span className="text-[10px] text-slate-500 mt-0.5 block">
                      يتطبق على أي مدينة ما مبدلش ثمنها لتحت
                    </span>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      سعر الإرجاع (الروتور DH)
                    </label>
                    <input
                      type="number"
                      step="0.5"
                      min="0"
                      value={returnFee}
                      onChange={e => setReturnFee(e.target.value)}
                      placeholder="10"
                      className="w-full text-xs font-mono font-bold bg-white border border-slate-300 rounded-xl px-3.5 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-red-500"
                    />
                    <span className="text-[10px] text-slate-500 mt-0.5 block">في حالة إرجاع الطرد</span>
                  </div>
                </div>
              </div>

              {/* Section 4: ATTRIBUTION DES TARIFS (المدن لي كيمشي ليها + شحال حاسب التوصيل) */}
              <div className="p-4 bg-white border border-slate-200 rounded-2xl space-y-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block">
                      Attribution des tarifs
                    </span>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Sélectionnez les villes couvertes par ce partenaire et indiquez le prix qu&apos;il vous facture pour chacune.
                    </p>
                  </div>
                  <span className="px-2.5 py-1 rounded-lg bg-red-600 text-white text-xs font-extrabold font-mono shrink-0">
                    {selectedCityCount} sélectionné(s)
                  </span>
                </div>

                {/* Quick selection & bulk price helpers */}
                <div className="flex flex-wrap items-center gap-1.5">
                  <button
                    type="button"
                    onClick={selectAllFiltered}
                    className="px-2.5 py-1 text-[11px] font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition cursor-pointer"
                  >
                    + Tout sélectionner ({filteredTariffCities.length})
                  </button>
                  <button
                    type="button"
                    onClick={selectSouthCities}
                    className="px-2.5 py-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg transition cursor-pointer"
                  >
                    + Villes du Sud
                  </button>
                  {selectedCityCount > 0 && (
                    <>
                      <button
                        type="button"
                        onClick={applyDefaultPriceToSelected}
                        className="px-2.5 py-1 text-[11px] font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg transition cursor-pointer"
                      >
                        Appliquer {defaultFeeNum} DH aux sélectionnées
                      </button>
                      <button
                        type="button"
                        onClick={() => setCityTariffs({})}
                        className="px-2.5 py-1 text-[11px] font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg transition cursor-pointer"
                      >
                        Tout désélectionner
                      </button>
                    </>
                  )}
                </div>

                {/* City search */}
                <div className="relative">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    value={tariffSearch}
                    onChange={e => {
                      setTariffSearch(e.target.value);
                      setTariffPage(1);
                    }}
                    placeholder="Rechercher par ville ou zone..."
                    className="w-full text-xs bg-slate-50 border border-slate-300 rounded-xl pl-9 pr-3.5 py-2.5 text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-500"
                  />
                </div>

                {/* 2-Column Grid of Cities */}
                {paginatedTariffCities.length === 0 ? (
                  <div className="p-6 text-center text-xs text-slate-400 border border-dashed border-slate-200 rounded-xl">
                    Aucune ville trouvée pour « {tariffSearch} ».
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {paginatedTariffCities.map(c => {
                      const isSelected = Object.prototype.hasOwnProperty.call(cityTariffs, c.name);
                      const partnerPrice = isSelected ? cityTariffs[c.name] : defaultFeeNum;
                      return (
                        <div
                          key={c.id}
                          className={`p-2.5 rounded-xl border flex items-center justify-between gap-2 transition ${
                            isSelected
                              ? 'border-emerald-300 bg-emerald-50/40'
                              : 'border-slate-200 bg-white hover:border-slate-300'
                          }`}
                        >
                          <label className="flex items-center gap-2.5 min-w-0 cursor-pointer flex-1">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleCitySelection(c.name, defaultFeeNum)}
                              className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 shrink-0 cursor-pointer"
                            />
                            <div className="min-w-0">
                              <div className="text-xs font-bold text-slate-900 truncate">
                                {c.name} <span className="text-slate-400 font-normal">· {c.region}</span>
                              </div>
                              <div className="text-[10px] text-slate-500">
                                Client : {c.defaultFee} DH · Poids : 1
                              </div>
                            </div>
                          </label>

                          <div className="flex items-center gap-1 shrink-0">
                            <input
                              type="number"
                              step="0.5"
                              min="0"
                              value={partnerPrice}
                              onChange={e => setCityPrice(c.name, e.target.value)}
                              className={`w-18 px-2 py-1.5 text-xs font-mono font-bold rounded-lg border text-slate-900 focus:outline-none focus:ring-2 focus:ring-red-500 ${
                                isSelected
                                  ? 'bg-white border-emerald-300'
                                  : 'bg-slate-50 border-slate-200 text-slate-500'
                              }`}
                              title="Prix facturé par le partenaire pour cette ville (DH)"
                            />
                            <span className="text-[10px] font-bold text-slate-400">DH</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Pagination */}
                {totalTariffPages > 1 && (
                  <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                    <span className="text-[11px] text-slate-500">
                      Page {safeTariffPage} sur {totalTariffPages} ({filteredTariffCities.length} villes)
                    </span>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        disabled={safeTariffPage <= 1}
                        onClick={() => setTariffPage(p => Math.max(1, p - 1))}
                        className="w-7 h-7 flex items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100 disabled:opacity-40 cursor-pointer"
                      >
                        <ChevronLeft className="w-3.5 h-3.5" />
                      </button>
                      {Array.from({ length: totalTariffPages }, (_, idx) => idx + 1)
                        .filter(
                          pNum =>
                            pNum === 1 ||
                            pNum === totalTariffPages ||
                            Math.abs(pNum - safeTariffPage) <= 1
                        )
                        .map((pNum, i, arr) => (
                          <React.Fragment key={pNum}>
                            {i > 0 && arr[i - 1] !== pNum - 1 && (
                              <span className="px-1 text-xs text-slate-400">…</span>
                            )}
                            <button
                              type="button"
                              onClick={() => setTariffPage(pNum)}
                              className={`w-7 h-7 flex items-center justify-center rounded-lg text-xs font-bold cursor-pointer ${
                                pNum === safeTariffPage
                                  ? 'bg-red-600 text-white'
                                  : 'border border-slate-200 text-slate-700 hover:bg-slate-100'
                              }`}
                            >
                              {pNum}
                            </button>
                          </React.Fragment>
                        ))}
                      <button
                        type="button"
                        disabled={safeTariffPage >= totalTariffPages}
                        onClick={() => setTariffPage(p => Math.min(totalTariffPages, p + 1))}
                        className="w-7 h-7 flex items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100 disabled:opacity-40 cursor-pointer"
                      >
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Olivraison Quick API Preset when adding a partner */}
              {!editingPartner && (
                <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-xl space-y-2">
                  <label className="flex items-center justify-between cursor-pointer">
                    <div className="flex items-center gap-2 text-xs font-bold text-amber-950">
                      <Zap className="w-4 h-4 text-amber-600" />
                      <span>Connecter automatiquement avec Olivraison API</span>
                    </div>
                    <input
                      type="checkbox"
                      checked={useOlivraisonPreset}
                      onChange={e => {
                        const checked = e.target.checked;
                        setUseOlivraisonPreset(checked);
                        if (checked && !name.trim()) setName('Oliv');
                      }}
                      className="rounded text-red-600"
                    />
                  </label>
                  {useOlivraisonPreset && (
                    <div className="pt-1 space-y-1.5">
                      <span className="text-[10px] font-mono text-slate-600 block">
                        URL : {OLIVRAISON_BASE_URL} · Webhook auto-configuré
                      </span>
                      <input
                        type="password"
                        value={presetOlivraisonApiKey}
                        onChange={e => setPresetOlivraisonApiKey(e.target.value)}
                        placeholder="Collez votre Clé API Olivraison (Bearer Token)..."
                        className="w-full text-xs font-mono bg-white border border-amber-300 rounded-lg px-3 py-2 text-slate-900"
                      />
                    </div>
                  )}
                </div>
              )}

              <div className="pt-3 border-t border-slate-200 flex justify-end gap-2 sticky bottom-0 bg-slate-50/95 py-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddPartnerModal(false);
                    setEditingPartner(null);
                  }}
                  className="px-4 py-2 text-xs font-bold text-slate-600 bg-white border border-slate-300 hover:bg-slate-100 rounded-xl cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 text-xs font-bold text-white bg-red-600 hover:bg-red-700 rounded-xl shadow-xs cursor-pointer"
                >
                  {editingPartner ? 'Enregistrer' : 'Enregistrer le partenaire'}
                </button>
              </div>
            </form>
          </div>
        </div>
        );
      })()}

      {/* Inline External API / Olivraison Config Modal */}
      {apiConfigPartner && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs no-print">
          <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50">
              <div className="flex items-center gap-2">
                <Key className="w-4 h-4 text-red-600" />
                <h3 className="text-base font-bold text-slate-900">
                  Configurer l'API Externe — {apiConfigPartner.name}
                </h3>
              </div>
              <button
                onClick={() => setApiConfigPartner(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveInlineApiConfig} className="p-6 space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Fournisseur *</label>
                  <select
                    value={cfgAdapterType}
                    onChange={e => {
                      const next = e.target.value as PartnerApiAdapterType;
                      setCfgAdapterType(next);
                      if (next === 'olivraison') {
                        setCfgBaseUrl(OLIVRAISON_BASE_URL);
                      }
                    }}
                    className="w-full font-bold bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-900"
                  >
                    <option value="olivraison">Olivraison</option>
                    <option value="generic_rest">REST Générique</option>
                    <option value="amana_express">Amana Express</option>
                    <option value="chronopost_ctm">Chronopost CTM</option>
                    <option value="cathedis">Cathedis</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Expiration du jeton (optionnel)</label>
                  <input
                    type="datetime-local"
                    value={cfgTokenExpiresAt}
                    onChange={e => setCfgTokenExpiresAt(e.target.value)}
                    className="w-full font-mono bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-900"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">URL de base de l'API *</label>
                <input
                  type="url"
                  required
                  value={cfgBaseUrl}
                  onChange={e => setCfgBaseUrl(e.target.value)}
                  placeholder={OLIVRAISON_BASE_URL}
                  className="w-full font-mono bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-900"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Clé API (Bearer Token Olivraison) *</label>
                <div className="relative">
                  <input
                    type={cfgShowKeyPlain ? 'text' : 'password'}
                    value={cfgApiKey}
                    onChange={e => setCfgApiKey(e.target.value)}
                    placeholder="api-... ou jeton Bearer Olivraison"
                    className="w-full font-mono bg-slate-50 border border-slate-300 rounded-xl pl-3 pr-10 py-2 text-slate-900"
                  />
                  <button
                    type="button"
                    onClick={() => setCfgShowKeyPlain(!cfgShowKeyPlain)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    {cfgShowKeyPlain ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="flex flex-col gap-2 p-3 bg-slate-50 rounded-xl border border-slate-200">
                <label className="flex items-center gap-2 font-bold text-slate-800 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={cfgEnabled}
                    onChange={e => setCfgEnabled(e.target.checked)}
                    className="rounded text-red-600"
                  />
                  <span>Activer la connexion API externe</span>
                </label>

                <label className="flex items-center gap-2 font-bold text-slate-800 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={cfgAutoDispatch}
                    onChange={e => setCfgAutoDispatch(e.target.checked)}
                    className="rounded text-red-600"
                  />
                  <span>Envoi automatique activé (transmet dès le transfert partenaire)</span>
                </label>
              </div>

              <div className="pt-3 border-t flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setApiConfigPartner(null)}
                  className="px-4 py-2 font-bold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={isSavingApiConfig}
                  className="px-5 py-2.5 font-bold text-white bg-red-600 hover:bg-red-700 rounded-xl shadow-xs cursor-pointer disabled:opacity-50"
                >
                  {isSavingApiConfig ? 'Enregistrement...' : 'Enregistrer la configuration'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {partnerToDelete && (
        <ConfirmActionModal
          isOpen={true}
          title="Suppression Partenaire"
          message={`Êtes-vous certain de vouloir supprimer le partenaire ${partnerToDelete.name} ?`}
          confirmLabel="Confirmer la suppression"
          isDestructive={true}
          requireReason={true}
          onConfirm={handleConfirmDelete}
          onCancel={() => setPartnerToDelete(null)}
        />
      )}
    </div>
  );
};