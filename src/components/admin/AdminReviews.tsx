import React, { useMemo, useState } from 'react';
import { useDatabase } from '../../context/DatabaseContext';
import { useLanguage } from '../../i18n/LanguageContext';
import {
  Star,
  Building2,
  Truck,
  Eye,
  EyeOff,
  Trash2,
  Search,
  MessageSquareReply,
  Award,
  CheckCircle2,
  MessageSquareQuote,
  MapPin
} from 'lucide-react';

export const AdminReviews: React.FC = () => {
  const { reviews, updateReview, deleteReview } = useDatabase();
  const { language, isRtl } = useLanguage();
  const isAr = language === 'ar';

  const [filter, setFilter] = useState<'all' | 'company' | 'driver' | 'hidden'>('all');
  const [search, setSearch] = useState('');
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});
  const [openReplyId, setOpenReplyId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const companyReviews = useMemo(() => reviews.filter(r => r.targetType === 'company'), [reviews]);
  const driverReviews = useMemo(() => reviews.filter(r => r.targetType === 'driver'), [reviews]);
  const hiddenCount = useMemo(() => reviews.filter(r => r.isPublic === false).length, [reviews]);

  const avgCompany = useMemo(() => {
    if (!companyReviews.length) return 0;
    return companyReviews.reduce((s, r) => s + r.rating, 0) / companyReviews.length;
  }, [companyReviews]);

  const avgDrivers = useMemo(() => {
    if (!driverReviews.length) return 0;
    return driverReviews.reduce((s, r) => s + r.rating, 0) / driverReviews.length;
  }, [driverReviews]);

  // Driver leaderboard aggregated strictly from real submitted driver reviews
  const driverLeaderboard = useMemo(() => {
    const map = new Map<string, { key: string; name: string; count: number; totalStars: number; fiveStars: number }>();
    for (const r of driverReviews) {
      const key = r.driverId || (r.driverName || 'Livreur').toLowerCase();
      const name = r.driverName || 'Livreur';
      const cur = map.get(key) || { key, name, count: 0, totalStars: 0, fiveStars: 0 };
      cur.count += 1;
      cur.totalStars += r.rating;
      if (r.rating === 5) cur.fiveStars += 1;
      map.set(key, cur);
    }
    return Array.from(map.values())
      .map(item => ({ ...item, avg: item.totalStars / item.count }))
      .sort((a, b) => b.avg - a.avg || b.count - a.count);
  }, [driverReviews]);

  const filteredReviews = useMemo(() => {
    const q = search.trim().toLowerCase();
    return reviews.filter(r => {
      if (filter === 'company' && r.targetType !== 'company') return false;
      if (filter === 'driver' && r.targetType !== 'driver') return false;
      if (filter === 'hidden' && r.isPublic !== false) return false;
      if (!q) return true;
      const hay = [
        r.authorName,
        r.authorCity,
        r.driverName,
        r.trackingNumber,
        r.comment,
        r.adminReply
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return hay.includes(q);
    });
  }, [reviews, filter, search]);

  const handleToggleVisibility = async (id: string, currentlyPublic: boolean) => {
    setBusyId(id);
    await updateReview(id, { isPublic: !currentlyPublic });
    setBusyId(null);
  };

  const handleSaveReply = async (id: string) => {
    const text = (replyDrafts[id] ?? '').trim();
    setBusyId(id);
    await updateReview(id, { adminReply: text });
    setBusyId(null);
    setOpenReplyId(null);
  };

  const handleDelete = async (id: string) => {
    setBusyId(id);
    await deleteReview(id);
    setBusyId(null);
  };

  return (
    <div className="space-y-6" dir={isRtl ? 'rtl' : 'ltr'}>
      {/* Header & KPIs */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 flex items-center gap-2.5">
              <Star className="w-6 h-6 text-amber-500 fill-amber-400" />
              <span>{isAr ? 'إدارة آراء الزبائن وتقييم الليفرورز' : 'Gestion des Avis — Entreprise & Livreurs'}</span>
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 mt-1">
              {isAr
                ? 'راقب تقييمات الزبائن للشركة ولكل ليفرور، ورد عليها أو تحكم في ظهورها للعموم.'
                : 'Consultez les avis clients sur l’entreprise et chaque livreur, répondez et modérez la visibilité.'}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <div className="p-4 rounded-xl bg-amber-50/70 border border-amber-200">
            <div className="flex items-center justify-between text-amber-800 text-xs font-bold">
              <span>{isAr ? 'تقييم الشركة' : 'Note Entreprise'}</span>
              <Building2 className="w-4 h-4" />
            </div>
            <div className="text-2xl font-black text-slate-900 mt-1 force-ltr">
              {companyReviews.length ? `${avgCompany.toFixed(1)} ★` : '—'}
            </div>
            <div className="text-[11px] text-amber-700 mt-0.5">
              {companyReviews.length} {isAr ? 'تقييم' : 'avis'}
            </div>
          </div>

          <div className="p-4 rounded-xl bg-emerald-50/70 border border-emerald-200">
            <div className="flex items-center justify-between text-emerald-800 text-xs font-bold">
              <span>{isAr ? 'تقييم الليفرورز' : 'Note Livreurs'}</span>
              <Truck className="w-4 h-4" />
            </div>
            <div className="text-2xl font-black text-slate-900 mt-1 force-ltr">
              {driverReviews.length ? `${avgDrivers.toFixed(1)} ★` : '—'}
            </div>
            <div className="text-[11px] text-emerald-700 mt-0.5">
              {driverReviews.length} {isAr ? 'تقييم' : 'avis'}
            </div>
          </div>

          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
            <div className="flex items-center justify-between text-slate-700 text-xs font-bold">
              <span>{isAr ? 'إجمالي الآراء' : 'Total des avis'}</span>
              <MessageSquareQuote className="w-4 h-4 text-red-500" />
            </div>
            <div className="text-2xl font-black text-slate-900 mt-1 force-ltr">{reviews.length}</div>
            <div className="text-[11px] text-slate-500 mt-0.5">
              {isAr ? 'مسجلة في النظام' : 'enregistrés'}
            </div>
          </div>

          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
            <div className="flex items-center justify-between text-slate-700 text-xs font-bold">
              <span>{isAr ? 'الآراء المخفية' : 'Avis masqués'}</span>
              <EyeOff className="w-4 h-4 text-slate-500" />
            </div>
            <div className="text-2xl font-black text-slate-900 mt-1 force-ltr">{hiddenCount}</div>
            <div className="text-[11px] text-slate-500 mt-0.5">
              {isAr ? 'غير ظاهرة للزوار' : 'non publiés'}
            </div>
          </div>
        </div>
      </div>

      {/* Driver Leaderboard */}
      {driverLeaderboard.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs space-y-3">
          <h2 className="text-sm font-black text-slate-900 flex items-center gap-2">
            <Award className="w-4 h-4 text-amber-500" />
            <span>{isAr ? 'ترتيب الليفرورز حسب تقييم الزبائن' : 'Classement des livreurs par note'}</span>
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {driverLeaderboard.map((drv, idx) => (
              <div
                key={drv.key}
                className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between gap-3"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="w-7 h-7 rounded-lg bg-slate-900 text-white text-xs font-black flex items-center justify-center shrink-0">
                    #{idx + 1}
                  </span>
                  <div className="min-w-0">
                    <div className="font-bold text-xs text-slate-900 truncate">{drv.name}</div>
                    <div className="text-[11px] text-slate-500">
                      {drv.count} {isAr ? 'تقييم' : 'avis'} · {drv.fiveStars} × 5★
                    </div>
                  </div>
                </div>
                <div className="px-2.5 py-1 rounded-lg bg-amber-100 text-amber-900 font-black text-xs shrink-0 force-ltr">
                  {drv.avg.toFixed(1)} ★
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filter & Search Bar */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-2xs">
        <div className="flex flex-wrap items-center gap-1.5">
          {[
            { key: 'all', label: isAr ? `الكل (${reviews.length})` : `Tous (${reviews.length})` },
            { key: 'company', label: isAr ? `الشركة (${companyReviews.length})` : `Entreprise (${companyReviews.length})` },
            { key: 'driver', label: isAr ? `الليفرورز (${driverReviews.length})` : `Livreurs (${driverReviews.length})` },
            { key: 'hidden', label: isAr ? `مخفية (${hiddenCount})` : `Masqués (${hiddenCount})` }
          ].map(tab => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setFilter(tab.key as any)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                filter === tab.key
                  ? 'bg-red-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="relative w-full md:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute top-1/2 -translate-y-1/2 start-3" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={isAr ? 'بحث بالاسم، الليفرور، الكود...' : 'Rechercher auteur, livreur, code...'}
            className="w-full ps-9 pe-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800"
          />
        </div>
      </div>

      {/* Reviews List */}
      {filteredReviews.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-12 text-center space-y-2">
          <MessageSquareQuote className="w-10 h-10 text-slate-300 mx-auto" />
          <p className="text-sm font-bold text-slate-700">
            {isAr ? 'لا توجد آراء مطابقة للبحث حالياً' : 'Aucun avis trouvé pour ce filtre'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredReviews.map(rev => {
            const isReplying = openReplyId === rev.id;
            return (
              <div
                key={rev.id}
                className={`bg-white rounded-2xl border p-4 sm:p-5 shadow-2xs space-y-3 ${
                  rev.isPublic === false ? 'border-amber-300 bg-amber-50/20' : 'border-slate-200'
                }`}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-1">
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
                          ? `${isAr ? 'الليفرور' : 'Livreur'}: ${rev.driverName || '—'}`
                          : isAr
                          ? 'فالشركة'
                          : 'Entreprise'}
                      </span>
                      {rev.trackingNumber && (
                        <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-mono text-[10px] font-bold">
                          {rev.trackingNumber}
                        </span>
                      )}
                      {rev.isPublic === false && (
                        <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[10px] font-bold">
                          {isAr ? 'مخفي عن العموم' : 'Masqué'}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      {[1, 2, 3, 4, 5].map(s => (
                        <Star
                          key={s}
                          className={`w-4 h-4 ${
                            s <= rev.rating ? 'text-amber-400 fill-amber-400' : 'text-slate-200'
                          }`}
                        />
                      ))}
                      <span className="text-[11px] text-slate-400 ms-2 font-mono">
                        {new Date(rev.createdAt).toLocaleString(isAr ? 'ar-MA' : 'fr-FR')}
                      </span>
                    </div>
                  </div>

                  {/* Moderation Actions */}
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <button
                      type="button"
                      disabled={busyId === rev.id}
                      onClick={() => {
                        setOpenReplyId(isReplying ? null : rev.id);
                        setReplyDrafts(prev => ({ ...prev, [rev.id]: rev.adminReply || '' }));
                      }}
                      className="px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold flex items-center gap-1 cursor-pointer"
                    >
                      <MessageSquareReply className="w-3.5 h-3.5" />
                      <span>{isAr ? 'رد' : 'Répondre'}</span>
                    </button>

                    <button
                      type="button"
                      disabled={busyId === rev.id}
                      onClick={() => handleToggleVisibility(rev.id, rev.isPublic !== false)}
                      className={`px-2.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1 cursor-pointer ${
                        rev.isPublic === false
                          ? 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200'
                          : 'bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200'
                      }`}
                    >
                      {rev.isPublic === false ? (
                        <>
                          <Eye className="w-3.5 h-3.5" />
                          <span>{isAr ? 'إظهار' : 'Publier'}</span>
                        </>
                      ) : (
                        <>
                          <EyeOff className="w-3.5 h-3.5" />
                          <span>{isAr ? 'إخفاء' : 'Masquer'}</span>
                        </>
                      )}
                    </button>

                    <button
                      type="button"
                      disabled={busyId === rev.id}
                      onClick={() => handleDelete(rev.id)}
                      className="px-2.5 py-1.5 rounded-xl bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 text-xs font-bold flex items-center gap-1 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>{isAr ? 'حذف' : 'Supprimer'}</span>
                    </button>
                  </div>
                </div>

                <p className="text-xs sm:text-sm text-slate-700 leading-relaxed whitespace-pre-line">
                  {rev.comment}
                </p>

                {rev.adminReply && !isReplying && (
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-700 flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-black text-slate-900 block">
                        {isAr ? 'رد الإدارة:' : 'Réponse admin :'}
                      </span>
                      <p>{rev.adminReply}</p>
                    </div>
                  </div>
                )}

                {isReplying && (
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                    <textarea
                      rows={2}
                      value={replyDrafts[rev.id] ?? ''}
                      onChange={e =>
                        setReplyDrafts(prev => ({ ...prev, [rev.id]: e.target.value }))
                      }
                      placeholder={isAr ? 'اكتب رد الإدارة الذي سيظهر تحت التقييم...' : 'Écrire la réponse publique...'}
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-800"
                    />
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setOpenReplyId(null)}
                        className="px-3 py-1.5 rounded-lg text-xs font-bold text-slate-600 hover:bg-slate-200 cursor-pointer"
                      >
                        {isAr ? 'إلغاء' : 'Annuler'}
                      </button>
                      <button
                        type="button"
                        disabled={busyId === rev.id}
                        onClick={() => handleSaveReply(rev.id)}
                        className="px-4 py-1.5 rounded-lg text-xs font-bold bg-red-600 hover:bg-red-700 text-white cursor-pointer"
                      >
                        {isAr ? 'حفظ الرد' : 'Enregistrer'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
