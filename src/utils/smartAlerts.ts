import {
  ClientDebtItem,
  ClientStockProduct,
  PackageItem,
  PACKAGE_STATUS_CONFIG,
  SmartAlertItem
} from '../types';

const ACTIVE_MOVEMENT_STATUSES = new Set([
  'nouveau',
  'attente_ramassage',
  'ramasse',
  'en_stock',
  'expedie_hub',
  'en_transit',
  'arrive_destination',
  'en_cours_livraison',
  'reporte',
  'pas_de_reponse'
]);

const RETURN_WATCH_STATUSES = new Set(['retour_en_cours', 'refuse']);

export function formatElapsedDuration(hours: number, isAr = false): string {
  if (hours < 24) {
    return `${Math.round(hours)}h`;
  }
  const days = Math.floor(hours / 24);
  const rem = Math.round(hours % 24);
  if (isAr) {
    return rem > 0 ? `${days} يوم و ${rem} س` : `${days} يوم`;
  }
  return rem > 0 ? `${days}j ${rem}h` : `${days}j`;
}

export function computeSmartAlerts(params: {
  packages: PackageItem[];
  clientDebts: ClientDebtItem[];
  clientStockProducts: ClientStockProduct[];
  clientId?: string;
  nowMs?: number;
}): SmartAlertItem[] {
  const { packages, clientDebts, clientStockProducts, clientId, nowMs = Date.now() } = params;
  const alerts: SmartAlertItem[] = [];
  const HOURS_48_MS = 48 * 60 * 60 * 1000;
  const HOURS_72_MS = 72 * 60 * 60 * 1000;

  const scopedPackages = clientId
    ? packages.filter(p => p.clientId === clientId || p.shopId === clientId)
    : packages;

  const scopedDebts = clientId
    ? clientDebts.filter(d => d.clientId === clientId)
    : clientDebts;

  const scopedStock = clientId
    ? clientStockProducts.filter(p => p.clientId === clientId)
    : clientStockProducts;

  // 1. Stalled packages (> 48h without movement)
  for (const pkg of scopedPackages) {
    const refIso = pkg.lastMovedAt || pkg.createdAt;
    const refTime = new Date(refIso).getTime();
    if (!Number.isFinite(refTime)) continue;
    const elapsedMs = nowMs - refTime;

    if (ACTIVE_MOVEMENT_STATUSES.has(pkg.status) && elapsedMs >= HOURS_48_MS) {
      const hoursElapsed = Math.floor(elapsedMs / (60 * 60 * 1000));
      const statusLabel = PACKAGE_STATUS_CONFIG[pkg.status]?.label || pkg.status;
      alerts.push({
        id: `stalled-${pkg.id}`,
        category: 'stalled_package',
        severity: elapsedMs >= HOURS_72_MS ? 'critical' : 'warning',
        title: `كولي متوقف +${formatElapsedDuration(hoursElapsed)} — ${pkg.trackingNumber}`,
        description: `${pkg.recipientName} (${pkg.city}) • الحالة: ${statusLabel}`,
        meta: pkg.clientCompany || pkg.clientName || pkg.city,
        packageItem: pkg,
        hoursElapsed
      });
    } else if (RETURN_WATCH_STATUSES.has(pkg.status)) {
      const hoursElapsed = Math.max(0, Math.floor(elapsedMs / (60 * 60 * 1000)));
      const statusLabel = PACKAGE_STATUS_CONFIG[pkg.status]?.label || pkg.status;
      alerts.push({
        id: `return-${pkg.id}`,
        category: 'return_alert',
        severity: elapsedMs >= HOURS_48_MS ? 'critical' : 'warning',
        title: `مرتجع / رفض — ${pkg.trackingNumber}`,
        description: `${pkg.recipientName} (${pkg.city}) • ${statusLabel}`,
        meta: pkg.driverName ? `السائق: ${pkg.driverName}` : pkg.clientCompany || pkg.city,
        packageItem: pkg,
        hoursElapsed
      });
    }
  }

  // 2. Unsettled debts
  for (const debt of scopedDebts) {
    if (debt.isSettled || debt.status === 'regle') continue;
    const createdMs = new Date(debt.createdAt).getTime();
    const elapsedMs = Number.isFinite(createdMs) ? nowMs - createdMs : 0;
    const hoursElapsed = Math.max(0, Math.floor(elapsedMs / (60 * 60 * 1000)));
    alerts.push({
      id: `debt-${debt.id}`,
      category: 'unsettled_debt',
      severity: elapsedMs >= HOURS_48_MS || debt.amount >= 500 ? 'critical' : 'warning',
      title: `دين غير مسوى (${debt.amount} MAD)`,
      description: `${debt.clientCompany || debt.clientName} • ${debt.reason || debt.debtType}`,
      meta: hoursElapsed > 0 ? `منذ ${formatElapsedDuration(hoursElapsed)}` : 'مستحق',
      debtId: debt.id,
      hoursElapsed,
      amountMad: debt.amount
    });
  }

  // 3. Unscanned fulfillment stock > 48h
  for (const prod of scopedStock) {
    const overduePending = (prod.units || []).filter(u => {
      if (u.status !== 'en_attente') return false;
      const t = new Date(u.createdAt).getTime();
      return Number.isFinite(t) && nowMs - t >= HOURS_48_MS;
    });

    if (overduePending.length > 0) {
      const oldestMs = Math.min(
        ...overduePending.map(u => new Date(u.createdAt).getTime()).filter(Number.isFinite)
      );
      const hoursElapsed = Math.floor((nowMs - oldestMs) / (60 * 60 * 1000));
      alerts.push({
        id: `stock-${prod.id}`,
        category: 'unscanned_stock',
        severity: hoursElapsed >= 72 ? 'critical' : 'warning',
        title: `${overduePending.length} قطعة غير مسكانة +${formatElapsedDuration(hoursElapsed)}`,
        description: `${prod.name} (${prod.skuCode}) — فانتظار السكان بالمستودع`,
        meta: prod.clientCompany || prod.clientName || prod.hubName || 'Hub Central',
        productId: prod.id,
        hoursElapsed
      });
    }
  }

  // Sort: critical first, then by hoursElapsed desc
  return alerts.sort((a, b) => {
    if (a.severity !== b.severity) {
      return a.severity === 'critical' ? -1 : 1;
    }
    return (b.hoursElapsed || 0) - (a.hoursElapsed || 0);
  });
}
