import React, { useMemo, useState } from 'react';
import { useDatabase } from '../../context/DatabaseContext';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../i18n/LanguageContext';
import { ReviewTargetType } from '../../types';
import {
  Star,
  Building2,
  Truck,
  Send,
  CheckCircle2,
  AlertCircle,
  MessageSquareQuote,
  PackageCheck,
  MapPin
} from 'lucide-react';

export const ClientReviews: React.FC = () => {
  const { reviews, publicDrivers, users, packages, submitReview } = useDatabase();
  const { currentUser } = useAuth();
  const { language, isRtl } = useLanguage();
  const isAr = language === 'ar';

  const [targetType, setTargetType] = useState<ReviewTargetType>('company');
  const [rating, setRating] = useState<number>(5);
  const [hoverRating, setHoverRating] = useState<number>(0);
  const [driverId, setDriverId] = useState<string>('');
  const [driverNameInput, setDriverNameInput] = useState<string>('');
  const [trackingNumber, setTrackingNumber] = useState<string>('');
  const [comment, setComment] = useState<string>('');
  const [filter, setFilter] = useState<'all' | 'company' | 'driver'>('all');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const availableDrivers = useMemo(() => {
    const map = new Map<string, { id: string; name: string; city: string }>();
    for (const d of publicDrivers) {
      if (d?.id) map.set(d.id, d);
    }
    for (const u of users) {
      if (u.role === 'driver' && u.status === 'active' && !map.has(u.id)) {
        map.set(u.id, { id: u.id, name: u.name, city: u.city || '' });
      }
    }
    return Array.from(map.values());
  }, [publicDrivers, users]);

  // Recent delivered/assigned packages for this client so they can quick-pick a driver + tracking code
  const myDriverPackages = useMemo(() => {
    return packages
      .filter(p => p.clientId === currentUser?.id && (p.driverId || p.driverName))
      .slice(0, 6);
  }, [packages, currentUser?.id]);

  const visibleReviews = useMemo(() => {
    return reviews.filter(r => r.isPublic !== false);
  }, [reviews]);

  const companyReviews = useMemo(
    () => visibleReviews.filter(r => r.targetType === 'company'),
    [visibleReviews]
  );
  const driverReviews = useMemo(
    () => visibleReviews.filter(r => r.targetType === 'driver'),
    [visibleReviews]
  );

  const avgCompany = useMemo(() => {
    if (!companyReviews.length) return 0;
    return companyReviews.reduce((s, r) => s + r.rating, 0) / companyReviews.length;
  }, [companyReviews]);

  const avgDrivers = useMemo(() => {
    if (!driverReviews.length) return 0;
    return driverReviews.reduce((s, r) => s + r.rating, 0) / driverReviews.length;
  }, [driverReviews]);

  const filteredReviews = useMemo(() => {
    if (filter === 'company') return companyReviews;
    if (filter === 'driver') return driverReviews;
    return visibleReviews;
  }, [filter, visibleReviews, companyReviews, driverReviews]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);

    if (!comment.trim() || comment.trim().length < 3) {
      setFeedback({
        type: 'error',
        text: isAr ? 'يرجى كتابة تعليق واضح قبل الإرسال.' : 'Veuillez écrire un commentaire avant d’envoyer.'
      });
      return;
    }

    if (targetType === 'driver' && !driverId && !driverNameInput.trim() && !trackingNumber.trim()) {
      setFeedback({
        type: 'error',
        text: isAr ? 'يرجى اختيار الليفرور أو إدخال رقم التتبع.' : 'Veuillez sélectionner le livreur ou saisir le numéro de suivi.'
      });
      return;
    }

    setIsSubmitting(true);
    const chosenDriver = availableDrivers.find(d => d.id === driverId);
    const res = await submitReview({
      targetType,
      rating,
      comment: comment.trim(),
      authorName: currentUser?.companyName || currentUser?.name || 'Client',
      authorRole: 'client',
      authorCity: currentUser?.city || undefined,
      authorPhone: currentUser?.phone || undefined,
      driverId: targetType === 'driver' ? driverId || undefined : undefined,
      driverName:
        targetType === 'driver'
          ? chosenDriver?.name || driverNameInput.trim() || undefined
          : undefined,
      trackingNumber: trackingNumber.trim() ? trackingNumber.trim().toUpperCase() : undefined
    });
    setIsSubmitting(false);

    if (res.success) {
      setComment('');
      setTrackingNumber('');
      setDriverId('');
      setDriverNameInput('');
      setRating(5);
      setFeedback({
        type: 'success',
        text: isAr ? 'شكراً لك! تم تسجيل رأيك ونشره بنجاح.' : 'Merci ! Votre avis a été enregistré avec succès.'
      });
    } else {
      setFeedback({
        type: 'error',
        text: res.error || (isAr ? 'تعذر إرسال التقييم.' : "Impossible d'envoyer l'avis.")
      });
    }
  };

  return (
    <div className="space-y-6" dir={isRtl ? 'rtl' : 'ltr'}>
      {/* Header & KPI Strip */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-2xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-5">
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 flex items-center gap-2.5">
              <Star className="w-6 h-6 text-amber-500 fill-amber-400" />
              <span>{isAr ? 'آراء الزبائن فالشركة والليفرورز' : 'Avis Clients — Entreprise & Livreurs'}</span>
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 mt-1">
              {isAr
                ? 'شارك تقييمك الحقيقي لخدمات FARIOUSY والموزعين باش نطورو الجودة ديال التوصيل.'
                : 'Partagez votre évaluation réelle sur FARIOUSY et nos livreurs pour améliorer la qualité de livraison.'}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="p-4 rounded-xl bg-amber-50/70 border border-amber-200 flex items-center justify-between">
            <div>
              <span className="text-xs font-bold text-amber-800 block">
                {isAr ? 'تقييم الشركة' : 'Note Entreprise'}
              </span>
              <span className="text-2xl font-black text-slate-900 mt-0.5 block force-ltr">
                {companyReviews.length ? `${avgCompany.toFixed(1)} / 5` : '—'}
              </span>
              <span className="text-[11px] text-amber-700">
                {companyReviews.length} {isAr ? 'تقييم' : 'avis'}
              </span>
            </div>
            <Building2 className="w-8 h-8 text-amber-500" />
          </div>

          <div className="p-4 rounded-xl bg-emerald-50/70 border border-emerald-200 flex items-center justify-between">
            <div>
              <span className="text-xs font-bold text-emerald-800 block">
                {isAr ? 'تقييم الليفرورز' : 'Note Livreurs'}
              </span>
              <span className="text-2xl font-black text-slate-900 mt-0.5 block force-ltr">
                {driverReviews.length ? `${avgDrivers.toFixed(1)} / 5` : '—'}
              </span>
              <span className="text-[11px] text-emerald-700">
                {driverReviews.length} {isAr ? 'تقييم' : 'avis'}
              </span>
            </div>
            <Truck className="w-8 h-8 text-emerald-600" />
          </div>

          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between">
            <div>
              <span className="text-xs font-bold text-slate-600 block">
                {isAr ? 'مجموع الآراء المنشورة' : 'Total Avis Publiés'}
              </span>
              <span className="text-2xl font-black text-slate-900 mt-0.5 block force-ltr">
                {visibleReviews.length}
              </span>
              <span className="text-[11px] text-slate-500">
                {isAr ? 'تقييمات حقيقية 100%' : '100% avis authentiques'}
              </span>
            </div>
            <MessageSquareQuote className="w-8 h-8 text-red-500" />
          </div>
        </div>
      </div>

      {/* Main Grid: Form + List */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Submission Form */}
        <form
          onSubmit={handleSubmit}
          className="lg:col-span-5 bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-2xs space-y-4"
        >
          <h2 className="text-base font-black text-slate-900">
            {isAr ? 'أضف تقييمك الآن' : 'Laisser votre évaluation'}
          </h2>

          {/* Target switcher */}
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setTargetType('company')}
              className={`py-2.5 px-3 rounded-xl text-xs font-bold border flex items-center justify-center gap-2 transition cursor-pointer ${
                targetType === 'company'
                  ? 'bg-red-600 text-white border-red-600 shadow-xs'
                  : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
              }`}
            >
              <Building2 className="w-4 h-4" />
              <span>{isAr ? 'رأي فالشركة' : "Sur l'entreprise"}</span>
            </button>
            <button
              type="button"
              onClick={() => setTargetType('driver')}
              className={`py-2.5 px-3 rounded-xl text-xs font-bold border flex items-center justify-center gap-2 transition cursor-pointer ${
                targetType === 'driver'
                  ? 'bg-red-600 text-white border-red-600 shadow-xs'
                  : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
              }`}
            >
              <Truck className="w-4 h-4" />
              <span>{isAr ? 'رأي فالليفرور' : 'Sur un livreur'}</span>
            </button>
          </div>

          {/* Star Selector */}
          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1.5">
              {isAr ? 'التقييم بالنجوم' : 'Note en étoiles'}
            </label>
            <div className="flex items-center gap-1.5">
              {[1, 2, 3, 4, 5].map(star => (
                <button
                  key={star}
                  type="button"
                  onMouseEnter={() => setHoverRating(star)}
                  onMouseLeave={() => setHoverRating(0)}
                  onClick={() => setRating(star)}
                  className="p-1 transition-transform hover:scale-110 cursor-pointer"
                >
                  <Star
                    className={`w-7 h-7 ${
                      star <= (hoverRating || rating)
                        ? 'text-amber-400 fill-amber-400'
                        : 'text-slate-300'
                    }`}
                  />
                </button>
              ))}
              <span className="text-xs font-black text-amber-600 ms-2 force-ltr">{rating}/5</span>
            </div>
          </div>

          {/* Driver Picker when driver selected */}
          {targetType === 'driver' && (
            <div className="space-y-3 p-3.5 rounded-xl bg-slate-50 border border-slate-200">
              {myDriverPackages.length > 0 && (
                <div>
                  <span className="text-[11px] font-bold text-slate-600 block mb-1.5">
                    {isAr ? 'اختيار سريع من طرودك الأخيرة:' : 'Choix rapide depuis vos derniers colis :'}
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {myDriverPackages.map(pkg => (
                      <button
                        key={pkg.id}
                        type="button"
                        onClick={() => {
                          if (pkg.driverId) setDriverId(pkg.driverId);
                          else setDriverNameInput(pkg.driverName || '');
                          setTrackingNumber(pkg.trackingNumber);
                        }}
                        className="px-2.5 py-1 bg-white hover:bg-red-50 border border-slate-200 hover:border-red-300 rounded-lg text-[11px] font-bold text-slate-700 cursor-pointer transition"
                      >
                        {pkg.driverName || 'Livreur'} · <span className="font-mono text-red-600">{pkg.trackingNumber}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  {isAr ? 'اختر الليفرور' : 'Sélectionner le livreur'}
                </label>
                <select
                  value={driverId}
                  onChange={e => setDriverId(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-800"
                >
                  <option value="">
                    {isAr ? '-- اختر من قائمة الموزعين --' : '-- Choisir un livreur --'}
                  </option>
                  {availableDrivers.map(d => (
                    <option key={d.id} value={d.id}>
                      {d.name} {d.city ? `(${d.city})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              {!driverId && (
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    {isAr ? 'أو اكتب اسم الليفرور' : 'Ou saisir le nom du livreur'}
                  </label>
                  <input
                    type="text"
                    value={driverNameInput}
                    onChange={e => setDriverNameInput(e.target.value)}
                    placeholder={isAr ? 'مثال: محمد - موزع الدار البيضاء' : 'Ex: Nom du livreur'}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-800"
                  />
                </div>
              )}
            </div>
          )}

          {/* Optional Tracking Number */}
          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1">
              {isAr ? 'رقم التتبع (اختياري)' : 'Code de suivi (optionnel)'}
            </label>
            <input
              type="text"
              value={trackingNumber}
              onChange={e => setTrackingNumber(e.target.value)}
              placeholder="FAR-2601-..."
              className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-mono text-slate-800"
            />
          </div>

          {/* Comment */}
          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1">
              {isAr ? 'تعليقك ورأيك' : 'Votre commentaire'}
            </label>
            <textarea
              rows={4}
              value={comment}
              onChange={e => setComment(e.target.value)}
              placeholder={
                isAr
                  ? 'احكي لينا على تجربتك مع الشركة أو الليفرور (الاحترام، السرعة، التواصل...)'
                  : 'Décrivez votre expérience avec notre service ou le livreur...'
              }
              className="w-full px-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-red-500"
            />
          </div>

          {feedback && (
            <div
              className={`p-3 rounded-xl text-xs font-bold flex items-center gap-2 ${
                feedback.type === 'success'
                  ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                  : 'bg-red-50 text-red-700 border border-red-200'
              }`}
            >
              {feedback.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 shrink-0" />
              )}
              <span>{feedback.text}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-3 bg-red-600 hover:bg-red-700 disabled:opacity-60 text-white rounded-xl text-xs font-black flex items-center justify-center gap-2 transition cursor-pointer shadow-xs"
          >
            <Send className="w-4 h-4" />
            <span>
              {isSubmitting
                ? isAr
                  ? 'جاري الإرسال...'
                  : 'Envoi en cours...'
                : isAr
                ? 'نشر التقييم'
                : "Publier l'avis"}
            </span>
          </button>
        </form>

        {/* Reviews List */}
        <div className="lg:col-span-7 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 bg-white p-3 rounded-2xl border border-slate-200">
            <div className="flex flex-wrap items-center gap-1.5">
              {[
                { key: 'all', label: isAr ? `الكل (${visibleReviews.length})` : `Tous (${visibleReviews.length})` },
                { key: 'company', label: isAr ? `الشركة (${companyReviews.length})` : `Entreprise (${companyReviews.length})` },
                { key: 'driver', label: isAr ? `الليفرورز (${driverReviews.length})` : `Livreurs (${driverReviews.length})` }
              ].map(tab => (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setFilter(tab.key as any)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                    filter === tab.key
                      ? 'bg-slate-900 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {filteredReviews.length === 0 ? (
            <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-10 text-center space-y-2">
              <MessageSquareQuote className="w-10 h-10 text-slate-300 mx-auto" />
              <p className="text-sm font-bold text-slate-700">
                {isAr ? 'لا توجد تقييمات مسجلة بعد في هذا القسم' : 'Aucun avis enregistré pour le moment'}
              </p>
              <p className="text-xs text-slate-500">
                {isAr ? 'كن أول من يشارك رأيه الحقيقي!' : 'Soyez le premier à partager votre expérience réelle !'}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredReviews.map(rev => (
                <div
                  key={rev.id}
                  className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-2xs space-y-2.5"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-black text-sm text-slate-900">{rev.authorName}</span>
                        {rev.authorCity && (
                          <span className="inline-flex items-center gap-1 text-[11px] text-slate-500">
                            <MapPin className="w-3 h-3" />
                            {rev.authorCity}
                          </span>
                        )}
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            rev.targetType === 'driver'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-red-50 text-red-700 border border-red-200'
                          }`}
                        >
                          {rev.targetType === 'driver'
                            ? isAr
                              ? `الليفرور: ${rev.driverName || 'موزع'}`
                              : `Livreur : ${rev.driverName || 'Livreur'}`
                            : isAr
                            ? 'تقييم الشركة'
                            : 'Entreprise FARIOUSY'}
                        </span>
                      </div>
                      {rev.trackingNumber && (
                        <div className="inline-flex items-center gap-1 text-[11px] font-mono text-slate-500 mt-1">
                          <PackageCheck className="w-3 h-3 text-slate-400" />
                          <span>{rev.trackingNumber}</span>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-0.5">
                      {[1, 2, 3, 4, 5].map(s => (
                        <Star
                          key={s}
                          className={`w-4 h-4 ${
                            s <= rev.rating ? 'text-amber-400 fill-amber-400' : 'text-slate-200'
                          }`}
                        />
                      ))}
                    </div>
                  </div>

                  <p className="text-xs sm:text-sm text-slate-700 leading-relaxed whitespace-pre-line">
                    {rev.comment}
                  </p>

                  {rev.adminReply && (
                    <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-700">
                      <span className="font-black text-red-600 block mb-0.5">
                        {isAr ? 'رد إدارة FARIOUSY:' : "Réponse de l'équipe FARIOUSY :"}
                      </span>
                      <p>{rev.adminReply}</p>
                    </div>
                  )}

                  <div className="text-[10px] text-slate-400 font-mono">
                    {new Date(rev.createdAt).toLocaleDateString(isAr ? 'ar-MA' : 'fr-FR', {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric'
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
