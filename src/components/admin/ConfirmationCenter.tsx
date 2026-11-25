import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useDatabase } from '../../context/DatabaseContext';
import { useAuth } from '../../context/AuthContext';
import {
  fetchStaffControlOverviewDirect,
  handleStaffShiftDirect,
  handleConfirmationActionDirect
} from '../../services/supabaseDirectGateway';
import {
  ConfirmationActionLog,
  ConfirmationOutcome,
  PACKAGE_STATUS_CONFIG,
  PackageItem,
  StaffControlMemberOverview,
  StaffWorkShift
} from '../../types';
import {
  buildRecipientConfirmationWhatsAppUrl,
  hasValidRecipientWhatsApp
} from '../../utils/supportWhatsApp';
import { getUserAssignedCities, hasEmployeePermission, isCityAllowedForUser } from '../../utils/employeePermissions';
import { EditPackageModal } from '../common/EditPackageModal';
import {
  Phone,
  MessageCircle,
  CheckCircle2,
  PhoneOff,
  Clock,
  XCircle,
  Play,
  Pause,
  Square,
  Search,
  Eye,
  RefreshCw,
  Filter,
  Headset,
  X,
  Check,
  AlertCircle,
  ShieldAlert,
  Ban,
  Edit2
} from 'lucide-react';

interface ConfirmationCenterProps {
  onViewPackage: (pkg: PackageItem) => void;
  onReportToBlacklist?: (pkg: PackageItem) => void;
}

type QueueFilterTab = 'pending' | 'retry' | 'confirmed' | 'cancelled' | 'all';

function formatDurationHMS(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const hrs = Math.floor(s / 3600);
  const mins = Math.floor((s % 3600) / 60);
  const secs = s % 60;
  return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

const OUTCOME_BADGE_MAP: Record<ConfirmationOutcome, { label: string; cls: string }> = {
  confirme: { label: 'تم التأكيد', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  pas_de_reponse: { label: 'لا يرد', cls: 'bg-amber-50 text-amber-800 border-amber-200' },
  reporte: { label: 'مؤجل', cls: 'bg-sky-50 text-sky-700 border-sky-200' },
  annule: { label: 'ملغى', cls: 'bg-rose-50 text-rose-700 border-rose-200' },
  injoignable: { label: 'غير مشغل', cls: 'bg-slate-100 text-slate-700 border-slate-200' },
  whatsapp_sent: { label: 'رسالة واتساب', cls: 'bg-green-50 text-green-700 border-green-200' }
};

export const ConfirmationCenter: React.FC<ConfirmationCenterProps> = ({
  onViewPackage,
  onReportToBlacklist
}) => {
  const { packages, cities, companySettings, upsertPackageLocal, refreshPackages, findBlacklistMatches } =
    useDatabase();
  const { currentUser, isAdmin } = useAuth();

  const [queueTab, setQueueTab] = useState<QueueFilterTab>('pending');
  const [searchQuery, setSearchQuery] = useState('');
  const [cityFilter, setCityFilter] = useState('all');
  const [agentFilter, setAgentFilter] = useState('all');

  const [myOverview, setMyOverview] = useState<StaffControlMemberOverview | null>(null);
  const [allMembers, setAllMembers] = useState<StaffControlMemberOverview[]>([]);
  const [recentLogs, setRecentLogs] = useState<ConfirmationActionLog[]>([]);
  const [isLoadingOverview, setIsLoadingOverview] = useState(true);
  const [isShiftBusy, setIsShiftBusy] = useState(false);
  const [busyPackageId, setBusyPackageId] = useState<string | null>(null);
  const [feedbackBanner, setFeedbackBanner] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Live 1s ticking worked seconds counter when active
  const [liveWorkedSeconds, setLiveWorkedSeconds] = useState(0);

  // Note modal state for Reporté / Annulé / Custom Note
  const [noteModal, setNoteModal] = useState<{
    pkg: PackageItem;
    outcome: ConfirmationOutcome;
    title: string;
    placeholder: string;
  } | null>(null);
  const [noteInput, setNoteInput] = useState('');
  const [editingPackage, setEditingPackage] = useState<PackageItem | null>(null);

  const canEditPackage =
    currentUser?.role !== 'employee' || hasEmployeePermission(currentUser, 'can_edit');

  const showFeedback = (type: 'success' | 'error', text: string) => {
    setFeedbackBanner({ type, text });
  };

  useEffect(() => {
    if (!feedbackBanner) return;
    const t = setTimeout(() => setFeedbackBanner(null), 4000);
    return () => clearTimeout(t);
  }, [feedbackBanner]);

  const fetchOverview = useCallback(async () => {
    try {
      const json = await fetchStaffControlOverviewDirect('today');
      if (json?.success && Array.isArray(json.members)) {
        setAllMembers(json.members);
        const me = json.members.find((m: StaffControlMemberOverview) => m.user.id === currentUser?.id) || null;
        setMyOverview(me);
        if (me) {
          setLiveWorkedSeconds(me.todayWorkedSeconds || 0);
        }
        if (Array.isArray(json.confirmationLogs)) {
          setRecentLogs(json.confirmationLogs);
        }
      }
    } catch {
      // ignore transient poll failures
    } finally {
      setIsLoadingOverview(false);
    }
  }, [currentUser?.id]);

  useEffect(() => {
    fetchOverview();
    const interval = setInterval(fetchOverview, 20000);
    return () => clearInterval(interval);
  }, [fetchOverview]);

  // 1-second local ticker when my shift is active
  useEffect(() => {
    if (myOverview?.workStatus !== 'working') return;
    const timer = setInterval(() => {
      setLiveWorkedSeconds(prev => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [myOverview?.workStatus]);

  const handleShiftAction = async (action: 'start' | 'pause' | 'resume' | 'end') => {
    setIsShiftBusy(true);
    try {
      const json = await handleStaffShiftDirect({ action });
      if (!json.success) {
        showFeedback('error', json.error || 'تعذر تحديث حالة العمل.');
      } else {
        const msgMap = {
          start: 'بدأت حصة العمل بنجاح — الله يعاونك',
          pause: 'تم تفعيل الاستراحة المؤقتة',
          resume: 'تم استئناف العمل',
          end: 'تم تسجيل نهاية العمل وحفظ الساعات'
        };
        showFeedback('success', msgMap[action]);
        await fetchOverview();
      }
    } catch {
      showFeedback('error', 'خطأ في الاتصال بالسيرفر.');
    } finally {
      setIsShiftBusy(false);
    }
  };

  const submitConfirmationAction = async (
    pkg: PackageItem,
    outcome: ConfirmationOutcome,
    channel: 'whatsapp' | 'appel' | 'manuel' = 'appel',
    note?: string
  ) => {
    if (outcome !== 'whatsapp_sent') {
      setBusyPackageId(pkg.id);
    }
    try {
      const json = await handleConfirmationActionDirect({
        packageId: pkg.id,
        trackingNumber: pkg.trackingNumber,
        outcome,
        channel,
        note,
        recipientName: pkg.recipientName,
        recipientPhone: pkg.recipientPhone,
        city: pkg.city,
        codAmount: pkg.codAmount
      });
      if (!json.success) {
        if (outcome !== 'whatsapp_sent') {
          showFeedback('error', json.error || 'تعذر حفظ حالة التأكيد.');
        }
        return;
      }

      if (json.packagePatch) {
        const { historyEntry, ...patchFields } = json.packagePatch;
        upsertPackageLocal({
          ...pkg,
          ...patchFields,
          history: historyEntry ? [...(pkg.history || []), historyEntry] : pkg.history
        });
      }
      if (json.log) {
        setRecentLogs(prev => [json.log, ...prev].slice(0, 150));
      }

      if (outcome !== 'whatsapp_sent') {
        const label = OUTCOME_BADGE_MAP[outcome]?.label || outcome;
        showFeedback('success', `${pkg.trackingNumber} — ${label}`);
      }
      void fetchOverview();
    } catch {
      if (outcome !== 'whatsapp_sent') {
        showFeedback('error', 'تعذر الاتصال بالسيرفر.');
      }
    } finally {
      setBusyPackageId(null);
    }
  };

  const isEmployeeUser = currentUser?.role === 'employee';
  const employeeAssignedCities = useMemo(() => getUserAssignedCities(currentUser), [currentUser]);
  const scopedPackages = useMemo(
    () =>
      isEmployeeUser && employeeAssignedCities.length > 0
        ? packages.filter(p => isCityAllowedForUser(currentUser, p.city))
        : packages,
    [isEmployeeUser, employeeAssignedCities, packages, currentUser]
  );

  // Derive queue buckets
  const classifiedPackages = useMemo(() => {
    const pending: PackageItem[] = [];
    const retry: PackageItem[] = [];
    const confirmed: PackageItem[] = [];
    const cancelled: PackageItem[] = [];

    for (const pkg of scopedPackages) {
      const cStat = pkg.confirmationStatus;
      if (cStat === 'confirme') {
        confirmed.push(pkg);
      } else if (cStat === 'annule' || pkg.status === 'annule' || pkg.status === 'refuse') {
        cancelled.push(pkg);
      } else if (
        cStat === 'pas_de_reponse' ||
        cStat === 'reporte' ||
        cStat === 'injoignable' ||
        pkg.status === 'pas_de_reponse' ||
        pkg.status === 'reporte'
      ) {
        retry.push(pkg);
      } else if (pkg.status === 'nouveau' || (!cStat && pkg.status === 'attente_ramassage')) {
        pending.push(pkg);
      }
    }
    return { pending, retry, confirmed, cancelled };
  }, [scopedPackages]);

  const filteredQueue = useMemo(() => {
    let baseList: PackageItem[] = scopedPackages;
    if (queueTab === 'pending') baseList = classifiedPackages.pending;
    else if (queueTab === 'retry') baseList = classifiedPackages.retry;
    else if (queueTab === 'confirmed') baseList = classifiedPackages.confirmed;
    else if (queueTab === 'cancelled') baseList = classifiedPackages.cancelled;

    const q = searchQuery.trim().toLowerCase();
    return baseList.filter(pkg => {
      if (cityFilter !== 'all' && pkg.city !== cityFilter) return false;
      if (agentFilter !== 'all' && pkg.confirmedById !== agentFilter) return false;
      if (!q) return true;
      return (
        (pkg.trackingNumber || '').toLowerCase().includes(q) ||
        (pkg.recipientName || '').toLowerCase().includes(q) ||
        String(pkg.recipientPhone || '').toLowerCase().includes(q) ||
        (pkg.city || '').toLowerCase().includes(q) ||
        (pkg.clientCompany || pkg.clientName || '').toLowerCase().includes(q)
      );
    });
  }, [scopedPackages, classifiedPackages, queueTab, searchQuery, cityFilter, agentFilter]);

  const todayIso = new Date().toISOString().slice(0, 10);
  const kpiStats = useMemo(() => {
    const waitingCount = classifiedPackages.pending.length + classifiedPackages.retry.length;
    const confirmedTodayCount = recentLogs.filter(
      l => l.outcome === 'confirme' && (l.timestamp || '').slice(0, 10) === todayIso
    ).length;
    const retryCount = classifiedPackages.retry.length;
    const handledLogs = recentLogs.filter(l => l.outcome !== 'whatsapp_sent');
    const confirmedAllLogs = handledLogs.filter(l => l.outcome === 'confirme').length;
    const confRate = handledLogs.length > 0 ? Math.round((confirmedAllLogs / handledLogs.length) * 100) : 0;
    return { waitingCount, confirmedTodayCount, retryCount, confRate };
  }, [classifiedPackages, recentLogs, todayIso]);

  const myDailyTarget = myOverview?.user?.dailyTargetConfirmations || currentUser?.dailyTargetConfirmations || 30;
  const myTodayConfirmed = myOverview?.performance?.todayConfirmed || 0;
  const targetPct = Math.min(100, Math.round((myTodayConfirmed / Math.max(1, myDailyTarget)) * 100));
  const workStatus = myOverview?.workStatus || 'off';
  const currentShift: StaffWorkShift | null = myOverview?.currentShift || null;

  const uniqueCities = useMemo(() => {
    const cityList =
      isEmployeeUser && employeeAssignedCities.length > 0
        ? cities.filter(c => isCityAllowedForUser(currentUser, c.name))
        : cities;
    const set = new Set<string>(cityList.map(c => c.name));
    scopedPackages.forEach(p => {
      if (p.city) set.add(p.city);
    });
    return Array.from(set).sort();
  }, [cities, scopedPackages, isEmployeeUser, employeeAssignedCities, currentUser]);

  return (
    <div className="space-y-5" dir="rtl">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-red-600 text-white flex items-center justify-center shrink-0">
              <Headset className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-black text-slate-900 tracking-tight">
                مركز التأكيد — Confirmation Center
              </h2>
              <p className="text-xs text-slate-500">
                تأكيد الطلبيات الجديدة عبر واتساب أو الهاتف ومتابعة الحصة اليومية مباشرة
              </p>
            </div>
          </div>
        </div>

        <button
          onClick={() => {
            void refreshPackages();
            void fetchOverview();
          }}
          className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-xl whitespace-nowrap shrink-0 cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoadingOverview ? 'animate-spin' : ''}`} />
          <span>تحديث القائمة</span>
        </button>
      </div>

      {/* Feedback Banner */}
      {feedbackBanner && (
        <div
          className={`flex items-center justify-between px-4 py-2.5 rounded-xl border text-xs font-bold ${
            feedbackBanner.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-rose-50 border-rose-200 text-rose-800'
          }`}
        >
          <div className="flex items-center gap-2">
            {feedbackBanner.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 shrink-0" />
            )}
            <span>{feedbackBanner.text}</span>
          </div>
          <button onClick={() => setFeedbackBanner(null)} className="p-0.5 hover:opacity-70 cursor-pointer">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Live Shift & Agent Performance Bar */}
      <div className="bg-white border border-slate-200 rounded-xl p-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-4">
            {/* Connection & Work Status */}
            <div className="flex items-center gap-3">
              <div className="relative w-10 h-10 rounded-xl bg-slate-900 text-white font-black flex items-center justify-center text-sm shrink-0">
                {(currentUser?.name || 'A').charAt(0)}
                <span
                  className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white ${
                    workStatus === 'working'
                      ? 'bg-emerald-500'
                      : workStatus === 'break'
                      ? 'bg-amber-500'
                      : 'bg-slate-400'
                  }`}
                />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-extrabold text-slate-900">{currentUser?.name}</span>
                  <span
                    className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${
                      workStatus === 'working'
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        : workStatus === 'break'
                        ? 'bg-amber-50 text-amber-800 border-amber-200'
                        : 'bg-slate-100 text-slate-600 border-slate-200'
                    }`}
                  >
                    {workStatus === 'working'
                      ? 'خدام الآن'
                      : workStatus === 'break'
                      ? 'في استراحة'
                      : 'حصة العمل متوقفة'}
                  </span>
                </div>
                <div className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-3">
                  <span>
                    ساعات اليوم:{' '}
                    <strong className="font-mono tabular-nums text-slate-900 text-xs">
                      {formatDurationHMS(liveWorkedSeconds)}
                    </strong>
                  </span>
                  {currentShift?.startedAt && (
                    <span>
                      بداية الحصة:{' '}
                      <strong className="font-mono tabular-nums text-slate-700">
                        {new Date(currentShift.startedAt).toLocaleTimeString('fr-MA', {
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </strong>
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Daily Target Progress */}
            <div className="min-w-[200px] flex-1 max-w-xs">
              <div className="flex items-center justify-between text-[11px] font-bold mb-1">
                <span className="text-slate-600">الهدف اليومي للتأكيد</span>
                <span className="font-mono tabular-nums text-slate-900">
                  {myTodayConfirmed} / {myDailyTarget} ({targetPct}%)
                </span>
              </div>
              <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-emerald-600 transition-all duration-300"
                  style={{ width: `${targetPct}%` }}
                />
              </div>
            </div>
          </div>

          {/* Shift Control Actions */}
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {workStatus === 'off' && (
              <button
                disabled={isShiftBusy}
                onClick={() => handleShiftAction('start')}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-bold rounded-lg whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Play className="w-3.5 h-3.5" />
                <span>بدء العمل</span>
              </button>
            )}
            {workStatus === 'working' && (
              <>
                <button
                  disabled={isShiftBusy}
                  onClick={() => handleShiftAction('pause')}
                  className="inline-flex items-center gap-1.5 px-3 py-2 bg-amber-50 hover:bg-amber-100 border border-amber-200 disabled:opacity-50 text-amber-800 text-xs font-bold rounded-lg whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <Pause className="w-3.5 h-3.5" />
                  <span>استراحة</span>
                </button>
                <button
                  disabled={isShiftBusy}
                  onClick={() => handleShiftAction('end')}
                  className="inline-flex items-center gap-1.5 px-3 py-2 bg-rose-50 hover:bg-rose-100 border border-rose-200 disabled:opacity-50 text-rose-700 text-xs font-bold rounded-lg whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <Square className="w-3.5 h-3.5" />
                  <span>إنهاء العمل</span>
                </button>
              </>
            )}
            {workStatus === 'break' && (
              <>
                <button
                  disabled={isShiftBusy}
                  onClick={() => handleShiftAction('resume')}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-bold rounded-lg whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <Play className="w-3.5 h-3.5" />
                  <span>استئناف العمل</span>
                </button>
                <button
                  disabled={isShiftBusy}
                  onClick={() => handleShiftAction('end')}
                  className="inline-flex items-center gap-1.5 px-3 py-2 bg-rose-50 hover:bg-rose-100 border border-rose-200 disabled:opacity-50 text-rose-700 text-xs font-bold rounded-lg whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <Square className="w-3.5 h-3.5" />
                  <span>إنهاء العمل</span>
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* 4 KPI Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <span className="text-[11px] font-bold text-slate-500 block">تنتظر التأكيد</span>
          <div className="mt-1 text-2xl font-black font-mono tabular-nums text-slate-900">
            {kpiStats.waitingCount}
          </div>
          <span className="text-[11px] text-slate-500 mt-0.5 block">طلبات جديدة + إعادة محاولة</span>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <span className="text-[11px] font-bold text-slate-500 block">مؤكدة اليوم</span>
          <div className="mt-1 text-2xl font-black font-mono tabular-nums text-emerald-600">
            {kpiStats.confirmedTodayCount}
          </div>
          <span className="text-[11px] text-slate-500 mt-0.5 block">تم تأكيدها وإرسالها للتحضير</span>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <span className="text-[11px] font-bold text-slate-500 block">لا يرد / مؤجلة</span>
          <div className="mt-1 text-2xl font-black font-mono tabular-nums text-amber-600">
            {kpiStats.retryCount}
          </div>
          <span className="text-[11px] text-slate-500 mt-0.5 block">تحتاج متابعة جديدة</span>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <span className="text-[11px] font-bold text-slate-500 block">نسبة التأكيد الإجمالية</span>
          <div className="mt-1 text-2xl font-black font-mono tabular-nums text-slate-900">
            {kpiStats.confRate}%
          </div>
          <span className="text-[11px] text-slate-500 mt-0.5 block">من مجموع المكالمات المعالجة</span>
        </div>
      </div>

      {/* Queue Filters & Segmented Tabs */}
      <div className="bg-white border border-slate-200 rounded-xl p-3 space-y-3">
        <div className="flex flex-wrap items-center gap-1.5 border-b border-slate-100 pb-3">
          {(
            [
              { id: 'pending', label: 'تنتظر التأكيد', count: classifiedPackages.pending.length },
              { id: 'retry', label: 'إعادة المحاولة', count: classifiedPackages.retry.length },
              { id: 'confirmed', label: 'المؤكدة', count: classifiedPackages.confirmed.length },
              { id: 'cancelled', label: 'الملغاة', count: classifiedPackages.cancelled.length },
              { id: 'all', label: 'كل الطرود', count: packages.length }
            ] as const
          ).map(tab => (
            <button
              key={tab.id}
              onClick={() => setQueueTab(tab.id)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                queueTab === tab.id
                  ? 'bg-slate-900 text-white'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              <span>{tab.label}</span>
              <span
                className={`px-1.5 py-0.2 rounded text-[10px] font-mono tabular-nums ${
                  queueTab === tab.id ? 'bg-white/20 text-white' : 'bg-white text-slate-600'
                }`}
              >
                {tab.count}
              </span>
            </button>
          ))}
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="بحث بالكود، إسم الزبون، رقم الهاتف، أو المتجر..."
              className="w-full pr-9 pl-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-500"
            />
          </div>

          <div className="flex items-center gap-2">
            <Filter className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <select
              value={cityFilter}
              onChange={e => setCityFilter(e.target.value)}
              className="text-xs font-semibold px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800"
            >
              <option value="all">كل المدن</option>
              {uniqueCities.map(c => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>

            {isAdmin && allMembers.length > 0 && (
              <select
                value={agentFilter}
                onChange={e => setAgentFilter(e.target.value)}
                className="text-xs font-semibold px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800"
              >
                <option value="all">كل العمال</option>
                {allMembers.map(m => (
                  <option key={m.user.id} value={m.user.id}>
                    {m.user.name}
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>
      </div>

      {/* Queue List - Desktop Table */}
      <div className="hidden lg:block bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold text-[11px]">
              <tr>
                <th className="px-4 py-3">الكود والمتجر</th>
                <th className="px-4 py-3">الزبون والهاتف</th>
                <th className="px-4 py-3">المدينة والعنوان</th>
                <th className="px-4 py-3">المنتوج والمبلغ</th>
                <th className="px-4 py-3">حالة التأكيد</th>
                <th className="px-4 py-3 text-left">إجراءات التأكيد السريعة</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredQueue.map(pkg => {
                const isBusy = busyPackageId === pkg.id;
                const waValid = hasValidRecipientWhatsApp(pkg.recipientPhone);
                const waUrl = waValid
                  ? buildRecipientConfirmationWhatsAppUrl(pkg, companySettings?.companyName)
                  : '#';
                const statusMeta = PACKAGE_STATUS_CONFIG[pkg.status];
                const cStat = pkg.confirmationStatus;
                const badgeInfo = cStat && OUTCOME_BADGE_MAP[cStat as ConfirmationOutcome];

                return (
                  <tr key={pkg.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="px-4 py-3">
                      <span className="font-mono font-extrabold text-slate-900 block force-ltr text-right">
                        {pkg.trackingNumber}
                      </span>
                      <span className="text-[11px] text-slate-500 block">
                        {pkg.clientCompany || pkg.clientName}
                      </span>
                    </td>

                    <td className="px-4 py-3">
                      <span className="font-bold text-slate-900 block">{pkg.recipientName}</span>
                      <a
                        href={`tel:${pkg.recipientPhone}`}
                        className="inline-flex items-center gap-1 text-[11px] font-mono text-blue-700 hover:underline mt-0.5 force-ltr"
                      >
                        <Phone className="w-3 h-3" />
                        <span>{pkg.recipientPhone}</span>
                      </a>
                      {(() => {
                        const bl = findBlacklistMatches(pkg.recipientPhone);
                        if (bl.reportCount === 0) return null;
                        return (
                          <span
                            title={`اللائحة السوداء (${bl.reportCount} بلاغات): ${bl.latestComment}`}
                            className="mt-1 inline-flex items-center gap-1 px-2 py-0.5 rounded bg-rose-100 border border-rose-300 text-rose-800 text-[10px] font-black"
                          >
                            <ShieldAlert className="w-3 h-3 shrink-0" />
                            <span>اللائحة السوداء ({bl.reportCount})</span>
                          </span>
                        );
                      })()}
                    </td>

                    <td className="px-4 py-3">
                      <span className="font-semibold text-slate-800 block">{pkg.city}</span>
                      <span className="text-[11px] text-slate-500 line-clamp-1 max-w-[180px]">
                        {pkg.address || '-'}
                      </span>
                    </td>

                    <td className="px-4 py-3">
                      <span className="font-mono tabular-nums font-extrabold text-slate-900 block">
                        {pkg.codAmount} DH
                      </span>
                      <span className="text-[11px] text-slate-500 line-clamp-1 max-w-[160px]">
                        {pkg.description || 'طلبية'}
                      </span>
                    </td>

                    <td className="px-4 py-3">
                      <div className="space-y-1">
                        {badgeInfo ? (
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold border ${badgeInfo.cls}`}
                          >
                            {badgeInfo.label}
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                            {statusMeta?.label || pkg.status}
                          </span>
                        )}
                        {(pkg.confirmationAttempts || 0) > 0 && (
                          <span className="block text-[10px] text-slate-500 font-mono tabular-nums">
                            محاولات: {pkg.confirmationAttempts}
                            {pkg.confirmedByName ? ` • ${pkg.confirmedByName}` : ''}
                          </span>
                        )}
                        {pkg.confirmationNote && (
                          <span className="block text-[10px] text-slate-600 line-clamp-1 max-w-[160px]">
                            “{pkg.confirmationNote}”
                          </span>
                        )}
                      </div>
                    </td>

                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1.5 flex-wrap">
                        {waValid && (
                          <a
                            href={waUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={() => void submitConfirmationAction(pkg, 'whatsapp_sent', 'whatsapp')}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-[#25D366] hover:bg-[#1ebe5d] text-white text-[11px] font-bold rounded-lg whitespace-nowrap shrink-0"
                            title="تأكيد عبر واتساب"
                          >
                            <MessageCircle className="w-3.5 h-3.5" />
                            <span>واتساب</span>
                          </a>
                        )}

                        <button
                          disabled={isBusy}
                          onClick={() => void submitConfirmationAction(pkg, 'confirme', 'appel')}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-[11px] font-bold rounded-lg whitespace-nowrap shrink-0 cursor-pointer"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>تأكيد</span>
                        </button>

                        <button
                          disabled={isBusy}
                          onClick={() => void submitConfirmationAction(pkg, 'pas_de_reponse', 'appel')}
                          className="inline-flex items-center gap-1 px-2 py-1.5 bg-amber-50 hover:bg-amber-100 border border-amber-200 disabled:opacity-50 text-amber-800 text-[11px] font-bold rounded-lg whitespace-nowrap shrink-0 cursor-pointer"
                        >
                          <PhoneOff className="w-3.5 h-3.5" />
                          <span>لا يرد</span>
                        </button>

                        <button
                          disabled={isBusy}
                          onClick={() => {
                            setNoteInput(pkg.confirmationNote || '');
                            setNoteModal({
                              pkg,
                              outcome: 'reporte',
                              title: `تأجيل الطلبية #${pkg.trackingNumber}`,
                              placeholder: 'مثال: الزبون طلب التوصيل غداً بعد الساعة 16:00'
                            });
                          }}
                          className="inline-flex items-center gap-1 px-2 py-1.5 bg-sky-50 hover:bg-sky-100 border border-sky-200 disabled:opacity-50 text-sky-700 text-[11px] font-bold rounded-lg whitespace-nowrap shrink-0 cursor-pointer"
                        >
                          <Clock className="w-3.5 h-3.5" />
                          <span>تأجيل</span>
                        </button>

                        <button
                          disabled={isBusy}
                          onClick={() => {
                            setNoteInput(pkg.confirmationNote || '');
                            setNoteModal({
                              pkg,
                              outcome: 'annule',
                              title: `إلغاء الطلبية #${pkg.trackingNumber}`,
                              placeholder: 'سبب الإلغاء (مثال: الزبون تراجع عن الطلب)...'
                            });
                          }}
                          className="inline-flex items-center gap-1 px-2 py-1.5 bg-rose-50 hover:bg-rose-100 border border-rose-200 disabled:opacity-50 text-rose-700 text-[11px] font-bold rounded-lg whitespace-nowrap shrink-0 cursor-pointer"
                        >
                          <XCircle className="w-3.5 h-3.5" />
                          <span>إلغاء</span>
                        </button>

                        {onReportToBlacklist && (
                          <button
                            onClick={() => onReportToBlacklist(pkg)}
                            className="p-1.5 text-rose-600 hover:text-rose-800 hover:bg-rose-50 rounded-lg cursor-pointer"
                            title="إضافة هذا الزبون للائحة السوداء (Blacklist)"
                          >
                            <Ban className="w-4 h-4" />
                          </button>
                        )}

                        {canEditPackage && (
                          <button
                            type="button"
                            onClick={() => setEditingPackage(pkg)}
                            className="inline-flex items-center gap-1 px-2 py-1.5 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-indigo-700 text-[11px] font-bold rounded-lg whitespace-nowrap shrink-0 cursor-pointer"
                            title="تعديل الكموند"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                            <span>تعديل</span>
                          </button>
                        )}

                        <button
                          onClick={() => onViewPackage(pkg)}
                          className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg cursor-pointer"
                          title="تفاصيل الطرد"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}

              {filteredQueue.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-slate-400 text-xs font-semibold">
                    لا توجد طلبيات مطابقة في هذه الخانة حالياً.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mobile Cards */}
      <div className="lg:hidden space-y-3">
        {filteredQueue.map(pkg => {
          const isBusy = busyPackageId === pkg.id;
          const waValid = hasValidRecipientWhatsApp(pkg.recipientPhone);
          const waUrl = waValid
            ? buildRecipientConfirmationWhatsAppUrl(pkg, companySettings?.companyName)
            : '#';
          const cStat = pkg.confirmationStatus;
          const badgeInfo = cStat && OUTCOME_BADGE_MAP[cStat as ConfirmationOutcome];

          return (
            <div key={pkg.id} className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <span className="font-mono font-black text-slate-900 text-sm block force-ltr text-right">
                    {pkg.trackingNumber}
                  </span>
                  <span className="text-[11px] text-slate-500">{pkg.clientCompany || pkg.clientName}</span>
                </div>
                <span className="font-mono tabular-nums font-black text-sm text-slate-900">
                  {pkg.codAmount} DH
                </span>
              </div>

              <div className="text-xs space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-900">{pkg.recipientName}</span>
                  <span className="text-slate-600 font-semibold">{pkg.city}</span>
                </div>
                <div className="flex items-center justify-between text-[11px]">
                  <a href={`tel:${pkg.recipientPhone}`} className="font-mono text-blue-700 font-bold force-ltr">
                    {pkg.recipientPhone}
                  </a>
                  {badgeInfo && (
                    <span className={`px-2 py-0.5 rounded border text-[10px] font-bold ${badgeInfo.cls}`}>
                      {badgeInfo.label}
                    </span>
                  )}
                </div>
                {(() => {
                  const bl = findBlacklistMatches(pkg.recipientPhone);
                  if (bl.reportCount === 0) return null;
                  return (
                    <div className="mt-1 px-2 py-1 rounded bg-rose-50 border border-rose-300 text-rose-800 text-[10px] font-black flex items-center gap-1.5">
                      <ShieldAlert className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                      <span>اللائحة السوداء ({bl.reportCount}): {bl.latestComment}</span>
                    </div>
                  );
                })()}
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-2 border-t border-slate-100">
                {waValid && (
                  <a
                    href={waUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => void submitConfirmationAction(pkg, 'whatsapp_sent', 'whatsapp')}
                    className="inline-flex items-center justify-center gap-1 py-2 bg-[#25D366] text-white text-xs font-bold rounded-lg"
                  >
                    <MessageCircle className="w-3.5 h-3.5" />
                    <span>واتساب</span>
                  </a>
                )}
                <a
                  href={`tel:${pkg.recipientPhone}`}
                  className="inline-flex items-center justify-center gap-1 py-2 bg-slate-100 text-slate-800 text-xs font-bold rounded-lg"
                >
                  <Phone className="w-3.5 h-3.5" />
                  <span>اتصال</span>
                </a>
                <button
                  disabled={isBusy}
                  onClick={() => void submitConfirmationAction(pkg, 'confirme', 'appel')}
                  className="inline-flex items-center justify-center gap-1 py-2 bg-emerald-600 text-white text-xs font-bold rounded-lg cursor-pointer"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>تأكيد</span>
                </button>
                <button
                  disabled={isBusy}
                  onClick={() => void submitConfirmationAction(pkg, 'pas_de_reponse', 'appel')}
                  className="inline-flex items-center justify-center gap-1 py-2 bg-amber-50 border border-amber-200 text-amber-800 text-xs font-bold rounded-lg cursor-pointer"
                >
                  <PhoneOff className="w-3.5 h-3.5" />
                  <span>لا يرد</span>
                </button>
                <button
                  disabled={isBusy}
                  onClick={() => {
                    setNoteInput(pkg.confirmationNote || '');
                    setNoteModal({
                      pkg,
                      outcome: 'reporte',
                      title: `تأجيل الطلبية #${pkg.trackingNumber}`,
                      placeholder: 'تاريخ أو ساعة التوصيل المطلوبة...'
                    });
                  }}
                  className="inline-flex items-center justify-center gap-1 py-2 bg-sky-50 border border-sky-200 text-sky-700 text-xs font-bold rounded-lg cursor-pointer"
                >
                  <Clock className="w-3.5 h-3.5" />
                  <span>تأجيل</span>
                </button>
                <button
                  disabled={isBusy}
                  onClick={() => {
                    setNoteInput(pkg.confirmationNote || '');
                    setNoteModal({
                      pkg,
                      outcome: 'annule',
                      title: `إلغاء الطلبية #${pkg.trackingNumber}`,
                      placeholder: 'سبب الإلغاء...'
                    });
                  }}
                  className="inline-flex items-center justify-center gap-1 py-2 bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold rounded-lg cursor-pointer"
                >
                  <XCircle className="w-3.5 h-3.5" />
                  <span>إلغاء</span>
                </button>
                {canEditPackage && (
                  <button
                    type="button"
                    onClick={() => setEditingPackage(pkg)}
                    className="inline-flex items-center justify-center gap-1 py-2 bg-indigo-50 border border-indigo-200 text-indigo-700 text-xs font-bold rounded-lg cursor-pointer"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                    <span>تعديل</span>
                  </button>
                )}
              </div>
            </div>
          );
        })}
        {filteredQueue.length === 0 && (
          <div className="bg-white border border-slate-200 rounded-xl p-8 text-center text-xs text-slate-400 font-semibold">
            لا توجد طلبيات مطابقة في هذه الخانة حالياً.
          </div>
        )}
      </div>

      {/* Recent Confirmation Activity Log */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
          <h3 className="text-xs font-extrabold text-slate-900">
            سجل عمليات التأكيد الأخيرة ({recentLogs.length})
          </h3>
          <span className="text-[11px] text-slate-500">يتم تسجيل كل عملية باسم الموظف والوقت</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead className="border-b border-slate-100 text-slate-500 text-[11px]">
              <tr>
                <th className="px-4 py-2.5">الوقت</th>
                <th className="px-4 py-2.5">الموظف</th>
                <th className="px-4 py-2.5">الكود</th>
                <th className="px-4 py-2.5">الزبون</th>
                <th className="px-4 py-2.5">النتيجة</th>
                <th className="px-4 py-2.5">القناة</th>
                <th className="px-4 py-2.5">ملاحظة</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {recentLogs.slice(0, 15).map(log => {
                const badge = OUTCOME_BADGE_MAP[log.outcome];
                return (
                  <tr key={log.id} className="hover:bg-slate-50">
                    <td className="px-4 py-2 font-mono tabular-nums text-[11px] text-slate-500 whitespace-nowrap">
                      {new Date(log.timestamp).toLocaleString('fr-MA', {
                        month: '2-digit',
                        day: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </td>
                    <td className="px-4 py-2 font-bold text-slate-900 whitespace-nowrap">{log.employeeName}</td>
                    <td className="px-4 py-2 font-mono text-slate-800 whitespace-nowrap force-ltr text-right">
                      {log.trackingNumber}
                    </td>
                    <td className="px-4 py-2 text-slate-700 whitespace-nowrap">
                      {log.recipientName} <span className="text-slate-400">({log.city})</span>
                    </td>
                    <td className="px-4 py-2 whitespace-nowrap">
                      <span className={`px-2 py-0.5 rounded border text-[10px] font-bold ${badge.cls}`}>
                        {badge.label}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-[11px] font-semibold text-slate-600 whitespace-nowrap">
                      {log.channel === 'whatsapp' ? 'واتساب' : log.channel === 'appel' ? 'مكالمة' : 'يدوي'}
                    </td>
                    <td className="px-4 py-2 text-[11px] text-slate-500 max-w-xs truncate">
                      {log.note || '-'}
                    </td>
                  </tr>
                );
              })}
              {recentLogs.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-6 text-center text-slate-400 text-xs">
                    لم يتم تسجيل أي عملية تأكيد بعد.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Quick Note Modal for Reporte / Annule */}
      {noteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="w-full max-w-md bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-200 bg-slate-50">
              <h3 className="text-sm font-extrabold text-slate-900">{noteModal.title}</h3>
              <button
                onClick={() => setNoteModal(null)}
                className="p-1 text-slate-400 hover:text-slate-700 rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  ملاحظة أو سبب التحديث (اختياري)
                </label>
                <textarea
                  rows={3}
                  value={noteInput}
                  onChange={e => setNoteInput(e.target.value)}
                  placeholder={noteModal.placeholder}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-500"
                />
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setNoteModal(null)}
                  className="px-3.5 py-2 text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const target = noteModal;
                    setNoteModal(null);
                    void submitConfirmationAction(target.pkg, target.outcome, 'appel', noteInput);
                  }}
                  className="px-4 py-2 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-lg cursor-pointer"
                >
                  حفظ وتحديث الحالة
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <EditPackageModal
        packageItem={editingPackage}
        isOpen={Boolean(editingPackage)}
        onClose={() => setEditingPackage(null)}
        onSaved={() => showFeedback('success', 'تم تعديل معلومات الطلبية بنجاح.')}
      />
    </div>
  );
};
