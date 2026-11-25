import React, { useEffect, useMemo, useState } from 'react';
import {
  Bell,
  Check,
  CheckCheck,
  Clock,
  Info,
  AlertTriangle,
  AlertCircle,
  CheckCircle2,
  MailOpen,
  Plus,
  RefreshCw,
  Search,
  Send,
  Trash2,
  Users,
  X,
  ArrowRight
} from 'lucide-react';
import {
  NotificationAudienceScope,
  UserNotificationMessage,
  UserProfile,
  UserRole
} from '../../types';
import {
  NotificationRecipientOption,
  NotificationRecipientsPayload,
  SendUserNotificationPayload
} from '../../services/userNotifications';

interface NotificationsCenterOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: UserProfile;
  notifications: UserNotificationMessage[];
  sentNotifications: UserNotificationMessage[];
  unreadCount: number;
  isLoading: boolean;
  errorMessage?: string | null;
  recipients?: NotificationRecipientsPayload;
  fallbackUsers?: UserProfile[];
  onRefresh: () => Promise<void> | void;
  onMarkRead: (id: string) => Promise<void>;
  onMarkAllRead: () => Promise<void>;
  onDeleteNotification: (id: string, options?: { global?: boolean }) => Promise<void>;
  onClearRead: () => Promise<void>;
  onSendMessage: (
    payload: SendUserNotificationPayload
  ) => Promise<{ success: boolean; error?: string }>;
}

type ActiveFilterTab = 'all' | 'unread' | 'read' | 'sent';
type SpecificRoleType = 'client' | 'driver' | 'employee';

const TYPE_META: Record<
  UserNotificationMessage['type'],
  { label: string; textClass: string; icon: React.ComponentType<{ className?: string }> }
> = {
  info: { label: 'Information', textClass: 'text-slate-700', icon: Info },
  success: { label: 'Confirmation', textClass: 'text-emerald-700', icon: CheckCircle2 },
  warning: { label: 'Avertissement', textClass: 'text-amber-700', icon: AlertTriangle },
  alert: { label: 'Important', textClass: 'text-red-700', icon: AlertCircle }
};

function formatDateTimeFR(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const datePart = d.toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });
  const timePart = d.toLocaleTimeString('fr-FR', {
    hour: '2-digit',
    minute: '2-digit'
  });
  return `${datePart} à ${timePart}`;
}

function getAudienceLabel(notif: UserNotificationMessage): string {
  switch (notif.targetScope) {
    case 'all':
      return 'Tous les utilisateurs';
    case 'clients':
      return 'Tous les clients';
    case 'drivers':
      return 'Tous les livreurs';
    case 'employees':
      return 'Tous les employés';
    case 'user': {
      const rolePrefix =
        notif.targetRole === 'driver'
          ? 'Livreur'
          : notif.targetRole === 'employee'
          ? 'Employé'
          : 'Client';
      return `${rolePrefix} : ${notif.targetUserName || notif.targetUserEmail || 'Destinataire'}`;
    }
    default:
      return 'Destinataire';
  }
}

export const NotificationsCenterOverlay: React.FC<NotificationsCenterOverlayProps> = ({
  isOpen,
  onClose,
  currentUser,
  notifications,
  sentNotifications,
  unreadCount,
  isLoading,
  errorMessage,
  recipients,
  fallbackUsers = [],
  onRefresh,
  onMarkRead,
  onMarkAllRead,
  onDeleteNotification,
  onClearRead,
  onSendMessage
}) => {
  const isAdmin = currentUser.role === 'admin' || currentUser.role === 'super_admin';

  const [activeTab, setActiveTab] = useState<ActiveFilterTab>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isComposeOpen, setIsComposeOpen] = useState(false);
  const [confirmClearRead, setConfirmClearRead] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [isMarkingAll, setIsMarkingAll] = useState(false);
  const [isClearingRead, setIsClearingRead] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Admin Compose Form State
  const [targetScope, setTargetScope] = useState<NotificationAudienceScope>('clients');
  const [specificRole, setSpecificRole] = useState<SpecificRoleType>('client');
  const [recipientSearch, setRecipientSearch] = useState('');
  const [selectedRecipientId, setSelectedRecipientId] = useState('');
  const [messageType, setMessageType] = useState<UserNotificationMessage['type']>('info');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [sendFeedback, setSendFeedback] = useState<{ ok: boolean; text: string } | null>(null);

  // Close with Escape key (without deleting messages)
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Lock background scroll while full-screen overlay is open
  useEffect(() => {
    if (!isOpen || typeof document === 'undefined') return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [isOpen]);

  // Merge server recipients + local fallback users so admin always has full recipient list
  const mergedRecipients = useMemo<NotificationRecipientsPayload>(() => {
    const mapRole = (
      base: NotificationRecipientOption[] | undefined,
      role: SpecificRoleType
    ): NotificationRecipientOption[] => {
      const byId = new Map<string, NotificationRecipientOption>();
      (base || []).forEach(r => {
        if (r?.id) byId.set(r.id, r);
      });
      fallbackUsers
        .filter(u => u.role === role)
        .forEach(u => {
          if (!byId.has(u.id)) {
            byId.set(u.id, {
              id: u.id,
              name: u.name,
              companyName: u.companyName,
              email: u.email,
              city: u.city,
              phone: u.phone
            });
          }
        });
      return Array.from(byId.values()).sort((a, b) =>
        (a.companyName || a.name).localeCompare(b.companyName || b.name)
      );
    };

    return {
      clients: mapRole(recipients?.clients, 'client'),
      drivers: mapRole(recipients?.drivers, 'driver'),
      employees: mapRole(recipients?.employees, 'employee')
    };
  }, [recipients, fallbackUsers]);

  const activeSpecificRecipientList = useMemo(() => {
    const raw =
      specificRole === 'client'
        ? mergedRecipients.clients
        : specificRole === 'driver'
        ? mergedRecipients.drivers
        : mergedRecipients.employees;
    const q = recipientSearch.trim().toLowerCase();
    if (!q) return raw;
    return raw.filter(
      r =>
        r.name.toLowerCase().includes(q) ||
        (r.companyName && r.companyName.toLowerCase().includes(q)) ||
        (r.email && r.email.toLowerCase().includes(q)) ||
        (r.city && r.city.toLowerCase().includes(q)) ||
        (r.phone && r.phone.toLowerCase().includes(q))
    );
  }, [mergedRecipients, specificRole, recipientSearch]);

  // Keep selectedRecipientId valid when switching role
  useEffect(() => {
    if (targetScope !== 'user') return;
    if (
      activeSpecificRecipientList.length > 0 &&
      !activeSpecificRecipientList.some(r => r.id === selectedRecipientId)
    ) {
      setSelectedRecipientId(activeSpecificRecipientList[0].id);
    } else if (activeSpecificRecipientList.length === 0) {
      setSelectedRecipientId('');
    }
  }, [targetScope, activeSpecificRecipientList, selectedRecipientId]);

  const readCount = useMemo(
    () => notifications.filter(n => Boolean(n.isRead)).length,
    [notifications]
  );

  const displayedList = useMemo(() => {
    const source = activeTab === 'sent' ? sentNotifications : notifications;
    const q = searchQuery.trim().toLowerCase();
    return source.filter(n => {
      if (activeTab === 'unread' && n.isRead) return false;
      if (activeTab === 'read' && !n.isRead) return false;
      if (!q) return true;
      return (
        n.title.toLowerCase().includes(q) ||
        n.message.toLowerCase().includes(q) ||
        n.senderName.toLowerCase().includes(q) ||
        (n.targetUserName && n.targetUserName.toLowerCase().includes(q))
      );
    });
  }, [activeTab, notifications, sentNotifications, searchQuery]);

  if (!isOpen) return null;

  const handleRefreshClick = async () => {
    setIsRefreshing(true);
    try {
      await onRefresh();
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleMarkOneRead = async (id: string) => {
    setBusyId(id);
    try {
      await onMarkRead(id);
    } finally {
      setBusyId(null);
    }
  };

  const handleMarkAllClick = async () => {
    setIsMarkingAll(true);
    try {
      await onMarkAllRead();
    } finally {
      setIsMarkingAll(false);
    }
  };

  const handleDeleteClick = async (id: string, isGlobal = false) => {
    setBusyId(id);
    try {
      await onDeleteNotification(id, { global: isGlobal });
      setPendingDeleteId(null);
    } finally {
      setBusyId(null);
    }
  };

  const handleClearReadClick = async () => {
    setIsClearingRead(true);
    try {
      await onClearRead();
      setConfirmClearRead(false);
    } finally {
      setIsClearingRead(false);
    }
  };

  const handleComposeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSendFeedback(null);
    const cleanTitle = title.trim();
    const cleanMessage = body.trim();

    if (!cleanTitle || !cleanMessage) {
      setSendFeedback({ ok: false, text: 'Veuillez renseigner un titre et un message.' });
      return;
    }

    let chosenRecipient: NotificationRecipientOption | undefined;
    if (targetScope === 'user') {
      const list =
        specificRole === 'client'
          ? mergedRecipients.clients
          : specificRole === 'driver'
          ? mergedRecipients.drivers
          : mergedRecipients.employees;
      chosenRecipient = list.find(r => r.id === selectedRecipientId);
      if (!chosenRecipient) {
        setSendFeedback({ ok: false, text: 'Veuillez sélectionner un destinataire.' });
        return;
      }
    }

    setIsSending(true);
    try {
      const res = await onSendMessage({
        title: cleanTitle,
        message: cleanMessage,
        type: messageType,
        targetScope,
        targetRole: targetScope === 'user' ? (specificRole as UserRole) : undefined,
        targetUserId: chosenRecipient?.id,
        targetUserEmail: chosenRecipient?.email,
        targetUserName: chosenRecipient
          ? chosenRecipient.companyName || chosenRecipient.name
          : undefined
      });

      if (res.success) {
        setTitle('');
        setBody('');
        setSendFeedback({
          ok: true,
          text: 'Notification envoyée et enregistrée dans Supabase.'
        });
        setTimeout(() => setSendFeedback(null), 4000);
      } else {
        setSendFeedback({
          ok: false,
          text: res.error || "Impossible d'envoyer la notification."
        });
      }
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="fariousy-notifications-title"
      className="fixed inset-0 z-[70] bg-slate-50 text-slate-900 flex flex-col overflow-hidden"
    >
      {/* Top Bar — Clean Fariousy Header with Title, Unread Counter & Close (X) */}
      <header className="shrink-0 bg-white border-b border-slate-200">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-red-600 text-white flex items-center justify-center shrink-0">
              <Bell className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h1
                id="fariousy-notifications-title"
                className="text-base sm:text-lg font-extrabold text-slate-900 tracking-tight truncate"
              >
                Notifications et Messages
              </h1>
              <div className="flex items-center gap-2 text-xs text-slate-500 font-medium">
                <span
                  className={`font-bold tabular-nums ${
                    unreadCount > 0 ? 'text-red-600' : 'text-slate-600'
                  }`}
                >
                  {unreadCount === 0
                    ? 'Aucun nouveau message'
                    : unreadCount === 1
                    ? '1 nouveau message'
                    : `${unreadCount} nouveaux messages`}
                </span>
                <span aria-hidden="true">·</span>
                <span className="truncate max-w-[160px] sm:max-w-none">
                  {currentUser.companyName || currentUser.name}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {isAdmin && (
              <button
                type="button"
                onClick={() => {
                  setIsComposeOpen(prev => !prev);
                  setSendFeedback(null);
                }}
                className="hidden sm:inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-red-600 hover:bg-red-700 rounded-xl transition-colors cursor-pointer whitespace-nowrap"
              >
                <Plus className="w-4 h-4" />
                <span>{isComposeOpen ? 'Masquer le formulaire' : 'Envoyer un message'}</span>
              </button>
            )}

            <button
              type="button"
              onClick={handleRefreshClick}
              disabled={isRefreshing}
              aria-label="Actualiser les notifications"
              title="Actualiser"
              className="w-10 h-10 flex items-center justify-center text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl border border-slate-200 transition-colors cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            </button>

            <button
              type="button"
              onClick={onClose}
              aria-label="Fermer les notifications"
              title="Fermer sans supprimer"
              className="w-11 h-11 flex items-center justify-center text-slate-700 hover:text-red-600 bg-slate-100 hover:bg-red-50 rounded-xl border border-slate-200 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Scrollable Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-5 sm:py-6 space-y-5">
          {/* Mobile Admin Compose Trigger */}
          {isAdmin && (
            <div className="sm:hidden">
              <button
                type="button"
                onClick={() => {
                  setIsComposeOpen(prev => !prev);
                  setSendFeedback(null);
                }}
                className="w-full min-h-[44px] flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-bold text-white bg-red-600 hover:bg-red-700 rounded-xl transition-colors cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>{isComposeOpen ? 'Fermer le formulaire' : 'Envoyer un message'}</span>
              </button>
            </div>
          )}

          {/* Admin Compose Panel */}
          {isAdmin && isComposeOpen && (
            <section className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-6 space-y-4">
              <div className="flex items-center justify-between gap-2 pb-3 border-b border-slate-100">
                <div>
                  <h2 className="text-sm sm:text-base font-bold text-slate-900">
                    Envoyer une notification ou un message
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Le message est enregistré dans Supabase et livré uniquement aux destinataires choisis.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsComposeOpen(false)}
                  aria-label="Fermer le formulaire d'envoi"
                  className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleComposeSubmit} className="space-y-4">
                {/* Audience Selector */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-2">
                    Destinataires
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {(
                      [
                        { id: 'all', label: 'Tous les utilisateurs' },
                        { id: 'clients', label: `Tous les clients (${mergedRecipients.clients.length})` },
                        { id: 'drivers', label: `Tous les livreurs (${mergedRecipients.drivers.length})` },
                        { id: 'employees', label: `Tous les employés (${mergedRecipients.employees.length})` },
                        { id: 'user', label: 'Destinataire précis' }
                      ] as Array<{ id: NotificationAudienceScope; label: string }>
                    ).map(opt => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setTargetScope(opt.id)}
                        className={`px-3.5 py-2 text-xs font-semibold rounded-xl border transition-colors cursor-pointer whitespace-nowrap ${
                          targetScope === opt.id
                            ? 'bg-slate-900 text-white border-slate-900'
                            : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Specific Recipient Picker */}
                {targetScope === 'user' && (
                  <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                    <div className="flex flex-wrap items-center gap-2">
                      {(
                        [
                          { id: 'client', label: `Clients (${mergedRecipients.clients.length})` },
                          { id: 'driver', label: `Livreurs (${mergedRecipients.drivers.length})` },
                          { id: 'employee', label: `Employés (${mergedRecipients.employees.length})` }
                        ] as Array<{ id: SpecificRoleType; label: string }>
                      ).map(roleOpt => (
                        <button
                          key={roleOpt.id}
                          type="button"
                          onClick={() => {
                            setSpecificRole(roleOpt.id);
                            setRecipientSearch('');
                          }}
                          className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                            specificRole === roleOpt.id
                              ? 'bg-red-600 text-white'
                              : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
                          }`}
                        >
                          {roleOpt.label}
                        </button>
                      ))}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      <div className="relative">
                        <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                        <input
                          type="text"
                          value={recipientSearch}
                          onChange={e => setRecipientSearch(e.target.value)}
                          placeholder="Filtrer par nom, boutique, ville..."
                          className="w-full pl-9 pr-3 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500"
                        />
                      </div>

                      <select
                        value={selectedRecipientId}
                        onChange={e => setSelectedRecipientId(e.target.value)}
                        className="w-full px-3 py-2 text-xs font-semibold bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500"
                      >
                        {activeSpecificRecipientList.length === 0 ? (
                          <option value="">Aucun compte trouvé</option>
                        ) : (
                          activeSpecificRecipientList.map(rec => (
                            <option key={rec.id} value={rec.id}>
                              {rec.companyName ? `${rec.companyName} — ${rec.name}` : rec.name}
                              {rec.city ? ` (${rec.city})` : ''}
                            </option>
                          ))
                        )}
                      </select>
                    </div>
                  </div>
                )}

                {/* Priority / Category + Subject */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                      Objet / Titre du message
                    </label>
                    <input
                      type="text"
                      value={title}
                      onChange={e => setTitle(e.target.value)}
                      maxLength={160}
                      placeholder="Ex : Mise à jour des horaires de ramassage"
                      className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-500"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                      Type de notification
                    </label>
                    <select
                      value={messageType}
                      onChange={e =>
                        setMessageType(e.target.value as UserNotificationMessage['type'])
                      }
                      className="w-full px-3.5 py-2.5 text-sm font-medium bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-500"
                    >
                      <option value="info">Information</option>
                      <option value="alert">Important / Urgent</option>
                      <option value="warning">Avertissement</option>
                      <option value="success">Confirmation / Succès</option>
                    </select>
                  </div>
                </div>

                {/* Message Body */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Message
                  </label>
                  <textarea
                    value={body}
                    onChange={e => setBody(e.target.value)}
                    rows={3}
                    maxLength={2000}
                    placeholder="Rédigez votre message destiné aux utilisateurs..."
                    className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-500 resize-y"
                    required
                  />
                </div>

                {sendFeedback && (
                  <div
                    className={`px-3.5 py-2.5 rounded-xl text-xs font-semibold border ${
                      sendFeedback.ok
                        ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                        : 'bg-rose-50 border-rose-200 text-rose-800'
                    }`}
                  >
                    {sendFeedback.text}
                  </div>
                )}

                <div className="flex items-center justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setIsComposeOpen(false)}
                    className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                  >
                    Annuler
                  </button>
                  <button
                    type="submit"
                    disabled={isSending}
                    className="inline-flex items-center gap-2 px-5 py-2.5 text-xs font-bold text-white bg-red-600 hover:bg-red-700 rounded-xl transition-colors cursor-pointer disabled:opacity-60"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>{isSending ? 'Envoi en cours...' : 'Envoyer maintenant'}</span>
                  </button>
                </div>
              </form>
            </section>
          )}

          {/* Toolbar: Filter Tabs, Search & Bulk Actions */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            {/* Segmented Filter Tabs */}
            <div className="flex items-center gap-1 p-1 bg-slate-200/70 rounded-xl overflow-x-auto">
              <button
                type="button"
                onClick={() => setActiveTab('all')}
                className={`px-3.5 py-2 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer tabular-nums ${
                  activeTab === 'all'
                    ? 'bg-white text-slate-900 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Tous ({notifications.length})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('unread')}
                className={`px-3.5 py-2 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer tabular-nums ${
                  activeTab === 'unread'
                    ? 'bg-white text-red-600 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Non lus ({unreadCount})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('read')}
                className={`px-3.5 py-2 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer tabular-nums ${
                  activeTab === 'read'
                    ? 'bg-white text-slate-900 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Lus ({readCount})
              </button>
              {isAdmin && (
                <button
                  type="button"
                  onClick={() => setActiveTab('sent')}
                  className={`px-3.5 py-2 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer tabular-nums ${
                    activeTab === 'sent'
                      ? 'bg-white text-slate-900 shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Envoyés ({sentNotifications.length})
                </button>
              )}
            </div>

            {/* Search + Bulk Mark Read / Clear Read */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative flex-1 sm:flex-initial sm:w-60">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Rechercher un message..."
                  className="w-full pl-9 pr-3 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500"
                />
              </div>

              {activeTab !== 'sent' && unreadCount > 0 && (
                <button
                  type="button"
                  onClick={handleMarkAllClick}
                  disabled={isMarkingAll}
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 rounded-xl transition-colors cursor-pointer whitespace-nowrap disabled:opacity-50"
                >
                  <CheckCheck className="w-3.5 h-3.5 text-emerald-600" />
                  <span>{isMarkingAll ? 'Validation...' : 'Tout marquer lu'}</span>
                </button>
              )}

              {activeTab !== 'sent' && readCount > 0 && (
                confirmClearRead ? (
                  <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-rose-50 border border-rose-200 rounded-xl text-xs">
                    <span className="font-semibold text-rose-800">Supprimer les lus ?</span>
                    <button
                      type="button"
                      onClick={handleClearReadClick}
                      disabled={isClearingRead}
                      className="px-2 py-0.5 bg-rose-600 text-white font-bold rounded-md hover:bg-rose-700 cursor-pointer"
                    >
                      Oui
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmClearRead(false)}
                      className="px-2 py-0.5 text-slate-600 hover:bg-white rounded-md cursor-pointer"
                    >
                      Non
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirmClearRead(true)}
                    className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-rose-700 bg-white hover:bg-rose-50 border border-slate-200 rounded-xl transition-colors cursor-pointer whitespace-nowrap"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Supprimer les lus</span>
                  </button>
                )
              )}
            </div>
          </div>

          {/* Error Notice */}
          {errorMessage && (
            <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-xs font-semibold text-rose-800">
              {errorMessage}
            </div>
          )}

          {/* Notifications List */}
          {isLoading && displayedList.length === 0 ? (
            <div className="space-y-3">
              {[0, 1, 2].map(idx => (
                <div
                  key={idx}
                  className="bg-white border border-slate-200 rounded-2xl p-5 animate-pulse space-y-3"
                >
                  <div className="h-3 w-48 bg-slate-200 rounded" />
                  <div className="h-4 w-2/3 bg-slate-200 rounded" />
                  <div className="h-3 w-full bg-slate-100 rounded" />
                </div>
              ))}
            </div>
          ) : displayedList.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-2xl py-14 px-6 text-center space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
                <MailOpen className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-slate-900">
                {activeTab === 'unread'
                  ? 'Aucun nouveau message non lu'
                  : activeTab === 'read'
                  ? 'Aucun message lu pour le moment'
                  : activeTab === 'sent'
                  ? 'Aucun message envoyé'
                  : 'Aucune notification pour le moment'}
              </h3>
              <p className="text-xs sm:text-sm text-slate-500 max-w-md mx-auto">
                {activeTab === 'unread'
                  ? 'Vous êtes à jour. Toutes vos notifications ont été consultées.'
                  : 'Les messages et annonces qui vous sont destinés apparaîtront automatiquement ici.'}
              </p>
              {isAdmin && !isComposeOpen && (
                <div className="pt-2">
                  <button
                    type="button"
                    onClick={() => setIsComposeOpen(true)}
                    className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-bold text-white bg-red-600 hover:bg-red-700 rounded-xl transition-colors cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Envoyer le premier message</span>
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {displayedList.map(notif => {
                const isSentTab = activeTab === 'sent';
                const isUnread = !isSentTab && !notif.isRead;
                const typeMeta = TYPE_META[notif.type] || TYPE_META.info;
                const TypeIcon = typeMeta.icon;
                const isBusy = busyId === notif.id;
                const isConfirmingDelete = pendingDeleteId === notif.id;

                return (
                  <article
                    key={notif.id}
                    onClick={() => {
                      if (isUnread && !isBusy) {
                        void handleMarkOneRead(notif.id);
                      }
                    }}
                    className={`rounded-2xl border p-4 sm:p-5 transition-colors ${
                      isUnread
                        ? 'bg-white border-red-200 shadow-2xs cursor-pointer hover:border-red-300'
                        : 'bg-white/75 border-slate-200/90'
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                      <div className="min-w-0 flex-1 space-y-2">
                        {/* Clean Unboxed Metadata Line */}
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
                          {isSentTab ? (
                            <span className="inline-flex items-center gap-1 font-semibold text-slate-700">
                              <Users className="w-3.5 h-3.5 text-slate-500" />
                              <span>{getAudienceLabel(notif)}</span>
                            </span>
                          ) : isUnread ? (
                            <span className="font-extrabold text-red-600">
                              Nouveau · Non lu
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 font-medium text-emerald-700">
                              <Check className="w-3.5 h-3.5" />
                              <span>Lu</span>
                            </span>
                          )}

                          <span className="text-slate-300" aria-hidden="true">
                            ·
                          </span>

                          <span className={`inline-flex items-center gap-1 font-semibold ${typeMeta.textClass}`}>
                            <TypeIcon className="w-3.5 h-3.5 shrink-0" />
                            <span>{typeMeta.label}</span>
                          </span>

                          <span className="text-slate-300" aria-hidden="true">
                            ·
                          </span>

                          <span className="text-slate-500">
                            De <span className="font-semibold text-slate-700">{notif.senderName}</span>
                          </span>

                          <span className="text-slate-300" aria-hidden="true">
                            ·
                          </span>

                          <span className="inline-flex items-center gap-1 text-slate-500 font-mono tabular-nums text-[11px]">
                            <Clock className="w-3 h-3 shrink-0" />
                            <span>{formatDateTimeFR(notif.createdAt)}</span>
                          </span>
                        </div>

                        {/* Title */}
                        <h3
                          className={`text-sm sm:text-base leading-snug ${
                            isUnread
                              ? 'font-extrabold text-slate-900'
                              : 'font-semibold text-slate-700'
                          }`}
                        >
                          {notif.title}
                        </h3>

                        {/* Message Body */}
                        <p
                          className={`text-sm leading-relaxed whitespace-pre-line ${
                            isUnread ? 'text-slate-800' : 'text-slate-600'
                          }`}
                        >
                          {notif.message}
                        </p>

                        {/* Read count info on Admin Sent Tab */}
                        {isSentTab && (
                          <div className="pt-1 text-xs text-slate-500 font-medium tabular-nums">
                            Lu par {notif.readCount || 0}{' '}
                            {(notif.readCount || 0) > 1 ? 'utilisateurs' : 'utilisateur'}
                          </div>
                        )}
                      </div>

                      {/* Card Actions */}
                      <div
                        className="flex items-center gap-2 shrink-0 sm:self-start pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100"
                        onClick={e => e.stopPropagation()}
                      >
                        {isUnread && (
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => void handleMarkOneRead(notif.id)}
                            className="min-h-[38px] inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-xl transition-colors cursor-pointer whitespace-nowrap disabled:opacity-50"
                          >
                            <Check className="w-3.5 h-3.5" />
                            <span>Marquer comme lu</span>
                          </button>
                        )}

                        {isConfirmingDelete ? (
                          <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-rose-50 border border-rose-200 rounded-xl text-xs">
                            <span className="font-semibold text-rose-800">
                              {isSentTab ? 'Supprimer pour tous ?' : 'Supprimer ?'}
                            </span>
                            <button
                              type="button"
                              disabled={isBusy}
                              onClick={() => void handleDeleteClick(notif.id, isSentTab)}
                              className="px-2 py-0.5 bg-rose-600 text-white font-bold rounded-md hover:bg-rose-700 cursor-pointer"
                            >
                              Oui
                            </button>
                            <button
                              type="button"
                              onClick={() => setPendingDeleteId(null)}
                              className="px-2 py-0.5 text-slate-600 hover:bg-white rounded-md cursor-pointer"
                            >
                              Non
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => setPendingDeleteId(notif.id)}
                            aria-label="Supprimer cette notification"
                            title={isSentTab ? 'Supprimer pour tous' : 'Supprimer la notification'}
                            className="min-h-[38px] inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-slate-500 hover:text-rose-700 hover:bg-rose-50 rounded-xl transition-colors cursor-pointer disabled:opacity-50"
                          >
                            <Trash2 className="w-4 h-4" />
                            <span className="sm:hidden">Supprimer</span>
                          </button>
                        )}
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Subtle Bottom Action Bar (Android / Mobile friendly close without deleting) */}
      <footer className="shrink-0 bg-white border-t border-slate-200 px-4 sm:px-6 py-3">
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-3">
          <span className="text-xs text-slate-500 hidden sm:inline">
            La fermeture de cette fenêtre conserve tous vos messages dans votre espace.
          </span>
          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto min-h-[44px] inline-flex items-center justify-center gap-2 px-5 py-2.5 text-xs sm:text-sm font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
          >
            <span>Accéder à l&apos;application</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </footer>
    </div>
  );
};
