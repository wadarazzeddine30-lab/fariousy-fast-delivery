import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useDatabase } from '../../context/DatabaseContext';
import { useAuth } from '../../context/AuthContext';
import { AccountStatus, PackageItem, UserProfile } from '../../types';
import { formatMAD, formatDate } from '../../utils/barcode';
import {
  fetchSupabaseClients,
  createSupabaseClient,
  updateSupabaseClient,
  updateSupabaseClientBank,
  toggleSupabaseClientStatus
} from '../../services/supabase';
import {
  Users,
  UserPlus,
  CheckCircle2,
  XCircle,
  Eye,
  Copy,
  Sliders,
  DollarSign,
  Package,
  CalendarCheck,
  Building,
  Phone,
  Mail,
  MapPin,
  X,
  Save,
  Clock,
  ShieldAlert,
  AlertCircle,
  Store,
  Tag,
  MessageSquare,
  Check,
  Edit2,
  Trash2,
  Download,
  Search,
  RefreshCw,
  Database,
  Lock,
  RotateCcw,
  Key,
  Share2,
  LogIn,
  CreditCard,
  ZoomIn,
  Landmark
} from 'lucide-react';
import { ConfirmActionModal } from '../common/ConfirmActionModal';
import { getLocalKycDocs } from '../../utils/kycStorage';

interface AdminClientsProps {
  onViewPackage: (pkg: PackageItem) => void;
  defaultSubTab?: 'liste' | 'ajouter' | 'demandes' | 'en_attente' | 'suspendus';
  externalSubTab?: { tab: 'liste' | 'ajouter' | 'demandes' | 'en_attente' | 'suspendus'; nonce: number } | null;
  focusSearchNonce?: number;
}

export const AdminClients: React.FC<AdminClientsProps> = ({
  onViewPackage,
  defaultSubTab = 'liste',
  externalSubTab,
  focusSearchNonce
}) => {
  const {
    packages,
    pickups,
    payments,
    cities,
    addClient,
    updateClient,
    deleteClient,
    toggleClientStatus,
    approveClient,
    rejectClient,
    suspendClient,
    updateClientRate,
    removeClientRate,
    setClientCustomRates,
    resetClientCustomRates,
    updateClientPassword
  } = useDatabase();

  const { currentUser, switchRole, impersonateUser, logout } = useAuth();
  const isAdmin = currentUser !== null && (currentUser.role === 'admin' || currentUser.role === 'super_admin');

  // Supabase Real Production Clients State
  const [supabaseClients, setSupabaseClients] = useState<UserProfile[]>([]);
  const [isLoadingClients, setIsLoadingClients] = useState<boolean>(true);
  const [clientsError, setClientsError] = useState<string | null>(null);
  const [readOnlyNotice, setReadOnlyNotice] = useState<string | null>(null);

  // Load clients strictly from Supabase public.profiles & public.merchant_shops
  const loadClients = useCallback(async () => {
    setIsLoadingClients(true);
    setClientsError(null);
    try {
      const result = await fetchSupabaseClients();
      if (result.error) {
        setClientsError(result.error);
        setSupabaseClients([]);
      } else {
        try {
          const storedRaw = localStorage.getItem('fariousy_client_custom_rates_v1');
          const storedRates = storedRaw ? JSON.parse(storedRaw) : {};
          const clientsWithExtras = result.clients.map(c => {
            const localKyc = getLocalKycDocs([c.id, (c as any).shopId, c.email]);
            return {
              ...c,
              customRates: storedRates[c.id] || c.customRates || {},
              cinNumber: c.cinNumber || localKyc?.cinNumber,
              cinPhotoUrl: c.cinPhotoUrl || localKyc?.cinPhotoUrl,
              cinBackPhotoUrl: c.cinBackPhotoUrl || localKyc?.cinBackPhotoUrl
            };
          });
          setSupabaseClients(clientsWithExtras);
        } catch {
          setSupabaseClients(result.clients);
        }
        setClientsError(null);
      }
    } catch (err: any) {
      setClientsError(err.message || 'Impossible de charger les clients depuis Supabase.');
      setSupabaseClients([]);
    } finally {
      setIsLoadingClients(false);
    }
  }, []);

  useEffect(() => {
    loadClients();
  }, [loadClients]);

  // Navigation sub-tabs (Section 3: Liste des clients, Ajouter un client, Demandes d'inscription, Clients en attente, Clients suspendus)
  const [subTab, setSubTab] = useState<'liste' | 'ajouter' | 'demandes' | 'en_attente' | 'suspendus'>(defaultSubTab);
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  React.useEffect(() => {
    setSubTab(defaultSubTab);
  }, [defaultSubTab]);

  React.useEffect(() => {
    if (externalSubTab?.nonce) {
      setSubTab(externalSubTab.tab);
    }
  }, [externalSubTab?.nonce, externalSubTab?.tab]);

  React.useEffect(() => {
    if (focusSearchNonce) {
      setTimeout(() => searchInputRef.current?.focus(), 60);
    }
  }, [focusSearchNonce]);

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedClientDetail, setSelectedClientDetail] = useState<UserProfile | null>(null);
  const [previewDocPhoto, setPreviewDocPhoto] = useState<{ src: string; title: string } | null>(null);
  const [showRateModalClient, setShowRateModalClient] = useState<UserProfile | null>(null);
  const [clientRateDraft, setClientRateDraft] = useState<Record<string, number>>({});
  const [clientRateSearch, setClientRateSearch] = useState('');
  const [clientRateSuccessMsg, setClientRateSuccessMsg] = useState<string | null>(null);

  const handleOpenRateModal = (client: UserProfile) => {
    setShowRateModalClient(client);
    setClientRateDraft({ ...(client.customRates || {}) });
    setClientRateSearch('');
    setClientRateSuccessMsg(null);
  };

  const handleSaveClientRates = () => {
    if (!showRateModalClient) return;
    setClientCustomRates(showRateModalClient.id, clientRateDraft);

    setSupabaseClients(prev =>
      prev.map(c => (c.id === showRateModalClient.id ? { ...c, customRates: clientRateDraft } : c))
    );
    if (selectedClientDetail && selectedClientDetail.id === showRateModalClient.id) {
      setSelectedClientDetail(prev => (prev ? { ...prev, customRates: clientRateDraft } : null));
    }
    setClientRateSuccessMsg('Grille tarifaire enregistrée avec succès !');
    setTimeout(() => {
      setClientRateSuccessMsg(null);
      setShowRateModalClient(null);
    }, 1000);
  };

  const handleResetClientRates = () => {
    if (!showRateModalClient) return;
    if (confirm(`Rétablir tous les tarifs standard pour "${showRateModalClient.companyName || showRateModalClient.name}" ?`)) {
      resetClientCustomRates(showRateModalClient.id);
      setClientRateDraft({});
      setSupabaseClients(prev =>
        prev.map(c => (c.id === showRateModalClient.id ? { ...c, customRates: {} } : c))
      );
      if (selectedClientDetail && selectedClientDetail.id === showRateModalClient.id) {
        setSelectedClientDetail(prev => (prev ? { ...prev, customRates: {} } : null));
      }
      setClientRateSuccessMsg('Tarifs réinitialisés à la grille standard des villes.');
    }
  };

  // Client Password Reset Modal State
  const [passwordResetClient, setPasswordResetClient] = useState<UserProfile | null>(null);
  const [newClientPasswordInput, setNewClientPasswordInput] = useState('');
  const [showClientPassword, setShowClientPassword] = useState(false);
  const [isUpdatingClientPassword, setIsUpdatingClientPassword] = useState(false);
  const [clientPasswordSuccess, setClientPasswordSuccess] = useState<{
    password: string;
    client: UserProfile;
  } | null>(null);
  const [clientPasswordError, setClientPasswordError] = useState<string | null>(null);
  const [copiedCredentials, setCopiedCredentials] = useState(false);

  const generateFriendlyPassword = () => {
    const num = Math.floor(1000 + Math.random() * 9000);
    return `Far@${num}`;
  };

  const handleOpenPasswordReset = (client: UserProfile) => {
    setPasswordResetClient(client);
    setNewClientPasswordInput(generateFriendlyPassword());
    setShowClientPassword(true);
    setIsUpdatingClientPassword(false);
    setClientPasswordSuccess(null);
    setClientPasswordError(null);
    setCopiedCredentials(false);
  };

  const handleSaveClientPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passwordResetClient) return;
    const cleanPass = newClientPasswordInput.trim();
    if (cleanPass.length < 8) {
      setClientPasswordError('Le mot de passe doit comporter au moins 8 caractères.');
      return;
    }

    setIsUpdatingClientPassword(true);
    setClientPasswordError(null);

    try {
      const res = await updateClientPassword(passwordResetClient.id, cleanPass, {
        name: currentUser?.name || 'Administrateur',
        role: currentUser?.role || 'admin'
      });

      if (res.success) {
        setClientPasswordSuccess({
          password: cleanPass,
          client: passwordResetClient
        });
        setSupabaseClients(prev =>
          prev.map(c => (c.id === passwordResetClient.id ? { ...c, password: cleanPass } : c))
        );
      } else {
        setClientPasswordError(res.error || 'Erreur lors de la mise à jour du mot de passe.');
      }
    } catch (err: any) {
      setClientPasswordError(err.message || 'Erreur réseau lors de la mise à jour.');
    } finally {
      setIsUpdatingClientPassword(false);
    }
  };

  // Edit Client Modal
  const [editingClient, setEditingClient] = useState<UserProfile | null>(null);
  const [editClientName, setEditClientName] = useState('');
  const [editClientCompany, setEditClientCompany] = useState('');
  const [editClientEmail, setEditClientEmail] = useState('');
  const [editClientPhone, setEditClientPhone] = useState('');
  const [editClientWhatsapp, setEditClientWhatsapp] = useState('');
  const [editClientCity, setEditClientCity] = useState('');
  const [editClientAddress, setEditClientAddress] = useState('');
  const [editClientActivity, setEditClientActivity] = useState('');
  const [editClientBankName, setEditClientBankName] = useState('');
  const [editClientBankRib, setEditClientBankRib] = useState('');
  const [isSavingEdit, setIsSavingEdit] = useState<boolean>(false);
  const [editClientError, setEditClientError] = useState<string | null>(null);
  const [editClientSuccessMsg, setEditClientSuccessMsg] = useState<string | null>(null);

  // Quick Bank/RIB inline editor in Fiche Boutique
  const [isEditingDetailBank, setIsEditingDetailBank] = useState(false);
  const [detailBankName, setDetailBankName] = useState('');
  const [detailBankRib, setDetailBankRib] = useState('');
  const [isSavingDetailBank, setIsSavingDetailBank] = useState(false);
  const [detailBankNotice, setDetailBankNotice] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Delete Client Modal
  const [deletingClient, setDeletingClient] = useState<UserProfile | null>(null);

  // Approval Modal with Tariff Configuration (Section 4)
  const [approvingClient, setApprovingClient] = useState<UserProfile | null>(null);
  const [approvalRates, setApprovalRates] = useState<Record<string, number>>({});

  // Reject / Suspend Modal
  const [actionReasonModal, setActionReasonModal] = useState<{
    client: UserProfile;
    action: 'refuse' | 'suspendu';
  } | null>(null);
  const [actionReason, setActionReason] = useState('');

  // Status Modal (Désactiver / Réactiver dans Supabase — Étape 78)
  const [statusModal, setStatusModal] = useState<{
    client: UserProfile;
    targetStatus: 'suspendu' | 'approuve';
    actionLabel: string;
  } | null>(null);
  const [statusReasonText, setStatusReasonText] = useState('');
  const [isUpdatingStatus, setIsUpdatingStatus] = useState<boolean>(false);
  const [statusModalError, setStatusModalError] = useState<string | null>(null);
  const [statusFeedbackBanner, setStatusFeedbackBanner] = useState<{
    message: string;
    type: 'success' | 'error';
  } | null>(null);

  // New Client Form
  const [newClientName, setNewClientName] = useState('');
  const [newClientCompany, setNewClientCompany] = useState('');
  const [newClientEmail, setNewClientEmail] = useState('');
  const [newClientPhone, setNewClientPhone] = useState('');
  const [newClientWhatsapp, setNewClientWhatsapp] = useState('');
  const [newClientCity, setNewClientCity] = useState(cities[0]?.name || 'Casablanca');
  const [newClientAddress, setNewClientAddress] = useState('');
  const [newClientActivity, setNewClientActivity] = useState('Mode & Prêt-à-porter');

  // Supabase Client Creation States (Étape 64)
  const [isSubmittingClient, setIsSubmittingClient] = useState<boolean>(false);
  const [submitClientError, setSubmitClientError] = useState<string | null>(null);
  const [submitClientSuccess, setSubmitClientSuccess] = useState<{
    message: string;
    clientName: string;
    invitationLink?: string | null;
  } | null>(null);
  const [copiedLink, setCopiedLink] = useState<boolean>(false);

  // Real production clients from Supabase only (NEVER INITIAL_USERS)
  const rawClients = supabaseClients;
  const clients = searchTerm.trim()
    ? rawClients.filter(c =>
        (c.companyName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (c.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (c.email || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (c.phone || '').includes(searchTerm) ||
        (c.city || '').toLowerCase().includes(searchTerm.toLowerCase())
      )
    : rawClients;

  const pendingClients = clients.filter(c => c.status === 'en_attente' || c.status === 'pending');
  const suspendedClients = clients.filter(c => c.status === 'suspendu');
  const approvedClients = clients.filter(c => c.status === 'approuve' || c.status === 'active');

  const handleAddClientSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitClientError(null);
    setSubmitClientSuccess(null);

    // 1. Mandatory field checks
    if (!newClientCompany.trim()) {
      setSubmitClientError('Le nom de la boutique est obligatoire.');
      return;
    }
    if (!newClientName.trim()) {
      setSubmitClientError('Le nom du responsable est obligatoire.');
      return;
    }
    if (!newClientPhone.trim()) {
      setSubmitClientError('Le numéro de téléphone est obligatoire.');
      return;
    }
    if (!newClientEmail.trim()) {
      setSubmitClientError("L'adresse e-mail est obligatoire.");
      return;
    }
    if (!newClientCity.trim()) {
      setSubmitClientError('La ville de collecte est obligatoire.');
      return;
    }
    if (!newClientAddress.trim()) {
      setSubmitClientError("L'adresse complète de ramassage est obligatoire.");
      return;
    }

    // 2. Duplicate detection in client list
    const duplicate = supabaseClients.find(
      c => c.email.toLowerCase() === newClientEmail.trim().toLowerCase()
    );
    if (duplicate) {
      setSubmitClientError(`Un compte client avec l'adresse e-mail "${newClientEmail.trim()}" existe déjà.`);
      return;
    }

    setIsSubmittingClient(true);
    try {
      const res = await createSupabaseClient({
        shopName: newClientCompany.trim(),
        managerName: newClientName.trim(),
        phone: newClientPhone.trim(),
        whatsapp: newClientWhatsapp.trim() || newClientPhone.trim(),
        email: newClientEmail.trim(),
        city: newClientCity.trim(),
        address: newClientAddress.trim(),
        activityType: newClientActivity || 'Commerce général',
        isTest: false
      });

      if (!res.success) {
        setSubmitClientError(res.error || "Échec de l'enregistrement du client dans Supabase.");
        return;
      }

      setSubmitClientSuccess({
        message: res.message || 'Client enregistré avec succès dans Supabase.',
        clientName: newClientCompany.trim(),
        invitationLink: res.invitationLink
      });

      setNewClientCompany('');
      setNewClientName('');
      setNewClientEmail('');
      setNewClientPhone('');
      setNewClientWhatsapp('');
      setNewClientAddress('');
      await loadClients();
    } catch (err: any) {
      setSubmitClientError(err.message || 'Erreur réseau lors de la création du client.');
    } finally {
      setIsSubmittingClient(false);
    }
  };

  const handleStartApproval = (client: UserProfile) => {
    setApprovingClient(client);
    // Initialize rates with either existing custom rates or default city rates
    const initialRates: Record<string, number> = {};
    cities.forEach(c => {
      initialRates[c.name] = client.customRates?.[c.name] !== undefined ? client.customRates[c.name] : c.defaultFee;
    });
    setApprovalRates(initialRates);
  };

  const handleConfirmApproval = (e: React.FormEvent) => {
    e.preventDefault();
    if (approvingClient) {
      approveClient(
        approvingClient.id,
        currentUser?.name || 'Direction FARIOUSY',
        approvalRates
      );
      setApprovingClient(null);
    }
  };

  const handleConfirmReasonAction = (e: React.FormEvent) => {
    e.preventDefault();
    if (!actionReasonModal) return;

    if (actionReasonModal.action === 'refuse') {
      rejectClient(actionReasonModal.client.id, actionReason || 'Critères non conformes');
    } else {
      suspendClient(actionReasonModal.client.id, actionReason || 'Suspendu par administration');
    }

    setActionReasonModal(null);
    setActionReason('');
  };

  // Gestion de la désactivation / réactivation dans Supabase (Étape 78)
  const handleOpenStatusModal = (client: UserProfile, targetStatus: 'suspendu' | 'approuve') => {
    setStatusModal({
      client,
      targetStatus,
      actionLabel: targetStatus === 'suspendu' ? 'Désactiver (Suspendre)' : 'Réactiver'
    });
    setStatusReasonText('');
    setStatusModalError(null);
  };

  const handleConfirmStatusModal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!statusModal) return;

    setIsUpdatingStatus(true);
    setStatusModalError(null);

    try {
      const res = await toggleSupabaseClientStatus(
        statusModal.client.id,
        statusModal.targetStatus,
        statusReasonText.trim()
      );

      if (!res.success) {
        setStatusModalError(res.error || "Échec de la modification du statut dans Supabase.");
        return;
      }

      // Synchronisation état local contexte
      toggleClientStatus(
        statusModal.client.id,
        statusModal.targetStatus === 'approuve' ? 'active' : 'inactive',
        currentUser ? { name: currentUser.name, role: currentUser.role } : undefined,
        true
      );

      // Rechargement réel depuis Supabase
      await loadClients();

      // Mise à jour de la fiche si ouverte
      if (selectedClientDetail && selectedClientDetail.id === statusModal.client.id) {
        setSelectedClientDetail(prev =>
          prev
            ? {
                ...prev,
                status: statusModal.targetStatus === 'approuve' ? 'approuve' : 'suspendu',
                accountStatus: statusModal.targetStatus === 'approuve' ? 'approuve' : 'suspendu',
                statusReason: statusModal.targetStatus === 'suspendu' ? (statusReasonText.trim() || "Compte suspendu par l'administration") : undefined
              }
            : null
        );
      }

      setStatusFeedbackBanner({
        message: res.message || 'Statut mis à jour avec succès dans Supabase.',
        type: 'success'
      });
      setTimeout(() => setStatusFeedbackBanner(null), 4000);

      setStatusModal(null);
      setStatusReasonText('');
    } catch (err: any) {
      setStatusModalError(err.message || 'Erreur lors de la mise à jour du statut.');
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const handleStartEdit = (client: UserProfile) => {
    setEditingClient(client);
    setEditClientName((client.name || '').trim());
    setEditClientCompany((client.companyName || '').trim() || (client.name || '').trim());
    setEditClientEmail(client.email || '');
    setEditClientPhone(client.phone || '');
    setEditClientWhatsapp(client.whatsapp || client.phone || '');
    setEditClientCity(client.city || cities[0]?.name || 'Casablanca');
    setEditClientAddress(client.address || '');
    setEditClientActivity(client.activityType || 'Commerce général');
    setEditClientBankName(client.bankName || '');
    setEditClientBankRib((client.bankRib || '').replace(/[^0-9]/g, '').slice(0, 24));
    setEditClientError(null);
    setEditClientSuccessMsg(null);
  };

  const handleSaveDetailBank = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClientDetail) return;
    const cleanRib = detailBankRib.replace(/[^0-9]/g, '');
    const cleanBank = detailBankName.trim();
    if (cleanRib.length > 0 && cleanRib.length !== 24) {
      setDetailBankNotice({
        type: 'error',
        text: 'Le RIB bancaire doit contenir exactement 24 chiffres.'
      });
      return;
    }
    if (cleanRib.length === 24 && !cleanBank) {
      setDetailBankNotice({
        type: 'error',
        text: 'Veuillez saisir le nom de la banque avec le RIB.'
      });
      return;
    }

    setIsSavingDetailBank(true);
    setDetailBankNotice(null);
    try {
      const res = await updateSupabaseClientBank(selectedClientDetail.id, {
        bankName: cleanBank,
        bankRib: cleanRib
      });
      if (!res.success) {
        setDetailBankNotice({ type: 'error', text: res.error || 'Échec de la sauvegarde du RIB.' });
        return;
      }

      updateClient(
        selectedClientDetail.id,
        { bankName: cleanBank, bankRib: cleanRib },
        currentUser ? { name: currentUser.name, role: currentUser.role } : undefined
      );
      setSupabaseClients(prev =>
        prev.map(c => (c.id === selectedClientDetail.id ? { ...c, bankName: cleanBank, bankRib: cleanRib } : c))
      );
      setSelectedClientDetail(prev =>
        prev ? { ...prev, bankName: cleanBank, bankRib: cleanRib } : null
      );
      setDetailBankNotice({ type: 'success', text: 'RIB bancaire enregistré avec succès !' });
      setIsEditingDetailBank(false);
    } catch (err: any) {
      setDetailBankNotice({ type: 'error', text: err?.message || 'Erreur lors de la sauvegarde.' });
    } finally {
      setIsSavingDetailBank(false);
    }
  };

  const handleSaveEditClient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingClient) return;

    const resolvedCompany = (
      editClientCompany.trim() ||
      editClientName.trim() ||
      editingClient.companyName ||
      editingClient.name ||
      ''
    ).trim();
    const resolvedManager = (editClientName.trim() || resolvedCompany).trim();
    const resolvedPhone = (editClientPhone.trim() || editingClient.phone || '').trim();
    const resolvedCity = (editClientCity.trim() || editingClient.city || 'Casablanca').trim();
    const resolvedAddress = (editClientAddress.trim() || editingClient.address || resolvedCity).trim();

    if (!resolvedCompany) {
      setEditClientError('Le nom de la boutique est obligatoire.');
      return;
    }
    if (!resolvedManager) {
      setEditClientError('Le nom du responsable est obligatoire.');
      return;
    }
    if (!resolvedPhone) {
      setEditClientError('Le numéro de téléphone est obligatoire.');
      return;
    }

    const cleanEditRib = editClientBankRib.replace(/[^0-9]/g, '');
    if (cleanEditRib.length > 0 && cleanEditRib.length !== 24) {
      setEditClientError('Le RIB bancaire doit contenir exactement 24 chiffres.');
      return;
    }
    if (cleanEditRib.length === 24 && !editClientBankName.trim()) {
      setEditClientError('Veuillez saisir le nom de la banque avec le RIB.');
      return;
    }

    setIsSavingEdit(true);
    setEditClientError(null);
    setEditClientSuccessMsg(null);

    try {
      // 2. Appel serveur sécurisé pour modifier public.profiles et public.merchant_shops
      const res = await updateSupabaseClient(editingClient.id, {
        shopName: resolvedCompany,
        managerName: resolvedManager,
        phone: resolvedPhone,
        whatsapp: editClientWhatsapp.trim() || resolvedPhone,
        city: resolvedCity,
        address: resolvedAddress,
        activityType: editClientActivity.trim() || 'Commerce général',
        bankName: editClientBankName.trim(),
        bankRib: cleanEditRib
      });

      if (!res.success) {
        setEditClientError(res.error || "Échec de l'enregistrement des modifications dans Supabase.");
        return;
      }

      // 3. Mise à jour de l'état local dans DatabaseContext
      updateClient(
        editingClient.id,
        {
          name: resolvedManager,
          companyName: resolvedCompany,
          phone: resolvedPhone,
          whatsapp: editClientWhatsapp.trim() || resolvedPhone,
          city: resolvedCity,
          address: resolvedAddress,
          activityType: editClientActivity.trim(),
          bankName: editClientBankName.trim(),
          bankRib: cleanEditRib
        },
        currentUser ? { name: currentUser.name, role: currentUser.role } : undefined
      );

      // 4. Actualisation automatique de la liste des clients depuis Supabase
      await loadClients();

      // 5. Mise à jour automatique de la fiche client si le tiroir de détail est ouvert
      if (selectedClientDetail && selectedClientDetail.id === editingClient.id) {
        setSelectedClientDetail(prev =>
          prev
            ? {
                ...prev,
                name: resolvedManager,
                companyName: resolvedCompany,
                phone: resolvedPhone,
                whatsapp: editClientWhatsapp.trim() || resolvedPhone,
                city: resolvedCity,
                address: resolvedAddress,
                activityType: editClientActivity.trim(),
                bankName: editClientBankName.trim(),
                bankRib: cleanEditRib
              }
            : null
        );
      }

      setEditClientSuccessMsg(res.message || 'Modifications enregistrées avec succès dans Supabase.');

      // Fermeture après confirmation visuelle
      setTimeout(() => {
        setEditingClient(null);
        setEditClientSuccessMsg(null);
      }, 1200);
    } catch (err: any) {
      setEditClientError(err.message || 'Erreur lors de la modification du client.');
    } finally {
      setIsSavingEdit(false);
    }
  };

  const handleConfirmDeleteClient = async (reason?: string) => {
    if (!deletingClient) return;
    const target = deletingClient;
    setDeletingClient(null);
    setStatusFeedbackBanner(null);

    const res = await deleteClient(
      target.id,
      reason,
      currentUser ? { name: currentUser.name, role: currentUser.role } : undefined
    );

    if (res.success) {
      setSupabaseClients(prev => prev.filter(c => c.id !== target.id));
      if (selectedClientDetail && selectedClientDetail.id === target.id) {
        setSelectedClientDetail(null);
      }
      setStatusFeedbackBanner({
        type: 'success',
        message: res.message || `Le client "${target.companyName || target.name}" a été supprimé définitivement de Supabase.`
      });
    } else {
      setStatusFeedbackBanner({
        type: 'error',
        message: res.error || 'Impossible de supprimer le client dans Supabase.'
      });
    }
  };

  const handleExportClientsCSV = () => {
    const rows = clients.map(c => ({
      ID: c.id,
      Boutique: c.companyName || c.name,
      Responsable: c.name,
      Email: c.email,
      Telephone: c.phone,
      WhatsApp: c.whatsapp || '',
      Ville: c.city || '',
      Statut: c.status,
      Activite: c.activityType || '',
      Date_Inscription: c.registeredAt
    }));
    const header = Object.keys(rows[0] || {}).join(',');
    const csv = [header, ...rows.map(r => Object.values(r).map(v => `"${v}"`).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `fariousy_clients_${new Date().toISOString().substring(0, 10)}.csv`;
    a.click();
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approuve':
      case 'active':
        return (
          <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-800 border border-emerald-200">
            APPROUVÉ
          </span>
        );
      case 'en_attente':
      case 'pending':
        return (
          <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-100 text-amber-900 border border-amber-200 animate-pulse">
            EN ATTENTE
          </span>
        );
      case 'refuse':
        return (
          <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-rose-100 text-rose-800 border border-rose-200">
            REFUSÉ
          </span>
        );
      case 'suspendu':
        return (
          <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-slate-200 text-slate-800 border border-slate-300">
            SUSPENDU
          </span>
        );
      default:
        return (
          <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-slate-100 text-slate-700">
            {status}
          </span>
        );
    }
  };

  if (!isAdmin) {
    return (
      <div className="p-8 text-center bg-white border border-rose-200 rounded-2xl shadow-2xs space-y-3 my-6">
        <ShieldAlert className="w-12 h-12 text-rose-600 mx-auto" />
        <h3 className="text-base font-extrabold text-slate-900">Accès Réservé aux Administrateurs</h3>
        <p className="text-xs text-slate-500 max-w-md mx-auto">
          Sécurité RLS Supabase : vous devez être authentifié avec le rôle Administrateur dans la table <code className="text-slate-800 bg-slate-100 px-1 py-0.5 rounded-sm font-mono">public.profiles</code> pour accéder au module de gestion des clients.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-xl font-black text-slate-900 tracking-tight">
              Gestion des Boutiques & Comptes Clients
            </h2>
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
              <Database className="w-3 h-3 text-emerald-600" />
              <span>Supabase Production (public.profiles & public.merchant_shops)</span>
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Chargement direct depuis PostgreSQL • Données de production • RLS active • Mode lecture seule (Étape 62)
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            onClick={loadClients}
            disabled={isLoadingClients}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl shadow-2xs transition-all cursor-pointer disabled:opacity-50"
            title="Rafraîchir les données depuis Supabase"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoadingClients ? 'animate-spin text-red-600' : 'text-slate-600'}`} />
            <span>Actualiser</span>
          </button>

          <button
            onClick={() => setSubTab('ajouter')}
            className={`flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-xl transition-all shadow-xs cursor-pointer ${
              subTab === 'ajouter'
                ? 'bg-slate-900 text-white ring-2 ring-red-500'
                : 'bg-red-600 hover:bg-red-700 text-white'
            }`}
            title="Enregistrer un nouveau client dans Supabase"
          >
            <UserPlus className="w-4 h-4" />
            <span>Ajouter un Client</span>
          </button>
        </div>
      </div>

      {/* Status Feedback Banner (Étape 78) */}
      {statusFeedbackBanner && (
        <div className={`p-3.5 rounded-xl border flex items-center justify-between text-xs animate-in fade-in ${
          statusFeedbackBanner.type === 'success'
            ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
            : 'bg-red-50 border-red-200 text-red-900'
        }`}>
          <div className="flex items-center gap-2">
            {statusFeedbackBanner.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
            )}
            <span className="font-semibold">{statusFeedbackBanner.message}</span>
          </div>
          <button
            onClick={() => setStatusFeedbackBanner(null)}
            className={`${statusFeedbackBanner.type === 'success' ? 'text-emerald-700 hover:text-emerald-900' : 'text-red-700 hover:text-red-900'} p-1 cursor-pointer`}
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Read-only notification banner */}
      {readOnlyNotice && (
        <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-center justify-between text-xs text-amber-900 animate-in fade-in">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
            <span>{readOnlyNotice}</span>
          </div>
          <button
            onClick={() => setReadOnlyNotice(null)}
            className="text-amber-700 hover:text-amber-900 font-bold p-1 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Search Input */}
      <div className="relative">
        <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
        <input
          ref={searchInputRef}
          type="text"
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          placeholder="Rechercher par nom de boutique, gérant, e-mail, téléphone ou ville dans Supabase..."
          className="w-full pl-10 pr-16 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500 shadow-2xs text-slate-800"
        />
        {searchTerm && (
          <button
            onClick={() => setSearchTerm('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs font-semibold cursor-pointer"
          >
            Effacer
          </button>
        )}
      </div>

      {/* Sub-Navigation Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
        <button
          onClick={() => setSubTab('liste')}
          className={`px-3.5 py-2 rounded-xl font-bold transition-all shrink-0 flex items-center gap-2 ${
            subTab === 'liste'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
          }`}
        >
          <Users className="w-4 h-4 text-red-500" />
          <span>Liste des clients ({approvedClients.length})</span>
        </button>

        <button
          onClick={() => setSubTab('demandes')}
          className={`px-3.5 py-2 rounded-xl font-bold transition-all shrink-0 flex items-center gap-2 ${
            subTab === 'demandes'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
          }`}
        >
          <Store className="w-4 h-4 text-amber-500" />
          <span>Demandes d'inscription ({clients.length})</span>
          {pendingClients.length > 0 && (
            <span className="font-mono text-[10px] px-1.5 py-0.2 bg-amber-500 text-slate-950 font-black rounded-full">
              {pendingClients.length}
            </span>
          )}
        </button>

        <button
          onClick={() => setSubTab('en_attente')}
          className={`px-3.5 py-2 rounded-xl font-bold transition-all shrink-0 flex items-center gap-2 ${
            subTab === 'en_attente'
              ? 'bg-amber-600 text-white shadow-xs'
              : 'bg-white border border-slate-200 text-amber-800 hover:bg-amber-50'
          }`}
        >
          <Clock className="w-4 h-4" />
          <span>Clients en attente ({pendingClients.length})</span>
        </button>

        <button
          onClick={() => setSubTab('suspendus')}
          className={`px-3.5 py-2 rounded-xl font-bold transition-all shrink-0 flex items-center gap-2 ${
            subTab === 'suspendus'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
          }`}
        >
          <ShieldAlert className="w-4 h-4 text-rose-500" />
          <span>Clients suspendus ({suspendedClients.length})</span>
        </button>
      </div>

      {/* STATE 1: LOADING SPINNER */}
      {isLoadingClients && (
        <div className="p-12 text-center bg-white border border-slate-200 rounded-2xl shadow-2xs space-y-3">
          <div className="w-8 h-8 border-3 border-red-200 border-t-red-600 rounded-full animate-spin mx-auto" />
          <p className="text-xs font-bold text-slate-800">
            Chargement des clients depuis la base Supabase de production...
          </p>
          <p className="text-[11px] text-slate-500">
            Interrogation des tables <code className="text-slate-700 bg-slate-100 px-1 py-0.5 rounded-sm font-mono">public.profiles</code> et <code className="text-slate-700 bg-slate-100 px-1 py-0.5 rounded-sm font-mono">public.merchant_shops</code>
          </p>
        </div>
      )}

      {/* STATE 2: EXPLICIT ERROR BANNER (NEVER FALLBACK TO FAKE DATA) */}
      {!isLoadingClients && clientsError && (
        <div className="p-6 bg-rose-50 border border-rose-200 rounded-2xl shadow-2xs space-y-3">
          <div className="flex items-center gap-2 text-rose-800 font-bold text-sm">
            <AlertCircle className="w-5 h-5 shrink-0 text-rose-600" />
            <span>Erreur lors du chargement des clients depuis Supabase</span>
          </div>
          <div className="text-xs text-rose-700 bg-white/80 p-3 rounded-xl border border-rose-200 font-mono break-all">
            {clientsError}
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={loadClients}
              className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer flex items-center gap-1.5"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Réessayer la connexion</span>
            </button>
            {/expir|invalide|authentifi|jeton|401/i.test(clientsError) && (
              <button
                onClick={() => logout()}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer flex items-center gap-1.5"
              >
                <LogIn className="w-3.5 h-3.5" />
                <span>Se reconnecter</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* STATE 3: VIEW DEMANDES / EN ATTENTE / SUSPENDUS TABLE */}
      {!isLoadingClients && !clientsError && (subTab === 'demandes' || subTab === 'en_attente' || subTab === 'suspendus') && (
        <div className="bg-white border border-slate-200 rounded-2xl shadow-2xs overflow-hidden space-y-3">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                {subTab === 'demandes'
                  ? "Toutes les Demandes d'Inscription des Boutiques (Supabase)"
                  : subTab === 'en_attente'
                  ? "Demandes d'Inscription en Attente de Validation (Supabase)"
                  : 'Boutiques Actuellement Suspendues (Supabase)'}
              </h3>
              <p className="text-xs text-slate-500">
                Données réelles issues des tables <code className="text-slate-700 font-mono">public.profiles</code> et <code className="text-slate-700 font-mono">public.merchant_shops</code>
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">Nom de la Boutique</th>
                  <th className="py-3 px-4">Responsable</th>
                  <th className="py-3 px-4">Téléphone & WhatsApp</th>
                  <th className="py-3 px-4">Ville</th>
                  <th className="py-3 px-4">Date d'Inscription</th>
                  <th className="py-3 px-4">Statut</th>
                  <th className="py-3 px-4 text-right">Actions Disponibles</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {clients
                  .filter(c => {
                    if (subTab === 'en_attente') return c.status === 'en_attente' || c.status === 'pending';
                    if (subTab === 'suspendus') return c.status === 'suspendu';
                    return true;
                  })
                  .map(client => {
                    const isPending = client.status === 'en_attente' || client.status === 'pending';
                    const isApproved = client.status === 'approuve' || client.status === 'active';
                    const isSuspended = client.status === 'suspendu';

                    return (
                      <tr key={client.id} className="hover:bg-slate-50 transition-colors">
                        {/* 1. Nom boutique */}
                        <td className="py-3 px-4">
                          <span className="font-extrabold text-slate-900 block text-sm">
                            {client.companyName || client.name}
                          </span>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-[11px] text-slate-500">
                              {client.activityType || 'Commerce général'}
                            </span>
                            {client.cinPhotoUrl && (
                              <button
                                type="button"
                                onClick={() =>
                                  setPreviewDocPhoto({
                                    src: client.cinPhotoUrl!,
                                    title: `CIN — ${client.companyName || client.name}`
                                  })
                                }
                                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold hover:bg-emerald-100 cursor-pointer"
                              >
                                <CreditCard className="w-2.5 h-2.5" />
                                <span>CIN ✓</span>
                              </button>
                            )}
                          </div>
                        </td>

                        {/* 2. Responsable */}
                        <td className="py-3 px-4">
                          <span className="font-bold text-slate-800 block">{client.name}</span>
                          <span className="text-[11px] text-slate-500 truncate block max-w-[150px]">
                            {client.email}
                          </span>
                        </td>

                        {/* 3. Téléphone */}
                        <td className="py-3 px-4">
                          <div className="font-mono font-bold text-slate-800">{client.phone}</div>
                          {client.whatsapp && (
                            <div className="text-[10px] text-emerald-600 font-semibold flex items-center gap-1 mt-0.5">
                              <span>WhatsApp:</span>
                              <span className="font-mono">{client.whatsapp}</span>
                            </div>
                          )}
                        </td>

                        {/* 4. Ville */}
                        <td className="py-3 px-4">
                          <span className="font-bold text-slate-900 block">{client.city}</span>
                          <span className="text-[11px] text-slate-500 truncate block max-w-[160px]">
                            {client.address}
                          </span>
                        </td>

                        {/* 5. Date d'inscription */}
                        <td className="py-3 px-4 font-mono text-slate-600 text-[11px]">
                          {client.registeredAt ? formatDate(client.registeredAt) : 'N/A'}
                        </td>

                        {/* 6. Statut */}
                        <td className="py-3 px-4">
                          {getStatusBadge(client.status)}
                          {client.statusReason && (
                            <span className="block text-[10px] text-rose-600 mt-1 max-w-[160px] truncate">
                              {client.statusReason}
                            </span>
                          )}
                        </td>

                        {/* 7. Actions */}
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5 flex-wrap">
                            <button
                              onClick={() => impersonateUser(client)}
                              title="Se connecter directement au compte de cette boutique (دخول للكونط)"
                              className="px-2.5 py-1.5 text-xs font-bold text-white bg-red-600 hover:bg-red-700 rounded-lg shadow-xs transition-all flex items-center gap-1 cursor-pointer active:scale-95"
                            >
                              <LogIn className="w-3.5 h-3.5" />
                              <span>Connexion</span>
                            </button>

                            <button
                              onClick={() => setSelectedClientDetail(client)}
                              title="Voir les détails complets de la boutique"
                              className="px-2.5 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              <span>Fiche</span>
                            </button>

                            <button
                              onClick={() => handleStartEdit(client)}
                              title="Modifier les informations de la boutique"
                              className="px-2.5 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 hover:text-red-600 rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
                            >
                              <Edit2 className="w-3.5 h-3.5 text-slate-500" />
                              <span>Modifier</span>
                            </button>

                            <button
                              onClick={() => handleOpenRateModal(client)}
                              title="Gérer les tarifs négociés pour cette boutique (تبديل ومسح)"
                              className="px-2.5 py-1.5 text-xs font-bold text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
                            >
                              <Tag className="w-3.5 h-3.5 text-red-600" />
                              <span>التعرفة</span>
                            </button>

                            <button
                              onClick={() => handleOpenPasswordReset(client)}
                              title="تبديل الرمز السري للزبون (Modifier le mot de passe)"
                              className="px-2.5 py-1.5 text-xs font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
                            >
                              <Key className="w-3.5 h-3.5 text-indigo-600" />
                              <span>الرمز السري</span>
                            </button>

                            {/* Boutons Désactiver / Réactiver (Étape 78) */}
                            {client.status === 'suspendu' ? (
                              <button
                                onClick={() => handleOpenStatusModal(client, 'approuve')}
                                title="Réactiver ce compte client dans Supabase"
                                className="px-2.5 py-1.5 text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
                              >
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                                <span>Réactiver</span>
                              </button>
                            ) : (client.status === 'approuve' || client.status === 'active') ? (
                              <button
                                onClick={() => handleOpenStatusModal(client, 'suspendu')}
                                title="Désactiver (suspendre) temporairement ce compte dans Supabase"
                                className="px-2.5 py-1.5 text-xs font-bold text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
                              >
                                <ShieldAlert className="w-3.5 h-3.5 text-amber-600" />
                                <span>Désactiver</span>
                              </button>
                            ) : (
                              <button
                                onClick={() => handleOpenStatusModal(client, 'approuve')}
                                className="px-2 py-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg cursor-pointer"
                                title="Approuver cette demande dans Supabase"
                              >
                                Approuver
                              </button>
                            )}
                            {/* Bouton التحكم في حساب الزبون (Se connecter en tant que ce client) */}
                            <button
                              onClick={() => {
                                switchRole('client', client);
                              }}
                              title="التحكم في حساب هذا الزبون (Accéder à son espace)"
                              className="px-2.5 py-1.5 text-xs font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
                            >
                              <Lock className="w-3.5 h-3.5 text-indigo-600" />
                              <span>دخول حسابه</span>
                            </button>

                            {/* Bouton مسح وحذف الحساب (Supprimer définitivement) */}
                            <button
                              onClick={() => setDeletingClient(client)}
                              title="حذف هذا العميل نهائياً من النظام"
                              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                            >
                              <Trash2 className="w-4 h-4 text-rose-500" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}

                {clients.length === 0 && (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-400">
                      <Store className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                      <span className="font-bold text-slate-700 block text-sm">Aucun client enregistré</span>
                      <span className="text-xs text-slate-400">Aucune boutique trouvée dans les tables Supabase de production.</span>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* STATE 4: VIEW LISTE DES CLIENTS (CARDS) */}
      {!isLoadingClients && !clientsError && subTab === 'liste' && (
        clients.length === 0 ? (
          <div className="p-12 text-center bg-white border border-slate-200 rounded-2xl shadow-2xs space-y-3">
            <div className="w-12 h-12 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto text-slate-400">
              <Store className="w-6 h-6" />
            </div>
            <h3 className="text-base font-extrabold text-slate-800">Aucun client enregistré</h3>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              Aucun compte client ou boutique n'est actuellement présent dans vos tables Supabase de production (<code className="text-slate-700 bg-slate-100 px-1 py-0.5 rounded-sm font-mono">public.profiles</code> et <code className="text-slate-700 bg-slate-100 px-1 py-0.5 rounded-sm font-mono">public.merchant_shops</code>).
            </p>
            <div className="flex items-center justify-center gap-2 pt-1">
              <button
                onClick={loadClients}
                className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Actualiser</span>
              </button>

              <button
                onClick={() => setSubTab('ajouter')}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-xs cursor-pointer"
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>Ajouter un client</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {clients.map(client => {
              const clientPackages = packages.filter(p => p.clientId === client.id);
              const deliveredPackages = clientPackages.filter(p => p.status === 'livre');
              const unpaidDeliveries = deliveredPackages.filter(p => !p.isPaidToClient);
              const pendingPayout = unpaidDeliveries.reduce((acc, p) => acc + ((p.codAmount || 0) - (p.deliveryFee || 0)), 0);

              return (
                <div
                  key={client.id}
                  className="p-5 bg-white border border-slate-200 rounded-2xl shadow-2xs space-y-4 hover:border-slate-300 transition-all flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h3 className="text-base font-extrabold text-slate-900">
                          {client.companyName || client.name}
                        </h3>
                        <p className="text-xs text-slate-500 font-medium">Contact : {client.name}</p>
                      </div>
                      {getStatusBadge(client.status)}
                    </div>

                    <div className="mt-3 space-y-1 text-xs text-slate-600">
                      <div className="flex items-center gap-2">
                        <Phone className="w-3.5 h-3.5 text-slate-400" />
                        <span className="font-mono">{client.phone}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Mail className="w-3.5 h-3.5 text-slate-400" />
                        <span className="truncate">{client.email}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <MapPin className="w-3.5 h-3.5 text-slate-400" />
                        <span>{client.city}</span>
                      </div>
                    </div>

                    <div className="mt-4 p-3 bg-slate-50 rounded-xl grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <span className="text-[10px] text-slate-400 uppercase font-bold block">Colis Totaux :</span>
                        <span className="font-mono font-extrabold text-slate-900 text-sm">
                          {clientPackages.length}
                        </span>
                        <span className="text-[10px] text-emerald-600 block">
                          {deliveredPackages.length} livrés
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 uppercase font-bold block">Solde à verser :</span>
                        <span className="font-mono font-black text-amber-600 text-sm">
                          {formatMAD(pendingPayout)}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-1.5 flex-wrap">
                    <button
                      onClick={() => impersonateUser(client)}
                      title="Se connecter directement au compte de cette boutique (دخول للكونط)"
                      className="px-2.5 py-1.5 text-xs font-bold text-white bg-red-600 hover:bg-red-700 rounded-xl transition-all flex items-center gap-1 cursor-pointer active:scale-95 shadow-xs"
                    >
                      <LogIn className="w-3.5 h-3.5" />
                      <span>Connexion</span>
                    </button>

                    <button
                      onClick={() => setSelectedClientDetail(client)}
                      className="px-2.5 py-1.5 text-xs font-bold text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors flex items-center gap-1 cursor-pointer"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>Fiche</span>
                    </button>

                    <button
                      onClick={() => handleStartEdit(client)}
                      className="px-2.5 py-1.5 text-xs font-bold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 hover:text-red-600 rounded-xl transition-colors flex items-center gap-1 cursor-pointer"
                    >
                      <Edit2 className="w-3.5 h-3.5 text-slate-500" />
                      <span>Modifier</span>
                    </button>

                    <button
                      onClick={() => handleOpenRateModal(client)}
                      className="px-2.5 py-1.5 text-xs font-bold text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 rounded-xl transition-colors flex items-center gap-1 cursor-pointer"
                    >
                      <Tag className="w-3.5 h-3.5 text-red-600" />
                      <span>التعرفة</span>
                    </button>

                    <button
                      onClick={() => handleOpenPasswordReset(client)}
                      title="تبديل الرمز السري للزبون"
                      className="px-2.5 py-1.5 text-xs font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-xl transition-colors flex items-center gap-1 cursor-pointer"
                    >
                      <Key className="w-3.5 h-3.5 text-indigo-600" />
                      <span>الرمز السري</span>
                    </button>

                    {/* Désactiver / Réactiver (Étape 78) */}
                    {client.status === 'suspendu' ? (
                      <button
                        onClick={() => handleOpenStatusModal(client, 'approuve')}
                        title="Réactiver ce compte client dans Supabase"
                        className="px-2.5 py-1.5 text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-xl transition-colors flex items-center gap-1 cursor-pointer"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Réactiver</span>
                      </button>
                    ) : (client.status === 'approuve' || client.status === 'active') ? (
                      <button
                        onClick={() => handleOpenStatusModal(client, 'suspendu')}
                        title="Désactiver (suspendre) temporairement ce compte dans Supabase"
                        className="px-2.5 py-1.5 text-xs font-bold text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-xl transition-colors flex items-center gap-1 cursor-pointer"
                      >
                        <ShieldAlert className="w-3.5 h-3.5 text-amber-600" />
                        <span>Désactiver</span>
                      </button>
                    ) : null}

                    {/* Bouton التحكم في حساب الزبون (Se connecter en tant que ce client) */}
                    <button
                      onClick={() => {
                        switchRole('client', client);
                      }}
                      title="التحكم في حساب هذا الزبون"
                      className="px-2.5 py-1.5 text-xs font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-xl transition-colors flex items-center gap-1 cursor-pointer"
                    >
                      <Lock className="w-3.5 h-3.5 text-indigo-600" />
                      <span>دخول حسابه</span>
                    </button>

                    {/* Bouton مسح وحذف الحساب */}
                    <button
                      onClick={() => setDeletingClient(client)}
                      title="حذف هذا العميل نهائياً"
                      className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4 text-rose-500" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )
      )}

      {/* VIEW: AJOUTER UN CLIENT (SUPABASE PRODUCTION — ÉTAPE 64) */}
      {subTab === 'ajouter' && (
        <div className="p-6 bg-white border border-slate-200 rounded-2xl shadow-2xs max-w-2xl mx-auto space-y-5 animate-in fade-in">
          <div className="pb-3 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-red-50 text-red-600 flex items-center justify-center">
                <UserPlus className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-base font-extrabold text-slate-900">Enregistrer un Client / Boutique</h3>
                <p className="text-xs text-slate-500">
                  Création sécurisée dans <code className="text-slate-800 font-mono">public.profiles</code> et <code className="text-slate-800 font-mono">public.merchant_shops</code>
                </p>
              </div>
            </div>
            <button
              onClick={() => setSubTab('liste')}
              className="px-3 py-1.5 text-xs font-bold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
            >
              Retour à la liste
            </button>
          </div>

          {/* Success Banner */}
          {submitClientSuccess && (
            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl space-y-3 animate-in fade-in">
              <div className="flex items-start gap-2.5">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <h4 className="text-xs font-bold text-emerald-950">
                    Compte Client Enregistré avec Succès
                  </h4>
                  <p className="text-xs text-emerald-800">{submitClientSuccess.message}</p>
                </div>
              </div>

              {submitClientSuccess.invitationLink && (
                <div className="p-3 bg-white rounded-lg border border-emerald-200 space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-800 flex items-center gap-1.5">
                      <span>🔗 Lien d'invitation sécurisé pour le commerçant :</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        if (submitClientSuccess.invitationLink) {
                          navigator.clipboard.writeText(submitClientSuccess.invitationLink);
                          setCopiedLink(true);
                          setTimeout(() => setCopiedLink(false), 3000);
                        }
                      }}
                      className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[11px] font-bold flex items-center gap-1 transition-all cursor-pointer"
                    >
                      {copiedLink ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedLink ? 'Copié !' : 'Copier le lien'}</span>
                    </button>
                  </div>
                  <input
                    type="text"
                    readOnly
                    value={submitClientSuccess.invitationLink}
                    className="w-full text-[11px] font-mono bg-slate-50 border border-slate-200 rounded-lg p-2 text-slate-600 select-all"
                  />
                  <p className="text-[10px] text-slate-500">
                    🛡️ <strong>Sécurité FARIOUSY :</strong> Aucun mot de passe par défaut n'est généré ni envoyé. Le client utilisera ce lien sécurisé pour choisir son mot de passe lors de sa première connexion.
                  </p>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setSubmitClientSuccess(null);
                    setSubTab('liste');
                  }}
                  className="px-3.5 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-xs font-bold transition-all shadow-xs cursor-pointer"
                >
                  Consulter dans la liste des clients
                </button>
              </div>
            </div>
          )}

          {/* Error Banner */}
          {submitClientError && (
            <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-2.5 text-xs text-rose-900 animate-in fade-in">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div className="space-y-0.5">
                <span className="font-bold block">Impossible d'enregistrer le client :</span>
                <p>{submitClientError}</p>
              </div>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleAddClientSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              {/* Nom Boutique */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Nom de la boutique *
                </label>
                <div className="relative">
                  <Store className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    required
                    value={newClientCompany}
                    onChange={e => setNewClientCompany(e.target.value)}
                    placeholder="Ex: Mode & Style Maroc"
                    className="w-full text-xs bg-slate-50 border border-slate-300 rounded-xl pl-9 pr-3.5 py-2.5 text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-500 font-semibold"
                  />
                </div>
              </div>

              {/* Nom Responsable */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Nom du responsable *
                </label>
                <div className="relative">
                  <Users className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    required
                    value={newClientName}
                    onChange={e => setNewClientName(e.target.value)}
                    placeholder="Ex: Karim Bennani"
                    className="w-full text-xs bg-slate-50 border border-slate-300 rounded-xl pl-9 pr-3.5 py-2.5 text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-500"
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              {/* Téléphone */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Numéro de téléphone *
                </label>
                <div className="relative">
                  <Phone className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="tel"
                    required
                    value={newClientPhone}
                    onChange={e => setNewClientPhone(e.target.value)}
                    placeholder="06 61 22 33 44"
                    className="w-full text-xs font-mono bg-slate-50 border border-slate-300 rounded-xl pl-9 pr-3.5 py-2.5 text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-500"
                  />
                </div>
              </div>

              {/* WhatsApp */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Numéro WhatsApp (optionnel)
                </label>
                <div className="relative">
                  <Phone className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-emerald-500" />
                  <input
                    type="tel"
                    value={newClientWhatsapp}
                    onChange={e => setNewClientWhatsapp(e.target.value)}
                    placeholder="06 61 22 33 44"
                    className="w-full text-xs font-mono bg-slate-50 border border-slate-300 rounded-xl pl-9 pr-3.5 py-2.5 text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-500"
                  />
                </div>
              </div>
            </div>

            {/* Email */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Adresse e-mail du compte *
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="email"
                  required
                  value={newClientEmail}
                  onChange={e => setNewClientEmail(e.target.value)}
                  placeholder="contact@boutiquemaroc.com"
                  className="w-full text-xs bg-slate-50 border border-slate-300 rounded-xl pl-9 pr-3.5 py-2.5 text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-500"
                />
              </div>
              <span className="text-[10px] text-slate-400 mt-1 block">
                Cette adresse servira d'identifiant de connexion Supabase Auth pour le commerçant.
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              {/* Ville */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Ville de collecte *
                </label>
                <div className="relative">
                  <MapPin className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <select
                    value={newClientCity}
                    onChange={e => setNewClientCity(e.target.value)}
                    className="w-full text-xs bg-slate-50 border border-slate-300 rounded-xl pl-9 pr-3 py-2.5 text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-500"
                  >
                    {cities.map(c => (
                      <option key={c.id} value={c.name}>
                        {c.name}
                      </option>
                    ))}
                    <option value="Casablanca">Casablanca</option>
                    <option value="Rabat">Rabat</option>
                    <option value="Marrakech">Marrakech</option>
                    <option value="Tanger">Tanger</option>
                    <option value="Fès">Fès</option>
                    <option value="Agadir">Agadir</option>
                  </select>
                </div>
              </div>

              {/* Activité commerciale */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Activité commerciale
                </label>
                <select
                  value={newClientActivity}
                  onChange={e => setNewClientActivity(e.target.value)}
                  className="w-full text-xs bg-slate-50 border border-slate-300 rounded-xl px-3 py-2.5 text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-500"
                >
                  <option value="Mode & Prêt-à-porter">Mode & Prêt-à-porter</option>
                  <option value="High-Tech & Téléphonie">High-Tech & Téléphonie</option>
                  <option value="Cosmétiques & Beauté">Cosmétiques & Beauté</option>
                  <option value="Chaussures & Maroquinerie">Chaussures & Maroquinerie</option>
                  <option value="Maison & Décoration">Maison & Décoration</option>
                  <option value="Commerce général">Commerce général</option>
                </select>
              </div>
            </div>

            {/* Adresse */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Adresse complète de ramassage *
              </label>
              <textarea
                rows={2}
                required
                value={newClientAddress}
                onChange={e => setNewClientAddress(e.target.value)}
                placeholder="Quartier, rue, numéro de magasin ou dépôt..."
                className="w-full text-xs bg-slate-50 border border-slate-300 rounded-xl p-3 text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-500"
              />
            </div>

            {/* Actions */}
            <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setSubTab('liste')}
                className="px-4 py-2.5 text-xs font-bold text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
              >
                Annuler
              </button>

              <button
                type="submit"
                disabled={isSubmittingClient}
                className="px-5 py-2.5 text-xs font-bold text-white bg-red-600 hover:bg-red-700 rounded-xl shadow-xs transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {isSubmittingClient ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Création en cours dans Supabase...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Créer et Enregistrer dans Supabase</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      )}


      {/* APPROVAL MODAL WITH DELIVERY TARIFF CONFIGURATION (SECTION 4) */}
      {approvingClient && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs no-print">
          <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Approbation & Configuration des Tarifs — {approvingClient.companyName || approvingClient.name}
                </h3>
                <p className="text-xs text-slate-500">
                  Définissez la grille tarifaire de livraison par ville accordée à cette boutique
                </p>
              </div>
              <button onClick={() => setApprovingClient(null)} className="p-2 text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleConfirmApproval} className="p-6 overflow-y-auto space-y-4">
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-1">
                <div className="flex justify-between">
                  <span className="text-slate-500">Boutique :</span>
                  <strong className="text-slate-900">{approvingClient.companyName}</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Responsable :</span>
                  <span className="text-slate-800">{approvingClient.name} ({approvingClient.phone})</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Ville & Adresse :</span>
                  <span className="text-slate-800">{approvingClient.city} — {approvingClient.address}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Validation par :</span>
                  <strong className="text-red-600">{currentUser?.name || 'Administrateur'}</strong>
                </div>
              </div>

              {(approvingClient.cinPhotoUrl || approvingClient.cinBackPhotoUrl || approvingClient.cinNumber) && (
                <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-slate-800 flex items-center gap-1.5">
                      <CreditCard className="w-4 h-4 text-red-600" />
                      <span>البطاقة الوطنية للتاجر (CIN)</span>
                    </span>
                    {approvingClient.cinNumber && (
                      <span className="font-mono font-bold text-slate-800 bg-white px-2 py-0.5 rounded border border-slate-200">
                        {approvingClient.cinNumber}
                      </span>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-2.5">
                    {approvingClient.cinPhotoUrl && (
                      <button
                        type="button"
                        onClick={() =>
                          setPreviewDocPhoto({
                            src: approvingClient.cinPhotoUrl!,
                            title: `CIN Recto — ${approvingClient.companyName || approvingClient.name}`
                          })
                        }
                        className="group relative rounded-xl overflow-hidden border border-slate-200 bg-white h-28 cursor-pointer"
                      >
                        <img
                          src={approvingClient.cinPhotoUrl}
                          alt="CIN Recto"
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                        />
                        <div className="absolute inset-x-0 bottom-0 bg-black/65 text-white text-[10px] font-bold px-2 py-1 flex items-center justify-between">
                          <span>الوجه الأمامي (Recto)</span>
                          <ZoomIn className="w-3 h-3" />
                        </div>
                      </button>
                    )}
                    {approvingClient.cinBackPhotoUrl && (
                      <button
                        type="button"
                        onClick={() =>
                          setPreviewDocPhoto({
                            src: approvingClient.cinBackPhotoUrl!,
                            title: `CIN Verso — ${approvingClient.companyName || approvingClient.name}`
                          })
                        }
                        className="group relative rounded-xl overflow-hidden border border-slate-200 bg-white h-28 cursor-pointer"
                      >
                        <img
                          src={approvingClient.cinBackPhotoUrl}
                          alt="CIN Verso"
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                        />
                        <div className="absolute inset-x-0 bottom-0 bg-black/65 text-white text-[10px] font-bold px-2 py-1 flex items-center justify-between">
                          <span>الظهر (Verso)</span>
                          <ZoomIn className="w-3 h-3" />
                        </div>
                      </button>
                    )}
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-900 mb-2">
                  Grille Tarifaire de Livraison par Ville (en MAD) :
                </label>
                <div className="border border-slate-200 rounded-xl overflow-hidden max-h-56 overflow-y-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                      <tr>
                        <th className="py-2.5 px-3">Ville Destination</th>
                        <th className="py-2.5 px-3 text-center">Tarif Standard</th>
                        <th className="py-2.5 px-3 text-right">Tarif Accordé (MAD)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {cities.map(c => (
                        <tr key={c.id} className="hover:bg-slate-50">
                          <td className="py-2 px-3 font-semibold text-slate-900">{c.name}</td>
                          <td className="py-2 px-3 text-center font-mono text-slate-500">{c.defaultFee} MAD</td>
                          <td className="py-2 px-3 text-right">
                            <input
                              type="number"
                              min="5"
                              step="1"
                              value={approvalRates[c.name] ?? c.defaultFee}
                              onChange={e => {
                                const val = parseFloat(e.target.value) || 0;
                                setApprovalRates(prev => ({ ...prev, [c.name]: val }));
                              }}
                              className="w-20 text-right font-mono font-bold bg-white border border-slate-300 rounded-lg px-2 py-1 text-slate-900 focus:ring-2 focus:ring-red-500"
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="pt-3 border-t flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setApprovingClient(null)}
                  className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-xs flex items-center gap-1.5"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Valider et Activer le Compte</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* REASON MODAL (REFUSE / SUSPEND) */}
      {actionReasonModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs no-print">
          <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50">
              <h3 className="text-base font-bold text-slate-900">
                {actionReasonModal.action === 'refuse'
                  ? "Refuser l'Inscription"
                  : 'Suspendre le Compte Client'}
              </h3>
              <button onClick={() => setActionReasonModal(null)} className="p-2 text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleConfirmReasonAction} className="p-6 space-y-4">
              <p className="text-xs text-slate-600">
                Boutique : <strong>{actionReasonModal.client.companyName || actionReasonModal.client.name}</strong>
              </p>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Motif obligatoire à notifier :
                </label>
                <textarea
                  rows={3}
                  required
                  value={actionReason}
                  onChange={e => setActionReason(e.target.value)}
                  placeholder={
                    actionReasonModal.action === 'refuse'
                      ? 'Ex: Documents incomplets, adresse hors zone...'
                      : 'Ex: Retards de règlement, incident logistique...'
                  }
                  className="w-full text-xs bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-900"
                />
              </div>

              <div className="pt-3 border-t flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setActionReasonModal(null)}
                  className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className={`px-5 py-2.5 text-xs font-bold text-white rounded-xl shadow-xs ${
                    actionReasonModal.action === 'refuse' ? 'bg-rose-600 hover:bg-rose-700' : 'bg-slate-900 hover:bg-slate-800'
                  }`}
                >
                  {actionReasonModal.action === 'refuse' ? 'Confirmer le Refus' : 'Confirmer la Suspension'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CLIENT DETAIL FULL DRAWER */}
      {selectedClientDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs no-print">
          <div className="relative w-full max-w-4xl bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-red-50 text-red-600 rounded-xl">
                  <Store className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    Fiche Boutique — {selectedClientDetail.companyName || selectedClientDetail.name}
                  </h3>
                  <p className="text-xs text-slate-500 font-mono">ID : {selectedClientDetail.id}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    impersonateUser(selectedClientDetail);
                    setSelectedClientDetail(null);
                  }}
                  className="px-4 py-2 text-xs font-bold text-white bg-red-600 hover:bg-red-700 rounded-xl shadow-xs transition-all flex items-center gap-2 cursor-pointer active:scale-95"
                  title="Se connecter au compte de cette boutique (دخول للكونط)"
                >
                  <LogIn className="w-4 h-4" />
                  <span>Connexion (دخول للكونط)</span>
                </button>
                <button
                  onClick={() => setSelectedClientDetail(null)}
                  className="p-2 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="p-6 overflow-y-auto space-y-6">
              {/* Top coordinates card */}
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <div>
                  <span className="text-[10px] text-slate-400 font-bold uppercase block">Responsable</span>
                  <strong className="text-slate-900 text-sm block">{selectedClientDetail.name}</strong>
                  <span className="text-slate-600 font-mono">{selectedClientDetail.phone}</span>
                  {selectedClientDetail.whatsapp && (
                    <span className="text-emerald-700 font-mono block">WhatsApp: {selectedClientDetail.whatsapp}</span>
                  )}
                </div>

                <div>
                  <span className="text-[10px] text-slate-400 font-bold uppercase block">Activité Commerciale</span>
                  <span className="font-semibold text-slate-800 block">{selectedClientDetail.activityType || 'Général'}</span>
                  <span className="text-slate-500 mt-1 block">Inscrit le : {selectedClientDetail.registeredAt}</span>
                </div>

                <div>
                  <span className="text-[10px] text-slate-400 font-bold uppercase block">Statut du Compte</span>
                  <div className="mt-1">{getStatusBadge(selectedClientDetail.status)}</div>
                  {selectedClientDetail.approvedBy && (
                    <span className="text-[10px] text-slate-500 block mt-1">
                      Approuvé par : {selectedClientDetail.approvedBy}
                    </span>
                  )}
                </div>
              </div>

              {/* Address */}
              <div className="p-3 bg-white border border-slate-200 rounded-xl text-xs">
                <span className="text-[10px] text-slate-400 font-bold uppercase block mb-1">
                  Point de Ramassage Permanent
                </span>
                <p className="text-slate-800 font-medium">
                  <strong>{selectedClientDetail.city}</strong> — {selectedClientDetail.address}
                </p>
              </div>

              {/* Coordonnées Bancaires (Banque & RIB) */}
              <div className="p-3.5 bg-white border border-slate-200 rounded-xl text-xs space-y-2.5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <span className="text-[10px] text-slate-400 font-bold uppercase flex items-center gap-1.5 mb-0.5">
                      <Landmark className="w-3.5 h-3.5 text-red-600" />
                      Coordonnées Bancaires (RIB)
                    </span>
                    <div className="font-bold text-slate-900">
                      {selectedClientDetail.bankName || 'Banque non renseignée'}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <div className="font-mono tabular-nums font-bold text-slate-800 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200 force-ltr">
                      {selectedClientDetail.bankRib || 'RIB non renseigné'}
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setIsEditingDetailBank(v => !v);
                        setDetailBankName(selectedClientDetail.bankName || '');
                        setDetailBankRib((selectedClientDetail.bankRib || '').replace(/[^0-9]/g, '').slice(0, 24));
                        setDetailBankNotice(null);
                      }}
                      className="px-2.5 py-1.5 text-[11px] font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
                    >
                      <Edit2 className="w-3 h-3" />
                      <span>{isEditingDetailBank ? 'Annuler' : 'تعديل / Modifier RIB'}</span>
                    </button>
                  </div>
                </div>

                {detailBankNotice && (
                  <div
                    className={`p-2.5 rounded-lg text-[11px] font-bold flex items-center gap-1.5 ${
                      detailBankNotice.type === 'success'
                        ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                        : 'bg-rose-50 text-rose-800 border border-rose-200'
                    }`}
                  >
                    {detailBankNotice.type === 'success' ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    ) : (
                      <AlertCircle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                    )}
                    <span>{detailBankNotice.text}</span>
                  </div>
                )}

                {isEditingDetailBank && (
                  <form onSubmit={handleSaveDetailBank} className="p-3 bg-slate-50 border border-slate-200 rounded-xl grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-end">
                    <div className="sm:col-span-5">
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">Banque (نوع البنك)</label>
                      <input
                        type="text"
                        list="fariousy-moroccan-banks"
                        value={detailBankName}
                        onChange={e => setDetailBankName(e.target.value)}
                        placeholder="Attijariwafa bank / CIH Bank..."
                        className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg text-slate-900"
                      />
                    </div>
                    <div className="sm:col-span-5">
                      <div className="flex items-center justify-between mb-1">
                        <label className="block text-[11px] font-bold text-slate-700">RIB (24 chiffres)</label>
                        <span className="text-[10px] font-mono font-bold text-slate-500">
                          {detailBankRib.replace(/[^0-9]/g, '').length} / 24
                        </span>
                      </div>
                      <input
                        type="text"
                        inputMode="numeric"
                        maxLength={24}
                        value={detailBankRib}
                        onChange={e => setDetailBankRib(e.target.value.replace(/[^0-9]/g, '').slice(0, 24))}
                        placeholder="007810000123456789012345"
                        className="w-full px-3 py-2 text-xs font-mono tabular-nums force-ltr bg-white border border-slate-300 rounded-lg text-slate-900"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <button
                        type="submit"
                        disabled={isSavingDetailBank}
                        className="w-full py-2 px-3 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-lg flex items-center justify-center gap-1 cursor-pointer disabled:opacity-50"
                      >
                        {isSavingDetailBank ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                        <span>حفظ</span>
                      </button>
                    </div>
                  </form>
                )}
              </div>

              {/* CIN / Carte Nationale du Marchand */}
              {(selectedClientDetail.cinPhotoUrl || selectedClientDetail.cinBackPhotoUrl || selectedClientDetail.cinNumber) && (
                <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                      <CreditCard className="w-4 h-4 text-red-600" />
                      <span>البطاقة الوطنية للتاجر — Carte Nationale (CIN)</span>
                    </span>
                    {selectedClientDetail.cinNumber && (
                      <span className="font-mono text-xs font-bold text-slate-800 bg-white px-2.5 py-0.5 rounded-lg border border-slate-200">
                        N° {selectedClientDetail.cinNumber}
                      </span>
                    )}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {selectedClientDetail.cinPhotoUrl && (
                      <button
                        type="button"
                        onClick={() =>
                          setPreviewDocPhoto({
                            src: selectedClientDetail.cinPhotoUrl!,
                            title: `CIN Recto — ${selectedClientDetail.companyName || selectedClientDetail.name}`
                          })
                        }
                        className="group relative rounded-xl overflow-hidden border border-slate-200 bg-white h-36 cursor-pointer"
                      >
                        <img
                          src={selectedClientDetail.cinPhotoUrl}
                          alt="CIN Recto"
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                        />
                        <div className="absolute inset-x-0 bottom-0 bg-black/65 text-white text-[11px] font-bold px-2.5 py-1.5 flex items-center justify-between">
                          <span>الوجه الأمامي (CIN Recto)</span>
                          <ZoomIn className="w-3.5 h-3.5" />
                        </div>
                      </button>
                    )}
                    {selectedClientDetail.cinBackPhotoUrl && (
                      <button
                        type="button"
                        onClick={() =>
                          setPreviewDocPhoto({
                            src: selectedClientDetail.cinBackPhotoUrl!,
                            title: `CIN Verso — ${selectedClientDetail.companyName || selectedClientDetail.name}`
                          })
                        }
                        className="group relative rounded-xl overflow-hidden border border-slate-200 bg-white h-36 cursor-pointer"
                      >
                        <img
                          src={selectedClientDetail.cinBackPhotoUrl}
                          alt="CIN Verso"
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                        />
                        <div className="absolute inset-x-0 bottom-0 bg-black/65 text-white text-[11px] font-bold px-2.5 py-1.5 flex items-center justify-between">
                          <span>الظهر (CIN Verso)</span>
                          <ZoomIn className="w-3.5 h-3.5" />
                        </div>
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Tarifs négociés de ce client */}
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-slate-900 block">
                    Grille Tarifaire Négociée pour cette Boutique :
                  </span>
                  <button
                    onClick={() => {
                      handleOpenRateModal(selectedClientDetail);
                    }}
                    className="px-3 py-1.5 text-xs font-bold text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer"
                    title="Gérer les tarifs négociés pour cette boutique (تبديل ومسح)"
                  >
                    <Tag className="w-3.5 h-3.5 text-red-600" />
                    <span>Modifier les tarifs (تبديل / مسح)</span>
                  </button>
                </div>

                {selectedClientDetail.customRates && Object.keys(selectedClientDetail.customRates).length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(selectedClientDetail.customRates).map(([cityName, rate]) => (
                      <span
                        key={cityName}
                        className="px-3 py-1 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-800 font-mono"
                      >
                        {cityName} : <strong className="text-red-600 font-bold">{rate} MAD</strong>
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-500">
                    Cette boutique utilise la grille tarifaire standard des villes.
                  </p>
                )}
              </div>

              {/* Colis de ce client */}
              <div>
                <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-2">
                  Historique des Colis Expédiés ({packages.filter(p => p.clientId === selectedClientDetail.id).length})
                </h4>
                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                      <tr>
                        <th className="py-2.5 px-3">N° Suivi</th>
                        <th className="py-2.5 px-3">Destinataire</th>
                        <th className="py-2.5 px-3">Ville</th>
                        <th className="py-2.5 px-3 text-right">Montant COD</th>
                        <th className="py-2.5 px-3">Statut</th>
                        <th className="py-2.5 px-3 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {packages
                        .filter(p => p.clientId === selectedClientDetail.id)
                        .map(pkg => (
                          <tr key={pkg.id} className="hover:bg-slate-50">
                            <td className="py-2 px-3 font-mono font-bold text-slate-900">{pkg.trackingNumber}</td>
                            <td className="py-2 px-3 text-slate-800">{pkg.recipientName}</td>
                            <td className="py-2 px-3 text-slate-600">{pkg.city}</td>
                            <td className="py-2 px-3 text-right font-mono font-bold">{formatMAD(pkg.codAmount)}</td>
                            <td className="py-2 px-3 font-semibold text-slate-700">{pkg.status}</td>
                            <td className="py-2 px-3 text-right">
                              <button
                                onClick={() => {
                                  setSelectedClientDetail(null);
                                  onViewPackage(pkg);
                                }}
                                className="px-2 py-1 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-md"
                              >
                                Consulter
                              </button>
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  onClick={() => {
                    impersonateUser(selectedClientDetail);
                    setSelectedClientDetail(null);
                  }}
                  className="px-4 py-2 text-xs font-bold text-white bg-red-600 hover:bg-red-700 rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer active:scale-95"
                >
                  <LogIn className="w-3.5 h-3.5" />
                  <span>Connexion au compte (دخول للكونط)</span>
                </button>

                <button
                  onClick={() => handleStartEdit(selectedClientDetail)}
                  className="px-3.5 py-2 text-xs font-bold text-slate-800 bg-white border border-slate-200 hover:bg-slate-50 rounded-xl shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                  <span>Modifier cette boutique</span>
                </button>

                <button
                  onClick={() => handleOpenPasswordReset(selectedClientDetail)}
                  className="px-3.5 py-2 text-xs font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <Key className="w-3.5 h-3.5 text-indigo-600" />
                  <span>تبديل الرمز السري</span>
                </button>

                {/* Bouton Désactiver / Réactiver dans la Fiche (Étape 78) */}
                {selectedClientDetail.status === 'suspendu' ? (
                  <button
                    onClick={() => handleOpenStatusModal(selectedClientDetail, 'approuve')}
                    className="px-3.5 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Réactiver le compte</span>
                  </button>
                ) : (selectedClientDetail.status === 'approuve' || selectedClientDetail.status === 'active') ? (
                  <button
                    onClick={() => handleOpenStatusModal(selectedClientDetail, 'suspendu')}
                    className="px-3.5 py-2 text-xs font-bold text-amber-800 bg-amber-100 hover:bg-amber-200 border border-amber-300 rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer"
                  >
                    <ShieldAlert className="w-3.5 h-3.5 text-amber-700" />
                    <span>Désactiver (Suspendre)</span>
                  </button>
                ) : null}
              </div>

              <button
                onClick={() => setSelectedClientDetail(null)}
                className="px-4 py-2 text-xs font-bold text-slate-700 bg-white border border-slate-300 rounded-xl hover:bg-slate-100 cursor-pointer"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: MODIFIER LE CLIENT (ÉTAPE 75 — SUPABASE PRODUCTION) */}
      {editingClient && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs no-print">
          <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 max-h-[92vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-red-50 text-red-600 flex items-center justify-center">
                  <Edit2 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-extrabold text-slate-900">
                    Modifier la Boutique : {editingClient.companyName || editingClient.name}
                  </h3>
                  <p className="text-[11px] text-slate-500 font-mono">
                    Supabase ID : {editingClient.id}
                  </p>
                </div>
              </div>
              <button
                type="button"
                disabled={isSavingEdit}
                onClick={() => setEditingClient(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 cursor-pointer disabled:opacity-50"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveEditClient} className="p-6 space-y-4 overflow-y-auto">
              {/* Message d'erreur */}
              {editClientError && (
                <div className="p-3.5 bg-red-50 border border-red-200 rounded-xl flex items-start gap-2.5 text-xs text-red-800 animate-in fade-in">
                  <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                  <span>{editClientError}</span>
                </div>
              )}

              {/* Message de succès */}
              {editClientSuccessMsg && (
                <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl flex items-start gap-2.5 text-xs text-emerald-800 animate-in fade-in">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <span>{editClientSuccessMsg}</span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {/* Nom de la boutique */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Nom de la boutique *
                  </label>
                  <input
                    type="text"
                    required
                    disabled={isSavingEdit}
                    value={editClientCompany}
                    onChange={e => setEditClientCompany(e.target.value)}
                    placeholder="Ex: Boutique Élégance"
                    className="w-full px-3 py-2.5 text-xs bg-slate-50 border border-slate-300 rounded-xl text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-500"
                  />
                </div>

                {/* Nom du responsable */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Nom du responsable *
                  </label>
                  <input
                    type="text"
                    required
                    disabled={isSavingEdit}
                    value={editClientName}
                    onChange={e => setEditClientName(e.target.value)}
                    placeholder="Ex: Mohamed Benali"
                    className="w-full px-3 py-2.5 text-xs bg-slate-50 border border-slate-300 rounded-xl text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {/* Téléphone */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Numéro de téléphone *
                  </label>
                  <div className="relative">
                    <Phone className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="tel"
                      required
                      disabled={isSavingEdit}
                      value={editClientPhone}
                      onChange={e => setEditClientPhone(e.target.value)}
                      placeholder="06XXXXXXXX"
                      className="w-full pl-9 pr-3 py-2.5 text-xs font-mono bg-slate-50 border border-slate-300 rounded-xl text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-500"
                    />
                  </div>
                </div>

                {/* WhatsApp */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    WhatsApp (Optionnel)
                  </label>
                  <div className="relative">
                    <Phone className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-emerald-500" />
                    <input
                      type="tel"
                      disabled={isSavingEdit}
                      value={editClientWhatsapp}
                      onChange={e => setEditClientWhatsapp(e.target.value)}
                      placeholder="06XXXXXXXX"
                      className="w-full pl-9 pr-3 py-2.5 text-xs font-mono bg-slate-50 border border-slate-300 rounded-xl text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-500"
                    />
                  </div>
                </div>
              </div>

              {/* Adresse e-mail (NON MODIFIABLE) */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-bold text-slate-700">
                    Adresse e-mail de connexion
                  </label>
                  <span className="text-[10px] text-slate-500 font-semibold flex items-center gap-1 bg-slate-100 px-2 py-0.5 rounded-md">
                    <Lock className="w-3 h-3 text-slate-400" /> Non modifiable
                  </span>
                </div>
                <div className="relative">
                  <Mail className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="email"
                    disabled
                    readOnly
                    value={editClientEmail}
                    className="w-full pl-9 pr-3 py-2.5 text-xs font-mono bg-slate-100 border border-slate-200 rounded-xl text-slate-500 cursor-not-allowed select-none"
                  />
                </div>
                <span className="text-[10px] text-slate-400 mt-1 block">
                  L'adresse e-mail de connexion doit rester non modifiable pour le moment.
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {/* Ville */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Ville de collecte *
                  </label>
                  <div className="relative">
                    <MapPin className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <select
                      disabled={isSavingEdit}
                      value={editClientCity}
                      onChange={e => setEditClientCity(e.target.value)}
                      className="w-full pl-9 pr-3 py-2.5 text-xs bg-slate-50 border border-slate-300 rounded-xl text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-500 font-medium"
                    >
                      {cities.map(c => (
                        <option key={c.id} value={c.name}>
                          {c.name}
                        </option>
                      ))}
                      <option value="Casablanca">Casablanca</option>
                      <option value="Rabat">Rabat</option>
                      <option value="Marrakech">Marrakech</option>
                      <option value="Tanger">Tanger</option>
                      <option value="Fès">Fès</option>
                      <option value="Agadir">Agadir</option>
                    </select>
                  </div>
                </div>

                {/* Activité commerciale */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Activité commerciale
                  </label>
                  <select
                    disabled={isSavingEdit}
                    value={editClientActivity}
                    onChange={e => setEditClientActivity(e.target.value)}
                    className="w-full px-3 py-2.5 text-xs bg-slate-50 border border-slate-300 rounded-xl text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-500 font-medium"
                  >
                    <option value="Mode & Prêt-à-porter">Mode & Prêt-à-porter</option>
                    <option value="High-Tech & Téléphonie">High-Tech & Téléphonie</option>
                    <option value="Cosmétiques & Beauté">Cosmétiques & Beauté</option>
                    <option value="Chaussures & Maroquinerie">Chaussures & Maroquinerie</option>
                    <option value="Maison & Décoration">Maison & Décoration</option>
                    <option value="Commerce général">Commerce général</option>
                  </select>
                </div>
              </div>

              {/* Adresse de ramassage */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Adresse de ramassage
                </label>
                <textarea
                  rows={2}
                  disabled={isSavingEdit}
                  value={editClientAddress}
                  onChange={e => setEditClientAddress(e.target.value)}
                  placeholder="Quartier, rue, numéro de magasin ou dépôt..."
                  className="w-full p-3 text-xs bg-slate-50 border border-slate-300 rounded-xl text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-500"
                />
              </div>

              {/* Banque & RIB Bancaire */}
              <datalist id="fariousy-moroccan-banks">
                <option value="Attijariwafa bank (التجاري وفا بنك)" />
                <option value="CIH Bank" />
                <option value="Banque Populaire (البنك الشعبي)" />
                <option value="Bank of Africa / BMCE" />
                <option value="Société Générale Maroc (SGMB)" />
                <option value="Crédit du Maroc (CDM)" />
                <option value="Crédit Agricole du Maroc (CAM)" />
                <option value="Al Barid Bank (البريد بنك)" />
                <option value="Bank Assafa (بنك الصفاء)" />
                <option value="Umnia Bank (أمنية بنك)" />
                <option value="Al Akhdar Bank (البنك الأخضر)" />
                <option value="CFG Bank" />
              </datalist>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-2 border-t border-slate-100">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Banque (نوع البنك)
                  </label>
                  <input
                    type="text"
                    list="fariousy-moroccan-banks"
                    disabled={isSavingEdit}
                    value={editClientBankName}
                    onChange={e => setEditClientBankName(e.target.value)}
                    placeholder="Ex: Attijariwafa bank / CIH Bank"
                    className="w-full px-3 py-2.5 text-xs bg-slate-50 border border-slate-300 rounded-xl text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-500"
                  />
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-bold text-slate-700">
                      RIB Bancaire (24 chiffres)
                    </label>
                    <span
                      className={`text-[10px] font-mono tabular-nums font-bold ${
                        editClientBankRib.replace(/[^0-9]/g, '').length === 0
                          ? 'text-slate-400'
                          : editClientBankRib.replace(/[^0-9]/g, '').length === 24
                            ? 'text-emerald-600'
                            : 'text-amber-600'
                      }`}
                    >
                      {editClientBankRib.replace(/[^0-9]/g, '').length} / 24
                    </span>
                  </div>
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={24}
                    disabled={isSavingEdit}
                    value={editClientBankRib}
                    onChange={e => setEditClientBankRib(e.target.value.replace(/[^0-9]/g, '').slice(0, 24))}
                    placeholder="007810000123456789012345"
                    className="w-full px-3 py-2.5 text-xs font-mono tabular-nums force-ltr bg-slate-50 border border-slate-300 rounded-xl text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-500"
                  />
                </div>
              </div>

              {/* Boutons d'action */}
              <div className="pt-3 flex items-center justify-end gap-2.5 border-t border-slate-100">
                <button
                  type="button"
                  disabled={isSavingEdit}
                  onClick={() => setEditingClient(null)}
                  className="px-4 py-2.5 text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer disabled:opacity-50"
                >
                  Annuler
                </button>

                <button
                  type="submit"
                  disabled={isSavingEdit}
                  className="px-5 py-2.5 text-xs font-bold text-white bg-red-600 hover:bg-red-700 rounded-xl shadow-xs flex items-center gap-2 transition-all cursor-pointer disabled:opacity-50"
                >
                  {isSavingEdit ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Enregistrement dans Supabase...</span>
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      <span>Enregistrer les modifications</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: CONFIRMATION DÉSACTIVER / RÉACTIVER (ÉTAPE 78) */}
      {statusModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs no-print">
          <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 flex flex-col">
            <div className={`flex items-center justify-between px-6 py-4 border-b ${
              statusModal.targetStatus === 'suspendu' ? 'bg-amber-50 border-amber-100' : 'bg-emerald-50 border-emerald-100'
            }`}>
              <div className="flex items-center gap-2.5">
                <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${
                  statusModal.targetStatus === 'suspendu' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'
                }`}>
                  {statusModal.targetStatus === 'suspendu' ? (
                    <ShieldAlert className="w-4 h-4" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4" />
                  )}
                </div>
                <div>
                  <h3 className="text-sm font-extrabold text-slate-900">
                    {statusModal.targetStatus === 'suspendu'
                      ? 'Désactiver le compte client'
                      : 'Réactiver le compte client'}
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Boutique : {statusModal.client.companyName || statusModal.client.name}
                  </p>
                </div>
              </div>
              <button
                type="button"
                disabled={isUpdatingStatus}
                onClick={() => setStatusModal(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 cursor-pointer disabled:opacity-50"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleConfirmStatusModal} className="p-6 space-y-4">
              {statusModalError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl flex items-start gap-2 text-xs text-red-800">
                  <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                  <span>{statusModalError}</span>
                </div>
              )}

              {statusModal.targetStatus === 'suspendu' ? (
                <div className="p-3.5 bg-amber-50/70 border border-amber-200 rounded-xl space-y-2 text-xs text-amber-900">
                  <p className="font-semibold">
                    Êtes-vous sûr de vouloir suspendre temporairement ce compte ?
                  </p>
                  <ul className="list-disc pl-4 space-y-1 text-[11px] text-amber-800">
                    <li>Le client ne pourra plus accéder à son espace ni créer de colis.</li>
                    <li>L'accès serveur et base de données est immédiatement restreint.</li>
                    <li><strong>Tous ses colis, paiements, dettes et historiques sont conservés.</strong></li>
                    <li>Vous pourrez réactiver ce compte à tout moment.</li>
                  </ul>
                </div>
              ) : (
                <div className="p-3.5 bg-emerald-50/70 border border-emerald-200 rounded-xl space-y-2 text-xs text-emerald-900">
                  <p className="font-semibold">
                    Confirmez-vous la réactivation du compte de cette boutique ?
                  </p>
                  <p className="text-[11px] text-emerald-800">
                    Le commerçant pourra à nouveau se connecter à son espace, enregistrer des colis et demander des ramassages.
                  </p>
                </div>
              )}

              {statusModal.targetStatus === 'suspendu' && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Motif de la suspension (optionnel) :
                  </label>
                  <textarea
                    rows={2}
                    disabled={isUpdatingStatus}
                    value={statusReasonText}
                    onChange={e => setStatusReasonText(e.target.value)}
                    placeholder="Ex: Demande du commerçant, mise à jour administrative..."
                    className="w-full p-2.5 text-xs bg-slate-50 border border-slate-300 rounded-xl text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-500"
                  />
                </div>
              )}

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  disabled={isUpdatingStatus}
                  onClick={() => setStatusModal(null)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer disabled:opacity-50"
                >
                  Annuler
                </button>

                <button
                  type="submit"
                  disabled={isUpdatingStatus}
                  className={`px-5 py-2.5 text-xs font-bold text-white rounded-xl shadow-xs flex items-center gap-2 cursor-pointer transition-all disabled:opacity-50 ${
                    statusModal.targetStatus === 'suspendu'
                      ? 'bg-amber-600 hover:bg-amber-700'
                      : 'bg-emerald-600 hover:bg-emerald-700'
                  }`}
                >
                  {isUpdatingStatus ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Enregistrement dans Supabase...</span>
                    </>
                  ) : (
                    <>
                      {statusModal.targetStatus === 'suspendu' ? (
                        <ShieldAlert className="w-4 h-4" />
                      ) : (
                        <CheckCircle2 className="w-4 h-4" />
                      )}
                      <span>
                        {statusModal.targetStatus === 'suspendu'
                          ? 'Confirmer la désactivation'
                          : 'Confirmer la réactivation'}
                      </span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* GESTION & MODIFICATION DES TARIFS DU CLIENT (MODAL SUR-MESURE) */}
      {showRateModalClient && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs no-print">
          <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-red-100 text-red-600 flex items-center justify-center">
                  <Tag className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900">
                    Tarifs Négociés : {showRateModalClient.companyName || showRateModalClient.name}
                  </h3>
                  <p className="text-xs text-slate-500">
                    تبديل ومسح التعرفة — Ville du client : <strong>{showRateModalClient.city}</strong>
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowRateModalClient(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Success toast if any */}
            {clientRateSuccessMsg && (
              <div className="p-3 bg-emerald-50 border-b border-emerald-200 text-xs text-emerald-800 font-bold flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{clientRateSuccessMsg}</span>
              </div>
            )}

            {/* Quick Actions Bar */}
            <div className="p-4 bg-slate-50/80 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="relative flex-1 max-w-xs">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Filtrer par ville..."
                  value={clientRateSearch}
                  onChange={e => setClientRateSearch(e.target.value)}
                  className="w-full text-xs bg-white border border-slate-200 rounded-xl pl-8 pr-3 py-1.5 text-slate-900 focus:outline-none focus:ring-2 focus:ring-red-500"
                />
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const priceStr = prompt('Entrez le tarif unique en MAD pour TOUTES les villes :', '25');
                    if (priceStr) {
                      const priceNum = parseFloat(priceStr);
                      if (!isNaN(priceNum) && priceNum > 0) {
                        const newR: Record<string, number> = {};
                        cities.forEach(c => {
                          newR[c.name] = priceNum;
                        });
                        setClientRateDraft(newR);
                      }
                    }
                  }}
                  className="px-2.5 py-1.5 text-xs font-bold text-slate-700 bg-white border border-slate-300 hover:bg-slate-100 rounded-lg cursor-pointer"
                >
                  Tarif unique partout
                </button>

                <button
                  type="button"
                  onClick={handleResetClientRates}
                  title="مسح كافة الأسعار الخاصة والرجوع للتعرفة الأصلية لجميع المدن"
                  className="px-2.5 py-1.5 text-xs font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 rounded-lg cursor-pointer"
                >
                  Rétablir standard (مسح)
                </button>
              </div>
            </div>

            {/* Scrollable Cities List */}
            <div className="p-6 overflow-y-auto divide-y divide-slate-100 flex-1 space-y-3">
              {cities
                .filter(c => c.name.toLowerCase().includes(clientRateSearch.toLowerCase()))
                .map(city => {
                  const isCustom = clientRateDraft[city.name] !== undefined;
                  const currentRate = isCustom ? clientRateDraft[city.name] : city.defaultFee;
                  const diff = city.defaultFee - currentRate;

                  return (
                    <div
                      key={city.id}
                      className="pt-3 first:pt-0 flex items-center justify-between gap-4"
                    >
                      <div className="flex items-center gap-2.5">
                        <MapPin className="w-4 h-4 text-slate-400 shrink-0" />
                        <div>
                          <div className="font-black text-slate-900 text-xs flex items-center gap-1.5">
                            <span>{city.name}</span>
                            {diff > 0 && isCustom && (
                              <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.2 rounded">
                                -{diff} MAD
                              </span>
                            )}
                          </div>
                          <span className="text-[10px] text-slate-400">
                            Tarif standard : <strong>{city.defaultFee} MAD</strong>
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {isCustom && (
                          <button
                            type="button"
                            onClick={() => {
                              const copy = { ...clientRateDraft };
                              delete copy[city.name];
                              setClientRateDraft(copy);
                            }}
                            title="مسح التخفيض لهذه المدينة والرجوع للتعرفة القياسية"
                            className="p-1.5 text-slate-400 hover:text-rose-600 rounded cursor-pointer"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                          </button>
                        )}

                        <div className="relative w-28">
                          <input
                            type="number"
                            min="5"
                            step="1"
                            value={currentRate}
                            onChange={e => {
                              const val = parseFloat(e.target.value);
                              if (!isNaN(val)) {
                                setClientRateDraft({
                                  ...clientRateDraft,
                                  [city.name]: val
                                });
                              }
                            }}
                            className={`w-full text-xs font-mono font-black text-right px-3 py-1.5 rounded-xl border ${
                              isCustom
                                ? 'bg-red-50/50 border-red-300 text-red-600'
                                : 'bg-slate-50 border-slate-200 text-slate-700'
                            }`}
                          />
                          <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400 pointer-events-none">
                            MAD
                          </span>
                        </div>

                        <span
                          className={`w-20 text-center text-[10px] font-bold py-1 px-1.5 rounded-md ${
                            isCustom
                              ? 'bg-red-100 text-red-700'
                              : 'bg-slate-100 text-slate-500'
                          }`}
                        >
                          {isCustom ? 'Négocié' : 'Standard'}
                        </span>
                      </div>
                    </div>
                  );
                })}
            </div>

            {/* Footer */}
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
              <span className="text-xs text-slate-500">
                {Object.keys(clientRateDraft).length} ville(s) à tarif préférentiel
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowRateModalClient(null)}
                  className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-200 rounded-xl cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="button"
                  onClick={handleSaveClientRates}
                  className="px-5 py-2.5 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-xl shadow-xs cursor-pointer flex items-center gap-1.5"
                >
                  <Check className="w-4 h-4" />
                  <span>Enregistrer la grille (حفظ)</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: RÉINITIALISATION / CHANGEMENT DU MOT DE PASSE DU CLIENT */}
      {passwordResetClient && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs no-print">
          <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center">
                  <Key className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900">
                    تبديل الرمز السري للزبون
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    {passwordResetClient.companyName || passwordResetClient.name} ({passwordResetClient.city})
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setPasswordResetClient(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content */}
            <div className="p-6">
              {clientPasswordSuccess ? (
                <div className="space-y-4 text-center">
                  <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
                    <CheckCircle2 className="w-6 h-6" />
                  </div>
                  <div>
                    <h4 className="text-sm font-black text-slate-900">
                      تم تغيير الرمز السري بنجاح !
                    </h4>
                    <p className="text-xs text-slate-500 mt-0.5">
                      تم تحديث بيانات الدخول في قاعدة البيانات Supabase Auth
                    </p>
                  </div>

                  {/* Credentials Card */}
                  <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl text-left text-xs space-y-2 select-all">
                    <div className="flex justify-between items-center pb-2 border-b border-slate-200">
                      <span className="text-slate-500">المتجر / Boutique :</span>
                      <strong className="text-slate-900 font-bold">
                        {clientPasswordSuccess.client.companyName || clientPasswordSuccess.client.name}
                      </strong>
                    </div>
                    <div className="flex justify-between items-center pb-2 border-b border-slate-200">
                      <span className="text-slate-500">البريد الإلكتروني :</span>
                      <strong className="text-slate-900 font-mono">
                        {clientPasswordSuccess.client.email || 'Non défini'}
                      </strong>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-500">الرمز السري الجديد :</span>
                      <span className="text-base font-black font-mono text-red-600 bg-red-50 px-2 py-0.5 rounded-lg border border-red-200">
                        {clientPasswordSuccess.password}
                      </span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="space-y-2 pt-2">
                    <button
                      type="button"
                      onClick={() => {
                        const text = `بيانات الدخول لمنصة FARIOUSY DELIVERY الخاصة بمتجرك (${clientPasswordSuccess.client.companyName || clientPasswordSuccess.client.name}):\n- الرابط: https://app.fariousy.com\n- البريد الإلكتروني: ${clientPasswordSuccess.client.email}\n- الرمز السري: ${clientPasswordSuccess.password}`;
                        navigator.clipboard.writeText(text);
                        setCopiedCredentials(true);
                        setTimeout(() => setCopiedCredentials(false), 2500);
                      }}
                      className="w-full py-2.5 px-4 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl shadow-xs flex items-center justify-center gap-2 cursor-pointer transition-all"
                    >
                      {copiedCredentials ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                      <span>{copiedCredentials ? 'تم نسخ البيانات بنجاح !' : 'نسخ بيانات الدخول (Copier)'}</span>
                    </button>

                    {clientPasswordSuccess.client.phone && (
                      <a
                        href={`https://wa.me/${clientPasswordSuccess.client.phone.replace(/[^0-9]/g, '').replace(/^0/, '212')}?text=${encodeURIComponent(
                          `مرحباً ${clientPasswordSuccess.client.name || ''}،\nإليك بيانات تسجيل الدخول إلى منصة FARIOUSY DELIVERY الخاصة بمتجرك (${clientPasswordSuccess.client.companyName || clientPasswordSuccess.client.name}) :\n\n🌐 الرابط : https://app.fariousy.com\n📧 البريد : ${clientPasswordSuccess.client.email}\n🔑 الرمز السري : ${clientPasswordSuccess.password}\n\nشكراً لثقتكم بنا!`
                        )}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs flex items-center justify-center gap-2 cursor-pointer transition-all block text-center"
                      >
                        <Share2 className="w-4 h-4" />
                        <span>إرسال البيانات عبر واتساب (WhatsApp)</span>
                      </a>
                    )}

                    <button
                      type="button"
                      onClick={() => setPasswordResetClient(null)}
                      className="w-full py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
                    >
                      إغلاق (Fermer)
                    </button>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleSaveClientPassword} className="space-y-4">
                  {clientPasswordError && (
                    <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 font-semibold flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                      <span>{clientPasswordError}</span>
                    </div>
                  )}

                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs space-y-1">
                    <div className="text-slate-600">
                      الزبون : <strong className="text-slate-900">{passwordResetClient.companyName || passwordResetClient.name}</strong>
                    </div>
                    <div className="text-slate-600">
                      البريد الإلكتروني : <span className="font-mono text-slate-800">{passwordResetClient.email || 'N/A'}</span>
                    </div>
                    <div className="text-slate-600">
                      الهاتف : <span className="font-mono text-slate-800">{passwordResetClient.phone || 'N/A'}</span>
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-xs font-bold text-slate-700">
                        الرمز السري الجديد (Nouveau Mot de Passe) *
                      </label>
                      <button
                        type="button"
                        onClick={() => setNewClientPasswordInput(generateFriendlyPassword())}
                        className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 cursor-pointer flex items-center gap-1"
                      >
                        <RotateCcw className="w-3 h-3" />
                        <span>توليد كود تلقائي</span>
                      </button>
                    </div>

                    <div className="relative">
                      <input
                        type={showClientPassword ? 'text' : 'password'}
                        required
                        minLength={8}
                        value={newClientPasswordInput}
                        onChange={e => setNewClientPasswordInput(e.target.value)}
                        placeholder="Ex: Far@8921"
                        className="w-full text-sm font-mono font-bold bg-slate-50 border border-slate-300 rounded-xl pl-3.5 pr-10 py-2.5 text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                      <button
                        type="button"
                        onClick={() => setShowClientPassword(!showClientPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
                        title={showClientPassword ? 'Masquer' : 'Afficher'}
                      >
                        {showClientPassword ? <Eye className="w-4 h-4 text-indigo-600" /> : <Lock className="w-4 h-4" />}
                      </button>
                    </div>
                    <p className="text-[10px] text-slate-400 mt-1">
                      الحد الأدنى 6 أحرف. يمكنك كتابة رمز خاص أو الضغط على "توليد كود تلقائي".
                    </p>
                  </div>

                  <div className="pt-2 flex items-center justify-end gap-2">
                    <button
                      type="button"
                      disabled={isUpdatingClientPassword}
                      onClick={() => setPasswordResetClient(null)}
                      className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer disabled:opacity-50"
                    >
                      إلغاء
                    </button>
                    <button
                      type="submit"
                      disabled={isUpdatingClientPassword || !newClientPasswordInput.trim()}
                      className="px-5 py-2.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 rounded-xl shadow-xs flex items-center gap-2 cursor-pointer transition-all"
                    >
                      {isUpdatingClientPassword ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          <span>جاري الحفظ...</span>
                        </>
                      ) : (
                        <>
                          <Key className="w-3.5 h-3.5" />
                          <span>تغيير الرمز السري (Enregistrer)</span>
                        </>
                      )}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      )}

      {/* CONFIRMATION SUPPRESSION CLIENT */}
      {deletingClient && (
        <ConfirmActionModal
          isOpen={Boolean(deletingClient)}
          title={`Supprimer la boutique ${deletingClient.companyName || deletingClient.name}`}
          description={`Êtes-vous sûr de vouloir supprimer définitivement ce compte marchand (${deletingClient.email}) ? Cette action est irréversible et sera enregistrée dans le journal d'audit.`}
          confirmLabel="Supprimer définitivement"
          requireReason={true}
          onConfirm={reason => handleConfirmDeleteClient(reason)}
          onClose={() => setDeletingClient(null)}
        />
      )}
      {/* LIGHTBOX PREVIEW PHOTO CIN */}
      {previewDocPhoto && (
        <div
          className="fixed inset-0 z-[70] bg-black/85 backdrop-blur-xs flex items-center justify-center p-4 no-print"
          onClick={() => setPreviewDocPhoto(null)}
        >
          <div
            className="relative max-w-2xl w-full bg-slate-900 rounded-2xl overflow-hidden shadow-2xl border border-slate-700"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800 text-white">
              <span className="text-xs sm:text-sm font-bold truncate">{previewDocPhoto.title}</span>
              <button
                type="button"
                onClick={() => setPreviewDocPhoto(null)}
                className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-4 flex items-center justify-center bg-black/40 max-h-[80vh]">
              <img
                src={previewDocPhoto.src}
                alt={previewDocPhoto.title}
                className="max-h-[72vh] w-auto object-contain rounded-lg"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
