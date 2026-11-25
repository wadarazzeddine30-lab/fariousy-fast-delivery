import React, { useState } from 'react';
import { useDatabase } from '../../context/DatabaseContext';
import { useAuth } from '../../context/AuthContext';
import { UserRole, UserProfile } from '../../types';
import { formatMAD, formatDate } from '../../utils/barcode';
import { exportCSV } from '../../utils/export';
import {
  fetchSecurityOverviewDirect,
  changeSuperAdminPasswordDirect,
  updateSecuritySettingsDirect,
  revokeOtherSessionsDirect,
  deletePrivilegedUserDirect
} from '../../services/supabaseDirectGateway';
import {
  Settings,
  Shield,
  Users,
  Building,
  Clock,
  Tag,
  ListOrdered,
  History,
  Save,
  CheckCircle2,
  AlertCircle,
  Search,
  Download,
  Filter,
  UserPlus,
  Lock,
  Unlock,
  KeyRound,
  Trash2,
  FileSpreadsheet,
  Check,
  AlertTriangle,
  Upload,
  HardDriveDownload,
  MessageCircle,
  Send,
  Eye,
  EyeOff,
  Key,
  Smartphone,
  LogOut,
  UserX,
  ShieldAlert,
  RefreshCw,
  CheckSquare
} from 'lucide-react';

interface SecurityOverviewData {
  isDefaultAdminPassword: boolean;
  securitySettings: {
    requireAdminApprovalForClients: boolean;
    allowPublicClientRegistration: boolean;
    allowPublicDriverRegistration: boolean;
    updatedAt?: string;
  };
  activeSessions: {
    sessionId: string;
    tokenPreview: string;
    userId: string;
    name: string;
    email: string;
    role: string;
    createdAt?: string;
    expiresAt: number;
    ip?: string;
    userAgent?: string;
    isCurrent: boolean;
  }[];
  privilegedUsers: {
    id: string;
    name: string;
    email: string;
    role: string;
    status: string;
    phone?: string;
    source: string;
    isOwner: boolean;
    registeredAt?: string;
  }[];
  counts: {
    superAdmins: number;
    privilegedAccounts: number;
    activeSessions: number;
    totalShops: number;
    approvedClients: number;
    pendingClients: number;
    suspendedClients: number;
    totalPackages: number;
  };
}

export const AdminSettings: React.FC = () => {
  const {
    packages,
    pickups,
    payments,
    users,
    companySettings,
    updateCompanySettings,
    auditLogs,
    clearAuditLogs,
    updateUserPermissions,
    addClient,
    toggleEmployeeStatus,
    wipeSystemData,
    exportSystemBackup,
    restoreSystemBackup,
    whatsappLogs,
    testWhatsappWebhook,
    clearWhatsappLogs
  } = useDatabase();
  const { currentUser, isSuperAdmin } = useAuth();

  const [activeSubTab, setActiveSubTab] = useState<
    'super_admin_reset' | 'company' | 'users' | 'permissions' | 'tarifs_delais' | 'statuses' | 'audit'
  >('super_admin_reset');

  const [isWiping, setIsWiping] = useState(false);
  const [wipeSuccessMsg, setWipeSuccessMsg] = useState('');
  const [wipeErrorMsg, setWipeErrorMsg] = useState('');
  const [showWipeConfirmModal, setShowWipeConfirmModal] = useState(false);

  // Super Admin Security & Total Control State
  const [securityOverview, setSecurityOverview] = useState<SecurityOverviewData | null>(null);
  const [securityLoading, setSecurityLoading] = useState(false);
  const [securityBanner, setSecurityBanner] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [currentPasswordInput, setCurrentPasswordInput] = useState('');
  const [newPasswordInput, setNewPasswordInput] = useState('');
  const [confirmPasswordInput, setConfirmPasswordInput] = useState('');
  const [revokeOtherSessionsOnPwChange, setRevokeOtherSessionsOnPwChange] = useState(true);
  const [changingPassword, setChangingPassword] = useState(false);
  const [showPasswords, setShowPasswords] = useState(false);
  const [savingSecuritySettings, setSavingSecuritySettings] = useState(false);
  const [revokingSessionId, setRevokingSessionId] = useState<string | null>(null);
  const [revokingAllSessions, setRevokingAllSessions] = useState(false);
  const [confirmDeletePrivId, setConfirmDeletePrivId] = useState<string | null>(null);
  const [deletingPrivId, setDeletingPrivId] = useState<string | null>(null);
  const [confirmClearAudit, setConfirmClearAudit] = useState(false);
  const [userActionBanner, setUserActionBanner] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Full System Backup & Restore State
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [backupBanner, setBackupBanner] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [pendingRestorePayload, setPendingRestorePayload] = useState<{
    fileName: string;
    payload: any;
    summary: { users: number; packages: number; shops: number; stock: number };
  } | null>(null);

  // WhatsApp Business Webhook Test State
  const [showWaToken, setShowWaToken] = useState(false);
  const [waTestPhone, setWaTestPhone] = useState('');
  const [isTestingWa, setIsTestingWa] = useState(false);
  const [waTestResult, setWaTestResult] = useState<{ ok: boolean; text: string } | null>(null);

  // Company Form State
  const [companyForm, setCompanyForm] = useState(companySettings);
  const [companySavedSuccess, setCompanySavedSuccess] = useState(false);

  React.useEffect(() => {
    setCompanyForm(companySettings);
  }, [companySettings]);

  const fetchSecurityOverview = React.useCallback(async () => {
    if (!isSuperAdmin) return;
    setSecurityLoading(true);
    try {
      const json = await fetchSecurityOverviewDirect();
      if (json.success && json.overview) {
        setSecurityOverview(json.overview as any);
      } else if (json.error) {
        setSecurityBanner({ type: 'error', text: json.error });
      }
    } catch (err: any) {
      setSecurityBanner({ type: 'error', text: err?.message || 'Erreur lors du chargement du contrôle sécurité.' });
    } finally {
      setSecurityLoading(false);
    }
  }, [isSuperAdmin]);

  React.useEffect(() => {
    if (isSuperAdmin && activeSubTab === 'super_admin_reset') {
      fetchSecurityOverview();
    }
  }, [isSuperAdmin, activeSubTab, fetchSecurityOverview]);

  // New User Modal State
  const [showAddUserModal, setShowAddUserModal] = useState(false);
  const [newUserName, setNewUserName] = useState('');
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserPhone, setNewUserPhone] = useState('');
  const [newUserRole, setNewUserRole] = useState<UserRole>('employee');
  const [newUserCity, setNewUserCity] = useState('Casablanca');

  // Audit Logs Filter State
  const [auditSearch, setAuditSearch] = useState('');
  const [auditModuleFilter, setAuditModuleFilter] = useState('all');

  const handleChangeSuperAdminPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setSecurityBanner(null);
    if (!currentPasswordInput.trim()) {
      setSecurityBanner({ type: 'error', text: 'Veuillez saisir votre mot de passe actuel.' });
      return;
    }
    if (newPasswordInput.trim().length < 8) {
      setSecurityBanner({ type: 'error', text: 'Le nouveau mot de passe doit contenir au moins 8 caractères.' });
      return;
    }
    if (newPasswordInput !== confirmPasswordInput) {
      setSecurityBanner({ type: 'error', text: 'La confirmation du mot de passe ne correspond pas.' });
      return;
    }
    setChangingPassword(true);
    try {
      const json = await changeSuperAdminPasswordDirect({
        currentPassword: currentPasswordInput.trim(),
        newPassword: newPasswordInput.trim(),
        revokeOtherSessions: revokeOtherSessionsOnPwChange
      });
      if (json.success) {
        setSecurityBanner({
          type: 'success',
          text: `${json.message}${json.revokedSessionsCount ? ` (${json.revokedSessionsCount} autre(s) session(s) déconnectée(s))` : ''}`
        });
        setCurrentPasswordInput('');
        setNewPasswordInput('');
        setConfirmPasswordInput('');
        await fetchSecurityOverview();
      } else {
        setSecurityBanner({ type: 'error', text: json.error || 'Échec de mise à jour du mot de passe.' });
      }
    } catch (err: any) {
      setSecurityBanner({ type: 'error', text: err?.message || 'Erreur réseau.' });
    } finally {
      setChangingPassword(false);
    }
  };

  const handleToggleSecuritySetting = async (
    key: 'requireAdminApprovalForClients' | 'allowPublicClientRegistration' | 'allowPublicDriverRegistration',
    value: boolean
  ) => {
    setSecurityBanner(null);
    setSavingSecuritySettings(true);
    try {
      const json = await updateSecuritySettingsDirect({ [key]: value });
      if (json.success) {
        setSecurityOverview(prev =>
          prev ? { ...prev, securitySettings: json.securitySettings as any } : prev
        );
        setSecurityBanner({ type: 'success', text: 'Politique de sécurité mise à jour immédiatement.' });
      } else {
        setSecurityBanner({ type: 'error', text: 'Erreur lors de la sauvegarde.' });
      }
    } catch (err: any) {
      setSecurityBanner({ type: 'error', text: err?.message || 'Erreur réseau.' });
    } finally {
      setSavingSecuritySettings(false);
    }
  };

  const handleRevokeSession = async (sessionId: string) => {
    setSecurityBanner(null);
    setRevokingSessionId(sessionId);
    try {
      const json = await revokeOtherSessionsDirect();
      if (json.success) {
        setSecurityBanner({ type: 'success', text: json.message || 'Session révoquée.' });
        await fetchSecurityOverview();
      } else {
        setSecurityBanner({ type: 'error', text: json.error || 'Impossible de révoquer la session.' });
      }
    } catch (err: any) {
      setSecurityBanner({ type: 'error', text: err?.message || 'Erreur réseau.' });
    } finally {
      setRevokingSessionId(null);
    }
  };

  const handleRevokeAllOtherSessions = async () => {
    setSecurityBanner(null);
    setRevokingAllSessions(true);
    try {
      const json = await revokeOtherSessionsDirect();
      if (json.success) {
        setSecurityBanner({ type: 'success', text: json.message || 'Sessions révoquées.' });
        await fetchSecurityOverview();
      } else {
        setSecurityBanner({ type: 'error', text: json.error || 'Erreur lors de la déconnexion globale.' });
      }
    } catch (err: any) {
      setSecurityBanner({ type: 'error', text: err?.message || 'Erreur réseau.' });
    } finally {
      setRevokingAllSessions(false);
    }
  };

  const handleDeletePrivilegedUser = async (id: string) => {
    setSecurityBanner(null);
    setDeletingPrivId(id);
    try {
      const json = await deletePrivilegedUserDirect(id);
      setConfirmDeletePrivId(null);
      if (json.success) {
        setSecurityBanner({ type: 'success', text: json.message || 'Accès révoqué.' });
        await fetchSecurityOverview();
      } else {
        setSecurityBanner({ type: 'error', text: json.error || 'Impossible de révoquer cet accès.' });
      }
    } catch (err: any) {
      setSecurityBanner({ type: 'error', text: err?.message || 'Erreur réseau.' });
    } finally {
      setDeletingPrivId(null);
    }
  };

  const handleSaveCompany = (e: React.FormEvent) => {
    e.preventDefault();
    updateCompanySettings(
      companyForm,
      currentUser ? { name: currentUser.name, role: currentUser.role } : undefined
    );
    setCompanySavedSuccess(true);
    setTimeout(() => setCompanySavedSuccess(false), 3000);
  };

  const handleDownloadBackup = async () => {
    setIsBackingUp(true);
    setBackupBanner(null);
    const res = await exportSystemBackup();
    setIsBackingUp(false);
    setBackupBanner({ type: res.success ? 'success' : 'error', text: res.message });
  };

  const handleSelectRestoreFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setBackupBanner(null);
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const root = parsed?.data && typeof parsed.data === 'object' ? parsed.data : parsed;
      if (!root || typeof root !== 'object') {
        setBackupBanner({ type: 'error', text: 'Fichier JSON invalide.' });
        return;
      }
      setPendingRestorePayload({
        fileName: file.name,
        payload: parsed,
        summary: {
          users: Array.isArray(root.users) ? root.users.length : 0,
          packages: Array.isArray(root.packages) ? root.packages.length : 0,
          shops: Array.isArray(root.shops) ? root.shops.length : 0,
          stock: Array.isArray(root.clientStockProducts) ? root.clientStockProducts.length : 0
        }
      });
    } catch {
      setBackupBanner({ type: 'error', text: 'Impossible de lire le fichier JSON sélectionné.' });
    }
  };

  const handleConfirmRestore = async () => {
    if (!pendingRestorePayload) return;
    setIsRestoring(true);
    const res = await restoreSystemBackup(pendingRestorePayload.payload);
    setIsRestoring(false);
    setPendingRestorePayload(null);
    setBackupBanner({ type: res.success ? 'success' : 'error', text: res.message });
  };

  const handleToggleWhatsappStatus = (statusCode: string) => {
    const current = companyForm.whatsappNotifyStatuses || [
      'ramasse',
      'en_cours_livraison',
      'livre',
      'retourne',
      'probleme_livraison'
    ];
    const next = current.includes(statusCode)
      ? current.filter(s => s !== statusCode)
      : [...current, statusCode];
    setCompanyForm({ ...companyForm, whatsappNotifyStatuses: next });
  };

  const handleTestWhatsappWebhook = async () => {
    setIsTestingWa(true);
    setWaTestResult(null);
    const provider = companyForm.whatsappProvider || 'webhook';
    const res = await testWhatsappWebhook({
      provider,
      phoneNumberId: companyForm.whatsappPhoneNumberId,
      webhookUrl: companyForm.whatsappWebhookUrl,
      apiToken: companyForm.whatsappApiToken,
      notifyTarget: companyForm.whatsappNotifyTarget || 'both',
      template: companyForm.whatsappCustomTemplate,
      recipientPhone: waTestPhone.trim() || companyForm.whatsapp
    });
    setIsTestingWa(false);
    if (res.success) {
      setWaTestResult({
        ok: true,
        text: `✅ تم الاتصال بنجاح عبر ${provider === 'meta_cloud' ? 'Meta WhatsApp Cloud API' : 'Webhook API'} (HTTP ${res.log?.httpStatus || 200}).`
      });
    } else if (!res.webhookConfigured) {
      setWaTestResult({
        ok: false,
        text:
          provider === 'meta_cloud'
            ? '⚠️ يرجى إدخال Phone Number ID و Access Token ديال Meta WhatsApp Cloud API ثم إعادة الاختبار.'
            : '⚠️ يرجى إدخال رابط Webhook API صحيح (يبدأ بـ https://) ثم إعادة الاختبار.'
      });
    } else {
      setWaTestResult({
        ok: false,
        text: `❌ فشل الإرسال عبر API: ${res.error || 'Erreur serveur'}`
      });
    }
  };

  const handleCreateUser = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUserName.trim() || !newUserEmail.trim()) {
      setUserActionBanner({ type: 'error', text: 'Veuillez renseigner les informations obligatoires.' });
      return;
    }

    addClient({
      name: newUserName.trim(),
      email: newUserEmail.trim(),
      phone: newUserPhone.trim(),
      role: newUserRole,
      city: newUserCity,
      status: 'active',
      accountStatus: 'approuve',
      permissions: ['can_create', 'can_edit']
    });

    setShowAddUserModal(false);
    setNewUserName('');
    setNewUserEmail('');
    setNewUserPhone('');
    setUserActionBanner({ type: 'success', text: `Compte utilisateur (${newUserRole}) créé avec succès.` });
  };

  const handleExportAuditCSV = () => {
    const rows = auditLogs.map(log => ({
      ID: log.id,
      Date: formatDate(log.timestamp),
      Utilisateur: log.userName || 'Direction',
      Role: log.userRole || 'admin',
      Module: log.entity || log.module || 'Système',
      Action: log.action || log.actionType || 'Action',
      Details: log.details || ''
    }));
    exportCSV(rows, `fariousy_journal_activites_${new Date().toISOString().substring(0, 10)}.csv`);
  };

  const filteredLogs = auditLogs.filter(log => {
    const logUser = log.userName || '';
    const logAction = log.action || log.actionType || '';
    const logDetails = log.details || '';
    const logEntity = log.entity || log.module || '';

    const matchesSearch =
      logUser.toLowerCase().includes(auditSearch.toLowerCase()) ||
      logAction.toLowerCase().includes(auditSearch.toLowerCase()) ||
      logDetails.toLowerCase().includes(auditSearch.toLowerCase()) ||
      logEntity.toLowerCase().includes(auditSearch.toLowerCase());

    const matchesModule = auditModuleFilter === 'all' || logEntity.toLowerCase().includes(auditModuleFilter.toLowerCase());
    return matchesSearch && matchesModule;
  });

  // Package statuses definitions for configuration and reference
  const parcelStatusesConfig = [
    { code: 'nouveau', label: 'Nouveau colis', color: 'bg-blue-100 text-blue-800', desc: 'Enregistré sur la plateforme, prêt pour ramassage ou dépôt en agence' },
    { code: 'ramasse', label: 'Ramassé chez le vendeur', color: 'bg-indigo-100 text-indigo-800', desc: 'Récupéré par le coursier chez le marchand e-commerce' },
    { code: 'en_stock', label: 'En stock au Hub', color: 'bg-amber-100 text-amber-800', desc: 'Entré dans le magasin logistique, trié et placé en rayon' },
    { code: 'expedie_hub', label: 'Expédié vers Hub distant', color: 'bg-purple-100 text-purple-800', desc: 'Chargé dans un camion de liaison inter-villes' },
    { code: 'en_transit', label: 'En transit inter-villes', color: 'bg-cyan-100 text-cyan-800', desc: 'En acheminement par transporteur routier partenaire' },
    { code: 'arrive_destination', label: 'Arrivé à l’agence destination', color: 'bg-teal-100 text-teal-800', desc: 'Réceptionné et scanné à l’agence locale de distribution' },
    { code: 'en_cours_livraison', label: 'En cours de tournée de livraison', color: 'bg-orange-100 text-orange-800', desc: 'Dans le véhicule du livreur pour livraison au destinataire' },
    { code: 'livre', label: 'Colis livré avec succès (Payé COD)', color: 'bg-emerald-100 text-emerald-800', desc: 'Remis au destinataire et montant COD encaissé' },
    { code: 'reporte', label: 'Livraison reportée (RDV ultérieur)', color: 'bg-yellow-100 text-yellow-800', desc: 'Destinataire absent ou ayant demandé un report à une date ultérieure' },
    { code: 'pas_de_reponse', label: 'Pas de réponse client', color: 'bg-stone-100 text-stone-800', desc: 'Appels téléphoniques sans réponse lors de la tournée' },
    { code: 'refuse', label: 'Refusé par le destinataire', color: 'bg-rose-100 text-rose-800', desc: 'Le client final a refusé la marchandise ou annulé sa commande' },
    { code: 'retour_en_cours', label: 'Retour en cours vers expéditeur', color: 'bg-red-100 text-red-800', desc: 'Retour acheminé vers le hub central pour remise au marchand' },
    { code: 'retourne', label: 'Retourné & remis au marchand', color: 'bg-slate-200 text-slate-800', desc: 'Marchandise restituée au marchand avec décompte des frais de retour' }
  ];

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <h2 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2.5">
            <Settings className="w-5 h-5 text-red-600" />
            <span>Paramètres & Configuration Système</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Administration centrale, gestion des permissions, politique de sécurité, données légales et journal d'audit
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="px-3 py-1 bg-red-50 text-red-700 border border-red-200 rounded-full text-xs font-bold font-mono">
            Mode Contrôle Total : Actif
          </span>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs border-b border-slate-200">
        <button
          onClick={() => setActiveSubTab('super_admin_reset')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold transition-all shrink-0 ${
            activeSubTab === 'super_admin_reset'
              ? 'bg-red-600 text-white shadow-xs'
              : 'bg-red-50 text-red-700 hover:bg-red-100 border border-red-200'
          }`}
        >
          <Shield className="w-4 h-4 text-inherit" />
          <span>Contrôle Total & Réinitialisation</span>
        </button>

        <button
          onClick={() => setActiveSubTab('company')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold transition-all shrink-0 ${
            activeSubTab === 'company'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <Building className="w-4 h-4 text-red-500" />
          <span>Entreprise & Légal</span>
        </button>

        <button
          onClick={() => setActiveSubTab('users')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold transition-all shrink-0 ${
            activeSubTab === 'users'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <Users className="w-4 h-4 text-amber-500" />
          <span>Gestion des Utilisateurs</span>
        </button>

        <button
          onClick={() => setActiveSubTab('permissions')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold transition-all shrink-0 ${
            activeSubTab === 'permissions'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <Shield className="w-4 h-4 text-indigo-500" />
          <span>Rôles & Permissions</span>
        </button>

        <button
          onClick={() => setActiveSubTab('tarifs_delais')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold transition-all shrink-0 ${
            activeSubTab === 'tarifs_delais'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <Clock className="w-4 h-4 text-emerald-500" />
          <span>Délais & Règles de Livraison</span>
        </button>

        <button
          onClick={() => setActiveSubTab('statuses')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold transition-all shrink-0 ${
            activeSubTab === 'statuses'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <ListOrdered className="w-4 h-4 text-cyan-500" />
          <span>Configuration Statuts Colis</span>
        </button>

        <button
          onClick={() => setActiveSubTab('audit')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold transition-all shrink-0 ${
            activeSubTab === 'audit'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <History className="w-4 h-4 text-rose-500" />
          <span>Journal d'Activité ({auditLogs.length})</span>
        </button>
      </div>

      {/* ================= 0. SUPER ADMIN & CONTRÔLE TOTAL ================= */}
      {activeSubTab === 'super_admin_reset' && (
        <div className="space-y-6">
          {/* Status & Feedback Banners */}
          {wipeSuccessMsg && (
            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center gap-3 text-emerald-800 text-xs font-semibold">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              <span>{wipeSuccessMsg}</span>
            </div>
          )}
          {wipeErrorMsg && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-2xl flex items-center gap-3 text-red-800 text-xs font-semibold">
              <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />
              <span>{wipeErrorMsg}</span>
            </div>
          )}
          {userActionBanner && (
            <div
              className={`p-4 rounded-2xl border flex items-center justify-between gap-3 text-xs font-semibold ${
                userActionBanner.type === 'success'
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                  : 'bg-red-50 border-red-200 text-red-800'
              }`}
            >
              <span>{userActionBanner.text}</span>
              <button type="button" onClick={() => setUserActionBanner(null)} className="text-[11px] underline">
                Fermer
              </button>
            </div>
          )}

          {/* Urgent Default Password Alert */}
          {isSuperAdmin && securityOverview?.isDefaultAdminPassword && (
            <div className="p-4 bg-red-600 text-white rounded-2xl shadow-md flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-start gap-3">
                <ShieldAlert className="w-6 h-6 shrink-0 mt-0.5 text-amber-300" />
                <div>
                  <h4 className="text-sm font-black">
                    Alerte Sécurité : Mot de passe par défaut toujours actif !
                  </h4>
                  <p className="text-xs text-red-100 mt-0.5">
                    Changez immédiatement votre mot de passe Super Admin ci-dessous pour garantir l’exclusivité totale de votre accès.
                  </p>
                </div>
              </div>
              <a
                href="#super-admin-password-box"
                className="px-4 py-2 bg-white text-red-700 font-black text-xs rounded-xl shrink-0 text-center hover:bg-red-50"
              >
                Changer maintenant
              </a>
            </div>
          )}

          {/* Super Admin Privileges Card */}
          <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 border border-slate-700 rounded-2xl p-6 text-white shadow-lg">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 border-b border-slate-700/80">
              <div className="flex items-center gap-3.5">
                <div className="w-12 h-12 rounded-2xl bg-red-600/20 border border-red-500/40 flex items-center justify-center shrink-0">
                  <Shield className="w-6 h-6 text-red-500" />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-base font-black tracking-tight text-white">
                      {currentUser?.name || 'Azzeddine Wadar'}
                    </h3>
                    <span className="px-2.5 py-0.5 bg-red-500/20 text-red-400 border border-red-500/40 rounded-full text-[10px] font-black uppercase tracking-wider">
                      SUPER ADMIN (CONTRÔLE TOTAL)
                    </span>
                  </div>
                  <p className="text-xs text-slate-300 font-mono mt-0.5">
                    {currentUser?.email || 'wadarazzeddine30@gmail.com'} • {currentUser?.phone || '+212 661 00 00 01'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                {isSuperAdmin && (
                  <button
                    type="button"
                    onClick={fetchSecurityOverview}
                    disabled={securityLoading}
                    className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-600 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${securityLoading ? 'animate-spin' : ''}`} />
                    <span>Actualiser l'audit</span>
                  </button>
                )}
                <span className="px-3 py-1.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 rounded-xl text-xs font-bold flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Accès Total Débloqué
                </span>
              </div>
            </div>

            {/* Privileges Matrix */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mt-5">
              <div className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-3.5">
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Gestion des Colis</span>
                <span className="text-xs font-bold text-white block mt-1">Création, modification, affectation & suppression totale</span>
              </div>
              <div className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-3.5">
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Marchands & Tarifs</span>
                <span className="text-xs font-bold text-white block mt-1">Approbation, suspension & prix de livraison sur-mesure</span>
              </div>
              <div className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-3.5">
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Équipe Livreurs</span>
                <span className="text-xs font-bold text-white block mt-1">Création avec identifiants (mot de passe) & suivi cash</span>
              </div>
              <div className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-3.5">
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Finance & CRBT</span>
                <span className="text-xs font-bold text-white block mt-1">Génération des virements marchands & commissions</span>
              </div>
            </div>
          </div>

          {/* Live Security & System Audit Summary */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-2xs">
              <span className="text-[11px] font-bold text-slate-500 uppercase block">Super Admins</span>
              <span className="text-2xl font-black text-red-600 mt-1 block">
                {securityOverview ? securityOverview.counts.superAdmins : 1}
              </span>
              <span className="text-[10px] text-slate-400">
                {securityOverview ? `${securityOverview.counts.privilegedAccounts} compte(s) privilégié(s)` : 'Propriétaire unique'}
              </span>
            </div>
            <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-2xs">
              <span className="text-[11px] font-bold text-slate-500 uppercase block">Sessions Actives</span>
              <span className="text-2xl font-black text-slate-900 mt-1 block">
                {securityOverview ? securityOverview.counts.activeSessions : '—'}
              </span>
              <span className="text-[10px] text-slate-400">Appareils connectés en ce moment</span>
            </div>
            <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-2xs">
              <span className="text-[11px] font-bold text-slate-500 uppercase block">Boutiques Marchands</span>
              <span className="text-2xl font-black text-slate-900 mt-1 block">
                {securityOverview ? securityOverview.counts.totalShops : users.filter(u => u.role === 'client').length}
              </span>
              <span className="text-[10px] text-slate-400">
                {securityOverview
                  ? `${securityOverview.counts.approvedClients} approuvées • ${securityOverview.counts.pendingClients} en attente • ${securityOverview.counts.suspendedClients} susp.`
                  : 'Boutiques enregistrées'}
              </span>
            </div>
            <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-2xs">
              <span className="text-[11px] font-bold text-slate-500 uppercase block">Colis / Ramassages</span>
              <span className="text-2xl font-black text-slate-900 mt-1 block">
                {securityOverview ? securityOverview.counts.totalPackages : packages.length}
              </span>
              <span className="text-[10px] text-slate-400">
                {pickups.length} ramassage(s) • {users.filter(u => u.role === 'driver').length} livreur(s)
              </span>
            </div>
          </div>

          {securityBanner && (
            <div
              className={`p-4 rounded-2xl border flex items-center justify-between gap-3 text-xs font-semibold ${
                securityBanner.type === 'success'
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                  : 'bg-red-50 border-red-200 text-red-800'
              }`}
            >
              <div className="flex items-center gap-2.5">
                {securityBanner.type === 'success' ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                )}
                <span>{securityBanner.text}</span>
              </div>
              <button type="button" onClick={() => setSecurityBanner(null)} className="text-[11px] underline shrink-0">
                Fermer
              </button>
            </div>
          )}

          {/* Super Admin Security Controls: Password + Registration Lock */}
          {isSuperAdmin && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Password Change Card */}
              <form
                id="super-admin-password-box"
                onSubmit={handleChangeSuperAdminPassword}
                className="bg-white border border-slate-200 rounded-2xl p-6 shadow-2xs space-y-4"
              >
                <div className="flex items-start justify-between gap-3 pb-3 border-b border-slate-100">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-red-50 text-red-600 flex items-center justify-center shrink-0">
                      <Key className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-sm font-extrabold text-slate-900">
                        Changer le Mot de Passe Super Admin
                      </h4>
                      <p className="text-[11px] text-slate-500">
                        Chiffrement sécurisé + révocation optionnelle de tous les autres appareils
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowPasswords(v => !v)}
                    className="p-2 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100"
                    title={showPasswords ? 'Masquer' : 'Afficher'}
                  >
                    {showPasswords ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Mot de passe actuel</label>
                    <input
                      type={showPasswords ? 'text' : 'password'}
                      value={currentPasswordInput}
                      onChange={e => setCurrentPasswordInput(e.target.value)}
                      placeholder="Saisir le mot de passe actuel"
                      className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Nouveau mot de passe (minimum 8 caractères)
                    </label>
                    <input
                      type={showPasswords ? 'text' : 'password'}
                      value={newPasswordInput}
                      onChange={e => setNewPasswordInput(e.target.value)}
                      placeholder="Ex: MotDePasseFort#2026"
                      className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Confirmer le nouveau mot de passe</label>
                    <input
                      type={showPasswords ? 'text' : 'password'}
                      value={confirmPasswordInput}
                      onChange={e => setConfirmPasswordInput(e.target.value)}
                      placeholder="Retaper le nouveau mot de passe"
                      className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-500"
                    />
                  </div>
                  <label className="flex items-center gap-2.5 pt-1 cursor-pointer text-xs text-slate-700 font-semibold">
                    <input
                      type="checkbox"
                      checked={revokeOtherSessionsOnPwChange}
                      onChange={e => setRevokeOtherSessionsOnPwChange(e.target.checked)}
                      className="rounded border-slate-300 text-red-600 focus:ring-red-500"
                    />
                    <span>Déconnecter automatiquement tous les autres appareils après modification</span>
                  </label>
                </div>

                <button
                  type="submit"
                  disabled={changingPassword}
                  className="w-full px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl shadow-xs flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  <KeyRound className="w-4 h-4 text-red-400" />
                  <span>{changingPassword ? 'Mise à jour sécurisée...' : 'Enregistrer le nouveau mot de passe'}</span>
                </button>
              </form>

              {/* Registration Locks & Access Control Policy */}
              <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-2xs space-y-4">
                <div className="flex items-center gap-3 pb-3 border-b border-slate-100">
                  <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
                    <Lock className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-extrabold text-slate-900">
                      Verrouillage des Inscriptions & Contrôle d’Accès
                    </h4>
                    <p className="text-[11px] text-slate-500">
                      Empêchez toute création non approuvée de boutiques ou de comptes livreurs
                    </p>
                  </div>
                </div>

                <div className="space-y-3">
                  <label className="flex items-start justify-between gap-4 p-3.5 bg-slate-50 border border-slate-200 rounded-xl cursor-pointer">
                    <div>
                      <span className="text-xs font-bold text-slate-900 block">
                        Approbation Admin obligatoire pour les nouveaux marchands
                      </span>
                      <span className="text-[11px] text-slate-500 block mt-0.5">
                        Les nouvelles inscriptions restent en statut « En attente » jusqu’à votre validation manuelle.
                      </span>
                    </div>
                    <input
                      type="checkbox"
                      disabled={savingSecuritySettings || !securityOverview}
                      checked={securityOverview?.securitySettings.requireAdminApprovalForClients ?? true}
                      onChange={e => handleToggleSecuritySetting('requireAdminApprovalForClients', e.target.checked)}
                      className="mt-1 h-4 w-4 rounded border-slate-300 text-red-600 focus:ring-red-500"
                    />
                  </label>

                  <label className="flex items-start justify-between gap-4 p-3.5 bg-slate-50 border border-slate-200 rounded-xl cursor-pointer">
                    <div>
                      <span className="text-xs font-bold text-slate-900 block">
                        Autoriser l’inscription publique de nouvelles boutiques
                      </span>
                      <span className="text-[11px] text-slate-500 block mt-0.5">
                        Désactivez cette option pour fermer complètement le formulaire public d’inscription marchand.
                      </span>
                    </div>
                    <input
                      type="checkbox"
                      disabled={savingSecuritySettings || !securityOverview}
                      checked={securityOverview?.securitySettings.allowPublicClientRegistration ?? true}
                      onChange={e => handleToggleSecuritySetting('allowPublicClientRegistration', e.target.checked)}
                      className="mt-1 h-4 w-4 rounded border-slate-300 text-red-600 focus:ring-red-500"
                    />
                  </label>

                  <label className="flex items-start justify-between gap-4 p-3.5 bg-slate-50 border border-slate-200 rounded-xl cursor-pointer">
                    <div>
                      <span className="text-xs font-bold text-slate-900 block">
                        Autoriser les candidatures publiques de livreurs
                      </span>
                      <span className="text-[11px] text-slate-500 block mt-0.5">
                        Les demandes de livreurs passent toujours par votre approbation, ou peuvent être bloquées ici.
                      </span>
                    </div>
                    <input
                      type="checkbox"
                      disabled={savingSecuritySettings || !securityOverview}
                      checked={securityOverview?.securitySettings.allowPublicDriverRegistration ?? true}
                      onChange={e => handleToggleSecuritySetting('allowPublicDriverRegistration', e.target.checked)}
                      className="mt-1 h-4 w-4 rounded border-slate-300 text-red-600 focus:ring-red-500"
                    />
                  </label>
                </div>
              </div>
            </div>
          )}

          {/* Privileged Accounts Audit Table (Super Admin, Admin, Employee) */}
          {isSuperAdmin && securityOverview && (
            <div className="bg-white border border-slate-200 rounded-2xl shadow-2xs overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center shrink-0">
                    <Users className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-sm font-extrabold text-slate-900">
                      Comptes Administrateurs & Personnel Privilégié ({securityOverview.privilegedUsers.length})
                    </h4>
                    <p className="text-[11px] text-slate-500">
                      Vérifiez exactement qui détient des privilèges d’administration et révoquez tout compte non autorisé
                    </p>
                  </div>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase text-[10px]">
                    <tr>
                      <th className="px-5 py-3">Nom & Email</th>
                      <th className="px-5 py-3">Rôle</th>
                      <th className="px-5 py-3">Source</th>
                      <th className="px-5 py-3">Statut</th>
                      <th className="px-5 py-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {securityOverview.privilegedUsers.map(u => (
                      <tr key={u.id} className="hover:bg-slate-50/70">
                        <td className="px-5 py-3">
                          <div className="font-bold text-slate-900">{u.name}</div>
                          <div className="text-[11px] text-slate-500 font-mono">{u.email}</div>
                        </td>
                        <td className="px-5 py-3">
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase ${
                              u.isOwner || u.role === 'super_admin'
                                ? 'bg-red-100 text-red-700'
                                : u.role === 'admin'
                                  ? 'bg-amber-100 text-amber-800'
                                  : 'bg-indigo-100 text-indigo-700'
                            }`}
                          >
                            {u.role}
                          </span>
                        </td>
                        <td className="px-5 py-3 text-[11px] font-mono text-slate-600">{u.source}</td>
                        <td className="px-5 py-3">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700">
                            {u.status}
                          </span>
                        </td>
                        <td className="px-5 py-3 text-right">
                          {u.isOwner ? (
                            <span className="text-[11px] font-bold text-slate-400">Propriétaire Protégé</span>
                          ) : confirmDeletePrivId === u.id ? (
                            <div className="inline-flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => handleDeletePrivilegedUser(u.id)}
                                disabled={deletingPrivId === u.id}
                                className="px-2.5 py-1 bg-red-600 hover:bg-red-700 text-white rounded-lg text-[11px] font-bold cursor-pointer disabled:opacity-50"
                              >
                                {deletingPrivId === u.id ? '...' : 'Confirmer'}
                              </button>
                              <button
                                type="button"
                                onClick={() => setConfirmDeletePrivId(null)}
                                className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[11px] font-bold cursor-pointer"
                              >
                                Annuler
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setConfirmDeletePrivId(u.id)}
                              className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold text-red-600 bg-red-50 hover:bg-red-100 rounded-lg cursor-pointer"
                            >
                              <UserX className="w-3.5 h-3.5" />
                              <span>Révoquer</span>
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Active Sessions Table & Global Kill Switch */}
          {isSuperAdmin && securityOverview && (
            <div className="bg-white border border-slate-200 rounded-2xl shadow-2xs overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0">
                    <Smartphone className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-sm font-extrabold text-slate-900">
                      Sessions Actives Connectées ({securityOverview.activeSessions.length})
                    </h4>
                    <p className="text-[11px] text-slate-500">
                      Coupez instantanément tout appareil ou session suspecte connectée au serveur
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleRevokeAllOtherSessions}
                  disabled={revokingAllSessions}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-xl shadow-xs flex items-center gap-2 cursor-pointer disabled:opacity-50 shrink-0"
                >
                  <LogOut className="w-4 h-4" />
                  <span>
                    {revokingAllSessions ? 'Déconnexion...' : 'Déconnecter tous les autres appareils'}
                  </span>
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase text-[10px]">
                    <tr>
                      <th className="px-5 py-3">Utilisateur</th>
                      <th className="px-5 py-3">Rôle</th>
                      <th className="px-5 py-3">Appareil / IP</th>
                      <th className="px-5 py-3">Ouverte le</th>
                      <th className="px-5 py-3 text-right">Contrôle</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {securityOverview.activeSessions.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-5 py-6 text-center text-slate-500 text-xs">
                          Aucune session serveur active trouvée.
                        </td>
                      </tr>
                    ) : (
                      securityOverview.activeSessions.map(sess => (
                        <tr key={sess.sessionId} className="hover:bg-slate-50/70">
                          <td className="px-5 py-3">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-slate-900">{sess.name || 'Utilisateur'}</span>
                              {sess.isCurrent && (
                                <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded-full text-[10px] font-black">
                                  Session Actuelle
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-slate-500 font-mono">
                              {sess.email} • {sess.tokenPreview}
                            </div>
                          </td>
                          <td className="px-5 py-3">
                            <span className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded-full text-[10px] font-bold uppercase">
                              {sess.role}
                            </span>
                          </td>
                          <td className="px-5 py-3">
                            <div className="text-[11px] font-mono text-slate-700">{sess.ip || 'IP locale'}</div>
                            <div className="text-[10px] text-slate-400 truncate max-w-[220px]" title={sess.userAgent || ''}>
                              {sess.userAgent || 'Navigateur / API'}
                            </div>
                          </td>
                          <td className="px-5 py-3 text-[11px] text-slate-600">
                            {sess.createdAt ? formatDate(sess.createdAt) : '—'}
                          </td>
                          <td className="px-5 py-3 text-right">
                            {sess.isCurrent ? (
                              <span className="text-[11px] font-semibold text-emerald-600 inline-flex items-center gap-1">
                                <CheckSquare className="w-3.5 h-3.5" />
                                <span>Cet appareil</span>
                              </span>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleRevokeSession(sess.sessionId)}
                                disabled={revokingSessionId === sess.sessionId}
                                className="px-3 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-lg text-[11px] font-bold cursor-pointer disabled:opacity-50"
                              >
                                {revokingSessionId === sess.sessionId ? 'Révocation...' : 'Révoquer'}
                              </button>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Full System Backup & Restore JSON Card (النسخ الاحتياطي والاسترجاع) */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-2xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
              <div className="flex items-start gap-3.5">
                <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                  <HardDriveDownload className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-base font-extrabold text-slate-900">
                    Sauvegarde & Restauration Complète (Backup JSON) — النسخ الاحتياطي
                  </h4>
                  <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                    Exportez l’intégralité de la base (colis, clients, livreurs, tarifs, villes, paiements, stock fulfillment, avis et paramètres) dans un fichier JSON, et restaurez-le en un clic à tout moment.
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={handleDownloadBackup}
                  disabled={isBackingUp}
                  className="flex items-center gap-2 px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl shadow-xs transition-colors cursor-pointer disabled:opacity-50"
                >
                  <Download className="w-4 h-4 text-emerald-400" />
                  <span>{isBackingUp ? 'Exportation...' : 'Télécharger Backup JSON'}</span>
                </button>

                <label className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-xs transition-colors cursor-pointer">
                  <Upload className="w-4 h-4" />
                  <span>Importer & Restaurer JSON</span>
                  <input
                    type="file"
                    accept=".json,application/json"
                    onChange={handleSelectRestoreFile}
                    className="hidden"
                  />
                </label>
              </div>
            </div>

            {backupBanner && (
              <div
                className={`p-3.5 rounded-xl border text-xs font-semibold flex items-center gap-2 ${
                  backupBanner.type === 'success'
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                    : 'bg-red-50 border-red-200 text-red-800'
                }`}
              >
                {backupBanner.type === 'success' ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                )}
                <span>{backupBanner.text}</span>
              </div>
            )}

            {pendingRestorePayload && (
              <div className="p-4 bg-amber-50 border-2 border-amber-300 rounded-xl space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h5 className="text-xs font-black text-amber-950">
                      Confirmer la restauration depuis « {pendingRestorePayload.fileName} » ?
                    </h5>
                    <p className="text-[11px] text-amber-800 mt-1">
                      Contenu détecté : <strong>{pendingRestorePayload.summary.packages} colis</strong> •{' '}
                      <strong>{pendingRestorePayload.summary.users} comptes</strong> •{' '}
                      <strong>{pendingRestorePayload.summary.shops} boutiques</strong> •{' '}
                      <strong>{pendingRestorePayload.summary.stock} produits stock</strong>. Votre compte Super Admin reste protégé.
                    </p>
                  </div>
                </div>
                <div className="flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setPendingRestorePayload(null)}
                    disabled={isRestoring}
                    className="px-3.5 py-2 text-xs font-bold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-xl cursor-pointer"
                  >
                    Annuler
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirmRestore}
                    disabled={isRestoring}
                    className="px-4 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-xs cursor-pointer disabled:opacity-50"
                  >
                    {isRestoring ? 'Restauration...' : 'Confirmer la restauration'}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* System Wipe / Clean Slate Danger Zone Card */}
          <div className="bg-white border-2 border-red-200 rounded-2xl p-6 shadow-sm space-y-4">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5 text-red-600" />
              </div>
              <div className="flex-1">
                <h4 className="text-base font-extrabold text-slate-900">
                  Vider l'ensemble du système (Clean Slate / Remise à zéro)
                </h4>
                <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                  Cette action vide tous les colis, demandes de ramassage, marchands de test et journaux d'audit de la base de données. 
                  Votre compte <span className="font-bold text-slate-900">Super Admin ({currentUser?.email || 'wadarazzeddine30@gmail.com'})</span> reste préservé avec un contrôle total.
                </p>
                <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-xl text-[11px] text-amber-900 font-medium flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>Idéal pour démarrer la production avec un système totalement propre sans données résiduelles.</span>
                </div>
              </div>
            </div>

            <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-slate-100">
              <span className="text-[11px] text-slate-500 font-medium">
                Action immédiate réservée au Super Administrateur
              </span>
              <button
                type="button"
                onClick={() => setShowWipeConfirmModal(true)}
                disabled={isWiping}
                className="w-full sm:w-auto px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                <Trash2 className="w-4 h-4" />
                <span>Vider le système et repartir à zéro</span>
              </button>
            </div>
          </div>

          {/* Modal Confirmation de Nettoyage */}
          {showWipeConfirmModal && (
            <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
              <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4 animate-in fade-in zoom-in-95">
                <div className="w-12 h-12 rounded-2xl bg-red-100 flex items-center justify-center text-red-600 mx-auto">
                  <AlertTriangle className="w-6 h-6" />
                </div>
                <div className="text-center">
                  <h3 className="text-base font-black text-slate-900">
                    Confirmer le nettoyage intégral du système
                  </h3>
                  <p className="text-xs text-slate-600 mt-2 leading-relaxed">
                    Voulez-vous vraiment vider toutes les données du système (colis, marchands de test, ramassages et historiques) ?
                    Votre compte <span className="font-bold text-red-600">Super Admin</span> restera actif avec un accès total.
                  </p>
                </div>
                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowWipeConfirmModal(false)}
                    disabled={isWiping}
                    className="flex-1 px-4 py-2.5 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl"
                  >
                    Annuler
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      setIsWiping(true);
                      setWipeErrorMsg('');
                      const res = await wipeSystemData();
                      setIsWiping(false);
                      setShowWipeConfirmModal(false);
                      if (res.success) {
                        setWipeSuccessMsg(res.message);
                      } else {
                        setWipeErrorMsg(res.message);
                      }
                    }}
                    disabled={isWiping}
                    className="flex-1 px-4 py-2.5 text-xs font-bold text-white bg-red-600 hover:bg-red-700 rounded-xl shadow-xs flex items-center justify-center gap-2 cursor-pointer"
                  >
                    {isWiping ? (
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      <Trash2 className="w-4 h-4" />
                    )}
                    <span>{isWiping ? 'Nettoyage en cours...' : 'Oui, Vider Tout'}</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ================= 1. ENTREPRISE & LÉGAL ================= */}
      {activeSubTab === 'company' && (
        <form onSubmit={handleSaveCompany} className="space-y-6">
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-2xs space-y-6">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div>
                <h3 className="text-base font-extrabold text-slate-900">
                  Informations Générales & Mentions Légales
                </h3>
                <p className="text-xs text-slate-500">
                  Ces informations apparaissent sur les bordereaux d'expédition, étiquettes thermiques et relevés de paiement
                </p>
              </div>

              {companySavedSuccess && (
                <div className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-xl text-xs font-bold">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Modifications enregistrées !</span>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Raison Sociale</label>
                <input
                  type="text"
                  value={companyForm.companyName}
                  onChange={e => setCompanyForm({ ...companyForm, companyName: e.target.value })}
                  className="w-full text-xs font-bold bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Slogan Commercial</label>
                <input
                  type="text"
                  value={companyForm.brandTagline}
                  onChange={e => setCompanyForm({ ...companyForm, brandTagline: e.target.value })}
                  className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Registre du Commerce (RC)</label>
                <input
                  type="text"
                  value={companyForm.rc}
                  onChange={e => setCompanyForm({ ...companyForm, rc: e.target.value })}
                  className="w-full text-xs font-mono bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Numéro Patente</label>
                <input
                  type="text"
                  value={companyForm.patente}
                  onChange={e => setCompanyForm({ ...companyForm, patente: e.target.value })}
                  className="w-full text-xs font-mono bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Identifiant Fiscal (IF)</label>
                <input
                  type="text"
                  value={companyForm.ifNumber}
                  onChange={e => setCompanyForm({ ...companyForm, ifNumber: e.target.value })}
                  className="w-full text-xs font-mono bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Identifiant Commun de l'Entreprise (ICE)</label>
                <input
                  type="text"
                  value={companyForm.ice}
                  onChange={e => setCompanyForm({ ...companyForm, ice: e.target.value })}
                  className="w-full text-xs font-mono font-bold bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Téléphone Principal</label>
                <input
                  type="tel"
                  value={companyForm.phone}
                  onChange={e => setCompanyForm({ ...companyForm, phone: e.target.value })}
                  className="w-full text-xs font-mono bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Assistance WhatsApp Officielle</label>
                <input
                  type="tel"
                  value={companyForm.whatsapp}
                  onChange={e => setCompanyForm({ ...companyForm, whatsapp: e.target.value })}
                  className="w-full text-xs font-mono bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Adresse E-mail Officielle</label>
                <input
                  type="email"
                  value={companyForm.email}
                  onChange={e => setCompanyForm({ ...companyForm, email: e.target.value })}
                  className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Site Web</label>
                <input
                  type="text"
                  value={companyForm.website}
                  onChange={e => setCompanyForm({ ...companyForm, website: e.target.value })}
                  className="w-full text-xs font-mono bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Page Facebook</label>
                <input
                  type="url"
                  value={companyForm.facebookUrl || ''}
                  onChange={e => setCompanyForm({ ...companyForm, facebookUrl: e.target.value })}
                  placeholder="https://www.facebook.com/..."
                  className="w-full text-xs font-mono bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Compte Instagram</label>
                <input
                  type="url"
                  value={companyForm.instagramUrl || ''}
                  onChange={e => setCompanyForm({ ...companyForm, instagramUrl: e.target.value })}
                  placeholder="https://www.instagram.com/..."
                  className="w-full text-xs font-mono bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Adresse Siège Social</label>
              <input
                type="text"
                value={companyForm.address}
                onChange={e => setCompanyForm({ ...companyForm, address: e.target.value })}
                className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-500"
              />
            </div>

            <div className="pt-4 border-t border-slate-100 flex justify-end">
              <button
                type="submit"
                className="flex items-center gap-2 px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white font-bold text-xs rounded-xl shadow-xs transition-colors cursor-pointer"
              >
                <Save className="w-4 h-4" />
                <span>Enregistrer les Paramètres Entreprise</span>
              </button>
            </div>
          </div>
        </form>
      )}

      {/* ================= 2. GESTION DES UTILISATEURS ================= */}
      {activeSubTab === 'users' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-extrabold text-slate-900">
                Gestion des Comptes Utilisateurs
              </h3>
              <p className="text-xs text-slate-500">
                Création manuelle, activation / désactivation et attribution de rôles
              </p>
            </div>

            <button
              onClick={() => setShowAddUserModal(true)}
              className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-red-600 hover:bg-red-700 rounded-xl shadow-xs transition-colors cursor-pointer"
            >
              <UserPlus className="w-4 h-4" />
              <span>Créer un Compte</span>
            </button>
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl shadow-2xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase text-[10px] tracking-wider">
                  <tr>
                    <th className="px-5 py-3.5">Nom & Email</th>
                    <th className="px-5 py-3.5">Rôle</th>
                    <th className="px-5 py-3.5">Ville</th>
                    <th className="px-5 py-3.5">Statut Compte</th>
                    <th className="px-5 py-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {users.map(u => (
                    <tr key={u.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-xl bg-slate-900 text-white font-bold flex items-center justify-center text-xs">
                            {u.name.charAt(0)}
                          </div>
                          <div>
                            <span className="font-bold text-slate-900 block">{u.name}</span>
                            <span className="text-[11px] text-slate-500 font-mono">{u.email}</span>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3.5">
                        <span
                          className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase ${
                            u.role === 'super_admin'
                              ? 'bg-purple-100 text-purple-800 border border-purple-200'
                              : u.role === 'admin'
                              ? 'bg-red-100 text-red-800 border border-red-200'
                              : u.role === 'employee'
                              ? 'bg-blue-100 text-blue-800 border border-blue-200'
                              : u.role === 'driver'
                              ? 'bg-amber-100 text-amber-800 border border-amber-200'
                              : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                          }`}
                        >
                          {u.role}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-slate-700 font-medium">
                        {u.city || 'Casablanca'}
                      </td>
                      <td className="px-5 py-3.5">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold ${
                            u.status === 'active'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-slate-100 text-slate-600 border border-slate-200'
                          }`}
                        >
                          {u.status === 'active' ? (
                            <>
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                              <span>Actif</span>
                            </>
                          ) : (
                            <>
                              <AlertCircle className="w-3 h-3 text-slate-400" />
                              <span>Inactif / Bloqué</span>
                            </>
                          )}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <button
                          onClick={() => toggleEmployeeStatus(u.id)}
                          className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-700"
                        >
                          {u.status === 'active' ? 'Désactiver' : 'Réactiver'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ================= 3. RÔLES & PERMISSIONS ================= */}
      {activeSubTab === 'permissions' && (
        <div className="space-y-6">
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-2xs space-y-6">
            <div>
              <h3 className="text-base font-extrabold text-slate-900">
                Matrice des Rôles & Niveaux d'Accès
              </h3>
              <p className="text-xs text-slate-500">
                Contrôle strict des opérations CRUD (Créer, Modifier, Supprimer) et de la visibilité des modules
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border border-slate-200 rounded-xl overflow-hidden">
                <thead className="bg-slate-900 text-white font-bold text-[11px]">
                  <tr>
                    <th className="p-3">Rôle Système</th>
                    <th className="p-3 text-center">Création (C)</th>
                    <th className="p-3 text-center">Lecture (R)</th>
                    <th className="p-3 text-center">Modification (U)</th>
                    <th className="p-3 text-center">Suppression (D)</th>
                    <th className="p-3">Périmètre d'Accès</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  <tr className="bg-purple-50/40">
                    <td className="p-3 font-bold text-purple-900 flex items-center gap-1.5">
                      <Shield className="w-4 h-4 text-purple-600" />
                      <span>SUPER ADMIN</span>
                    </td>
                    <td className="p-3 text-center font-bold text-emerald-600">✓ Oui</td>
                    <td className="p-3 text-center font-bold text-emerald-600">✓ Tout</td>
                    <td className="p-3 text-center font-bold text-emerald-600">✓ Oui</td>
                    <td className="p-3 text-center font-bold text-emerald-600">✓ Oui</td>
                    <td className="p-3 font-medium">Contrôle absolu sur l'ensemble de la plateforme et logs</td>
                  </tr>
                  <tr>
                    <td className="p-3 font-bold text-red-900 flex items-center gap-1.5">
                      <Shield className="w-4 h-4 text-red-600" />
                      <span>ADMIN</span>
                    </td>
                    <td className="p-3 text-center font-bold text-emerald-600">✓ Oui</td>
                    <td className="p-3 text-center font-bold text-emerald-600">✓ Tout</td>
                    <td className="p-3 text-center font-bold text-emerald-600">✓ Oui</td>
                    <td className="p-3 text-center font-bold text-amber-600">Avec confirmation</td>
                    <td className="p-3 font-medium">Gestion opérationnelle complète et validations</td>
                  </tr>
                  <tr>
                    <td className="p-3 font-bold text-blue-900 flex items-center gap-1.5">
                      <Shield className="w-4 h-4 text-blue-600" />
                      <span>EMPLOYÉ</span>
                    </td>
                    <td className="p-3 text-center font-bold text-emerald-600">✓ Limité</td>
                    <td className="p-3 text-center font-bold text-slate-800">Agence locale</td>
                    <td className="p-3 text-center font-bold text-emerald-600">Statuts colis</td>
                    <td className="p-3 text-center font-bold text-rose-600">✕ Interdit</td>
                    <td className="p-3 font-medium">Scanner, gestion stock agence, validation ramassage</td>
                  </tr>
                  <tr>
                    <td className="p-3 font-bold text-amber-900 flex items-center gap-1.5">
                      <Shield className="w-4 h-4 text-amber-600" />
                      <span>LIVREUR</span>
                    </td>
                    <td className="p-3 text-center font-bold text-rose-600">✕ Non</td>
                    <td className="p-3 text-center font-bold text-slate-800">Sa tournée</td>
                    <td className="p-3 text-center font-bold text-emerald-600">Livré / Non livré</td>
                    <td className="p-3 text-center font-bold text-rose-600">✕ Interdit</td>
                    <td className="p-3 font-medium">Tournée du jour, encaissements cash et motifs d'échec</td>
                  </tr>
                  <tr>
                    <td className="p-3 font-bold text-emerald-900 flex items-center gap-1.5">
                      <Shield className="w-4 h-4 text-emerald-600" />
                      <span>CLIENT</span>
                    </td>
                    <td className="p-3 text-center font-bold text-emerald-600">✓ Ses colis</td>
                    <td className="p-3 text-center font-bold text-slate-800">Ses colis uniquement</td>
                    <td className="p-3 text-center font-bold text-amber-600">Si non expédié</td>
                    <td className="p-3 text-center font-bold text-rose-600">✕ Interdit</td>
                    <td className="p-3 font-medium">Création de colis, demandes de ramassage, relevés personnels</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ================= 4. DÉLAIS & RÈGLES DE LIVRAISON ================= */}
      {activeSubTab === 'tarifs_delais' && (
        <form onSubmit={handleSaveCompany} className="space-y-6">
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-2xs space-y-6">
            <div>
              <h3 className="text-base font-extrabold text-slate-900">
                Délais et Paramètres de Livraison Standards
              </h3>
              <p className="text-xs text-slate-500">
                Paramétrage par défaut appliqué aux nouveaux comptes et expéditions
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Délai moyen de livraison standard
                </label>
                <input
                  type="text"
                  value={companyForm.defaultDeliveryDelay}
                  onChange={e =>
                    setCompanyForm({ ...companyForm, defaultDeliveryDelay: e.target.value })
                  }
                  className="w-full text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Frais forfaitaire de retour colis (MAD)
                </label>
                <input
                  type="number"
                  value={companyForm.defaultReturnFee}
                  onChange={e =>
                    setCompanyForm({
                      ...companyForm,
                      defaultReturnFee: parseFloat(e.target.value) || 0
                    })
                  }
                  className="w-full text-xs font-mono font-bold bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Frais de livraison par défaut (MAD)
                </label>
                <input
                  type="number"
                  value={companyForm.defaultDeliveryFee}
                  onChange={e =>
                    setCompanyForm({
                      ...companyForm,
                      defaultDeliveryFee: parseFloat(e.target.value) || 0
                    })
                  }
                  className="w-full text-xs font-mono font-bold bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-500"
                />
              </div>
            </div>

            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <h4 className="text-xs font-bold text-slate-900 flex items-center gap-2">
                  <MessageCircle className="w-4 h-4 text-emerald-600" />
                  <span>التتبع المباشر وإشعارات WhatsApp API التلقائية (Real-Time Tracking & Notifications)</span>
                </h4>
                <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 self-start sm:self-auto">
                  {(companyForm.whatsappProvider === 'meta_cloud'
                    ? Boolean(companyForm.whatsappPhoneNumberId?.trim() && companyForm.whatsappApiToken?.trim())
                    : Boolean(companyForm.whatsappWebhookUrl?.trim()))
                    ? 'API Connectée'
                    : 'Mode Direct + Prêt API'}
                </span>
              </div>

              <div className="flex flex-wrap gap-4 text-xs">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={companyForm.enableAutoClientNotifications !== false}
                    onChange={e =>
                      setCompanyForm({ ...companyForm, enableAutoClientNotifications: e.target.checked })
                    }
                    className="rounded-sm text-red-600 focus:ring-red-500 accent-red-600"
                  />
                  <span className="font-semibold text-slate-800">
                    إشعارات تلقائية فورية للتاجر (الجرس + البث المباشر)
                  </span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={companyForm.enableWhatsappAlerts !== false}
                    onChange={e =>
                      setCompanyForm({ ...companyForm, enableWhatsappAlerts: e.target.checked })
                    }
                    className="rounded-sm text-emerald-600 focus:ring-emerald-500 accent-emerald-600"
                  />
                  <span className="font-semibold text-slate-800">إرسال إشعارات WhatsApp API تلقائياً</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={companyForm.enableSmsNotifications}
                    onChange={e =>
                      setCompanyForm({ ...companyForm, enableSmsNotifications: e.target.checked })
                    }
                    className="rounded-sm text-red-600 focus:ring-red-500 accent-red-600"
                  />
                  <span className="font-medium text-slate-700">SMS destinataire</span>
                </label>
              </div>

              {/* Provider Mode & Target Audience */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2 border-t border-slate-200/80">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1.5">
                    مزود خدمة واتساب (Mode WhatsApp API) :
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setCompanyForm({ ...companyForm, whatsappProvider: 'meta_cloud' })}
                      className={`px-3 py-2 rounded-xl text-[11px] font-bold border transition-colors cursor-pointer ${
                        companyForm.whatsappProvider === 'meta_cloud'
                          ? 'bg-emerald-600 text-white border-emerald-600'
                          : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      Meta Cloud API (رسمي)
                    </button>
                    <button
                      type="button"
                      onClick={() => setCompanyForm({ ...companyForm, whatsappProvider: 'webhook' })}
                      className={`px-3 py-2 rounded-xl text-[11px] font-bold border transition-colors cursor-pointer ${
                        (companyForm.whatsappProvider || 'webhook') === 'webhook'
                          ? 'bg-emerald-600 text-white border-emerald-600'
                          : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      Webhook / UltraMsg / n8n
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1.5">
                    لمن كيتصيفط إشعار واتساب (Destinataires) :
                  </label>
                  <div className="grid grid-cols-3 gap-1.5">
                    {[
                      { id: 'recipient', label: 'الزبون فقط' },
                      { id: 'merchant', label: 'التاجر فقط' },
                      { id: 'both', label: 'الزبون + التاجر' }
                    ].map(opt => {
                      const active = (companyForm.whatsappNotifyTarget || 'both') === opt.id;
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() =>
                            setCompanyForm({
                              ...companyForm,
                              whatsappNotifyTarget: opt.id as 'recipient' | 'merchant' | 'both'
                            })
                          }
                          className={`px-2 py-2 rounded-xl text-[11px] font-bold border transition-colors cursor-pointer ${
                            active
                              ? 'bg-slate-900 text-white border-slate-900'
                              : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                          }`}
                        >
                          {opt.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Endpoint / Meta Phone Number ID & Bearer Token */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {companyForm.whatsappProvider === 'meta_cloud' ? (
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      Meta Phone Number ID (Graph API v21.0)
                    </label>
                    <input
                      type="text"
                      value={companyForm.whatsappPhoneNumberId || ''}
                      onChange={e =>
                        setCompanyForm({ ...companyForm, whatsappPhoneNumberId: e.target.value.replace(/[^\d]/g, '') })
                      }
                      placeholder="Ex: 109876543210123"
                      className="w-full text-xs font-mono bg-white border border-slate-200 rounded-xl px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                ) : (
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      URL Webhook WhatsApp Business / Passerelle API
                    </label>
                    <input
                      type="url"
                      value={companyForm.whatsappWebhookUrl || ''}
                      onChange={e => setCompanyForm({ ...companyForm, whatsappWebhookUrl: e.target.value })}
                      placeholder="https://votre-api-whatsapp.com/webhook/send"
                      className="w-full text-xs font-mono bg-white border border-slate-200 rounded-xl px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                )}

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    {companyForm.whatsappProvider === 'meta_cloud'
                      ? 'Permanent Access Token (Meta)'
                      : 'Token API / Bearer Secret (Optionnel)'}
                  </label>
                  <div className="relative">
                    <input
                      type={showWaToken ? 'text' : 'password'}
                      value={companyForm.whatsappApiToken || ''}
                      onChange={e => setCompanyForm({ ...companyForm, whatsappApiToken: e.target.value })}
                      placeholder={
                        companyForm.whatsappProvider === 'meta_cloud'
                          ? 'EAAG... (أو عبر WHATSAPP_API_TOKEN في السيرفر)'
                          : 'Bearer token / clé secrète'
                      }
                      className="w-full text-xs font-mono bg-white border border-slate-200 rounded-xl pl-3 pr-9 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                    <button
                      type="button"
                      onClick={() => setShowWaToken(v => !v)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 cursor-pointer"
                    >
                      {showWaToken ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
              </div>

              {/* Watched Package Statuses */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1.5">
                  الحالات لي كتطلق إشعار واتساب التلقائي (Statuts déclencheurs) :
                </label>
                <div className="flex flex-wrap gap-2">
                  {[
                    { code: 'ramasse', label: '📦 Ramassé (تم الجمع)' },
                    { code: 'en_cours_livraison', label: '🚚 En cours (في الطريق)' },
                    { code: 'livre', label: '✅ Livré (تم التسليم)' },
                    { code: 'retourne', label: '↩️ Retour (مرتجع)' },
                    { code: 'reporte', label: '⏳ Reporté (مؤجل)' },
                    { code: 'refuse', label: '❌ Refusé (مرفوض)' },
                    { code: 'probleme_livraison', label: '⚠️ Problème livraison' }
                  ].map(st => {
                    const active = (
                      companyForm.whatsappNotifyStatuses || [
                        'ramasse',
                        'en_cours_livraison',
                        'livre',
                        'retourne',
                        'probleme_livraison'
                      ]
                    ).includes(st.code);
                    return (
                      <button
                        key={st.code}
                        type="button"
                        onClick={() => handleToggleWhatsappStatus(st.code)}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-colors cursor-pointer ${
                          active
                            ? 'bg-emerald-600 text-white border-emerald-600'
                            : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        {st.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Message Template */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  نص الرسالة التلقائية (Variables : {'{{company}}, {{tracking}}, {{recipient}}, {{status}}, {{city}}, {{cod}}, {{driver}}, {{tracking_url}}'})
                </label>
                <textarea
                  rows={2}
                  value={
                    companyForm.whatsappCustomTemplate ||
                    '📦 {{company}} : السلام عليكم {{recipient}}، الطرد ديالك {{tracking}} ({{city}}) ولات الحالة ديالو: {{status}}. المبلغ عند الاستلام: {{cod}} DH. التتبع المباشر: {{tracking_url}}'
                  }
                  onChange={e =>
                    setCompanyForm({ ...companyForm, whatsappCustomTemplate: e.target.value })
                  }
                  className="w-full text-xs bg-white border border-slate-200 rounded-xl px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              {/* Live Test Webhook Bar */}
              <div className="flex flex-col sm:flex-row sm:items-center gap-2 pt-2 border-t border-slate-200/80">
                <input
                  type="tel"
                  value={waTestPhone}
                  onChange={e => setWaTestPhone(e.target.value)}
                  placeholder={`رقم هاتف للاختبار (افتراضي: ${companyForm.whatsapp})`}
                  className="flex-1 text-xs font-mono bg-white border border-slate-200 rounded-xl px-3 py-2 text-slate-900"
                />
                <button
                  type="button"
                  onClick={handleTestWhatsappWebhook}
                  disabled={isTestingWa}
                  className="flex items-center justify-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-xs cursor-pointer disabled:opacity-50"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>{isTestingWa ? 'جاري الاختبار...' : 'اختبار إرسال واتساب (Test API)'}</span>
                </button>
              </div>

              {waTestResult && (
                <div
                  className={`p-2.5 rounded-xl text-[11px] font-semibold border ${
                    waTestResult.ok
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                      : 'bg-amber-50 border-amber-200 text-amber-900'
                  }`}
                >
                  {waTestResult.text}
                </div>
              )}

              {/* Recent Real Dispatch Logs */}
              {whatsappLogs.length > 0 && (
                <div className="pt-2 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-slate-700">
                      سجل إشعارات واتساب الأخيرة ({whatsappLogs.length})
                    </span>
                    <button
                      type="button"
                      onClick={() => clearWhatsappLogs()}
                      className="text-[10px] font-bold text-rose-600 hover:underline cursor-pointer"
                    >
                      مسح السجل
                    </button>
                  </div>
                  <div className="max-h-48 overflow-y-auto border border-slate-200 rounded-xl bg-white divide-y divide-slate-100">
                    {whatsappLogs.slice(0, 10).map(log => (
                      <div key={log.id} className="px-3 py-2 text-[11px] flex flex-wrap items-center justify-between gap-2">
                        <div className="min-w-0">
                          <span className="font-mono font-bold text-slate-900">{log.trackingNumber}</span>{' '}
                          <span className="text-slate-500">→ {log.recipientPhone}</span>
                          <span className="text-slate-400"> ({log.statusLabel})</span>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              log.deliveryState === 'sent'
                                ? 'bg-emerald-100 text-emerald-800'
                                : log.deliveryState === 'failed'
                                ? 'bg-red-100 text-red-700'
                                : 'bg-amber-100 text-amber-800'
                            }`}
                          >
                            {log.deliveryState === 'sent'
                              ? `تم الإرسال (${log.httpStatus || 200})`
                              : log.deliveryState === 'failed'
                              ? `فشل (${log.error || log.httpStatus})`
                              : 'رابط مباشر جاهز'}
                          </span>
                          {log.whatsappDirectUrl && (
                            <a
                              href={log.whatsappDirectUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="px-2 py-0.5 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-bold transition-colors"
                            >
                              إرسال يدوي
                            </a>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="pt-3 border-t border-slate-100 flex justify-end">
              <button
                type="submit"
                className="flex items-center gap-2 px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white font-bold text-xs rounded-xl shadow-xs transition-colors cursor-pointer"
              >
                <Save className="w-4 h-4" />
                <span>Enregistrer la politique</span>
              </button>
            </div>
          </div>
        </form>
      )}

      {/* ================= 5. CONFIGURATION DES STATUTS ================= */}
      {activeSubTab === 'statuses' && (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-2xs space-y-4">
          <div>
            <h3 className="text-base font-extrabold text-slate-900">
              Cycle de Vie des Colis & Statuts Opérationnels
            </h3>
            <p className="text-xs text-slate-500">
              Référentiel officiel des 13 statuts logistiques avec couleur, libellé et description pour les chauffeurs et clients
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {parcelStatusesConfig.map(st => (
              <div
                key={st.code}
                className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl flex items-start gap-3"
              >
                <span className={`px-2.5 py-1 rounded-md text-[10px] font-black shrink-0 ${st.color}`}>
                  {st.code}
                </span>
                <div className="min-w-0">
                  <h4 className="text-xs font-bold text-slate-900">{st.label}</h4>
                  <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">{st.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ================= 6. JOURNAL D'ACTIVITÉ (AUDIT LOGS) ================= */}
      {activeSubTab === 'audit' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 border border-slate-200 rounded-2xl shadow-2xs">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={auditSearch}
                onChange={e => setAuditSearch(e.target.value)}
                placeholder="Rechercher par utilisateur, action ou détail..."
                className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-500"
              />
            </div>

            <div className="flex items-center gap-2">
              <Filter className="w-3.5 h-3.5 text-slate-400" />
              <select
                value={auditModuleFilter}
                onChange={e => setAuditModuleFilter(e.target.value)}
                className="text-xs font-semibold px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-red-500"
              >
                <option value="all">Tous les modules</option>
                <option value="colis">Colis</option>
                <option value="client">Client</option>
                <option value="livreur">Livreur</option>
                <option value="employe">Employé</option>
                <option value="partenaire">Partenaire</option>
                <option value="stock">Stock</option>
                <option value="finance">Finance</option>
                <option value="dette">Dette</option>
                <option value="parametres">Paramètres</option>
              </select>

              <button
                onClick={handleExportAuditCSV}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Exporter CSV</span>
              </button>

              {confirmClearAudit ? (
                <div className="inline-flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      clearAuditLogs();
                      setConfirmClearAudit(false);
                    }}
                    className="px-2.5 py-1 text-[11px] font-bold bg-rose-600 text-white rounded-lg hover:bg-rose-700 cursor-pointer"
                  >
                    Confirmer
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmClearAudit(false)}
                    className="px-2 py-1 text-[11px] font-bold bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 cursor-pointer"
                  >
                    Annuler
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmClearAudit(true)}
                  className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 cursor-pointer"
                  title="Vider les logs"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl shadow-2xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase text-[10px] tracking-wider">
                  <tr>
                    <th className="px-5 py-3">Date & Heure</th>
                    <th className="px-5 py-3">Auteur</th>
                    <th className="px-5 py-3">Module</th>
                    <th className="px-5 py-3">Action Effectuée</th>
                    <th className="px-5 py-3">Détails de l'Opération</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredLogs.map(log => (
                    <tr key={log.id} className="hover:bg-slate-50/70">
                      <td className="px-5 py-3 font-mono text-[11px] text-slate-500 whitespace-nowrap">
                        {formatDate(log.timestamp)}
                      </td>
                      <td className="px-5 py-3 font-semibold text-slate-900 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <span>{log.userName || 'Direction'}</span>
                          <span className="text-[10px] font-mono px-1.5 py-0.2 bg-slate-100 rounded text-slate-600">
                            {log.userRole || 'admin'}
                          </span>
                        </div>
                      </td>
                      <td className="px-5 py-3 whitespace-nowrap">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700 uppercase">
                          {log.entity || log.module || 'Système'}
                        </span>
                      </td>
                      <td className="px-5 py-3 font-bold text-slate-800 whitespace-nowrap">
                        {log.action || log.actionType || 'Action'}
                      </td>
                      <td className="px-5 py-3 text-slate-600 text-[11px] max-w-md truncate">
                        {log.details || '—'}
                      </td>
                    </tr>
                  ))}
                  {filteredLogs.length === 0 && (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-slate-400">
                        Aucune activité enregistrée pour ces critères.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Modal Add User */}
      {showAddUserModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs no-print">
          <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50">
              <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
                <UserPlus className="w-4 h-4 text-red-600" />
                <span>Créer un Compte Utilisateur</span>
              </h3>
              <button
                onClick={() => setShowAddUserModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateUser} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Nom complet *</label>
                <input
                  type="text"
                  required
                  value={newUserName}
                  onChange={e => setNewUserName(e.target.value)}
                  placeholder="Ex: Youssef Bennani"
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Email de connexion *</label>
                <input
                  type="email"
                  required
                  value={newUserEmail}
                  onChange={e => setNewUserEmail(e.target.value)}
                  placeholder="y.bennani@fariousy.com"
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Téléphone</label>
                <input
                  type="tel"
                  value={newUserPhone}
                  onChange={e => setNewUserPhone(e.target.value)}
                  placeholder="06 61 00 00 00"
                  className="w-full px-3 py-2 text-xs font-mono bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Rôle Système</label>
                  <select
                    value={newUserRole}
                    onChange={e => setNewUserRole(e.target.value as UserRole)}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-500 font-bold"
                  >
                    <option value="super_admin">SUPER ADMIN</option>
                    <option value="admin">ADMIN</option>
                    <option value="employee">EMPLOYÉ</option>
                    <option value="driver">LIVREUR</option>
                    <option value="client">CLIENT</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Ville</label>
                  <input
                    type="text"
                    value={newUserCity}
                    onChange={e => setNewUserCity(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-500"
                  />
                </div>
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddUserModal(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-bold text-white bg-red-600 hover:bg-red-700 rounded-xl shadow-xs cursor-pointer"
                >
                  Créer l'utilisateur
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
