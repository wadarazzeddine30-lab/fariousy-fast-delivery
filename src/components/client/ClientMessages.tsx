import React, { useState, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useDatabase } from '../../context/DatabaseContext';
import { useLanguage } from '../../i18n/LanguageContext';
import {
  ClientMessage,
  ClientMessageCategory,
  ClientMessageStatus,
  PackageItem
} from '../../types';
import {
  CreateClientMessageModal,
  CATEGORY_CONFIG
} from './CreateClientMessageModal';
import {
  MessageSquare,
  PlusCircle,
  Search,
  Filter,
  Clock,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Send,
  Package,
  ArrowRight,
  ShieldCheck,
  User,
  ExternalLink,
  ChevronRight,
  HelpCircle,
  Phone,
  RefreshCw,
  Sparkles
} from 'lucide-react';

interface ClientMessagesProps {
  onViewPackage?: (pkg: PackageItem) => void;
}

export const ClientMessages: React.FC<ClientMessagesProps> = ({ onViewPackage }) => {
  const { currentUser } = useAuth();
  const {
    clientMessages,
    packages,
    replyToClientMessage,
    updateClientMessageStatus
  } = useDatabase();
  const { t, isRtl } = useLanguage();

  const [selectedMessageId, setSelectedMessageId] = useState<string | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'resolu'>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [replyText, setReplyText] = useState('');
  const [isSendingReply, setIsSendingReply] = useState(false);

  // Filter messages for current client user
  const myMessages = useMemo(() => {
    return clientMessages.filter(
      m => m.clientId === currentUser?.id || !currentUser?.id
    );
  }, [clientMessages, currentUser]);

  // KPIs
  const totalCount = myMessages.length;
  const newCount = myMessages.filter(m => m.status === 'nouveau').length;
  const inProgressCount = myMessages.filter(m => m.status === 'en_cours').length;
  const resolvedCount = myMessages.filter(m => m.status === 'resolu' || m.status === 'ferme').length;

  // Filtered list
  const filteredMessages = useMemo(() => {
    return myMessages.filter(m => {
      // Status filter
      if (statusFilter === 'pending' && !(m.status === 'nouveau' || m.status === 'en_cours')) {
        return false;
      }
      if (statusFilter === 'resolu' && !(m.status === 'resolu' || m.status === 'ferme')) {
        return false;
      }

      // Category filter
      if (categoryFilter !== 'all' && m.category !== categoryFilter) {
        return false;
      }

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchSubject = m.subject.toLowerCase().includes(q);
        const matchBody = m.message.toLowerCase().includes(q);
        const matchTracking = m.packageTrackingNumber?.toLowerCase().includes(q);
        if (!matchSubject && !matchBody && !matchTracking) return false;
      }

      return true;
    });
  }, [myMessages, statusFilter, categoryFilter, searchQuery]);

  // Selected active message
  const activeMessage = useMemo(() => {
    if (selectedMessageId) {
      return myMessages.find(m => m.id === selectedMessageId) || null;
    }
    return filteredMessages[0] || null;
  }, [selectedMessageId, myMessages, filteredMessages]);

  // Linked package of active message
  const linkedPackage = useMemo(() => {
    if (!activeMessage?.packageTrackingNumber && !activeMessage?.packageId) return null;
    return packages.find(
      p =>
        (activeMessage.packageId && p.id === activeMessage.packageId) ||
        (activeMessage.packageTrackingNumber && p.trackingNumber === activeMessage.packageTrackingNumber)
    );
  }, [activeMessage, packages]);

  const handleSendReply = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeMessage || !replyText.trim()) return;

    setIsSendingReply(true);
    replyToClientMessage(
      activeMessage.id,
      replyText.trim(),
      currentUser
        ? { id: currentUser.id, name: currentUser.name, role: 'client' }
        : { id: 'client-anon', name: 'Client Boutique', role: 'client' }
    );

    setReplyText('');
    setIsSendingReply(false);
  };

  const handleResolveMessage = (messageId: string) => {
    if (confirm('Marquer cette demande comme résolue ?')) {
      updateClientMessageStatus(messageId, 'resolu', currentUser?.name || 'Client');
    }
  };

  const getStatusBadge = (status: ClientMessageStatus) => {
    switch (status) {
      case 'nouveau':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-600 animate-pulse"></span>
            En attente de réponse
          </span>
        );
      case 'en_cours':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-600"></span>
            En cours de traitement
          </span>
        );
      case 'resolu':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
            Résolu
          </span>
        );
      case 'ferme':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
            Clôturé
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5 mb-1.5">
            <div className="w-9 h-9 rounded-xl bg-red-50 border border-red-200 text-red-600 flex items-center justify-center">
              <MessageSquare className="w-5 h-5" />
            </div>
            <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">
              Messagerie & Support Client
            </h1>
          </div>
          <p className="text-xs text-slate-600 max-w-2xl">
            Émettez vos réclamations, posez des questions sur vos colis, signalez un changement d'adresse ou sollicitez un ramassage urgent auprès de l'équipe logistique Fariousy.
          </p>
        </div>

        <button
          onClick={() => setIsCreateModalOpen(true)}
          className="px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-xs transition-all self-start md:self-auto shrink-0"
        >
          <PlusCircle className="w-4 h-4" />
          <span>Émettre un nouveau message</span>
        </button>
      </div>

      {/* KPI Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
        <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-2xs">
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
            Total Messages
          </div>
          <div className="text-2xl font-black text-slate-900 font-mono">
            {totalCount}
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">Demandes émises</div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-2xs">
          <div className="text-[11px] font-bold uppercase tracking-wider text-blue-600 mb-1">
            En attente
          </div>
          <div className="text-2xl font-black text-blue-700 font-mono">
            {newCount}
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">Non encore traités</div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-2xs">
          <div className="text-[11px] font-bold uppercase tracking-wider text-amber-600 mb-1">
            En cours
          </div>
          <div className="text-2xl font-black text-amber-700 font-mono">
            {inProgressCount}
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">Discussion active</div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-2xs">
          <div className="text-[11px] font-bold uppercase tracking-wider text-emerald-600 mb-1">
            Résolus
          </div>
          <div className="text-2xl font-black text-emerald-700 font-mono">
            {resolvedCount}
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">Clôturés avec succès</div>
        </div>
      </div>

      {/* Master-Detail Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Left List (5 cols) */}
        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden flex flex-col h-[750px]">
          {/* List Search & Filter Bar */}
          <div className="p-4 border-b border-slate-200/80 space-y-3 bg-slate-50/50">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Rechercher par objet, message, N° colis..."
                className="w-full pl-9 pr-3.5 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500 font-medium"
              />
            </div>

            {/* Quick Status Tabs */}
            <div className="flex items-center gap-1.5 p-1 bg-slate-200/70 rounded-xl text-xs font-semibold">
              <button
                type="button"
                onClick={() => setStatusFilter('all')}
                className={`flex-1 py-1.5 rounded-lg text-center transition-all ${
                  statusFilter === 'all'
                    ? 'bg-white text-slate-900 font-bold shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Tous ({totalCount})
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('pending')}
                className={`flex-1 py-1.5 rounded-lg text-center transition-all ${
                  statusFilter === 'pending'
                    ? 'bg-white text-slate-900 font-bold shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Actifs ({newCount + inProgressCount})
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('resolu')}
                className={`flex-1 py-1.5 rounded-lg text-center transition-all ${
                  statusFilter === 'resolu'
                    ? 'bg-white text-slate-900 font-bold shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Résolus ({resolvedCount})
              </button>
            </div>

            {/* Category Filter */}
            <div className="flex items-center justify-between text-xs">
              <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                Catégorie :
              </label>
              <select
                value={categoryFilter}
                onChange={e => setCategoryFilter(e.target.value)}
                className="text-xs bg-white border border-slate-200 rounded-lg px-2.5 py-1 text-slate-700 font-medium focus:outline-none focus:ring-1 focus:ring-red-500"
              >
                <option value="all">Toutes les catégories</option>
                {(Object.keys(CATEGORY_CONFIG) as ClientMessageCategory[]).map(catKey => (
                  <option key={catKey} value={catKey}>
                    {CATEGORY_CONFIG[catKey].label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* List Content */}
          <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
            {filteredMessages.length === 0 ? (
              <div className="p-8 text-center space-y-3">
                <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
                  <MessageSquare className="w-6 h-6" />
                </div>
                <div className="text-xs font-bold text-slate-700">Aucun message trouvé</div>
                <p className="text-[11px] text-slate-500 max-w-xs mx-auto">
                  Vous n'avez aucun message correspondant aux filtres sélectionnés. Cliquez ci-dessous pour émettre votre première demande.
                </p>
                <button
                  onClick={() => setIsCreateModalOpen(true)}
                  className="px-3.5 py-1.5 text-xs font-bold text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition-colors"
                >
                  + Nouveau message
                </button>
              </div>
            ) : (
              filteredMessages.map(msg => {
                const isSelected = activeMessage?.id === msg.id;
                const catCfg = CATEGORY_CONFIG[msg.category] || CATEGORY_CONFIG.autre;
                const CatIcon = catCfg.icon;
                const hasReplies = msg.replies && msg.replies.length > 0;
                const lastActivity = hasReplies
                  ? msg.replies[msg.replies.length - 1].createdAt
                  : msg.createdAt;

                return (
                  <button
                    key={msg.id}
                    type="button"
                    onClick={() => setSelectedMessageId(msg.id)}
                    className={`w-full text-left p-4 transition-colors flex flex-col gap-2 relative ${
                      isSelected
                        ? 'bg-red-50/50 border-l-4 border-red-600'
                        : 'hover:bg-slate-50 border-l-4 border-transparent'
                    }`}
                  >
                    {/* Top Row: Category & Status */}
                    <div className="flex items-center justify-between gap-2">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold border ${catCfg.color}`}>
                        <CatIcon className="w-3 h-3" />
                        <span className="truncate max-w-[140px]">{catCfg.label}</span>
                      </span>

                      <div className="flex items-center gap-1.5 shrink-0">
                        {msg.priority === 'urgente' && (
                          <span className="px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-rose-100 text-rose-700 flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3" />
                            Urgente
                          </span>
                        )}
                        {getStatusBadge(msg.status)}
                      </div>
                    </div>

                    {/* Subject */}
                    <div className="text-xs font-bold text-slate-900 line-clamp-1">
                      {msg.subject}
                    </div>

                    {/* Preview */}
                    <div className="text-[11px] text-slate-600 line-clamp-2">
                      {hasReplies
                        ? `Dernière réponse : ${msg.replies[msg.replies.length - 1].message}`
                        : msg.message}
                    </div>

                    {/* Bottom Metadata */}
                    <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1">
                      <div className="flex items-center gap-2">
                        {msg.packageTrackingNumber && (
                          <span className="font-mono font-bold text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded-sm flex items-center gap-1">
                            <Package className="w-3 h-3 text-slate-500" />
                            {msg.packageTrackingNumber}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        {hasReplies && (
                          <span className="font-semibold text-slate-500">
                            {msg.replies.length} réponse{msg.replies.length > 1 ? 's' : ''}
                          </span>
                        )}
                        <span>{new Date(lastActivity).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Right Detail Thread (7 cols) */}
        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden flex flex-col h-[750px]">
          {activeMessage ? (
            <>
              {/* Thread Header */}
              <div className="p-5 border-b border-slate-200 bg-slate-50/60 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      {getStatusBadge(activeMessage.status)}
                      {activeMessage.priority === 'urgente' && (
                        <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-rose-100 text-rose-700 border border-rose-200">
                          ⚠️ Traitement prioritaire
                        </span>
                      )}
                      <span className="text-xs text-slate-500">
                        Réf : <strong className="font-mono text-slate-700">{activeMessage.id}</strong>
                      </span>
                    </div>

                    <h2 className="text-base font-bold text-slate-900">
                      {activeMessage.subject}
                    </h2>
                  </div>

                  {/* Action button */}
                  {activeMessage.status !== 'resolu' && activeMessage.status !== 'ferme' && (
                    <button
                      type="button"
                      onClick={() => handleResolveMessage(activeMessage.id)}
                      className="px-3 py-1.5 rounded-xl border border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 text-xs font-bold flex items-center gap-1.5 transition-colors self-start shrink-0"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Marquer résolu</span>
                    </button>
                  )}
                </div>

                {/* Linked Package Card if present */}
                {linkedPackage && (
                  <div className="bg-white border border-slate-200 rounded-xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg bg-red-50 border border-red-200 text-red-600 flex items-center justify-center shrink-0">
                        <Package className="w-4 h-4" />
                      </div>
                      <div className="text-xs">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-slate-900">
                            {linkedPackage.trackingNumber}
                          </span>
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 text-slate-700">
                            {linkedPackage.status}
                          </span>
                        </div>
                        <div className="text-slate-600">
                          Destinataire : <strong>{linkedPackage.recipientName}</strong> ({linkedPackage.city}) • Tél : {linkedPackage.recipientPhone}
                        </div>
                      </div>
                    </div>

                    {onViewPackage && (
                      <button
                        type="button"
                        onClick={() => onViewPackage(linkedPackage)}
                        className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold flex items-center gap-1.5 self-start sm:self-auto transition-colors"
                      >
                        <ExternalLink className="w-3 h-3 text-slate-600" />
                        <span>Fiche colis</span>
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Thread Messages Timeline */}
              <div className="flex-1 overflow-y-auto p-5 space-y-4 bg-slate-100/40">
                {/* 1. Client's Initial Emission */}
                <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-2xs space-y-2">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-slate-900 text-white font-bold text-xs flex items-center justify-center">
                        {activeMessage.clientName.charAt(0)}
                      </div>
                      <div>
                        <div className="text-xs font-bold text-slate-900">
                          {activeMessage.clientName}
                          {activeMessage.clientCompany && (
                            <span className="text-slate-500 font-normal ml-1">
                              ({activeMessage.clientCompany})
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-slate-400 font-semibold">
                          Émetteur (Vous)
                        </div>
                      </div>
                    </div>
                    <span className="text-[11px] text-slate-400">
                      {new Date(activeMessage.createdAt).toLocaleString('fr-FR', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </span>
                  </div>

                  <p className="text-xs text-slate-800 whitespace-pre-wrap leading-relaxed">
                    {activeMessage.message}
                  </p>
                </div>

                {/* 2. Replies */}
                {activeMessage.replies && activeMessage.replies.map(rep => {
                  const isSupport = rep.senderRole === 'support' || rep.senderRole === 'admin' || rep.senderRole === 'employee';
                  return (
                    <div
                      key={rep.id}
                      className={`p-4 rounded-2xl border shadow-2xs space-y-2 ${
                        isSupport
                          ? 'bg-gradient-to-br from-red-50/60 to-white border-red-200 ml-4 sm:ml-8'
                          : 'bg-white border-slate-200 mr-4 sm:mr-8'
                      }`}
                    >
                      <div className="flex items-center justify-between border-b border-slate-200/50 pb-2">
                        <div className="flex items-center gap-2">
                          <div
                            className={`w-7 h-7 rounded-lg font-bold text-xs flex items-center justify-center ${
                              isSupport
                                ? 'bg-red-600 text-white'
                                : 'bg-slate-800 text-white'
                            }`}
                          >
                            {isSupport ? 'F' : rep.senderName.charAt(0)}
                          </div>
                          <div>
                            <div className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                              <span>{rep.senderName}</span>
                              {isSupport && (
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded-md text-[9px] font-bold bg-red-100 text-red-800 border border-red-300">
                                  <ShieldCheck className="w-2.5 h-2.5 text-red-600" />
                                  Support Fariousy
                                </span>
                              )}
                            </div>
                            <div className="text-[10px] text-slate-500 font-semibold">
                              {isSupport ? 'Service Opérations & Dispatch' : 'Boutique'}
                            </div>
                          </div>
                        </div>
                        <span className="text-[11px] text-slate-400">
                          {new Date(rep.createdAt).toLocaleString('fr-FR', {
                            day: '2-digit',
                            month: 'short',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </span>
                      </div>

                      <p className="text-xs text-slate-800 whitespace-pre-wrap leading-relaxed">
                        {rep.message}
                      </p>
                    </div>
                  );
                })}

                {/* Resolution banner if resolved */}
                {(activeMessage.status === 'resolu' || activeMessage.status === 'ferme') && (
                  <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-center text-xs text-emerald-800 font-semibold flex items-center justify-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>
                      Ce ticket a été marqué comme résolu le {new Date(activeMessage.resolvedAt || activeMessage.updatedAt).toLocaleDateString('fr-FR')}{activeMessage.resolvedBy ? ` par ${activeMessage.resolvedBy}` : ''}.
                    </span>
                  </div>
                )}
              </div>

              {/* Reply Form Footer */}
              <div className="p-4 border-t border-slate-200 bg-white space-y-2">
                <form onSubmit={handleSendReply} className="space-y-2">
                  <div className="relative">
                    <textarea
                      rows={3}
                      value={replyText}
                      onChange={e => setReplyText(e.target.value)}
                      placeholder="Écrire une réponse ou un complément d'information pour l'équipe Fariousy..."
                      className="w-full text-xs p-3 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-500 resize-none font-sans"
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-slate-400 hidden sm:inline">
                      Délai de traitement moyen : 15 min en heures ouvrées
                    </span>
                    <button
                      type="submit"
                      disabled={isSendingReply || !replyText.trim()}
                      className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 shadow-xs transition-all disabled:opacity-50 ml-auto"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>{isSendingReply ? 'Envoi...' : 'Envoyer la réponse'}</span>
                    </button>
                  </div>
                </form>
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-3">
              <div className="w-16 h-16 rounded-2xl bg-red-50 text-red-600 flex items-center justify-center border border-red-200">
                <MessageSquare className="w-8 h-8" />
              </div>
              <h3 className="text-sm font-bold text-slate-800">
                Aucune conversation sélectionnée
              </h3>
              <p className="text-xs text-slate-500 max-w-sm">
                Sélectionnez un message dans la liste à gauche pour voir les échanges ou émettez une nouvelle demande.
              </p>
              <button
                onClick={() => setIsCreateModalOpen(true)}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs"
              >
                + Nouveau message au support
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Emission Modal */}
      <CreateClientMessageModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onMessageSent={id => setSelectedMessageId(id)}
      />
    </div>
  );
};
