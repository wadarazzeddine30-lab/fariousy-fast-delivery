import React, { useMemo } from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  BarChart,
  Bar
} from 'recharts';
import { PackageItem } from '../../types';
import { useLanguage } from '../../i18n/LanguageContext';
import { TrendingUp, CheckCircle2, Calendar, Award } from 'lucide-react';
import { formatMAD } from '../../utils/barcode';

interface DeliveryEvolutionChartProps {
  packages: PackageItem[];
  title?: string;
  subtitle?: string;
  chartType?: 'area' | 'bar';
  showCash?: boolean;
}

export const DeliveryEvolutionChart: React.FC<DeliveryEvolutionChartProps> = ({
  packages,
  title,
  subtitle,
  chartType = 'area',
  showCash = true
}) => {
  const { t, isRtl, language } = useLanguage();

  // Compute 7 days series ending today
  const chartData = useMemo(() => {
    const days: Array<{
      dateKey: string;
      label: string;
      dayName: string;
      deliveredCount: number;
      collectedCod: number;
      deliveryFees: number;
    }> = [];

    const now = new Date();
    // 7 past days including today
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const dateKey = d.toISOString().slice(0, 10); // YYYY-MM-DD

      // Format localized day name
      const dayName = d.toLocaleDateString(
        language === 'ar' ? 'ar-MA' : language === 'en' ? 'en-US' : 'fr-FR',
        { weekday: 'short' }
      );
      const label = d.toLocaleDateString(
        language === 'ar' ? 'ar-MA' : language === 'en' ? 'en-US' : 'fr-FR',
        { day: 'numeric', month: 'short' }
      );

      // Find packages delivered on this day (either by lastMovedAt or history item of status 'livre')
      const deliveredOnDay = packages.filter(p => {
        if (p.status !== 'livre') return false;

        // Try delivery timestamp from history
        const deliverLog = p.history?.find(h => h.status === 'livre');
        const ts = deliverLog?.timestamp || p.lastMovedAt || p.createdAt;
        if (!ts) return false;

        const pDateKey = ts.slice(0, 10);
        return pDateKey === dateKey;
      });

      const deliveredCount = deliveredOnDay.length;
      const collectedCod = deliveredOnDay.reduce((acc, p) => acc + (p.codAmount || 0), 0);
      const deliveryFees = deliveredOnDay.reduce((acc, p) => acc + (p.deliveryFee || 0), 0);

      days.push({
        dateKey,
        label,
        dayName,
        deliveredCount,
        collectedCod,
        deliveryFees
      });
    }

    return days;
  }, [packages, language]);

  // Aggregate metrics
  const total7Days = useMemo(() => {
    return chartData.reduce((acc, d) => acc + d.deliveredCount, 0);
  }, [chartData]);

  const totalCod7Days = useMemo(() => {
    return chartData.reduce((acc, d) => acc + d.collectedCod, 0);
  }, [chartData]);

  const bestDay = useMemo(() => {
    let max = chartData[0];
    for (const d of chartData) {
      if (d.deliveredCount > max.deliveredCount) max = d;
    }
    return max;
  }, [chartData]);

  const averagePerDay = (total7Days / 7).toFixed(1);

  // Custom Tooltip
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-slate-900 text-white p-3 rounded-xl shadow-xl border border-slate-700 text-xs space-y-1 z-50">
          <div className="font-bold border-b border-slate-700 pb-1 text-slate-300 flex items-center justify-between gap-4">
            <span>{data.dayName} {data.label}</span>
            <span className="font-mono text-red-400 font-bold">{data.dateKey}</span>
          </div>
          <div className="flex items-center justify-between gap-4 pt-0.5">
            <span className="text-slate-400">
              {language === 'ar' ? 'الطرود المسلمة :' : 'Livraisons réussies :'}
            </span>
            <span className="font-bold text-emerald-400 font-mono text-sm">
              {data.deliveredCount} {language === 'ar' ? 'طرد' : 'colis'}
            </span>
          </div>
          {showCash && (
            <div className="flex items-center justify-between gap-4">
              <span className="text-slate-400">
                {language === 'ar' ? 'المبلغ المحصل :' : 'Cash CRBT :'}
              </span>
              <span className="font-bold text-amber-400 font-mono">
                {formatMAD(data.collectedCod)}
              </span>
            </div>
          )}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 shadow-xs space-y-5">
      {/* Chart Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-red-50 border border-red-200 text-red-600 flex items-center justify-center">
              <TrendingUp className="w-4 h-4" />
            </div>
            <h3 className="text-sm sm:text-base font-bold text-slate-900 tracking-tight">
              {title || (language === 'ar' ? 'تطور عمليات التسليم الناجحة (آخر 7 أيام)' : 'Évolution des Livraisons Réussies (7 derniers jours)')}
            </h3>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            {subtitle || (language === 'ar' ? 'معدل الأداء اليومي وعدد الإرساليات المكتملة' : 'Suivi quotidien des colis livrés avec succès aux destinataires')}
          </p>
        </div>

        {/* Aggregate Pill Badges */}
        <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
          <div className="bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl text-center">
            <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
              {language === 'ar' ? 'مجموع 7 أيام' : 'Total 7j'}
            </div>
            <div className="font-mono font-bold text-slate-900 text-sm">
              {total7Days} <span className="text-[10px] font-normal text-slate-500">{language === 'ar' ? 'طرد' : 'colis'}</span>
            </div>
          </div>

          <div className="bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-xl text-center">
            <div className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider">
              {language === 'ar' ? 'المعدل / يوم' : 'Moyenne / j'}
            </div>
            <div className="font-mono font-bold text-emerald-800 text-sm">
              {averagePerDay}
            </div>
          </div>

          {showCash && totalCod7Days > 0 && (
            <div className="bg-amber-50 border border-amber-200 px-3 py-1.5 rounded-xl text-center hidden md:block">
              <div className="text-[10px] font-bold text-amber-700 uppercase tracking-wider">
                {language === 'ar' ? 'المحصل (7 أيام)' : 'Cash COD 7j'}
              </div>
              <div className="font-mono font-bold text-amber-900 text-sm">
                {formatMAD(totalCod7Days)}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Main Recharts Area */}
      <div className="w-full h-64 sm:h-72">
        <ResponsiveContainer width="100%" height="100%">
          {chartType === 'area' ? (
            <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="deliveryGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#dc2626" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="#dc2626" stopOpacity={0.0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis
                dataKey="label"
                stroke="#94a3b8"
                fontSize={11}
                tickLine={false}
                axisLine={{ stroke: '#e2e8f0' }}
              />
              <YAxis
                stroke="#94a3b8"
                fontSize={11}
                tickLine={false}
                axisLine={false}
                allowDecimals={false}
              />
              <Tooltip content={<CustomTooltip />} />
              <Area
                type="monotone"
                dataKey="deliveredCount"
                stroke="#dc2626"
                strokeWidth={2.5}
                fillOpacity={1}
                fill="url(#deliveryGradient)"
                activeDot={{ r: 6, stroke: '#ffffff', strokeWidth: 2, fill: '#dc2626' }}
              />
            </AreaChart>
          ) : (
            <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis
                dataKey="label"
                stroke="#94a3b8"
                fontSize={11}
                tickLine={false}
                axisLine={{ stroke: '#e2e8f0' }}
              />
              <YAxis
                stroke="#94a3b8"
                fontSize={11}
                tickLine={false}
                axisLine={false}
                allowDecimals={false}
              />
              <Tooltip content={<CustomTooltip />} />
              <Bar
                dataKey="deliveredCount"
                fill="#dc2626"
                radius={[6, 6, 0, 0]}
                maxBarSize={40}
              />
            </BarChart>
          )}
        </ResponsiveContainer>
      </div>

      {/* Highlights Bottom Bar */}
      <div className="pt-3 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between text-xs text-slate-500 gap-2">
        <div className="flex items-center gap-1.5">
          <Award className="w-4 h-4 text-amber-500" />
          <span>
            {language === 'ar' ? 'أفضل يوم تسليم : ' : 'Meilleure journée : '}
            <strong className="text-slate-800 font-semibold">
              {bestDay.dayName} {bestDay.label} ({bestDay.deliveredCount} {language === 'ar' ? 'طرد' : 'livraisons'})
            </strong>
          </span>
        </div>

        <div className="flex items-center gap-2 text-[11px] text-slate-400">
          <span className="w-2 h-2 rounded-full bg-red-600 inline-block"></span>
          <span>{language === 'ar' ? 'تحديث آني عبر Supabase' : 'Synchronisé en temps réel avec Supabase'}</span>
        </div>
      </div>
    </div>
  );
};
