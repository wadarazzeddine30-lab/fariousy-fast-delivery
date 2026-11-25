import React, { useEffect, useMemo, useState } from 'react';
import { useDatabase } from '../../context/DatabaseContext';
import { useAuth } from '../../context/AuthContext';
import { fetchVisitorStatsDirect } from '../../services/supabaseDirectGateway';
import { PackageItem, PACKAGE_STATUS_CONFIG, Partner, UserProfile } from '../../types';
import { formatMAD } from '../../utils/barcode';
import { getPartnerFeeForPackage, resolvePackagePartner } from '../../utils/partnerTariffs';
import { MOROCCO_REGIONS, getRegionIdForCity } from '../../utils/moroccoRegions';
import {
  buildRecipientConfirmationWhatsAppUrl,
  hasValidRecipientWhatsApp
} from '../../utils/supportWhatsApp';
import {
  Package,
  Truck,
  CheckCircle2,
  XCircle,
  Banknote,
  Users,
  Scan,
  Plus,
  ArrowUpRight,
  TrendingUp,
  TrendingDown,
  MapPin,
  CalendarCheck,
  AlertTriangle,
  Camera,
  Eye,
  DollarSign,
  Calendar,
  Store,
  UserCog,
  ArrowUpFromLine,
  Globe,
  RefreshCw,
  ExternalLink,
  MessageCircle,
  Edit2
} from 'lucide-react';
import { SmartAlertsPanel } from '../common/SmartAlertsPanel';
import { EditPackageModal } from '../common/EditPackageModal';
import { hasEmployeePermission } from '../../utils/employeePermissions';

interface AdminDashboardProps {
  onOpenAddPackage: () => void;
  onOpenScanner: () => void;
  onViewPackage: (pkg: PackageItem) => void;
  onNavigateTab: (tab: any) => void;
}

type PeriodFilter = 'all' | 'day' | 'week' | 'month' | 'year';

interface VisitorStats {
  chrome: number;
  safari: number;
  firefox: number;
  edge: number;
  other: number;
  updatedAt?: string;
}

const MONTHS_FR = ['Janv', 'Févr', 'Mars', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sept', 'Oct', 'Nov', 'Déc'];

function parseFlexibleDate(input?: string): Date | null {
  if (!input) return null;
  const trimmed = String(input).trim();
  if (!trimmed) return null;

  const isoTry = new Date(trimmed);
  if (!Number.isNaN(isoTry.getTime())) return isoTry;

  const dmMatch = trimmed.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (dmMatch) {
    const d = new Date(Number(dmMatch[3]), Number(dmMatch[2]) - 1, Number(dmMatch[1]));
    if (!Number.isNaN(d.getTime())) return d;
  }
  return null;
}

function getPeriodWindow(period: PeriodFilter, now: Date) {
  if (period === 'all') {
    return { start: null as Date | null, prevStart: null as Date | null, prevEnd: null as Date | null, label: 'Toutes périodes' };
  }
  const end = now;
  const start = new Date(now);
  const prevEnd = new Date(now);
  const prevStart = new Date(now);

  if (period === 'day') {
    start.setHours(0, 0, 0, 0);
    prevEnd.setTime(start.getTime());
    prevStart.setTime(start.getTime() - 24 * 60 * 60 * 1000);
    return { start, prevStart, prevEnd, label: 'Depuis hier' };
  }
  if (period === 'week') {
    start.setDate(now.getDate() - 7);
    prevEnd.setTime(start.getTime());
    prevStart.setTime(start.getTime() - 7 * 24 * 60 * 60 * 1000);
    return { start, prevStart, prevEnd, label: 'Depuis les 7j précédents' };
  }
  if (period === 'month') {
    start.setDate(1);
    start.setHours(0, 0, 0, 0);
    prevStart.setFullYear(now.getFullYear(), now.getMonth() - 1, 1);
    prevStart.setHours(0, 0, 0, 0);
    prevEnd.setTime(start.getTime());
    return { start, prevStart, prevEnd, label: 'Depuis le mois dernier' };
  }
  // year
  start.setMonth(0, 1);
  start.setHours(0, 0, 0, 0);
  prevStart.setFullYear(now.getFullYear() - 1, 0, 1);
  prevStart.setHours(0, 0, 0, 0);
  prevEnd.setTime(start.getTime());
  return { start, prevStart, prevEnd, label: "Depuis l'année dernière" };
}

function computeDeltaPercent(current: number, previous: number): { pct: number; isPositive: boolean; hasComparison: boolean } {
  if (previous <= 0 && current <= 0) return { pct: 0, isPositive: true, hasComparison: false };
  if (previous <= 0) return { pct: 100, isPositive: true, hasComparison: true };
  const raw = ((current - previous) / previous) * 100;
  return {
    pct: Math.round(Math.abs(raw) * 100) / 100,
    isPositive: raw >= 0,
    hasComparison: true
  };
}

function buildSmoothSvgPath(points: { x: number; y: number }[]): string {
  if (points.length === 0) return '';
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;
  let d = `M ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i === 0 ? i : i - 1];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2 < points.length ? i + 2 : i + 1];
    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
  }
  return d;
}

const BrowserIcon: React.FC<{ browser: 'chrome' | 'safari' | 'firefox' | 'edge' | 'other' }> = ({ browser }) => {
  if (browser === 'chrome') {
    return (
      <div className="w-8 h-8 rounded-lg bg-rose-50 border border-rose-100 flex items-center justify-center shrink-0">
        <svg viewBox="0 0 24 24" className="w-4 h-4">
          <circle cx="12" cy="12" r="9.5" fill="#facc15" />
          <path d="M12 2.5A9.5 9.5 0 0 1 20.5 7.8H12V2.5Z" fill="#ef4444" />
          <path d="M3.5 7.8A9.5 9.5 0 0 0 11.4 21.4L15 15.2A5 5 0 0 1 7.6 9.8L3.5 7.8Z" fill="#22c55e" />
          <circle cx="12" cy="12" r="4.3" fill="#fff" />
          <circle cx="12" cy="12" r="3.1" fill="#3b82f6" />
        </svg>
      </div>
    );
  }
  if (browser === 'safari') {
    return (
      <div className="w-8 h-8 rounded-lg bg-sky-50 border border-sky-100 flex items-center justify-center shrink-0">
        <svg viewBox="0 0 24 24" className="w-4 h-4">
          <circle cx="12" cy="12" r="9.5" fill="#0ea5e9" />
          <polygon points="15.5,8.5 13.5,13.5 8.5,15.5 10.5,10.5" fill="#ffffff" />
          <polygon points="15.5,8.5 13.5,13.5 10.5,10.5" fill="#ef4444" />
        </svg>
      </div>
    );
  }
  if (browser === 'firefox') {
    return (
      <div className="w-8 h-8 rounded-lg bg-orange-50 border border-orange-100 flex items-center justify-center shrink-0">
        <svg viewBox="0 0 24 24" className="w-4 h-4">
          <circle cx="12" cy="12" r="9.5" fill="#f97316" />
          <path d="M12 5a7 7 0 1 0 7 7c-1.8 1.4-4 1.3-5.2-.1-1.1-1.3-.7-3.4.9-4.2C14 6.1 13.1 5.2 12 5Z" fill="#facc15" />
          <circle cx="12" cy="13" r="3.5" fill="#7c3aed" opacity="0.45" />
        </svg>
      </div>
    );
  }
  if (browser === 'edge') {
    return (
      <div className="w-8 h-8 rounded-lg bg-emerald-50 border border-emerald-100 flex items-center justify-center shrink-0">
        <svg viewBox="0 0 24 24" className="w-4 h-4">
          <circle cx="12" cy="12" r="9.5" fill="#10b981" />
          <path d="M5 13c1.5-4.5 6.5-7 11-5.5 2.5.8 4 3 3.5 5.2-.5 2-2.5 3-4.5 2.3-1.8-.6-2.5-2.5-1.5-4-.8.5-2.5 1.8-2.5 4.2 0 2.8 2.4 5 5.8 5.2A9.5 9.5 0 0 1 5 13Z" fill="#0ea5e9" />
        </svg>
      </div>
    );
  }
  return (
    <div className="w-8 h-8 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center shrink-0">
      <Globe className="w-4 h-4 text-slate-500" />
    </div>
  );
};

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  onOpenAddPackage,
  onOpenScanner,
  onViewPackage,
  onNavigateTab
}) => {
  const { packages, users, pickups, cities, agencies, partners, companySettings, resolvePackageProblem } = useDatabase();
  const { currentUser, impersonateUser } = useAuth();
  const canEditPackage =
    currentUser?.role !== 'employee' || hasEmployeePermission(currentUser, 'can_edit');

  const [period, setPeriod] = useState<PeriodFilter>('all');
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState<number>(currentYear);
  const [hoveredMonthIdx, setHoveredMonthIdx] = useState<number | null>(null);
  const [hoveredRegionId, setHoveredRegionId] = useState<string | null>(null);
  const [editingPackage, setEditingPackage] = useState<PackageItem | null>(null);

  const [visitorStats, setVisitorStats] = useState<VisitorStats>({
    chrome: 0,
    safari: 0,
    firefox: 0,
    edge: 0,
    other: 0
  });
  const [isLoadingVisitors, setIsLoadingVisitors] = useState(false);

  const fetchVisitorStats = async () => {
    setIsLoadingVisitors(true);
    try {
      const json = await fetchVisitorStatsDirect();
      if (json?.success && json.stats) {
        setVisitorStats(json.stats);
      }
    } catch {
      // ignore transient network failure
    } finally {
      setIsLoadingVisitors(false);
    }
  };

  useEffect(() => {
    fetchVisitorStats();
  }, []);

  // Maps for real driver & partner fee lookups
  const driverMap = useMemo(() => {
    const m = new Map<string, UserProfile>();
    users.filter(u => u.role === 'driver').forEach(d => m.set(d.id, d));
    return m;
  }, [users]);

  const partnerMap = useMemo(() => {
    const m = new Map<string, Partner>();
    partners.forEach(p => m.set(p.id, p));
    return m;
  }, [partners]);

  const computePackageProfitAndExpense = (pkg: PackageItem) => {
    const grossFee = Number(pkg.deliveryFee || 0);
    let expense = 0;

    if (pkg.partnerId || pkg.isTransferredToPartner || pkg.partnerName) {
      const partnerObj = pkg.partnerId
        ? partnerMap.get(pkg.partnerId)
        : resolvePackagePartner(pkg, partners);
      if (pkg.status === 'livre') {
        if (pkg.deliveredBy === 'admin') {
          if (pkg.driverId) {
            const driver = driverMap.get(pkg.driverId);
            expense = Number(driver?.driverFeePerDelivery ?? 0);
          }
        } else {
          expense = getPartnerFeeForPackage(partnerObj, pkg);
        }
      } else if (['retourne', 'refuse'].includes(pkg.status)) {
        expense = Number(partnerObj?.returnFee ?? 0);
      }
    } else if (pkg.driverId && pkg.status === 'livre') {
      const driver = driverMap.get(pkg.driverId);
      expense = Number(driver?.driverFeePerDelivery ?? 0);
    }

    const profit = pkg.status === 'livre' ? grossFee - expense : 0;
    return { profit, expense, grossFee };
  };

  // Unresolved Delivery Problem Reports
  const unresolvedProblems = packages.filter(
    p => p.status === 'probleme_livraison' || (p.problemReport && !p.problemReport.resolved)
  );

  // Period filtering + Previous Period comparison for Top 4 Executive KPI Cards
  const executiveKpis = useMemo(() => {
    const now = new Date();
    const { start, prevStart, prevEnd, label: comparisonLabel } = getPeriodWindow(period, now);

    // For 'all', compare current month against previous month so trend indicator still reflects real momentum
    const monthNowWindow = getPeriodWindow('month', now);

    const clients = users.filter(u => u.role === 'client');
    const inRange = (dStr?: string, s?: Date | null, e?: Date | null) => {
      if (!s) return true;
      const d = parseFlexibleDate(dStr);
      if (!d) return false;
      if (e) return d.getTime() >= s.getTime() && d.getTime() < e.getTime();
      return d.getTime() >= s.getTime();
    };

    const periodClients = start ? clients.filter(c => inRange(c.registeredAt, start, null)) : clients;
    const periodPackages = start ? packages.filter(p => inRange(p.createdAt || p.lastMovedAt, start, null)) : packages;
    const periodDelivered = periodPackages.filter(p => p.status === 'livre');

    const periodProfit = periodDelivered.reduce(
      (sum, p) => sum + computePackageProfitAndExpense(p).profit,
      0
    );

    // Previous period comparison counts
    const compStart = start ? prevStart : monthNowWindow.prevStart;
    const compEnd = start ? prevEnd : monthNowWindow.prevEnd;
    const currStartForAll = start ? start : monthNowWindow.start;

    const currClientsForDelta = clients.filter(c => inRange(c.registeredAt, currStartForAll, null)).length;
    const prevClients = clients.filter(c => inRange(c.registeredAt, compStart, compEnd)).length;

    const currPkgsForDelta = packages.filter(p => inRange(p.createdAt || p.lastMovedAt, currStartForAll, null));
    const prevPkgs = packages.filter(p => inRange(p.createdAt || p.lastMovedAt, compStart, compEnd));

    const currDelivForDelta = currPkgsForDelta.filter(p => p.status === 'livre');
    const prevDeliv = prevPkgs.filter(p => p.status === 'livre');

    const currProfitForDelta = currDelivForDelta.reduce((s, p) => s + computePackageProfitAndExpense(p).profit, 0);
    const prevProfit = prevDeliv.reduce((s, p) => s + computePackageProfitAndExpense(p).profit, 0);

    const activeLabel = period === 'all' ? 'Depuis le mois dernier' : comparisonLabel;

    return {
      clientsCount: periodClients.length,
      clientsDelta: computeDeltaPercent(currClientsForDelta, prevClients),
      packagesCount: periodPackages.length,
      packagesDelta: computeDeltaPercent(currPkgsForDelta.length, prevPkgs.length),
      profitTotal: periodProfit,
      profitDelta: computeDeltaPercent(currProfitForDelta, prevProfit),
      deliveredCount: periodDelivered.length,
      deliveredDelta: computeDeltaPercent(currDelivForDelta.length, prevDeliv.length),
      comparisonLabel: activeLabel
    };
  }, [packages, users, period, driverMap, partnerMap]);

  // Available years for Profit Chart selector
  const availableYears = useMemo(() => {
    const yearSet = new Set<number>([currentYear, currentYear - 1]);
    packages.forEach(p => {
      const d = parseFlexibleDate(p.createdAt || p.lastMovedAt);
      if (d) yearSet.add(d.getFullYear());
    });
    return Array.from(yearSet).sort((a, b) => b - a);
  }, [packages, currentYear]);

  // Monthly Profit vs Dépenses Series (Janv - Déc)
  const monthlySeries = useMemo(() => {
    const rows = MONTHS_FR.map((label, idx) => ({
      monthIndex: idx,
      label,
      profit: 0,
      expenses: 0,
      deliveredCount: 0
    }));

    packages.forEach(pkg => {
      const d = parseFlexibleDate(pkg.lastMovedAt || pkg.createdAt);
      if (!d || d.getFullYear() !== selectedYear) return;
      const m = d.getMonth();
      const { profit, expense } = computePackageProfitAndExpense(pkg);
      rows[m].profit += profit;
      rows[m].expenses += expense;
      if (pkg.status === 'livre') {
        rows[m].deliveredCount += 1;
      }
    });

    const maxVal = Math.max(
      100,
      ...rows.map(r => Math.max(r.profit, r.expenses))
    );
    // Round up cleanly to nice top tick (multiple of 500 or 1000)
    const step = maxVal <= 500 ? 100 : maxVal <= 3000 ? 500 : 1000;
    const niceMax = Math.max(step * 3, Math.ceil(maxVal / step) * step);
    const yTicks = [niceMax, Math.round((niceMax * 2) / 3), Math.round(niceMax / 3), 0];

    return { rows, niceMax, yTicks };
  }, [packages, selectedYear, driverMap, partnerMap]);

  // Regional Performance (12 Moroccan Regions based on real delivered parcels)
  const regionalStats = useMemo(() => {
    const delivered = packages.filter(p => p.status === 'livre');
    const totalDelivered = delivered.length;

    const countsByRegion = new Map<string, number>();
    MOROCCO_REGIONS.forEach(r => countsByRegion.set(r.id, 0));
    let unmappedCount = 0;

    delivered.forEach(pkg => {
      const regId = getRegionIdForCity(pkg.city, cities);
      if (regId && countsByRegion.has(regId)) {
        countsByRegion.set(regId, (countsByRegion.get(regId) || 0) + 1);
      } else {
        unmappedCount += 1;
      }
    });

    const regionRows = MOROCCO_REGIONS.map(reg => {
      const count = countsByRegion.get(reg.id) || 0;
      const share = totalDelivered > 0 ? Math.round((count / totalDelivered) * 100) : 0;
      return { ...reg, count, share };
    });

    const activeRegionCounts = regionRows.filter(r => r.count > 0).map(r => r.count);
    const maxRegCount = activeRegionCounts.length > 0 ? Math.max(...activeRegionCounts) : 0;

    let topCount = 0;
    let normalCount = 0;
    let weakCount = 0;
    let otherCount = unmappedCount;

    const regionTierMap = new Map<string, 'top' | 'normal' | 'weak' | 'other'>();

    regionRows.forEach(r => {
      if (r.count === 0 || totalDelivered === 0) {
        regionTierMap.set(r.id, 'other');
        otherCount += r.count;
        return;
      }
      const ratio = maxRegCount > 0 ? r.count / maxRegCount : 0;
      if (ratio >= 0.65) {
        regionTierMap.set(r.id, 'top');
        topCount += r.count;
      } else if (ratio >= 0.3) {
        regionTierMap.set(r.id, 'normal');
        normalCount += r.count;
      } else {
        regionTierMap.set(r.id, 'weak');
        weakCount += r.count;
      }
    });

    const pctOf = (n: number) => (totalDelivered > 0 ? Math.round((n / totalDelivered) * 100) : 0);

    return {
      totalDelivered,
      regionRows,
      regionTierMap,
      summary: {
        topPct: pctOf(topCount),
        normalPct: pctOf(normalCount),
        weakPct: pctOf(weakCount),
        otherPct: totalDelivered > 0 ? pctOf(otherCount) : 0
      }
    };
  }, [packages, cities]);

  // Global Operational Status Counts (All packages)
  const totalPackages = packages.length;
  const inProgressCount = packages.filter(p =>
    ['nouveau', 'attente_ramassage', 'en_transit', 'arrive_destination', 'en_cours_livraison', 'pas_de_reponse', 'reporte', 'probleme_livraison'].includes(p.status)
  ).length;
  const pickedUpCount = packages.filter(p => ['ramasse', 'en_stock'].includes(p.status)).length;
  const deliveredCount = packages.filter(p => p.status === 'livre').length;
  const canceledOrReturnedCount = packages.filter(p => ['annule', 'refuse', 'retourne', 'retour_en_cours'].includes(p.status)).length;

  // Users Overview counts (Clients, Admins/Employees, Entrepôts/Agencies, Livreurs)
  const usersOverview = useMemo(() => {
    const clients = users.filter(u => u.role === 'client').length;
    const admins = users.filter(u => ['super_admin', 'admin', 'employee'].includes(u.role)).length;
    const warehouses = agencies.length;
    const drivers = users.filter(u => u.role === 'driver').length;
    return { clients, admins, warehouses, drivers };
  }, [users, agencies]);

  // Top VIP Clients ranked by real delivered volume + total COD
  const vipClients = useMemo(() => {
    const clients = users.filter(u => u.role === 'client');
    return clients
      .map(client => {
        const clientPkgs = packages.filter(p => p.clientId === client.id);
        const delivered = clientPkgs.filter(p => p.status === 'livre');
        const deliveredCod = delivered.reduce((s, p) => s + Number(p.codAmount || 0), 0);
        return {
          client,
          totalPackages: clientPkgs.length,
          deliveredCount: delivered.length,
          deliveredCod
        };
      })
      .sort((a, b) => {
        if (b.deliveredCount !== a.deliveredCount) return b.deliveredCount - a.deliveredCount;
        if (b.totalPackages !== a.totalPackages) return b.totalPackages - a.totalPackages;
        return b.deliveredCod - a.deliveredCod;
      })
      .slice(0, 6);
  }, [users, packages]);

  // Financial Summary Metrics
  const totalCollectedCash = packages
    .filter(p => p.status === 'livre')
    .reduce((acc, p) => acc + (p.codAmount || 0), 0);
  const totalDeliveryFeesEarned = packages
    .filter(p => p.status === 'livre')
    .reduce((acc, p) => acc + (p.deliveryFee || 0), 0);
  const amountOwedToClients = packages
    .filter(p => p.status === 'livre' && !p.isPaidToClient)
    .reduce((acc, p) => acc + ((p.codAmount || 0) - (p.deliveryFee || 0)), 0);

  // Statistics by City
  const cityStats = cities
    .map(city => {
      const cityPkgs = packages.filter(p => (p.city || '').toLowerCase() === (city.name || '').toLowerCase());
      const delivered = cityPkgs.filter(p => p.status === 'livre').length;
      return {
        cityName: city.name,
        total: cityPkgs.length,
        delivered,
        rate: cityPkgs.length > 0 ? Math.round((delivered / cityPkgs.length) * 100) : 0
      };
    })
    .filter(c => c.total > 0 || packages.length === 0)
    .sort((a, b) => b.total - a.total);

  // Chart SVG dimensions
  const chartW = 720;
  const chartH = 240;
  const padL = 48;
  const padR = 16;
  const padT = 18;
  const padB = 28;
  const plotW = chartW - padL - padR;
  const plotH = chartH - padT - padB;

  const profitPoints = monthlySeries.rows.map((r, idx) => ({
    x: padL + (idx / 11) * plotW,
    y: padT + plotH - (r.profit / monthlySeries.niceMax) * plotH
  }));
  const expensePoints = monthlySeries.rows.map((r, idx) => ({
    x: padL + (idx / 11) * plotW,
    y: padT + plotH - (r.expenses / monthlySeries.niceMax) * plotH
  }));

  const profitLinePath = buildSmoothSvgPath(profitPoints);
  const expenseLinePath = buildSmoothSvgPath(expensePoints);
  const profitAreaPath =
    profitPoints.length > 0
      ? `${profitLinePath} L ${profitPoints[profitPoints.length - 1].x.toFixed(1)} ${(padT + plotH).toFixed(1)} L ${profitPoints[0].x.toFixed(1)} ${(padT + plotH).toFixed(1)} Z`
      : '';

  const hoveredMonth = hoveredMonthIdx !== null ? monthlySeries.rows[hoveredMonthIdx] : null;
  const hoveredRegion = hoveredRegionId ? regionalStats.regionRows.find(r => r.id === hoveredRegionId) : null;

  return (
    <div className="space-y-5">
      {/* Top Executive Header Bar with Period Selector & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-slate-200">
        <div>
          <h2 className="text-xl font-black text-slate-900 tracking-tight">
            Tableau de bord
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Supervision logistique nationale, profits et performances en temps réel
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Period Filter Matching Screenshot */}
          <div className="relative flex items-center bg-white border border-red-200 rounded-xl px-3 py-1.5 shadow-2xs">
            <Calendar className="w-3.5 h-3.5 text-red-600 mr-2 shrink-0" />
            <select
              value={period}
              onChange={e => setPeriod(e.target.value as PeriodFilter)}
              aria-label="Filtrer par période"
              className="text-xs font-bold text-slate-800 bg-transparent focus:outline-none cursor-pointer pr-1"
            >
              <option value="all">Tout</option>
              <option value="day">Dernier jour</option>
              <option value="week">7 derniers jours</option>
              <option value="month">Ce mois</option>
              <option value="year">Cette année</option>
            </select>
          </div>

          <button
            type="button"
            onClick={onOpenScanner}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-slate-800 bg-white border border-slate-200 hover:bg-slate-50 rounded-xl transition-colors cursor-pointer"
          >
            <Scan className="w-3.5 h-3.5 text-red-600" />
            <span>Scanner</span>
          </button>

          <button
            type="button"
            onClick={onOpenAddPackage}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-white bg-red-600 hover:bg-red-700 rounded-xl transition-colors cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Nouveau Colis</span>
          </button>
        </div>
      </div>

      {/* Top 4 Executive KPI Cards (Clients, Colis, Profit, Colis livrés) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        {/* Card 1: Clients */}
        <button
          type="button"
          onClick={() => onNavigateTab('admin_clients')}
          className="text-left p-4 bg-white rounded-xl border border-slate-200 hover:border-slate-300 transition-colors cursor-pointer"
        >
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-semibold">Clients</span>
            <Users className="w-4 h-4 text-slate-500" />
          </div>
          <div className="mt-2.5 text-2xl font-black font-mono text-slate-900 tabular-nums">
            {executiveKpis.clientsCount}
          </div>
          <div className="mt-2 flex items-center gap-1 text-[11px] font-medium">
            {executiveKpis.clientsDelta.hasComparison ? (
              <span
                className={`inline-flex items-center gap-0.5 font-mono font-bold tabular-nums ${
                  executiveKpis.clientsDelta.isPositive ? 'text-emerald-600' : 'text-red-600'
                }`}
              >
                {executiveKpis.clientsDelta.isPositive ? (
                  <TrendingUp className="w-3 h-3" />
                ) : (
                  <TrendingDown className="w-3 h-3" />
                )}
                {executiveKpis.clientsDelta.pct}%
              </span>
            ) : (
              <span className="font-mono font-bold text-slate-400">0%</span>
            )}
            <span className="text-slate-400 truncate">{executiveKpis.comparisonLabel}</span>
          </div>
        </button>

        {/* Card 2: Colis */}
        <button
          type="button"
          onClick={() => onNavigateTab('admin_packages')}
          className="text-left p-4 bg-white rounded-xl border border-slate-200 hover:border-slate-300 transition-colors cursor-pointer"
        >
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-semibold">Colis</span>
            <Package className="w-4 h-4 text-slate-500" />
          </div>
          <div className="mt-2.5 text-2xl font-black font-mono text-slate-900 tabular-nums">
            {executiveKpis.packagesCount}
          </div>
          <div className="mt-2 flex items-center gap-1 text-[11px] font-medium">
            {executiveKpis.packagesDelta.hasComparison ? (
              <span
                className={`inline-flex items-center gap-0.5 font-mono font-bold tabular-nums ${
                  executiveKpis.packagesDelta.isPositive ? 'text-emerald-600' : 'text-red-600'
                }`}
              >
                {executiveKpis.packagesDelta.isPositive ? (
                  <TrendingUp className="w-3 h-3" />
                ) : (
                  <TrendingDown className="w-3 h-3" />
                )}
                {executiveKpis.packagesDelta.pct}%
              </span>
            ) : (
              <span className="font-mono font-bold text-slate-400">0%</span>
            )}
            <span className="text-slate-400 truncate">{executiveKpis.comparisonLabel}</span>
          </div>
        </button>

        {/* Card 3: Profit */}
        <button
          type="button"
          onClick={() => onNavigateTab('admin_finance')}
          className="text-left p-4 bg-white rounded-xl border border-slate-200 hover:border-slate-300 transition-colors cursor-pointer"
        >
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-semibold">Profit</span>
            <DollarSign className="w-4 h-4 text-slate-500" />
          </div>
          <div className="mt-2.5 text-2xl font-black font-mono text-slate-900 tabular-nums force-ltr">
            Dh {executiveKpis.profitTotal.toLocaleString('fr-FR')}
          </div>
          <div className="mt-2 flex items-center gap-1 text-[11px] font-medium">
            {executiveKpis.profitDelta.hasComparison ? (
              <span
                className={`inline-flex items-center gap-0.5 font-mono font-bold tabular-nums ${
                  executiveKpis.profitDelta.isPositive ? 'text-emerald-600' : 'text-red-600'
                }`}
              >
                {executiveKpis.profitDelta.isPositive ? (
                  <TrendingUp className="w-3 h-3" />
                ) : (
                  <TrendingDown className="w-3 h-3" />
                )}
                {executiveKpis.profitDelta.pct}%
              </span>
            ) : (
              <span className="font-mono font-bold text-slate-400">0%</span>
            )}
            <span className="text-slate-400 truncate">{executiveKpis.comparisonLabel}</span>
          </div>
        </button>

        {/* Card 4: Colis livrés */}
        <button
          type="button"
          onClick={() => onNavigateTab('admin_packages')}
          className="text-left p-4 bg-white rounded-xl border border-slate-200 hover:border-slate-300 transition-colors cursor-pointer"
        >
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-semibold">Colis livrés</span>
            <CheckCircle2 className="w-4 h-4 text-slate-500" />
          </div>
          <div className="mt-2.5 text-2xl font-black font-mono text-slate-900 tabular-nums">
            {executiveKpis.deliveredCount}
          </div>
          <div className="mt-2 flex items-center gap-1 text-[11px] font-medium">
            {executiveKpis.deliveredDelta.hasComparison ? (
              <span
                className={`inline-flex items-center gap-0.5 font-mono font-bold tabular-nums ${
                  executiveKpis.deliveredDelta.isPositive ? 'text-emerald-600' : 'text-red-600'
                }`}
              >
                {executiveKpis.deliveredDelta.isPositive ? (
                  <TrendingUp className="w-3 h-3" />
                ) : (
                  <TrendingDown className="w-3 h-3" />
                )}
                {executiveKpis.deliveredDelta.pct}%
              </span>
            ) : (
              <span className="font-mono font-bold text-slate-400">0%</span>
            )}
            <span className="text-slate-400 truncate">{executiveKpis.comparisonLabel}</span>
          </div>
        </button>
      </div>

      {/* Live Delivery Problem Alerts Section (when unresolved issues exist) */}
      {unresolvedProblems.length > 0 && (
        <div className="p-4 sm:p-5 bg-red-50 border border-red-300 rounded-xl space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-lg bg-red-600 text-white flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-black text-red-950">
                  Alertes incidents livraison ({unresolvedProblems.length})
                </h3>
                <p className="text-xs text-red-700">
                  Signalements envoyés par les livreurs avec justificatif photo
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => onNavigateTab('admin_packages')}
              className="text-xs font-bold text-red-700 hover:text-red-900 bg-white border border-red-200 px-3 py-1.5 rounded-lg self-start sm:self-auto cursor-pointer"
            >
              Voir tous les colis
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {unresolvedProblems.slice(0, 6).map(pkg => {
              const photo = pkg.problemReport?.photoBase64 || pkg.callProofUrl;
              return (
                <div
                  key={pkg.id}
                  className="bg-white border border-red-200 rounded-xl p-3 flex items-start gap-3"
                >
                  {photo ? (
                    <button
                      type="button"
                      onClick={() => onViewPackage(pkg)}
                      className="w-16 h-16 rounded-lg overflow-hidden border border-red-200 bg-slate-900 shrink-0 cursor-pointer relative group"
                      title="Voir la photo"
                    >
                      <img src={photo} alt="Justificatif incident" className="w-full h-full object-cover group-hover:opacity-85 transition" />
                    </button>
                  ) : (
                    <div className="w-16 h-16 rounded-lg bg-red-100 text-red-600 flex items-center justify-center shrink-0">
                      <Camera className="w-6 h-6 opacity-60" />
                    </div>
                  )}

                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-xs font-black text-red-600">{pkg.trackingNumber}</span>
                      <span className="text-[10px] font-bold bg-red-100 text-red-800 px-2 py-0.5 rounded-md truncate">
                        {pkg.problemReport?.categoryLabel || 'Problème livraison'}
                      </span>
                    </div>
                    <div className="text-xs font-bold text-slate-900 truncate">
                      {pkg.recipientName} · <span className="text-slate-500">{pkg.city}</span>
                    </div>
                    <p className="text-[11px] text-slate-600 line-clamp-2">
                      {pkg.problemReport?.description || pkg.driverComment || 'Signalement livreur'}
                    </p>
                    <div className="flex items-center justify-between pt-1 gap-2">
                      <span className="text-[10px] text-slate-400 truncate">
                        Livreur : <strong className="text-slate-600">{pkg.problemReport?.reportedBy || pkg.driverName || 'Livreur'}</strong>
                      </span>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => onViewPackage(pkg)}
                          className="px-2.5 py-1 bg-slate-900 hover:bg-slate-800 text-white text-[10px] font-bold rounded-md flex items-center gap-1 cursor-pointer"
                        >
                          <Eye className="w-3 h-3" />
                          <span>Détails</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => resolvePackageProblem(pkg.id, 'Traité depuis le tableau de bord')}
                          className="px-2 py-1 bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-bold rounded-md cursor-pointer"
                        >
                          Résolu ✓
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Automated Smart Alerts Center */}
      <SmartAlertsPanel onViewPackage={onViewPackage} onNavigateTab={onNavigateTab} />

      {/* Suivi des profits — Interactive Smooth Area/Line Chart (Janv - Déc) */}
      <div className="p-5 bg-white border border-slate-200 rounded-xl space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold text-slate-900">Suivi des profits</h3>
            <p className="text-xs text-slate-500">Aperçu du profit de cette année ({selectedYear})</p>
          </div>
          <select
            value={selectedYear}
            onChange={e => setSelectedYear(Number(e.target.value))}
            aria-label="Année du graphique"
            className="text-xs font-bold text-slate-800 bg-white border border-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-red-500 cursor-pointer font-mono"
          >
            {availableYears.map(y => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </div>

        <div className="relative w-full">
          {hoveredMonth && (
            <div className="mb-2 px-3 py-2 bg-slate-900 text-white rounded-lg text-xs flex flex-wrap items-center justify-between gap-3">
              <span className="font-bold">
                {hoveredMonth.label} {selectedYear} ·{' '}
                <span className="font-mono tabular-nums text-slate-300">
                  {hoveredMonth.deliveredCount} colis livré(s)
                </span>
              </span>
              <div className="flex items-center gap-4 font-mono tabular-nums">
                <span className="text-emerald-400 font-bold">
                  Profit: {hoveredMonth.profit.toLocaleString('fr-FR')} DH
                </span>
                <span className="text-red-400 font-bold">
                  Dépenses: {hoveredMonth.expenses.toLocaleString('fr-FR')} DH
                </span>
              </div>
            </div>
          )}

          <div className="w-full overflow-x-auto">
            <svg
              viewBox={`0 0 ${chartW} ${chartH}`}
              className="w-full min-w-[520px] h-56 select-none"
              role="img"
              aria-label="Suivi annuel des profits et dépenses"
            >
              <defs>
                <linearGradient id="profitAreaGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#10b981" stopOpacity="0.20" />
                  <stop offset="100%" stopColor="#10b981" stopOpacity="0.02" />
                </linearGradient>
              </defs>

              {/* Horizontal Grid Lines & Y Ticks */}
              {monthlySeries.yTicks.map(tickVal => {
                const yPos = padT + plotH - (tickVal / monthlySeries.niceMax) * plotH;
                return (
                  <g key={tickVal}>
                    <line
                      x1={padL}
                      y1={yPos}
                      x2={chartW - padR}
                      y2={yPos}
                      stroke="#f1f5f9"
                      strokeWidth="1"
                    />
                    <text
                      x={padL - 8}
                      y={yPos + 4}
                      textAnchor="end"
                      className="fill-slate-400 text-[10px] font-mono tabular-nums"
                    >
                      {tickVal}
                    </text>
                  </g>
                );
              })}

              {/* Profit Area Fill */}
              {profitAreaPath && <path d={profitAreaPath} fill="url(#profitAreaGrad)" />}

              {/* Dépenses Red Line */}
              {expenseLinePath && (
                <path
                  d={expenseLinePath}
                  fill="none"
                  stroke="#dc2626"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              )}

              {/* Profit Green Line */}
              {profitLinePath && (
                <path
                  d={profitLinePath}
                  fill="none"
                  stroke="#10b981"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              )}

              {/* Vertical hover highlight + Data dots */}
              {monthlySeries.rows.map((row, idx) => {
                const px = profitPoints[idx].x;
                const py = profitPoints[idx].y;
                const ey = expensePoints[idx].y;
                const isHovered = hoveredMonthIdx === idx;
                return (
                  <g
                    key={row.label}
                    onMouseEnter={() => setHoveredMonthIdx(idx)}
                    onMouseLeave={() => setHoveredMonthIdx(null)}
                    className="cursor-pointer"
                  >
                    {isHovered && (
                      <line
                        x1={px}
                        y1={padT}
                        x2={px}
                        y2={padT + plotH}
                        stroke="#cbd5e1"
                        strokeDasharray="3 3"
                        strokeWidth="1"
                      />
                    )}
                    <rect
                      x={px - plotW / 24}
                      y={padT}
                      width={plotW / 12}
                      height={plotH + padB}
                      fill="transparent"
                    />
                    <circle
                      cx={px}
                      cy={ey}
                      r={isHovered ? 4.5 : 3}
                      fill="#dc2626"
                      stroke="#ffffff"
                      strokeWidth="1.5"
                    />
                    <circle
                      cx={px}
                      cy={py}
                      r={isHovered ? 4.5 : 3}
                      fill="#10b981"
                      stroke="#ffffff"
                      strokeWidth="1.5"
                    />
                    <text
                      x={px}
                      y={chartH - 6}
                      textAnchor="middle"
                      className={`text-[10px] font-medium ${isHovered ? 'fill-slate-900 font-bold' : 'fill-slate-400'}`}
                    >
                      {row.label}
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>

          {/* Chart Legend */}
          <div className="flex items-center justify-center gap-6 pt-1 text-xs font-semibold text-slate-600">
            <div className="flex items-center gap-2">
              <span className="w-6 h-2.5 rounded-xs border-2 border-emerald-500 bg-emerald-50 inline-block" />
              <span>Profit</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-6 h-2.5 rounded-xs border-2 border-red-600 bg-red-50 inline-block" />
              <span>Dépenses</span>
            </div>
          </div>
        </div>
      </div>

      {/* Analytics Row: Statistiques des visiteurs + Meilleures régions (Carte du Maroc) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Left: Visitor Browser Statistics (Real Telemetry) */}
        <div className="p-5 bg-white border border-slate-200 rounded-xl space-y-4">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Statistiques des visiteurs</h3>
              <p className="text-xs text-slate-500">Clients par navigateur</p>
            </div>
            <button
              type="button"
              onClick={fetchVisitorStats}
              disabled={isLoadingVisitors}
              title="Actualiser"
              className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:text-slate-900 hover:bg-slate-50 cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoadingVisitors ? 'animate-spin' : ''}`} />
            </button>
          </div>

          <div className="space-y-3">
            {[
              { key: 'chrome' as const, label: 'Chrome', count: visitorStats.chrome, badgeClass: 'bg-rose-50 text-rose-600 border-rose-200' },
              { key: 'safari' as const, label: 'Safari', count: visitorStats.safari, badgeClass: 'bg-sky-50 text-sky-600 border-sky-200' },
              { key: 'firefox' as const, label: 'Firefox', count: visitorStats.firefox, badgeClass: 'bg-orange-50 text-orange-600 border-orange-200' },
              { key: 'edge' as const, label: 'Edge', count: visitorStats.edge, badgeClass: 'bg-emerald-50 text-emerald-600 border-emerald-200' },
              { key: 'other' as const, label: 'Other', count: visitorStats.other, badgeClass: 'bg-slate-100 text-slate-600 border-slate-200' }
            ].map(item => (
              <div key={item.key} className="flex items-center justify-between py-1">
                <div className="flex items-center gap-3">
                  <BrowserIcon browser={item.key} />
                  <span className="text-xs font-semibold text-slate-700">{item.label}</span>
                </div>
                <span
                  className={`min-w-[30px] text-center px-2 py-0.5 rounded-md border font-mono text-xs font-bold tabular-nums ${item.badgeClass}`}
                >
                  {item.count}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Right: Meilleures régions (Colis livrés par région — Carte du Maroc interactive) */}
        <div className="p-5 bg-white border border-slate-200 rounded-xl space-y-4">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Meilleures régions</h3>
              <p className="text-xs text-slate-500">Colis livrés par région</p>
            </div>
            {hoveredRegion ? (
              <span className="text-[11px] font-bold text-slate-800 bg-slate-100 px-2.5 py-1 rounded-lg font-mono tabular-nums">
                {hoveredRegion.shortName}: {hoveredRegion.count} ({hoveredRegion.share}%)
              </span>
            ) : (
              <span className="text-[11px] font-mono text-slate-400 tabular-nums">
                {regionalStats.totalDelivered} livré(s)
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
            {/* Morocco 12-Region Interactive Choropleth Map */}
            <div className="flex items-center justify-center">
              <svg
                viewBox="0 0 340 360"
                className="w-48 h-52 select-none"
                role="img"
                aria-label="Carte des régions du Maroc"
              >
                {regionalStats.regionRows.map(region => {
                  const tier = regionalStats.regionTierMap.get(region.id) || 'other';
                  const hasDeliveries = region.count > 0;
                  const fillColor = !hasDeliveries
                    ? '#e2e8f0'
                    : tier === 'top'
                    ? '#10b981'
                    : tier === 'normal'
                    ? '#f59e0b'
                    : tier === 'weak'
                    ? '#ef4444'
                    : '#6366f1';

                  const isHovered = hoveredRegionId === region.id;
                  return (
                    <path
                      key={region.id}
                      d={region.path}
                      fill={fillColor}
                      fillOpacity={isHovered ? 0.95 : hasDeliveries ? 0.8 : 0.85}
                      stroke="#ffffff"
                      strokeWidth={isHovered ? '2' : '1.2'}
                      className="transition-all cursor-pointer"
                      onMouseEnter={() => setHoveredRegionId(region.id)}
                      onMouseLeave={() => setHoveredRegionId(null)}
                    >
                      <title>
                        {`${region.name}: ${region.count} colis livrés (${region.share}%)`}
                      </title>
                    </path>
                  );
                })}
              </svg>
            </div>

            {/* 4 Tier Classifications */}
            <div className="space-y-3">
              {[
                {
                  title: 'Meilleures régions',
                  pct: regionalStats.summary.topPct,
                  titleColor: 'text-emerald-600',
                  barColor: 'bg-emerald-500'
                },
                {
                  title: 'Régions normales',
                  pct: regionalStats.summary.normalPct,
                  titleColor: 'text-amber-500',
                  barColor: 'bg-amber-400'
                },
                {
                  title: 'Régions faibles',
                  pct: regionalStats.summary.weakPct,
                  titleColor: 'text-red-500',
                  barColor: 'bg-red-500'
                },
                {
                  title: 'Autres',
                  pct: regionalStats.summary.otherPct,
                  titleColor: 'text-indigo-500',
                  barColor: 'bg-indigo-500'
                }
              ].map(row => (
                <div key={row.title} className="flex items-center justify-between gap-3">
                  <div>
                    <div className={`text-xs font-bold ${row.titleColor}`}>{row.title}</div>
                    <div className="text-[11px] text-slate-400 font-mono tabular-nums">
                      {row.pct}% des colis livrés
                    </div>
                  </div>
                  <span className={`w-1.5 h-6 rounded-full ${row.barColor} shrink-0`} />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* 4 Compact Status Cards (Livré, En cours, Annulé, Récupéré) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <button
          type="button"
          onClick={() => onNavigateTab('admin_packages')}
          className="text-left p-4 bg-white rounded-xl border border-emerald-200 hover:border-emerald-300 transition-colors cursor-pointer"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-600">Livré</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="mt-2.5 text-2xl font-black font-mono text-slate-900 tabular-nums">
            {deliveredCount}
          </div>
        </button>

        <button
          type="button"
          onClick={() => onNavigateTab('admin_packages')}
          className="text-left p-4 bg-white rounded-xl border border-amber-200 hover:border-amber-300 transition-colors cursor-pointer"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-600">En cours</span>
            <Truck className="w-4 h-4 text-amber-500" />
          </div>
          <div className="mt-2.5 text-2xl font-black font-mono text-slate-900 tabular-nums">
            {inProgressCount}
          </div>
        </button>

        <button
          type="button"
          onClick={() => onNavigateTab('admin_packages')}
          className="text-left p-4 bg-white rounded-xl border border-rose-200 hover:border-rose-300 transition-colors cursor-pointer"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-600">Annulé / Retour</span>
            <XCircle className="w-4 h-4 text-red-500" />
          </div>
          <div className="mt-2.5 text-2xl font-black font-mono text-slate-900 tabular-nums">
            {canceledOrReturnedCount}
          </div>
        </button>

        <button
          type="button"
          onClick={() => onNavigateTab('admin_packages')}
          className="text-left p-4 bg-white rounded-xl border border-slate-200 hover:border-slate-300 transition-colors cursor-pointer"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-600">Récupéré</span>
            <ArrowUpFromLine className="w-4 h-4 text-slate-500" />
          </div>
          <div className="mt-2.5 text-2xl font-black font-mono text-slate-900 tabular-nums">
            {pickedUpCount}
          </div>
        </button>
      </div>

      {/* Utilisateurs — Aperçu des utilisateurs */}
      <div className="p-5 bg-white border border-slate-200 rounded-xl space-y-4">
        <div>
          <h3 className="text-sm font-bold text-slate-900">Utilisateurs</h3>
          <p className="text-xs text-slate-500">Aperçu des utilisateurs</p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-1">
          <button
            type="button"
            onClick={() => onNavigateTab('admin_clients')}
            className="flex flex-col items-center justify-center p-3 rounded-xl hover:bg-slate-50 transition-colors cursor-pointer"
          >
            <Users className="w-5 h-5 text-emerald-600 mb-2" />
            <span className="text-xs font-medium text-slate-500">Clients</span>
            <span className="mt-1 text-lg font-black font-mono text-slate-900 tabular-nums">
              {usersOverview.clients}
            </span>
          </button>

          <button
            type="button"
            onClick={() => onNavigateTab('admin_employees')}
            className="flex flex-col items-center justify-center p-3 rounded-xl hover:bg-slate-50 transition-colors cursor-pointer"
          >
            <UserCog className="w-5 h-5 text-red-600 mb-2" />
            <span className="text-xs font-medium text-slate-500">Administrateurs</span>
            <span className="mt-1 text-lg font-black font-mono text-slate-900 tabular-nums">
              {usersOverview.admins}
            </span>
          </button>

          <button
            type="button"
            onClick={() => onNavigateTab('admin_hubs')}
            className="flex flex-col items-center justify-center p-3 rounded-xl hover:bg-slate-50 transition-colors cursor-pointer"
          >
            <Store className="w-5 h-5 text-amber-500 mb-2" />
            <span className="text-xs font-medium text-slate-500">Entrepôts</span>
            <span className="mt-1 text-lg font-black font-mono text-slate-900 tabular-nums">
              {usersOverview.warehouses}
            </span>
          </button>

          <button
            type="button"
            onClick={() => onNavigateTab('admin_drivers')}
            className="flex flex-col items-center justify-center p-3 rounded-xl hover:bg-slate-50 transition-colors cursor-pointer"
          >
            <Truck className="w-5 h-5 text-red-600 mb-2" />
            <span className="text-xs font-medium text-slate-500">Livreur</span>
            <span className="mt-1 text-lg font-black font-mono text-slate-900 tabular-nums">
              {usersOverview.drivers}
            </span>
          </button>
        </div>
      </div>

      {/* Meilleurs clients — Liste des meilleurs clients VIP */}
      <div className="p-5 bg-white border border-slate-200 rounded-xl space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold text-slate-900">Meilleurs clients</h3>
            <p className="text-xs text-slate-500">Liste des meilleurs clients VIP</p>
          </div>
          <button
            type="button"
            onClick={() => onNavigateTab('admin_clients')}
            className="text-xs font-bold text-red-600 hover:text-red-700 cursor-pointer"
          >
            Voir plus
          </button>
        </div>

        <div className="border border-slate-200 rounded-xl overflow-x-auto">
          <table className="w-full text-left text-xs min-w-[600px]">
            <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
              <tr>
                <th className="py-2.5 px-3">Nom</th>
                <th className="py-2.5 px-3">Boutique</th>
                <th className="py-2.5 px-3">État</th>
                <th className="py-2.5 px-3">Téléphone</th>
                <th className="py-2.5 px-3 text-center">Colis livrés</th>
                <th className="py-2.5 px-3 text-right">Profil</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {vipClients.map(({ client, deliveredCount: delCount, totalPackages: totCount }) => {
                const isActive =
                  client.status === 'active' || client.accountStatus === 'approuve';
                const isPending =
                  client.status === 'pending' || client.accountStatus === 'en_attente';

                return (
                  <tr key={client.id} className="hover:bg-slate-50 transition-colors">
                    <td className="py-2.5 px-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-slate-200 text-slate-700 font-bold flex items-center justify-center shrink-0 uppercase">
                          {client.name?.charAt(0) || 'C'}
                        </div>
                        <div className="min-w-0">
                          <div className="font-bold text-slate-900 truncate">{client.name}</div>
                          <div className="text-[11px] text-slate-400 font-mono truncate">{client.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="py-2.5 px-3 font-medium text-slate-700">
                      {client.companyName || '—'}
                    </td>
                    <td className="py-2.5 px-3">
                      <span
                        className={`inline-block px-2 py-0.5 rounded-md text-[10px] font-bold uppercase ${
                          isActive
                            ? 'bg-emerald-500 text-white'
                            : isPending
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-rose-100 text-rose-700'
                        }`}
                      >
                        {isActive ? 'ACTIF' : isPending ? 'ATTENTE' : 'SUSPENDU'}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 font-mono text-slate-700 tabular-nums force-ltr">
                      {client.phone || '—'}
                    </td>
                    <td className="py-2.5 px-3 text-center font-mono tabular-nums">
                      <span className="font-bold text-slate-900">{delCount}</span>
                      <span className="text-slate-400">/{totCount}</span>
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      <button
                        type="button"
                        onClick={() => impersonateUser(client)}
                        className="inline-flex items-center gap-1 text-xs font-bold text-red-600 hover:text-red-700 cursor-pointer"
                      >
                        <span>Visiter</span>
                        <ExternalLink className="w-3 h-3" />
                      </button>
                    </td>
                  </tr>
                );
              })}

              {vipClients.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-xs text-slate-400">
                    Aucun client enregistré pour le moment.{' '}
                    <button
                      type="button"
                      onClick={() => onNavigateTab('admin_clients')}
                      className="text-red-600 font-bold hover:underline cursor-pointer"
                    >
                      Ajouter un client
                    </button>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Financial Cashflow Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-5 bg-slate-900 text-white rounded-xl">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              Total Encaissé (COD Livrés)
            </span>
            <Banknote className="w-5 h-5 text-emerald-400" />
          </div>
          <div className="mt-3 text-2xl font-black font-mono text-emerald-400 tabular-nums">
            {formatMAD(totalCollectedCash)}
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Cash collecté auprès des destinataires
          </p>
        </div>

        <div className="p-5 bg-white border border-slate-200 rounded-xl">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Montants à Verser aux Clients
            </span>
            <TrendingUp className="w-5 h-5 text-amber-500" />
          </div>
          <div className="mt-3 text-2xl font-black font-mono text-slate-900 tabular-nums">
            {formatMAD(amountOwedToClients)}
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Solde net en attente de virement vers marchands
          </p>
        </div>

        <div className="p-5 bg-white border border-slate-200 rounded-xl">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Commissions Livraison Brut
            </span>
            <div className="w-3 h-3 rounded-full bg-red-600" />
          </div>
          <div className="mt-3 text-2xl font-black font-mono text-red-600 tabular-nums">
            {formatMAD(totalDeliveryFeesEarned)}
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Total frais de livraison sur {totalPackages} colis
          </p>
        </div>
      </div>

      {/* Statistics By City & Pickups Summary */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 p-5 bg-white border border-slate-200 rounded-xl space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <MapPin className="w-4 h-4 text-red-600" />
                <span>Statistiques de Livraison par Ville</span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">Répartition du volume et taux de livraison</p>
            </div>
            <button
              type="button"
              onClick={() => onNavigateTab('admin_cities')}
              className="text-xs font-bold text-red-600 hover:text-red-700 flex items-center gap-1 cursor-pointer"
            >
              <span>Voir tarifs</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="border border-slate-200 rounded-xl overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-3">Ville</th>
                  <th className="py-2.5 px-3 text-center">Colis Totaux</th>
                  <th className="py-2.5 px-3 text-center">Livrés</th>
                  <th className="py-2.5 px-3">Progression & Taux</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {cityStats.slice(0, 6).map(city => (
                  <tr key={city.cityName} className="hover:bg-slate-50">
                    <td className="py-2.5 px-3 font-bold text-slate-800">{city.cityName}</td>
                    <td className="py-2.5 px-3 text-center font-mono font-semibold text-slate-900 tabular-nums">{city.total}</td>
                    <td className="py-2.5 px-3 text-center font-mono text-emerald-600 font-bold tabular-nums">{city.delivered}</td>
                    <td className="py-2.5 px-3">
                      <div className="flex items-center gap-2">
                        <div className="w-24 h-2 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-red-600 rounded-full transition-all"
                            style={{ width: `${Math.min(100, city.rate)}%` }}
                          />
                        </div>
                        <span className="font-mono text-slate-600 text-[11px] tabular-nums">{city.rate}%</span>
                      </div>
                    </td>
                  </tr>
                ))}
                {cityStats.length === 0 && (
                  <tr>
                    <td colSpan={4} className="py-6 text-center text-slate-400">
                      Aucune donnée de livraison par ville pour le moment.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Demandes de Ramassage */}
        <div className="p-5 bg-white border border-slate-200 rounded-xl space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <CalendarCheck className="w-4 h-4 text-amber-600" />
              <span>Demandes de Ramassage</span>
            </h3>
            <button
              type="button"
              onClick={() => onNavigateTab('admin_pickups')}
              className="text-xs font-bold text-red-600 hover:text-red-700 cursor-pointer"
            >
              Gérer
            </button>
          </div>

          <div className="space-y-2.5">
            {pickups.slice(0, 4).map(p => (
              <div key={p.id} className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs space-y-1">
                <div className="flex justify-between items-center">
                  <span className="font-extrabold text-slate-800">{p.clientCompany}</span>
                  <span
                    className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                      p.status === 'en_attente'
                        ? 'bg-amber-100 text-amber-800'
                        : p.status === 'affectee'
                        ? 'bg-blue-100 text-blue-800'
                        : 'bg-emerald-100 text-emerald-800'
                    }`}
                  >
                    {p.status === 'en_attente' ? 'À affecter' : p.status === 'affectee' ? 'Livreur en route' : 'Terminé'}
                  </span>
                </div>
                <div className="text-slate-500 text-[11px]">
                  {p.packageCount} colis prévus · {p.city} · Date : {p.requestedDate}
                </div>
              </div>
            ))}
            {pickups.length === 0 && (
              <div className="py-6 text-center text-xs text-slate-400">
                Aucune demande de ramassage en attente.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Recent Parcels Activity Table */}
      <div className="p-5 bg-white border border-slate-200 rounded-xl space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-900">Derniers Colis Enregistrés</h3>
            <p className="text-xs text-slate-500">Mouvements récents sur le réseau FARIOUSY</p>
          </div>
          <button
            type="button"
            onClick={() => onNavigateTab('admin_packages')}
            className="text-xs font-bold text-red-600 hover:text-red-700 flex items-center gap-1 cursor-pointer"
          >
            <span>Voir tous les colis</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="border border-slate-200 rounded-xl overflow-x-auto">
          <table className="w-full text-left text-xs min-w-[600px]">
            <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
              <tr>
                <th className="py-2.5 px-3">N° Suivi</th>
                <th className="py-2.5 px-3">Expéditeur</th>
                <th className="py-2.5 px-3">Destinataire</th>
                <th className="py-2.5 px-3">Ville</th>
                <th className="py-2.5 px-3 text-right">Montant CRBT</th>
                <th className="py-2.5 px-3">Statut</th>
                <th className="py-2.5 px-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {packages.slice(0, 5).map(pkg => {
                const config = PACKAGE_STATUS_CONFIG[pkg.status] || {
                  label: pkg.status || 'Inconnu',
                  badgeClass: 'bg-slate-100 text-slate-700'
                };
                return (
                  <tr key={pkg.id} className="hover:bg-slate-50 transition-colors">
                    <td className="py-2.5 px-3 font-mono font-bold text-slate-900">
                      {pkg.trackingNumber}
                    </td>
                    <td className="py-2.5 px-3 text-slate-700 font-medium">
                      {pkg.clientCompany || pkg.clientName}
                    </td>
                    <td className="py-2.5 px-3 text-slate-900 font-semibold">
                      {pkg.recipientName}
                    </td>
                    <td className="py-2.5 px-3 text-slate-600">{pkg.city}</td>
                    <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900 tabular-nums">
                      {formatMAD(pkg.codAmount)}
                    </td>
                    <td className="py-2.5 px-3">
                      <span className={`px-2 py-0.5 rounded-md text-[11px] font-bold ${config.badgeClass}`}>
                        {config.label}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      <div className="inline-flex items-center justify-end gap-1.5">
                        {hasValidRecipientWhatsApp(pkg.recipientPhone) && (
                          <a
                            href={buildRecipientConfirmationWhatsAppUrl(pkg, companySettings?.companyName)}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={e => e.stopPropagation()}
                            title="إرسال رسالة تأكيد الطلبية للزبون عبر واتساب"
                            className="inline-flex items-center gap-1 px-2 py-1 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-2xs transition-colors"
                          >
                            <MessageCircle className="w-3.5 h-3.5 shrink-0" />
                            <span>واتساب</span>
                          </a>
                        )}
                        {canEditPackage && (
                          <button
                            type="button"
                            onClick={() => setEditingPackage(pkg)}
                            title="تعديل الكموند"
                            className="inline-flex items-center gap-1 px-2 py-1 text-xs font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-lg transition-colors cursor-pointer"
                          >
                            <Edit2 className="w-3 h-3 shrink-0" />
                            <span>تعديل</span>
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => onViewPackage(pkg)}
                          className="px-2.5 py-1 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
                        >
                          Consulter
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {packages.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-6 text-center text-slate-400">
                    Aucun colis enregistré pour le moment.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <EditPackageModal
        packageItem={editingPackage}
        isOpen={Boolean(editingPackage)}
        onClose={() => setEditingPackage(null)}
      />
    </div>
  );
};
