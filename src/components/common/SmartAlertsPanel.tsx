import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  Clock,
  RotateCcw,
  Banknote,
  Boxes,
  Eye,
  ArrowUpRight,
  CheckCircle2,
  BellRing
} from 'lucide-react';
import { PackageItem, SmartAlertCategory, SmartAlertItem } from '../../types';
import { computeSmartAlerts } from '../../utils/smartAlerts';
import { useDatabase } from '../../context/DatabaseContext';

interface SmartAlertsPanelProps {
  clientId?: string;
  onViewPackage?: (pkg: PackageItem) => void;
  onNavigateTab?: (tab: string) => void;
}

const CATEGORY_META: Record<
  SmartAlertCategory,
  {
    label: string;
    icon: React.FC<{ className?: string }>;
    badgeClass: string;
    targetAdminTab: string;
    targetClientTab: string;
  }
> = {
  stalled_package: {
    label: 'كوليات متوقفة +48h',
    icon: Clock,
    badgeClass: 'bg-amber-100 text-amber-800 border-amber-200',
    targetAdminTab: 'admin_packages',
    targetClientTab: 'client_packages'
  },
  return_alert: {
    label: 'مرتجعات / رفض',
    icon: RotateCcw,
    badgeClass: 'bg-rose-100 text-rose-800 border-rose-200',
    targetAdminTab: 'admin_packages',
    targetClientTab: 'client_returns'
  },
  unsettled_debt: {
    label: 'ديون غير مسواة',
    icon: Banknote,
    badgeClass: 'bg-purple-100 text-purple-800 border-purple-200',
    targetAdminTab: 'admin_debts',
    targetClientTab: 'client_finance'
  },
  unscanned_stock: {
    label: 'سطوك غير مسكان +48h',
    icon: Boxes,
    badgeClass: 'bg-sky-100 text-sky-800 border-sky-200',
    targetAdminTab: 'admin_stock',
    targetClientTab: 'client_stock'
  }
};

export const SmartAlertsPanel: React.FC<SmartAlertsPanelProps> = ({
  clientId,
  onViewPackage,
  onNavigateTab
}) => {
  const { packages, clientDebts, clientStockProducts } = useDatabase();
  const [selectedCategory, setSelectedCategory] = useState<'all' | SmartAlertCategory>('all');
  const [showAll, setShowAll] = useState(false);

  const alerts = useMemo<SmartAlertItem[]>(
    () =>
      computeSmartAlerts({
        packages,
        clientDebts,
        clientStockProducts,
        clientId
      }),
    [packages, clientDebts, clientStockProducts, clientId]
  );

  const counts = useMemo(() => {
    const map: Record<SmartAlertCategory, number> = {
      stalled_package: 0,
      return_alert: 0,
      unsettled_debt: 0,
      unscanned_stock: 0
    };
    for (const a of alerts) {
      map[a.category]++;
    }
    return map;
  }, [alerts]);

  const filtered = useMemo(
    () =>
      selectedCategory === 'all'
        ? alerts
        : alerts.filter(a => a.category === selectedCategory),
    [alerts, selectedCategory]
  );

  const displayed = showAll ? filtered : filtered.slice(0, 6);

  if (alerts.length === 0) {
    return (
      <div className="p-4 bg-emerald-50/70 border border-emerald-200 rounded-2xl flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-xs sm:text-sm font-black text-emerald-950">
              مركز التنبيهات الذكية — الحالة سليمة 100%
            </h3>
            <p className="text-[11px] text-emerald-700 mt-0.5">
              لا توجد كوليات متوقفة +48h، ولا مرتجعات معلقة، ولا ديون متأخرة أو سطوك غير مسكانة.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const criticalCount = alerts.filter(a => a.severity === 'critical').length;

  return (
    <div className="p-4 sm:p-5 bg-amber-50/60 border-2 border-amber-300/80 rounded-2xl shadow-2xs space-y-3.5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-600 text-white flex items-center justify-center shrink-0 shadow-xs">
            <BellRing className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-sm font-black text-slate-900">
                مركز التنبيهات الذكية التلقائية ({alerts.length})
              </h3>
              {criticalCount > 0 && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-red-600 text-white">
                  {criticalCount} حرج
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-600 mt-0.5">
              مراقبة تلقائية للكوليات المتوقفة +48 ساعة، المرتجعات/الرفض، الديون المستحقة وسطوك المخزن غير المسكان
            </p>
          </div>
        </div>
      </div>

      {/* Category Filter Tabs */}
      <div className="flex flex-wrap items-center gap-1.5">
        <button
          type="button"
          onClick={() => setSelectedCategory('all')}
          className={`px-3 py-1.5 rounded-xl text-[11px] font-bold transition-colors cursor-pointer ${
            selectedCategory === 'all'
              ? 'bg-slate-900 text-white'
              : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50'
          }`}
        >
          الكل ({alerts.length})
        </button>
        {(Object.keys(CATEGORY_META) as SmartAlertCategory[]).map(cat => {
          const meta = CATEGORY_META[cat];
          const Icon = meta.icon;
          const cnt = counts[cat];
          if (cnt === 0) return null;
          return (
            <button
              key={cat}
              type="button"
              onClick={() => setSelectedCategory(cat)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-bold transition-colors cursor-pointer ${
                selectedCategory === cat
                  ? 'bg-slate-900 text-white'
                  : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>
                {meta.label} ({cnt})
              </span>
            </button>
          );
        })}
      </div>

      {/* Alerts Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5">
        {displayed.map(item => {
          const meta = CATEGORY_META[item.category];
          const Icon = meta.icon;
          const targetTab = clientId ? meta.targetClientTab : meta.targetAdminTab;
          return (
            <div
              key={item.id}
              className={`p-3 bg-white rounded-xl border flex flex-col justify-between gap-2.5 shadow-2xs ${
                item.severity === 'critical' ? 'border-red-300' : 'border-amber-200'
              }`}
            >
              <div className="space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <span
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${meta.badgeClass}`}
                  >
                    <Icon className="w-3 h-3" />
                    <span>{meta.label}</span>
                  </span>
                  {item.severity === 'critical' && (
                    <span className="inline-flex items-center gap-0.5 text-[10px] font-black text-red-600">
                      <AlertTriangle className="w-3 h-3" />
                      عاجل
                    </span>
                  )}
                </div>
                <h4 className="text-xs font-black text-slate-900 leading-snug">{item.title}</h4>
                <p className="text-[11px] text-slate-600 leading-snug">{item.description}</p>
              </div>

              <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-100">
                <span className="text-[10px] font-medium text-slate-400 truncate">{item.meta}</span>
                {item.packageItem && onViewPackage ? (
                  <button
                    type="button"
                    onClick={() => onViewPackage(item.packageItem!)}
                    className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-900 hover:bg-slate-800 text-white text-[10px] font-bold rounded-lg shrink-0 cursor-pointer"
                  >
                    <Eye className="w-3 h-3" />
                    <span>معاينة الكولي</span>
                  </button>
                ) : onNavigateTab ? (
                  <button
                    type="button"
                    onClick={() => onNavigateTab(targetTab)}
                    className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-800 text-[10px] font-bold rounded-lg shrink-0 cursor-pointer"
                  >
                    <span>فتح القسم</span>
                    <ArrowUpRight className="w-3 h-3" />
                  </button>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>

      {filtered.length > 6 && (
        <div className="flex justify-center pt-1">
          <button
            type="button"
            onClick={() => setShowAll(v => !v)}
            className="px-4 py-1.5 text-xs font-bold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-xl cursor-pointer"
          >
            {showAll ? 'عرض أقل' : `عرض جميع التنبيهات (${filtered.length})`}
          </button>
        </div>
      )}
    </div>
  );
};
