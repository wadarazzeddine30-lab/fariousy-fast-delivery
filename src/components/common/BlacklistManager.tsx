import React, { useEffect, useMemo, useState } from 'react';
import {
  ShieldAlert,
  Ban,
  Search,
  PlusCircle,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Phone,
  MapPin,
  Store,
  Clock,
  MessageSquareWarning,
  X
} from 'lucide-react';
import { useDatabase } from '../../context/DatabaseContext';
import { useAuth } from '../../context/AuthContext';
import { BlacklistEntry } from '../../types';
import { BLACKLIST_REASONS, normalizeBlacklistPhone } from '../../utils/blacklist';

export interface BlacklistPrefill {
  phone?: string;
  customerName?: string;
  city?: string;
  nonce?: number;
}

interface BlacklistManagerProps {
  prefill?: BlacklistPrefill | null;
}

interface GroupedBlacklistPhone {
  normalizedPhone: string;
  displayPhone: string;
  customerNames: string[];
  cities: string[];
  reasons: string[];
  latestAt: string;
  entries: BlacklistEntry[];
}

export const BlacklistManager: React.FC<BlacklistManagerProps> = ({ prefill }) => {
  const {
    blacklistEntries,
    cities,
    refreshBlacklist,
    addBlacklistEntry,
    deleteBlacklistEntry,
    findBlacklistMatches
  } = useDatabase();
  const { currentUser, isAdmin } = useAuth();

  const [phone, setPhone] = useState(prefill?.phone || '');
  const [customerName, setCustomerName] = useState(prefill?.customerName || '');
  const [city, setCity] = useState(prefill?.city || '');
  const [reason, setReason] = useState(BLACKLIST_REASONS[0].value);
  const [comment, setComment] = useState('');

  const [searchQuery, setSearchQuery] = useState('');
  const [scopeTab, setScopeTab] = useState<'all' | 'mine'>('all');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  useEffect(() => {
    void refreshBlacklist();
  }, [refreshBlacklist]);

  useEffect(() => {
    if (prefill?.phone) {
      setPhone(prefill.phone);
      if (prefill.customerName) setCustomerName(prefill.customerName);
      if (prefill.city) setCity(prefill.city);
    }
  }, [prefill?.nonce, prefill?.phone, prefill?.customerName, prefill?.city]);

  const livePhoneCheck = useMemo(() => {
    return findBlacklistMatches(phone);
  }, [phone, findBlacklistMatches]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await refreshBlacklist();
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);

    if (normalizeBlacklistPhone(phone).length < 8) {
      setFeedback({
        type: 'error',
        message: 'عافاك دخل رقم هاتف صحيح (على الأقل 8 أرقام بحال 0661234567).'
      });
      return;
    }

    if (comment.trim().length < 3) {
      setFeedback({
        type: 'error',
        message: 'عافاك كتب تعليق أو السبب علاش هاد الزبون دخل للائحة السوداء.'
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await addBlacklistEntry({
        phone: phone.trim(),
        customerName: customerName.trim() || undefined,
        city: city.trim() || undefined,
        reason,
        comment: comment.trim()
      });

      if (!res.success) {
        setFeedback({
          type: 'error',
          message: res.error || 'تعذر تسجيل الرقم في اللائحة السوداء.'
        });
        return;
      }

      setFeedback({
        type: 'success',
        message: 'تمت إضافة الزبون للائحة السوداء المشتركة بنجاح. أي تاجر يدخل هاد الرقم غادي يطلع ليه التنبيه فوراً.'
      });
      setPhone('');
      setCustomerName('');
      setCity('');
      setComment('');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    setFeedback(null);
    setDeletingId(id);
    try {
      const res = await deleteBlacklistEntry(id);
      if (!res.success) {
        setFeedback({
          type: 'error',
          message: res.error || 'تعذر حذف السجل.'
        });
      } else {
        setFeedback({
          type: 'success',
          message: 'تم حذف البلاغ من اللائحة السوداء.'
        });
      }
    } finally {
      setDeletingId(null);
    }
  };

  const myReportsCount = useMemo(
    () => blacklistEntries.filter(e => e.reportedById === currentUser?.id).length,
    [blacklistEntries, currentUser?.id]
  );

  const uniquePhonesCount = useMemo(() => {
    return new Set(
      blacklistEntries.map(e => e.normalizedPhone || normalizeBlacklistPhone(e.phone)).filter(Boolean)
    ).size;
  }, [blacklistEntries]);

  const groupedList = useMemo<GroupedBlacklistPhone[]>(() => {
    const q = searchQuery.trim().toLowerCase();
    const digitsQ = q.replace(/\D/g, '');

    const filtered = blacklistEntries.filter(entry => {
      if (scopeTab === 'mine' && entry.reportedById !== currentUser?.id) return false;
      if (!q) return true;

      if (entry.phone.toLowerCase().includes(q)) return true;
      if (
        digitsQ.length >= 3 &&
        ((entry.normalizedPhone || '').includes(digitsQ) ||
          entry.phone.replace(/\D/g, '').includes(digitsQ))
      ) {
        return true;
      }
      if ((entry.customerName || '').toLowerCase().includes(q)) return true;
      if ((entry.city || '').toLowerCase().includes(q)) return true;
      if ((entry.reason || '').toLowerCase().includes(q)) return true;
      if ((entry.comment || '').toLowerCase().includes(q)) return true;
      if ((entry.reportedByCompany || entry.reportedByName || '').toLowerCase().includes(q)) return true;
      return false;
    });

    const map = new Map<string, GroupedBlacklistPhone>();
    for (const entry of filtered) {
      const key = entry.normalizedPhone || normalizeBlacklistPhone(entry.phone) || entry.phone;
      const existing = map.get(key);
      const entryTime = entry.updatedAt || entry.createdAt;
      if (!existing) {
        map.set(key, {
          normalizedPhone: key,
          displayPhone: entry.phone,
          customerNames: entry.customerName ? [entry.customerName] : [],
          cities: entry.city ? [entry.city] : [],
          reasons: entry.reason ? [entry.reason] : [],
          latestAt: entryTime,
          entries: [entry]
        });
      } else {
        existing.entries.push(entry);
        if (entry.customerName && !existing.customerNames.includes(entry.customerName)) {
          existing.customerNames.push(entry.customerName);
        }
        if (entry.city && !existing.cities.includes(entry.city)) {
          existing.cities.push(entry.city);
        }
        if (entry.reason && !existing.reasons.includes(entry.reason)) {
          existing.reasons.push(entry.reason);
        }
        if (new Date(entryTime).getTime() > new Date(existing.latestAt).getTime()) {
          existing.latestAt = entryTime;
          existing.displayPhone = entry.phone;
        }
      }
    }

    return Array.from(map.values()).sort(
      (a, b) => new Date(b.latestAt).getTime() - new Date(a.latestAt).getTime()
    );
  }, [blacklistEntries, searchQuery, scopeTab, currentUser?.id]);

  return (
    <div dir="rtl" className="space-y-5">
      {/* Header Banner */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 sm:p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="w-11 h-11 rounded-xl bg-rose-600 text-white flex items-center justify-center shrink-0">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-lg sm:text-xl font-black text-slate-900">
              اللائحة السوداء للزبناء (Blacklist)
            </h1>
            <p className="text-xs text-slate-600 mt-0.5 leading-relaxed">
              قاعدة بيانات مشتركة بين جميع التجار والموظفين: دخل رقم الزبون اللي كيتفلا أو كيلغي الطلبيات مع تعليق، وأي تاجر يدخل نفس الرقم فطلبية جديدة غادي يطلع ليه تنبيه فوري.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <div className="px-3.5 py-2 bg-rose-50 border border-rose-200 rounded-lg text-center">
            <span className="text-[10px] font-bold text-rose-700 block">أرقام محظورة</span>
            <span className="text-base font-black font-mono tabular-nums text-rose-900">
              {uniquePhonesCount}
            </span>
          </div>
          <div className="px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-lg text-center">
            <span className="text-[10px] font-bold text-slate-500 block">مجموع البلاغات</span>
            <span className="text-base font-black font-mono tabular-nums text-slate-900">
              {blacklistEntries.length}
            </span>
          </div>
          <div className="px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-lg text-center">
            <span className="text-[10px] font-bold text-slate-500 block">بلاغاتي</span>
            <span className="text-base font-black font-mono tabular-nums text-slate-900">
              {myReportsCount}
            </span>
          </div>
        </div>
      </div>

      {feedback && (
        <div
          className={`flex items-center justify-between gap-3 px-4 py-3 rounded-xl border text-xs font-bold ${
            feedback.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : 'bg-rose-50 border-rose-200 text-rose-900'
          }`}
        >
          <div className="flex items-center gap-2">
            {feedback.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            )}
            <span>{feedback.message}</span>
          </div>
          <button
            type="button"
            onClick={() => setFeedback(null)}
            className="p-1 hover:bg-black/5 rounded-lg cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Form: Check & Add to Blacklist */}
        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-4 sm:p-5 space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
            <Ban className="w-4 h-4 text-rose-600 shrink-0" />
            <h2 className="text-sm font-black text-slate-900">
              إضافة رقم للائحة السوداء أو التحقق منه
            </h2>
          </div>

          <form onSubmit={handleSubmit} className="space-y-3.5">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                رقم هاتف الزبون *
              </label>
              <div className="relative">
                <Phone className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
                <input
                  type="tel"
                  required
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  placeholder="مثال: 0661234567"
                  className="w-full pr-9 pl-3 py-2.5 text-xs font-mono bg-slate-50 border border-slate-300 rounded-lg text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-rose-500 force-ltr text-right"
                />
              </div>

              {/* Instant Live Check Result */}
              {livePhoneCheck.normalizedPhone.length >= 8 && (
                <div
                  className={`mt-2 p-2.5 rounded-lg border text-xs ${
                    livePhoneCheck.reportCount > 0
                      ? 'bg-rose-50 border-rose-300 text-rose-900'
                      : 'bg-emerald-50 border-emerald-200 text-emerald-900'
                  }`}
                >
                  {livePhoneCheck.reportCount > 0 ? (
                    <div className="space-y-1">
                      <div className="flex items-center gap-1.5 font-black text-rose-800">
                        <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                        <span>
                          هاد الزبون كاين فاللائحة السوداء وراه كيلغي الطلبيات ({livePhoneCheck.reportCount} بلاغات)
                        </span>
                      </div>
                      <p className="text-[11px] text-rose-700 font-semibold">
                        آخر تعليق: “{livePhoneCheck.latestComment}”
                      </p>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5 font-bold text-emerald-800">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span>هاد الرقم غير مسجل حالياً في اللائحة السوداء.</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  اسم الزبون (اختياري)
                </label>
                <input
                  type="text"
                  value={customerName}
                  onChange={e => setCustomerName(e.target.value)}
                  placeholder="الاسم الكامل"
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-rose-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  المدينة (اختياري)
                </label>
                <select
                  value={city}
                  onChange={e => setCity(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-rose-500"
                >
                  <option value="">-- اختر المدينة --</option>
                  {cities.map(c => (
                    <option key={c.id} value={c.name}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                نوع المشكل *
              </label>
              <select
                value={reason}
                onChange={e => setReason(e.target.value)}
                className="w-full px-3 py-2 text-xs font-semibold bg-slate-50 border border-slate-300 rounded-lg text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-rose-500"
              >
                {BLACKLIST_REASONS.map(r => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                التعليق / علاش دخل للائحة السوداء *
              </label>
              <textarea
                rows={3}
                required
                value={comment}
                onChange={e => setComment(e.target.value)}
                placeholder="مثال: كيطلب الكوموند وكيأكد ولكن ملي كيوصل عندو الليفرور كيقطع التلفون وكيلغي..."
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-rose-500"
              />
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-2.5 px-4 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white text-xs font-black rounded-lg transition-colors flex items-center justify-center gap-2 whitespace-nowrap cursor-pointer"
            >
              {isSubmitting ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <PlusCircle className="w-4 h-4" />
              )}
              <span>
                {isSubmitting ? 'جاري الحفظ...' : 'تأكيد وإضافة للائحة السوداء'}
              </span>
            </button>
          </form>
        </div>

        {/* Directory List */}
        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-4 sm:p-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setScopeTab('all')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  scopeTab === 'all'
                    ? 'bg-slate-900 text-white'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                جميع البلاغات المشتركة ({blacklistEntries.length})
              </button>
              <button
                type="button"
                onClick={() => setScopeTab('mine')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  scopeTab === 'mine'
                    ? 'bg-slate-900 text-white'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                بلاغاتي فقط ({myReportsCount})
              </button>
            </div>

            <button
              type="button"
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg whitespace-nowrap shrink-0 cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
              <span>تحديث</span>
            </button>
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="بحث برقم الهاتف، اسم الزبون، المدينة، أو سبب البلاغ..."
              className="w-full pr-9 pl-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-rose-500"
            />
          </div>

          {/* Grouped Blacklist Items */}
          {groupedList.length === 0 ? (
            <div className="py-12 text-center text-slate-400 text-xs font-semibold border border-dashed border-slate-200 rounded-xl">
              {searchQuery.trim()
                ? 'ما كاين حتى زبون مطابق لهاد البحث في اللائحة السوداء.'
                : 'اللائحة السوداء خاوية حالياً. أي رقم زبون كيتفلا تقدر تزيدو من الخانة اللي فالجنب.'}
            </div>
          ) : (
            <div className="space-y-3 max-h-[620px] overflow-y-auto pl-1">
              {groupedList.map(group => (
                <div
                  key={group.normalizedPhone}
                  className="border border-rose-200 bg-rose-50/30 rounded-xl p-3.5 space-y-2.5"
                >
                  {/* Group Phone Header */}
                  <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-rose-100">
                    <div className="flex flex-wrap items-center gap-2.5">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-rose-600 text-white rounded-lg font-mono font-black text-xs force-ltr">
                        <Phone className="w-3.5 h-3.5" />
                        <span>{group.displayPhone}</span>
                      </span>
                      {group.customerNames.length > 0 && (
                        <span className="text-xs font-black text-slate-900">
                          {group.customerNames.join(' / ')}
                        </span>
                      )}
                      {group.cities.length > 0 && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-600">
                          <MapPin className="w-3 h-3 text-slate-400" />
                          <span>{group.cities.join('، ')}</span>
                        </span>
                      )}
                    </div>

                    <span className="px-2 py-0.5 bg-rose-100 text-rose-800 border border-rose-200 rounded-md text-[11px] font-black font-mono tabular-nums whitespace-nowrap">
                      {group.entries.length} {group.entries.length === 1 ? 'بلاغ' : 'بلاغات'}
                    </span>
                  </div>

                  {/* Individual Merchant Reports/Comments */}
                  <div className="space-y-2">
                    {group.entries.map(entry => {
                      const canDelete = isAdmin || entry.reportedById === currentUser?.id;
                      return (
                        <div
                          key={entry.id}
                          className="bg-white border border-slate-200 rounded-lg p-2.5 flex items-start justify-between gap-3"
                        >
                          <div className="space-y-1 min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200 text-[10px] font-bold">
                                <MessageSquareWarning className="w-3 h-3 shrink-0" />
                                <span>{entry.reason}</span>
                              </span>
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-slate-500">
                                <Store className="w-3 h-3 text-slate-400" />
                                <span>{entry.reportedByCompany || entry.reportedByName}</span>
                              </span>
                              <span className="inline-flex items-center gap-1 text-[10px] text-slate-400 font-mono">
                                <Clock className="w-3 h-3" />
                                <span>
                                  {new Date(entry.updatedAt || entry.createdAt).toLocaleDateString('fr-MA')}
                                </span>
                              </span>
                            </div>
                            <p className="text-xs font-semibold text-slate-800 leading-relaxed break-words">
                              {entry.comment}
                            </p>
                          </div>

                          {canDelete && (
                            <button
                              type="button"
                              disabled={deletingId === entry.id}
                              onClick={() => handleDelete(entry.id)}
                              title="حذف هاد البلاغ"
                              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors shrink-0 cursor-pointer disabled:opacity-50"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      );
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
