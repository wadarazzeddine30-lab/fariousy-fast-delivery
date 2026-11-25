import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useDatabase } from '../../context/DatabaseContext';
import { useLanguage } from '../../i18n/LanguageContext';
import {
  Store,
  User,
  Phone,
  Mail,
  MapPin,
  Lock,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertCircle,
  Clock,
  XCircle,
  X,
  ArrowRight,
  ShieldAlert,
  ShieldCheck,
  Sparkles
} from 'lucide-react';
import { KycPhotoUpload } from '../common/KycPhotoUpload';
import { getRememberMePreference } from '../../services/supabase';
import {
  FacebookIcon,
  InstagramIcon,
  DEFAULT_FACEBOOK_URL,
  DEFAULT_INSTAGRAM_URL
} from '../common/SocialIcons';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultTab?: 'login' | 'register';
  onOpenDriverRegister?: () => void;
}

const ACTIVITY_TYPES = [
  'Mode & Prêt-à-porter',
  'Cosmétiques, Beauté & Soins',
  'High-Tech, Téléphonie & Informatique',
  'Chaussures & Maroquinerie',
  'Maison, Décoration & Cuisine',
  'Parfumerie & Fragrances',
  'Bijoux & Montres',
  'Santé, Parapharmacie & Bio',
  'Puériculture & Jouets',
  'Autre e-commerce'
];

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  defaultTab = 'login',
  onOpenDriverRegister
}) => {
  const { login, registerBoutiqueUser, pendingReviewUser, clearPendingReview } = useAuth();
  const { cities, companySettings } = useDatabase();
  const { isRtl, t } = useLanguage();
  const facebookUrl = companySettings?.facebookUrl?.trim() || DEFAULT_FACEBOOK_URL;
  const instagramUrl = companySettings?.instagramUrl?.trim() || DEFAULT_INSTAGRAM_URL;

  const [tab, setTab] = useState<'login' | 'register'>(defaultTab);

  // Login form state
  const [loginEmail, setLoginEmail] = useState(() => {
    try {
      return typeof window !== 'undefined' ? (localStorage.getItem('fariousy_remembered_identifier') || '') : '';
    } catch {
      return '';
    }
  });
  const [loginPassword, setLoginPassword] = useState('');
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState<boolean>(() => getRememberMePreference());
  const [loginError, setLoginError] = useState<string | null>(null);

  // Register form state (All requested fields)
  const [shopName, setShopName] = useState('');
  const [managerName, setManagerName] = useState('');
  const [phone, setPhone] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [email, setEmail] = useState('');
  const [city, setCity] = useState(cities[0]?.name || 'Casablanca');
  const [pickupAddress, setPickupAddress] = useState('');
  const [activityType, setActivityType] = useState(ACTIVITY_TYPES[0]);
  const [cinNumber, setCinNumber] = useState('');
  const [cinPhotoUrl, setCinPhotoUrl] = useState('');
  const [cinBackPhotoUrl, setCinBackPhotoUrl] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showRegisterPassword, setShowRegisterPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [registerError, setRegisterError] = useState<string | null>(null);
  const [registeredSuccessUser, setRegisteredSuccessUser] = useState<any | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setTab(defaultTab);
      setLoginError(null);
      setRegisterError(null);
    }
  }, [isOpen, defaultTab]);

  if (!isOpen) return null;

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);

    const result = await login(loginEmail, loginPassword, rememberMe);
    if (result.success) {
      onClose();
    } else {
      setLoginError(result.error || 'Identifiants incorrects.');
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setRegisterError(null);

    // Validation
    if (!shopName.trim() || !managerName.trim() || !phone.trim() || !email.trim() || !city.trim() || !pickupAddress.trim()) {
      setRegisterError('Veuillez remplir tous les champs obligatoires.');
      return;
    }

    if (!cinPhotoUrl) {
      setRegisterError('يرجى إرفاق صورة البطاقة الوطنية (CIN) — Veuillez joindre la photo de votre Carte Nationale.');
      return;
    }

    if (password && confirmPassword && password !== confirmPassword) {
      setRegisterError('Les mots de passe ne correspondent pas.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await registerBoutiqueUser({
        shopName: shopName.trim(),
        managerName: managerName.trim(),
        phone: phone.trim(),
        whatsapp: whatsapp.trim() || phone.trim(),
        email: email.trim(),
        city: city.trim(),
        pickupAddress: pickupAddress.trim(),
        activityType,
        password,
        cinNumber: cinNumber.trim() || undefined,
        cinPhotoUrl,
        cinBackPhotoUrl: cinBackPhotoUrl || undefined
      });

      if (!res.success) {
        setRegisterError(res.error || "Erreur lors de la création du compte.");
      } else {
        setRegisteredSuccessUser(res.user);
      }
    } catch (err: any) {
      setRegisterError(err.message || "Erreur de connexion.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs no-print">
      <div className="relative w-full max-w-xl bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50">
          <div className="flex items-center gap-3">
            <img
              src="/fariousy-logo.jpeg"
              alt="FARIOUSY DELIVERY"
              className="w-10 h-10 object-contain"
            />
            <div>
              <h3 className="text-base font-extrabold text-slate-900 leading-tight">
                FARIOUSY DELIVERY
              </h3>
              <p className="text-[11px] font-bold text-red-600 tracking-wider">
                PORTAIL BOUTIQUES & MARCHANDS
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              clearPendingReview();
              setRegisteredSuccessUser(null);
              onClose();
            }}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content depending on state */}
        {registeredSuccessUser || pendingReviewUser ? (
          /* REGISTRATION SUBMITTED / STATUS SCREEN (Section 2: EN ATTENTE, REFUSÉ, SUSPENDU) */
          <div className="p-8 text-center space-y-5 overflow-y-auto">
            {(() => {
              const u = registeredSuccessUser || pendingReviewUser;
              const isEnAttente = u.status === 'en_attente' || u.status === 'pending';
              const isRefuse = u.status === 'refuse';
              const isSuspendu = u.status === 'suspendu';

              if (isEnAttente) {
                return (
                  <>
                    <div className="w-16 h-16 mx-auto bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center shadow-xs">
                      <Clock className="w-8 h-8 animate-pulse" />
                    </div>
                    <div>
                      <span className="inline-block px-3 py-1 bg-amber-100 text-amber-900 rounded-full text-xs font-black uppercase tracking-wider mb-2">
                        Statut : En cours de validation
                      </span>
                      <h4 className="text-lg font-black text-slate-900">
                        Demande d'Inscription Enregistrée
                      </h4>
                      <p className="text-xs text-slate-600 max-w-md mx-auto mt-2 leading-relaxed">
                        Votre demande d'inscription pour la boutique{' '}
                        <strong className="text-slate-900">{u.companyName || u.name}</strong> a bien été transmise. Elle est actuellement{' '}
                        <strong>en attente d'approbation</strong> par l'équipe administrative de{' '}
                        <strong>FARIOUSY DELIVERY</strong>.
                      </p>
                    </div>

                    <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl text-xs text-left max-w-md mx-auto space-y-1.5">
                      <div className="flex justify-between">
                        <span className="text-slate-500">Boutique :</span>
                        <strong className="text-slate-900">{u.companyName}</strong>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Responsable :</span>
                        <span className="text-slate-800">{u.name}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Ville de collecte :</span>
                        <span className="text-slate-800">{u.city}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Téléphone :</span>
                        <span className="font-mono text-slate-800">{u.phone}</span>
                      </div>
                    </div>

                    <p className="text-[11px] text-slate-400">
                      Un administrateur va valider votre compte et configurer vos tarifs de livraison.
                    </p>

                    <div className="pt-2 flex justify-center gap-3">
                      <button
                        type="button"
                        onClick={() => {
                          clearPendingReview();
                          setRegisteredSuccessUser(null);
                          onClose();
                        }}
                        className="px-5 py-2.5 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl"
                      >
                        Compris, fermer
                      </button>
                    </div>
                  </>
                );
              }

              if (isRefuse) {
                return (
                  <>
                    <div className="w-16 h-16 mx-auto bg-rose-50 text-rose-600 rounded-2xl flex items-center justify-center">
                      <XCircle className="w-8 h-8" />
                    </div>
                    <div>
                      <span className="inline-block px-3 py-1 bg-rose-100 text-rose-800 rounded-full text-xs font-black uppercase tracking-wider mb-2">
                        Statut : Demande Refusée
                      </span>
                      <h4 className="text-lg font-black text-slate-900">
                        Inscription Non Approuvée
                      </h4>
                      <p className="text-xs text-slate-600 max-w-md mx-auto mt-2 leading-relaxed">
                        L'administration n'a pas pu valider votre demande pour{' '}
                        <strong>{u.companyName || u.name}</strong>.
                      </p>
                      {u.statusReason && (
                        <div className="mt-3 p-3 bg-rose-50 text-rose-900 border border-rose-200 rounded-xl text-xs font-medium max-w-md mx-auto">
                          Motif déclaré : {u.statusReason}
                        </div>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        clearPendingReview();
                        setRegisteredSuccessUser(null);
                      }}
                      className="px-5 py-2.5 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl"
                    >
                      Retour
                    </button>
                  </>
                );
              }

              if (isSuspendu) {
                return (
                  <>
                    <div className="w-16 h-16 mx-auto bg-slate-100 text-slate-700 rounded-2xl flex items-center justify-center">
                      <ShieldAlert className="w-8 h-8 text-rose-600" />
                    </div>
                    <div>
                      <span className="inline-block px-3 py-1 bg-rose-100 text-rose-800 rounded-full text-xs font-black uppercase tracking-wider mb-2">
                        Statut : Compte Suspendu
                      </span>
                      <h4 className="text-lg font-black text-slate-900">
                        Accès Temporairement Restreint
                      </h4>
                      <p className="text-xs text-slate-600 max-w-md mx-auto mt-2 leading-relaxed">
                        Le compte boutique <strong>{u.companyName || u.name}</strong> est actuellement suspendu.
                      </p>
                      {u.statusReason && (
                        <div className="mt-3 p-3 bg-slate-100 text-slate-800 border border-slate-200 rounded-xl text-xs font-medium max-w-md mx-auto">
                          Remarque : {u.statusReason}
                        </div>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        clearPendingReview();
                        setRegisteredSuccessUser(null);
                      }}
                      className="px-5 py-2.5 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl"
                    >
                      Retour
                    </button>
                  </>
                );
              }

              if (u.status === 'approuve' || u.status === 'active') {
                return (
                  <>
                    <div className="w-16 h-16 mx-auto bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center">
                      <CheckCircle2 className="w-8 h-8 text-emerald-600" />
                    </div>
                    <div>
                      <span className="inline-block px-3 py-1 bg-emerald-100 text-emerald-800 rounded-full text-xs font-black uppercase tracking-wider mb-2">
                        Compte Activé avec Succès
                      </span>
                      <h4 className="text-lg font-black text-slate-900">
                        Bienvenue sur FARIOUSY DELIVERY
                      </h4>
                      <p className="text-xs text-slate-600 max-w-md mx-auto mt-2 leading-relaxed">
                        Votre compte boutique <strong>{u.companyName || u.name}</strong> est opérationnel. Vous pouvez maintenant ajouter vos colis et suivre vos livraisons.
                      </p>
                    </div>

                    <div className="pt-2 flex justify-center">
                      <button
                        type="button"
                        onClick={() => {
                          clearPendingReview();
                          setRegisteredSuccessUser(null);
                          onClose();
                        }}
                        className="px-6 py-2.5 text-xs font-black text-white bg-red-600 hover:bg-red-700 rounded-xl shadow-md transition-all cursor-pointer"
                      >
                        Accéder à mon espace client →
                      </button>
                    </div>
                  </>
                );
              }

              return null;
            })()}
          </div>
        ) : (
          /* REGULAR AUTH VIEW WITH WORKING TABS (Connexion / S'inscrire) */
          <>
            {/* Tabs */}
            <div className="px-6 pt-3 border-b border-slate-200 bg-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setTab('login');
                    setLoginError(null);
                  }}
                  className={`pb-2.5 px-3 text-xs font-bold border-b-2 transition-all ${
                    tab === 'login'
                      ? 'border-red-600 text-red-600'
                      : 'border-transparent text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Se Connecter
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setTab('register');
                    setRegisterError(null);
                  }}
                  className={`pb-2.5 px-3 text-xs font-bold border-b-2 transition-all ${
                    tab === 'register'
                      ? 'border-red-600 text-red-600'
                      : 'border-transparent text-slate-500 hover:text-slate-800'
                  }`}
                >
                  S'inscrire (Nouvelle Boutique)
                </button>
              </div>

            </div>

            {/* TAB: LOGIN */}
            {tab === 'login' && (
              <form onSubmit={handleLoginSubmit} className="p-6 overflow-y-auto space-y-4">
                {loginError && (
                  <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                    <span>{loginError}</span>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Numéro de téléphone ou Adresse e-mail
                  </label>
                  <div className="relative">
                    <User className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      required
                      value={loginEmail}
                      onChange={e => setLoginEmail(e.target.value)}
                      placeholder="06 61 00 00 00 ou contact@boutique.ma"
                      className="w-full pl-9 pr-3 py-2.5 text-xs bg-slate-50 border border-slate-300 rounded-xl text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-500"
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-bold text-slate-700">
                      Mot de passe (الرمز السري)
                    </label>
                  </div>
                  <div className="relative">
                    <Lock className={`w-4 h-4 absolute ${isRtl ? 'right-3' : 'left-3'} top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none`} />
                    <input
                      type={showLoginPassword ? 'text' : 'password'}
                      required
                      value={loginPassword}
                      onChange={e => setLoginPassword(e.target.value)}
                      placeholder="••••••••"
                      className={`w-full ${isRtl ? 'pr-9 pl-10' : 'pl-9 pr-10'} py-2.5 text-xs bg-slate-50 border border-slate-300 rounded-xl text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-500`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowLoginPassword(!showLoginPassword)}
                      className={`absolute ${isRtl ? 'left-2.5' : 'right-2.5'} top-1/2 -translate-y-1/2 p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 rounded-lg transition-colors cursor-pointer`}
                      title={showLoginPassword ? 'إخفاء الرمز السري' : 'إظهار الرمز السري'}
                      aria-label="Afficher ou masquer le mot de passe"
                    >
                      {showLoginPassword ? (
                        <EyeOff className="w-4 h-4 text-red-600" />
                      ) : (
                        <Eye className="w-4 h-4 text-slate-500 hover:text-slate-800" />
                      )}
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-0.5">
                  <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-700 font-semibold select-none">
                    <input
                      type="checkbox"
                      checked={rememberMe}
                      onChange={e => setRememberMe(e.target.checked)}
                      className="w-4 h-4 rounded-sm border-slate-300 text-red-600 focus:ring-red-500 accent-red-600 cursor-pointer"
                    />
                    <span>{t('login.rememberMe') || 'Rester connecté'}</span>
                  </label>
                </div>

                <div className="pt-1">
                  <button
                    type="submit"
                    className="w-full py-3 text-xs font-bold text-white bg-red-600 hover:bg-red-700 rounded-xl shadow-xs transition-colors flex items-center justify-center gap-2"
                  >
                    <span>Se connecter à mon espace</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>

                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-[11px] text-slate-600 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-sm">🚚</span>
                    <span>
                      <strong>Espace Livreur :</strong>{' '}
                      {onOpenDriverRegister
                        ? 'تسجيل حساب موزع جديد أو الدخول بحسابك.'
                        : "Connectez-vous avec votre téléphone et mot de passe."}
                    </span>
                  </div>
                  {onOpenDriverRegister && (
                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        onOpenDriverRegister();
                      }}
                      className="shrink-0 px-2.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-lg text-[11px] transition cursor-pointer"
                    >
                      التسجيل كليفرور
                    </button>
                  )}
                </div>

                <div className="text-center pt-2">
                  <span className="text-xs text-slate-500">Vous n'avez pas encore de compte ? </span>
                  <button
                    type="button"
                    onClick={() => setTab('register')}
                    className="text-xs font-bold text-red-600 hover:underline"
                  >
                    S'inscrire comme boutique
                  </button>
                </div>
              </form>
            )}

            {/* TAB: REGISTER (SECTION 1: PAGE D'INSCRIPTION) */}
            {tab === 'register' && (
              <form onSubmit={handleRegisterSubmit} className="p-6 overflow-y-auto space-y-3.5">
                {registerError && (
                  <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                    <span>{registerError}</span>
                  </div>
                )}

                {/* 1. Nom de la boutique & Responsable */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      Nom de la boutique *
                    </label>
                    <div className="relative">
                      <Store className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        type="text"
                        required
                        value={shopName}
                        onChange={e => setShopName(e.target.value)}
                        placeholder="Ex: Mode Chic Casablanca"
                        className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      Nom et prénom du responsable *
                    </label>
                    <div className="relative">
                      <User className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        type="text"
                        required
                        value={managerName}
                        onChange={e => setManagerName(e.target.value)}
                        placeholder="Ex: Karim Benjelloun"
                        className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-500"
                      />
                    </div>
                  </div>
                </div>

                {/* 2. Téléphone & WhatsApp */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      Téléphone d'appel *
                    </label>
                    <div className="relative">
                      <Phone className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        type="tel"
                        required
                        value={phone}
                        onChange={e => setPhone(e.target.value)}
                        placeholder="06 61 00 00 00"
                        className="w-full pl-9 pr-3 py-2 text-xs font-mono bg-slate-50 border border-slate-300 rounded-xl text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      Numéro WhatsApp (optionnel)
                    </label>
                    <input
                      type="tel"
                      value={whatsapp}
                      onChange={e => setWhatsapp(e.target.value)}
                      placeholder="06 61 00 00 00"
                      className="w-full px-3 py-2 text-xs font-mono bg-slate-50 border border-slate-300 rounded-xl text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-500"
                    />
                  </div>
                </div>

                {/* 3. Adresse e-mail & Ville */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      Adresse e-mail *
                    </label>
                    <div className="relative">
                      <Mail className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        type="email"
                        required
                        value={email}
                        onChange={e => setEmail(e.target.value)}
                        placeholder="contact@boutique.ma"
                        className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      Ville principale *
                    </label>
                    <div className="relative">
                      <MapPin className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                      <select
                        value={city}
                        onChange={e => setCity(e.target.value)}
                        className="w-full pl-9 pr-3 py-2 text-xs font-semibold bg-slate-50 border border-slate-300 rounded-xl text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-500"
                      >
                        {cities.map(c => (
                          <option key={c.id} value={c.name}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                {/* 4. Adresse complète de ramassage */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Adresse complète de ramassage *
                  </label>
                  <textarea
                    rows={2}
                    required
                    value={pickupAddress}
                    onChange={e => setPickupAddress(e.target.value)}
                    placeholder="Quartier, rue, numéro de magasin ou dépôt où nos livreurs viendront ramasser vos colis..."
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-500"
                  />
                </div>

                {/* 5. Type d'activité commerciale */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Type d'activité commerciale
                  </label>
                  <select
                    value={activityType}
                    onChange={e => setActivityType(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-500"
                  >
                    {ACTIVITY_TYPES.map(act => (
                      <option key={act} value={act}>
                        {act}
                      </option>
                    ))}
                  </select>
                </div>

                {/* 5b. البطاقة الوطنية للتاجر (CIN) */}
                <div className="p-3 bg-slate-50/80 border border-slate-200 rounded-2xl space-y-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] font-black text-slate-800 flex items-center gap-1.5">
                      <ShieldCheck className="w-3.5 h-3.5 text-red-600" />
                      <span>البطاقة الوطنية (CIN) — Carte Nationale</span>
                    </span>
                    <input
                      type="text"
                      value={cinNumber}
                      onChange={e => setCinNumber(e.target.value.toUpperCase())}
                      placeholder="N° CIN (اختياري)"
                      className="w-32 px-2.5 py-1 text-[11px] font-mono uppercase bg-white border border-slate-200 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-red-500"
                    />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <KycPhotoUpload
                      label="صورة البطاقة الوطنية (الوجه الأمامي)"
                      sublabel="Recto CIN — إلزامي"
                      value={cinPhotoUrl}
                      onChange={setCinPhotoUrl}
                      required
                      variant="id_card"
                      captureMode="environment"
                    />
                    <KycPhotoUpload
                      label="صورة البطاقة الوطنية (الظهر)"
                      sublabel="Verso CIN — اختياري"
                      value={cinBackPhotoUrl}
                      onChange={setCinBackPhotoUrl}
                      variant="id_card"
                      captureMode="environment"
                    />
                  </div>
                </div>

                {/* 6. Mot de passe & Confirmation */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      Mot de passe *
                    </label>
                    <div className="relative">
                      <input
                        type={showRegisterPassword ? 'text' : 'password'}
                        required
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        placeholder="••••••••"
                        className={`w-full ${isRtl ? 'pl-9 pr-3' : 'pr-9 pl-3'} py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-500`}
                      />
                      <button
                        type="button"
                        onClick={() => setShowRegisterPassword(!showRegisterPassword)}
                        className={`absolute ${isRtl ? 'left-2' : 'right-2'} top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-700 rounded-md transition cursor-pointer`}
                        title={showRegisterPassword ? 'إخفاء' : 'إظهار'}
                      >
                        {showRegisterPassword ? <EyeOff className="w-3.5 h-3.5 text-red-600" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      Confirmation mot de passe *
                    </label>
                    <div className="relative">
                      <input
                        type={showConfirmPassword ? 'text' : 'password'}
                        required
                        value={confirmPassword}
                        onChange={e => setConfirmPassword(e.target.value)}
                        placeholder="••••••••"
                        className={`w-full ${isRtl ? 'pl-9 pr-3' : 'pr-9 pl-3'} py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-500`}
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        className={`absolute ${isRtl ? 'left-2' : 'right-2'} top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-700 rounded-md transition cursor-pointer`}
                        title={showConfirmPassword ? 'إخفاء' : 'إظهار'}
                      >
                        {showConfirmPassword ? <EyeOff className="w-3.5 h-3.5 text-red-600" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Submit button */}
                <div className="pt-2">
                  <button
                    type="submit"
                    className="w-full py-3 text-xs font-bold text-white bg-red-600 hover:bg-red-700 rounded-xl shadow-xs transition-colors flex items-center justify-center gap-2"
                  >
                    <span>Envoyer ma demande d'inscription</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>

                <div className="text-center pt-1 text-[11px] text-slate-500 space-y-1.5">
                  <div>
                    <span>Vous avez déjà un compte ? </span>
                    <button
                      type="button"
                      onClick={() => setTab('login')}
                      className="font-bold text-red-600 hover:underline cursor-pointer"
                    >
                      Se connecter
                    </button>
                  </div>
                  {onOpenDriverRegister && (
                    <div>
                      <span>واش نتا ليفرور وبغيتي تخدم معانا؟ </span>
                      <button
                        type="button"
                        onClick={() => {
                          onClose();
                          onOpenDriverRegister();
                        }}
                        className="font-bold text-slate-900 hover:text-red-600 underline cursor-pointer"
                      >
                        تسجل كسائق (Devenir Livreur)
                      </button>
                    </div>
                  )}
                </div>
              </form>
            )}
          </>
        )}

        {/* Social Links Bar (Facebook & Instagram) */}
        <div className="px-6 py-3 border-t border-slate-100 bg-slate-50 flex items-center justify-between gap-3 shrink-0">
          <span className="text-[11px] font-bold text-slate-500">
            FARIOUSY Official
          </span>
          <div className="flex items-center gap-2">
            <a
              href={facebookUrl}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Facebook"
              title="Facebook — FARIOUSY"
              className="group inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white hover:bg-[#1877F2] border border-slate-200 hover:border-[#1877F2] text-slate-700 hover:text-white font-bold text-xs shadow-2xs transition-colors"
            >
              <FacebookIcon className="w-3.5 h-3.5 text-[#1877F2] group-hover:text-white transition-colors" />
              <span>Facebook</span>
            </a>
            <a
              href={instagramUrl}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Instagram"
              title="Instagram — @fariousy1"
              className="group inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white hover:bg-gradient-to-tr hover:from-[#F58529] hover:via-[#DD2A7B] hover:to-[#8134AF] border border-slate-200 hover:border-pink-500 text-slate-700 hover:text-white font-bold text-xs shadow-2xs transition-colors"
            >
              <InstagramIcon className="w-3.5 h-3.5 text-pink-600 group-hover:text-white transition-colors" />
              <span>Instagram</span>
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};
