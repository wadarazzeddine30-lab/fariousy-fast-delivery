import React, { useState, useMemo } from 'react';
import { useDatabase } from '../../context/DatabaseContext';
import { useAuth } from '../../context/AuthContext';
import { Partner, PartnerApiToken, PackageItem } from '../../types';
import { OLIVRAISON_ALLOWED_STATES } from '../../services/partnerAdapters';
import {
  directSupabaseRequest,
  executePartnerParcelsStateDirect
} from '../../services/supabaseDirectGateway';
import {
  Key,
  Copy,
  Check,
  Trash2,
  Plus,
  Send,
  AlertTriangle,
  Code2,
  Terminal,
  Globe,
  Radio,
  CheckCircle2,
  XCircle,
  Eye,
  EyeOff,
  Sparkles,
  ArrowRight,
  ExternalLink,
  ShieldCheck,
  RefreshCw,
  Zap,
  Boxes
} from 'lucide-react';

interface PartnerApiAccessProps {
  partnerId?: string;
  onViewPackage?: (pkg: PackageItem) => void;
}

export const PartnerApiAccess: React.FC<PartnerApiAccessProps> = ({
  partnerId,
  onViewPackage
}) => {
  const { partners, updatePartner, packages, changePackageStatus } = useDatabase();
  const { currentUser, isImpersonating } = useAuth();

  // Find targeted partner (or currentUser if partner)
  const currentPartner = useMemo<Partner | undefined>(() => {
    if (currentUser?.role === 'partner' && currentUser?.id) {
      const matched =
        partners.find(p => p.id === currentUser.id) ||
        (partnerId ? partners.find(p => p.id === partnerId) : undefined);
      if (matched) return matched;
      return {
        id: currentUser.id,
        name: currentUser.companyName || currentUser.name || 'Partenaire',
        contactPerson: currentUser.name,
        phone: currentUser.phone || '',
        email: currentUser.email || '',
        city: currentUser.city || 'Casablanca',
        address: currentUser.address,
        active: true,
        deliveryFee: 30,
        returnFee: 10,
        apiTokens: []
      };
    }
    return (partnerId ? partners.find(p => p.id === partnerId) : undefined) || partners[0];
  }, [partners, currentUser, partnerId]);

  const [newTokenName, setNewTokenName] = useState('');
  const [copiedTokenId, setCopiedTokenId] = useState<string | null>(null);
  const [copiedCodeSnippet, setCopiedCodeSnippet] = useState(false);
  const [copiedEndpointUrl, setCopiedEndpointUrl] = useState(false);
  const [revealedTokenIds, setRevealedTokenIds] = useState<Record<string, boolean>>({});
  const [confirmDeleteTokenId, setConfirmDeleteTokenId] = useState<string | null>(null);

  // Live API Console Test State
  const [testParcelsInput, setTestParcelsInput] = useState('');
  const [testState, setTestState] = useState('Delivered');
  const [testReason, setTestReason] = useState('Livré avec succès au client');
  const [isTestingApi, setIsTestingApi] = useState(false);
  const [liveApiResponse, setLiveApiResponse] = useState<any | null>(null);
  const [liveApiStatusCode, setLiveApiStatusCode] = useState<number | null>(null);

  // List of active tokens for this partner
  const tokens: PartnerApiToken[] = currentPartner?.apiTokens || [];

  const syncTokensToBackend = (partnerIdTarget: string, updatedTokens: PartnerApiToken[]) => {
    updatePartner(partnerIdTarget, {
      apiTokens: updatedTokens
    });
    if (currentUser?.role === 'admin' || currentUser?.role === 'super_admin') {
      directSupabaseRequest(`partners/${encodeURIComponent(partnerIdTarget)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiTokens: updatedTokens })
      }).catch(() => {});
    }
  };

  // Generate new api-... Bearer token
  const handleGenerateToken = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentPartner) return;

    const tokenLabel = newTokenName.trim() || `API Token ${tokens.length + 1}`;
    let randomPart = '';
    if (typeof window !== 'undefined' && window.crypto?.getRandomValues) {
      const bytes = new Uint8Array(32);
      window.crypto.getRandomValues(bytes);
      const bin = Array.from(bytes, b => String.fromCharCode(b)).join('');
      randomPart = btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    } else {
      randomPart = `${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}_${Math.random().toString(36).slice(2)}`;
    }
    const apiToken = `api-${randomPart}`;

    const newTokenItem: PartnerApiToken = {
      id: `tok-${Date.now()}`,
      name: tokenLabel,
      token: apiToken,
      createdAt: new Date().toISOString().split('T')[0],
      lastUsedAt: 'Jamais utilisé'
    };

    const updatedTokens = [newTokenItem, ...tokens];
    syncTokensToBackend(currentPartner.id, updatedTokens);
    setNewTokenName('');
  };

  // Revoke token (inline confirmation, no window.confirm)
  const handleConfirmDeleteToken = (tokenId: string) => {
    if (!currentPartner) return;
    const updatedTokens = tokens.filter(t => t.id !== tokenId);
    syncTokensToBackend(currentPartner.id, updatedTokens);
    setConfirmDeleteTokenId(null);
  };

  // Copy token to clipboard
  const handleCopyToken = (tokenId: string, tokenString: string) => {
    navigator.clipboard.writeText(tokenString);
    setCopiedTokenId(tokenId);
    setTimeout(() => setCopiedTokenId(null), 2500);
  };

  // Copy cURL snippet
  const handleCopyCurl = (curlText: string) => {
    navigator.clipboard.writeText(curlText);
    setCopiedCodeSnippet(true);
    setTimeout(() => setCopiedCodeSnippet(false), 2500);
  };

  // Copy endpoint URL
  const handleCopyEndpointUrl = (urlText: string) => {
    navigator.clipboard.writeText(urlText);
    setCopiedEndpointUrl(true);
    setTimeout(() => setCopiedEndpointUrl(false), 2500);
  };

  // Toggle reveal
  const toggleReveal = (tokenId: string) => {
    setRevealedTokenIds(prev => ({
      ...prev,
      [tokenId]: !prev[tokenId]
    }));
  };

  const apiEndpointUrl = useMemo(() => {
    if (typeof window !== 'undefined' && window.location?.origin) {
      return `${window.location.origin}/api/partner/parcels/state`;
    }
    return '/api/partner/parcels/state';
  }, []);

  // Active packages assigned to this partner
  const partnerPackages = useMemo(() => {
    if (!currentPartner) return [];
    return packages.filter(
      p => p.partnerId === currentPartner.id || p.destinationAgency === currentPartner.name
    );
  }, [packages, currentPartner]);

  // Execute Live Test against real backend API endpoint
  const handleExecuteLiveTest = async () => {
    if (!currentPartner) return;
    setIsTestingApi(true);
    setLiveApiResponse(null);
    setLiveApiStatusCode(null);

    const parcelsList = testParcelsInput
      .split(/[\s,;\n]+/)
      .map(s => s.trim())
      .filter(Boolean);

    const effectiveParcels =
      parcelsList.length > 0
        ? parcelsList
        : partnerPackages.slice(0, 3).map(p => p.trackingNumber);

    const activeTokenObj = tokens[0];
    const activeToken = activeTokenObj?.token || currentPartner.webhookToken || '';

    try {
      const result = await executePartnerParcelsStateDirect({
        refs: effectiveParcels,
        state: testState,
        reason: testReason || undefined
      });

      setLiveApiStatusCode(result.status);
      const data = result.body;
      setLiveApiResponse(data);

      const updatedItems: { ref?: string }[] = Array.isArray((data as any)?.data?.updated)
        ? (data as any).data.updated
        : [];
      const matchedInternal =
        OLIVRAISON_ALLOWED_STATES.find(s => s.label === testState)?.internal || 'livre';

      for (const item of updatedItems) {
        const refVal = String(item?.ref || '').trim();
        if (!refVal) continue;
        const found = packages.find(
          p => p.trackingNumber === refVal || p.partnerTrackingNumber === refVal || p.id === refVal
        );
        if (found) {
          changePackageStatus(found.id, matchedInternal as any, `API Update: ${testState}`);
        }
      }

      if (result.status >= 200 && result.status < 300 && activeTokenObj) {
        const nowFormatted = new Date().toISOString().replace('T', ' ').slice(0, 16);
        const touchedTokens = tokens.map(t =>
          t.id === activeTokenObj.id ? { ...t, lastUsedAt: nowFormatted } : t
        );
        updatePartner(currentPartner.id, { apiTokens: touchedTokens });
      }
    } catch (err: any) {
      setLiveApiStatusCode(500);
      setLiveApiResponse({
        isSuccess: false,
        success: false,
        error: err.message || 'Erreur lors de l\'appel API'
      });
    } finally {
      setIsTestingApi(false);
    }
  };

  const sampleToken = tokens[0]?.token || 'api-YOUR_TOKEN';
  const curlCodeExample = `curl -X POST "${apiEndpointUrl}" \\
  -H "Authorization: Bearer ${sampleToken}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "refs": ["REF-001", "REF-002"],
    "state": "Delivered"
  }'`;

  if (!currentPartner) {
    return (
      <div className="p-8 text-center text-slate-500">
        <AlertTriangle className="w-8 h-8 mx-auto mb-2 text-amber-500" />
        <p>Partenaire introuvable.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-16 animate-fadeIn text-slate-900 dark:text-white">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-black flex items-center gap-2">
              <span>Accès API</span>
              <span className="text-xs bg-red-600/10 text-red-600 dark:text-red-400 font-bold px-2 py-0.5 rounded-md border border-red-200 dark:border-red-900/50">
                Partenaire : {currentPartner.name}
              </span>
            </h1>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Gérez vos jetons d'accès API REST et intégrez vos systèmes logistiques avec FARIOUSY DELIVERY.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-xl bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
            <Radio className="w-3.5 h-3.5 text-emerald-600 animate-pulse" />
            <span>API REST Active (v1)</span>
          </span>
        </div>
      </div>

      {/* Security Warning Notice */}
      <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 text-xs text-amber-900 dark:text-amber-200 flex items-start gap-3">
        <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
        <div>
          <p className="font-bold">Vous êtes responsable de l'utilisation de vos jetons.</p>
          <p className="text-amber-800/90 dark:text-amber-300/80 mt-0.5 leading-relaxed">
            Un jeton vous donne accès à l'API pour modifier vos colis. Si vous le partagez dans du code source ou un dépôt public, un attaquant pourrait l'utiliser pour altérer vos livraisons. Stockez-le de manière sécurisée dans vos variables d'environnement.
          </p>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 1. JETONS API (Card matching the video) */}
      {/* ========================================================================= */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs space-y-5">
        <div>
          <h2 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
            <Key className="w-4 h-4 text-red-600" />
            <span>JETONS API</span>
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Générez des jetons d'authentification Bearer pour connecter votre ERP, site e-commerce ou application mobile.
          </p>
        </div>

        {/* Generate Form */}
        <form onSubmit={handleGenerateToken} className="flex flex-col sm:flex-row items-center gap-3">
          <input
            type="text"
            placeholder="Créer un nouveau jeton (ex: Mon API d'intégration)"
            value={newTokenName}
            onChange={e => setNewTokenName(e.target.value)}
            className="w-full flex-1 px-4 py-2.5 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-red-500 text-slate-900 dark:text-white"
          />
          <button
            type="submit"
            className="w-full sm:w-auto px-6 py-2.5 bg-red-600 hover:bg-red-700 text-white font-bold text-xs rounded-xl shadow-xs transition-transform active:scale-95 flex items-center justify-center gap-2 shrink-0 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Générer</span>
          </button>
        </form>

        {/* Active Tokens List */}
        <div className="space-y-3 pt-3 border-t border-slate-100 dark:border-slate-800">
          <h3 className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
            JETONS ACTIFS ({tokens.length})
          </h3>

          {tokens.length === 0 ? (
            <div className="p-6 text-center text-xs text-slate-400 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-dashed border-slate-200 dark:border-slate-700">
              Aucun jeton généré pour le moment. Cliquez sur "Générer" ci-dessus pour créer votre premier jeton API.
            </div>
          ) : (
            tokens.map(tokenItem => {
              const isRevealed = revealedTokenIds[tokenItem.id] || false;
              const isCopied = copiedTokenId === tokenItem.id;

              return (
                <div
                  key={tokenItem.id}
                  className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                >
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-900 dark:text-white text-sm">
                        {tokenItem.name}
                      </span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
                        Actif
                      </span>
                    </div>

                    {/* Token Value Display */}
                    <div className="flex items-center gap-2 font-mono text-[11px] text-slate-600 dark:text-slate-300">
                      <span className="bg-white dark:bg-slate-900 px-2.5 py-1 rounded-md border border-slate-200 dark:border-slate-700 truncate max-w-md select-all">
                        {isRevealed
                          ? tokenItem.token
                          : `${tokenItem.token.slice(0, 20)}••••••••••••••••••••••••••••••••••••••••`}
                      </span>
                      <button
                        type="button"
                        onClick={() => toggleReveal(tokenItem.id)}
                        className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                        title={isRevealed ? 'Masquer' : 'Afficher le jeton complet'}
                      >
                        {isRevealed ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                    </div>

                    <div className="text-[11px] text-slate-400 flex items-center gap-2">
                      <span>Créé le: {tokenItem.createdAt}</span>
                      <span>·</span>
                      <span>Dernière utilisation: {tokenItem.lastUsedAt || 'Jamais utilisé'}</span>
                    </div>
                  </div>

                  {/* Actions: Copy & Inline Delete Confirmation */}
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleCopyToken(tokenItem.id, tokenItem.token)}
                      className={`px-3 py-1.5 rounded-lg font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer ${
                        isCopied
                          ? 'bg-emerald-600 text-white shadow-xs'
                          : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100'
                      }`}
                    >
                      {isCopied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{isCopied ? 'Copié !' : 'Copier'}</span>
                    </button>

                    {confirmDeleteTokenId === tokenItem.id ? (
                      <div className="flex items-center gap-1.5 bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 px-2 py-1 rounded-lg">
                        <button
                          type="button"
                          onClick={() => handleConfirmDeleteToken(tokenItem.id)}
                          className="text-[11px] font-bold text-rose-700 dark:text-rose-300 hover:underline cursor-pointer"
                        >
                          Confirmer
                        </button>
                        <span className="text-slate-300">|</span>
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteTokenId(null)}
                          className="text-[11px] font-medium text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer"
                        >
                          Annuler
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteTokenId(tokenItem.id)}
                        className="p-1.5 text-rose-500 hover:text-rose-700 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition-colors cursor-pointer"
                        title="Révoquer ce jeton"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 2. RÉFÉRENCE API (Card matching the video) */}
      {/* ========================================================================= */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs space-y-6">
        <div>
          <h2 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
            <Code2 className="w-4 h-4 text-red-600" />
            <span>RÉFÉRENCE API</span>
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Envoyez une requête pour mettre à jour un ou plusieurs colis en même temps.
          </p>
        </div>

        {/* Endpoint & Headers banner */}
        <div className="p-4 rounded-xl bg-slate-900 text-slate-100 font-mono text-xs space-y-2 border border-slate-800">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <span className="px-2 py-0.5 rounded font-black text-[11px] bg-emerald-500 text-slate-950 shrink-0">
                POST
              </span>
              <span className="text-amber-400 font-bold select-all truncate">
                {apiEndpointUrl}
              </span>
            </div>
            <button
              type="button"
              onClick={() => handleCopyEndpointUrl(apiEndpointUrl)}
              className="text-slate-400 hover:text-white text-[11px] flex items-center gap-1 shrink-0 cursor-pointer"
            >
              {copiedEndpointUrl ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
              <span>{copiedEndpointUrl ? 'Copié !' : 'Copier URL'}</span>
            </button>
          </div>

          <div className="pt-2 border-t border-slate-800 text-[11px] text-slate-400 space-y-1">
            <p><span className="text-slate-500 font-bold">Authorization:</span> Bearer &lt;token&gt;</p>
            <p><span className="text-slate-500 font-bold">Content-Type:</span> application/json</p>
          </div>
        </div>

        {/* Request & Response Split Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Corps de la requête */}
          <div className="space-y-2">
            <span className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
              CORPS DE LA REQUÊTE (JSON) :
            </span>
            <div className="p-3.5 rounded-xl bg-slate-950 text-slate-200 font-mono text-xs border border-slate-800 overflow-x-auto">
              <pre>{`{
  "refs": [
    "REF-001",
    "REF-002",
    "REF-003"
  ],
  "state": "Delivered",
  "reason": "Optionnel note"
}`}</pre>
            </div>
          </div>

          {/* Exemple de réponse */}
          <div className="space-y-2">
            <span className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
              RÉPONSE (JSON HTTP 200) :
            </span>
            <div className="p-3.5 rounded-xl bg-slate-950 text-emerald-400 font-mono text-xs border border-slate-800 overflow-x-auto">
              <pre>{`{
  "isSuccess": true,
  "message": "2 parcel(s) updated.",
  "data": {
    "updated": [
      { "ref": "REF-001", "from": "In Transit", "to": "Delivered" },
      { "ref": "REF-002", "from": "In Transit", "to": "Delivered" }
    ],
    "failed": [
      { "ref": "REF-003", "message": "Parcel not found." }
    ],
    "totals": {
      "updated": 2,
      "failed": 1
    }
  }
}`}</pre>
            </div>
          </div>
        </div>

        {/* États Autorisés Badges matching Olivraison */}
        <div className="space-y-2">
          <span className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
            ÉTATS AUTORISÉS ({OLIVRAISON_ALLOWED_STATES.length} VALEURS DU PARAMÈTRE "state") :
          </span>
          <div className="flex flex-wrap gap-2">
            {OLIVRAISON_ALLOWED_STATES.map(s => (
              <button
                key={s.label}
                type="button"
                onClick={() => setTestState(s.label)}
                className={`px-2.5 py-1 rounded-lg text-xs font-mono font-bold border flex items-center gap-1.5 transition-colors cursor-pointer ${
                  testState === s.label
                    ? 'bg-red-50 dark:bg-red-950/50 text-red-700 dark:text-red-300 border-red-300 dark:border-red-700'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:border-red-300'
                }`}
                title={`${s.desc} -> ${s.internal}`}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                <span>{s.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* cURL Example */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
              EXEMPLE CURL :
            </span>
            <button
              onClick={() => handleCopyCurl(curlCodeExample)}
              className="text-xs text-red-600 dark:text-red-400 hover:underline flex items-center gap-1 font-bold"
            >
              {copiedCodeSnippet ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedCodeSnippet ? 'Copié !' : 'Copier la commande cURL'}</span>
            </button>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-950 text-slate-300 font-mono text-xs border border-slate-800 overflow-x-auto">
            <pre>{curlCodeExample}</pre>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* INTERACTIVE LIVE API CONSOLE (Tester directement l'API) */}
        {/* ========================================================================= */}
        <div className="p-4 rounded-xl bg-gradient-to-br from-red-50/50 to-slate-50 dark:from-red-950/20 dark:to-slate-800/40 border border-red-100 dark:border-red-900/40 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-red-600" />
              <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                Console API Partenaire en Direct ({currentPartner?.name || 'API REST'})
              </h3>
            </div>
            <span className="text-[11px] text-slate-400 font-mono">
              Appel réel vers /api/partner/parcels/state
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                Numéros de suivi (séparés par virgule ou espace)
              </label>
              <input
                type="text"
                placeholder={partnerPackages[0]?.trackingNumber || 'TRK-1001, TRK-1002'}
                value={testParcelsInput}
                onChange={e => setTestParcelsInput(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white font-mono"
              />
              {partnerPackages.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-1.5">
                  <span className="text-[10px] text-slate-400">Exemples:</span>
                  {partnerPackages.slice(0, 3).map(pkg => (
                    <button
                      key={pkg.id}
                      type="button"
                      onClick={() => setTestParcelsInput(pkg.trackingNumber)}
                      className="text-[10px] font-mono text-red-600 dark:text-red-400 underline hover:opacity-80"
                    >
                      {pkg.trackingNumber}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                État cible (state)
              </label>
              <select
                value={testState}
                onChange={e => setTestState(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white font-bold"
              >
                {OLIVRAISON_ALLOWED_STATES.map(s => (
                  <option key={s.label} value={s.label}>
                    {s.label} ({s.desc})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                Motif optionnel (reason)
              </label>
              <input
                type="text"
                placeholder="Ex: Livré au client en main propre"
                value={testReason}
                onChange={e => setTestReason(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
              />
            </div>
          </div>

          <div className="flex items-center justify-between pt-2">
            <button
              type="button"
              onClick={handleExecuteLiveTest}
              disabled={isTestingApi}
              className="px-5 py-2.5 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center gap-2 cursor-pointer"
            >
              {isTestingApi ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Envoi de la requête en cours...</span>
                </>
              ) : (
                <>
                  <Send className="w-3.5 h-3.5" />
                  <span>Envoyer la requête API (Tester en direct)</span>
                </>
              )}
            </button>
          </div>

          {liveApiResponse && (
            <div className="mt-3 p-3 rounded-xl bg-slate-950 font-mono text-xs border border-slate-800 text-slate-200 space-y-1">
              <div className="flex items-center justify-between text-slate-400 text-[11px] pb-1 border-b border-slate-800">
                <span>
                  RÉSULTAT DU TEST HTTP {liveApiStatusCode || (liveApiResponse.isSuccess ? 200 : 400)}
                </span>
                <span>
                  {liveApiStatusCode && liveApiStatusCode >= 200 && liveApiStatusCode < 300
                    ? 'Synchronisé en direct avec le serveur'
                    : 'Requête rejetée ou invalide'}
                </span>
              </div>
              <pre
                className={`overflow-x-auto pt-1 ${
                  liveApiStatusCode && liveApiStatusCode >= 400 ? 'text-rose-400' : 'text-emerald-400'
                }`}
              >
                {JSON.stringify(liveApiResponse, null, 2)}
              </pre>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
