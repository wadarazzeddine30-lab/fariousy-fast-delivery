import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useDatabase } from '../../context/DatabaseContext';
import { useAuth } from '../../context/AuthContext';
import {
  fetchStaffControlOverviewDirect,
  handleStaffShiftDirect,
  disconnectEmployeeDirect
} from '../../services/supabaseDirectGateway';
import {
  ConfirmationActionLog,
  EmployeeSubRole,
  StaffControlMemberOverview,
  StaffWorkShift,
  UserProfile
} from '../../types';
import {
  ALL_EMPLOYEE_PERMISSION_IDS,
  DEFAULT_PERMISSIONS_BY_ROLE,
  EMPLOYEE_ROLE_BADGES,
  EMPLOYEE_ROLE_LABELS,
  EMPLOYEE_TASK_PERMISSION_GROUPS,
  PERMISSION_SHORT_LABELS
} from '../../utils/employeePermissions';
import { ConfirmActionModal } from '../common/ConfirmActionModal';
import { exportCSV } from '../../utils/export';
import {
  Users,
  UserPlus,
  Building2,
  Phone,
  Mail,
  CheckCircle2,
  XCircle,
  Key,
  X,
  Search,
  Filter,
  Edit2,
  Trash2,
  Download,
  Activity,
  BarChart3,
  Clock,
  Play,
  Pause,
  Square,
  Power,
  RefreshCw,
  Eye,
  EyeOff,
  Award,
  Headset,
  ShieldCheck,
  AlertCircle,
  LogIn,
  MapPin,
  Sliders
} from 'lucide-react';

type AdminEmployeeTab = 'live' | 'performance' | 'accounts';
type PerfPeriod = 'today' | 'week' | 'month' | 'all';

const ROLE_LABELS: Record<EmployeeSubRole, string> = EMPLOYEE_ROLE_LABELS;

const PAGE_LABELS: Record<string, string> = {
  admin_dashboard: 'لوحة القيادة',
  admin_confirmation: 'مركز التأكيد',
  admin_packages: 'إدارة الطرود',
  admin_clients: 'الزبناء والمتاجر',
  admin_drivers: 'الموزعين',
  admin_pickups: 'طلبات الاستلام',
  admin_stock: 'المخزون',
  admin_partners: 'الشركاء',
  admin_employees: 'إدارة العمال'
};

function formatDurationHMS(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const hrs = Math.floor(s / 3600);
  const mins = Math.floor((s % 3600) / 60);
  const secs = s % 60;
  return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

function formatHoursCompact(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const hrs = Math.floor(s / 3600);
  const mins = Math.floor((s % 3600) / 60);
  return `${hrs}h ${String(mins).padStart(2, '0')}m`;
}

function formatTimeAgoArabic(iso?: string): string {
  if (!iso) return 'لم يتصل بعد';
  const diffSec = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (diffSec < 60) return `منذ ${diffSec} ثانية`;
  if (diffSec < 3600) return `منذ ${Math.floor(diffSec / 60)} دقيقة`;
  if (diffSec < 86400) return `منذ ${Math.floor(diffSec / 3600)} ساعة`;
  return `منذ ${Math.floor(diffSec / 86400)} يوم`;
}

function generatePassword(len = 8): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  let out = '';
  for (let i = 0; i < len; i++) {
    out += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return out;
}

export const AdminEmployees: React.FC = () => {
  const {
    users,
    agencies,
    cities,
    createEmployeeAccount,
    updateEmployeeAccount,
    deleteEmployeeAccount,
    toggleEmployeeStatus
  } = useDatabase();
  const { currentUser, impersonateUser } = useAuth();

  const [activeTab, setActiveTab] = useState<AdminEmployeeTab>('live');
  const [perfPeriod, setPerfPeriod] = useState<PerfPeriod>('today');
  const [search, setSearch] = useState('');
  const [selectedAgency, setSelectedAgency] = useState('all');
  const [selectedRoleFilter, setSelectedRoleFilter] = useState<'all' | EmployeeSubRole>('all');

  // Control overview state from backend
  const [members, setMembers] = useState<StaffControlMemberOverview[]>([]);
  const [shifts, setShifts] = useState<StaffWorkShift[]>([]);
  const [confirmationLogs, setConfirmationLogs] = useState<ConfirmationActionLog[]>([]);
  const [isLoadingControl, setIsLoadingControl] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [lastRefreshedAt, setLastRefreshedAt] = useState<Date | null>(null);
  const [tickOffsetSeconds, setTickOffsetSeconds] = useState(0);

  // Action feedback banner
  const [banner, setBanner] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Modals
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<UserProfile | null>(null);
  const [employeeToDelete, setEmployeeToDelete] = useState<UserProfile | null>(null);
  const [employeeToDisconnect, setEmployeeToDisconnect] = useState<StaffControlMemberOverview | null>(null);
  const [inspectedMember, setInspectedMember] = useState<StaffControlMemberOverview | null>(null);

  // Form state
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [agencyId, setAgencyId] = useState(agencies[0]?.id || 'agency-casa');
  const [employeeRole, setEmployeeRole] = useState<EmployeeSubRole>('confirmatrice');
  const [dailyTarget, setDailyTarget] = useState<number>(30);
  const [permissions, setPermissions] = useState<string[]>(DEFAULT_PERMISSIONS_BY_ROLE.confirmatrice);
  const [cityScopeMode, setCityScopeMode] = useState<'all' | 'specific'>('all');
  const [assignedCities, setAssignedCities] = useState<string[]>([]);
  const [cityPickerSearch, setCityPickerSearch] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [isSavingForm, setIsSavingForm] = useState(false);

  useEffect(() => {
    if (!banner) return;
    const t = setTimeout(() => setBanner(null), 4500);
    return () => clearTimeout(t);
  }, [banner]);

  const fetchControlOverview = useCallback(async () => {
    try {
      const json = await fetchStaffControlOverviewDirect(perfPeriod);
      if (json?.success) {
        if (Array.isArray(json.members)) setMembers(json.members);
        if (Array.isArray(json.shifts)) setShifts(json.shifts);
        if (Array.isArray(json.confirmationLogs)) setConfirmationLogs(json.confirmationLogs);
        setTickOffsetSeconds(0);
        setLastRefreshedAt(new Date());
      }
    } catch {
      // ignore transient errors
    } finally {
      setIsLoadingControl(false);
    }
  }, [perfPeriod]);

  useEffect(() => {
    fetchControlOverview();
  }, [fetchControlOverview]);

  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(fetchControlOverview, 15000);
    return () => clearInterval(interval);
  }, [autoRefresh, fetchControlOverview]);

  // Smooth 1s local clock increment for actively working staff timers
  useEffect(() => {
    const timer = setInterval(() => {
      setTickOffsetSeconds(prev => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const employeesOnlyMembers = useMemo(() => {
    const list = members.filter(m => m.user.role === 'employee');
    const q = search.trim().toLowerCase();
    return list.filter(m => {
      const matchesSearch =
        !q ||
        m.user.name.toLowerCase().includes(q) ||
        m.user.email.toLowerCase().includes(q) ||
        (m.user.phone || '').includes(q) ||
        (m.user.assignedCities || []).some(c => c.toLowerCase().includes(q));
      const matchesAgency = selectedAgency === 'all' || m.user.agencyId === selectedAgency;
      const matchesRole =
        selectedRoleFilter === 'all' || (m.user.employeeRole || 'confirmatrice') === selectedRoleFilter;
      return matchesSearch && matchesAgency && matchesRole;
    });
  }, [members, search, selectedAgency, selectedRoleFilter]);

  const allStaffMembers = useMemo(() => {
    const q = search.trim().toLowerCase();
    return members.filter(m => {
      const matchesSearch =
        !q ||
        m.user.name.toLowerCase().includes(q) ||
        m.user.email.toLowerCase().includes(q) ||
        (m.user.phone || '').includes(q) ||
        (m.user.assignedCities || []).some(c => c.toLowerCase().includes(q));
      const matchesAgency = selectedAgency === 'all' || m.user.agencyId === selectedAgency;
      const matchesRole =
        selectedRoleFilter === 'all' ||
        (m.user.role === 'employee' && (m.user.employeeRole || 'confirmatrice') === selectedRoleFilter);
      return matchesSearch && matchesAgency && matchesRole;
    });
  }, [members, search, selectedAgency, selectedRoleFilter]);

  const employees = users.filter(u => u.role === 'employee');

  const filteredAccountEmployees = employees.filter(emp => {
    const q = search.trim().toLowerCase();
    const matchesSearch =
      !q ||
      emp.name.toLowerCase().includes(q) ||
      emp.email.toLowerCase().includes(q) ||
      (emp.phone || '').includes(q) ||
      (emp.assignedCities || []).some(c => c.toLowerCase().includes(q));
    const matchesAgency = selectedAgency === 'all' || emp.agencyId === selectedAgency;
    const matchesRole =
      selectedRoleFilter === 'all' || (emp.employeeRole || 'confirmatrice') === selectedRoleFilter;
    return matchesSearch && matchesAgency && matchesRole;
  });

  const roleCounts = useMemo(() => {
    const counts: Record<string, number> = {
      support: 0,
      responsable_villes: 0,
      confirmatrice: 0,
      agent_hub: 0,
      superviseur: 0,
      polyvalent: 0
    };
    for (const emp of employees) {
      const r = emp.employeeRole || 'confirmatrice';
      counts[r] = (counts[r] || 0) + 1;
    }
    return counts;
  }, [employees]);

  const filteredPickerCities = useMemo(() => {
    const q = cityPickerSearch
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim()
      .toLowerCase();
    return cities.filter(c => {
      if (!q) return true;
      const normName = c.name
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase();
      const normRegion = (c.region || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase();
      return normName.includes(q) || normRegion.includes(q);
    });
  }, [cities, cityPickerSearch]);

  // Live summary KPIs
  const liveKpis = useMemo(() => {
    const empList = members.filter(m => m.user.role === 'employee');
    const onlineCount = empList.filter(m => m.isOnline).length;
    const workingCount = empList.filter(m => m.workStatus === 'working').length;
    const totalTodaySeconds = empList.reduce(
      (acc, m) => acc + m.todayWorkedSeconds + (m.workStatus === 'working' && m.isOnline ? tickOffsetSeconds : 0),
      0
    );
    const totalTodayConfirmed = empList.reduce((acc, m) => acc + (m.performance.todayConfirmed || 0), 0);
    return {
      totalEmployees: empList.length,
      onlineCount,
      workingCount,
      totalTodaySeconds,
      totalTodayConfirmed
    };
  }, [members, tickOffsetSeconds]);

  // Performance summary KPIs
  const perfKpis = useMemo(() => {
    const list = allStaffMembers;
    const totalHandled = list.reduce((acc, m) => acc + m.performance.totalHandled, 0);
    const totalConfirmed = list.reduce((acc, m) => acc + m.performance.totalConfirmed, 0);
    const totalCod = list.reduce((acc, m) => acc + m.performance.confirmedCodTotal, 0);
    const avgRate = totalHandled > 0 ? Math.round((totalConfirmed / totalHandled) * 100) : 0;
    return { totalHandled, totalConfirmed, totalCod, avgRate };
  }, [allStaffMembers]);

  const rankedPerformanceMembers = useMemo(() => {
    return [...allStaffMembers].sort((a, b) => {
      if (b.performance.totalConfirmed !== a.performance.totalConfirmed) {
        return b.performance.totalConfirmed - a.performance.totalConfirmed;
      }
      return b.performance.confirmationRate - a.performance.confirmationRate;
    });
  }, [allStaffMembers]);

  const handleRemoteShiftAction = async (
    targetUserId: string,
    userName: string,
    action: 'start' | 'pause' | 'resume' | 'end'
  ) => {
    try {
      const json = await handleStaffShiftDirect({ targetUserId, action });
      if (!json.success) {
        setBanner({ type: 'error', text: json.error || 'تعذر تنفيذ إجراء التحكم عن بعد.' });
        return;
      }
      const labels = {
        start: `تم بدء عمل ${userName}`,
        pause: `تم وضع ${userName} في استراحة`,
        resume: `تم استئناف عمل ${userName}`,
        end: `تم إنهاء حصة عمل ${userName}`
      };
      setBanner({ type: 'success', text: labels[action] });
      await fetchControlOverview();
    } catch {
      setBanner({ type: 'error', text: 'خطأ في الاتصال بالسيرفر.' });
    }
  };

  const handleConfirmDisconnect = async () => {
    if (!employeeToDisconnect) return;
    const target = employeeToDisconnect;
    setEmployeeToDisconnect(null);
    try {
      const json = await disconnectEmployeeDirect(target.user.id);
      if (!json.success) {
        setBanner({ type: 'error', text: 'تعذر قطع الاتصال.' });
        return;
      }
      setBanner({ type: 'success', text: json.message || `تم قطع اتصال ${target.user.name}` });
      await fetchControlOverview();
    } catch {
      setBanner({ type: 'error', text: 'خطأ في الاتصال بالسيرفر.' });
    }
  };

  const handleTogglePermission = (permId: string) => {
    if (permissions.includes(permId)) {
      setPermissions(permissions.filter(p => p !== permId));
    } else {
      setPermissions([...permissions, permId]);
    }
  };

  const handleToggleAssignedCity = (cityName: string) => {
    setAssignedCities(prev =>
      prev.includes(cityName) ? prev.filter(c => c !== cityName) : [...prev, cityName]
    );
  };

  const handleRoleChangeInForm = (newRole: EmployeeSubRole) => {
    setEmployeeRole(newRole);
    if (!editingEmployee) {
      setPermissions([...(DEFAULT_PERMISSIONS_BY_ROLE[newRole] || DEFAULT_PERMISSIONS_BY_ROLE.confirmatrice)]);
      if (newRole === 'responsable_villes' && assignedCities.length === 0) {
        setCityScopeMode('specific');
      }
    }
  };

  const handleCreateEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (!name.trim() || !email.trim() || !phone.trim()) {
      setFormError('الاسم والإيميل والهاتف إجباريين.');
      return;
    }
    if (password.trim().length < 8) {
      setFormError('خصك تحدد كلمة مرور (على الأقل 8 حروف أو أرقام) باش الموظف يقدر يدخل لحسابه.');
      return;
    }
    if (cityScopeMode === 'specific' && assignedCities.length === 0) {
      setFormError('اختر مدينة واحدة على الأقل أو فعّل خيار «جميع المدن».');
      return;
    }

    const finalAssignedCities = cityScopeMode === 'all' ? [] : assignedCities;
    setIsSavingForm(true);
    const targetAgency = agencies.find(a => a.id === agencyId);
    const res = await createEmployeeAccount(
      {
        name: name.trim(),
        email: email.trim().toLowerCase(),
        phone: phone.trim(),
        role: 'employee',
        employeeRole,
        assignedCities: finalAssignedCities,
        dailyTargetConfirmations: Number(dailyTarget) || 30,
        agencyId,
        agencyName: targetAgency?.name || 'Hub Agence',
        city: finalAssignedCities[0] || targetAgency?.city || 'Casablanca',
        status: 'active',
        accountStatus: 'approuve',
        permissions,
        password: password.trim()
      },
      currentUser ? { name: currentUser.name, role: currentUser.role } : undefined
    );
    setIsSavingForm(false);

    if (!res.success) {
      setFormError(res.error || 'تعذر إنشاء الحساب.');
      return;
    }

    setIsAddModalOpen(false);
    setBanner({ type: 'success', text: `تم إنشاء حساب ${name.trim()} (${ROLE_LABELS[employeeRole]}) بنجاح.` });
    await fetchControlOverview();
  };

  const handleOpenEdit = (emp: UserProfile) => {
    setFormError(null);
    setEditingEmployee(emp);
    setName(emp.name);
    setEmail(emp.email);
    setPhone(emp.phone);
    setPassword('');
    setShowPassword(false);
    const roleVal = emp.employeeRole || 'confirmatrice';
    setEmployeeRole(roleVal);
    setDailyTarget(emp.dailyTargetConfirmations || 30);
    setAgencyId(emp.agencyId || agencies[0]?.id || 'agency-casa');
    setPermissions(
      Array.isArray(emp.permissions) && emp.permissions.length > 0
        ? emp.permissions
        : DEFAULT_PERMISSIONS_BY_ROLE[roleVal] || DEFAULT_PERMISSIONS_BY_ROLE.confirmatrice
    );
    const existingCities = Array.isArray(emp.assignedCities) ? emp.assignedCities.filter(Boolean) : [];
    setAssignedCities(existingCities);
    setCityScopeMode(existingCities.length > 0 ? 'specific' : 'all');
    setCityPickerSearch('');
  };

  const handleUpdateEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingEmployee) return;
    setFormError(null);

    if (!name.trim() || !email.trim() || !phone.trim()) {
      setFormError('الاسم والإيميل والهاتف إجباريين.');
      return;
    }
    if (password.trim().length > 0 && password.trim().length < 8) {
      setFormError('كلمة المرور الجديدة خاصها تكون على الأقل 8 حروف.');
      return;
    }
    if (cityScopeMode === 'specific' && assignedCities.length === 0) {
      setFormError('اختر مدينة واحدة على الأقل أو فعّل خيار «جميع المدن».');
      return;
    }

    const finalAssignedCities = cityScopeMode === 'all' ? [] : assignedCities;
    setIsSavingForm(true);
    const targetAgency = agencies.find(a => a.id === agencyId);
    const res = await updateEmployeeAccount(
      editingEmployee.id,
      {
        name: name.trim(),
        email: email.trim().toLowerCase(),
        phone: phone.trim(),
        employeeRole,
        assignedCities: finalAssignedCities,
        dailyTargetConfirmations: Number(dailyTarget) || 30,
        agencyId,
        agencyName: targetAgency?.name || editingEmployee.agencyName,
        city: finalAssignedCities[0] || targetAgency?.city || editingEmployee.city || 'Casablanca',
        permissions,
        ...(password.trim().length >= 6 ? { password: password.trim() } : {})
      },
      currentUser ? { name: currentUser.name, role: currentUser.role } : undefined
    );
    setIsSavingForm(false);

    if (!res.success) {
      setFormError(res.error || 'تعذر تحديث الحساب.');
      return;
    }

    setEditingEmployee(null);
    setBanner({ type: 'success', text: `تم تحديث مهام وصلاحيات ${name.trim()} بنجاح.` });
    await fetchControlOverview();
  };

  const handleConfirmDelete = async (reason?: string) => {
    if (!employeeToDelete) return;
    const target = employeeToDelete;
    setEmployeeToDelete(null);
    const res = await deleteEmployeeAccount(target.id, reason || 'Suppression collaborateur');
    if (res.success) {
      setBanner({ type: 'success', text: `تم حذف حساب ${target.name} وقطع جلساته.` });
      await fetchControlOverview();
    } else {
      setBanner({ type: 'error', text: res.error || 'تعذر حذف الحساب.' });
    }
  };

  const handleExportAccountsCSV = () => {
    const data = filteredAccountEmployees.map(emp => ({
      ID: emp.id,
      Nom: emp.name,
      Poste: ROLE_LABELS[emp.employeeRole || 'confirmatrice'],
      Email: emp.email,
      Telephone: emp.phone,
      Agence: emp.agencyName || 'Hub Casablanca',
      Ville: emp.city || 'Casablanca',
      Villes_Assignees:
        emp.assignedCities && emp.assignedCities.length > 0 ? emp.assignedCities.join(' | ') : 'Toutes les villes',
      Statut: emp.status,
      Objectif_Jour: emp.dailyTargetConfirmations || 30,
      Permissions: (emp.permissions || []).join('; ')
    }));
    exportCSV(data, `fariousy_employes_${new Date().toISOString().substring(0, 10)}.csv`);
  };

  const handleExportPerformanceCSV = () => {
    const data = rankedPerformanceMembers.map((m, idx) => ({
      Classement: idx + 1,
      Employe: m.user.name,
      Email: m.user.email,
      Poste: m.user.role === 'employee' ? ROLE_LABELS[m.user.employeeRole || 'confirmatrice'] : m.user.role,
      Connecte: m.isOnline ? 'En ligne' : 'Hors ligne',
      Statut_Travail: m.workStatus,
      Heures_Aujourdhui: formatDurationHMS(m.todayWorkedSeconds),
      Heures_Semaine: formatHoursCompact(m.weekWorkedSeconds),
      Heures_Mois: formatHoursCompact(m.monthWorkedSeconds),
      Traites: m.performance.totalHandled,
      Confirmes: m.performance.totalConfirmed,
      Taux_Confirmation_Pct: `${m.performance.confirmationRate}%`,
      Pas_De_Reponse: m.performance.totalNoAnswer,
      Reportes: m.performance.totalPostponed,
      Annules: m.performance.totalCancelled,
      WhatsApp_Envoyes: m.performance.totalWhatsAppSent,
      Taux_Livraison_Confirmes_Pct: `${m.performance.deliveredOfConfirmedRate}%`,
      COD_Confirme_DH: m.performance.confirmedCodTotal,
      Confirmations_Par_Heure: m.performance.confirmationsPerHour
    }));
    exportCSV(data, `fariousy_performance_equipe_${perfPeriod}_${new Date().toISOString().slice(0, 10)}.csv`);
  };

  return (
    <div className="space-y-5" dir="rtl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-slate-200">
        <div>
          <h2 className="text-xl font-black text-slate-900 tracking-tight">
            مراقبة العمال، ساعات العمل والأداء — Contrôle Total
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            متابعة مباشرة لحالة الاتصال، ساعات الشغل الحقيقية، مردودية التأكيد، وإدارة حسابات العمال عن بعد
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {activeTab === 'performance' ? (
            <button
              onClick={handleExportPerformanceCSV}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-xl whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Download className="w-4 h-4 text-slate-600" />
              <span>تصدير الأداء CSV</span>
            </button>
          ) : (
            <button
              onClick={handleExportAccountsCSV}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-xl whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Download className="w-4 h-4 text-slate-600" />
              <span>تصدير اللائحة CSV</span>
            </button>
          )}

          <button
            onClick={() => {
              setFormError(null);
              setEditingEmployee(null);
              setName('');
              setEmail('');
              setPhone('');
              setPassword(generatePassword());
              setShowPassword(true);
              const initialRole: EmployeeSubRole =
                selectedRoleFilter !== 'all' ? selectedRoleFilter : 'support';
              setEmployeeRole(initialRole);
              setDailyTarget(30);
              setPermissions([...DEFAULT_PERMISSIONS_BY_ROLE[initialRole]]);
              setAssignedCities([]);
              setCityScopeMode(initialRole === 'responsable_villes' ? 'specific' : 'all');
              setCityPickerSearch('');
              setIsAddModalOpen(true);
            }}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-bold text-xs rounded-xl whitespace-nowrap shrink-0 cursor-pointer"
          >
            <UserPlus className="w-4 h-4" />
            <span>إضافة عامل جديد</span>
          </button>
        </div>
      </div>

      {/* Feedback Banner */}
      {banner && (
        <div
          className={`flex items-center justify-between px-4 py-2.5 rounded-xl border text-xs font-bold ${
            banner.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-rose-50 border-rose-200 text-rose-800'
          }`}
        >
          <div className="flex items-center gap-2">
            {banner.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
            <span>{banner.text}</span>
          </div>
          <button onClick={() => setBanner(null)} className="cursor-pointer">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Top Navigation Tabs + Auto-Refresh Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white border border-slate-200 rounded-xl p-2.5">
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            onClick={() => setActiveTab('live')}
            className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-bold whitespace-nowrap shrink-0 cursor-pointer ${
              activeTab === 'live' ? 'bg-slate-900 text-white' : 'text-slate-700 hover:bg-slate-100'
            }`}
          >
            <Activity className="w-3.5 h-3.5" />
            <span>المراقبة المباشرة وساعات العمل</span>
            <span
              className={`px-1.5 py-0.2 rounded text-[10px] font-mono tabular-nums ${
                activeTab === 'live' ? 'bg-emerald-500 text-white' : 'bg-emerald-50 text-emerald-700'
              }`}
            >
              {liveKpis.onlineCount} متصل
            </span>
          </button>

          <button
            onClick={() => setActiveTab('performance')}
            className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-bold whitespace-nowrap shrink-0 cursor-pointer ${
              activeTab === 'performance' ? 'bg-slate-900 text-white' : 'text-slate-700 hover:bg-slate-100'
            }`}
          >
            <BarChart3 className="w-3.5 h-3.5" />
            <span>الأداء والمردودية (Performance)</span>
          </button>

          <button
            onClick={() => setActiveTab('accounts')}
            className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-bold whitespace-nowrap shrink-0 cursor-pointer ${
              activeTab === 'accounts' ? 'bg-slate-900 text-white' : 'text-slate-700 hover:bg-slate-100'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>حسابات العمال والصلاحيات</span>
            <span
              className={`px-1.5 py-0.2 rounded text-[10px] font-mono tabular-nums ${
                activeTab === 'accounts' ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-700'
              }`}
            >
              {employees.length}
            </span>
          </button>
        </div>

        <div className="flex items-center gap-2 text-[11px] px-2">
          <label className="inline-flex items-center gap-1.5 cursor-pointer text-slate-600 font-semibold">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={e => setAutoRefresh(e.target.checked)}
              className="accent-red-600 rounded"
            />
            <span>تحديث تلقائي (15ث)</span>
          </label>
          <button
            onClick={() => void fetchControlOverview()}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-bold cursor-pointer"
          >
            <RefreshCw className={`w-3 h-3 ${isLoadingControl ? 'animate-spin' : ''}`} />
            <span>{lastRefreshedAt ? lastRefreshedAt.toLocaleTimeString('fr-MA') : 'تحديث'}</span>
          </button>
        </div>
      </div>

      {/* Shared Search, Role Filter Chips & Agency Filter */}
      <div className="bg-white p-3 border border-slate-200 rounded-xl space-y-2.5">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="بحث بالاسم، الإيميل، الهاتف أو المدينة..."
              className="w-full pr-9 pl-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-500"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
            {activeTab === 'performance' && (
              <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg">
                {(
                  [
                    { id: 'today', label: 'اليوم' },
                    { id: 'week', label: 'الأسبوع' },
                    { id: 'month', label: 'الشهر' },
                    { id: 'all', label: 'الكل' }
                  ] as const
                ).map(p => (
                  <button
                    key={p.id}
                    onClick={() => setPerfPeriod(p.id)}
                    className={`px-2.5 py-1 rounded-md text-[11px] font-bold whitespace-nowrap cursor-pointer ${
                      perfPeriod === p.id ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            )}

            <div className="flex items-center gap-1.5">
              <Filter className="w-3.5 h-3.5 text-slate-400" />
              <select
                value={selectedAgency}
                onChange={e => setSelectedAgency(e.target.value)}
                className="text-xs font-semibold px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-800"
              >
                <option value="all">جميع الوكالات</option>
                {agencies.map(a => (
                  <option key={a.id} value={a.id}>
                    {a.name} ({a.city})
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Role Filter Chips */}
        <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-slate-100">
          <span className="text-[11px] font-bold text-slate-500 ml-1">المنصب:</span>
          <button
            type="button"
            onClick={() => setSelectedRoleFilter('all')}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition cursor-pointer ${
              selectedRoleFilter === 'all'
                ? 'bg-slate-900 text-white border-slate-900'
                : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
            }`}
          >
            الكل ({employees.length})
          </button>
          {(
            [
              { id: 'support', label: 'Support' },
              { id: 'responsable_villes', label: 'Responsable villes' },
              { id: 'confirmatrice', label: 'Confirmation' },
              { id: 'agent_hub', label: 'Agent Hub' },
              { id: 'superviseur', label: 'Superviseur' },
              { id: 'polyvalent', label: 'Polyvalent' }
            ] as Array<{ id: EmployeeSubRole; label: string }>
          ).map(chip => (
            <button
              key={chip.id}
              type="button"
              onClick={() => setSelectedRoleFilter(chip.id)}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition cursor-pointer ${
                selectedRoleFilter === chip.id
                  ? 'bg-red-600 text-white border-red-600'
                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
              }`}
            >
              {chip.label} ({roleCounts[chip.id] || 0})
            </button>
          ))}
        </div>
      </div>

      {/* =================================================================== */}
      {/* TAB 1: LIVE PRESENCE & WORK HOURS MONITOR                          */}
      {/* =================================================================== */}
      {activeTab === 'live' && (
        <div className="space-y-4">
          {/* 4 KPI Strip */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="bg-white border border-slate-200 rounded-xl p-4">
              <span className="text-[11px] font-bold text-slate-500 block">متصلين الآن (En ligne)</span>
              <div className="mt-1 text-2xl font-black font-mono tabular-nums text-emerald-600">
                {liveKpis.onlineCount} <span className="text-sm text-slate-400">/ {liveKpis.totalEmployees}</span>
              </div>
              <span className="text-[11px] text-slate-500 block mt-0.5">اتصال فعلي بالمنصة</span>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-4">
              <span className="text-[11px] font-bold text-slate-500 block">خدامين الآن (En service)</span>
              <div className="mt-1 text-2xl font-black font-mono tabular-nums text-slate-900">
                {liveKpis.workingCount}
              </div>
              <span className="text-[11px] text-slate-500 block mt-0.5">حصة عمل مفتوحة وشغالة</span>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-4">
              <span className="text-[11px] font-bold text-slate-500 block">مجموع ساعات الفريق اليوم</span>
              <div className="mt-1 text-2xl font-black font-mono tabular-nums text-blue-700">
                {formatDurationHMS(liveKpis.totalTodaySeconds)}
              </div>
              <span className="text-[11px] text-slate-500 block mt-0.5">وقت العمل الفعلي المحتسب</span>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-4">
              <span className="text-[11px] font-bold text-slate-500 block">تأكيدات الفريق اليوم</span>
              <div className="mt-1 text-2xl font-black font-mono tabular-nums text-slate-900">
                {liveKpis.totalTodayConfirmed}
              </div>
              <span className="text-[11px] text-slate-500 block mt-0.5">طلبية مؤكدة من العمال</span>
            </div>
          </div>

          {/* Live Monitoring Table */}
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold text-[11px]">
                  <tr>
                    <th className="px-4 py-3">العامل / المنصب</th>
                    <th className="px-4 py-3">حالة الاتصال</th>
                    <th className="px-4 py-3">حالة العمل</th>
                    <th className="px-4 py-3">ساعات العمل (اليوم / الأسبوع / الشهر)</th>
                    <th className="px-4 py-3">آخر نشاط وصفحة</th>
                    <th className="px-4 py-3">إنتاجية اليوم</th>
                    <th className="px-4 py-3 text-left">تحكم شامل عن بعد</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {(employeesOnlyMembers.length > 0 ? employeesOnlyMembers : allStaffMembers).map(m => {
                    const liveTodaySec =
                      m.todayWorkedSeconds + (m.workStatus === 'working' && m.isOnline ? tickOffsetSeconds : 0);
                    const dailyTargetNum = m.user.dailyTargetConfirmations || 30;
                    const pct = Math.min(
                      100,
                      Math.round(((m.performance.todayConfirmed || 0) / Math.max(1, dailyTargetNum)) * 100)
                    );
                    const subRole = m.user.employeeRole || 'confirmatrice';

                    return (
                      <tr key={m.user.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="px-4 py-3.5">
                          <div className="flex items-center gap-2.5">
                            <div className="relative w-9 h-9 rounded-xl bg-slate-900 text-white font-bold flex items-center justify-center text-xs shrink-0">
                              {m.user.name.charAt(0)}
                              <span
                                className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-white ${
                                  m.isOnline
                                    ? 'bg-emerald-500'
                                    : m.idleSeconds <= 300
                                    ? 'bg-amber-400'
                                    : 'bg-slate-300'
                                }`}
                              />
                            </div>
                            <div>
                              <span className="font-extrabold text-slate-900 block">{m.user.name}</span>
                              <div className="flex flex-wrap items-center gap-1 mt-0.5">
                                {m.user.role === 'employee' ? (
                                  <span
                                    className={`px-1.5 py-0.5 rounded text-[10px] font-bold border ${
                                      EMPLOYEE_ROLE_BADGES[subRole]?.bg || 'bg-slate-100'
                                    } ${EMPLOYEE_ROLE_BADGES[subRole]?.text || 'text-slate-700'} ${
                                      EMPLOYEE_ROLE_BADGES[subRole]?.border || 'border-slate-200'
                                    }`}
                                  >
                                    {ROLE_LABELS[subRole]}
                                  </span>
                                ) : (
                                  <span className="text-[10px] text-slate-500">إدارة عامة</span>
                                )}
                                <span className="text-[10px] text-slate-500">
                                  • {m.user.agencyName || m.user.city || 'Hub'}
                                </span>
                              </div>
                              {m.user.role === 'employee' &&
                                Array.isArray(m.user.assignedCities) &&
                                m.user.assignedCities.length > 0 && (
                                  <div className="flex flex-wrap items-center gap-1 mt-1">
                                    <MapPin className="w-3 h-3 text-indigo-600 shrink-0" />
                                    <span className="text-[10px] font-bold text-indigo-700">
                                      {m.user.assignedCities.slice(0, 3).join('، ')}
                                      {m.user.assignedCities.length > 3
                                        ? ` (+${m.user.assignedCities.length - 3})`
                                        : ''}
                                    </span>
                                  </div>
                                )}
                            </div>
                          </div>
                        </td>

                        <td className="px-4 py-3.5 whitespace-nowrap">
                          {m.isOnline ? (
                            <div>
                              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                <span>متصل الآن</span>
                              </span>
                              <span className="block text-[10px] text-slate-500 mt-0.5 font-mono tabular-nums">
                                جلسات: {m.activeSessionsCount}
                              </span>
                            </div>
                          ) : m.idleSeconds <= 300 ? (
                            <div>
                              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                                <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                                <span>خامل (Idle)</span>
                              </span>
                              <span className="block text-[10px] text-slate-400 mt-0.5">
                                {formatTimeAgoArabic(m.lastSeenAt)}
                              </span>
                            </div>
                          ) : (
                            <div>
                              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-bold bg-slate-100 text-slate-600 border border-slate-200">
                                <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                                <span>غير متصل</span>
                              </span>
                              <span className="block text-[10px] text-slate-400 mt-0.5">
                                {formatTimeAgoArabic(m.lastSeenAt)}
                              </span>
                            </div>
                          )}
                        </td>

                        <td className="px-4 py-3.5 whitespace-nowrap">
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold border ${
                              m.workStatus === 'working'
                                ? 'bg-blue-50 text-blue-700 border-blue-200'
                                : m.workStatus === 'break'
                                ? 'bg-amber-50 text-amber-800 border-amber-200'
                                : 'bg-slate-100 text-slate-600 border-slate-200'
                            }`}
                          >
                            <Clock className="w-3 h-3" />
                            <span>
                              {m.workStatus === 'working'
                                ? 'خدام الآن'
                                : m.workStatus === 'break'
                                ? 'في استراحة'
                                : 'متوقف'}
                            </span>
                          </span>
                          {m.todayFirstStartAt && (
                            <span className="block text-[10px] text-slate-500 mt-0.5 font-mono tabular-nums">
                              بدأ:{' '}
                              {new Date(m.todayFirstStartAt).toLocaleTimeString('fr-MA', {
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </span>
                          )}
                        </td>

                        <td className="px-4 py-3.5 whitespace-nowrap">
                          <div className="font-mono tabular-nums font-black text-slate-900 text-sm">
                            {formatDurationHMS(liveTodaySec)}
                          </div>
                          <div className="text-[10px] text-slate-500 font-mono tabular-nums mt-0.5">
                            أسبوع: {formatHoursCompact(m.weekWorkedSeconds)} • شهر:{' '}
                            {formatHoursCompact(m.monthWorkedSeconds)}
                          </div>
                        </td>

                        <td className="px-4 py-3.5">
                          <span className="text-[11px] font-semibold text-slate-800 block max-w-[190px] truncate">
                            {m.lastActionLabel || 'لا يوجد نشاط مسجل'}
                          </span>
                          <span className="text-[10px] text-slate-500 block mt-0.5">
                            {m.currentPage ? PAGE_LABELS[m.currentPage] || m.currentPage : '-'}
                            {m.lastActionAt ? ` • ${formatTimeAgoArabic(m.lastActionAt)}` : ''}
                          </span>
                        </td>

                        <td className="px-4 py-3.5">
                          <div className="flex items-center justify-between text-[11px] font-bold mb-1">
                            <span className="font-mono tabular-nums text-slate-900">
                              {m.performance.todayConfirmed} / {dailyTargetNum}
                            </span>
                            <span className="text-slate-500 font-mono tabular-nums">{pct}%</span>
                          </div>
                          <div className="h-1.5 w-28 bg-slate-100 rounded-full overflow-hidden">
                            <div className="h-full bg-emerald-600" style={{ width: `${pct}%` }} />
                          </div>
                          <span className="block text-[10px] text-slate-500 mt-0.5 font-mono tabular-nums">
                            معالج: {m.performance.todayActions} • واتساب: {m.performance.todayWhatsAppSent}
                          </span>
                        </td>

                        <td className="px-4 py-3.5">
                          <div className="flex items-center justify-end gap-1.5 flex-wrap">
                            {m.workStatus === 'off' ? (
                              <button
                                onClick={() => void handleRemoteShiftAction(m.user.id, m.user.name, 'start')}
                                className="inline-flex items-center gap-1 px-2 py-1 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-700 rounded-lg text-[11px] font-bold cursor-pointer"
                                title="تشغيل حصة العمل"
                              >
                                <Play className="w-3 h-3" />
                                <span>بدء</span>
                              </button>
                            ) : m.workStatus === 'working' ? (
                              <>
                                <button
                                  onClick={() => void handleRemoteShiftAction(m.user.id, m.user.name, 'pause')}
                                  className="inline-flex items-center gap-1 px-2 py-1 bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-800 rounded-lg text-[11px] font-bold cursor-pointer"
                                  title="استراحة"
                                >
                                  <Pause className="w-3 h-3" />
                                </button>
                                <button
                                  onClick={() => void handleRemoteShiftAction(m.user.id, m.user.name, 'end')}
                                  className="inline-flex items-center gap-1 px-2 py-1 bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 rounded-lg text-[11px] font-bold cursor-pointer"
                                  title="إنهاء العمل"
                                >
                                  <Square className="w-3 h-3" />
                                </button>
                              </>
                            ) : (
                              <>
                                <button
                                  onClick={() => void handleRemoteShiftAction(m.user.id, m.user.name, 'resume')}
                                  className="inline-flex items-center gap-1 px-2 py-1 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-700 rounded-lg text-[11px] font-bold cursor-pointer"
                                  title="استئناف العمل"
                                >
                                  <Play className="w-3 h-3" />
                                </button>
                                <button
                                  onClick={() => void handleRemoteShiftAction(m.user.id, m.user.name, 'end')}
                                  className="inline-flex items-center gap-1 px-2 py-1 bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 rounded-lg text-[11px] font-bold cursor-pointer"
                                  title="إنهاء العمل"
                                >
                                  <Square className="w-3 h-3" />
                                </button>
                              </>
                            )}

                            <button
                              onClick={() => setInspectedMember(m)}
                              className="inline-flex items-center gap-1 px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg text-[11px] font-bold cursor-pointer"
                              title="تفاصيل الساعات والأعمال"
                            >
                              <Eye className="w-3 h-3" />
                              <span>سجل</span>
                            </button>

                            {m.user.role === 'employee' && (
                              <button
                                onClick={() => handleOpenEdit(m.user)}
                                className="inline-flex items-center gap-1 px-2 py-1 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-indigo-800 rounded-lg text-[11px] font-bold cursor-pointer"
                                title="التحكم في المهام والمدن المسندة"
                              >
                                <Sliders className="w-3 h-3" />
                                <span>المهام</span>
                              </button>
                            )}

                            {m.user.id !== currentUser?.id && m.activeSessionsCount > 0 && (
                              <button
                                onClick={() => setEmployeeToDisconnect(m)}
                                className="inline-flex items-center gap-1 px-2 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-[11px] font-bold cursor-pointer"
                                title="قطع الاتصال فوراً"
                              >
                                <Power className="w-3 h-3" />
                                <span>طرد</span>
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}

                  {allStaffMembers.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-4 py-10 text-center text-slate-400">
                        لا يوجد عمال مطابقين للبحث حالياً.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* TAB 2: EMPLOYEE PERFORMANCE & LEADERBOARD                          */}
      {/* =================================================================== */}
      {activeTab === 'performance' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="bg-white border border-slate-200 rounded-xl p-4">
              <span className="text-[11px] font-bold text-slate-500 block">إجمالي الطلبيات المعالجة</span>
              <div className="mt-1 text-2xl font-black font-mono tabular-nums text-slate-900">
                {perfKpis.totalHandled}
              </div>
              <span className="text-[11px] text-slate-500 block mt-0.5">حسب الفترة المختارة</span>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-4">
              <span className="text-[11px] font-bold text-slate-500 block">إجمالي الطلبيات المؤكدة</span>
              <div className="mt-1 text-2xl font-black font-mono tabular-nums text-emerald-600">
                {perfKpis.totalConfirmed}
              </div>
              <span className="text-[11px] text-slate-500 block mt-0.5">جاهزة للإرسال والتوصيل</span>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-4">
              <span className="text-[11px] font-bold text-slate-500 block">متوسط نسبة التأكيد</span>
              <div className="mt-1 text-2xl font-black font-mono tabular-nums text-blue-700">
                {perfKpis.avgRate}%
              </div>
              <span className="text-[11px] text-slate-500 block mt-0.5">معدل نجاح التأكيد</span>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-4">
              <span className="text-[11px] font-bold text-slate-500 block">قيمة المبيعات المؤكدة (COD)</span>
              <div className="mt-1 text-2xl font-black font-mono tabular-nums text-slate-900">
                {perfKpis.totalCod.toLocaleString('fr-MA')} <span className="text-xs">DH</span>
              </div>
              <span className="text-[11px] text-slate-500 block mt-0.5">مجموع أثمنة الطلبيات المؤكدة</span>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Award className="w-4 h-4 text-amber-600" />
                <h3 className="text-xs font-extrabold text-slate-900">
                  ترتيب وأداء الفريق (Performance Leaderboard)
                </h3>
              </div>
              <span className="text-[11px] text-slate-500">مرتب حسب عدد الطلبيات المؤكدة</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead className="border-b border-slate-200 bg-slate-50/70 text-slate-600 font-bold text-[11px]">
                  <tr>
                    <th className="px-4 py-3">#</th>
                    <th className="px-4 py-3">العامل</th>
                    <th className="px-4 py-3">الساعات</th>
                    <th className="px-4 py-3">المعالجة</th>
                    <th className="px-4 py-3">المؤكدة</th>
                    <th className="px-4 py-3">نسبة التأكيد</th>
                    <th className="px-4 py-3">لا يرد / مؤجل / ملغى</th>
                    <th className="px-4 py-3">واتساب</th>
                    <th className="px-4 py-3">تسليم المؤكدة %</th>
                    <th className="px-4 py-3">السرعة</th>
                    <th className="px-4 py-3">القيمة المؤكدة</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {rankedPerformanceMembers.map((m, idx) => {
                    const periodSeconds =
                      perfPeriod === 'today'
                        ? m.todayWorkedSeconds
                        : perfPeriod === 'week'
                        ? m.weekWorkedSeconds
                        : m.monthWorkedSeconds;

                    return (
                      <tr key={m.user.id} className="hover:bg-slate-50/70">
                        <td className="px-4 py-3 font-mono font-black text-slate-500">
                          <span
                            className={`inline-flex w-6 h-6 items-center justify-center rounded-md text-[11px] ${
                              idx === 0
                                ? 'bg-amber-100 text-amber-800'
                                : idx === 1
                                ? 'bg-slate-200 text-slate-800'
                                : idx === 2
                                ? 'bg-orange-100 text-orange-800'
                                : 'bg-slate-50 text-slate-500'
                            }`}
                          >
                            {idx + 1}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="font-extrabold text-slate-900 block">{m.user.name}</span>
                          <span className="text-[10px] text-slate-500">
                            {m.user.role === 'employee'
                              ? ROLE_LABELS[m.user.employeeRole || 'confirmatrice']
                              : 'مدير'}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-mono tabular-nums text-slate-700 whitespace-nowrap">
                          {formatHoursCompact(periodSeconds)}
                        </td>
                        <td className="px-4 py-3 font-mono tabular-nums font-bold text-slate-900">
                          {m.performance.totalHandled}
                        </td>
                        <td className="px-4 py-3 font-mono tabular-nums font-black text-emerald-600">
                          {m.performance.totalConfirmed}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-emerald-600"
                                style={{ width: `${m.performance.confirmationRate}%` }}
                              />
                            </div>
                            <span className="font-mono tabular-nums font-bold text-slate-900">
                              {m.performance.confirmationRate}%
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3 font-mono tabular-nums text-[11px] whitespace-nowrap">
                          <span className="text-amber-700 font-bold">{m.performance.totalNoAnswer}</span>
                          {' / '}
                          <span className="text-sky-700 font-bold">{m.performance.totalPostponed}</span>
                          {' / '}
                          <span className="text-rose-700 font-bold">{m.performance.totalCancelled}</span>
                        </td>
                        <td className="px-4 py-3 font-mono tabular-nums font-bold text-green-700">
                          {m.performance.totalWhatsAppSent}
                        </td>
                        <td className="px-4 py-3 font-mono tabular-nums font-bold text-slate-800">
                          {m.performance.deliveredOfConfirmedRate}%
                        </td>
                        <td className="px-4 py-3 font-mono tabular-nums text-[11px] text-slate-700 whitespace-nowrap">
                          {m.performance.confirmationsPerHour} / س
                        </td>
                        <td className="px-4 py-3 font-mono tabular-nums font-extrabold text-slate-900 whitespace-nowrap">
                          {m.performance.confirmedCodTotal.toLocaleString('fr-MA')} DH
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* TAB 3: EMPLOYEE ACCOUNTS, PASSWORDS & PERMISSIONS                  */}
      {/* =================================================================== */}
      {activeTab === 'accounts' && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold text-[11px]">
                <tr>
                  <th className="px-4 py-3.5">العامل</th>
                  <th className="px-4 py-3.5">معلومات الدخول</th>
                  <th className="px-4 py-3.5">الوكالة والهدف</th>
                  <th className="px-4 py-3.5">الصلاحيات</th>
                  <th className="px-4 py-3.5">الحالة</th>
                  <th className="px-4 py-3.5 text-left">إجراءات</th>
                </tr>
              </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredAccountEmployees.map(emp => {
                    const empSubRole = emp.employeeRole || 'confirmatrice';
                    const roleBadge = EMPLOYEE_ROLE_BADGES[empSubRole] || EMPLOYEE_ROLE_BADGES.confirmatrice;
                    const assignedList = Array.isArray(emp.assignedCities) ? emp.assignedCities.filter(Boolean) : [];
                    return (
                      <tr key={emp.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="px-4 py-3.5">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-xl bg-slate-800 text-white font-bold flex items-center justify-center text-xs shrink-0">
                              {emp.name.charAt(0)}
                            </div>
                            <div>
                              <span className="font-bold text-slate-900 block">{emp.name}</span>
                              <span
                                className={`inline-block mt-0.5 px-2 py-0.5 rounded text-[10px] font-bold border ${roleBadge.bg} ${roleBadge.text} ${roleBadge.border}`}
                              >
                                {ROLE_LABELS[empSubRole]}
                              </span>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3.5">
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-1.5 text-slate-700">
                              <Mail className="w-3.5 h-3.5 text-slate-400" />
                              <span className="force-ltr">{emp.email}</span>
                            </div>
                            <div className="flex items-center gap-1.5 text-slate-500 font-mono text-[11px]">
                              <Phone className="w-3.5 h-3.5 text-slate-400" />
                              <span className="force-ltr">{emp.phone}</span>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3.5">
                          <div className="space-y-1">
                            <div className="flex items-center gap-1.5">
                              <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                              <div>
                                <span className="font-semibold text-slate-800 block">
                                  {emp.agencyName || 'Hub Casablanca'}
                                </span>
                                <span className="text-[10px] text-slate-500 font-mono tabular-nums">
                                  الهدف اليومي: {emp.dailyTargetConfirmations || 30} طلبية
                                </span>
                              </div>
                            </div>
                            <div className="flex items-center gap-1 text-[10px]">
                              <MapPin className="w-3 h-3 text-indigo-600 shrink-0" />
                              {assignedList.length > 0 ? (
                                <span className="font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-1.5 py-0.5 rounded">
                                  {assignedList.length} {assignedList.length === 1 ? 'مدينة' : 'مدن'}:{' '}
                                  {assignedList.slice(0, 2).join('، ')}
                                  {assignedList.length > 2 ? ` (+${assignedList.length - 2})` : ''}
                                </span>
                              ) : (
                                <span className="font-semibold text-slate-500">جميع المدن</span>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3.5">
                          <div className="flex flex-wrap gap-1 max-w-xs">
                            {(emp.permissions || DEFAULT_PERMISSIONS_BY_ROLE[empSubRole] || []).map(perm => (
                              <span
                                key={perm}
                                className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded-md text-[10px] font-semibold"
                              >
                                {PERMISSION_SHORT_LABELS[perm] || perm}
                              </span>
                            ))}
                          </div>
                        </td>
                    <td className="px-4 py-3.5">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-bold border ${
                          emp.status === 'active'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : 'bg-slate-100 text-slate-600 border-slate-200'
                        }`}
                      >
                        {emp.status === 'active' ? (
                          <>
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            <span>نشط</span>
                          </>
                        ) : (
                          <>
                            <XCircle className="w-3 h-3 text-slate-400" />
                            <span>موقف</span>
                          </>
                        )}
                      </span>
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => impersonateUser(emp)}
                          className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg cursor-pointer"
                          title="الدخول لحساب العامل"
                        >
                          <LogIn className="w-3 h-3" />
                          <span>دخول</span>
                        </button>
                        <button
                          onClick={() => handleOpenEdit(emp)}
                          className="p-1.5 text-slate-500 hover:text-blue-600 rounded-lg hover:bg-slate-100 cursor-pointer"
                          title="تعديل الحساب والمهام والمدن"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => toggleEmployeeStatus(emp.id)}
                          className="px-2 py-1 text-[11px] font-bold text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
                        >
                          {emp.status === 'active' ? 'حظر' : 'تفعيل'}
                        </button>
                        <button
                          onClick={() => setEmployeeToDelete(emp)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-slate-100 cursor-pointer"
                          title="حذف الحساب"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
                })}
                {filteredAccountEmployees.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-5 py-8 text-center text-slate-400">
                      لا يوجد عمال مطابقين للبحث حالياً. اضغط على «إضافة عامل جديد» لإنشاء حساب بكلمة مرور.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal Add / Edit Employee */}
      {(isAddModalOpen || editingEmployee) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="w-full max-w-2xl bg-white border border-slate-200 rounded-2xl shadow-2xl overflow-hidden max-h-[92vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50 shrink-0">
              <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
                <UserPlus className="w-4 h-4 text-red-600" />
                <span>
                  {editingEmployee
                    ? `تعديل حساب ${editingEmployee.name}`
                    : 'إنشاء حساب عامل جديد (صالح للدخول)'}
                </span>
              </h3>
              <button
                onClick={() => {
                  setIsAddModalOpen(false);
                  setEditingEmployee(null);
                }}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form
              onSubmit={editingEmployee ? handleUpdateEmployee : handleCreateEmployee}
              className="p-6 space-y-4 overflow-y-auto"
            >
              {formError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs font-semibold text-rose-700">
                  {formError}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">الاسم الكامل *</label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="مثال: سلمى بنعلي"
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">رقم الهاتف *</label>
                  <input
                    type="tel"
                    required
                    value={phone}
                    onChange={e => setPhone(e.target.value)}
                    placeholder="0661000000"
                    className="w-full px-3 py-2 text-xs font-mono bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-500 force-ltr text-right"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">البريد الإلكتروني للدخول *</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="agent@fariousy.com"
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-500 force-ltr text-right"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-bold text-slate-700 flex items-center gap-1">
                    <Key className="w-3.5 h-3.5 text-red-600" />
                    <span>
                      {editingEmployee ? 'تغيير كلمة المرور (اختياري)' : 'كلمة المرور للدخول *'}
                    </span>
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setPassword(generatePassword());
                      setShowPassword(true);
                    }}
                    className="text-[11px] font-bold text-red-600 hover:underline cursor-pointer"
                  >
                    توليد تلقائي
                  </button>
                </div>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required={!editingEmployee}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder={editingEmployee ? 'اتركها فارغة للاحتفاظ بالحالية' : 'على الأقل 8 حروف أو أرقام'}
                    className="w-full pl-9 pr-3 py-2 text-xs font-mono bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-500 force-ltr text-right"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(p => !p)}
                    className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">المهمة / المنصب</label>
                  <select
                    value={employeeRole}
                    onChange={e => handleRoleChangeInForm(e.target.value as EmployeeSubRole)}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-semibold"
                  >
                    <option value="support">الدعم وخدمة الزبناء (Support)</option>
                    <option value="responsable_villes">مسؤول المدن (Responsable villes)</option>
                    <option value="confirmatrice">مؤكدة طلبيات (Confirmation)</option>
                    <option value="agent_hub">عامل مستودع / Hub</option>
                    <option value="superviseur">مشرف فريق (Superviseur)</option>
                    <option value="polyvalent">متعدد المهام (Polyvalent)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">الوكالة</label>
                  <select
                    value={agencyId}
                    onChange={e => setAgencyId(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-semibold"
                  >
                    {agencies.map(a => (
                      <option key={a.id} value={a.id}>
                        {a.name} ({a.city})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">الهدف اليومي (تأكيد)</label>
                  <input
                    type="number"
                    min={1}
                    max={500}
                    value={dailyTarget}
                    onChange={e => setDailyTarget(Number(e.target.value) || 30)}
                    className="w-full px-3 py-2 text-xs font-mono tabular-nums bg-slate-50 border border-slate-200 rounded-xl text-slate-900"
                  />
                </div>
              </div>

              {/* Assigned Cities Scope (Responsable villes / Support) */}
              <div className="p-3.5 bg-indigo-50/60 border border-indigo-200/80 rounded-xl space-y-2.5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <label className="text-xs font-extrabold text-indigo-950 flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-indigo-600" />
                      <span>المدن المسندة (Responsable villes / نطاق العمل)</span>
                    </label>
                    <span className="text-[10px] text-indigo-800/80 block mt-0.5">
                      حدد المدن اللي غادي يخدم عليها هاد الحساب (الطرود، السائقين، الاستلام، والتأكيد).
                    </span>
                  </div>

                  <div className="flex items-center gap-1 bg-white p-1 rounded-lg border border-indigo-200 shrink-0">
                    <button
                      type="button"
                      onClick={() => setCityScopeMode('all')}
                      className={`px-2.5 py-1 rounded-md text-[11px] font-bold cursor-pointer ${
                        cityScopeMode === 'all'
                          ? 'bg-indigo-600 text-white'
                          : 'text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      جميع المدن
                    </button>
                    <button
                      type="button"
                      onClick={() => setCityScopeMode('specific')}
                      className={`px-2.5 py-1 rounded-md text-[11px] font-bold cursor-pointer ${
                        cityScopeMode === 'specific'
                          ? 'bg-indigo-600 text-white'
                          : 'text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      تحديد مدن ({assignedCities.length})
                    </button>
                  </div>
                </div>

                {cityScopeMode === 'specific' && (
                  <div className="space-y-2 pt-1">
                    {assignedCities.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {assignedCities.map(cName => (
                          <span
                            key={cName}
                            className="inline-flex items-center gap-1 px-2 py-0.5 bg-indigo-600 text-white rounded-md text-[11px] font-bold"
                          >
                            <span>{cName}</span>
                            <button
                              type="button"
                              onClick={() => handleToggleAssignedCity(cName)}
                              className="hover:text-indigo-200 cursor-pointer"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </span>
                        ))}
                        <button
                          type="button"
                          onClick={() => setAssignedCities([])}
                          className="text-[10px] font-bold text-rose-600 hover:underline px-1.5 cursor-pointer"
                        >
                          مسح الكل
                        </button>
                      </div>
                    )}

                    <div className="relative">
                      <Search className="w-3.5 h-3.5 absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        type="text"
                        value={cityPickerSearch}
                        onChange={e => setCityPickerSearch(e.target.value)}
                        placeholder="ابحث عن مدينة لإضافتها (مثال: Casablanca, Rabat, Agadir...)"
                        className="w-full pr-8 pl-3 py-1.5 text-[11px] bg-white border border-indigo-200 rounded-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 max-h-36 overflow-y-auto p-1 bg-white/80 rounded-lg border border-indigo-100">
                      {filteredPickerCities.map(city => {
                        const checked = assignedCities.includes(city.name);
                        return (
                          <label
                            key={city.id}
                            className={`flex items-center gap-1.5 px-2 py-1.5 rounded-md cursor-pointer text-[11px] transition ${
                              checked ? 'bg-indigo-50 text-indigo-900 font-bold' : 'hover:bg-slate-50 text-slate-700'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => handleToggleAssignedCity(city.name)}
                              className="rounded-sm border-slate-300 accent-indigo-600"
                            />
                            <span className="truncate">{city.name}</span>
                          </label>
                        );
                      })}
                      {filteredPickerCities.length === 0 && (
                        <div className="col-span-full py-3 text-center text-[11px] text-slate-400">
                          لا توجد مدينة مطابقة للبحث.
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Task Permissions Control Matrix */}
              <div className="space-y-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <label className="text-xs font-extrabold text-slate-900 flex items-center gap-1.5">
                    <Sliders className="w-3.5 h-3.5 text-red-600" />
                    <span>التحكم في المهام والصلاحيات ({permissions.length} مفعّلة)</span>
                  </label>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() =>
                        setPermissions([
                          ...(DEFAULT_PERMISSIONS_BY_ROLE[employeeRole] || DEFAULT_PERMISSIONS_BY_ROLE.confirmatrice)
                        ])
                      }
                      className="px-2 py-1 text-[10px] font-bold bg-sky-50 hover:bg-sky-100 text-sky-800 border border-sky-200 rounded-md cursor-pointer"
                    >
                      تطبيق مهام المنصب الافتراضية
                    </button>
                    <button
                      type="button"
                      onClick={() => setPermissions([...ALL_EMPLOYEE_PERMISSION_IDS])}
                      className="px-2 py-1 text-[10px] font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md cursor-pointer"
                    >
                      تحديد الكل
                    </button>
                    <button
                      type="button"
                      onClick={() => setPermissions([])}
                      className="px-2 py-1 text-[10px] font-bold bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-md cursor-pointer"
                    >
                      إلغاء الكل
                    </button>
                  </div>
                </div>

                <div className="space-y-2.5 max-h-60 overflow-y-auto p-2.5 bg-slate-50 border border-slate-200 rounded-xl">
                  {EMPLOYEE_TASK_PERMISSION_GROUPS.map(group => (
                    <div key={group.key} className="space-y-1.5">
                      <div className="text-[10px] font-black text-slate-500 uppercase tracking-wide px-1">
                        {group.title}
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                        {group.items.map(perm => {
                          const active = permissions.includes(perm.id);
                          return (
                            <label
                              key={perm.id}
                              className={`flex items-center gap-2 p-2 rounded-lg border cursor-pointer text-[11px] transition ${
                                active
                                  ? 'bg-white border-red-200 text-slate-900 shadow-2xs'
                                  : 'bg-slate-50/70 border-slate-200/60 text-slate-600 hover:bg-white'
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={active}
                                onChange={() => handleTogglePermission(perm.id)}
                                className="rounded-sm border-slate-300 text-red-600 focus:ring-red-500 accent-red-600"
                              />
                              <span className="font-semibold">{perm.label}</span>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsAddModalOpen(false);
                    setEditingEmployee(null);
                  }}
                  className="px-4 py-2 text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={isSavingForm}
                  className="px-4 py-2 text-xs font-bold text-white bg-red-600 hover:bg-red-700 disabled:opacity-50 rounded-xl cursor-pointer"
                >
                  {isSavingForm
                    ? 'جاري الحفظ...'
                    : editingEmployee
                    ? 'حفظ التعديلات'
                    : 'إنشاء الحساب وتفعيله'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Inspect Member Modal (Hours History + Actions Log) */}
      {inspectedMember && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="w-full max-w-2xl bg-white border border-slate-200 rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50 shrink-0">
              <div className="flex items-center gap-2.5">
                <Headset className="w-5 h-5 text-red-600" />
                <div>
                  <h3 className="text-sm font-extrabold text-slate-900">
                    التقرير التفصيلي: {inspectedMember.user.name}
                  </h3>
                  <span className="text-[11px] text-slate-500">
                    {inspectedMember.user.email} • {inspectedMember.user.phone}
                  </span>
                </div>
              </div>
              <button
                onClick={() => setInspectedMember(null)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-5 overflow-y-auto text-xs">
              {/* Summary Strip */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                  <span className="text-[10px] font-bold text-slate-500 block">ساعات اليوم</span>
                  <span className="text-base font-black font-mono tabular-nums text-slate-900">
                    {formatDurationHMS(inspectedMember.todayWorkedSeconds)}
                  </span>
                </div>
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                  <span className="text-[10px] font-bold text-slate-500 block">ساعات الأسبوع</span>
                  <span className="text-base font-black font-mono tabular-nums text-slate-900">
                    {formatHoursCompact(inspectedMember.weekWorkedSeconds)}
                  </span>
                </div>
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                  <span className="text-[10px] font-bold text-slate-500 block">ساعات الشهر</span>
                  <span className="text-base font-black font-mono tabular-nums text-slate-900">
                    {formatHoursCompact(inspectedMember.monthWorkedSeconds)}
                  </span>
                </div>
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                  <span className="text-[10px] font-bold text-slate-500 block">نسبة التأكيد</span>
                  <span className="text-base font-black font-mono tabular-nums text-emerald-700">
                    {inspectedMember.performance.confirmationRate}%
                  </span>
                </div>
              </div>

              {/* Shifts Timeline */}
              <div>
                <h4 className="font-extrabold text-slate-900 mb-2">سجل حصص العمل (Shifts)</h4>
                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <table className="w-full text-right text-[11px]">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold">
                      <tr>
                        <th className="px-3 py-2">التاريخ</th>
                        <th className="px-3 py-2">البداية</th>
                        <th className="px-3 py-2">النهاية</th>
                        <th className="px-3 py-2">المدة الفعلية</th>
                        <th className="px-3 py-2">الحالة</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {shifts
                        .filter(s => s.userId === inspectedMember.user.id)
                        .slice(0, 10)
                        .map(s => (
                          <tr key={s.id}>
                            <td className="px-3 py-2 font-mono tabular-nums">{s.date}</td>
                            <td className="px-3 py-2 font-mono tabular-nums">
                              {new Date(s.startedAt).toLocaleTimeString('fr-MA', {
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </td>
                            <td className="px-3 py-2 font-mono tabular-nums">
                              {s.endedAt
                                ? new Date(s.endedAt).toLocaleTimeString('fr-MA', {
                                    hour: '2-digit',
                                    minute: '2-digit'
                                  })
                                : '-'}
                            </td>
                            <td className="px-3 py-2 font-mono tabular-nums font-bold text-slate-900">
                              {formatDurationHMS(s.workedSeconds)}
                            </td>
                            <td className="px-3 py-2 font-semibold">
                              {s.status === 'active'
                                ? 'شغال'
                                : s.status === 'break'
                                ? 'استراحة'
                                : 'منتهية'}
                            </td>
                          </tr>
                        ))}
                      {shifts.filter(s => s.userId === inspectedMember.user.id).length === 0 && (
                        <tr>
                          <td colSpan={5} className="px-3 py-4 text-center text-slate-400">
                            لم تبدأ أي حصة عمل بعد.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Confirmation Actions Log */}
              <div>
                <h4 className="font-extrabold text-slate-900 mb-2">آخر عمليات التأكيد لهذا العامل</h4>
                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <table className="w-full text-right text-[11px]">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold">
                      <tr>
                        <th className="px-3 py-2">الوقت</th>
                        <th className="px-3 py-2">الكود</th>
                        <th className="px-3 py-2">الزبون</th>
                        <th className="px-3 py-2">النتيجة</th>
                        <th className="px-3 py-2">ملاحظة</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {confirmationLogs
                        .filter(l => l.employeeId === inspectedMember.user.id)
                        .slice(0, 12)
                        .map(l => (
                          <tr key={l.id}>
                            <td className="px-3 py-2 font-mono tabular-nums text-slate-500">
                              {new Date(l.timestamp).toLocaleString('fr-MA', {
                                month: '2-digit',
                                day: '2-digit',
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </td>
                            <td className="px-3 py-2 font-mono force-ltr text-right">{l.trackingNumber}</td>
                            <td className="px-3 py-2">{l.recipientName}</td>
                            <td className="px-3 py-2 font-bold">{l.outcome}</td>
                            <td className="px-3 py-2 text-slate-500">{l.note || '-'}</td>
                          </tr>
                        ))}
                      {confirmationLogs.filter(l => l.employeeId === inspectedMember.user.id).length === 0 && (
                        <tr>
                          <td colSpan={5} className="px-3 py-4 text-center text-slate-400">
                            لا توجد عمليات تأكيد مسجلة بعد.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Disconnect Confirmation Modal */}
      {employeeToDisconnect && (
        <ConfirmActionModal
          isOpen={true}
          title="قطع اتصال العامل فوراً"
          message={`هل تريد فعلاً طرد ${employeeToDisconnect.user.name} وقطع جميع جلساته المفتوحة الآن؟`}
          confirmLabel="نعم، قطع الاتصال"
          isDestructive={true}
          requireReason={false}
          onConfirm={() => void handleConfirmDisconnect()}
          onCancel={() => setEmployeeToDisconnect(null)}
        />
      )}

      {/* Delete Confirmation Modal */}
      {employeeToDelete && (
        <ConfirmActionModal
          isOpen={true}
          title="حذف حساب العامل"
          message={`هل أنت متأكد من حذف حساب ${employeeToDelete.name} نهائياً؟ سيتم قطع جميع جلساته فوراً.`}
          confirmLabel="تأكيد الحذف"
          isDestructive={true}
          requireReason={true}
          onConfirm={reason => void handleConfirmDelete(reason)}
          onCancel={() => setEmployeeToDelete(null)}
        />
      )}
    </div>
  );
};
