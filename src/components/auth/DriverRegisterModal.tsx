import React, { useState, useEffect } from 'react';
import { useDatabase } from '../../context/DatabaseContext';
import { useLanguage } from '../../i18n/LanguageContext';
import { DriverRegistrationRequest, DriverVehicleType } from '../../types';
import { KycPhotoUpload } from '../common/KycPhotoUpload';
import {
  Truck,
  User,
  Phone,
  Mail,
  MapPin,
  ShieldCheck,
  Eye,
  EyeOff,
  Clock,
  AlertCircle,
  ArrowRight,
  X
} from 'lucide-react';

interface DriverRegisterModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSwitchToLogin?: () => void;
}

const VEHICLE_OPTIONS: { type: DriverVehicleType; labelAr: string; labelFr: string; emoji: string }[] = [
  { type: 'Moto', labelAr: 'موطو (دراجة نارية)', labelFr: 'Moto', emoji: '🛵' },
  { type: 'Voiture', labelAr: 'سيارة', labelFr: 'Voiture', emoji: '🚗' },
  { type: 'Fourgonnette', labelAr: 'فوركونيط', labelFr: 'Fourgonnette', emoji: '🚐' },
  { type: 'Vélo', labelAr: 'بيكالا', labelFr: 'Vélo', emoji: '🚲' }
];

export const DriverRegisterModal: React.FC<DriverRegisterModalProps> = ({
  isOpen,
  onClose,
  onSwitchToLogin
}) => {
  const { cities, submitDriverRegistration } = useDatabase();
  const { language, isRtl } = useLanguage();
  const isAr = language === 'ar';

  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [city, setCity] = useState(cities[0]?.name || 'Casablanca');
  const [address, setAddress] = useState('');
  const [cinNumber, setCinNumber] = useState('');
  const [driverPhotoUrl, setDriverPhotoUrl] = useState('');
  const [cinPhotoUrl, setCinPhotoUrl] = useState('');
  const [cinBackPhotoUrl, setCinBackPhotoUrl] = useState('');
  const [vehicleType, setVehicleType] = useState<DriverVehicleType>('Moto');
  const [driverPlate, setDriverPlate] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submittedRequest, setSubmittedRequest] = useState<DriverRegistrationRequest | null>(null);

  useEffect(() => {
    if (isOpen) {
      setError(null);
      if (!city && cities.length > 0) {
        setCity(cities[0].name);
      }
    }
  }, [isOpen, cities]);

  if (!isOpen) return null;

  const resetAndClose = () => {
    setSubmittedRequest(null);
    setError(null);
    onClose();
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!fullName.trim() || !phone.trim() || !email.trim() || !city.trim() || !address.trim() || !cinNumber.trim()) {
      setError(
        isAr
          ? 'يرجى ملء جميع الخانات الإلزامية.'
          : 'Veuillez remplir tous les champs obligatoires.'
      );
      return;
    }

    if (vehicleType !== 'Vélo' && !driverPlate.trim()) {
      setError(
        isAr
          ? 'يرجى إدخال رقم لوحة المركبة (Matricule).'
          : "Veuillez saisir l'immatriculation de votre véhicule."
      );
      return;
    }

    if (!driverPhotoUrl) {
      setError(
        isAr
          ? 'يرجى إرفاق الصورة الشخصية للسائق.'
          : 'Veuillez joindre votre photo personnelle.'
      );
      return;
    }

    if (!cinPhotoUrl) {
      setError(
        isAr
          ? 'يرجى إرفاق صورة البطاقة الوطنية (الوجه الأمامي).'
          : 'Veuillez joindre la photo recto de votre Carte Nationale (CIN).'
      );
      return;
    }

    if (!password || password.length < 6) {
      setError(
        isAr
          ? 'كلمة السر يجب أن تتكون من 6 أحرف على الأقل.'
          : 'Le mot de passe doit contenir au moins 6 caractères.'
      );
      return;
    }

    if (password !== confirmPassword) {
      setError(
        isAr
          ? 'كلمة السر وتأكيدها غير متطابقين.'
          : 'Les mots de passe ne correspondent pas.'
      );
      return;
    }

    const res = submitDriverRegistration({
      fullName: fullName.trim(),
      phone: phone.trim(),
      email: email.trim(),
      city: city.trim(),
      address: address.trim(),
      cinNumber: cinNumber.trim().toUpperCase(),
      cinPhotoUrl,
      cinBackPhotoUrl: cinBackPhotoUrl || undefined,
      driverPhotoUrl,
      vehicleType,
      driverPlate: driverPlate.trim(),
      password
    });

    if (!res.success || !res.request) {
      setError(res.error || (isAr ? 'تعذر إرسال الطلب.' : "Erreur lors de l'envoi de la candidature."));
      return;
    }

    setSubmittedRequest(res.request);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/65 backdrop-blur-xs no-print">
      <div className="relative w-full max-w-xl bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50">
          <div className="flex items-center gap-3">
            <img
              src="/fariousy-logo.jpeg"
              alt="FARIOUSY DELIVERY"
              className="w-10 h-10 object-contain rounded-lg"
            />
            <div>
              <h3 className="text-base font-extrabold text-slate-900 leading-tight">
                {isAr ? 'تسجيل موزع جديد (ليفرور)' : 'Devenir Livreur FARIOUSY'}
              </h3>
              <p className="text-[11px] font-bold text-red-600 tracking-wider uppercase">
                {isAr ? 'فضاء الموزعين والسائقين' : 'RECRUTEMENT FLOTTE & COURSIERS'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={resetAndClose}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
            aria-label="Fermer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        {submittedRequest ? (
          <div className="p-8 text-center space-y-5 overflow-y-auto">
            <div className="w-16 h-16 mx-auto bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center shadow-xs">
              <Clock className="w-8 h-8 animate-pulse" />
            </div>

            <div>
              <span className="inline-block px-3 py-1 bg-amber-100 text-amber-900 rounded-md text-xs font-black uppercase tracking-wider mb-2">
                {isAr ? 'الحالة : في انتظار موافقة الإدارة' : 'Statut : En attente de validation'}
              </span>
              <h4 className="text-lg font-black text-slate-900">
                {isAr ? 'تم تسجيل طلبك كسائق بنجاح' : 'Candidature Livreur Enregistrée'}
              </h4>
              <p className="text-xs text-slate-600 max-w-md mx-auto mt-2 leading-relaxed">
                {isAr
                  ? `شكراً ${submittedRequest.fullName}، تم إرسال ملفك إلى إدارة FARIOUSY DELIVERY لمراجعة الوثائق وتفعيل حسابك.`
                  : `Merci ${submittedRequest.fullName}. Votre dossier a bien été transmis à l'équipe FARIOUSY DELIVERY pour vérification de vos documents et activation de votre compte.`}
              </p>
            </div>

            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl text-xs max-w-md mx-auto space-y-1.5 text-start">
              <div className="flex justify-between gap-2">
                <span className="text-slate-500">{isAr ? 'الاسم الكامل :' : 'Candidat :'}</span>
                <strong className="text-slate-900">{submittedRequest.fullName}</strong>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-slate-500">{isAr ? 'المدينة :' : 'Ville :'}</span>
                <span className="text-slate-800 font-semibold">{submittedRequest.city}</span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-slate-500">{isAr ? 'المركبة :' : 'Véhicule :'}</span>
                <span className="text-slate-800 font-semibold">
                  {submittedRequest.vehicleType}
                  {submittedRequest.driverPlate ? ` (${submittedRequest.driverPlate})` : ''}
                </span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-slate-500">{isAr ? 'رقم الهاتف :' : 'Téléphone :'}</span>
                <span className="font-mono text-slate-800 force-ltr">{submittedRequest.phone}</span>
              </div>
            </div>

            <p className="text-[11px] text-slate-500 max-w-md mx-auto">
              {isAr
                ? 'بعد تفعيل الحساب من طرف الإدارة، يمكنك الدخول مباشرة إلى تطبيق الليفرور عبر رقم الهاتف أو الإيميل وكلمة السر التي اخترتها.'
                : 'Une fois validé par la direction, connectez-vous directement avec votre e-mail ou téléphone et votre mot de passe.'}
            </p>

            <div className="pt-2 flex justify-center gap-3">
              <button
                type="button"
                onClick={resetAndClose}
                className="px-6 py-2.5 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-xl transition cursor-pointer"
              >
                {isAr ? 'فهمت، إغلاق' : 'Compris, fermer'}
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-3.5 text-slate-900">
            {error && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                <span>{error}</span>
              </div>
            )}

            {/* Nom complet */}
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                {isAr ? 'الاسم الكامل *' : 'Nom complet *'}
              </label>
              <div className="relative">
                <User className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={e => setFullName(e.target.value)}
                  placeholder={isAr ? 'مثال: المهدي بنكيران' : 'Ex : Mehdi Benkirane'}
                  className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-500"
                />
              </div>
            </div>

            {/* Téléphone & Email */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  {isAr ? 'رقم الهاتف *' : 'Numéro de téléphone *'}
                </label>
                <div className="relative">
                  <Phone className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                  <input
                    type="tel"
                    required
                    value={phone}
                    onChange={e => setPhone(e.target.value)}
                    placeholder="0661000000"
                    className="w-full pl-9 pr-3 py-2 text-xs font-mono bg-slate-50 border border-slate-300 rounded-xl text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-500 force-ltr"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  {isAr ? 'البريد الإلكتروني *' : 'Adresse e-mail *'}
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="livreur@email.com"
                    className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-500 force-ltr"
                  />
                </div>
              </div>
            </div>

            {/* Ville & CIN */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  {isAr ? 'المدينة التي ستعمل بها *' : "Ville d'activité *"}
                </label>
                <div className="relative">
                  <MapPin className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
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

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  {isAr ? 'رقم البطاقة الوطنية (CIN) *' : 'Numéro CIN *'}
                </label>
                <div className="relative">
                  <ShieldCheck className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                  <input
                    type="text"
                    required
                    value={cinNumber}
                    onChange={e => setCinNumber(e.target.value.toUpperCase())}
                    placeholder="Ex : BK123456"
                    className="w-full pl-9 pr-3 py-2 text-xs font-mono uppercase bg-slate-50 border border-slate-300 rounded-xl text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-500 force-ltr"
                  />
                </div>
              </div>
            </div>

            {/* Adresse */}
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                {isAr ? 'عنوان السكن *' : 'Adresse de résidence *'}
              </label>
              <input
                type="text"
                required
                value={address}
                onChange={e => setAddress(e.target.value)}
                placeholder={isAr ? 'الحي، الشارع، رقم المنزل...' : 'Quartier, Boulevard, N° Rue...'}
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-500"
              />
            </div>

            {/* Type de véhicule */}
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1.5">
                {isAr ? 'نوع وسيلة التوصيل *' : 'Type de véhicule *'}
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {VEHICLE_OPTIONS.map(opt => {
                  const selected = vehicleType === opt.type;
                  return (
                    <button
                      key={opt.type}
                      type="button"
                      onClick={() => setVehicleType(opt.type)}
                      className={`p-2.5 rounded-xl border flex flex-col items-center gap-1 transition-all text-xs font-bold cursor-pointer ${
                        selected
                          ? 'bg-red-50 border-red-500 text-red-900 ring-2 ring-red-500/30'
                          : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      <span className="text-lg leading-none">{opt.emoji}</span>
                      <span className="text-[11px] truncate max-w-full">
                        {isAr ? opt.labelAr : opt.labelFr}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Immatriculation */}
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                {isAr ? 'رقم لوحة المركبة (Matricule)' : 'Immatriculation du véhicule'}
                {vehicleType === 'Vélo' ? (
                  <span className="text-slate-400 font-normal mx-1">
                    {isAr ? '(اختياري للدراجة الهوائية)' : '(Optionnel pour vélo)'}
                  </span>
                ) : (
                  <span className="text-red-500 mx-0.5">*</span>
                )}
              </label>
              <input
                type="text"
                required={vehicleType !== 'Vélo'}
                value={driverPlate}
                onChange={e => setDriverPlate(e.target.value)}
                placeholder="Ex : 12345-A-26"
                className="w-full px-3 py-2 text-xs font-mono bg-slate-50 border border-slate-300 rounded-xl text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-500 force-ltr"
              />
            </div>

            {/* Documents KYC */}
            <div className="p-3 bg-slate-50/80 border border-slate-200 rounded-2xl space-y-2.5">
              <div className="flex items-center gap-1.5 text-[11px] font-black text-slate-800">
                <ShieldCheck className="w-3.5 h-3.5 text-red-600 shrink-0" />
                <span>
                  {isAr
                    ? 'الوثائق المطلوبة للموزع : الصورة الشخصية + لاكارط ناسيونال (CIN)'
                    : 'Documents requis : Photo personnelle & Carte Nationale (CIN)'}
                </span>
              </div>

              <KycPhotoUpload
                label={isAr ? 'الصورة الشخصية للسائق' : 'Photo personnelle du livreur'}
                sublabel={isAr ? 'صورة واضحة للوجه — إلزامي' : 'Portrait clair — Obligatoire'}
                value={driverPhotoUrl}
                onChange={setDriverPhotoUrl}
                required
                variant="portrait"
                captureMode="user"
                lang={isAr ? 'ar' : 'fr'}
              />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <KycPhotoUpload
                  label={isAr ? 'صورة لاكارط ناسيونال (الأمام)' : 'Carte Nationale CIN (Recto)'}
                  sublabel={isAr ? 'الوجه الأمامي — إلزامي' : 'Recto — Obligatoire'}
                  value={cinPhotoUrl}
                  onChange={setCinPhotoUrl}
                  required
                  variant="id_card"
                  captureMode="environment"
                  lang={isAr ? 'ar' : 'fr'}
                />
                <KycPhotoUpload
                  label={isAr ? 'صورة لاكارط ناسيونال (الخلف)' : 'Carte Nationale CIN (Verso)'}
                  sublabel={isAr ? 'الوجه الخلفي — اختياري' : 'Verso — Optionnel'}
                  value={cinBackPhotoUrl}
                  onChange={setCinBackPhotoUrl}
                  variant="id_card"
                  captureMode="environment"
                  lang={isAr ? 'ar' : 'fr'}
                />
              </div>
            </div>

            {/* Mot de passe */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  {isAr ? 'كلمة السر *' : 'Mot de passe *'}
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className={`w-full ${isRtl ? 'pl-9 pr-3' : 'pr-9 pl-3'} py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-500`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className={`absolute ${isRtl ? 'left-2' : 'right-2'} top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-700 rounded-md transition cursor-pointer`}
                  >
                    {showPassword ? <EyeOff className="w-3.5 h-3.5 text-red-600" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  {isAr ? 'تأكيد كلمة السر *' : 'Confirmation mot de passe *'}
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
                  >
                    {showConfirmPassword ? <EyeOff className="w-3.5 h-3.5 text-red-600" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>
            </div>

            {/* Submit */}
            <div className="pt-2">
              <button
                type="submit"
                className="w-full py-3 text-xs font-black text-white bg-red-600 hover:bg-red-700 rounded-xl shadow-xs transition-colors flex items-center justify-center gap-2 cursor-pointer"
              >
                <Truck className="w-4 h-4" />
                <span>
                  {isAr ? 'إرسال طلب التسجيل كليفرور' : 'Envoyer ma candidature de livreur'}
                </span>
                <ArrowRight className={`w-4 h-4 ${isRtl ? 'rotate-180' : ''}`} />
              </button>
            </div>

            {onSwitchToLogin && (
              <div className="text-center pt-1 text-[11px] text-slate-500">
                <span>{isAr ? 'عندك حساب ليفرور ديجا؟ ' : 'Vous avez déjà un compte livreur ? '}</span>
                <button
                  type="button"
                  onClick={onSwitchToLogin}
                  className="font-bold text-red-600 hover:underline cursor-pointer"
                >
                  {isAr ? 'تسجيل الدخول' : 'Se connecter'}
                </button>
              </div>
            )}
          </form>
        )}
      </div>
    </div>
  );
};
