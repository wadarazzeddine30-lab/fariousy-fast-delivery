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
import { CATEGORY_CONFIG } from '../client/CreateClientMessageModal';
import {
  MessageSquare,
  Search,
  CheckCircle2,
  AlertTriangle,
  Send,
  Package,
  ShieldCheck,
  User,
  ExternalLink,
  ChevronRight,
  Clock,
  Building,
  Check,
  Trash2
} from 'lucide-react';

interface AdminClientMessagesProps {
  onViewPackage?: (pkg: PackageItem) => void;
}

export const AdminClientMessages: React.FC<AdminClientMessagesProps> = ({ onViewPackage }) => {
  const { currentUser } = useAuth();
  const {
    clientMessages,
    packages,
    users,
    replyToClientMessage,
    updateClientMessageStatus,
    deleteClientMessage
  } = useDatabase();
  const { t } = useLanguage();

  const [selectedMessageId, setSelectedMessageId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'nouveau' | 'en_cours' | 'resolu'>('all');
  const [clientFilter, setClientFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [replyText, setReplyText] = useState('');
  const [isSendingReply, setIsSendingReply] = useState(false);

  // Distinct clients list for dropdown
  const clientsList = useMemo(() => {
    return users.filter(u => u.role === 'client');
  }, [users]);

  // KPIs
  const totalCount = clientMessages.length;
  const newCount = clientMessages.filter(m => m.status === 'nouveau').length;
  const inProgressCount = clientMessages.filter(m => m.status === 'en_cours').length;
  const resolvedCount = clientMessages.filter(m => m.status === 'resolu' || m.status === 'ferme').length;

  // Filtered list
  const filteredMessages = useMemo(() => {
    return clientMessages.filter(m => {
      if (statusFilter !== 'all' && m.status !== statusFilter) {
        return false;
      }
      if (clientFilter !== 'all' && m.clientId !== clientFilter) {
        return false;
      }
      if (categoryFilter !== 'all' && m.category !== categoryFilter) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchSubject = m.subject.toLowerCase().includes(q);
        const matchBody = m.message.toLowerCase().includes(q);
        const matchClient = (m.clientCompany || m.clientName).toLowerCase().includes(q);
        const matchTracking = m.packageTrackingNumber?.toLowerCase().includes(q);
        if (!matchSubject && !matchBody && !matchClient && !matchTracking) return false;
      }
      return true;
    });
  }, [clientMessages, statusFilter, clientFilter, categoryFilter, searchQuery]);

  const activeMessage = useMemo(() => {
    if (selectedMessageId) {
      return clientMessages.find(m => m.id === selectedMessageId) || null;
    }
    return filteredMessages[0] || null;
  }, [selectedMessageId, clientMessages, filteredMessages]);

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
        ? { id: currentUser.id, name: currentUser.name, role: 'admin' }
        : { id: 'admin-dispatch', name: 'Support Fariousy', role: 'admin' }
    );

    setReplyText('');
    setIsSendingReply(false);
  };

  const handleStatusChange = (status: ClientMessageStatus) => {
    if (!activeMessage) return;
    updateClientMessageStatus(activeMessage.id, status, currentUser?.name || 'Admin');
  };

  const handleDelete = (id: string) => {
    if (confirm('Voulez-vous supprimer ce fil de message ?')) {
      deleteClientMessage(id);
      if (selectedMessageId === id) setSelectedMessageId(null);
    }
  };

  const getStatusBadge = (status: ClientMessageStatus) => {
    switch (status) {
      case 'nouveau':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-600 animate-pulse"></span>
            Nouveau / Non traité
          </span>
        );
      case 'en_cours':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-600"></span>
            En cours
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
            Fermé
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5 mb-1.5">
            <div className="w-9 h-9 rounded-xl bg-slate-900 text-white flex items-center justify-center">
              <MessageSquare className="w-5 h-5" />
            </div>
            <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">
              Messages Clients & Réclamations
            </h1>
          </div>
          <p className="text-xs text-slate-600 max-w-2xl">
            Gestion centralisée des demandes et réclamations émises par les boutiques clientes. Répondez directement et suivez la résolution.
          </p>
        </div>
      </div>

      {/* KPI Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
        <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-2xs">
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
            Total Reçus
          </div>
          <div className="text-2xl font-black text-slate-900 font-mono">
            {totalCount}
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">Toutes boutiques</div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-2xs">
          <div className="text-[11px] font-bold uppercase tracking-wider text-blue-600 mb-1">
            À Traiter
          </div>
          <div className="text-2xl font-black text-blue-700 font-mono">
            {newCount}
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">Nouveaux messages</div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-2xs">
          <div className="text-[11px] font-bold uppercase tracking-wider text-amber-600 mb-1">
            En Cours
          </div>
          <div className="text-2xl font-black text-amber-700 font-mono">
            {inProgressCount}
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">En cours d'échange</div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-2xs">
          <div className="text-[11px] font-bold uppercase tracking-wider text-emerald-600 mb-1">
            Résolus
          </div>
          <div className="text-2xl font-black text-emerald-700 font-mono">
            {resolvedCount}
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">Demandes clôturées</div>
        </div>
      </div>

      {/* Master Detail */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Left Column (5 cols) */}
        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden flex flex-col h-[750px]">
          {/* Filters */}
          <div className="p-4 border-b border-slate-200/80 space-y-3 bg-slate-50/50">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Rechercher par client, objet, N° colis..."
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
                Tous
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('nouveau')}
                className={`flex-1 py-1.5 rounded-lg text-center transition-all ${
                  statusFilter === 'nouveau'
                    ? 'bg-white text-blue-700 font-bold shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Nouveaux ({newCount})
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('en_cours')}
                className={`flex-1 py-1.5 rounded-lg text-center transition-all ${
                  statusFilter === 'en_cours'
                    ? 'bg-white text-amber-700 font-bold shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                En cours
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('resolu')}
                className={`flex-1 py-1.5 rounded-lg text-center transition-all ${
                  statusFilter === 'resolu'
                    ? 'bg-white text-emerald-700 font-bold shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Résolus
              </button>
            </div>

            {/* Client & Category Dropdowns */}
            <div className="grid grid-cols-2 gap-2 text-xs">
              <select
                value={clientFilter}
                onChange={e => setClientFilter(e.target.value)}
                className="bg-white border border-slate-200 rounded-lg px-2.5 py-1 text-slate-700 font-medium focus:outline-none focus:ring-1 focus:ring-red-500 truncate"
              >
                <option value="all">Toutes les boutiques</option>
                {clientsList.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.companyName || c.name}
                  </option>
                ))}
              </select>

              <select
                value={categoryFilter}
                onChange={e => setCategoryFilter(e.target.value)}
                className="bg-white border border-slate-200 rounded-lg px-2.5 py-1 text-slate-700 font-medium focus:outline-none focus:ring-1 focus:ring-red-500 truncate"
              >
                <option value="all">Toutes catégories</option>
                {(Object.keys(CATEGORY_CONFIG) as ClientMessageCategory[]).map(catKey => (
                  <option key={catKey} value={catKey}>
                    {CATEGORY_CONFIG[catKey].label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Messages list */}
          <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
            {filteredMessages.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-500">
                Aucun message client trouvé pour ces filtres.
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
                        ? 'bg-slate-100 border-l-4 border-slate-900'
                        : 'hover:bg-slate-50 border-l-4 border-transparent'
                    }`}
                  >
                    {/* Client & Status */}
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold text-xs text-slate-900 flex items-center gap-1.5 truncate">
                        <Building className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                        <span className="truncate">{msg.clientCompany || msg.clientName}</span>
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
                    <div className="text-xs font-semibold text-slate-800 line-clamp-1">
                      {msg.subject}
                    </div>

                    {/* Preview */}
                    <div className="text-[11px] text-slate-600 line-clamp-2">
                      {hasReplies
                        ? `Dernière réponse : ${msg.replies[msg.replies.length - 1].message}`
                        : msg.message}
                    </div>

                    {/* Meta */}
                    <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1">
                      <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-sm border ${catCfg.color}`}>
                        <CatIcon className="w-2.5 h-2.5" />
                        <span>{catCfg.label}</span>
                      </span>

                      <div className="flex items-center gap-2">
                        {msg.packageTrackingNumber && (
                          <span className="font-mono font-bold text-slate-700 bg-slate-100 px-1 py-0.5 rounded-sm">
                            {msg.packageTrackingNumber}
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
              {/* Header */}
              <div className="p-5 border-b border-slate-200 bg-slate-50/60 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      {getStatusBadge(activeMessage.status)}
                      <span className="text-xs font-bold text-slate-900">
                        {activeMessage.clientCompany || activeMessage.clientName}
                      </span>
                      {activeMessage.clientPhone && (
                        <span className="text-xs text-slate-500 font-mono">
                          • {activeMessage.clientPhone}
                        </span>
                      )}
                    </div>

                    <h2 className="text-base font-bold text-slate-900">
                      {activeMessage.subject}
                    </h2>
                  </div>

                  {/* Status Dropdown */}
                  <div className="flex items-center gap-2 self-start shrink-0">
                    <select
                      value={activeMessage.status}
                      onChange={e => handleStatusChange(e.target.value as ClientMessageStatus)}
                      className="text-xs font-bold bg-white border border-slate-200 rounded-xl px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-red-500"
                    >
                      <option value="nouveau">Nouveau</option>
                      <option value="en_cours">En cours</option>
                      <option value="resolu">Résolu</option>
                      <option value="ferme">Fermé</option>
                    </select>

                    <button
                      type="button"
                      onClick={() => handleDelete(activeMessage.id)}
                      title="Supprimer ce fil"
                      className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Linked Package */}
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
                        <span>Inspecter le colis</span>
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Thread Timeline */}
              <div className="flex-1 overflow-y-auto p-5 space-y-4 bg-slate-100/40">
                {/* Client message */}
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
                          Client Expéditeur
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

                {/* Replies */}
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
                              {isSupport ? 'Équipe Exploitation' : 'Client'}
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
              </div>

              {/* Reply Box */}
              <div className="p-4 border-t border-slate-200 bg-white space-y-2">
                <form onSubmit={handleSendReply} className="space-y-2">
                  <textarea
                    rows={3}
                    value={replyText}
                    onChange={e => setReplyText(e.target.value)}
                    placeholder={`Répondre à ${activeMessage.clientName} au nom de l'équipe Support Fariousy...`}
                    className="w-full text-xs p-3 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-500 resize-none font-sans"
                  />

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleStatusChange('resolu')}
                        className="px-3 py-1.5 rounded-lg border border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 text-xs font-bold flex items-center gap-1 transition-colors"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>Marquer Résolu</span>
                      </button>
                    </div>

                    <button
                      type="submit"
                      disabled={isSendingReply || !replyText.trim()}
                      className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 shadow-xs transition-all disabled:opacity-50"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>{isSendingReply ? 'Envoi...' : 'Envoyer la réponse au client'}</span>
                    </button>
                  </div>
                </form>
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-3">
              <div className="w-16 h-16 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center">
                <MessageSquare className="w-8 h-8" />
              </div>
              <h3 className="text-sm font-bold text-slate-800">
                Sélectionnez un message client
              </h3>
              <p className="text-xs text-slate-500 max-w-sm">
                Choisissez une conversation dans la liste pour consulter les détails et répondre au client.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
