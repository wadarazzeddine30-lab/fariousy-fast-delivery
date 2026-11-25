import React, { useState } from 'react';
import { useDatabase } from '../../context/DatabaseContext';
import { Partner, PartnerAuthType, PartnerApiAdapterType, PartnerSyncLog, PackageItem } from '../../types';
import { OLIVRAISON_BASE_URL } from '../../services/partnerAdapters';
import { directSupabaseRequest } from '../../services/supabaseDirectGateway';
import { formatMAD, formatDate } from '../../utils/barcode';
import { exportCSV } from '../../utils/export';
import { ConfirmActionModal } from '../common/ConfirmActionModal';
import {
  Network,
  Plus,
  ArrowRightLeft,
  Truck,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Clock,
  RefreshCw,
  Search,
  Filter,
  Download,
  Settings,
  ShieldCheck,
  Key,
  Globe,
  Radio,
  FileCode,
  Send,
  Inbox,
  Activity,
  Eye,
  EyeOff,
  Copy,
  Check,
  X,
  ExternalLink,
  Code2,
  Trash2,
  Terminal,
  Zap
} from 'lucide-react';

interface AdminApiPartnersProps {
  onViewPackage: (pkg: PackageItem) => void;
}

export const AdminApiPartners: React.FC<AdminApiPartnersProps> = ({ onViewPackage }) => {
  const {
    partners,
    packages,
    partnerSyncLogs,
    addPartner,
    updatePartner,
    deletePartner,
    testPartnerConnection,
    dispatchPackagesToPartner,
    syncPartnerStatuses,
    clearPartnerLogs
  } = useDatabase();

  const [activeTab, setActiveTab] = useState<'connections' | 'dispatch' | 'inbound' | 'sync' | 'logs'>('connections');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPartnerFilter, setSelectedPartnerFilter] = useState('all');

  // Modals state
  const [editingPartner, setEditingPartner] = useState<Partner | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [partnerToDelete, setPartnerToDelete] = useState<Partner | null>(null);
  const [inspectLog, setInspectLog] = useState<PartnerSyncLog | null>(null);

  // Connection testing state
  const [testingPartnerId, setTestingPartnerId] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{ id: string; success: boolean; message: string; latency?: number } | null>(null);

  // Dispatch state (Tab 2)
  const [dispatchPartnerId, setDispatchPartnerId] = useState<string>(partners[0]?.id || '');
  const [selectedPackageIds, setSelectedPackageIds] = useState<string[]>([]);
  const [forceResend, setForceResend] = useState(false);
  const [isDispatching, setIsDispatching] = useState(false);
  const [dispatchResults, setDispatchResults] = useState<{ success: boolean; sentCount: number; errors: string[] } | null>(null);
  const [dispatchSearch, setDispatchSearch] = useState('');

  // Status Sync state (Tab 4)
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncFeedback, setSyncFeedback] = useState<string | null>(null);

  // Partner Form State (for Add / Edit API modal)
  const [formName, setFormName] = useState('');
  const [formContact, setFormContact] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formCity, setFormCity] = useState('Casablanca');
  const [formNotes, setFormNotes] = useState('');
  const [formApiEnabled, setFormApiEnabled] = useState(true);
  const [formBaseUrl, setFormBaseUrl] = useState('https://api.partner.ma');
  const [formAuthType, setFormAuthType] = useState<PartnerAuthType>('api_key_header');
  const [formHeaderName, setFormHeaderName] = useState('X-API-KEY');
  const [formApiKey, setFormApiKey] = useState('');
  const [formUsername, setFormUsername] = useState('');
  const [formPassword, setFormPassword] = useState('');
  const [formAdapterType, setFormAdapterType] = useState<PartnerApiAdapterType>('generic_rest');
  const [formEndpointShipment, setFormEndpointShipment] = useState('/shipments');
  const [formEndpointTracking, setFormEndpointTracking] = useState('/tracking/:tracking');
  const [formEndpointSync, setFormEndpointSync] = useState('/status-updates');
  const [formWebhookSecret, setFormWebhookSecret] = useState('');
  const [formSyncFreq, setFormSyncFreq] = useState(30);
  const [formAutoSync, setFormAutoSync] = useState(true);
  const [showApiKeyPlain, setShowApiKeyPlain] = useState(false);
  const [copiedWebhookId, setCopiedWebhookId] = useState<string | null>(null);

  // Global KPIs calculation
  const totalApiPartners = partners.filter(p => p.apiConfig?.enabled).length;
  const totalSentAcrossPartners = partners.reduce((acc, p) => acc + (p.totalSent || 0), 0);
  const totalReceivedAcrossPartners = partners.reduce((acc, p) => acc + (p.totalReceived || 0), 0);
  const totalDeliveredAcrossPartners = partners.reduce((acc, p) => acc + (p.totalDelivered || 0), 0);
  const totalErrors = partnerSyncLogs.filter(l => l.status === 'error').length;

  const handleOpenAdd = () => {
    setFormName('');
    setFormContact('');
    setFormPhone('');
    setFormEmail('');
    setFormCity('Casablanca');
    setFormNotes('');
    setFormApiEnabled(true);
    setFormBaseUrl('https://api.partner.ma/v1');
    setFormAuthType('api_key_header');
    setFormHeaderName('X-API-KEY');
    setFormApiKey('sk_live_' + Math.random().toString(36).substring(2, 12));
    setFormUsername('');
    setFormPassword('');
    setFormAdapterType('generic_rest');
    setFormEndpointShipment('/shipments/create');
    setFormEndpointTracking('/tracking/:tracking');
    setFormEndpointSync('/shipments/status-updates');
    setFormWebhookSecret('whsec_' + Math.random().toString(36).substring(2, 10));
    setFormSyncFreq(30);
    setFormAutoSync(true);
    setShowAddModal(true);
  };

  const handleOpenEdit = (partner: Partner) => {
    setEditingPartner(partner);
    setFormName(partner.name);
    setFormContact(partner.contactPerson || '');
    setFormPhone(partner.phone);
    setFormEmail(partner.email || '');
    setFormCity(partner.city);
    setFormNotes(partner.notes || '');

    const config = partner.apiConfig;
    setFormApiEnabled(config?.enabled ?? true);
    setFormBaseUrl(config?.baseUrl || 'https://api.partner.ma/v1');
    setFormAuthType(config?.authType || 'api_key_header');
    setFormHeaderName(config?.headerName || 'X-API-KEY');
    setFormApiKey(config?.apiKey || '');
    setFormUsername(config?.username || '');
    setFormPassword(config?.password || '');
    setFormAdapterType(config?.adapterType || 'generic_rest');
    setFormEndpointShipment(config?.endpoints?.createShipment || '/shipments/create');
    setFormEndpointTracking(config?.endpoints?.getTracking || '/tracking/:tracking');
    setFormEndpointSync(config?.endpoints?.syncStatus || '/shipments/status-updates');
    setFormWebhookSecret(config?.webhookSecret || 'whsec_' + Math.random().toString(36).substring(2, 10));
    setFormSyncFreq(config?.syncFrequencyMinutes || 30);
    setFormAutoSync(config?.autoSync ?? true);
  };

  const handleAdapterChange = (nextAdapter: PartnerApiAdapterType) => {
    setFormAdapterType(nextAdapter);
    if (nextAdapter === 'olivraison') {
      setFormBaseUrl(OLIVRAISON_BASE_URL);
      setFormAuthType('bearer');
      setFormEndpointShipment('/api/v1/parcels');
      setFormEndpointTracking('/api/v1/parcels/:tracking');
      setFormEndpointSync('/api/v1/parcels/state');
      if (!formName.trim()) setFormName('Oliv');
    } else if (nextAdapter === 'generic_rest' && formBaseUrl === OLIVRAISON_BASE_URL) {
      setFormBaseUrl('https://api.partner.ma/v1');
      setFormEndpointShipment('/shipments/create');
      setFormEndpointTracking('/tracking/:tracking');
      setFormEndpointSync('/shipments/status-updates');
    }
  };

  const handleSaveAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName || !formPhone) {
      return;
    }

    const newPartner = addPartner({
      name: formName,
      contactPerson: formContact,
      phone: formPhone,
      email: formEmail,
      city: formCity,
      active: true,
      notes: formNotes,
      webhookToken: formWebhookSecret,
      apiConfig: {
        enabled: formApiEnabled,
        baseUrl: formBaseUrl,
        authType: formAuthType,
        headerName: formHeaderName,
        apiKey: formApiKey,
        username: formUsername,
        password: formPassword,
        adapterType: formAdapterType,
        endpoints: {
          createShipment: formEndpointShipment,
          getTracking: formEndpointTracking,
          syncStatus: formEndpointSync,
          webhookInbound: formAdapterType === 'olivraison' ? '/api/webhooks/olivraison' : '/api/webhooks/partners/inbound'
        },
        webhookSecret: formWebhookSecret,
        syncFrequencyMinutes: formSyncFreq,
        autoSync: formAutoSync,
        autoDispatch: formAdapterType === 'olivraison'
      },
      totalSent: 0,
      totalReceived: 0,
      totalDelivered: 0,
      totalReturned: 0,
      totalPending: 0,
      errorCount: 0
    });

    directSupabaseRequest('partners', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newPartner)
    }).catch(() => {});

    setShowAddModal(false);
  };

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPartner) return;

    const updatedConfig = {
      ...(editingPartner.apiConfig || {}),
      enabled: formApiEnabled,
      baseUrl: formBaseUrl,
      authType: formAuthType,
      headerName: formHeaderName,
      apiKey: formApiKey,
      username: formUsername,
      password: formPassword,
      adapterType: formAdapterType,
      endpoints: {
        createShipment: formEndpointShipment,
        getTracking: formEndpointTracking,
        syncStatus: formEndpointSync,
        webhookInbound:
          formAdapterType === 'olivraison'
            ? `/api/webhooks/olivraison/${editingPartner.id}`
            : `/api/webhooks/partners/${editingPartner.id}/inbound`
      },
      webhookSecret: formWebhookSecret,
      syncFrequencyMinutes: formSyncFreq,
      autoSync: formAutoSync
    };

    updatePartner(editingPartner.id, {
      name: formName,
      contactPerson: formContact,
      phone: formPhone,
      email: formEmail,
      city: formCity,
      notes: formNotes,
      apiConfig: updatedConfig
    });

    directSupabaseRequest(`partners/${encodeURIComponent(editingPartner.id)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: formName,
        contactPerson: formContact,
        phone: formPhone,
        email: formEmail,
        city: formCity,
        notes: formNotes,
        apiConfig: updatedConfig
      })
    }).catch(() => {});

    setEditingPartner(null);
  };

  const handleRunConnectionTest = async (partnerId: string) => {
    setTestingPartnerId(partnerId);
    setTestResult(null);
    try {
      const res = await testPartnerConnection(partnerId);
      setTestResult({
        id: partnerId,
        success: res.success,
        message: res.message,
        latency: res.latency
      });
    } catch {
      setTestResult({
        id: partnerId,
        success: false,
        message: 'Erreur inattendue lors du test de connectivité.'
      });
    } finally {
      setTestingPartnerId(null);
    }
  };

  const handleRunDispatch = async () => {
    if (!dispatchPartnerId) {
      alert('Veuillez sélectionner un partenaire API.');
      return;
    }
    if (selectedPackageIds.length === 0) {
      alert('Veuillez cocher au moins un colis à expédier.');
      return;
    }

    setIsDispatching(true);
    setDispatchResults(null);
    try {
      const res = await dispatchPackagesToPartner(dispatchPartnerId, selectedPackageIds, forceResend);
      setDispatchResults(res);
      if (res.success) {
        setSelectedPackageIds([]);
      }
    } catch (err: any) {
      alert(`Erreur d'expédition : ${err.message || 'Échec réseau'}`);
    } finally {
      setIsDispatching(false);
    }
  };

  const handleRunStatusSync = async (partnerId: string) => {
    setIsSyncing(true);
    setSyncFeedback(null);
    try {
      const res = await syncPartnerStatuses(partnerId);
      setSyncFeedback(`Synchronisation réussie : ${res.updatedCount} colis actualisé(s).`);
      setTimeout(() => setSyncFeedback(null), 4000);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleCopyWebhookUrl = (partnerId: string) => {
    const url = `${window.location.origin}/api/webhooks/partners/${partnerId}/inbound`;
    navigator.clipboard.writeText(url);
    setCopiedWebhookId(partnerId);
    setTimeout(() => setCopiedWebhookId(null), 2500);
  };

  const handleExportLogs = () => {
    const rows = partnerSyncLogs.map(l => ({
      ID: l.id,
      Date: l.timestamp,
      Partenaire: l.partnerName,
      Direction: l.direction,
      Statut: l.status,
      Code_HTTP: l.statusCode || 200,
      Endpoint: l.endpoint,
      Message: l.message,
      Latence_MS: l.durationMs || 0,
      Colis_Associes: (l.trackingNumbers || []).join(';')
    }));
    exportCSV(rows, `fariousy_api_sync_logs_${new Date().toISOString().substring(0, 10)}.csv`);
  };

  // Dispatchable packages (ready for dispatch)
  const dispatchablePackages = packages
    .filter(p => !p.driverId || p.status === 'en_stock' || p.status === 'nouveau' || p.status === 'en_transit')
    .filter(p =>
      dispatchSearch === '' ||
      p.trackingNumber.toLowerCase().includes(dispatchSearch.toLowerCase()) ||
      p.recipientName.toLowerCase().includes(dispatchSearch.toLowerCase()) ||
      p.city.toLowerCase().includes(dispatchSearch.toLowerCase())
    );

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 bg-red-600 text-white rounded-xl shadow-xs">
              <Network className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-black text-slate-900 tracking-tight">
                Intégration API Partenaires
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Passerelle REST bidirectionnelle, expédition, webhooks entrants et synchronisation des statuts
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => handleRunStatusSync(partners[0]?.id || '')}
            disabled={isSyncing}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-xl shadow-2xs transition-colors cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-blue-600 ${isSyncing ? 'animate-spin' : ''}`} />
            <span>Synchroniser Statuts</span>
          </button>

          <button
            onClick={handleOpenAdd}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-red-600 hover:bg-red-700 rounded-xl shadow-xs transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Nouveau Partenaire API</span>
          </button>
        </div>
      </div>

      {/* KPI Stats Overview */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Partenaires API</span>
          <div className="text-2xl font-black text-slate-900 mt-1">{totalApiPartners}</div>
          <span className="text-[10px] font-semibold text-emerald-600 mt-0.5 block">Actifs & Connectés</span>
        </div>

        <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Colis Expédiés</span>
          <div className="text-2xl font-black text-blue-600 mt-1">{totalSentAcrossPartners}</div>
          <span className="text-[10px] font-semibold text-slate-500 mt-0.5 block">Sortants vers partenaires</span>
        </div>

        <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Colis Reçus</span>
          <div className="text-2xl font-black text-emerald-600 mt-1">{totalReceivedAcrossPartners}</div>
          <span className="text-[10px] font-semibold text-slate-500 mt-0.5 block">Entrants via Webhooks</span>
        </div>

        <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Livrés Partenaires</span>
          <div className="text-2xl font-black text-emerald-700 mt-1">{totalDeliveredAcrossPartners}</div>
          <span className="text-[10px] font-semibold text-slate-500 mt-0.5 block">Succès confirmés</span>
        </div>

        <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Logs API</span>
          <div className="text-2xl font-black text-slate-900 mt-1">{partnerSyncLogs.length}</div>
          <span className="text-[10px] font-semibold text-blue-600 mt-0.5 block">Événements tracés</span>
        </div>

        <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Taux de Succès</span>
          <div className="text-2xl font-black text-emerald-600 mt-1">
            {partnerSyncLogs.length > 0
              ? `${Math.round(((partnerSyncLogs.length - totalErrors) / partnerSyncLogs.length) * 100)}%`
              : '100%'}
          </div>
          <span className="text-[10px] font-semibold text-slate-500 mt-0.5 block">{totalErrors} erreurs</span>
        </div>
      </div>

      {/* Main Tab Navigation */}
      <div className="flex border-b border-slate-200 overflow-x-auto gap-2 text-xs font-bold">
        <button
          onClick={() => setActiveTab('connections')}
          className={`pb-2.5 px-3 border-b-2 transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
            activeTab === 'connections'
              ? 'border-red-600 text-red-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Globe className="w-4 h-4" />
          <span>Partenaires & Connexions ({partners.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('dispatch')}
          className={`pb-2.5 px-3 border-b-2 transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
            activeTab === 'dispatch'
              ? 'border-red-600 text-red-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Send className="w-4 h-4" />
          <span>Envoi des Colis (API Sortante)</span>
        </button>

        <button
          onClick={() => setActiveTab('inbound')}
          className={`pb-2.5 px-3 border-b-2 transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
            activeTab === 'inbound'
              ? 'border-red-600 text-red-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Inbox className="w-4 h-4" />
          <span>Webhooks Entrants (API)</span>
        </button>

        <button
          onClick={() => setActiveTab('sync')}
          className={`pb-2.5 px-3 border-b-2 transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
            activeTab === 'sync'
              ? 'border-red-600 text-red-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Activity className="w-4 h-4" />
          <span>Synchronisation des Statuts</span>
        </button>

        <button
          onClick={() => setActiveTab('logs')}
          className={`pb-2.5 px-3 border-b-2 transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
            activeTab === 'logs'
              ? 'border-red-600 text-red-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Terminal className="w-4 h-4" />
          <span>Journaux & Audit API ({partnerSyncLogs.length})</span>
        </button>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: PARTENAIRES & CONNEXIONS API */}
      {/* ========================================================================= */}
      {activeTab === 'connections' && (
        <div className="space-y-4">
          {testResult && (
            <div
              className={`p-3.5 rounded-xl border text-xs font-bold flex items-center justify-between ${
                testResult.success
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                  : 'bg-rose-50 border-rose-200 text-rose-900'
              }`}
            >
              <div className="flex items-center gap-2">
                {testResult.success ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                ) : (
                  <XCircle className="w-4 h-4 text-rose-600 shrink-0" />
                )}
                <span>{testResult.message}</span>
              </div>
              <button
                onClick={() => setTestResult(null)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {partners.map(partner => {
              const config = partner.apiConfig;
              const isTesting = testingPartnerId === partner.id;

              return (
                <div
                  key={partner.id}
                  className="bg-white border border-slate-200 rounded-2xl p-5 shadow-2xs space-y-4 flex flex-col justify-between hover:border-slate-300 transition-all"
                >
                  <div>
                    {/* Header */}
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className="w-10 h-10 rounded-xl bg-red-50 text-red-600 flex items-center justify-center font-black text-sm">
                          <Network className="w-5 h-5" />
                        </div>
                        <div>
                          <h3 className="text-sm font-black text-slate-900">{partner.name}</h3>
                          <span className="text-[11px] text-slate-500 font-mono">Hub : {partner.city}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            config?.enabled
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {config?.enabled ? 'API Active' : 'API Inactive'}
                        </span>
                        <button
                          onClick={() => handleOpenEdit(partner)}
                          className="p-1 text-slate-400 hover:text-blue-600 rounded cursor-pointer"
                          title="Modifier configuration"
                        >
                          <Settings className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setPartnerToDelete(partner)}
                          className="p-1 text-slate-400 hover:text-rose-600 rounded cursor-pointer"
                          title="Supprimer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* API Connection Metadata */}
                    <div className="mt-3.5 p-3 bg-slate-50 rounded-xl text-xs space-y-1.5 text-slate-600">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] text-slate-400 font-semibold">Adaptateur :</span>
                        <span className="font-bold text-slate-900 bg-white px-2 py-0.5 rounded border border-slate-200 text-[10px]">
                          {config?.adapterType === 'olivraison'
                            ? 'Olivraison API'
                            : config?.adapterType === 'amana_express'
                            ? 'Amana Express API'
                            : config?.adapterType === 'chronopost_ctm'
                            ? 'Chronopost / CTM'
                            : config?.adapterType === 'cathedis'
                            ? 'Cathedis API'
                            : 'REST Générique'}
                        </span>
                      </div>

                      <div className="flex items-center justify-between">
                        <span className="text-[11px] text-slate-400 font-semibold">Authentification :</span>
                        <span className="font-mono text-slate-800 text-[11px]">
                          {config?.authType === 'bearer'
                            ? 'Bearer Token'
                            : config?.authType === 'api_key_header'
                            ? `Header (${config.headerName || 'X-API-KEY'})`
                            : config?.authType === 'basic'
                            ? 'HTTP Basic Auth'
                            : 'Aucune'}
                        </span>
                      </div>

                      <div>
                        <span className="text-[11px] text-slate-400 font-semibold block">URL Endpoint API :</span>
                        <span className="font-mono text-[11px] text-slate-800 truncate block mt-0.5">
                          {config?.baseUrl || 'https://api.partner.ma'}
                        </span>
                      </div>
                    </div>

                    {/* Performance & Sync Stats */}
                    <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
                      <div className="p-2 bg-slate-50 rounded-lg">
                        <span className="text-[9px] text-slate-400 uppercase font-bold block">Envoyés</span>
                        <span className="font-mono font-black text-blue-600">{partner.totalSent || 0}</span>
                      </div>
                      <div className="p-2 bg-slate-50 rounded-lg">
                        <span className="text-[9px] text-slate-400 uppercase font-bold block">Reçus</span>
                        <span className="font-mono font-black text-emerald-600">{partner.totalReceived || 0}</span>
                      </div>
                      <div className="p-2 bg-slate-50 rounded-lg">
                        <span className="text-[9px] text-slate-400 uppercase font-bold block">Livrés</span>
                        <span className="font-mono font-black text-emerald-700">{partner.totalDelivered || 0}</span>
                      </div>
                    </div>

                    {/* Last test status */}
                    <div className="mt-3 flex items-center justify-between text-[11px]">
                      <span className="text-slate-400">Dernier test :</span>
                      {config?.lastTestedAt ? (
                        <span className="flex items-center gap-1 font-semibold text-slate-700">
                          {config.lastTestStatus === 'success' ? (
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                          ) : (
                            <XCircle className="w-3 h-3 text-rose-600" />
                          )}
                          <span>{config.lastTestedAt} ({config.lastTestLatencyMs || 80}ms)</span>
                        </span>
                      ) : (
                        <span className="text-slate-400 italic">Non testé</span>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="pt-3 border-t border-slate-100 flex items-center gap-2">
                    <button
                      onClick={() => handleRunConnectionTest(partner.id)}
                      disabled={isTesting}
                      className="flex-1 py-2 text-xs font-bold text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                    >
                      <Radio className={`w-3.5 h-3.5 text-red-600 ${isTesting ? 'animate-pulse' : ''}`} />
                      <span>{isTesting ? 'Test en cours...' : 'Tester Connexion API'}</span>
                    </button>

                    <button
                      onClick={() => handleOpenEdit(partner)}
                      className="px-3.5 py-2 text-xs font-bold text-red-600 bg-red-50 hover:bg-red-100 rounded-xl transition-colors cursor-pointer"
                    >
                      Configurer
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: ENVOI DES COLIS (API SORTANTE) */}
      {/* ========================================================================= */}
      {activeTab === 'dispatch' && (
        <div className="space-y-4">
          {dispatchResults && (
            <div
              className={`p-4 rounded-xl border text-xs font-bold ${
                dispatchResults.success
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                  : 'bg-rose-50 border-rose-200 text-rose-900'
              }`}
            >
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>
                  {dispatchResults.sentCount} colis expédié(s) avec succès via l'API du partenaire !
                </span>
              </div>
              {dispatchResults.errors && dispatchResults.errors.length > 0 && (
                <ul className="mt-2 text-[11px] list-disc list-inside text-rose-800">
                  {dispatchResults.errors.map((e, idx) => (
                    <li key={idx}>{e}</li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {/* Action Header Card */}
          <div className="p-4 bg-slate-900 text-white rounded-2xl shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                Passerelle d'Expédition API Partenaire
              </span>
              <h3 className="text-sm font-bold text-white">
                Sélectionnez les colis à confier au réseau d'un transporteur partenaire
              </h3>
              <p className="text-xs text-slate-400">
                L'API partenaire recevra le payload normalisé et retournera un numéro de suivi officiel.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {/* Partner selector */}
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-300">Partenaire :</span>
                <select
                  value={dispatchPartnerId}
                  onChange={e => setDispatchPartnerId(e.target.value)}
                  className="bg-slate-800 text-white text-xs font-bold px-3 py-2 rounded-xl border border-slate-700 focus:outline-hidden focus:ring-2 focus:ring-red-500"
                >
                  {partners.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.city})
                    </option>
                  ))}
                </select>
              </div>

              {/* Force resend toggle (anti-duplicate control) */}
              <label className="flex items-center gap-2 text-xs font-semibold text-slate-300 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={forceResend}
                  onChange={e => setForceResend(e.target.checked)}
                  className="rounded text-red-600 focus:ring-red-500"
                />
                <span>Autoriser ré-envoi</span>
              </label>

              <button
                onClick={handleRunDispatch}
                disabled={isDispatching || selectedPackageIds.length === 0}
                className="px-5 py-2.5 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white text-xs font-bold rounded-xl shadow-xs flex items-center gap-2 transition-colors cursor-pointer"
              >
                <Send className="w-3.5 h-3.5" />
                <span>
                  {isDispatching
                    ? 'Transmission en cours...'
                    : `Expédier via API (${selectedPackageIds.length})`}
                </span>
              </button>
            </div>
          </div>

          {/* Search & Selection Controls */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-3 rounded-2xl border border-slate-200">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Filtrer colis par N°, destinataire, ville..."
                value={dispatchSearch}
                onChange={e => setDispatchSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-red-500"
              />
            </div>

            <div className="flex items-center gap-2 text-xs font-bold text-slate-600">
              <button
                onClick={() => setSelectedPackageIds(dispatchablePackages.map(p => p.id))}
                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 rounded-lg cursor-pointer"
              >
                Tout sélectionner ({dispatchablePackages.length})
              </button>
              <button
                onClick={() => setSelectedPackageIds([])}
                className="px-3 py-1.5 text-slate-500 hover:text-slate-800 cursor-pointer"
              >
                Désélectionner
              </button>
            </div>
          </div>

          {/* Parcels Table */}
          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-2xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-4 w-10">
                      <input
                        type="checkbox"
                        checked={
                          selectedPackageIds.length > 0 &&
                          selectedPackageIds.length === dispatchablePackages.length
                        }
                        onChange={e => {
                          if (e.target.checked) {
                            setSelectedPackageIds(dispatchablePackages.map(p => p.id));
                          } else {
                            setSelectedPackageIds([]);
                          }
                        }}
                        className="rounded text-red-600"
                      />
                    </th>
                    <th className="py-3 px-4">N° Suivi Fariousy</th>
                    <th className="py-3 px-4">Destinataire</th>
                    <th className="py-3 px-4">Ville & Adresse</th>
                    <th className="py-3 px-4 text-right">Montant COD</th>
                    <th className="py-3 px-4">Statut Partenaire</th>
                    <th className="py-3 px-4">N° Suivi Partenaire</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {dispatchablePackages.map(pkg => {
                    const isSelected = selectedPackageIds.includes(pkg.id);
                    const alreadySent = Boolean(pkg.partnerTrackingNumber);

                    return (
                      <tr
                        key={pkg.id}
                        onClick={() => {
                          setSelectedPackageIds(prev =>
                            prev.includes(pkg.id) ? prev.filter(id => id !== pkg.id) : [...prev, pkg.id]
                          );
                        }}
                        className={`hover:bg-slate-50 cursor-pointer transition-colors ${
                          isSelected ? 'bg-red-50/50' : ''
                        }`}
                      >
                        <td className="py-3 px-4">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => {}} // handled by row click
                            className="rounded text-red-600"
                          />
                        </td>
                        <td className="py-3 px-4 font-mono font-bold text-slate-900">
                          {pkg.trackingNumber}
                        </td>
                        <td className="py-3 px-4 font-medium text-slate-800">
                          <div>{pkg.recipientName}</div>
                          <span className="text-[11px] font-mono text-slate-400">{pkg.recipientPhone}</span>
                        </td>
                        <td className="py-3 px-4 text-slate-600 max-w-xs truncate">
                          <span className="font-bold text-red-600">{pkg.city}</span> — {pkg.address}
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-black text-slate-900">
                          {formatMAD(pkg.codAmount)}
                        </td>
                        <td className="py-3 px-4">
                          {alreadySent ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800 flex items-center gap-1 w-max">
                              <CheckCircle2 className="w-3 h-3 text-blue-600" />
                              <span>{pkg.partnerName || 'Partenaire'} (Transmis)</span>
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600 w-max block">
                              Prêt pour expédition
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 font-mono font-bold text-slate-800">
                          {pkg.partnerTrackingNumber || (
                            <span className="text-slate-400 font-normal italic text-[11px]">Non attribué</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                  {dispatchablePackages.length === 0 && (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-slate-400">
                        Aucun colis disponible pour expédition partenaire.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: WEBHOOKS ENTRANTS (API) */}
      {/* ========================================================================= */}
      {activeTab === 'inbound' && (
        <div className="space-y-5">
          {/* Webhook URLs for Partners */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-2xs space-y-4">
            <div>
              <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                <Code2 className="w-4 h-4 text-red-600" />
                <span>Endpoints Webhook d'Ingestion pour vos Partenaires</span>
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Communiquez cette URL à l'équipe technique de chaque partenaire pour qu'ils injectent automatiquement leurs colis entrants dans votre réseau Fariousy Delivery.
              </p>
            </div>

            {partners.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-500 bg-slate-50 border border-dashed border-slate-300 rounded-xl">
                Aucun partenaire configuré pour le moment. Ajoutez un partenaire dans l'onglet « Partenaires & Connexions » pour générer son endpoint webhook.
              </div>
            ) : (
              <div className="space-y-3">
                {partners.map(partner => {
                  const isOlivraison = partner.apiConfig?.adapterType === 'olivraison';
                  const webhookUrl = isOlivraison
                    ? `${window.location.origin}/api/webhooks/olivraison/${partner.id}`
                    : `${window.location.origin}/api/webhooks/partners/${partner.id}/inbound`;
                  const isCopied = copiedWebhookId === partner.id;

                  return (
                    <div
                      key={partner.id}
                      className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-900">{partner.name}</span>
                          {isOlivraison && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800">
                              Olivraison Webhook (Bearer)
                            </span>
                          )}
                          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-200 text-slate-700">
                            POST
                          </span>
                        </div>
                        <div className="font-mono text-slate-600 text-[11px] mt-1 break-all bg-white px-2 py-1 rounded border border-slate-200">
                          {webhookUrl}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(webhookUrl);
                            setCopiedWebhookId(partner.id);
                            setTimeout(() => setCopiedWebhookId(null), 2500);
                          }}
                          className="px-3 py-1.5 bg-white border border-slate-300 hover:bg-slate-100 font-bold text-slate-700 rounded-lg flex items-center gap-1 transition-colors cursor-pointer"
                        >
                          {isCopied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                          <span>{isCopied ? 'Copié !' : 'Copier URL'}</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 4: SYNCHRONISATION DES STATUTS */}
      {/* ========================================================================= */}
      {activeTab === 'sync' && (
        <div className="space-y-5">
          {syncFeedback && (
            <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-xl text-xs font-bold flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{syncFeedback}</span>
            </div>
          )}

          {/* Sync status overview */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-2xs space-y-4">
            <div>
              <h3 className="text-sm font-black text-slate-900">
                Statuts Pris en Charge & Synchronisation Bidirectionnelle
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                La passerelle assure la correspondance automatique entre les statuts Fariousy et les statuts des systèmes partenaires.
              </p>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2 text-center text-xs">
              <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl">
                <span className="font-bold text-slate-900 block text-xs">Nouveau</span>
                <span className="text-[10px] text-slate-400 font-mono mt-0.5 block">NEW / CREATED</span>
              </div>
              <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-xl">
                <span className="font-bold text-amber-900 block text-xs">En Stock / Hub</span>
                <span className="text-[10px] text-amber-700 font-mono mt-0.5 block">DEPOT / HUB</span>
              </div>
              <div className="p-2.5 bg-blue-50 border border-blue-200 rounded-xl">
                <span className="font-bold text-blue-900 block text-xs">En Transit</span>
                <span className="text-[10px] text-blue-700 font-mono mt-0.5 block">TRANSIT / LIGNE</span>
              </div>
              <div className="p-2.5 bg-orange-50 border border-orange-200 rounded-xl">
                <span className="font-bold text-orange-900 block text-xs">En Livraison</span>
                <span className="text-[10px] text-orange-700 font-mono mt-0.5 block">OUT_FOR_DELIV</span>
              </div>
              <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl">
                <span className="font-bold text-emerald-900 block text-xs">Livré</span>
                <span className="text-[10px] text-emerald-700 font-mono mt-0.5 block">DELIVERED</span>
              </div>
              <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-xl">
                <span className="font-bold text-rose-900 block text-xs">Refusé</span>
                <span className="text-[10px] text-rose-700 font-mono mt-0.5 block">REFUSED</span>
              </div>
              <div className="p-2.5 bg-purple-50 border border-purple-200 rounded-xl">
                <span className="font-bold text-purple-900 block text-xs">Retourné</span>
                <span className="text-[10px] text-purple-700 font-mono mt-0.5 block">RETURNED</span>
              </div>
            </div>
          </div>

          {/* Partner sync controls */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-2xs space-y-3">
            <h3 className="text-sm font-black text-slate-900">Synchronisation Active par Partenaire</h3>

            <div className="divide-y divide-slate-100">
              {partners.map(partner => {
                const partnerParcels = packages.filter(p => p.partnerId === partner.id);
                const inTransitCount = partnerParcels.filter(p => p.status === 'en_transit' || p.status === 'en_cours_livraison').length;

                return (
                  <div key={partner.id} className="py-3 flex items-center justify-between text-xs">
                    <div>
                      <div className="font-bold text-slate-900">{partner.name}</div>
                      <div className="text-[11px] text-slate-500">
                        {partnerParcels.length} colis associés • {inTransitCount} en cours d'acheminement
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-[11px] text-slate-400 font-mono">
                        Dernière sync : {partner.apiConfig?.lastSyncedAt || 'Aujourd\'hui'}
                      </span>
                      <button
                        onClick={() => handleRunStatusSync(partner.id)}
                        disabled={isSyncing}
                        className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 font-bold rounded-lg flex items-center gap-1 cursor-pointer disabled:opacity-50"
                      >
                        <RefreshCw className={`w-3 h-3 ${isSyncing ? 'animate-spin' : ''}`} />
                        <span>Synchroniser</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 5: JOURNAUX & AUDIT API */}
      {/* ========================================================================= */}
      {activeTab === 'logs' && (
        <div className="space-y-4">
          {/* Controls Bar */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-3 rounded-2xl border border-slate-200">
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <select
                value={selectedPartnerFilter}
                onChange={e => setSelectedPartnerFilter(e.target.value)}
                className="text-xs font-semibold px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl"
              >
                <option value="all">Tous les partenaires ({partners.length})</option>
                {partners.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleExportLogs}
                className="px-3 py-1.5 text-xs font-bold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-xl flex items-center gap-1.5 cursor-pointer shadow-2xs"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Exporter CSV</span>
              </button>

              <button
                onClick={() => {
                  if (confirm('Voulez-vous vider tous les journaux de synchronisation ?')) {
                    clearPartnerLogs();
                  }
                }}
                className="px-3 py-1.5 text-xs font-bold text-rose-600 bg-rose-50 hover:bg-rose-100 rounded-xl cursor-pointer"
              >
                Vider les logs
              </button>
            </div>
          </div>

          {/* Logs Table */}
          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-2xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                  <tr>
                    <th className="py-2.5 px-3">Horodatage</th>
                    <th className="py-2.5 px-3">Partenaire</th>
                    <th className="py-2.5 px-3">Direction & Action</th>
                    <th className="py-2.5 px-3">Statut HTTP</th>
                    <th className="py-2.5 px-3">Endpoint</th>
                    <th className="py-2.5 px-3">Message</th>
                    <th className="py-2.5 px-3 text-right">Payload</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {partnerSyncLogs
                    .filter(l => selectedPartnerFilter === 'all' || l.partnerId === selectedPartnerFilter)
                    .map(log => {
                      const isSuccess = log.status === 'success';

                      return (
                        <tr key={log.id} className="hover:bg-slate-50 font-medium">
                          <td className="py-2.5 px-3 font-mono text-slate-500 whitespace-nowrap">
                            {log.timestamp}
                          </td>
                          <td className="py-2.5 px-3 font-bold text-slate-900">{log.partnerName}</td>
                          <td className="py-2.5 px-3">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                log.direction === 'outbound_send'
                                  ? 'bg-blue-100 text-blue-800'
                                  : log.direction === 'inbound_receive'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : log.direction === 'status_sync'
                                  ? 'bg-purple-100 text-purple-800'
                                  : 'bg-amber-100 text-amber-800'
                              }`}
                            >
                              {log.direction === 'outbound_send'
                                ? 'Envoi Colis'
                                : log.direction === 'inbound_receive'
                                ? 'Réception Webhook'
                                : log.direction === 'status_sync'
                                ? 'Sync Statuts'
                                : 'Test Connexion'}
                            </span>
                          </td>
                          <td className="py-2.5 px-3">
                            <span
                              className={`font-mono font-bold text-[11px] ${
                                isSuccess ? 'text-emerald-600' : 'text-rose-600'
                              }`}
                            >
                              HTTP {log.statusCode || 200}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 font-mono text-[11px] text-slate-600 truncate max-w-xs">
                            {log.endpoint}
                          </td>
                          <td className="py-2.5 px-3 text-slate-800 max-w-sm truncate">{log.message}</td>
                          <td className="py-2.5 px-3 text-right">
                            <button
                              onClick={() => setInspectLog(log)}
                              className="px-2 py-1 text-[11px] font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg cursor-pointer"
                            >
                              Inspecter
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  {partnerSyncLogs.length === 0 && (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-slate-400">
                        Aucun journal de synchronisation pour le moment.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: ADD / EDIT PARTNER API */}
      {/* ========================================================================= */}
      {(showAddModal || editingPartner) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50">
              <div className="flex items-center gap-2">
                <Network className="w-5 h-5 text-red-600" />
                <h3 className="text-base font-black text-slate-900">
                  {editingPartner
                    ? `Configurer l'API Partenaire — ${editingPartner.name}`
                    : 'Nouveau Partenaire API'}
                </h3>
              </div>
              <button
                onClick={() => {
                  setShowAddModal(false);
                  setEditingPartner(null);
                }}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={editingPartner ? handleSaveEdit : handleSaveAdd} className="p-6 overflow-y-auto space-y-4">
              {/* Partner Basic Info */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Nom du Partenaire *</label>
                  <input
                    type="text"
                    required
                    value={formName}
                    onChange={e => setFormName(e.target.value)}
                    placeholder="Ex: Amana Express"
                    className="w-full text-xs bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-900"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Responsable / Contact</label>
                  <input
                    type="text"
                    value={formContact}
                    onChange={e => setFormContact(e.target.value)}
                    placeholder="Ex: Direction Opérations"
                    className="w-full text-xs bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-900"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Téléphone *</label>
                  <input
                    type="tel"
                    required
                    value={formPhone}
                    onChange={e => setFormPhone(e.target.value)}
                    placeholder="+212 522 00 00 00"
                    className="w-full text-xs font-mono bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-900"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Email technique</label>
                  <input
                    type="email"
                    value={formEmail}
                    onChange={e => setFormEmail(e.target.value)}
                    placeholder="api@partenaire.ma"
                    className="w-full text-xs bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-900"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Ville principale</label>
                  <input
                    type="text"
                    value={formCity}
                    onChange={e => setFormCity(e.target.value)}
                    className="w-full text-xs bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-900"
                  />
                </div>
              </div>

              {/* API Configuration Box */}
              <div className="pt-3 border-t border-slate-200 bg-red-50/40 p-4 rounded-xl border border-red-200/80 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <Key className="w-4 h-4 text-red-600" />
                    <span className="text-xs font-black text-slate-900 uppercase tracking-wide">
                      Paramètres de Connexion API REST
                    </span>
                  </div>
                  <label className="flex items-center gap-1.5 text-xs font-bold text-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formApiEnabled}
                      onChange={e => setFormApiEnabled(e.target.checked)}
                      className="rounded text-red-600"
                    />
                    <span>Activer cette API</span>
                  </label>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      URL de Base de l'API *
                    </label>
                    <input
                      type="url"
                      required
                      value={formBaseUrl}
                      onChange={e => setFormBaseUrl(e.target.value)}
                      placeholder="https://api.partenaire.ma/v1"
                      className="w-full text-xs font-mono bg-white border border-slate-300 rounded-xl px-3 py-2 text-slate-900"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      Adaptateur Logistique *
                    </label>
                    <select
                      value={formAdapterType}
                      onChange={e => handleAdapterChange(e.target.value as PartnerApiAdapterType)}
                      className="w-full text-xs font-bold bg-white border border-slate-300 rounded-xl px-3 py-2 text-slate-900"
                    >
                      <option value="olivraison">Olivraison Partners API (partners.olivraison.com)</option>
                      <option value="generic_rest">REST Générique Configurable</option>
                      <option value="amana_express">Amana Express / Poste Maroc</option>
                      <option value="chronopost_ctm">Chronopost Maroc / CTM Messagerie</option>
                      <option value="cathedis">Cathedis Logistics</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      Méthode d'Authentification *
                    </label>
                    <select
                      value={formAuthType}
                      onChange={e => setFormAuthType(e.target.value as any)}
                      className="w-full text-xs bg-white border border-slate-300 rounded-xl px-3 py-2 text-slate-900 font-semibold"
                    >
                      <option value="api_key_header">Header API Key (ex: X-API-KEY)</option>
                      <option value="bearer">Bearer Token (Authorization: Bearer)</option>
                      <option value="basic">HTTP Basic Authentication</option>
                      <option value="none">Aucune (Public ou IP autorisée)</option>
                    </select>
                  </div>

                  {formAuthType === 'api_key_header' && (
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">Nom du Header</label>
                      <input
                        type="text"
                        value={formHeaderName}
                        onChange={e => setFormHeaderName(e.target.value)}
                        placeholder="X-API-KEY ou apikey"
                        className="w-full text-xs font-mono bg-white border border-slate-300 rounded-xl px-3 py-2 text-slate-900"
                      />
                    </div>
                  )}
                </div>

                {/* API Key Input with Show/Hide toggle */}
                {formAuthType !== 'none' && formAuthType !== 'basic' && (
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      Clé d'API / Secret Token (Stocké côté serveur) *
                    </label>
                    <div className="relative">
                      <input
                        type={showApiKeyPlain ? 'text' : 'password'}
                        value={formApiKey}
                        onChange={e => setFormApiKey(e.target.value)}
                        placeholder="sk_live_••••••••••••••••"
                        className="w-full text-xs font-mono bg-white border border-slate-300 rounded-xl pl-3 pr-10 py-2 text-slate-900"
                      />
                      <button
                        type="button"
                        onClick={() => setShowApiKeyPlain(!showApiKeyPlain)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                      >
                        {showApiKeyPlain ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                )}

                {formAuthType === 'basic' && (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">Nom d'utilisateur</label>
                      <input
                        type="text"
                        value={formUsername}
                        onChange={e => setFormUsername(e.target.value)}
                        className="w-full text-xs bg-white border border-slate-300 rounded-xl px-3 py-2 text-slate-900"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">Mot de passe</label>
                      <input
                        type="password"
                        value={formPassword}
                        onChange={e => setFormPassword(e.target.value)}
                        className="w-full text-xs bg-white border border-slate-300 rounded-xl px-3 py-2 text-slate-900"
                      />
                    </div>
                  </div>
                )}

                {/* Endpoints specification */}
                <div className="grid grid-cols-3 gap-2 pt-2 border-t border-red-200/60">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-600 mb-0.5">Endpoint Envoi</label>
                    <input
                      type="text"
                      value={formEndpointShipment}
                      onChange={e => setFormEndpointShipment(e.target.value)}
                      className="w-full text-[11px] font-mono bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-slate-900"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-600 mb-0.5">Endpoint Suivi</label>
                    <input
                      type="text"
                      value={formEndpointTracking}
                      onChange={e => setFormEndpointTracking(e.target.value)}
                      className="w-full text-[11px] font-mono bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-slate-900"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-600 mb-0.5">Endpoint Statuts</label>
                    <input
                      type="text"
                      value={formEndpointSync}
                      onChange={e => setFormEndpointSync(e.target.value)}
                      className="w-full text-[11px] font-mono bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-slate-900"
                    />
                  </div>
                </div>
              </div>

              <div className="pt-3 border-t flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddModal(false);
                    setEditingPartner(null);
                  }}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 text-xs font-bold text-white bg-red-600 hover:bg-red-700 rounded-xl shadow-xs cursor-pointer"
                >
                  Enregistrer les paramètres API
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: INSPECT LOG PAYLOAD */}
      {/* ========================================================================= */}
      {inspectLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50">
              <div className="flex items-center gap-2">
                <Terminal className="w-5 h-5 text-slate-700" />
                <div>
                  <h3 className="text-sm font-black text-slate-900">
                    Détail du Log API — {inspectLog.partnerName}
                  </h3>
                  <span className="text-[11px] font-mono text-slate-500">{inspectLog.timestamp}</span>
                </div>
              </div>
              <button
                onClick={() => setInspectLog(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200">
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-bold block">Action</span>
                  <span className="font-bold text-slate-900">{inspectLog.direction}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-bold block">Code HTTP</span>
                  <span className="font-mono font-bold text-emerald-600">{inspectLog.statusCode || 200}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-bold block">Endpoint</span>
                  <span className="font-mono text-slate-800 break-all">{inspectLog.endpoint}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-bold block">Durée</span>
                  <span className="font-mono text-slate-800">{inspectLog.durationMs || 100} ms</span>
                </div>
              </div>

              <div>
                <span className="text-xs font-bold text-slate-800 block mb-1">Message d'exécution :</span>
                <p className="p-3 bg-slate-50 rounded-xl text-slate-700 border border-slate-200">
                  {inspectLog.message}
                </p>
              </div>

              {inspectLog.requestPayloadPreview && (
                <div>
                  <span className="text-xs font-bold text-slate-800 block mb-1">Payload Requête (JSON Sanitisé) :</span>
                  <pre className="p-3 bg-slate-900 text-emerald-400 rounded-xl font-mono text-[11px] overflow-x-auto">
                    {inspectLog.requestPayloadPreview}
                  </pre>
                </div>
              )}

              {inspectLog.responsePayloadPreview && (
                <div>
                  <span className="text-xs font-bold text-slate-800 block mb-1">Réponse Partenaire (JSON Sanitisé) :</span>
                  <pre className="p-3 bg-slate-900 text-blue-400 rounded-xl font-mono text-[11px] overflow-x-auto">
                    {inspectLog.responsePayloadPreview}
                  </pre>
                </div>
              )}
            </div>

            <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-end">
              <button
                onClick={() => setInspectLog(null)}
                className="px-4 py-2 text-xs font-bold text-slate-700 bg-white border border-slate-300 rounded-xl cursor-pointer"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: DELETE PARTNER CONFIRMATION */}
      {partnerToDelete && (
        <ConfirmActionModal
          isOpen={true}
          title="Suppression Partenaire API"
          message={`Êtes-vous sûr de vouloir supprimer le partenaire ${partnerToDelete.name} ? Ses logs historiques seront conservés.`}
          confirmLabel="Supprimer définitivement"
          isDestructive={true}
          onConfirm={() => {
            deletePartner(partnerToDelete.id);
            setPartnerToDelete(null);
          }}
          onCancel={() => setPartnerToDelete(null)}
        />
      )}
    </div>
  );
};
