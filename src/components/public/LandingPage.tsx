import React, { useEffect, useState } from 'react';
import { useLanguage } from '../../i18n/LanguageContext';
import { useDatabase } from '../../context/DatabaseContext';
import { formatMAD, getStatusLabel } from '../../utils/barcode';
import {
  Search,
  Truck,
  ShieldCheck,
  CheckCircle2,
  Clock,
  ArrowRight,
  Phone,
  MessageCircle,
  MapPin,
  Building2,
  Sparkles,
  ChevronRight,
  RotateCcw,
  Wallet,
  Package,
  Layers,
  X,
  Languages,
  Check,
  AlertCircle,
  Star,
  Send,
  MessageSquareQuote,
  UserCheck,
  Radio,
  Copy
} from 'lucide-react';
import { AuthModal } from '../auth/AuthModal';
import { DriverRegisterModal } from '../auth/DriverRegisterModal';
import { ReviewTargetType } from '../../types';
import {
  FacebookIcon,
  InstagramIcon,
  DEFAULT_FACEBOOK_URL,
  DEFAULT_INSTAGRAM_URL
} from '../common/SocialIcons';
import { supabaseRealtime, trackPublicPackageInSupabase } from '../../services/supabase';
import { buildLiveTrackingUrl, getTrackingProgressStages } from '../../utils/trackingNotifications';

export const LandingPage: React.FC = () => {
  const { language, setLanguage, languages, isRtl } = useLanguage();
  const { cities, companySettings, reviews, publicDrivers, submitReview } = useDatabase();

  const formatWaHref = (rawPhone?: string) => {
    const digits = (rawPhone || '+212661000001').replace(/\D/g, '');
    if (!digits) return 'https://wa.me/212661000001';
    if (digits.startsWith('0')) return `https://wa.me/212${digits.slice(1)}`;
    return `https://wa.me/${digits}`;
  };

  const formatTelHref = (rawPhone?: string) => {
    const cleaned = (rawPhone || '+212522894010').replace(/[^\d+]/g, '');
    return `tel:${cleaned || '+212522894010'}`;
  };

  const whatsappDisplay = companySettings?.whatsapp?.trim() || '+212 661 00 00 01';
  const phoneDisplay = companySettings?.phone?.trim() || '+212 522 89 40 10';
  const facebookUrl = companySettings?.facebookUrl?.trim() || DEFAULT_FACEBOOK_URL;
  const instagramUrl = companySettings?.instagramUrl?.trim() || DEFAULT_INSTAGRAM_URL;

  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authDefaultTab, setAuthDefaultTab] = useState<'login' | 'register'>('login');
  const [driverModalOpen, setDriverModalOpen] = useState(false);

  // Public Tracking Search State
  const [trackingCode, setTrackingCode] = useState('');
  const [isTrackingLoading, setIsTrackingLoading] = useState(false);
  const [trackingResult, setTrackingResult] = useState<any | null>(null);
  const [trackingError, setTrackingError] = useState<string | null>(null);
  const [isTrackingModalOpen, setIsTrackingModalOpen] = useState(false);
  const [copiedPublicLink, setCopiedPublicLink] = useState(false);
  const [liveUpdateBanner, setLiveUpdateBanner] = useState<string | null>(null);

  // City Search Filter
  const [citySearch, setCitySearch] = useState('');
  const [showLangMenu, setShowLangMenu] = useState(false);

  // Customer & Driver Reviews State
  const [reviewFilter, setReviewFilter] = useState<'all' | 'company' | 'driver'>('all');
  const [revTargetType, setRevTargetType] = useState<ReviewTargetType>('company');
  const [revRating, setRevRating] = useState<number>(5);
  const [revHoverRating, setRevHoverRating] = useState<number>(0);
  const [revAuthorName, setRevAuthorName] = useState('');
  const [revAuthorRole, setRevAuthorRole] = useState<'client' | 'destinataire' | 'visiteur'>('destinataire');
  const [revAuthorCity, setRevAuthorCity] = useState('');
  const [revDriverId, setRevDriverId] = useState('');
  const [revDriverName, setRevDriverName] = useState('');
  const [revTracking, setRevTracking] = useState('');
  const [revComment, setRevComment] = useState('');
  const [revSubmitting, setRevSubmitting] = useState(false);
  const [revFeedback, setRevFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const visibleReviews = (reviews || []).filter(r => r.isPublic !== false);
  const companyReviews = visibleReviews.filter(r => r.targetType === 'company');
  const driverReviews = visibleReviews.filter(r => r.targetType === 'driver');
  const avgCompanyRating = companyReviews.length
    ? companyReviews.reduce((s, r) => s + r.rating, 0) / companyReviews.length
    : 0;
  const avgDriverRating = driverReviews.length
    ? driverReviews.reduce((s, r) => s + r.rating, 0) / driverReviews.length
    : 0;
  const filteredPublicReviews =
    reviewFilter === 'company'
      ? companyReviews
      : reviewFilter === 'driver'
      ? driverReviews
      : visibleReviews;

  const handleReviewSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setRevFeedback(null);
    if (!revAuthorName.trim() || revAuthorName.trim().length < 2) {
      setRevFeedback({
        type: 'error',
        text: language === 'ar' ? 'يرجى إدخال اسمك الكامل.' : 'Veuillez saisir votre nom.'
      });
      return;
    }
    if (!revComment.trim() || revComment.trim().length < 3) {
      setRevFeedback({
        type: 'error',
        text: language === 'ar' ? 'يرجى كتابة تعليقك قبل الإرسال.' : 'Veuillez écrire votre commentaire.'
      });
      return;
    }
    if (revTargetType === 'driver' && !revDriverId && !revDriverName.trim() && !revTracking.trim()) {
      setRevFeedback({
        type: 'error',
        text:
          language === 'ar'
            ? 'يرجى اختيار الليفرور أو كتابة اسمه أو رقم التتبع.'
            : 'Veuillez choisir le livreur, saisir son nom ou le numéro de suivi.'
      });
      return;
    }

    setRevSubmitting(true);
    const chosenDrv = publicDrivers.find(d => d.id === revDriverId);
    const res = await submitReview({
      targetType: revTargetType,
      rating: revRating,
      comment: revComment.trim(),
      authorName: revAuthorName.trim(),
      authorRole: revAuthorRole,
      authorCity: revAuthorCity.trim() || undefined,
      driverId: revTargetType === 'driver' ? revDriverId || undefined : undefined,
      driverName:
        revTargetType === 'driver'
          ? chosenDrv?.name || revDriverName.trim() || undefined
          : undefined,
      trackingNumber: revTracking.trim() ? revTracking.trim().toUpperCase() : undefined
    });
    setRevSubmitting(false);

    if (res.success) {
      setRevComment('');
      setRevTracking('');
      setRevDriverId('');
      setRevDriverName('');
      setRevRating(5);
      setRevFeedback({
        type: 'success',
        text: language === 'ar' ? 'شكراً لك! تم نشر تقييمك بنجاح.' : 'Merci ! Votre avis a été publié avec succès.'
      });
    } else {
      setRevFeedback({
        type: 'error',
        text: res.error || (language === 'ar' ? 'تعذر إرسال التقييم.' : "Impossible d'envoyer l'avis.")
      });
    }
  };

  const handleOpenAuth = (tab: 'login' | 'register') => {
    setAuthDefaultTab(tab);
    setAuthModalOpen(true);
  };

  const runPublicTrackingLookup = async (rawCode: string) => {
    const cleanCode = rawCode.trim().toUpperCase();
    if (!cleanCode) return;

    setTrackingCode(cleanCode);
    setIsTrackingLoading(true);
    setTrackingError(null);
    setTrackingResult(null);
    setLiveUpdateBanner(null);
    setIsTrackingModalOpen(true);

    try {
      const result = await trackPublicPackageInSupabase(cleanCode);
      if (result.success && result.parcel) {
        setTrackingResult(result.parcel);
      } else {
        setTrackingError(
          result.error ||
            (language === 'ar' ? 'لم يتم العثور على أي شحنة بهذا الرمز.' : 'Aucun colis trouvé avec ce numéro de suivi.')
        );
      }
    } catch (err: any) {
      setTrackingError(
        err.message ||
          (language === 'ar' ? 'تعذر الاتصال بخادم التتبع.' : 'Erreur de connexion au serveur de suivi.')
      );
    } finally {
      setIsTrackingLoading(false);
    }
  };

  // Auto-open live tracking modal when opened from a WhatsApp link (?track=FAR-...)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const urlTrack = params.get('track') || params.get('tracking');
    if (urlTrack && urlTrack.trim().length >= 3) {
      void runPublicTrackingLookup(urlTrack);
    }
  }, []);

  // Keep open public tracking modal synchronized LIVE via Supabase Realtime
  useEffect(() => {
    if (!isTrackingModalOpen || !trackingResult?.trackingNumber) return;
    const activeCode = String(trackingResult.trackingNumber).toUpperCase();
    const unsub = supabaseRealtime.onPackageStatusChanged(ev => {
      if (String(ev.trackingNumber || '').toUpperCase() !== activeCode) return;
      setTrackingResult((prev: any) => {
        if (!prev) return prev;
        const prevHist = Array.isArray(prev.history) ? prev.history : [];
        const newStep = {
          status: ev.newStatus,
          statusLabel: ev.newStatusLabel || getStatusLabel(ev.newStatus as any),
          timestamp: ev.timestamp || new Date().toISOString(),
          comment: `تحديث مباشر · ${ev.newStatusLabel || ev.newStatus}`
        };
        return {
          ...prev,
          status: ev.newStatus,
          lastMovedAt: ev.timestamp || new Date().toISOString(),
          history: [...prevHist, newStep]
        };
      });
      setLiveUpdateBanner(
        language === 'ar'
          ? `تحديث مباشر الآن: ${ev.newStatusLabel || ev.newStatus}`
          : `Mise à jour en direct : ${ev.newStatusLabel || ev.newStatus}`
      );
    });
    return () => unsub();
  }, [isTrackingModalOpen, trackingResult?.trackingNumber, language]);

  const handleTrackSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await runPublicTrackingLookup(trackingCode);
  };

  const filteredCities = (cities || []).filter(c =>
    !citySearch || c.name.toLowerCase().includes(citySearch.toLowerCase())
  );

  return (
    <div className={`min-h-screen bg-slate-900 text-slate-100 selection:bg-red-600 selection:text-white ${isRtl ? 'font-arabic' : ''}`}>
      {/* ----------------- TOP NAVBAR ----------------- */}
      <header className="sticky top-0 z-40 bg-slate-900/90 backdrop-blur-md border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 h-18 sm:h-20 flex items-center justify-between gap-2 sm:gap-4">
          {/* Brand */}
          <div className="flex items-center gap-2 sm:gap-3 min-w-0 shrink">
            <img
              src="/fariousy-logo.jpeg"
              alt="FARIOUSY DELIVERY"
              className="w-9 h-9 sm:w-11 sm:h-11 object-contain rounded-full bg-white p-0.5 shadow-md shadow-red-950/40 shrink-0"
            />
            <div className="min-w-0">
              <span className="font-black text-white tracking-wider text-sm sm:text-xl block leading-none truncate">
                FARIOUSY
              </span>
              <span className="text-[9px] sm:text-xs font-black text-red-500 tracking-wider sm:tracking-widest block uppercase mt-0.5 truncate">
                Fast Delivery Maroc
              </span>
            </div>
          </div>

          {/* Navigation Links (Desktop) */}
          <nav className="hidden lg:flex items-center gap-8 text-xs font-bold text-slate-300">
            <a href="#services" className="hover:text-red-400 transition-colors">
              {language === 'ar' ? 'خدماتنا' : 'Services'}
            </a>
            <a href="#tarifs" className="hover:text-red-400 transition-colors">
              {language === 'ar' ? 'الأسعار والمدن' : 'Tarifs & Couverture'}
            </a>
            <a href="#process" className="hover:text-red-400 transition-colors">
              {language === 'ar' ? 'طريقة العمل' : 'Comment ça marche'}
            </a>
            <a href="#devenir-livreur" className="hover:text-red-400 transition-colors">
              {language === 'ar' ? 'التسجيل كليفرور' : 'Devenir Livreur'}
            </a>
            <a href="#avis" className="hover:text-red-400 transition-colors">
              {language === 'ar' ? 'آراء الزبائن' : 'Avis Clients'}
            </a>
            <a href="#contact" className="hover:text-red-400 transition-colors">
              {language === 'ar' ? 'اتصل بنا' : 'Contact'}
            </a>
          </nav>

          {/* Right Action Zone: Social Icons + Language + EXACTLY 2 Clear Buttons */}
          <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
            {/* Social Links (Facebook & Instagram) */}
            <div className="hidden sm:flex items-center gap-1.5">
              <a
                href={facebookUrl}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Facebook"
                title="Facebook — FARIOUSY"
                className="w-9 h-9 flex items-center justify-center rounded-xl bg-slate-800/80 hover:bg-[#1877F2] text-[#1877F2] hover:text-white border border-slate-700 hover:border-[#1877F2] transition"
              >
                <FacebookIcon className="w-4 h-4" />
              </a>
              <a
                href={instagramUrl}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Instagram"
                title="Instagram — @fariousy1"
                className="w-9 h-9 flex items-center justify-center rounded-xl bg-slate-800/80 hover:bg-gradient-to-tr hover:from-[#F58529] hover:via-[#DD2A7B] hover:to-[#8134AF] text-pink-400 hover:text-white border border-slate-700 hover:border-pink-500 transition"
              >
                <InstagramIcon className="w-4 h-4" />
              </a>
            </div>

            {/* Language Dropdown */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowLangMenu(!showLangMenu)}
                aria-label="Language"
                title={languages.find(l => l.code === language)?.nativeName}
                className="w-9 h-9 flex items-center justify-center text-slate-200 hover:text-white bg-slate-800/80 hover:bg-slate-800 rounded-xl border border-slate-700 transition cursor-pointer"
              >
                <Languages className="w-4 h-4" />
              </button>

              {showLangMenu && (
                <div className={`absolute ${isRtl ? 'left-0' : 'right-0'} mt-2 w-40 bg-slate-850 rounded-2xl shadow-2xl border border-slate-700 p-2 z-50`}>
                  {languages.map(l => (
                    <button
                      key={l.code}
                      onClick={() => {
                        setLanguage(l.code);
                        setShowLangMenu(false);
                      }}
                      className={`w-full flex items-center justify-between px-3 py-2 text-xs rounded-xl transition cursor-pointer ${
                        language === l.code ? 'bg-red-600 text-white font-black' : 'text-slate-300 hover:bg-slate-800'
                      }`}
                    >
                      <span>{l.flag} {l.nativeName}</span>
                      {language === l.code && <Check className="w-3.5 h-3.5" />}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* BUTTON 1: "دخول" (Se connecter) */}
            <button
              type="button"
              onClick={() => handleOpenAuth('login')}
              className="px-2.5 sm:px-4 py-2 sm:py-2.5 text-[11px] sm:text-sm font-bold text-slate-200 hover:text-white bg-slate-800/90 hover:bg-slate-800 border border-slate-700 rounded-xl shadow-xs transition-all cursor-pointer whitespace-nowrap"
            >
              {language === 'ar' ? 'دخول' : 'Connexion'}
            </button>

            {/* BUTTON 2: "إنشاء حساب كليان" (Créer un compte client) */}
            <button
              type="button"
              onClick={() => handleOpenAuth('register')}
              className="px-3 sm:px-5 py-2 sm:py-2.5 text-[11px] sm:text-sm font-black text-white bg-red-600 hover:bg-red-500 rounded-xl shadow-md shadow-red-900/30 transition-all cursor-pointer flex items-center gap-1 sm:gap-1.5 whitespace-nowrap"
            >
              <span>{language === 'ar' ? 'إنشاء حساب' : 'Créer un compte'}</span>
              <ArrowRight className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${isRtl ? 'rotate-180' : ''}`} />
            </button>
          </div>
        </div>
      </header>

      {/* ----------------- HERO SECTION ----------------- */}
      <section className="relative pt-12 pb-20 sm:pt-20 sm:pb-28 overflow-hidden bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(220,38,38,0.15),transparent_60%)] pointer-events-none" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 relative z-10">
          <div className="text-center max-w-3xl mx-auto space-y-6">
            {/* Top pill badge */}
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-red-950/60 border border-red-800/80 text-red-300 text-xs font-black shadow-inner">
              <Truck className="w-3.5 h-3.5 text-red-400" />
              <span>
                {language === 'ar'
                  ? 'شبكة التوصيل السريع رقم 1 للمتاجر الإلكترونية بالمغرب'
                  : 'Réseau Logistique & Livraison Express E-commerce au Maroc'}
              </span>
            </div>

            {/* Main Headline */}
            <h1 className="text-3xl sm:text-5xl lg:text-6xl font-black text-white tracking-tight leading-tight sm:leading-tight">
              {language === 'ar' ? (
                <>
                  توصيل سريع، استخلاص آمن لأموالك <br />
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-red-500 to-amber-400">
                    وتغطية شاملة لكل مدن المغرب
                  </span>
                </>
              ) : (
                <>
                  Livraison Express & Encaissement CRBT <br />
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-red-500 to-amber-400">
                    Partout au Maroc en 24h à 48h
                  </span>
                </>
              )}
            </h1>

            {/* Subtitle */}
            <p className="text-slate-400 text-sm sm:text-base leading-relaxed max-w-2xl mx-auto">
              {language === 'ar'
                ? 'حلول لوجستية متكاملة لرواد التجارة الإلكترونية والشركات: راماساج يومي مجاني، استخلاص أموال الدفع عند الاستلام (CRBT)، تحويلات بنكية منتظمة وتتبع لحظي مباشر.'
                : 'La plateforme logistique de référence pour les e-commerçants : ramassage gratuit à votre boutique, paiement à la livraison (COD) sécurisé, reversement rapide de vos fonds et suivi en direct.'}
            </p>

            {/* ----------------- PUBLIC TRACKING BAR ----------------- */}
            <div className="pt-4 max-w-xl mx-auto">
              <form
                onSubmit={handleTrackSubmit}
                className="p-2 sm:p-2.5 bg-slate-800/90 border border-slate-700 rounded-2xl shadow-2xl flex flex-col sm:flex-row items-center gap-2"
              >
                <div className="relative flex-1 w-full">
                  <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={trackingCode}
                    onChange={e => setTrackingCode(e.target.value)}
                    placeholder={language === 'ar' ? 'تتبع شحنتك: أدخل رقم التتبع (مثال: FAR-2601-8491)' : 'Suivi de colis : Saisissez votre code (ex: FAR-2601-8491)'}
                    className="w-full pl-10 pr-4 py-3 bg-slate-900 border border-slate-700/80 rounded-xl text-xs sm:text-sm font-mono text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-red-500 uppercase"
                  />
                </div>
                <button
                  type="submit"
                  disabled={isTrackingLoading || !trackingCode.trim()}
                  className="w-full sm:w-auto px-6 py-3 bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white font-black text-xs sm:text-sm rounded-xl shadow-md transition cursor-pointer shrink-0 flex items-center justify-center gap-2"
                >
                  <Search className="w-4 h-4" />
                  <span>{language === 'ar' ? 'تتبع الشحنة' : 'Suivre mon colis'}</span>
                </button>
              </form>
              <p className="text-[11px] text-slate-500 mt-2 text-center">
                {language === 'ar'
                  ? '⚡ التتبع متاح للعموم فوراً دون الحاجة إلى تسجيل الدخول'
                  : '⚡ Suivi en direct instantané accessible sans connexion requise'}
              </p>
            </div>

            {/* Two Action Buttons */}
            <div className="pt-4 flex flex-col sm:flex-row items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => handleOpenAuth('register')}
                className="w-full sm:w-auto px-8 py-4 bg-red-600 hover:bg-red-500 text-white font-black text-sm rounded-xl shadow-lg shadow-red-900/40 transition-all cursor-pointer flex items-center justify-center gap-2 hover:scale-[1.02]"
              >
                <span>{language === 'ar' ? 'إنشاء حساب كليان جديد' : 'Créer un compte client'}</span>
                <ArrowRight className={`w-4 h-4 ${isRtl ? 'rotate-180' : ''}`} />
              </button>
              <button
                type="button"
                onClick={() => handleOpenAuth('login')}
                className="w-full sm:w-auto px-8 py-4 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 font-bold text-sm rounded-xl transition cursor-pointer flex items-center justify-center gap-2"
              >
                <span>{language === 'ar' ? 'تسجيل الدخول إلى حسابك' : 'Se connecter à mon espace'}</span>
              </button>
            </div>

            {/* Direct Driver Recruitment Link in Hero */}
            <div className="pt-2 flex flex-col items-center gap-3">
              <button
                type="button"
                onClick={() => setDriverModalOpen(true)}
                className="inline-flex items-center gap-2 px-4 py-2 text-xs font-bold text-amber-300 hover:text-amber-200 bg-slate-800/60 hover:bg-slate-800 border border-slate-700/80 rounded-xl transition cursor-pointer"
              >
                <Truck className="w-4 h-4 text-amber-400" />
                <span>
                  {language === 'ar'
                    ? 'هل أنت سائق (ليفرور)؟ سجّل للعمل معنا الآن'
                    : 'Vous êtes livreur ? Postuler pour rejoindre notre flotte'}
                </span>
                <ChevronRight className={`w-4 h-4 ${isRtl ? 'rotate-180' : ''}`} />
              </button>

              {/* Direct Social Media Buttons (Hero) */}
              <div className="flex items-center justify-center gap-2.5">
                <a
                  href={facebookUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Facebook"
                  title="Facebook — FARIOUSY"
                  className="group inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-800/80 hover:bg-[#1877F2] border border-slate-700 hover:border-[#1877F2] text-slate-200 hover:text-white text-xs font-bold transition"
                >
                  <FacebookIcon className="w-4 h-4 text-[#1877F2] group-hover:text-white transition-colors" />
                  <span>Facebook</span>
                </a>
                <a
                  href={instagramUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Instagram"
                  title="Instagram — @fariousy1"
                  className="group inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-800/80 hover:bg-gradient-to-tr hover:from-[#F58529] hover:via-[#DD2A7B] hover:to-[#8134AF] border border-slate-700 hover:border-pink-500 text-slate-200 hover:text-white text-xs font-bold transition"
                >
                  <InstagramIcon className="w-4 h-4 text-pink-400 group-hover:text-white transition-colors" />
                  <span>Instagram</span>
                </a>
              </div>
            </div>
          </div>

          {/* Quick Stats Grid */}
          <div className="mt-16 grid grid-cols-2 md:grid-cols-4 gap-4 max-w-4xl mx-auto">
            <div className="p-4 rounded-2xl bg-slate-850/80 border border-slate-800 text-center">
              <div className="text-2xl sm:text-3xl font-black font-mono text-white">100+</div>
              <div className="text-xs text-slate-400 mt-1 font-semibold">
                {language === 'ar' ? 'مدينة مغطاة بالمغرب' : 'Villes couvertes'}
              </div>
            </div>
            <div className="p-4 rounded-2xl bg-slate-850/80 border border-slate-800 text-center">
              <div className="text-2xl sm:text-3xl font-black font-mono text-emerald-400">24h - 48h</div>
              <div className="text-xs text-slate-400 mt-1 font-semibold">
                {language === 'ar' ? 'توصيل مضمون لباب المنزل' : 'Délai moyen garanti'}
              </div>
            </div>
            <div className="p-4 rounded-2xl bg-slate-850/80 border border-slate-800 text-center">
              <div className="text-2xl sm:text-3xl font-black font-mono text-red-500">100%</div>
              <div className="text-xs text-slate-400 mt-1 font-semibold">
                {language === 'ar' ? 'أمان استخلاص أموال CRBT' : 'Sécurité encaissement COD'}
              </div>
            </div>
            <div className="p-4 rounded-2xl bg-slate-850/80 border border-slate-800 text-center">
              <div className="text-2xl sm:text-3xl font-black font-mono text-amber-400">0 MAD</div>
              <div className="text-xs text-slate-400 mt-1 font-semibold">
                {language === 'ar' ? 'راماساج يومي مجاني' : 'Ramassage gratuit'}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ----------------- SERVICES SECTION ----------------- */}
      <section id="services" className="py-20 bg-slate-950 border-t border-slate-850">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="text-center max-w-2xl mx-auto mb-14">
            <h2 className="text-2xl sm:text-4xl font-black text-white tracking-tight">
              {language === 'ar' ? 'خدمات التوصيل المتكاملة لمتجرك' : 'Nos Services de Livraison Professionnels'}
            </h2>
            <p className="text-slate-400 text-xs sm:text-sm mt-2">
              {language === 'ar'
                ? 'كل ما يحتاجه التاجر الإلكتروني لزيادة نسبة تسليم الطلبيات وضمان رضا الزبناء'
                : 'Une suite complète conçue pour maximiser votre taux de livraison et fidéliser vos clients'}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Card 1 */}
            <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 hover:border-red-600/50 transition-all group">
              <div className="w-12 h-12 rounded-xl bg-red-950/80 border border-red-800/80 text-red-500 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <Truck className="w-6 h-6" />
              </div>
              <h3 className="text-base font-black text-white mb-2">
                {language === 'ar' ? 'توصيل سريع لباب المنزل' : 'Livraison Porte-à-Porte'}
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                {language === 'ar'
                  ? 'توصيل محترف مع اتصال مسبق بالزبون لتأكيد الموعد والعنوان بدقة، لتقليل نسبة المرتجعات.'
                  : 'Distribution soignée avec appel téléphonique préalable du destinataire pour garantir une remise en main propre rapide.'}
              </p>
            </div>

            {/* Card 2 */}
            <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 hover:border-emerald-600/50 transition-all group">
              <div className="w-12 h-12 rounded-xl bg-emerald-950/80 border border-emerald-800/80 text-emerald-400 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <Wallet className="w-6 h-6" />
              </div>
              <h3 className="text-base font-black text-white mb-2">
                {language === 'ar' ? 'استخلاص أموال CRBT والتحويل السريع' : 'Encaissement CRBT & Payouts 24h'}
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                {language === 'ar'
                  ? 'استخلاص ثمن السلعة ومصاريف التوصيل فوراً عند التسليم، مع تحويل بنكي منتظم لحسابك مصحوباً بكشف مفصل.'
                  : 'Encaissement strict du montant COD, déduction transparente des frais et versement rapide sur votre compte bancaire.'}
              </p>
            </div>

            {/* Card 3 */}
            <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 hover:border-amber-600/50 transition-all group">
              <div className="w-12 h-12 rounded-xl bg-amber-950/80 border border-amber-800/80 text-amber-400 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <Package className="w-6 h-6" />
              </div>
              <h3 className="text-base font-black text-white mb-2">
                {language === 'ar' ? 'راماساج مجاني وإدارة المرتجعات' : 'Ramassage Gratuit & Retours'}
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                {language === 'ar'
                  ? 'فريقنا يتكلف باستلام الطرود من محلك أو مستودعك مجاناً كل يوم، مع نظام شفاف لمعالجة المرتجعات.'
                  : 'Nos coursiers passent collecter vos colis sans frais supplémentaires. Gestion simplifiée et retour gratuit des colis non livrés.'}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ----------------- TARIFS & COUVERTURE SECTION ----------------- */}
      <section id="tarifs" className="py-20 bg-slate-900 border-t border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="text-center max-w-2xl mx-auto mb-10">
            <h2 className="text-2xl sm:text-4xl font-black text-white tracking-tight">
              {language === 'ar' ? 'الأثمنة والمدن المغطاة' : 'Tarifs Clairs & Villes Couvertes'}
            </h2>
            <p className="text-slate-400 text-xs sm:text-sm mt-2">
              {language === 'ar'
                ? 'تعريفات شفافة بدون أي رسوم خفية. تصفح أثمنة التوصيل حسب مدينتك'
                : 'Tarifs compétitifs par destination sans frais cachés. Recherchez votre ville :'}
            </p>

            {/* City Search Bar */}
            <div className="mt-6 max-w-md mx-auto relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={citySearch}
                onChange={e => setCitySearch(e.target.value)}
                placeholder={language === 'ar' ? 'ابحث عن اسم المدينة (مثال: العيون، الدار البيضاء، مراكش)...' : 'Rechercher une ville (ex: Laâyoune, Casablanca, Marrakech)...'}
                className="w-full pl-9 pr-3 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-red-500"
              />
            </div>
          </div>

          {/* Cities Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {filteredCities.slice(0, 24).map(cityItem => (
              <div
                key={cityItem.id}
                className="p-3.5 rounded-xl bg-slate-850/80 border border-slate-800 hover:border-red-600/40 transition-colors"
              >
                <div className="flex items-center gap-1.5 text-slate-300 font-bold text-xs truncate">
                  <MapPin className="w-3.5 h-3.5 text-red-500 shrink-0" />
                  <span className="truncate">{cityItem.name}</span>
                </div>
                <div className="mt-2 flex items-baseline justify-between">
                  <span className="text-[10px] text-slate-500 font-semibold">
                    {cityItem.deliveryDelayHours ? `${cityItem.deliveryDelayHours}h` : '24h - 48h'}
                  </span>
                  <span className="text-sm font-black font-mono text-emerald-400">
                    {formatMAD(cityItem.defaultFee)}
                  </span>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-8 text-center">
            <p className="text-xs text-slate-400">
              {language === 'ar'
                ? '✨ تتوفر تعريفات تفضيلية مخصصة للعملاء الذين يشحنون كميات مهمة يومياً.'
                : '✨ Tarifs personnalisés et dégressifs disponibles pour les boutiques à fort volume.'}
            </p>
          </div>
        </div>
      </section>

      {/* ----------------- PROCESS SECTION (COMMENT ÇA MARCHE) ----------------- */}
      <section id="process" className="py-20 bg-slate-950 border-t border-slate-850">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="text-center max-w-2xl mx-auto mb-14">
            <h2 className="text-2xl sm:text-4xl font-black text-white tracking-tight">
              {language === 'ar' ? 'طريقة العمل في 4 خطوات بسيطة' : 'Comment ça fonctionne ?'}
            </h2>
            <p className="text-slate-400 text-xs sm:text-sm mt-2">
              {language === 'ar'
                ? 'انضم إلينا اليوم وابدأ في شحن طرودك بكل راحة واحترافية'
                : 'Démarrez vos expéditions en toute sérénité en 4 étapes simples :'}
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 relative">
              <span className="text-4xl font-black font-mono text-slate-800 absolute top-3 right-4">01</span>
              <div className="w-9 h-9 rounded-lg bg-red-600 text-white flex items-center justify-center font-black text-sm mb-3">
                1
              </div>
              <h4 className="text-sm font-bold text-white mb-1">
                {language === 'ar' ? 'تسجيل وسحب الطلب' : 'Création du colis'}
              </h4>
              <p className="text-xs text-slate-400">
                {language === 'ar'
                  ? 'سجل حسابك مجاناً وأدخل بيانات الزبون، المدينة، وثمن السلعة.'
                  : 'Créez votre compte marchand et enregistrez vos colis en quelques clics.'}
              </p>
            </div>

            <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 relative">
              <span className="text-4xl font-black font-mono text-slate-800 absolute top-3 right-4">02</span>
              <div className="w-9 h-9 rounded-lg bg-red-600 text-white flex items-center justify-center font-black text-sm mb-3">
                2
              </div>
              <h4 className="text-sm font-bold text-white mb-1">
                {language === 'ar' ? 'راماساج الطرود مجاناً' : 'Ramassage gratuit'}
              </h4>
              <p className="text-xs text-slate-400">
                {language === 'ar'
                  ? 'يمر موزع فاروسي لاستلام طرودك من محلك دون أي مصاريف إضافية.'
                  : 'Notre livreur passe à votre magasin ou domicile collecter vos colis.'}
              </p>
            </div>

            <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 relative">
              <span className="text-4xl font-black font-mono text-slate-800 absolute top-3 right-4">03</span>
              <div className="w-9 h-9 rounded-lg bg-red-600 text-white flex items-center justify-center font-black text-sm mb-3">
                3
              </div>
              <h4 className="text-sm font-bold text-white mb-1">
                {language === 'ar' ? 'التوصيل والاستخلاص' : 'Livraison express & COD'}
              </h4>
              <p className="text-xs text-slate-400">
                {language === 'ar'
                  ? 'توصيل سريع لباب الزبون مع الاتصال به واستخلاص مبلغ الشحنة كاملاً.'
                  : 'Livraison porte-à-porte, encaissement rigoureux du montant prévu.'}
              </p>
            </div>

            <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 relative">
              <span className="text-4xl font-black font-mono text-slate-800 absolute top-3 right-4">04</span>
              <div className="w-9 h-9 rounded-lg bg-emerald-600 text-white flex items-center justify-center font-black text-sm mb-3">
                4
              </div>
              <h4 className="text-sm font-bold text-white mb-1">
                {language === 'ar' ? 'تحويل أموالك لحسابك' : 'Versement bancaire'}
              </h4>
              <p className="text-xs text-slate-400">
                {language === 'ar'
                  ? 'تحويل بنكي مباشر لأموالك مع فاتورة وكشف تفصيلي يوضح كل درهم.'
                  : 'Versement garanti sur votre compte bancaire avec relevé financier téléchargeable.'}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ----------------- DEVENIR LIVREUR (DRIVER REGISTRATION SECTION) ----------------- */}
      <section id="devenir-livreur" className="py-20 bg-slate-900 border-t border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
            {/* Left Copy & Benefits */}
            <div className="lg:col-span-7 space-y-6">
              <div>
                <p className="text-xs font-bold text-red-400 tracking-wide uppercase mb-2">
                  {language === 'ar'
                    ? 'توظيف الموزعين · شبكة فاريوسي المغرب'
                    : 'Recrutement Flotte · Réseau FARIOUSY Maroc'}
                </p>
                <h2 className="text-2xl sm:text-4xl font-black text-white tracking-tight leading-tight">
                  {language === 'ar'
                    ? 'انضم إلى فريق السائقين (ليفرور) واكسب مدخولاً يومياً قاراً'
                    : 'Devenez Livreur Partenaire FARIOUSY'}
                </h2>
                <p className="text-slate-400 text-xs sm:text-sm mt-3 leading-relaxed max-w-2xl">
                  {language === 'ar'
                    ? 'عندك موطو، طوموبيل أو فوركونيط وكتعرف مدينتك مزيان؟ تسجل معنا كموزع معتمد، استلم الطرود اليومية فـ مدينتك واشتغل بتطبيق احترافي كينظم لك التوصيلات والكاش.'
                    : 'Vous disposez d’une moto, voiture, fourgonnette ou vélo et connaissez bien votre ville ? Rejoignez nos coursiers partenaires, recevez des tournées quotidiennes et suivez vos gains en temps réel.'}
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2 border-t border-slate-800">
                <div className="pt-3 space-y-1.5">
                  <div className="flex items-center gap-2 text-emerald-400 font-bold text-xs">
                    <Wallet className="w-4 h-4 shrink-0" />
                    <span>{language === 'ar' ? 'مدخول يومي ومضمون' : 'Revenus réguliers'}</span>
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    {language === 'ar'
                      ? 'عمولة واضحة على كل طرد مسلم وكل عملية رماصاج.'
                      : 'Rémunération transparente par colis livré et par ramassage.'}
                  </p>
                </div>

                <div className="pt-3 space-y-1.5">
                  <div className="flex items-center gap-2 text-amber-400 font-bold text-xs">
                    <Truck className="w-4 h-4 shrink-0" />
                    <span>{language === 'ar' ? 'تطبيق خاص بالليفرور' : 'App Livreur dédiée'}</span>
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    {language === 'ar'
                      ? 'مسح الكود QR، اتصال سريع بالزبون وتسيير واضح للكاش.'
                      : 'Scan QR, itinéraire client et gestion simplifiée de votre caisse.'}
                  </p>
                </div>

                <div className="pt-3 space-y-1.5">
                  <div className="flex items-center gap-2 text-red-400 font-bold text-xs">
                    <MapPin className="w-4 h-4 shrink-0" />
                    <span>{language === 'ar' ? 'العمل فـ مدينتك' : 'Dans votre ville'}</span>
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    {language === 'ar'
                      ? 'توزيع في أحياء مدينتك بدون تنقلات بعيدة خارج نطاقك.'
                      : 'Secteurs optimisés partout au Maroc selon votre zone.'}
                  </p>
                </div>
              </div>

              <div className="pt-2 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={() => setDriverModalOpen(true)}
                  className="px-7 py-3.5 bg-red-600 hover:bg-red-500 text-white font-black text-xs sm:text-sm rounded-xl shadow-lg shadow-red-900/30 transition cursor-pointer flex items-center gap-2"
                >
                  <Truck className="w-4 h-4" />
                  <span>
                    {language === 'ar' ? 'التسجيل كسائق (ليفرور) الآن' : 'Postuler comme Livreur'}
                  </span>
                  <ArrowRight className={`w-4 h-4 ${isRtl ? 'rotate-180' : ''}`} />
                </button>

                <button
                  type="button"
                  onClick={() => handleOpenAuth('login')}
                  className="px-5 py-3.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 font-bold text-xs sm:text-sm rounded-xl transition cursor-pointer"
                >
                  {language === 'ar' ? 'دخول السائقين المسجلين' : 'Déjà livreur ? Connexion'}
                </button>
              </div>
            </div>

            {/* Right Onboarding Card */}
            <div className="lg:col-span-5">
              <div className="p-6 sm:p-7 rounded-2xl bg-slate-950 border border-slate-800 space-y-5">
                <div className="flex items-center justify-between gap-3 pb-4 border-b border-slate-800">
                  <div>
                    <h3 className="text-base font-black text-white">
                      {language === 'ar' ? 'خطوات التسجيل كليفرور' : 'Inscription en 3 étapes'}
                    </h3>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {language === 'ar'
                        ? 'ملف إلكتروني سريع ومراجعة فورية'
                        : 'Dossier 100% en ligne, validation rapide'}
                    </p>
                  </div>
                  <div className="w-10 h-10 rounded-xl bg-red-950/80 border border-red-800/80 text-red-400 flex items-center justify-center shrink-0">
                    <ShieldCheck className="w-5 h-5" />
                  </div>
                </div>

                <div className="space-y-4 text-xs">
                  <div className="flex items-start gap-3">
                    <span className="w-6 h-6 rounded-lg bg-slate-800 text-white font-mono font-black flex items-center justify-center shrink-0">
                      1
                    </span>
                    <div>
                      <div className="font-bold text-white">
                        {language === 'ar' ? 'تعبئة البيانات والوثائق' : 'Remplissez votre dossier'}
                      </div>
                      <p className="text-slate-400 mt-0.5">
                        {language === 'ar'
                          ? 'الاسم، المدينة، نوع المركبة، صورة شخصية وصورة البطاقة الوطنية (CIN).'
                          : 'Coordonnées, ville, véhicule, photo personnelle et Carte Nationale (CIN).'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <span className="w-6 h-6 rounded-lg bg-slate-800 text-white font-mono font-black flex items-center justify-center shrink-0">
                      2
                    </span>
                    <div>
                      <div className="font-bold text-white">
                        {language === 'ar' ? 'مراجعة وتفعيل الحساب' : 'Validation par la direction'}
                      </div>
                      <p className="text-slate-400 mt-0.5">
                        {language === 'ar'
                          ? 'كتراجع الإدارة الوثائق ديالك وكتفعل حسابك فـ أقل وقت ممكن.'
                          : 'Notre équipe vérifie votre profil et active votre accès livreur.'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <span className="w-6 h-6 rounded-lg bg-emerald-600 text-white font-mono font-black flex items-center justify-center shrink-0">
                      3
                    </span>
                    <div>
                      <div className="font-bold text-white">
                        {language === 'ar' ? 'ابدأ التوصيل واستلم أرباحك' : 'Démarrez vos tournées'}
                      </div>
                      <p className="text-slate-400 mt-0.5">
                        {language === 'ar'
                          ? 'ادخل لحسابك وشوف الطرود المعينة لك فـ مدينتك.'
                          : 'Connectez-vous à votre espace mobile et commencez les livraisons.'}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-800 text-[11px] text-slate-400 flex items-center justify-between gap-2">
                  <span>{language === 'ar' ? 'الوسائل المقبولة :' : 'Véhicules acceptés :'}</span>
                  <span className="font-semibold text-slate-200">
                    🛵 Moto · 🚗 Voiture · 🚐 Fourgonnette · 🚲 Vélo
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => setDriverModalOpen(true)}
                  className="w-full py-3 bg-slate-800 hover:bg-red-600 text-white font-black text-xs rounded-xl border border-slate-700 hover:border-red-500 transition cursor-pointer flex items-center justify-center gap-2"
                >
                  <span>{language === 'ar' ? 'فتح استمارة تسجيل الليفرور' : 'Ouvrir le formulaire livreur'}</span>
                  <ArrowRight className={`w-4 h-4 ${isRtl ? 'rotate-180' : ''}`} />
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ----------------- CUSTOMER & DRIVER REVIEWS (آراء الزبائن فالشركة والليفرورز) ----------------- */}
      <section id="avis" className="py-16 sm:py-20 bg-slate-900 border-t border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 space-y-10">
          {/* Header + Live Stats */}
          <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
            <div className="space-y-2 max-w-2xl">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-bold">
                <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                <span>{language === 'ar' ? 'تقييمات حقيقية وموثوقة' : 'Avis vérifiés & transparents'}</span>
              </div>
              <h2 className="text-2xl sm:text-4xl font-black text-white">
                {language === 'ar' ? 'آراء الزبائن فالشركة والليفرورز' : 'Avis des clients sur FARIOUSY & nos livreurs'}
              </h2>
              <p className="text-sm text-slate-400">
                {language === 'ar'
                  ? 'اطلع على تجارب التجار والمستلمين مع شركة FARIOUSY DELIVERY والموزعين، وشاركنا رأيك بكل شفافية.'
                  : "Découvrez les retours réels de nos marchands et destinataires sur l'entreprise et nos livreurs, ou partagez votre expérience."}
              </p>
            </div>

            <div className="grid grid-cols-3 gap-3 shrink-0">
              <div className="bg-slate-950/80 border border-slate-800 rounded-2xl px-4 py-3 text-center">
                <span className="text-[11px] font-bold text-slate-400 block">
                  {language === 'ar' ? 'تقييم الشركة' : 'Entreprise'}
                </span>
                <span className="text-xl font-black text-amber-400 force-ltr block mt-0.5">
                  {companyReviews.length ? `${avgCompanyRating.toFixed(1)} ★` : '—'}
                </span>
                <span className="text-[10px] text-slate-500">{companyReviews.length}</span>
              </div>
              <div className="bg-slate-950/80 border border-slate-800 rounded-2xl px-4 py-3 text-center">
                <span className="text-[11px] font-bold text-slate-400 block">
                  {language === 'ar' ? 'الليفرورز' : 'Livreurs'}
                </span>
                <span className="text-xl font-black text-emerald-400 force-ltr block mt-0.5">
                  {driverReviews.length ? `${avgDriverRating.toFixed(1)} ★` : '—'}
                </span>
                <span className="text-[10px] text-slate-500">{driverReviews.length}</span>
              </div>
              <div className="bg-slate-950/80 border border-slate-800 rounded-2xl px-4 py-3 text-center">
                <span className="text-[11px] font-bold text-slate-400 block">
                  {language === 'ar' ? 'المجموع' : 'Total'}
                </span>
                <span className="text-xl font-black text-white force-ltr block mt-0.5">
                  {visibleReviews.length}
                </span>
                <span className="text-[10px] text-slate-500">
                  {language === 'ar' ? 'آراء' : 'avis'}
                </span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            {/* Interactive Review Form */}
            <form
              onSubmit={handleReviewSubmit}
              className="lg:col-span-5 bg-slate-950/90 border border-slate-800 rounded-3xl p-5 sm:p-6 space-y-4 shadow-xl"
            >
              <h3 className="text-base font-black text-white flex items-center gap-2">
                <MessageSquareQuote className="w-5 h-5 text-red-500" />
                <span>{language === 'ar' ? 'أضف رأيك الآن' : 'Donner votre avis'}</span>
              </h3>

              {/* Target switcher */}
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setRevTargetType('company')}
                  className={`py-2.5 px-3 rounded-xl text-xs font-bold border flex items-center justify-center gap-2 transition cursor-pointer ${
                    revTargetType === 'company'
                      ? 'bg-red-600 text-white border-red-500'
                      : 'bg-slate-900 text-slate-300 border-slate-800 hover:bg-slate-800'
                  }`}
                >
                  <Building2 className="w-4 h-4" />
                  <span>{language === 'ar' ? 'رأي فالشركة' : "Sur l'entreprise"}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setRevTargetType('driver')}
                  className={`py-2.5 px-3 rounded-xl text-xs font-bold border flex items-center justify-center gap-2 transition cursor-pointer ${
                    revTargetType === 'driver'
                      ? 'bg-red-600 text-white border-red-500'
                      : 'bg-slate-900 text-slate-300 border-slate-800 hover:bg-slate-800'
                  }`}
                >
                  <Truck className="w-4 h-4" />
                  <span>{language === 'ar' ? 'رأي فالليفرور' : 'Sur un livreur'}</span>
                </button>
              </div>

              {/* Stars */}
              <div>
                <span className="text-xs font-bold text-slate-300 block mb-1.5">
                  {language === 'ar' ? 'عدد النجوم' : 'Votre note'}
                </span>
                <div className="flex items-center gap-1">
                  {[1, 2, 3, 4, 5].map(star => (
                    <button
                      key={star}
                      type="button"
                      onMouseEnter={() => setRevHoverRating(star)}
                      onMouseLeave={() => setRevHoverRating(0)}
                      onClick={() => setRevRating(star)}
                      className="p-1 transition-transform hover:scale-110 cursor-pointer"
                    >
                      <Star
                        className={`w-6 h-6 ${
                          star <= (revHoverRating || revRating)
                            ? 'text-amber-400 fill-amber-400'
                            : 'text-slate-700'
                        }`}
                      />
                    </button>
                  ))}
                  <span className="text-xs font-black text-amber-400 ms-2 force-ltr">{revRating}/5</span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-bold text-slate-400 block mb-1">
                    {language === 'ar' ? 'الاسم *' : 'Votre nom *'}
                  </label>
                  <input
                    type="text"
                    value={revAuthorName}
                    onChange={e => setRevAuthorName(e.target.value)}
                    placeholder={language === 'ar' ? 'مثال: سفيان / متجر ...' : 'Ex: Soufiane / Boutique'}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-red-500"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-400 block mb-1">
                    {language === 'ar' ? 'الصفة' : 'Profil'}
                  </label>
                  <select
                    value={revAuthorRole}
                    onChange={e => setRevAuthorRole(e.target.value as any)}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-red-500"
                  >
                    <option value="destinataire">{language === 'ar' ? 'زبون مستلم (Destinataire)' : 'Destinataire'}</option>
                    <option value="client">{language === 'ar' ? 'تاجر / بائع (Marchand)' : 'Marchand / E-commerçant'}</option>
                    <option value="visiteur">{language === 'ar' ? 'زائر' : 'Visiteur'}</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-bold text-slate-400 block mb-1">
                    {language === 'ar' ? 'المدينة (اختياري)' : 'Ville (optionnel)'}
                  </label>
                  <input
                    type="text"
                    value={revAuthorCity}
                    onChange={e => setRevAuthorCity(e.target.value)}
                    placeholder={language === 'ar' ? 'العيون، الدار البيضاء...' : 'Casablanca, Laâyoune...'}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-red-500"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-400 block mb-1">
                    {language === 'ar' ? 'رقم التتبع (اختياري)' : 'Code suivi (optionnel)'}
                  </label>
                  <input
                    type="text"
                    value={revTracking}
                    onChange={e => setRevTracking(e.target.value)}
                    placeholder="FAR-2601-..."
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs font-mono text-white focus:outline-none focus:border-red-500"
                  />
                </div>
              </div>

              {revTargetType === 'driver' && (
                <div className="space-y-2.5 p-3 rounded-2xl bg-slate-900/90 border border-slate-800">
                  {publicDrivers.length > 0 && (
                    <div>
                      <label className="text-[11px] font-bold text-slate-300 block mb-1">
                        {language === 'ar' ? 'اختر الليفرور' : 'Choisir le livreur'}
                      </label>
                      <select
                        value={revDriverId}
                        onChange={e => setRevDriverId(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white"
                      >
                        <option value="">
                          {language === 'ar' ? '-- اختر من قائمة الليفرورز --' : '-- Sélectionner un livreur --'}
                        </option>
                        {publicDrivers.map(d => (
                          <option key={d.id} value={d.id}>
                            {d.name} {d.city ? `(${d.city})` : ''}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {!revDriverId && (
                    <div>
                      <label className="text-[11px] font-bold text-slate-300 block mb-1">
                        {language === 'ar' ? 'اسم الليفرور' : 'Nom du livreur'}
                      </label>
                      <input
                        type="text"
                        value={revDriverName}
                        onChange={e => setRevDriverName(e.target.value)}
                        placeholder={language === 'ar' ? 'اكتب اسم الموزع...' : 'Nom du livreur...'}
                        className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white"
                      />
                    </div>
                  )}
                </div>
              )}

              <div>
                <label className="text-[11px] font-bold text-slate-400 block mb-1">
                  {language === 'ar' ? 'رأيك وتعليقك *' : 'Votre commentaire *'}
                </label>
                <textarea
                  rows={3}
                  value={revComment}
                  onChange={e => setRevComment(e.target.value)}
                  placeholder={
                    language === 'ar'
                      ? 'شاركنا رأيك في التعامل، سرعة التوصيل أو تعامل الليفرور...'
                      : 'Partagez votre expérience avec notre service ou votre livreur...'
                  }
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-red-500"
                />
              </div>

              {revFeedback && (
                <div
                  className={`p-3 rounded-xl text-xs font-bold flex items-center gap-2 ${
                    revFeedback.type === 'success'
                      ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-800'
                      : 'bg-red-950/80 text-red-300 border border-red-800'
                  }`}
                >
                  {revFeedback.type === 'success' ? (
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                  ) : (
                    <AlertCircle className="w-4 h-4 shrink-0" />
                  )}
                  <span>{revFeedback.text}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={revSubmitting}
                className="w-full py-3 bg-red-600 hover:bg-red-500 disabled:opacity-60 text-white font-black text-xs rounded-xl transition cursor-pointer flex items-center justify-center gap-2"
              >
                <Send className="w-4 h-4" />
                <span>
                  {revSubmitting
                    ? language === 'ar'
                      ? 'جاري النشر...'
                      : 'Publication...'
                    : language === 'ar'
                    ? 'إرسال الرأي'
                    : 'Publier mon avis'}
                </span>
              </button>
            </form>

            {/* Real Reviews Grid */}
            <div className="lg:col-span-7 space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                {[
                  { key: 'all', label: language === 'ar' ? `الكل (${visibleReviews.length})` : `Tous (${visibleReviews.length})` },
                  { key: 'company', label: language === 'ar' ? `آراء فالشركة (${companyReviews.length})` : `Entreprise (${companyReviews.length})` },
                  { key: 'driver', label: language === 'ar' ? `آراء فالليفرورز (${driverReviews.length})` : `Livreurs (${driverReviews.length})` }
                ].map(tab => (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => setReviewFilter(tab.key as any)}
                    className={`px-3.5 py-2 rounded-xl text-xs font-bold border transition cursor-pointer ${
                      reviewFilter === tab.key
                        ? 'bg-red-600 text-white border-red-500'
                        : 'bg-slate-950 text-slate-300 border-slate-800 hover:bg-slate-800'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {filteredPublicReviews.length === 0 ? (
                <div className="bg-slate-950/60 border border-dashed border-slate-800 rounded-3xl p-10 text-center space-y-2">
                  <Star className="w-10 h-10 text-slate-700 mx-auto" />
                  <p className="text-sm font-bold text-slate-300">
                    {language === 'ar'
                      ? 'لا توجد تقييمات منشورة بعد في هذا التصنيف'
                      : 'Aucun avis publié pour le moment dans cette catégorie'}
                  </p>
                  <p className="text-xs text-slate-500">
                    {language === 'ar'
                      ? 'كن أول زبون يشارك تجربته الحقيقية مع FARIOUSY والليفرورز!'
                      : 'Soyez le premier client à partager votre retour réel !'}
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {filteredPublicReviews.map(rev => (
                    <div
                      key={rev.id}
                      className="bg-slate-950/80 border border-slate-800 rounded-2xl p-4 sm:p-5 space-y-3 flex flex-col justify-between"
                    >
                      <div className="space-y-2.5">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="font-black text-sm text-white truncate">{rev.authorName}</div>
                            <div className="flex items-center gap-1.5 flex-wrap text-[11px] text-slate-400 mt-0.5">
                              {rev.authorRole === 'client' && (
                                <span className="inline-flex items-center gap-1 text-red-400 font-bold">
                                  <UserCheck className="w-3 h-3" />
                                  {language === 'ar' ? 'تاجر' : 'Marchand'}
                                </span>
                              )}
                              {rev.authorCity && (
                                <span className="inline-flex items-center gap-1">
                                  <MapPin className="w-3 h-3" />
                                  {rev.authorCity}
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-0.5 shrink-0">
                            {[1, 2, 3, 4, 5].map(s => (
                              <Star
                                key={s}
                                className={`w-3.5 h-3.5 ${
                                  s <= rev.rating ? 'text-amber-400 fill-amber-400' : 'text-slate-700'
                                }`}
                              />
                            ))}
                          </div>
                        </div>

                        <div>
                          <span
                            className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                              rev.targetType === 'driver'
                                ? 'bg-emerald-950/60 text-emerald-300 border-emerald-800/70'
                                : 'bg-red-950/60 text-red-300 border-red-800/70'
                            }`}
                          >
                            {rev.targetType === 'driver' ? (
                              <>
                                <Truck className="w-3 h-3" />
                                <span>
                                  {language === 'ar'
                                    ? `الليفرور: ${rev.driverName || 'موزع'}`
                                    : `Livreur : ${rev.driverName || 'Livreur'}`}
                                </span>
                              </>
                            ) : (
                              <>
                                <Building2 className="w-3 h-3" />
                                <span>{language === 'ar' ? 'رأي فالشركة' : 'Entreprise FARIOUSY'}</span>
                              </>
                            )}
                          </span>
                        </div>

                        <p className="text-xs text-slate-300 leading-relaxed whitespace-pre-line">
                          {rev.comment}
                        </p>

                        {rev.adminReply && (
                          <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-[11px] text-slate-300">
                            <span className="font-bold text-red-400 block mb-0.5">
                              {language === 'ar' ? 'رد إدارة FARIOUSY:' : 'Réponse FARIOUSY :'}
                            </span>
                            {rev.adminReply}
                          </div>
                        )}
                      </div>

                      <div className="text-[10px] text-slate-500 font-mono pt-2 border-t border-slate-800/80 flex items-center justify-between">
                        <span>
                          {new Date(rev.createdAt).toLocaleDateString(language === 'ar' ? 'ar-MA' : 'fr-FR')}
                        </span>
                        {rev.trackingNumber && <span>{rev.trackingNumber}</span>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ----------------- CONTACT & FOOTER ----------------- */}
      <footer id="contact" className="bg-slate-950 border-t border-slate-850 pt-16 pb-12 text-slate-400 text-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 grid grid-cols-1 md:grid-cols-4 gap-8 mb-12">
          {/* Col 1 */}
          <div className="space-y-3 md:col-span-1">
            <div className="flex items-center gap-2.5">
              <img
                src="/fariousy-logo.jpeg"
                alt="Logo"
                className="w-9 h-9 object-contain rounded-full bg-white p-0.5"
              />
              <span className="font-black text-white text-base">FARIOUSY DELIVERY</span>
            </div>
            <p className="text-slate-400 text-xs leading-relaxed">
              {language === 'ar'
                ? 'الشركة المغربية الرائدة في خدمات النقل والتوصيل السريع واللوجستيك الموجه للتجارة الإلكترونية.'
                : 'Société marocaine de messagerie express et logistique intégrée au service du commerce digital.'}
            </p>
            <div className="flex items-center gap-2 pt-1">
              <a
                href={facebookUrl}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Facebook"
                title="Facebook — FARIOUSY"
                className="w-9 h-9 rounded-xl bg-slate-900 hover:bg-[#1877F2] border border-slate-800 hover:border-[#1877F2] text-[#1877F2] hover:text-white flex items-center justify-center transition"
              >
                <FacebookIcon className="w-4 h-4" />
              </a>
              <a
                href={instagramUrl}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Instagram"
                title="Instagram — @fariousy1"
                className="w-9 h-9 rounded-xl bg-slate-900 hover:bg-gradient-to-tr hover:from-[#F58529] hover:via-[#DD2A7B] hover:to-[#8134AF] border border-slate-800 hover:border-pink-500 text-pink-400 hover:text-white flex items-center justify-center transition"
              >
                <InstagramIcon className="w-4 h-4" />
              </a>
            </div>
          </div>

          {/* Col 2 */}
          <div className="space-y-2">
            <span className="font-bold text-white text-xs uppercase tracking-wider block">
              {language === 'ar' ? 'روابط سريعة' : 'Accès Rapide'}
            </span>
            <ul className="space-y-1.5 text-xs">
              <li>
                <button onClick={() => handleOpenAuth('login')} className="hover:text-red-400 transition cursor-pointer">
                  {language === 'ar' ? 'تسجيل الدخول' : 'Se connecter'}
                </button>
              </li>
              <li>
                <button onClick={() => handleOpenAuth('register')} className="hover:text-red-400 transition cursor-pointer">
                  {language === 'ar' ? 'إنشاء حساب كليان' : 'Créer un compte'}
                </button>
              </li>
              <li>
                <button onClick={() => setDriverModalOpen(true)} className="hover:text-red-400 transition cursor-pointer">
                  {language === 'ar' ? 'التسجيل كسائق (ليفرور)' : 'Devenir Livreur'}
                </button>
              </li>
              <li>
                <a href="#tarifs" className="hover:text-red-400 transition">
                  {language === 'ar' ? 'التعريفات والمدن' : 'Tarifs & Villes'}
                </a>
              </li>
            </ul>
          </div>

          {/* Col 3 */}
          <div className="space-y-2">
            <span className="font-bold text-white text-xs uppercase tracking-wider block">
              {language === 'ar' ? 'الفروع والمستودعات' : 'Nos Agences'}
            </span>
            <ul className="space-y-1.5 text-xs text-slate-400">
              <li>🏢 Laâyoune : Siège Principal</li>
              <li>🏢 Casablanca : Hub Central Sidi Maârouf</li>
              <li>🏢 Rabat - Marrakech - Tanger - Agadir</li>
            </ul>
          </div>

          {/* Col 4 */}
          <div className="space-y-2">
            <span className="font-bold text-white text-xs uppercase tracking-wider block">
              {language === 'ar' ? 'تواصل مباشر' : 'Contact Direct'}
            </span>
            <div className="space-y-2">
              <a
                href={formatWaHref(whatsappDisplay)}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-2 text-emerald-400 hover:text-emerald-300 font-bold"
              >
                <MessageCircle className="w-4 h-4 shrink-0" />
                <span>
                  WhatsApp : <span dir="ltr" className="force-ltr font-mono">{whatsappDisplay}</span>
                </span>
              </a>
              <a
                href={formatTelHref(phoneDisplay)}
                className="flex items-center gap-2 text-slate-300 hover:text-white transition"
              >
                <Phone className="w-4 h-4 text-red-500 shrink-0" />
                <span>
                  Fixe : <span dir="ltr" className="force-ltr font-mono">{phoneDisplay}</span>
                </span>
              </a>
              <div className="pt-1 flex items-center gap-2">
                <a
                  href={facebookUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Facebook"
                  className="group inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-[#1877F2] border border-slate-800 hover:border-[#1877F2] text-slate-200 hover:text-white font-bold text-xs transition"
                >
                  <FacebookIcon className="w-3.5 h-3.5 text-[#1877F2] group-hover:text-white transition-colors" />
                  <span>Facebook</span>
                </a>
                <a
                  href={instagramUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Instagram"
                  className="group inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-gradient-to-tr hover:from-[#F58529] hover:via-[#DD2A7B] hover:to-[#8134AF] border border-slate-800 hover:border-pink-500 text-slate-200 hover:text-white font-bold text-xs transition"
                >
                  <InstagramIcon className="w-3.5 h-3.5 text-pink-400 group-hover:text-white transition-colors" />
                  <span>Instagram</span>
                </a>
              </div>
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-6 border-t border-slate-900 flex flex-col sm:flex-row items-center justify-between gap-4 text-[11px] text-slate-500">
          <div>
            © {new Date().getFullYear()} {companySettings?.companyName || 'FARIOUSY DELIVERY SARL'}. {language === 'ar' ? 'جميع الحقوق محفوظة.' : 'Tous droits réservés.'}
          </div>
          <div className="font-mono force-ltr">
            Laâyoune & Casablanca, Maroc
          </div>
        </div>
      </footer>

      {/* ----------------- AUTH MODAL (LOGIN & REGISTER - ZERO DEMO) ----------------- */}
      <AuthModal
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        defaultTab={authDefaultTab}
        onOpenDriverRegister={() => setDriverModalOpen(true)}
      />

      {/* ----------------- DRIVER REGISTRATION MODAL (DEVENIR LIVREUR) ----------------- */}
      <DriverRegisterModal
        isOpen={driverModalOpen}
        onClose={() => setDriverModalOpen(false)}
        onSwitchToLogin={() => {
          setDriverModalOpen(false);
          handleOpenAuth('login');
        }}
      />

      {/* ----------------- PUBLIC TRACKING RESULT MODAL ----------------- */}
      {isTrackingModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-xs">
          <div className="w-full max-w-lg bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90dvh]">
            {/* Modal Header */}
            <div className="shrink-0 px-5 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-850">
              <div className="flex items-center gap-2">
                <Search className="w-4 h-4 text-red-500" />
                <span className="font-black text-sm text-white">
                  {language === 'ar' ? 'التتبع الحي والمباشر للشحنة' : 'Suivi de votre colis en direct'}
                </span>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                  <Radio className="w-2.5 h-2.5 animate-pulse" />
                  <span>LIVE</span>
                </span>
              </div>
              <button
                type="button"
                onClick={() => setIsTrackingModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 min-h-0 p-5 sm:p-6 overflow-y-auto space-y-4">
              {isTrackingLoading && (
                <div className="py-12 text-center text-slate-300 space-y-2">
                  <div className="w-8 h-8 border-3 border-red-500 border-t-transparent rounded-full animate-spin mx-auto" />
                  <p className="text-xs font-bold">
                    {language === 'ar' ? 'جاري استرجاع تفاصيل الشحنة من قاعدة البيانات...' : 'Recherche des détails du colis dans la base...'}
                  </p>
                </div>
              )}

              {trackingError && (
                <div className="p-4 bg-rose-950/60 border border-rose-800 text-rose-200 rounded-xl text-xs flex items-center gap-2.5">
                  <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                  <span>{trackingError}</span>
                </div>
              )}

              {trackingResult && (() => {
                const progress = getTrackingProgressStages(trackingResult.status);
                const statusDisplay = getStatusLabel(trackingResult.status as any) || trackingResult.status;
                return (
                  <div className="space-y-4">
                    {liveUpdateBanner && (
                      <div className="p-3 rounded-xl bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 text-xs font-bold flex items-center gap-2">
                        <Radio className="w-3.5 h-3.5 animate-pulse shrink-0" />
                        <span>{liveUpdateBanner}</span>
                      </div>
                    )}

                    {/* Top Summary Card */}
                    <div className="p-4 rounded-xl bg-slate-800/80 border border-slate-700 space-y-2.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                          Code de Suivi
                        </span>
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-black text-sm text-red-400 force-ltr">
                            {trackingResult.trackingNumber}
                          </span>
                          <button
                            type="button"
                            onClick={async () => {
                              try {
                                await navigator.clipboard.writeText(
                                  buildLiveTrackingUrl(trackingResult.trackingNumber, companySettings?.website)
                                );
                                setCopiedPublicLink(true);
                                setTimeout(() => setCopiedPublicLink(false), 2000);
                              } catch {}
                            }}
                            title="Copier le lien de suivi"
                            className="p-1 rounded-md bg-slate-700/80 hover:bg-slate-600 text-slate-200 cursor-pointer"
                          >
                            {copiedPublicLink ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-1">
                        <span className="text-xs font-bold text-slate-300">
                          {language === 'ar' ? 'حالة الشحنة الحالية :' : 'Statut actuel :'}
                        </span>
                        <span className="px-2.5 py-1 text-xs font-black rounded-lg bg-red-600 text-white">
                          {statusDisplay}
                        </span>
                      </div>

                      {/* 4-Stage Visual Progress Stepper */}
                      <div className="pt-2 space-y-2">
                        <div className="w-full h-1.5 bg-slate-700 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-500 ${
                              progress.isDelivered
                                ? 'bg-emerald-500'
                                : progress.isReturnOrIssue
                                ? 'bg-amber-500'
                                : 'bg-red-500'
                            }`}
                            style={{ width: `${progress.percent}%` }}
                          />
                        </div>
                        <div className="grid grid-cols-4 gap-1.5">
                          {progress.stages.map(stage => (
                            <div key={stage.id} className="text-center space-y-1">
                              <div
                                className={`w-5 h-5 rounded-full mx-auto flex items-center justify-center text-[10px] ${
                                  stage.state === 'completed'
                                    ? 'bg-emerald-500 text-white'
                                    : stage.state === 'current'
                                    ? 'bg-red-500 text-white ring-2 ring-red-400/50'
                                    : stage.state === 'issue'
                                    ? 'bg-amber-500 text-white'
                                    : 'bg-slate-700 text-slate-400'
                                }`}
                              >
                                {stage.state === 'completed' ? (
                                  <Check className="w-3 h-3" />
                                ) : (
                                  <span className="w-1.5 h-1.5 rounded-full bg-current" />
                                )}
                              </div>
                              <div className="text-[10px] font-bold text-slate-200 leading-tight">
                                {language === 'ar' ? stage.labelAr : stage.labelFr}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-700/80 text-xs">
                        <div>
                          <span className="text-[10px] text-slate-400 block">{language === 'ar' ? 'المدينة الوجهة' : 'Ville'}</span>
                          <span className="font-bold text-white">{trackingResult.city}</span>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-400 block">{language === 'ar' ? 'مبلغ الاستخلاص' : 'Montant COD'}</span>
                          <span className="font-bold font-mono text-emerald-400">
                            {trackingResult.codAmount !== undefined ? formatMAD(trackingResult.codAmount) : '—'}
                          </span>
                        </div>
                      </div>

                      {trackingResult.driver && (
                        <div className="pt-2 border-t border-slate-700/80 text-xs text-slate-300 flex items-center justify-between">
                          <span>🚚 {language === 'ar' ? 'السائق المكلف :' : 'Livreur :'} <strong>{trackingResult.driver.name}</strong></span>
                          {trackingResult.driver.phone && (
                            <span className="font-mono text-slate-400 force-ltr">{trackingResult.driver.phone}</span>
                          )}
                        </div>
                      )}
                    </div>

                    {/* History Timeline */}
                    <div className="space-y-2 pt-1">
                      <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">
                        {language === 'ar' ? 'مراحل التوصيل' : 'Historique des étapes'}
                      </span>
                      <div className="space-y-2">
                        {trackingResult.history && trackingResult.history.length > 0 ? (
                          trackingResult.history.map((h: any, idx: number) => (
                            <div key={idx} className="p-2.5 rounded-lg bg-slate-800/50 border border-slate-750 text-xs flex items-start gap-2.5">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 mt-0.5 shrink-0" />
                              <div className="flex-1">
                                <div className="flex items-center justify-between gap-2">
                                  <span className="font-bold text-white">{h.statusLabel || h.status}</span>
                                  <span className="text-[10px] text-slate-400 font-mono">{h.timestamp}</span>
                                </div>
                                {h.comment && <p className="text-[11px] text-slate-400 mt-0.5">{h.comment}</p>}
                              </div>
                            </div>
                          ))
                        ) : (
                          <div className="p-3 bg-slate-800/40 rounded-lg text-slate-400 text-xs">
                            {language === 'ar' ? 'الشحنة مسجلة بالنظام وفي انتظار استكمال مراحل التوصيل.' : 'Colis enregistré, en cours de traitement logistique.'}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* Footer */}
            <div className="shrink-0 p-4 border-t border-slate-800 bg-slate-850 flex items-center justify-between gap-2">
              <a
                href={formatWaHref(whatsappDisplay)}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl transition flex items-center gap-1.5"
              >
                <MessageCircle className="w-3.5 h-3.5" />
                <span>{language === 'ar' ? 'تواصل عبر واتساب' : 'Support WhatsApp'}</span>
              </a>
              <button
                type="button"
                onClick={() => setIsTrackingModalOpen(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs rounded-xl transition cursor-pointer"
              >
                {language === 'ar' ? 'إغلاق' : 'Fermer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
