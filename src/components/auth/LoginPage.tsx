import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useDatabase } from '../../context/DatabaseContext';
import { useLanguage } from '../../i18n/LanguageContext';
import {
  Mail,
  Lock,
  Eye,
  EyeOff,
  Store,
  User,
  Phone,
  MapPin,
  Clock,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  ShieldAlert,
  ArrowLeft,
  Sparkles,
  Info,
  Truck,
  Bike,
  Car,
  ShieldCheck
} from 'lucide-react';
import { DriverRegistrationRequest, DriverVehicleType } from '../../types';
import { KycPhotoUpload } from '../common/KycPhotoUpload';
import { getRememberMePreference } from '../../services/supabase';

interface LoginPageProps {
  onSuccessRedirect?: () => void;
}

export const LoginPage: React.FC<LoginPageProps> = () => {
  const { login, registerBoutiqueUser } = useAuth();
  const { cities, users, submitDriverRegistration } = useDatabase();
  const { language, setLanguage, languages, t, isRtl } = useLanguage();

  // Mode: 'login' | 'register' | 'driver_register' | 'driver_pending' | 'forgot' | 'pending_notice'
  const [mode, setMode] = useState<'login' | 'register' | 'driver_register' | 'driver_pending' | 'forgot' | 'pending_notice'>('login');
  const [targetPortal, setTargetPortal] = useState<'web' | 'driver'>('web');

  // Login form state
  const [email, setEmail] = useState(() => {
    try {
      return typeof window !== 'undefined' ? (localStorage.getItem('fariousy_remembered_identifier') || '') : '';
    } catch {
      return '';
    }
  });
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showRegisterPassword, setShowRegisterPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [showDriverPassword, setShowDriverPassword] = useState(false);
  const [showDriverConfirmPassword, setShowDriverConfirmPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState<boolean>(() => getRememberMePreference());
  const [loginError, setLoginError] = useState<string | null>(null);

  // Driver Register form state (Devenir Livreur)
  const [driverFullName, setDriverFullName] = useState('');
  const [driverPhone, setDriverPhone] = useState('');
  const [driverEmail, setDriverEmail] = useState('');
  const [driverCity, setDriverCity] = useState(cities[0]?.name || 'Casablanca');
  const [driverAddress, setDriverAddress] = useState('');
  const [driverCin, setDriverCin] = useState('');
  const [driverCinPhoto, setDriverCinPhoto] = useState('');
  const [driverCinBackPhoto, setDriverCinBackPhoto] = useState('');
  const [driverPersonalPhoto, setDriverPersonalPhoto] = useState('');
  const [driverVehicleType, setDriverVehicleType] = useState<DriverVehicleType>('Moto');
  const [driverPlate, setDriverPlate] = useState('');
  const [driverPassword, setDriverPassword] = useState('');
  const [driverConfirmPassword, setDriverConfirmPassword] = useState('');
  const [driverRegisterError, setDriverRegisterError] = useState<string | null>(null);
  const [pendingDriverData, setPendingDriverData] = useState<DriverRegistrationRequest | null>(null);

  // Register form state (Section 5: Inscription des clients)
  const [shopName, setShopName] = useState('');
  const [managerName, setManagerName] = useState('');
  const [phone, setPhone] = useState('');
  const [city, setCity] = useState(cities[0]?.name || 'Casablanca');
  const [pickupAddress, setPickupAddress] = useState('');
  const [registerEmail, setRegisterEmail] = useState('');
  const [merchantCin, setMerchantCin] = useState('');
  const [merchantCinPhoto, setMerchantCinPhoto] = useState('');
  const [merchantCinBackPhoto, setMerchantCinBackPhoto] = useState('');
  const [registerPassword, setRegisterPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [registerError, setRegisterError] = useState<string | null>(null);
  const [pendingAccountData, setPendingAccountData] = useState<any | null>(null);

  // Forgot password state
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotSent, setForgotSent] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Handle Login submission (Section 2: Redirection automatique selon le rôle)
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);

    if (!email.trim()) {
      setLoginError('Veuillez saisir votre numéro de téléphone ou votre adresse e-mail.');
      return;
    }

    if (!password) {
      setLoginError('Veuillez saisir votre mot de passe.');
      return;
    }

    setIsLoading(true);
    try {
      const result = await login(email.trim(), password, rememberMe);

      if (!result.success) {
        if (result.accountStatus === 'en_attente' || result.accountStatus === 'pending') {
          setPendingAccountData(result.user);
          setMode('pending_notice');
          return;
        }
        setLoginError(result.error || 'Identifiants incorrects.');
      }
    } catch (err: any) {
      setLoginError(err.message || 'Erreur lors de la tentative de connexion.');
    } finally {
      setIsLoading(false);
    }
  };

  // Handle Registration submission (Section 5: Inscription des clients)
  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setRegisterError(null);

    // Validation des champs obligatoires
    if (
      !shopName.trim() ||
      !managerName.trim() ||
      !phone.trim() ||
      !city.trim() ||
      !pickupAddress.trim() ||
      !registerEmail.trim() ||
      !registerPassword.trim()
    ) {
      setRegisterError('Veuillez remplir tous les champs obligatoires.');
      return;
    }

    if (!merchantCinPhoto) {
      setRegisterError(
        language === 'ar'
          ? 'يرجى إرفاق صورة البطاقة الوطنية (CIN) للتاجر.'
          : 'Veuillez joindre la photo de votre Carte Nationale (CIN) — صورة البطاقة الوطنية.'
      );
      return;
    }

    if (registerPassword !== confirmPassword) {
      setRegisterError('Les mots de passe ne correspondent pas.');
      return;
    }

    if (registerPassword.length < 8) {
      setRegisterError('Le mot de passe doit comporter au moins 8 caractères.');
      return;
    }

    setIsLoading(true);
    try {
      const res = await registerBoutiqueUser({
        shopName: shopName.trim(),
        managerName: managerName.trim(),
        phone: phone.trim(),
        city: city.trim(),
        pickupAddress: pickupAddress.trim(),
        email: registerEmail.trim(),
        password: registerPassword,
        cinNumber: merchantCin.trim() || undefined,
        cinPhotoUrl: merchantCinPhoto,
        cinBackPhotoUrl: merchantCinBackPhoto || undefined
      });

      if (!res.success) {
        setRegisterError(res.error || "Erreur lors de l'inscription.");
        return;
      }

      setPendingAccountData(res.user);
      setMode('pending_notice');
    } catch (err: any) {
      setRegisterError(err.message || "Erreur lors de l'inscription.");
    } finally {
      setIsLoading(false);
    }
  };

  // Handle Driver Registration submission
  const handleDriverRegisterSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setDriverRegisterError(null);

    // Validation
    if (
      !driverFullName.trim() ||
      !driverPhone.trim() ||
      !driverEmail.trim() ||
      !driverCity.trim() ||
      !driverAddress.trim() ||
      !driverCin.trim() ||
      !driverVehicleType ||
      !driverPassword.trim()
    ) {
      setDriverRegisterError(
        language === 'ar'
          ? 'يرجى ملء جميع الحقول الإلزامية.'
          : language === 'en'
          ? 'Please fill in all required fields.'
          : 'Veuillez remplir tous les champs obligatoires.'
      );
      return;
    }

    if (!driverPersonalPhoto) {
      setDriverRegisterError(
        language === 'ar'
          ? 'يرجى إرفاق الصورة الشخصية للسائق.'
          : language === 'en'
          ? 'Please attach your personal photo.'
          : 'Veuillez joindre votre photo personnelle — الصورة الشخصية للسائق.'
      );
      return;
    }

    if (!driverCinPhoto) {
      setDriverRegisterError(
        language === 'ar'
          ? 'يرجى إرفاق صورة البطاقة الوطنية (CIN).'
          : language === 'en'
          ? 'Please attach a photo of your National ID (CIN).'
          : 'Veuillez joindre la photo de votre Carte Nationale (CIN) — صورة البطاقة الوطنية.'
      );
      return;
    }

    if (driverPassword !== driverConfirmPassword) {
      setDriverRegisterError(
        language === 'ar'
          ? 'كلمتا المرور غير متطابقتين.'
          : language === 'en'
          ? 'Passwords do not match.'
          : 'Les mots de passe ne correspondent pas.'
      );
      return;
    }

    if (driverPassword.length < 8) {
      setDriverRegisterError(
        language === 'ar'
          ? 'يجب أن تتكون كلمة المرور من 8 أحرف على الأقل.'
          : language === 'en'
          ? 'Password must be at least 8 characters.'
          : 'Le mot de passe doit comporter au moins 8 caractères.'
      );
      return;
    }

    const res = submitDriverRegistration({
      fullName: driverFullName.trim(),
      phone: driverPhone.trim(),
      email: driverEmail.trim(),
      city: driverCity.trim(),
      address: driverAddress.trim(),
      cinNumber: driverCin.trim(),
      cinPhotoUrl: driverCinPhoto,
      cinBackPhotoUrl: driverCinBackPhoto || undefined,
      driverPhotoUrl: driverPersonalPhoto,
      vehicleType: driverVehicleType,
      driverPlate: driverPlate.trim() || undefined,
      password: driverPassword
    });

    if (!res.success) {
      setDriverRegisterError(res.error || 'Erreur lors de la soumission de la demande.');
      return;
    }

    setPendingDriverData(res.request || null);
    setMode('driver_pending');
  };

  return (
    <div
      className={`min-h-screen w-full bg-[#dc2626] flex items-center justify-center p-3 sm:p-6 lg:p-8 font-sans selection:bg-slate-900 selection:text-white relative ${
        isRtl ? 'font-arabic' : ''
      }`}
      dir={isRtl ? 'rtl' : 'ltr'}
    >
      {/* Compact Language Switcher */}
      <div
        className={`absolute top-4 ${
          isRtl ? 'left-4 sm:left-8' : 'right-4 sm:right-8'
        } z-50 flex items-center gap-0.5 bg-white/20 backdrop-blur-md p-1 rounded-xl border border-white/30 shadow-md`}
      >
        {languages.map(lang => (
          <button
            key={lang.code}
            type="button"
            title={lang.nativeName}
            aria-label={lang.nativeName}
            onClick={() => setLanguage(lang.code)}
            className={`w-8 h-8 flex items-center justify-center rounded-lg text-sm transition-all cursor-pointer ${
              language === lang.code
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-white hover:bg-white/15'
            }`}
          >
            <span>{lang.flag}</span>
          </button>
        ))}
      </div>

      {/* Container matching image layout */}
      <div className="w-full max-w-6xl grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
        {/* ================= LEFT COLUMN: FARIOUSY DELIVERY BRANDING ================= */}
        <div className="lg:col-span-6 text-white space-y-6 px-2 sm:px-6">
          {/* Logo badge matching reference image */}
          <div className="inline-flex items-center gap-3 bg-white/95 text-slate-900 px-4 py-2.5 rounded-2xl shadow-xl backdrop-blur-xs">
            <img
              src="/fariousy-logo.jpeg"
              alt="FARIOUSY DELIVERY"
              className="w-10 h-10 object-contain rounded-xl"
            />
            <div>
              <span className="font-extrabold text-base tracking-tight block leading-none text-slate-900">
                FARIOUSY
              </span>
              <span className="text-[10px] font-black text-red-600 tracking-widest block uppercase">
                {t('nav.brandSubtitle', 'Fast Delivery')}
              </span>
            </div>
          </div>

          {/* Thin horizontal line */}
          <div className="h-px w-full max-w-md bg-white/25" />

          {/* Big headline exact quote from reference image */}
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-white leading-tight tracking-tight">
            {language === 'ar'
              ? 'يمكننا توصيل أي شحنة، في أي وقت، وإلى أي مكان بأقصى سرعة ممكنة.'
              : language === 'en'
              ? 'We can deliver anything, anytime, anywhere as fast as possible.'
              : "Nous pouvons livrer n'importe quoi, à tout moment, n'importe où aussi vite que possible."}
          </h1>

          {/* Subtitle exact quote from reference image */}
          <p className="text-sm sm:text-base text-red-100/90 leading-relaxed max-w-lg font-normal">
            {language === 'ar'
              ? 'نحن شركة رائدة في خدمات التوصيل السريع واللوجستيات بالمغرب. سجّل الآن وابدأ إرسال منتجاتك لزبنائك بأمان وسرعة فائقة.'
              : language === 'en'
              ? 'We are a logistics delivery company in Morocco. Register easily and start shipping your products to your customers quickly and safely.'
              : 'Nous sommes une entreprise de livraison au Maroc. Inscrivez-vous simplement et commencez à envoyer vos produits à vos clients rapidement et en toute sécurité.'}
          </p>

          {/* Decorative Dot Matrix from reference image */}
          <div className="pt-4 flex flex-col gap-1.5 opacity-80" aria-hidden="true">
            <div className="flex gap-2">
              <span className="w-2 h-2 rounded-full bg-white/90" />
              <span className="w-2 h-2 rounded-full bg-white/90" />
              <span className="w-2 h-2 rounded-full bg-white/90" />
              <span className="w-2 h-2 rounded-full bg-white/90" />
              <span className="w-2 h-2 rounded-full bg-white/90" />
            </div>
            <div className="flex gap-2">
              <span className="w-2 h-2 rounded-full bg-white/90" />
              <span className="w-2 h-2 rounded-full bg-white/90" />
              <span className="w-2 h-2 rounded-full bg-white/90" />
              <span className="w-2 h-2 rounded-full bg-white/90" />
              <span className="w-2 h-2 rounded-full bg-white/90" />
            </div>
          </div>
        </div>

        {/* ================= RIGHT COLUMN: WHITE FORM CARD ================= */}
        <div className="lg:col-span-6 flex justify-center">
          <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl p-6 sm:p-8 md:p-10 text-slate-800 transition-all duration-200">
            {/* Quick Portal Switcher */}
            <div className="flex bg-slate-100 p-1 rounded-2xl mb-5 text-xs font-bold">
              <button
                type="button"
                onClick={() => setTargetPortal('web')}
                className={`flex-1 py-2 rounded-xl transition-all ${
                  targetPortal === 'web'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                🌐 {language === 'ar' ? 'البوابة الإلكترونية' : language === 'en' ? 'Web Portal' : 'Portail Web'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setTargetPortal('driver');
                }}
                className={`flex-1 py-2 rounded-xl transition-all ${
                  targetPortal === 'driver'
                    ? 'bg-red-600 text-white shadow-xs'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                📱 {t('nav.driverApp')}
              </button>
            </div>

            {/* ----------------- MODE 1: SE CONNECTER ----------------- */}
            {mode === 'login' && (
              <div className="space-y-5">
                <div>
                  <div className="flex items-center justify-between">
                    <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
                      {t('login.signIn')}
                    </h2>
                    {targetPortal === 'driver' && (
                      <span className="text-[10px] font-black uppercase tracking-wider bg-red-100 text-red-700 px-2 py-0.5 rounded-full">
                        {t('sidebar.driverSpace')}
                      </span>
                    )}
                  </div>
                  <p className="text-xs sm:text-sm text-slate-500 mt-1.5">
                    {targetPortal === 'driver' ? (
                      <span>{t('driverSpace.title')}</span>
                    ) : (
                      <>
                        {t('login.noAccount')}{' '}
                        <button
                          type="button"
                          onClick={() => {
                            setMode('register');
                            setRegisterError(null);
                          }}
                          className="text-red-600 font-bold hover:underline cursor-pointer"
                        >
                          {t('login.register')}
                        </button>
                      </>
                    )}
                  </p>
                </div>

                {loginError && (
                  <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                    <span>{loginError}</span>
                  </div>
                )}

                <form onSubmit={handleLoginSubmit} className="space-y-4">
                  {/* Email input */}
                  <div>
                    <label className="sr-only" htmlFor="login-email">
                      {t('login.email', 'Email ou Téléphone')}
                    </label>
                    <input
                      id="login-email"
                      type="text"
                      autoComplete="username"
                      required
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      placeholder={t('login.emailPlaceholder', 'Téléphone ou Email (ex: 06 12 34 56 78)')}
                      className="w-full px-4 py-3 text-sm bg-slate-50/80 border border-slate-200 rounded-xl text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-colors force-ltr"
                    />
                  </div>

                  {/* Password input */}
                  <div className="relative">
                    <label className="sr-only" htmlFor="login-password">
                      {t('login.password')}
                    </label>
                    <input
                      id="login-password"
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      placeholder={t('login.password')}
                      className={`w-full ${isRtl ? 'pl-12 pr-4' : 'pr-12 pl-4'} py-3 text-sm bg-slate-50/80 border border-slate-200 rounded-xl text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-colors`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className={`absolute ${isRtl ? 'left-3' : 'right-3'} top-1/2 -translate-y-1/2 p-2 text-slate-400 hover:text-slate-800 hover:bg-slate-200/60 rounded-xl transition-all cursor-pointer`}
                      aria-label="Afficher ou masquer le mot de passe"
                      title={showPassword ? 'إخفاء الرمز السري' : 'إظهار الرمز السري'}
                    >
                      {showPassword ? (
                        <EyeOff className="w-5 h-5 text-red-600" />
                      ) : (
                        <Eye className="w-5 h-5 text-slate-500 hover:text-slate-800" />
                      )}
                    </button>
                  </div>

                  {/* Checkbox: Rester connecté */}
                  <div className="flex items-center">
                    <label className="flex items-center gap-2 cursor-pointer text-xs text-red-600 font-medium select-none">
                      <input
                        type="checkbox"
                        checked={rememberMe}
                        onChange={e => setRememberMe(e.target.checked)}
                        className="w-4 h-4 rounded-sm border-slate-300 text-red-600 focus:ring-red-500 accent-red-600"
                      />
                      <span>{t('login.rememberMe')}</span>
                    </label>
                  </div>

                  {/* Bouton Connectez-vous maintenant */}
                  <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full py-3.5 px-4 bg-[#dc2626] hover:bg-[#b91c1c] active:bg-[#991b1b] text-white font-bold text-sm rounded-xl shadow-md hover:shadow-lg transition-all duration-150 cursor-pointer text-center disabled:opacity-60 flex items-center justify-center gap-2"
                  >
                    {isLoading ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        <span>Connexion en cours...</span>
                      </>
                    ) : (
                      <span>{t('login.signIn')}</span>
                    )}
                  </button>

                  {/* Lien Mot de passe oublié */}
                  <div className={isRtl ? 'text-left' : 'text-right'}>
                    <button
                      type="button"
                      onClick={() => setMode('forgot')}
                      className="text-xs text-red-600 hover:underline cursor-pointer font-medium"
                    >
                      {t('login.forgotPassword')}
                    </button>
                  </div>

                  {/* Bouton Public : Devenir Livreur */}
                  <div className="pt-2 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => {
                        setMode('driver_register');
                        setDriverRegisterError(null);
                      }}
                      className="w-full py-2.5 px-3 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer border border-slate-700"
                    >
                      <span className="text-base">🛵</span>
                      <span>
                        {language === 'ar'
                          ? 'انضم إلينا كموزع — قدّم طلبك الآن'
                          : language === 'en'
                          ? 'Become a Driver — Apply Now'
                          : 'Devenir Livreur FARIOUSY — Postuler'}
                      </span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </form>

                {/* Social links exact quote from reference image */}
                <div className="pt-4 border-t border-slate-100 text-center space-y-3">
                  <p className="text-xs text-slate-500">
                    Vous pouvez visiter notre{' '}
                    <span className="text-red-600 font-semibold underline cursor-pointer">
                      site web
                    </span>{' '}
                    et nos réseaux sociaux sur
                  </p>
                  <div className="flex items-center justify-center gap-3">
                    {/* Instagram badge */}
                    <a
                      href="#instagram"
                      onClick={e => e.preventDefault()}
                      title="Suivez FARIOUSY DELIVERY sur Instagram"
                      className="w-9 h-9 rounded-xl border border-red-200 bg-red-50 text-red-600 flex items-center justify-center hover:scale-105 transition-transform"
                    >
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
                      </svg>
                    </a>
                    {/* Facebook badge */}
                    <a
                      href="#facebook"
                      onClick={e => e.preventDefault()}
                      title="Rejoignez notre communauté Facebook"
                      className="w-9 h-9 rounded-xl border border-blue-200 bg-blue-50 text-blue-600 flex items-center justify-center hover:scale-105 transition-transform"
                    >
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M9 8h-3v4h3v12h5v-12h3.642l.358-4h-4v-1.667c0-.955.192-1.333 1.115-1.333h2.885v-5h-3.808c-3.596 0-5.192 1.583-5.192 4.615v3.385z" />
                      </svg>
                    </a>
                  </div>
                </div>
              </div>
            )}

            {/* ----------------- MODE 2: S'INSCRIRE (Section 5: Inscription des clients) ----------------- */}
            {mode === 'register' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
                      S'inscrire
                    </h2>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Créez votre compte boutique marchande
                    </p>
                  </div>
                </div>

                {registerError && (
                  <div className="p-2.5 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                    <span>{registerError}</span>
                  </div>
                )}

                <form onSubmit={handleRegisterSubmit} className="space-y-3">
                  {/* Nom de la boutique */}
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
                        placeholder="Ex: Mode & Style Maroc"
                        className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-500"
                      />
                    </div>
                  </div>

                  {/* Nom du responsable */}
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      Nom du responsable *
                    </label>
                    <div className="relative">
                      <User className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        type="text"
                        required
                        value={managerName}
                        onChange={e => setManagerName(e.target.value)}
                        placeholder="Ex: Tariq Mansouri"
                        className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-500"
                      />
                    </div>
                  </div>

                  {/* Numéro de téléphone & Ville */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">
                        Numéro de téléphone *
                      </label>
                      <div className="relative">
                        <Phone className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                          type="tel"
                          required
                          value={phone}
                          onChange={e => setPhone(e.target.value)}
                          placeholder="06 61 00 00 00"
                          className="w-full pl-9 pr-3 py-2 text-xs font-mono bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-500"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">
                        Ville *
                      </label>
                      <div className="relative">
                        <MapPin className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                        <select
                          value={city}
                          onChange={e => setCity(e.target.value)}
                          className="w-full pl-9 pr-3 py-2 text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-500"
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

                  {/* Adresse de ramassage */}
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      Adresse complète de ramassage *
                    </label>
                    <textarea
                      rows={2}
                      required
                      value={pickupAddress}
                      onChange={e => setPickupAddress(e.target.value)}
                      placeholder="Quartier, rue, numéro de local ou point de départ des colis..."
                      className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-500"
                    />
                  </div>

                  {/* Email */}
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      Email *
                    </label>
                    <div className="relative">
                      <Mail className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        type="email"
                        required
                        value={registerEmail}
                        onChange={e => setRegisterEmail(e.target.value)}
                        placeholder="contact@boutique.ma"
                        className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-500"
                      />
                    </div>
                  </div>

                  {/* Carte Nationale (CIN) — صورة البطاقة الوطنية للتاجر */}
                  <div className="p-3 bg-slate-50/80 border border-slate-200 rounded-2xl space-y-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] font-black text-slate-800 flex items-center gap-1.5">
                        <ShieldCheck className="w-3.5 h-3.5 text-red-600" />
                        <span>البطاقة الوطنية (CIN) — Carte Nationale</span>
                      </span>
                      <input
                        type="text"
                        value={merchantCin}
                        onChange={e => setMerchantCin(e.target.value.toUpperCase())}
                        placeholder="N° CIN (اختياري)"
                        className="w-32 px-2.5 py-1 text-[11px] font-mono uppercase bg-white border border-slate-200 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-red-500"
                      />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      <KycPhotoUpload
                        label="صورة البطاقة الوطنية (الوجه الأمامي)"
                        sublabel="Recto CIN (إلزامي)"
                        value={merchantCinPhoto}
                        onChange={setMerchantCinPhoto}
                        required
                        variant="id_card"
                        captureMode="environment"
                      />
                      <KycPhotoUpload
                        label="صورة البطاقة الوطنية (الظهر)"
                        sublabel="Verso CIN (اختياري)"
                        value={merchantCinBackPhoto}
                        onChange={setMerchantCinBackPhoto}
                        variant="id_card"
                        captureMode="environment"
                      />
                    </div>
                  </div>

                  {/* Mot de passe & Confirmation */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">
                        Mot de passe *
                      </label>
                      <div className="relative">
                        <input
                          type={showRegisterPassword ? 'text' : 'password'}
                          required
                          value={registerPassword}
                          onChange={e => setRegisterPassword(e.target.value)}
                          placeholder="••••••••"
                          className={`w-full ${isRtl ? 'pl-9 pr-3' : 'pr-9 pl-3'} py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-500`}
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
                        Confirmation *
                      </label>
                      <div className="relative">
                        <input
                          type={showConfirmPassword ? 'text' : 'password'}
                          required
                          value={confirmPassword}
                          onChange={e => setConfirmPassword(e.target.value)}
                          placeholder="••••••••"
                          className={`w-full ${isRtl ? 'pl-9 pr-3' : 'pr-9 pl-3'} py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-500`}
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

                  {/* Info notice about admin review */}
                  <div className="p-2.5 bg-amber-50/80 border border-amber-200 rounded-xl text-[11px] text-amber-900 flex items-start gap-2">
                    <Info className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                    <span>
                      Après inscription, votre compte aura le statut{' '}
                      <strong>« En attente de validation »</strong> par l'administrateur avant de
                      pouvoir vous connecter.
                    </span>
                  </div>

                  {/* Submit button */}
                  <button
                    type="submit"
                    className="w-full py-3 bg-[#dc2626] hover:bg-[#b91c1c] text-white font-bold text-xs rounded-xl shadow-md transition-all cursor-pointer flex items-center justify-center gap-2"
                  >
                    <span>Envoyer ma demande d'inscription</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>

                  <div className="text-center pt-1 text-xs text-slate-500">
                    Vous avez déjà un compte ?{' '}
                    <button
                      type="button"
                      onClick={() => setMode('login')}
                      className="text-red-600 font-bold hover:underline cursor-pointer"
                    >
                      Se connecter
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* ----------------- MODE: DEVENIR LIVREUR (INSCRIPTION LIVREUR) ----------------- */}
            {mode === 'driver_register' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => setMode('login')}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors flex items-center gap-1 text-xs font-semibold cursor-pointer"
                  >
                    <ArrowLeft className={`w-3.5 h-3.5 ${isRtl ? 'rotate-180' : ''}`} />
                    <span>{t('login.backToLogin', 'Retour')}</span>
                  </button>
                </div>

                <div>
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-red-100 text-red-700 text-[10px] font-black uppercase tracking-wider mb-1.5">
                    <Truck className="w-3 h-3" />
                    <span>{t('driverRegister.badge', 'Recrutement Livreurs')}</span>
                  </div>
                  <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                    {t('driverRegister.title', 'Devenir Livreur')}
                  </h2>
                  <p className="text-xs text-slate-500 mt-1">
                    {t('driverRegister.subtitle', 'Rejoignez la flotte logistique de distribution FARIOUSY DELIVERY.')}
                  </p>
                </div>

                {driverRegisterError && (
                  <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                    <span>{driverRegisterError}</span>
                  </div>
                )}

                <form onSubmit={handleDriverRegisterSubmit} className="space-y-3">
                  {/* Nom complet */}
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      {t('driverRegister.fullName', 'Nom complet')} *
                    </label>
                    <div className="relative">
                      <User className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                      <input
                        type="text"
                        required
                        value={driverFullName}
                        onChange={e => setDriverFullName(e.target.value)}
                        placeholder="Ex : Mehdi Benkirane"
                        className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-500"
                      />
                    </div>
                  </div>

                  {/* Téléphone & Email */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">
                        {t('driverRegister.phone', 'Numéro de téléphone')} *
                      </label>
                      <div className="relative">
                        <Phone className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                        <input
                          type="tel"
                          required
                          value={driverPhone}
                          onChange={e => setDriverPhone(e.target.value)}
                          placeholder="0661000000"
                          className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-500 force-ltr"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">
                        {t('driverRegister.email', 'Adresse e-mail')} *
                      </label>
                      <div className="relative">
                        <Mail className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                        <input
                          type="email"
                          required
                          value={driverEmail}
                          onChange={e => setDriverEmail(e.target.value)}
                          placeholder="mehdi@email.com"
                          className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-500 force-ltr"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Ville & CIN */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">
                        {t('driverRegister.city', 'Ville')} *
                      </label>
                      <div className="relative">
                        <MapPin className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                        <select
                          value={driverCity}
                          onChange={e => setDriverCity(e.target.value)}
                          className="w-full pl-9 pr-3 py-2 text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-500"
                        >
                          {cities.map(c => (
                            <option key={c.id} value={c.name}>
                              {c.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">
                        {t('driverRegister.cin', 'Numéro CIN')} *
                      </label>
                      <div className="relative">
                        <ShieldCheck className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                        <input
                          type="text"
                          required
                          value={driverCin}
                          onChange={e => setDriverCin(e.target.value.toUpperCase())}
                          placeholder="Ex : BK123456"
                          className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-500 uppercase font-mono"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Adresse de résidence */}
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      {t('driverRegister.address', 'Adresse de résidence')} *
                    </label>
                    <input
                      type="text"
                      required
                      value={driverAddress}
                      onChange={e => setDriverAddress(e.target.value)}
                      placeholder="Quartier, Boulevard, N° Immeuble / Rue"
                      className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-500"
                    />
                  </div>

                  {/* Type de véhicule (Cards Selector) */}
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1.5">
                      {t('driverRegister.vehicleType', 'Type de véhicule')} *
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      <button
                        type="button"
                        onClick={() => setDriverVehicleType('Moto')}
                        className={`p-2.5 rounded-xl border flex flex-col items-center gap-1 transition-all text-xs font-bold cursor-pointer ${
                          driverVehicleType === 'Moto'
                            ? 'bg-amber-50 border-amber-500 text-amber-900 shadow-xs ring-2 ring-amber-400/50'
                            : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                        }`}
                      >
                        <span className="text-xl">🛵</span>
                        <span>{t('driverRegister.moto', 'Moto')}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setDriverVehicleType('Voiture')}
                        className={`p-2.5 rounded-xl border flex flex-col items-center gap-1 transition-all text-xs font-bold cursor-pointer ${
                          driverVehicleType === 'Voiture'
                            ? 'bg-blue-50 border-blue-500 text-blue-900 shadow-xs ring-2 ring-blue-400/50'
                            : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                        }`}
                      >
                        <span className="text-xl">🚗</span>
                        <span>{t('driverRegister.car', 'Voiture')}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setDriverVehicleType('Vélo')}
                        className={`p-2.5 rounded-xl border flex flex-col items-center gap-1 transition-all text-xs font-bold cursor-pointer ${
                          driverVehicleType === 'Vélo'
                            ? 'bg-emerald-50 border-emerald-500 text-emerald-900 shadow-xs ring-2 ring-emerald-400/50'
                            : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                        }`}
                      >
                        <span className="text-xl">🚲</span>
                        <span>{t('driverRegister.bike', 'Vélo')}</span>
                      </button>
                    </div>
                  </div>

                  {/* Immatriculation */}
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      {t('driverRegister.plate', 'Immatriculation du véhicule')}
                      {driverVehicleType === 'Vélo' ? (
                        <span className="text-slate-400 font-normal ml-1">
                          {t('driverRegister.plateHint', '(Optionnel pour vélo)')}
                        </span>
                      ) : (
                        <span className="text-red-500 ml-0.5">*</span>
                      )}
                    </label>
                    <input
                      type="text"
                      required={driverVehicleType !== 'Vélo'}
                      value={driverPlate}
                      onChange={e => setDriverPlate(e.target.value)}
                      placeholder={t('driverRegister.platePlaceholder', 'Ex : 12345-A-26')}
                      className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-500 font-mono force-ltr"
                    />
                  </div>

                  {/* Documents du Livreur : Photo Personnelle + Carte Nationale CIN */}
                  <div className="p-3 bg-slate-50/80 border border-slate-200 rounded-2xl space-y-2.5">
                    <div className="flex items-center gap-1.5 text-[11px] font-black text-slate-800">
                      <ShieldCheck className="w-3.5 h-3.5 text-red-600" />
                      <span>الوثائق المطلوبة للموزع — Photo & Carte Nationale (CIN)</span>
                    </div>

                    <KycPhotoUpload
                      label="الصورة الشخصية للسائق (Photo personnelle)"
                      sublabel="صورة واضحة لوجه السائق — إلزامي"
                      value={driverPersonalPhoto}
                      onChange={setDriverPersonalPhoto}
                      required
                      variant="portrait"
                      captureMode="user"
                    />

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      <KycPhotoUpload
                        label="صورة لاكارط ناسيونال (الأمام)"
                        sublabel="CIN Recto — إلزامي"
                        value={driverCinPhoto}
                        onChange={setDriverCinPhoto}
                        required
                        variant="id_card"
                        captureMode="environment"
                      />
                      <KycPhotoUpload
                        label="صورة لاكارط ناسيونال (الخلف)"
                        sublabel="CIN Verso — اختياري"
                        value={driverCinBackPhoto}
                        onChange={setDriverCinBackPhoto}
                        variant="id_card"
                        captureMode="environment"
                      />
                    </div>
                  </div>

                  {/* Mot de passe & Confirmation */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">
                        {t('driverRegister.password', 'Mot de passe')} *
                      </label>
                      <div className="relative">
                        <input
                          type={showDriverPassword ? 'text' : 'password'}
                          required
                          value={driverPassword}
                          onChange={e => setDriverPassword(e.target.value)}
                          placeholder="••••••••"
                          className={`w-full ${isRtl ? 'pl-9 pr-3' : 'pr-9 pl-3'} py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-500`}
                        />
                        <button
                          type="button"
                          onClick={() => setShowDriverPassword(!showDriverPassword)}
                          className={`absolute ${isRtl ? 'left-2' : 'right-2'} top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-700 rounded-md transition cursor-pointer`}
                          title={showDriverPassword ? 'إخفاء' : 'إظهار'}
                        >
                          {showDriverPassword ? <EyeOff className="w-3.5 h-3.5 text-red-600" /> : <Eye className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">
                        {t('driverRegister.confirmPassword', 'Confirmation')} *
                      </label>
                      <div className="relative">
                        <input
                          type={showDriverConfirmPassword ? 'text' : 'password'}
                          required
                          value={driverConfirmPassword}
                          onChange={e => setDriverConfirmPassword(e.target.value)}
                          placeholder="••••••••"
                          className={`w-full ${isRtl ? 'pl-9 pr-3' : 'pr-9 pl-3'} py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-500`}
                        />
                        <button
                          type="button"
                          onClick={() => setShowDriverConfirmPassword(!showDriverConfirmPassword)}
                          className={`absolute ${isRtl ? 'left-2' : 'right-2'} top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-700 rounded-md transition cursor-pointer`}
                          title={showDriverConfirmPassword ? 'إخفاء' : 'إظهار'}
                        >
                          {showDriverConfirmPassword ? <EyeOff className="w-3.5 h-3.5 text-red-600" /> : <Eye className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Notice de validation */}
                  <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl flex items-start gap-2 text-[11px] text-slate-600">
                    <Info className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                    <span>
                      {language === 'ar'
                        ? 'بعد إرسال طلبك، سيتم تسجيل ملفك في حالة "قيد المراجعة" ولن تتمكن من تسجيل الدخول حتى تتم المصادقة عليه من طرف الإدارة.'
                        : "Après soumission, votre candidature sera placée « En attente de validation ». L'accès à l'App Livreur sera activé après approbation par l'administration."}
                    </span>
                  </div>

                  {/* Submit Button */}
                  <button
                    type="submit"
                    className="w-full py-3 bg-[#dc2626] hover:bg-[#b91c1c] text-white font-bold text-xs rounded-xl shadow-md transition-all cursor-pointer flex items-center justify-center gap-2"
                  >
                    <span>{t('driverRegister.submit', 'Envoyer ma demande')}</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>

                  <div className="text-center pt-1 text-xs text-slate-500">
                    {t('driverRegister.alreadyHaveAccount', 'Vous avez déjà un compte ?')}{' '}
                    <button
                      type="button"
                      onClick={() => setMode('login')}
                      className="text-red-600 font-bold hover:underline cursor-pointer"
                    >
                      {t('login.signIn', 'Se connecter')}
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* ----------------- MODE: CANDIDATURE LIVREUR EN ATTENTE ----------------- */}
            {mode === 'driver_pending' && pendingDriverData && (
              <div className="space-y-5 text-center py-2 animate-scaleUp">
                <div className="w-16 h-16 mx-auto bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center shadow-xs">
                  <Clock className="w-8 h-8 animate-pulse text-amber-600" />
                </div>

                <div>
                  <span className="inline-block px-3 py-1 bg-amber-100 text-amber-900 rounded-full text-[10px] font-black uppercase tracking-wider mb-2">
                    {t('driverRegister.pendingStatus', 'Statut : En attente de validation')}
                  </span>
                  <h3 className="text-xl font-black text-slate-900">
                    {t('driverRegister.pendingTitle', 'Candidature enregistrée !')}
                  </h3>
                  <p className="text-xs text-slate-600 max-w-sm mx-auto mt-2 leading-relaxed">
                    Merci pour votre candidature, <strong className="text-slate-900">{pendingDriverData.fullName}</strong>. Votre dossier a bien été transmis à l'administration de <strong>FARIOUSY DELIVERY</strong>.
                  </p>
                </div>

                {/* Recap card */}
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl text-xs text-left space-y-2 max-w-sm mx-auto">
                  {pendingDriverData.driverPhotoUrl && (
                    <div className="flex items-center gap-3 pb-2 border-b border-slate-200">
                      <img
                        src={pendingDriverData.driverPhotoUrl}
                        alt={pendingDriverData.fullName}
                        className="w-11 h-11 rounded-full object-cover border-2 border-white shadow-xs"
                      />
                      <div>
                        <span className="text-[11px] font-bold text-emerald-700 block">
                          ✓ الوثائق والصور مرفقة (CIN + صورة شخصية)
                        </span>
                        <span className="text-[10px] text-slate-500">قيد التحقق من طرف الإدارة</span>
                      </div>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-slate-500">Candidat :</span>
                    <strong className="text-slate-900">{pendingDriverData.fullName}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">CIN :</span>
                    <span className="font-mono font-bold text-slate-800">{pendingDriverData.cinNumber}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Véhicule :</span>
                    <span className="font-semibold text-slate-800">
                      {pendingDriverData.vehicleType} {pendingDriverData.driverPlate ? `(${pendingDriverData.driverPlate})` : ''}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Ville :</span>
                    <span className="text-slate-800">{pendingDriverData.city}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Téléphone :</span>
                    <span className="font-mono text-slate-800 force-ltr">{pendingDriverData.phone}</span>
                  </div>
                </div>

                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-[11px] text-left max-w-sm mx-auto flex items-start gap-2">
                  <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <span>
                    {t(
                      'driverRegister.pendingBlocked',
                      "L'accès à l'application mobile Livreur reste bloqué tant que votre dossier n'a pas été validé par la direction."
                    )}
                  </span>
                </div>

                <div className="space-y-2 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setMode('login');
                      setEmail(pendingDriverData.email || '');
                    }}
                    className="w-full py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs rounded-xl transition-colors cursor-pointer"
                  >
                    Retour à la page de connexion
                  </button>
                </div>
              </div>
            )}

            {/* ----------------- MODE 3: COMPTE EN ATTENTE DE VALIDATION ----------------- */}
            {mode === 'pending_notice' && pendingAccountData && (
              <div className="space-y-5 text-center py-2">
                <div className="w-16 h-16 mx-auto bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center shadow-xs">
                  <Clock className="w-8 h-8 animate-pulse text-amber-600" />
                </div>

                <div>
                  <span className="inline-block px-3 py-1 bg-amber-100 text-amber-900 rounded-full text-[10px] font-black uppercase tracking-wider mb-2">
                    Statut : En attente de validation
                  </span>
                  <h3 className="text-xl font-black text-slate-900">
                    Demande d'inscription enregistrée
                  </h3>
                  <p className="text-xs text-slate-600 max-w-sm mx-auto mt-2 leading-relaxed">
                    Votre demande pour la boutique{' '}
                    <strong className="text-slate-900">
                      {pendingAccountData.companyName || pendingAccountData.name}
                    </strong>{' '}
                    a bien été envoyée à l'administrateur de <strong>FARIOUSY DELIVERY</strong>.
                  </p>
                </div>

                {/* Account details recap */}
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl text-xs text-left space-y-1.5 max-w-sm mx-auto">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Boutique :</span>
                    <strong className="text-slate-900">{pendingAccountData.companyName}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Responsable :</span>
                    <span className="text-slate-800">{pendingAccountData.name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Ville :</span>
                    <span className="text-slate-800">{pendingAccountData.city}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Email :</span>
                    <span className="text-slate-800 font-mono text-[11px] truncate max-w-[170px]">
                      {pendingAccountData.email}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Téléphone :</span>
                    <span className="text-slate-800 font-mono">{pendingAccountData.phone}</span>
                  </div>
                </div>

                <p className="text-[11px] text-slate-400">
                  L'administrateur examine votre demande. Une fois approuvée, vous pourrez vous
                  connecter avec votre email et mot de passe.
                </p>

                <div className="space-y-2 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setMode('login');
                      setEmail(pendingAccountData.email || '');
                    }}
                    className="w-full py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs rounded-xl transition-colors cursor-pointer"
                  >
                    Retour à la page de connexion
                  </button>
                </div>
              </div>
            )}

            {/* ----------------- MODE 4: MOT DE PASSE OUBLIÉ ----------------- */}
            {mode === 'forgot' && (
              <div className="space-y-5">
                <button
                  type="button"
                  onClick={() => setMode('login')}
                  className="flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-slate-800 transition-colors"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Retour à la connexion</span>
                </button>

                <div>
                  <h2 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
                    Mot de passe oublié
                  </h2>
                  <p className="text-xs text-slate-500 mt-1">
                    Saisissez votre adresse e-mail pour réinitialiser votre accès
                  </p>
                </div>

                {forgotSent ? (
                  <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl text-center space-y-3">
                    <CheckCircle2 className="w-10 h-10 text-emerald-600 mx-auto" />
                    <p className="text-xs font-bold text-emerald-900">
                      Instructions envoyées à {forgotEmail}
                    </p>
                    <p className="text-[11px] text-emerald-700">
                      Vérifiez votre boîte de réception pour définir un nouveau mot de passe.
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        setForgotSent(false);
                        setMode('login');
                      }}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl transition-colors"
                    >
                      Retour à la connexion
                    </button>
                  </div>
                ) : (
                  <form
                    onSubmit={e => {
                      e.preventDefault();
                      if (forgotEmail) setForgotSent(true);
                    }}
                    className="space-y-4"
                  >
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Adresse e-mail de votre compte
                      </label>
                      <input
                        type="email"
                        required
                        value={forgotEmail}
                        onChange={e => setForgotEmail(e.target.value)}
                        placeholder="contact@boutique.ma"
                        className="w-full px-4 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-500"
                      />
                    </div>

                    <button
                      type="submit"
                      className="w-full py-3 bg-[#dc2626] hover:bg-[#b91c1c] text-white font-bold text-xs rounded-xl shadow-md transition-all cursor-pointer"
                    >
                      Envoyer le lien de réinitialisation
                    </button>
                  </form>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
