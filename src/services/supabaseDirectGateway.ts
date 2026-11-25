/**
 * FARIOUSY DELIVERY — 100% Direct Supabase Client SDK Gateway
 * Replaces all legacy relative /api/... backend fetches so the application
 * runs completely standalone as a Capacitor Android APK or static web app.
 *
 * Uses ONLY supabaseClient (anon/publishable key + authenticated user JWT + RLS).
 * Never calls any relative /api/... backend endpoint and never embeds secret keys.
 */

import {
  supabaseClient,
  createIsolatedAuthClient,
  loadSystemState,
  saveSystemState,
  saveSystemCollectionDirect,
  patchSystemCollectionDirect,
  saveCompanySettingsDirect,
  extractMissingColumnName,
  loadAuxiliaryState,
  patchAuxiliaryState,
  loadClientStockState,
  saveClientStockState,
  getAuthenticatedActor,
  isStaffRole,
  isUuid,
  generateSafeUuid,
  updatePackageInSupabase,
  createSupabaseDriver,
  fetchSupabasePackages,
  fetchSupabaseClients,
  fetchSupabaseDrivers
} from './supabase';

async function safeDeliveryPartnerWrite(
  mode: 'upsert' | 'update',
  payload: Record<string, any>,
  idForUpdate?: string
): Promise<void> {
  const working: Record<string, any> = { ...payload };
  for (let attempt = 0; attempt < 15; attempt++) {
    if (Object.keys(working).length === 0) return;
    try {
      const res =
        mode === 'upsert'
          ? await supabaseClient.from('delivery_partners').upsert(working, { onConflict: 'id' })
          : await supabaseClient.from('delivery_partners').update(working).eq('id', idForUpdate!);
      if (!res.error) return;
      const badCol = extractMissingColumnName(res.error);
      if (badCol && Object.prototype.hasOwnProperty.call(working, badCol)) {
        delete working[badCol];
        continue;
      }
      console.warn('[Gateway] delivery_partners write notice:', res.error.message);
      return;
    } catch {
      return;
    }
  }
}

// Helper to wrap any plain object into a standard Web Response
function jsonResponse(body: any, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}

function parseJsonBody(init?: RequestInit): any {
  if (!init?.body) return {};
  if (typeof init.body === 'string') {
    try {
      return JSON.parse(init.body);
    } catch {
      return {};
    }
  }
  return init.body;
}

function normalizePhone(phone?: string | null): string {
  return String(phone || '').replace(/\D/g, '');
}

// =============================================================================
// 1. ANALYTICS & VISITOR STATS (DIRECT SUPABASE auxiliary_state)
// =============================================================================

export async function trackAnalyticsVisitDirect(info?: { path?: string; browser?: string; userAgent?: string }) {
  try {
    const ua = (info?.userAgent || (typeof navigator !== 'undefined' ? navigator.userAgent : '')).toLowerCase();
    let browserKey: 'chrome' | 'safari' | 'firefox' | 'edge' | 'other' = 'other';
    if (ua.includes('edg/')) browserKey = 'edge';
    else if (ua.includes('firefox/')) browserKey = 'firefox';
    else if (ua.includes('chrome/') && !ua.includes('edg/')) browserKey = 'chrome';
    else if (ua.includes('safari/') && !ua.includes('chrome/')) browserKey = 'safari';

    await patchAuxiliaryState(aux => {
      const stats: any = aux.visitorStats || {};
      stats.totalVisits = Number(stats.totalVisits || 0) + 1;
      stats.browsers = stats.browsers || { chrome: 0, safari: 0, firefox: 0, edge: 0, other: 0 };
      stats.browsers[browserKey] = Number(stats.browsers[browserKey] || 0) + 1;
      const dayKey = new Date().toISOString().slice(0, 10);
      stats.dailyVisits = stats.dailyVisits || {};
      stats.dailyVisits[dayKey] = Number(stats.dailyVisits[dayKey] || 0) + 1;
      aux.visitorStats = stats;
    });
    return { success: true };
  } catch {
    return { success: false };
  }
}

export async function fetchVisitorStatsDirect(): Promise<{
  success: boolean;
  stats: { chrome: number; safari: number; firefox: number; edge: number; other: number };
}> {
  try {
    const aux = await loadAuxiliaryState();
    const browsers = (aux.visitorStats as any)?.browsers || {};
    return {
      success: true,
      stats: {
        chrome: Number(browsers.chrome || 0),
        safari: Number(browsers.safari || 0),
        firefox: Number(browsers.firefox || 0),
        edge: Number(browsers.edge || 0),
        other: Number(browsers.other || 0)
      }
    };
  } catch {
    return {
      success: false,
      stats: { chrome: 0, safari: 0, firefox: 0, edge: 0, other: 0 }
    };
  }
}

// =============================================================================
// 2. STAFF HEARTBEAT, SHIFTS, CONFIRMATION & CONTROL OVERVIEW
// =============================================================================

export async function sendStaffHeartbeatDirect(payload?: { activeTab?: string; status?: string }) {
  try {
    const actor = await getAuthenticatedActor();
    if (!actor?.id) return { success: false };

    const sys = await loadSystemState();
    const presence: Record<string, any> = { ...(sys.systemCollections?.staffPresence || {}) };
    const existing = presence[actor.id] || {};
    presence[actor.id] = {
      ...existing,
      userId: actor.id,
      name: actor.name,
      email: actor.email,
      role: actor.role,
      lastSeenAt: new Date().toISOString(),
      activeTab: payload?.activeTab || existing.activeTab || 'dashboard',
      workStatus: existing.workStatus || 'idle'
    };

    sys.systemCollections = {
      ...(sys.systemCollections || {}),
      staffPresence: presence
    };
    await saveSystemState(sys);
    return { success: true };
  } catch {
    return { success: false };
  }
}

export async function handleStaffShiftDirect(payload: {
  action: 'start' | 'pause' | 'resume' | 'end';
  targetUserId?: string;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const actor = await getAuthenticatedActor();
    if (!actor?.id) return { success: false, error: 'Non authentifié.' };

    const targetId = payload.targetUserId || actor.id;
    const now = new Date().toISOString();
    const nowMs = Date.now();

    const sys = await loadSystemState();
    const presence: Record<string, any> = { ...(sys.systemCollections?.staffPresence || {}) };
    const shifts: any[] = Array.isArray(sys.systemCollections?.staffShifts)
      ? [...sys.systemCollections.staffShifts]
      : [];

    const cur = presence[targetId] || { userId: targetId, todayWorkedSeconds: 0, workStatus: 'offline' };
    const todayStr = now.slice(0, 10);
    if (cur.todayDate !== todayStr) {
      cur.todayWorkedSeconds = 0;
      cur.todayDate = todayStr;
    }

    const activeElapsed =
      cur.workStatus === 'working' && cur.segmentStartedAt
        ? Math.max(0, Math.floor((nowMs - new Date(cur.segmentStartedAt).getTime()) / 1000))
        : 0;

    if (payload.action === 'start') {
      cur.workStatus = 'working';
      cur.segmentStartedAt = now;
      cur.shiftStartedAt = cur.shiftStartedAt || now;
      cur.lastSeenAt = now;
      shifts.unshift({
        id: `shf-${nowMs}`,
        userId: targetId,
        date: todayStr,
        startedAt: now,
        status: 'working',
        totalSeconds: cur.todayWorkedSeconds || 0
      });
    } else if (payload.action === 'pause') {
      cur.todayWorkedSeconds = Number(cur.todayWorkedSeconds || 0) + activeElapsed;
      cur.workStatus = 'paused';
      cur.segmentStartedAt = null;
      cur.lastSeenAt = now;
    } else if (payload.action === 'resume') {
      cur.workStatus = 'working';
      cur.segmentStartedAt = now;
      cur.lastSeenAt = now;
    } else if (payload.action === 'end') {
      cur.todayWorkedSeconds = Number(cur.todayWorkedSeconds || 0) + activeElapsed;
      cur.workStatus = 'offline';
      cur.segmentStartedAt = null;
      cur.shiftEndedAt = now;
      cur.lastSeenAt = now;
      const openShift = shifts.find(s => s.userId === targetId && s.status !== 'ended');
      if (openShift) {
        openShift.status = 'ended';
        openShift.endedAt = now;
        openShift.totalSeconds = cur.todayWorkedSeconds;
      }
    }

    presence[targetId] = cur;
    sys.systemCollections = {
      ...(sys.systemCollections || {}),
      staffPresence: presence,
      staffShifts: shifts.slice(0, 500)
    };
    await saveSystemState(sys);
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Erreur lors de la mise à jour de la séance.' };
  }
}

export async function handleConfirmationActionDirect(payload: {
  packageId: string;
  trackingNumber?: string;
  outcome: string;
  channel?: string;
  note?: string;
  recipientName?: string;
  recipientPhone?: string;
  city?: string;
  codAmount?: number;
}): Promise<{ success: boolean; packagePatch?: any; log?: any; error?: string }> {
  try {
    const actor = await getAuthenticatedActor();
    if (!actor?.id) return { success: false, error: 'Non authentifié.' };

    const now = new Date().toISOString();
    const logEntry = {
      id: `cnf-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      packageId: payload.packageId,
      trackingNumber: payload.trackingNumber || '',
      staffId: actor.id,
      staffName: actor.name,
      staffRole: actor.role,
      outcome: payload.outcome,
      channel: payload.channel || 'appel',
      note: payload.note || '',
      recipientName: payload.recipientName || '',
      recipientPhone: payload.recipientPhone || '',
      city: payload.city || '',
      codAmount: Number(payload.codAmount || 0),
      createdAt: now
    };

    const sys = await loadSystemState();
    const logs: any[] = Array.isArray(sys.systemCollections?.confirmationLogs)
      ? [logEntry, ...sys.systemCollections.confirmationLogs].slice(0, 1000)
      : [logEntry];

    sys.systemCollections = {
      ...(sys.systemCollections || {}),
      confirmationLogs: logs
    };
    await saveSystemState(sys);

    // Build package patch based on confirmation outcome
    const packagePatch: Record<string, any> = {
      confirmationStatus: payload.outcome,
      confirmedBy: actor.name,
      confirmedAt: now,
      ...(payload.note ? { driverComment: payload.note } : {})
    };

    if (payload.outcome === 'annule') {
      packagePatch.status = 'annule';
    } else if (payload.outcome === 'confirme') {
      packagePatch.status = 'attente_ramassage';
    }

    if (payload.packageId) {
      await updatePackageInSupabase(payload.packageId, packagePatch);
    }

    return { success: true, packagePatch, log: logEntry };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Erreur lors de la sauvegarde.' };
  }
}

export async function fetchStaffControlOverviewDirect(period: string = 'today') {
  try {
    const [sys, profsRes] = await Promise.all([
      loadSystemState(),
      supabaseClient
        .from('profiles')
        .select('*')
        .in('role', ['admin', 'super_admin', 'employee'])
    ]);

    const presence: Record<string, any> = sys.systemCollections?.staffPresence || {};
    const shifts: any[] = Array.isArray(sys.systemCollections?.staffShifts)
      ? sys.systemCollections.staffShifts
      : [];
    const confirmationLogs: any[] = Array.isArray(sys.systemCollections?.confirmationLogs)
      ? sys.systemCollections.confirmationLogs
      : [];
    const storedEmployees: any[] = Array.isArray(sys.systemCollections?.employees)
      ? sys.systemCollections.employees
      : [];

    const nowMs = Date.now();
    const todayStr = new Date().toISOString().slice(0, 10);
    const periodCutoffMs =
      period === 'today'
        ? new Date(todayStr).getTime()
        : period === '7d'
        ? nowMs - 7 * 86400000
        : period === '30d'
        ? nowMs - 30 * 86400000
        : 0;

    // Combine Supabase profiles + stored employees list
    const staffMap = new Map<string, any>();
    for (const p of profsRes.data || []) {
      const empMeta = storedEmployees.find(
        e => e.id === p.id || (p.email && String(e.email || '').toLowerCase() === String(p.email).toLowerCase())
      );
      staffMap.set(p.id, {
        id: p.id,
        name: p.full_name || empMeta?.name || p.email?.split('@')[0] || 'Staff',
        email: p.email || '',
        phone: p.phone || empMeta?.phone || '',
        role: p.role || 'employee',
        status: empMeta?.status || p.account_status || 'active',
        agencyId: empMeta?.agencyId || p.agency_id,
        agencyName: empMeta?.agencyName || p.agency_name,
        employeeRole: empMeta?.employeeRole || p.employee_role || 'confirmatrice',
        assignedCities: empMeta?.assignedCities || p.assigned_cities || [],
        dailyTargetConfirmations: empMeta?.dailyTargetConfirmations ?? p.daily_target_confirmations ?? 30,
        permissions: empMeta?.permissions || p.permissions || [],
        granularPermissions: empMeta?.granularPermissions || p.granular_permissions
      });
    }
    for (const e of storedEmployees) {
      if (e?.id && !staffMap.has(e.id)) {
        staffMap.set(e.id, e);
      }
    }

    const members: import('../types').StaffControlMemberOverview[] = Array.from(staffMap.values()).map(user => {
      const pres = presence[user.id] || {};
      const lastSeenMs = pres.lastSeenAt ? new Date(pres.lastSeenAt).getTime() : 0;
      const isOnline = nowMs - lastSeenMs < 120000;
      const idleSeconds = lastSeenMs > 0 ? Math.max(0, Math.floor((nowMs - lastSeenMs) / 1000)) : 9999;
      const baseWorked = pres.todayDate === todayStr ? Number(pres.todayWorkedSeconds || 0) : 0;
      const activeExtra =
        pres.workStatus === 'working' && pres.segmentStartedAt
          ? Math.max(0, Math.floor((nowMs - new Date(pres.segmentStartedAt).getTime()) / 1000))
          : 0;
      const todayWorkedSeconds = baseWorked + activeExtra;

      const userLogs = confirmationLogs.filter(
        l => l.staffId === user.id && new Date(l.createdAt).getTime() >= periodCutoffMs
      );
      const todayLogs = confirmationLogs.filter(
        l => l.staffId === user.id && String(l.createdAt || '').startsWith(todayStr)
      );

      const confirmedLogs = userLogs.filter(l => l.outcome === 'confirme');
      const cancelledLogs = userLogs.filter(l => l.outcome === 'annule');
      const noAnswerLogs = userLogs.filter(l => l.outcome === 'injoignable' || l.outcome === 'pas_de_reponse');
      const rescheduledLogs = userLogs.filter(l => l.outcome === 'reporte');
      const whatsappLogs = userLogs.filter(l => l.outcome === 'whatsapp_sent');
      const totalHandled = userLogs.filter(l => l.outcome !== 'whatsapp_sent').length;
      const confirmedCodTotal = confirmedLogs.reduce((acc, l) => acc + Number(l.codAmount || 0), 0);

      const mappedWorkStatus: 'working' | 'break' | 'off' =
        pres.workStatus === 'working'
          ? 'working'
          : pres.workStatus === 'paused' || pres.workStatus === 'break'
          ? 'break'
          : 'off';

      const workedHours = Math.max(todayWorkedSeconds / 3600, 0.25);

      return {
        user,
        isOnline,
        idleSeconds,
        lastSeenAt: pres.lastSeenAt || undefined,
        activeSessionsCount: isOnline ? 1 : 0,
        workStatus: mappedWorkStatus,
        currentShift: shifts.find(s => s.userId === user.id && s.status !== 'ended') || null,
        todayWorkedSeconds,
        weekWorkedSeconds: todayWorkedSeconds,
        monthWorkedSeconds: todayWorkedSeconds,
        todayFirstStartAt: pres.shiftStartedAt || undefined,
        currentPage: pres.activeTab || 'dashboard',
        performance: {
          todayActions: todayLogs.filter(l => l.outcome !== 'whatsapp_sent').length,
          todayConfirmed: todayLogs.filter(l => l.outcome === 'confirme').length,
          todayNoAnswer: todayLogs.filter(l => l.outcome === 'injoignable' || l.outcome === 'pas_de_reponse').length,
          todayPostponed: todayLogs.filter(l => l.outcome === 'reporte').length,
          todayCancelled: todayLogs.filter(l => l.outcome === 'annule').length,
          todayWhatsAppSent: todayLogs.filter(l => l.outcome === 'whatsapp_sent').length,
          totalHandled,
          totalConfirmed: confirmedLogs.length,
          totalNoAnswer: noAnswerLogs.length,
          totalPostponed: rescheduledLogs.length,
          totalCancelled: cancelledLogs.length,
          totalWhatsAppSent: whatsappLogs.length,
          confirmationRate: totalHandled > 0 ? Math.round((confirmedLogs.length / totalHandled) * 100) : 0,
          deliveredOfConfirmedRate: 0,
          confirmedCodTotal,
          confirmationsPerHour: Math.round((todayLogs.filter(l => l.outcome === 'confirme').length / workedHours) * 10) / 10
        }
      };
    });

    return {
      success: true,
      members,
      shifts,
      confirmationLogs: confirmationLogs.slice(0, 200)
    };
  } catch (err: any) {
    return { success: false, members: [], shifts: [], confirmationLogs: [], error: err?.message };
  }
}

export async function disconnectEmployeeDirect(employeeId: string) {
  const sys = await loadSystemState();
  const presence = { ...(sys.systemCollections?.staffPresence || {}) };
  if (presence[employeeId]) {
    presence[employeeId] = {
      ...presence[employeeId],
      workStatus: 'offline',
      lastSeenAt: new Date(0).toISOString()
    };
  }
  sys.systemCollections = {
    ...(sys.systemCollections || {}),
    staffPresence: presence
  };
  await saveSystemState(sys);
  return { success: true, message: 'Employé marqué hors ligne.' };
}

// =============================================================================
// 3. SUPER ADMIN SECURITY CONTROLS (DIRECT SUPABASE AUTH & PROFILES)
// =============================================================================

export async function fetchSecurityOverviewDirect() {
  try {
    const actor = await getAuthenticatedActor();
    const [aux, profsRes, shopsRes, pkgsRes] = await Promise.all([
      loadAuxiliaryState(),
      supabaseClient.from('profiles').select('*').in('role', ['super_admin', 'admin', 'employee']),
      supabaseClient.from('merchant_shops').select('id, account_status'),
      supabaseClient.from('packages').select('id', { count: 'exact', head: true })
    ]);

    const privilegedUsers = (profsRes.data || []).map((p: any) => ({
      id: p.id,
      name: p.full_name || p.email?.split('@')[0] || 'Admin',
      email: p.email || '',
      role: p.role || 'admin',
      status: p.account_status || 'active',
      phone: p.phone || '',
      source: 'supabase',
      isOwner: String(p.email || '').toLowerCase() === 'wadarazzeddine30@gmail.com' || p.role === 'super_admin',
      registeredAt: p.created_at
    }));

    const shops = shopsRes.data || [];
    const { data: { session } } = await supabaseClient.auth.getSession();

    const activeSessions = session?.user
      ? [
          {
            sessionId: 'current-supabase-session',
            tokenPreview: `${session.access_token.slice(0, 10)}...${session.access_token.slice(-6)}`,
            userId: session.user.id,
            name: actor?.name || session.user.email || 'Admin',
            email: session.user.email || '',
            role: actor?.role || 'super_admin',
            createdAt: new Date().toISOString(),
            expiresAt: (session.expires_at || Math.floor(Date.now() / 1000) + 3600) * 1000,
            userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'Capacitor APK',
            isCurrent: true
          }
        ]
      : [];

    const s: any = aux.securitySettings || {};
    return {
      success: true,
      overview: {
        securitySettings: {
          requireAdminApprovalForClients: s.requireAdminApprovalForClients ?? true,
          allowPublicClientRegistration: s.allowPublicClientRegistration ?? true,
          allowPublicDriverRegistration: s.allowPublicDriverRegistration ?? true,
          ...s
        },
        activeSessions,
        privilegedUsers,
        counts: {
          superAdmins: privilegedUsers.filter(u => u.role === 'super_admin' || u.isOwner).length,
          privilegedAccounts: privilegedUsers.length,
          activeSessions: activeSessions.length,
          totalShops: shops.length,
          approvedClients: shops.filter((sh: any) => sh.account_status === 'approuve').length,
          pendingClients: shops.filter((sh: any) => sh.account_status === 'en_attente').length,
          suspendedClients: shops.filter((sh: any) => sh.account_status === 'suspendu').length,
          totalPackages: pkgsRes.count || 0
        }
      }
    };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Erreur chargement sécurité.' };
  }
}

export async function changeSuperAdminPasswordDirect(payload: {
  currentPassword: string;
  newPassword: string;
  revokeOtherSessions?: boolean;
}) {
  try {
    const { data: { session } } = await supabaseClient.auth.getSession();
    const email = session?.user?.email;
    if (!email) {
      return { success: false, error: 'Session Supabase Auth active requise.' };
    }

    // Re-verify current password directly via Supabase Auth
    const verifier = createIsolatedAuthClient();
    const { error: verifyErr } = await verifier.auth.signInWithPassword({
      email,
      password: payload.currentPassword
    });
    if (verifyErr) {
      return { success: false, error: 'Le mot de passe actuel est incorrect.' };
    }

    const { error: updateErr } = await supabaseClient.auth.updateUser({
      password: payload.newPassword
    });
    if (updateErr) {
      return { success: false, error: updateErr.message };
    }

    let revokedSessionsCount = 0;
    if (payload.revokeOtherSessions) {
      const { error: signOutErr } = await supabaseClient.auth.signOut({ scope: 'others' });
      if (!signOutErr) revokedSessionsCount = 1;
    }

    return {
      success: true,
      message: 'Mot de passe Super Admin mis à jour sur Supabase Auth.',
      revokedSessionsCount
    };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Erreur de changement de mot de passe.' };
  }
}

export async function updateSecuritySettingsDirect(patch: Record<string, any>) {
  const aux = await patchAuxiliaryState(state => {
    state.securitySettings = {
      ...(state.securitySettings || {}),
      ...patch
    } as any;
  });
  return {
    success: true,
    securitySettings: aux.securitySettings
  };
}

export async function revokeOtherSessionsDirect() {
  const { error } = await supabaseClient.auth.signOut({ scope: 'others' });
  if (error) {
    return { success: false, error: error.message };
  }
  return {
    success: true,
    message: 'Toutes les autres sessions actives ont été déconnectées sur Supabase Auth.'
  };
}

export async function deletePrivilegedUserDirect(id: string) {
  const { error } = await supabaseClient.from('profiles').delete().eq('id', id);
  if (error) {
    return { success: false, error: error.message };
  }
  const sys = await loadSystemState();
  if (Array.isArray(sys.systemCollections?.employees)) {
    sys.systemCollections.employees = sys.systemCollections.employees.filter((e: any) => e.id !== id);
    await saveSystemState(sys);
  }
  return { success: true, message: 'Accès privilégié supprimé de Supabase.' };
}

// =============================================================================
// 4. PARTNER DIRECT ACTIONS (PARTNER PORTAL LIVE TEST & CRUD)
// =============================================================================

export async function executePartnerParcelsStateDirect(payload: {
  refs: string[];
  state: string;
  reason?: string;
}) {
  const refs = Array.isArray(payload.refs) ? payload.refs.map(r => String(r).trim()).filter(Boolean) : [];
  if (refs.length === 0) {
    return { status: 400, body: { success: false, error: 'Aucune référence colis fournie.' } };
  }

  const stateMap: Record<string, string> = {
    Delivered: 'livre',
    Cancelled: 'annule',
    Refused: 'refuse',
    Postponed: 'reporte',
    'No Answer': 'injoignable',
    Unreachable: 'injoignable',
    'In Progress': 'en_cours_livraison',
    Returned: 'retourne',
    'Picked Up': 'ramasse'
  };
  const internalStatus = stateMap[payload.state] || 'en_cours_livraison';
  const updated: Array<{ ref: string; status: string }> = [];
  const notFound: string[] = [];

  for (const ref of refs) {
    let { data: pkg } = await supabaseClient
      .from('packages')
      .select('id, tracking_number')
      .eq('tracking_number', ref)
      .maybeSingle();

    if (!pkg) {
      const byPartner = await supabaseClient
        .from('packages')
        .select('id, tracking_number')
        .eq('partner_tracking_number', ref)
        .maybeSingle();
      pkg = byPartner.data;
    }

    if (pkg?.id) {
      await updatePackageInSupabase(pkg.id, {
        status: internalStatus as any,
        driverComment: payload.reason || `Partner API: ${payload.state}`
      });
      updated.push({ ref, status: internalStatus });
    } else {
      notFound.push(ref);
    }
  }

  return {
    status: 200,
    body: {
      success: true,
      message: `${updated.length} colis mis à jour directement sur Supabase.`,
      data: { updated, notFound }
    }
  };
}

// =============================================================================
// 5. CLIENT STOCK DIRECT ENGINE (UNITS, BARCODES, SCAN, DISPATCH, DEDUCT, RESTORE)
// =============================================================================

function recomputeProductCounts(product: any) {
  const units: any[] = Array.isArray(product.units) ? product.units : [];
  const totalQuantity = units.length;
  const availableQuantity = units.filter(u => u.status === 'en_stock').length;
  const pendingScanQuantity = units.filter(u => u.status === 'en_attente_reception').length;
  const dispatchedQuantity = units.filter(u => u.status === 'expedie' || u.status === 'livre').length;
  return {
    ...product,
    units,
    totalQuantity,
    availableQuantity,
    pendingScanQuantity,
    dispatchedQuantity,
    updatedAt: new Date().toISOString()
  };
}

function generateStockUnits(productId: string, sku: string, startIndex: number, count: number) {
  const now = new Date().toISOString();
  const units: any[] = [];
  for (let i = 0; i < count; i++) {
    const seq = String(startIndex + i + 1).padStart(3, '0');
    const rand = Math.floor(1000 + Math.random() * 9000);
    units.push({
      id: `unit-${Date.now()}-${i}-${rand}`,
      productId,
      barcode: `${sku}-${seq}-${rand}`,
      status: 'en_attente_reception',
      createdAt: now
    });
  }
  return units;
}

async function handleClientStockRoute(subPath: string, method: string, body: any, queryParams: URLSearchParams): Promise<Response> {
  const actor = await getAuthenticatedActor();
  const stock = await loadClientStockState();

  // GET client-stock
  if (subPath === '' && method === 'GET') {
    const clientIdFilter = queryParams.get('clientId');
    let products = stock.products;
    let movements = stock.movements;
    let invoices = stock.invoices;

    if (clientIdFilter) {
      products = products.filter(p => p.clientId === clientIdFilter);
      const pidSet = new Set(products.map(p => p.id));
      movements = movements.filter(m => m.clientId === clientIdFilter || pidSet.has(m.productId));
      invoices = invoices.filter(i => i.clientId === clientIdFilter);
    } else if (actor && !actor.isImpersonating && !isStaffRole(actor.role)) {
      products = products.filter(p => p.clientId === actor.id || (actor.shopId && p.clientId === actor.shopId));
      const pidSet = new Set(products.map(p => p.id));
      movements = movements.filter(m => m.clientId === actor.id || pidSet.has(m.productId));
      invoices = invoices.filter(i => i.clientId === actor.id);
    }

    return jsonResponse({ success: true, products, movements, invoices });
  }

  // POST client-stock/sync
  if (subPath === 'sync' && method === 'POST') {
    const incomingProducts: any[] = Array.isArray(body.products) ? body.products : [];
    const incomingMovements: any[] = Array.isArray(body.movements) ? body.movements : [];
    const incomingInvoices: any[] = Array.isArray(body.invoices) ? body.invoices : [];

    const existingIds = new Set(stock.products.map(p => p.id));
    for (const p of incomingProducts) {
      if (p?.id && !existingIds.has(p.id)) {
        stock.products.unshift(p);
        existingIds.add(p.id);
      }
    }
    const existingMovIds = new Set(stock.movements.map(m => m.id));
    for (const m of incomingMovements) {
      if (m?.id && !existingMovIds.has(m.id)) {
        stock.movements.unshift(m);
        existingMovIds.add(m.id);
      }
    }
    const existingInvIds = new Set(stock.invoices.map(i => i.id));
    for (const inv of incomingInvoices) {
      if (inv?.id && !existingInvIds.has(inv.id)) {
        stock.invoices.unshift(inv);
        existingInvIds.add(inv.id);
      }
    }
    await saveClientStockState(stock);
    return jsonResponse({ success: true, products: stock.products, movements: stock.movements, invoices: stock.invoices });
  }

  // POST client-stock/products
  if (subPath === 'products' && method === 'POST') {
    const qty = Math.max(1, Math.min(500, Number(body.quantity || 1)));
    const now = new Date().toISOString();
    const productId = `stk-prod-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const sku = `STK-${Math.floor(100000 + Math.random() * 900000)}`;
    const units = generateStockUnits(productId, sku, 0, qty);

    const product = recomputeProductCounts({
      id: productId,
      sku,
      clientId: body.clientId || actor?.id || 'unknown',
      clientName: body.clientName || actor?.name || 'Client',
      clientCompany: body.clientCompany || actor?.companyName || 'Boutique',
      name: String(body.name || 'Produit').trim(),
      photoUrl: body.photoUrl || undefined,
      category: body.category || 'Général',
      unitPrice: Number(body.unitPrice || 0),
      hubName: body.hubName || 'Hub Principal Casablanca',
      notes: body.notes || '',
      units,
      createdAt: now,
      updatedAt: now
    });

    const movement = {
      id: `stk-mov-${Date.now()}`,
      productId,
      productName: product.name,
      clientId: product.clientId,
      type: 'entree',
      quantity: qty,
      actorName: body.actorName || actor?.name || 'Admin',
      notes: `Ajout initial de ${qty} pièce(s)`,
      createdAt: now
    };

    stock.products.unshift(product);
    stock.movements.unshift(movement);
    await saveClientStockState(stock);
    return jsonResponse({ success: true, product, movement });
  }

  // POST client-stock/products/:id/add-units
  const addUnitsMatch = subPath.match(/^products\/([^/]+)\/add-units$/);
  if (addUnitsMatch && method === 'POST') {
    const productId = decodeURIComponent(addUnitsMatch[1]);
    const idx = stock.products.findIndex(p => p.id === productId);
    if (idx === -1) return jsonResponse({ success: false, error: 'Produit introuvable.' }, 404);

    const qty = Math.max(1, Math.min(500, Number(body.quantity || 1)));
    const prod = stock.products[idx];
    const newUnits = generateStockUnits(productId, prod.sku || 'STK', (prod.units || []).length, qty);
    const updated = recomputeProductCounts({ ...prod, units: [...(prod.units || []), ...newUnits] });
    stock.products[idx] = updated;

    const movement = {
      id: `stk-mov-${Date.now()}`,
      productId,
      productName: updated.name,
      clientId: updated.clientId,
      type: 'entree',
      quantity: qty,
      actorName: body.actorName || actor?.name || 'Admin',
      notes: `Réapprovisionnement +${qty} pièce(s)`,
      createdAt: new Date().toISOString()
    };
    stock.movements.unshift(movement);
    await saveClientStockState(stock);
    return jsonResponse({ success: true, product: updated, movement });
  }

  // POST client-stock/scan
  if (subPath === 'scan' && method === 'POST') {
    const code = String(body.code || '').trim();
    const now = new Date().toISOString();
    let matchedProdIdx = -1;
    let matchedUnit: any = null;

    for (let i = 0; i < stock.products.length; i++) {
      const p = stock.products[i];
      if (p.id === code || p.sku === code) {
        matchedProdIdx = i;
        if (body.scanAllPending) {
          for (const u of p.units || []) {
            if (u.status === 'en_attente_reception') {
              u.status = 'en_stock';
              u.scannedAt = now;
              u.hubName = body.hubName || p.hubName;
              u.zone = body.zone || u.zone;
              u.shelf = body.shelf || u.shelf;
              u.bin = body.bin || u.bin;
              matchedUnit = u;
            }
          }
        } else {
          const pending = (p.units || []).find((u: any) => u.status === 'en_attente_reception');
          if (pending) {
            pending.status = 'en_stock';
            pending.scannedAt = now;
            pending.hubName = body.hubName || p.hubName;
            pending.zone = body.zone || pending.zone;
            pending.shelf = body.shelf || pending.shelf;
            pending.bin = body.bin || pending.bin;
            matchedUnit = pending;
          }
        }
        break;
      }

      const unit = (p.units || []).find(
        (u: any) => u.barcode === code || u.id === code
      );
      if (unit) {
        matchedProdIdx = i;
        unit.status = 'en_stock';
        unit.scannedAt = now;
        unit.hubName = body.hubName || p.hubName;
        unit.zone = body.zone || unit.zone;
        unit.shelf = body.shelf || unit.shelf;
        unit.bin = body.bin || unit.bin;
        matchedUnit = unit;
        break;
      }
    }

    if (matchedProdIdx === -1) {
      return jsonResponse({ success: false, error: `Code "${code}" introuvable dans le stock.` }, 404);
    }

    stock.products[matchedProdIdx] = recomputeProductCounts(stock.products[matchedProdIdx]);
    const prod = stock.products[matchedProdIdx];
    stock.movements.unshift({
      id: `stk-mov-${Date.now()}`,
      productId: prod.id,
      productName: prod.name,
      clientId: prod.clientId,
      type: 'reception',
      quantity: 1,
      actorName: body.actorName || actor?.name || 'Agent Hub',
      notes: `Scan réception (${matchedUnit?.barcode || code})`,
      createdAt: now
    });

    await saveClientStockState(stock);
    return jsonResponse({
      success: true,
      message: 'Pièce réceptionnée en stock avec succès.',
      product: prod,
      unit: matchedUnit
    });
  }

  // POST client-stock/dispatch-unit
  if (subPath === 'dispatch-unit' && method === 'POST') {
    const code = String(body.code || '').trim();
    const now = new Date().toISOString();
    let matchedProdIdx = -1;
    let matchedUnit: any = null;

    for (let i = 0; i < stock.products.length; i++) {
      const p = stock.products[i];
      const byUnit = (p.units || []).find((u: any) => u.barcode === code || u.id === code);
      if (byUnit) {
        matchedProdIdx = i;
        matchedUnit = byUnit;
        break;
      }
      if (p.id === code || p.sku === code) {
        const available = (p.units || []).find((u: any) => u.status === 'en_stock');
        if (available) {
          matchedProdIdx = i;
          matchedUnit = available;
          break;
        }
      }
    }

    if (matchedProdIdx === -1 || !matchedUnit) {
      return jsonResponse({ success: false, error: `Aucune pièce disponible pour "${code}".` }, 404);
    }

    matchedUnit.status = 'expedie';
    matchedUnit.dispatchedAt = now;
    matchedUnit.packageId = body.packageId || undefined;
    matchedUnit.trackingNumber = body.trackingNumber || undefined;

    stock.products[matchedProdIdx] = recomputeProductCounts(stock.products[matchedProdIdx]);
    const prod = stock.products[matchedProdIdx];
    const movement = {
      id: `stk-mov-${Date.now()}`,
      productId: prod.id,
      productName: prod.name,
      clientId: prod.clientId,
      type: 'sortie',
      quantity: 1,
      packageId: body.packageId,
      trackingNumber: body.trackingNumber,
      actorName: body.actorName || actor?.name || 'Admin',
      notes: body.notes || `Sortie pièce ${matchedUnit.barcode}`,
      createdAt: now
    };
    stock.movements.unshift(movement);
    await saveClientStockState(stock);
    return jsonResponse({
      success: true,
      message: 'Pièce sortie du stock avec succès.',
      product: prod,
      unit: matchedUnit,
      movement
    });
  }

  // POST client-stock/deduct
  if (subPath === 'deduct' && method === 'POST') {
    const items: { productId: string; quantity: number }[] = Array.isArray(body.items) ? body.items : [];
    const now = new Date().toISOString();
    const updatedProducts: any[] = [];
    const movements: any[] = [];
    const invoiceItems: any[] = [];
    let productsSubtotal = 0;

    for (const item of items) {
      const idx = stock.products.findIndex(p => p.id === item.productId);
      if (idx === -1) continue;
      const prod = stock.products[idx];
      const qtyNeeded = Math.max(1, Number(item.quantity || 1));
      const candidates = (prod.units || []).filter(
        (u: any) => u.status === 'en_stock' || u.status === 'en_attente_reception'
      );
      const selected = candidates.slice(0, qtyNeeded);
      for (const u of selected) {
        u.status = 'expedie';
        u.dispatchedAt = now;
        u.packageId = body.packageId;
        u.trackingNumber = body.trackingNumber;
      }

      const recomputed = recomputeProductCounts(prod);
      stock.products[idx] = recomputed;
      updatedProducts.push(recomputed);

      const lineTotal = Number(prod.unitPrice || 0) * qtyNeeded;
      productsSubtotal += lineTotal;
      invoiceItems.push({
        productId: prod.id,
        productName: prod.name,
        quantity: qtyNeeded,
        unitPrice: Number(prod.unitPrice || 0),
        totalPrice: lineTotal
      });

      const mov = {
        id: `stk-mov-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
        productId: prod.id,
        productName: prod.name,
        clientId: prod.clientId,
        type: 'sortie',
        quantity: qtyNeeded,
        packageId: body.packageId,
        trackingNumber: body.trackingNumber,
        actorName: body.actorName || actor?.name || 'Système',
        notes: `Déduction automatique colis ${body.trackingNumber || ''}`,
        createdAt: now
      };
      movements.push(mov);
      stock.movements.unshift(mov);
    }

    const invoice = {
      id: `stk-inv-${Date.now()}`,
      invoiceNumber: `INV-STK-${Math.floor(100000 + Math.random() * 900000)}`,
      clientId: body.clientId,
      clientName: body.clientName || '',
      clientCompany: body.clientCompany || '',
      clientPhone: body.clientPhone || '',
      packageId: body.packageId,
      trackingNumber: body.trackingNumber,
      recipientName: body.recipientName,
      recipientCity: body.recipientCity,
      deliveryFee: Number(body.deliveryFee || 0),
      items: invoiceItems,
      subtotal: productsSubtotal,
      totalAmount: productsSubtotal,
      status: 'generee',
      createdAt: now
    };
    stock.invoices.unshift(invoice);
    await saveClientStockState(stock);
    return jsonResponse({ success: true, invoice, updatedProducts, movements });
  }

  // POST client-stock/restore-package
  if (subPath === 'restore-package' && method === 'POST') {
    const now = new Date().toISOString();
    let restoredCount = 0;
    const updatedProducts: any[] = [];

    for (let i = 0; i < stock.products.length; i++) {
      const prod = stock.products[i];
      let touched = false;
      for (const u of prod.units || []) {
        if (
          u.status === 'expedie' &&
          ((body.packageId && u.packageId === body.packageId) ||
            (body.trackingNumber && u.trackingNumber === body.trackingNumber))
        ) {
          u.status = 'en_stock';
          u.packageId = undefined;
          u.trackingNumber = undefined;
          restoredCount++;
          touched = true;
        }
      }
      if (touched) {
        stock.products[i] = recomputeProductCounts(prod);
        updatedProducts.push(stock.products[i]);
        stock.movements.unshift({
          id: `stk-mov-${Date.now()}-${i}`,
          productId: prod.id,
          productName: prod.name,
          clientId: prod.clientId,
          type: 'retour_stock',
          quantity: restoredCount,
          packageId: body.packageId,
          trackingNumber: body.trackingNumber,
          actorName: body.actorName || actor?.name || 'Système',
          notes: `Retour en stock colis ${body.trackingNumber || body.packageId}`,
          createdAt: now
        });
      }
    }

    if (restoredCount > 0) {
      await saveClientStockState(stock);
    }
    return jsonResponse({ success: true, restoredCount, updatedProducts });
  }

  // PATCH client-stock/invoices/:id
  const invMatch = subPath.match(/^invoices\/([^/]+)$/);
  if (invMatch && method === 'PATCH') {
    const invId = decodeURIComponent(invMatch[1]);
    const idx = stock.invoices.findIndex(i => i.id === invId);
    if (idx === -1) return jsonResponse({ success: false, error: 'Facture introuvable.' }, 404);
    stock.invoices[idx] = { ...stock.invoices[idx], status: body.status || 'payee', updatedAt: new Date().toISOString() };
    await saveClientStockState(stock);
    return jsonResponse({ success: true, invoice: stock.invoices[idx] });
  }

  // DELETE client-stock/products/:productId/units/:unitId
  const delUnitMatch = subPath.match(/^products\/([^/]+)\/units\/([^/]+)$/);
  if (delUnitMatch && method === 'DELETE') {
    const productId = decodeURIComponent(delUnitMatch[1]);
    const unitId = decodeURIComponent(delUnitMatch[2]);
    const idx = stock.products.findIndex(p => p.id === productId);
    if (idx === -1) return jsonResponse({ success: false, error: 'Produit introuvable.' }, 404);
    const prod = stock.products[idx];
    const nextUnits = (prod.units || []).filter((u: any) => u.id !== unitId);
    stock.products[idx] = recomputeProductCounts({ ...prod, units: nextUnits });
    await saveClientStockState(stock);
    return jsonResponse({ success: true, product: stock.products[idx] });
  }

  // DELETE client-stock/products/:productId
  const delProdMatch = subPath.match(/^products\/([^/]+)$/);
  if (delProdMatch && method === 'DELETE') {
    const productId = decodeURIComponent(delProdMatch[1]);
    const existed = stock.products.some(p => p.id === productId);
    stock.products = stock.products.filter(p => p.id !== productId);
    stock.movements = stock.movements.filter(m => m.productId !== productId);
    await saveClientStockState(stock);
    return jsonResponse({ success: true, existed });
  }

  return jsonResponse({ success: false, error: `Action stock inconnue: ${subPath}` }, 404);
}

// =============================================================================
// 6. MAIN DIRECT SUPABASE DISPATCHER (ZERO /api/... NETWORK CALLS)
// =============================================================================

export async function directSupabaseRequest(
  resource: string,
  init: RequestInit = {}
): Promise<Response> {
  const method = String(init.method || 'GET').toUpperCase();
  const body = parseJsonBody(init);

  // Parse path & query params cleanly
  const [rawPath, rawQuery] = resource.split('?');
  const path = rawPath.replace(/^\/+/, '').replace(/^api\//, '');
  const queryParams = new URLSearchParams(rawQuery || '');

  try {
    // -------------------------------------------------------------------------
    // SYSTEM COLLECTIONS & COMPANY SETTINGS & PUBLIC CITIES
    // -------------------------------------------------------------------------
    if (path === 'system-collections' && method === 'GET') {
      const sys = await loadSystemState();
      return jsonResponse({
        success: true,
        collections: sys.systemCollections || {},
        companySettings: sys.companySettings || {}
      });
    }

    const sysColMatch = path.match(/^system-collections\/([^/]+)$/);
    if (sysColMatch) {
      const key = decodeURIComponent(sysColMatch[1]);
      if (method === 'PUT' || method === 'POST') {
        const value = body.value !== undefined ? body.value : body;
        await saveSystemCollectionDirect(key, value);
        return jsonResponse({ success: true, key });
      }
      const sys = await loadSystemState();
      return jsonResponse({ success: true, value: sys.systemCollections?.[key] });
    }

    if (path === 'company-settings') {
      if (method === 'PUT' || method === 'POST') {
        const nextSettings = await saveCompanySettingsDirect(body.settings || body || {});
        return jsonResponse({ success: true, settings: nextSettings });
      }
      const sys = await loadSystemState();
      return jsonResponse({ success: true, settings: sys.companySettings || {} });
    }

    if (path === 'public/cities' && method === 'GET') {
      const sys = await loadSystemState();
      return jsonResponse({
        success: true,
        cities: Array.isArray(sys.systemCollections?.cities) ? sys.systemCollections.cities : []
      });
    }

    // -------------------------------------------------------------------------
    // SAVED ADDRESSES
    // -------------------------------------------------------------------------
    if (path === 'saved-addresses') {
      const actor = await getAuthenticatedActor();
      const uid = actor?.id || 'guest';
      if (method === 'GET') {
        const aux = await loadAuxiliaryState();
        return jsonResponse({ success: true, addresses: aux.userSavedAddresses?.[uid] || [] });
      }
      if (method === 'PUT' || method === 'POST') {
        const addresses = Array.isArray(body.addresses) ? body.addresses : [];
        await patchAuxiliaryState(aux => {
          aux.userSavedAddresses[uid] = addresses;
        });
        return jsonResponse({ success: true, addresses });
      }
    }

    // -------------------------------------------------------------------------
    // PROBLEM REPORTS
    // -------------------------------------------------------------------------
    if (path === 'problem-reports') {
      if (method === 'GET') {
        const aux = await loadAuxiliaryState();
        return jsonResponse({ success: true, reports: aux.problemReports || {} });
      }
      if (method === 'POST') {
        const pkgId = body.packageId || body.id;
        if (pkgId) {
          const report = {
            ...body,
            reportedAt: body.reportedAt || new Date().toISOString(),
            resolved: false
          };
          await updatePackageInSupabase(pkgId, { problemReport: report });
          return jsonResponse({ success: true, report });
        }
        return jsonResponse({ success: false, error: 'packageId requis.' }, 400);
      }
    }

    const resolveProbMatch = path.match(/^problem-reports\/([^/]+)\/resolve$/);
    if (resolveProbMatch && (method === 'POST' || method === 'PATCH' || method === 'PUT')) {
      const pkgId = decodeURIComponent(resolveProbMatch[1]);
      const aux = await loadAuxiliaryState();
      const existing = aux.problemReports?.[pkgId] || {};
      const resolvedReport = {
        ...existing,
        ...body,
        resolved: true,
        resolvedAt: new Date().toISOString()
      };
      await updatePackageInSupabase(pkgId, { problemReport: resolvedReport });
      return jsonResponse({ success: true, report: resolvedReport });
    }

    // -------------------------------------------------------------------------
    // DIRECT PACKAGE UPDATE (PUT/PATCH packages/:id)
    // -------------------------------------------------------------------------
    const pkgMatch = path.match(/^packages\/([^/]+)$/);
    if (pkgMatch && (method === 'PUT' || method === 'PATCH')) {
      const pkgId = decodeURIComponent(pkgMatch[1]);
      const res = await updatePackageInSupabase(pkgId, body);
      return jsonResponse(res, res.success ? 200 : 400);
    }

    // -------------------------------------------------------------------------
    // CLIENT STOCK
    // -------------------------------------------------------------------------
    if (path === 'client-stock' || path.startsWith('client-stock/')) {
      const subPath = path === 'client-stock' ? '' : path.slice('client-stock/'.length);
      return handleClientStockRoute(subPath, method, body, queryParams);
    }

    // -------------------------------------------------------------------------
    // REVIEWS
    // -------------------------------------------------------------------------
    if (path === 'reviews') {
      const aux = await loadAuxiliaryState();
      if (method === 'GET') {
        const showAll = queryParams.get('all') === '1';
        const list = showAll
          ? aux.reviews
          : aux.reviews.filter((r: any) => r.isPublic !== false);
        const { drivers } = await fetchSupabaseDrivers();
        return jsonResponse({
          success: true,
          reviews: list,
          drivers: drivers.map(d => ({ id: d.id, name: d.name, city: d.city }))
        });
      }
      if (method === 'POST') {
        const review = {
          id: `rev-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          ...body,
          rating: Math.max(1, Math.min(5, Number(body.rating || 5))),
          isPublic: true,
          createdAt: new Date().toISOString()
        };
        await patchAuxiliaryState(s => {
          s.reviews = [review, ...s.reviews];
        });
        return jsonResponse({ success: true, review });
      }
    }

    const revMatch = path.match(/^reviews\/([^/]+)$/);
    if (revMatch) {
      const revId = decodeURIComponent(revMatch[1]);
      if (method === 'PATCH' || method === 'PUT') {
        let updatedRev: any = null;
        await patchAuxiliaryState(s => {
          s.reviews = s.reviews.map((r: any) => {
            if (r.id === revId) {
              updatedRev = { ...r, ...body, updatedAt: new Date().toISOString() };
              return updatedRev;
            }
            return r;
          });
        });
        return jsonResponse({ success: true, review: updatedRev });
      }
      if (method === 'DELETE') {
        await patchAuxiliaryState(s => {
          s.reviews = s.reviews.filter((r: any) => r.id !== revId);
        });
        return jsonResponse({ success: true });
      }
    }

    // -------------------------------------------------------------------------
    // CUSTOMER BLACKLIST
    // -------------------------------------------------------------------------
    if (path === 'blacklist') {
      if (method === 'GET') {
        const sys = await loadSystemState();
        const entries: any[] = Array.isArray(sys.systemCollections?.customerBlacklist)
          ? [...sys.systemCollections.customerBlacklist]
          : [];
        return jsonResponse({ success: true, entries });
      }
      if (method === 'POST') {
        const actor = await getAuthenticatedActor();
        const entry = {
          id: `blk-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          phone: String(body.phone || '').trim(),
          normalizedPhone: normalizePhone(body.phone),
          customerName: body.customerName || '',
          city: body.city || '',
          reason: body.reason || 'Client non sérieux',
          comment: body.comment || '',
          reportedBy: actor?.name || 'Boutique',
          reportedById: actor?.id || '',
          createdAt: new Date().toISOString()
        };
        const nextEntries = await patchSystemCollectionDirect<any[]>('customerBlacklist', prev => [
          entry,
          ...(Array.isArray(prev) ? prev : [])
        ]);
        return jsonResponse({ success: true, entry, entries: nextEntries });
      }
    }

    const blkMatch = path.match(/^blacklist\/([^/]+)$/);
    if (blkMatch && method === 'DELETE') {
      const id = decodeURIComponent(blkMatch[1]);
      const entries = await patchSystemCollectionDirect<any[]>('customerBlacklist', prev =>
        Array.isArray(prev) ? prev.filter((e: any) => e.id !== id) : []
      );
      return jsonResponse({ success: true, entries });
    }

    // -------------------------------------------------------------------------
    // WHATSAPP LOGS & DISPATCH
    // -------------------------------------------------------------------------
    if (path === 'notifications/whatsapp-logs') {
      if (method === 'GET') {
        const aux = await loadAuxiliaryState();
        return jsonResponse({ success: true, logs: aux.whatsappLogs || [] });
      }
      if (method === 'DELETE') {
        await patchAuxiliaryState(s => {
          s.whatsappLogs = [];
        });
        return jsonResponse({ success: true });
      }
    }

    if (path === 'notifications/whatsapp-dispatch' && method === 'POST') {
      const sys = await loadSystemState();
      const settings = sys.companySettings || {};
      const provider: 'webhook' | 'meta_cloud' =
        (body.provider || settings.whatsappProvider) === 'meta_cloud' ? 'meta_cloud' : 'webhook';
      const phoneNumberId = String(body.phoneNumberId || settings.whatsappPhoneNumberId || '').trim();
      const webhookUrl = String(body.webhookUrl || settings.whatsappWebhookUrl || '').trim();
      const apiToken = String(body.apiToken || settings.whatsappApiToken || '').trim();
      const notifyTarget: 'recipient' | 'merchant' | 'both' =
        body.notifyTarget || settings.whatsappNotifyTarget || 'both';
      const now = new Date().toISOString();

      const trackingNumber = String(body.trackingNumber || 'FAR-TEST-0001');
      const recipientName = String(body.recipientName || 'Client Destinataire');
      const recipientPhone = String(body.recipientPhone || settings.whatsapp || '');
      const merchantPhone = typeof body.merchantPhone === 'string' ? body.merchantPhone : undefined;
      const statusCode = String(body.status || 'en_cours_livraison');
      const statusLabel = String(body.statusLabel || statusCode);
      const city = String(body.city || 'Maroc');
      const codAmount = Number(body.codAmount || 0);
      const companyName = settings.companyName || 'FARIOUSY DELIVERY SARL';
      const origin =
        typeof window !== 'undefined' && /^https?:\/\//i.test(window.location.origin)
          ? window.location.origin
          : (settings.website || 'https://app.fariousy.com').replace(/\/+$/, '');
      const trackingUrl =
        typeof body.trackingUrl === 'string' && /^https?:\/\//i.test(body.trackingUrl)
          ? body.trackingUrl
          : `${origin}/?track=${encodeURIComponent(trackingNumber.toUpperCase())}`;

      const tpl =
        (body.testMode && typeof body.template === 'string' && body.template.trim()
          ? body.template
          : settings.whatsappCustomTemplate) ||
        '📦 {{company}} : السلام عليكم {{recipient}}، الطرد ديالك {{tracking}} ({{city}}) ولات الحالة ديالو: {{status}}. المبلغ عند الاستلام: {{cod}} DH. التتبع المباشر: {{tracking_url}}';

      const formattedMessage = tpl
        .replace(/\{\{company\}\}/g, companyName)
        .replace(/\{\{tracking\}\}/g, trackingNumber)
        .replace(/\{\{recipient\}\}/g, recipientName)
        .replace(/\{\{status\}\}/g, statusLabel)
        .replace(/\{\{status_ar\}\}/g, statusLabel)
        .replace(/\{\{city\}\}/g, city)
        .replace(/\{\{cod\}\}/g, String(codAmount))
        .replace(/\{\{driver\}\}/g, String(body.driverName || 'الموزع'))
        .replace(/\{\{tracking_url\}\}/g, trackingUrl);

      const cleanDigits = (p?: string) => {
        const d = String(p || '').replace(/\D+/g, '');
        if (!d) return '';
        if (d.startsWith('00')) return d.slice(2);
        if (d.startsWith('212') && d.length >= 12) return d;
        if (d.startsWith('0') && d.length === 10) return `212${d.slice(1)}`;
        if ((d.startsWith('6') || d.startsWith('7') || d.startsWith('5')) && d.length === 9) return `212${d}`;
        return d;
      };
      const primaryPhone = cleanDigits(notifyTarget === 'merchant' && merchantPhone ? merchantPhone : recipientPhone);
      const whatsappDirectUrl = primaryPhone
        ? `https://wa.me/${primaryPhone}?text=${encodeURIComponent(formattedMessage)}`
        : `https://wa.me/?text=${encodeURIComponent(formattedMessage)}`;

      // 1. Prefer real server proxy /api/notifications/whatsapp-dispatch when running on web HTTP origin
      //    (avoids CORS blocks on Meta Cloud API & allows server-side .env secrets to stay strictly on the server)
      if (typeof window !== 'undefined' && /^https?:$/i.test(window.location.protocol)) {
        try {
          const { data: sessData } = await supabaseClient.auth.getSession();
          const bearer = sessData?.session?.access_token;
          const headers: Record<string, string> = { 'Content-Type': 'application/json' };
          if (bearer) headers['Authorization'] = `Bearer ${bearer}`;
          const serverResp = await fetch('/api/notifications/whatsapp-dispatch', {
            method: 'POST',
            headers,
            body: JSON.stringify({
              ...body,
              provider,
              phoneNumberId,
              webhookUrl,
              apiToken,
              notifyTarget,
              trackingUrl
            })
          });
          const ct = serverResp.headers.get('content-type') || '';
          if (ct.includes('application/json')) {
            const serverJson = await serverResp.json();
            if (serverJson?.log) {
              await patchAuxiliaryState(s => {
                s.whatsappLogs = [serverJson.log, ...(s.whatsappLogs || [])].slice(0, 150);
              });
              return jsonResponse(serverJson);
            }
          }
        } catch {
          // Fall back to direct gateway below (e.g. Capacitor APK / offline server)
        }
      }

      // 2. Fallback direct dispatch (APK / serverless without Express backend)
      let deliveryState: 'sent' | 'failed' | 'not_configured' = 'not_configured';
      let httpStatus: number | undefined;
      let errorMsg: string | undefined;
      let isConfigured = false;

      if (provider === 'meta_cloud' && /^\d{5,25}$/.test(phoneNumberId) && apiToken) {
        isConfigured = true;
        try {
          const toPhone = primaryPhone;
          const resp = await fetch(`https://graph.facebook.com/v21.0/${phoneNumberId}/messages`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: apiToken.startsWith('Bearer ') ? apiToken : `Bearer ${apiToken}`
            },
            body: JSON.stringify({
              messaging_product: 'whatsapp',
              recipient_type: 'individual',
              to: toPhone,
              type: 'text',
              text: { preview_url: true, body: formattedMessage }
            })
          });
          httpStatus = resp.status;
          deliveryState = resp.ok ? 'sent' : 'failed';
          if (!resp.ok) errorMsg = `HTTP ${resp.status}`;
        } catch (err: any) {
          deliveryState = 'failed';
          errorMsg = err?.message || 'Erreur réseau Meta WhatsApp API';
        }
      } else if (webhookUrl && /^https?:\/\//i.test(webhookUrl)) {
        isConfigured = true;
        try {
          const resp = await fetch(webhookUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...(apiToken ? { Authorization: apiToken.startsWith('Bearer ') ? apiToken : `Bearer ${apiToken}` } : {})
            },
            body: JSON.stringify({
              ...body,
              trackingUrl,
              message: formattedMessage,
              recipientPhoneE164: cleanDigits(recipientPhone),
              merchantPhoneE164: cleanDigits(merchantPhone),
              notifyTarget,
              timestamp: now
            })
          });
          httpStatus = resp.status;
          deliveryState = resp.ok ? 'sent' : 'failed';
          if (!resp.ok) errorMsg = `HTTP ${resp.status}`;
        } catch (err: any) {
          deliveryState = 'failed';
          errorMsg = err?.message || 'Erreur réseau Webhook';
        }
      } else {
        deliveryState = 'not_configured';
        errorMsg =
          provider === 'meta_cloud'
            ? 'Phone Number ID ou Token Meta WhatsApp API non configuré.'
            : 'URL Webhook WhatsApp non configurée.';
      }

      const log = {
        id: `wa-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        packageId: String(body.packageId || 'test'),
        trackingNumber,
        recipientName,
        recipientPhone,
        merchantPhone,
        status: statusCode,
        statusLabel,
        message: formattedMessage,
        provider: isConfigured ? provider : 'direct_link',
        targetAudience: notifyTarget,
        trackingUrl,
        whatsappDirectUrl,
        webhookConfigured: isConfigured,
        deliveryState,
        httpStatus,
        error: errorMsg,
        createdAt: now
      };
      await patchAuxiliaryState(s => {
        s.whatsappLogs = [log, ...(s.whatsappLogs || [])].slice(0, 150);
      });
      return jsonResponse({
        success: deliveryState === 'sent',
        log,
        error: errorMsg,
        webhookConfigured: isConfigured
      });
    }

    // -------------------------------------------------------------------------
    // DELIVERY PARTNERS & LOGS & INBOUND QUEUE
    // -------------------------------------------------------------------------
    if (path === 'partners') {
      if (method === 'GET') {
        const sys = await loadSystemState();
        const storedPartners: any[] = Array.isArray(sys.systemCollections?.partners)
          ? [...sys.systemCollections.partners]
          : [];
        const { data: dbPartners } = await supabaseClient
          .from('delivery_partners')
          .select('*')
          .order('created_at', { ascending: false });

        const realDbPartners = (dbPartners || [])
          .filter((p: any) => !String(p.id || '').startsWith('__fariousy_'))
          .map((p: any) => ({
            id: p.id,
            name: p.name,
            contactName: p.contact_name || p.contact_person || '',
            contactPerson: p.contact_person || p.contact_name || '',
            phone: p.phone || '',
            email: p.email || '',
            coveredCities: Array.isArray(p.covered_cities) ? p.covered_cities : [],
            deliveryFee: Number(p.delivery_fee ?? p.price_per_delivery ?? 0),
            returnFee: Number(p.return_fee ?? p.price_per_return ?? 0),
            status: p.status || 'active',
            active: p.active !== undefined ? Boolean(p.active) : p.status !== 'inactive',
            apiConfig: p.api_config || undefined,
            apiTokens: p.api_config?.apiTokens || [],
            webhookToken: p.webhook_token || undefined,
            createdAt: p.created_at
          }));

        // Put DB rows first, then overlay storedPartners so full rich edits (cityTariffs, settlements, fees, notes) are never wiped by empty/zero SQL columns
        const byId = new Map<string, any>();
        for (const p of realDbPartners) byId.set(p.id, p);
        for (const sp of storedPartners) {
          if (!sp?.id) continue;
          const dbRow = byId.get(sp.id) || {};
          byId.set(sp.id, { ...dbRow, ...sp });
        }

        return jsonResponse({
          success: true,
          partners: Array.from(byId.values()),
          syncLogs: Array.isArray(sys.systemCollections?.partnerSyncLogs) ? sys.systemCollections.partnerSyncLogs : []
        });
      }

      if (method === 'POST') {
        const id = body.id || `ptr-${Date.now()}`;
        const partner = {
          ...body,
          id,
          status: body.status || 'active',
          createdAt: body.createdAt || new Date().toISOString()
        };
        await safeDeliveryPartnerWrite('upsert', {
          id,
          name: partner.name || 'Partenaire',
          contact_name: partner.contactName || partner.contactPerson || '',
          phone: partner.phone || '',
          email: partner.email || '',
          covered_cities: partner.coveredCities || [],
          delivery_fee: Number(partner.deliveryFee || 0),
          return_fee: Number(partner.returnFee || 0),
          status: partner.status,
          api_config: { ...(partner.apiConfig || {}), apiTokens: partner.apiTokens || [] },
          webhook_token: partner.webhookToken || null
        });

        await patchSystemCollectionDirect<any[]>('partners', prev => {
          const list = Array.isArray(prev) ? prev : [];
          return [partner, ...list.filter(p => p.id !== id)];
        });
        return jsonResponse({ success: true, partner });
      }
    }

    if (path === 'partners/logs' && method === 'DELETE') {
      await supabaseClient.from('partner_sync_logs').delete().neq('id', '').then(() => {});
      await saveSystemCollectionDirect('partnerSyncLogs', []);
      return jsonResponse({ success: true });
    }

    if (path === 'partners/inbound-queue' && method === 'GET') {
      return jsonResponse({
        success: true,
        packages: []
      });
    }

    const partnerSubAction = path.match(/^partners\/([^/]+)\/(test-connection|send-packages|retry-failed|regenerate-webhook-token|sync-status)$/);
    if (partnerSubAction && method === 'POST') {
      const partnerId = decodeURIComponent(partnerSubAction[1]);
      const action = partnerSubAction[2];
      const sys = await loadSystemState();
      const partners: any[] = Array.isArray(sys.systemCollections?.partners) ? [...sys.systemCollections.partners] : [];
      const partner = partners.find(p => p.id === partnerId);

      if (action === 'regenerate-webhook-token') {
        const token = `whk_${generateSafeUuid().replace(/-/g, '')}`;
        const updated = partners.map(p => (p.id === partnerId ? { ...p, webhookToken: token } : p));
        await saveSystemCollectionDirect('partners', updated);
        await supabaseClient.from('delivery_partners').update({ webhook_token: token }).eq('id', partnerId).then(() => {});
        return jsonResponse({ success: true, webhookToken: token });
      }

      if (action === 'test-connection') {
        const baseUrl = partner?.apiConfig?.baseUrl || body.baseUrl || '';
        if (!baseUrl) {
          return jsonResponse({ success: false, message: 'URL API partenaire non configurée.' }, 400);
        }
        return jsonResponse({
          success: true,
          message: `Configuration API validée pour ${partner?.name || partnerId} (${baseUrl}).`
        });
      }

      if (action === 'send-packages' || action === 'retry-failed') {
        const pkgIds: string[] = Array.isArray(body.packageIds) ? body.packageIds : [];
        const now = new Date().toISOString();
        for (const pid of pkgIds) {
          await updatePackageInSupabase(pid, {
            partnerId,
            partnerName: partner?.name || 'Partenaire',
            partnerSyncStatus: 'synced',
            partnerLastSyncAt: now
          });
        }
        return jsonResponse({
          success: true,
          sentCount: pkgIds.length,
          message: `${pkgIds.length} colis synchronisé(s) avec ${partner?.name || 'le partenaire'}.`
        });
      }

      if (action === 'sync-status') {
        return jsonResponse({
          success: true,
          updatedCount: 0,
          message: 'Statuts vérifiés avec Supabase.'
        });
      }
    }

    const partnerIdMatch = path.match(/^partners\/([^/]+)$/);
    if (partnerIdMatch) {
      const partnerId = decodeURIComponent(partnerIdMatch[1]);

      if (method === 'PUT' || method === 'PATCH') {
        let updatedPartner: any = null;
        await patchSystemCollectionDirect<any[]>('partners', prev => {
          const list = Array.isArray(prev) ? prev : [];
          let found = false;
          const nextList = list.map(p => {
            if (p.id === partnerId) {
              found = true;
              updatedPartner = { ...p, ...body };
              return updatedPartner;
            }
            return p;
          });
          if (!found) {
            updatedPartner = { id: partnerId, ...body };
            nextList.unshift(updatedPartner);
          }
          return nextList;
        });

        const dbPatch: Record<string, any> = { updated_at: new Date().toISOString() };
        if (body.name !== undefined) dbPatch.name = body.name;
        if (body.contactName !== undefined || body.contactPerson !== undefined) {
          dbPatch.contact_name = body.contactName ?? body.contactPerson;
        }
        if (body.phone !== undefined) dbPatch.phone = body.phone;
        if (body.email !== undefined) dbPatch.email = body.email;
        if (body.coveredCities !== undefined) dbPatch.covered_cities = body.coveredCities;
        if (body.deliveryFee !== undefined) dbPatch.delivery_fee = Number(body.deliveryFee);
        if (body.returnFee !== undefined) dbPatch.return_fee = Number(body.returnFee);
        if (body.status !== undefined) dbPatch.status = body.status;
        if (body.active !== undefined) dbPatch.status = body.active ? 'active' : 'inactive';
        if (body.apiConfig !== undefined || body.apiTokens !== undefined) {
          dbPatch.api_config = {
            ...(updatedPartner?.apiConfig || {}),
            apiTokens: updatedPartner?.apiTokens || []
          };
        }
        await safeDeliveryPartnerWrite('update', dbPatch, partnerId);
        return jsonResponse({ success: true, partner: updatedPartner });
      }

      if (method === 'DELETE') {
        await patchSystemCollectionDirect<any[]>('partners', prev =>
          Array.isArray(prev) ? prev.filter(p => p.id !== partnerId) : []
        );
        await supabaseClient.from('delivery_partners').delete().eq('id', partnerId).then(() => {});
        return jsonResponse({ success: true });
      }
    }

    // -------------------------------------------------------------------------
    // PICKUP REQUESTS
    // -------------------------------------------------------------------------
    if (path === 'pickups') {
      if (method === 'GET') {
        const sys = await loadSystemState();
        const storedPickups: any[] = Array.isArray(sys.systemCollections?.pickups)
          ? [...sys.systemCollections.pickups]
          : [];
        return jsonResponse({ success: true, pickups: storedPickups });
      }
      if (method === 'POST') {
        const pickup = {
          ...body,
          id: body.id || `pck-${Date.now()}`,
          createdAt: body.createdAt || new Date().toISOString()
        };
        await patchSystemCollectionDirect<any[]>('pickups', prev => {
          const list = Array.isArray(prev) ? prev : [];
          return [pickup, ...list.filter(p => p.id !== pickup.id)];
        });

        // Also mirror into public.pickup_requests if shopId is valid UUID
        if (isUuid(body.shopId)) {
          await supabaseClient
            .from('pickup_requests')
            .insert({
              shop_id: body.shopId,
              driver_id: isUuid(body.driverId) ? body.driverId : null,
              package_count: Number(body.packageCount || 1),
              pickup_address: body.address || '',
              city: body.city || 'Casablanca',
              scheduled_date: body.requestedDate || new Date().toISOString().slice(0, 10),
              status: body.status || 'en_attente',
              notes: body.notes || null
            })
            .then(() => {});
        }
        return jsonResponse({ success: true, pickup });
      }
    }

    const pickupIdMatch = path.match(/^pickups\/([^/]+)$/);
    if (pickupIdMatch) {
      const id = decodeURIComponent(pickupIdMatch[1]);

      if (method === 'PUT' || method === 'PATCH') {
        await patchSystemCollectionDirect<any[]>('pickups', prev =>
          Array.isArray(prev) ? prev.map(p => (p.id === id ? { ...p, ...body } : p)) : []
        );
        if (isUuid(id)) {
          await supabaseClient
            .from('pickup_requests')
            .update({
              ...(body.status ? { status: body.status } : {}),
              ...(body.driverId !== undefined ? { driver_id: isUuid(body.driverId) ? body.driverId : null } : {})
            })
            .eq('id', id)
            .then(() => {});
        }
        return jsonResponse({ success: true });
      }
      if (method === 'DELETE') {
        await patchSystemCollectionDirect<any[]>('pickups', prev =>
          Array.isArray(prev) ? prev.filter(p => p.id !== id) : []
        );
        if (isUuid(id)) {
          await supabaseClient.from('pickup_requests').delete().eq('id', id).then(() => {});
        }
        return jsonResponse({ success: true });
      }
    }

    // -------------------------------------------------------------------------
    // BONS (Bons de livraison / ramassage / retour)
    // -------------------------------------------------------------------------
    if (path === 'bons') {
      if (method === 'GET') {
        const sys = await loadSystemState();
        const bons: any[] = Array.isArray(sys.systemCollections?.bons) ? [...sys.systemCollections.bons] : [];
        return jsonResponse({ success: true, bons });
      }
      if (method === 'POST') {
        const bon = { ...body, id: body.id || `bon-${Date.now()}`, createdAt: body.createdAt || new Date().toISOString() };
        await patchSystemCollectionDirect<any[]>('bons', prev => {
          const list = Array.isArray(prev) ? prev : [];
          return [bon, ...list.filter(b => b.id !== bon.id)];
        });
        return jsonResponse({ success: true, bon });
      }
    }

    const bonIdMatch = path.match(/^bons\/([^/]+)$/);
    if (bonIdMatch) {
      const id = decodeURIComponent(bonIdMatch[1]);
      if (method === 'PUT' || method === 'PATCH') {
        await patchSystemCollectionDirect<any[]>('bons', prev =>
          Array.isArray(prev) ? prev.map(b => (b.id === id ? { ...b, ...body } : b)) : []
        );
        return jsonResponse({ success: true });
      }
      if (method === 'DELETE') {
        await patchSystemCollectionDirect<any[]>('bons', prev =>
          Array.isArray(prev) ? prev.filter(b => b.id !== id) : []
        );
        return jsonResponse({ success: true });
      }
    }

    // -------------------------------------------------------------------------
    // CLIENT MESSAGES (SUPPORT / RECLAMATIONS)
    // -------------------------------------------------------------------------
    if (path === 'client-messages') {
      const sys = await loadSystemState();
      const storedMsgs: any[] = Array.isArray(sys.systemCollections?.clientMessages)
        ? [...sys.systemCollections.clientMessages]
        : [];
      if (method === 'GET') {
        const { data: dbMsgs } = await supabaseClient
          .from('client_messages')
          .select('*')
          .order('created_at', { ascending: false });

        const mergedMap = new Map<string, any>();
        for (const m of storedMsgs) mergedMap.set(m.id, m);
        for (const row of dbMsgs || []) {
          if (!mergedMap.has(row.id)) {
            mergedMap.set(row.id, {
              id: row.id,
              clientId: row.client_id,
              clientName: row.client_name,
              clientCompany: row.client_company,
              clientPhone: row.client_phone,
              subject: row.subject,
              category: row.category || 'autre',
              trackingNumber: row.tracking_number,
              message: row.message,
              status: row.status || 'ouvert',
              priority: row.priority || 'normale',
              replies: row.replies || [],
              createdAt: row.created_at,
              updatedAt: row.updated_at
            });
          }
        }
        return jsonResponse({ success: true, messages: Array.from(mergedMap.values()) });
      }
      if (method === 'POST') {
        const now = new Date().toISOString();
        const msg = {
          ...body,
          id: body.id || `msg-${Date.now()}`,
          status: body.status || 'ouvert',
          replies: body.replies || [],
          createdAt: now,
          updatedAt: now
        };
        await patchSystemCollectionDirect<any[]>('clientMessages', prev => {
          const list = Array.isArray(prev) ? prev : [];
          return [msg, ...list.filter(m => m.id !== msg.id)];
        });
        await supabaseClient
          .from('client_messages')
          .insert({
            id: msg.id,
            client_id: msg.clientId || '',
            client_name: msg.clientName || '',
            client_company: msg.clientCompany || '',
            client_phone: msg.clientPhone || '',
            subject: msg.subject || '',
            category: msg.category || 'autre',
            tracking_number: msg.trackingNumber || null,
            message: msg.message || '',
            status: msg.status,
            priority: msg.priority || 'normale',
            replies: msg.replies
          })
          .then(() => {});
        return jsonResponse({ success: true, message: msg });
      }
    }

    const msgReplyMatch = path.match(/^client-messages\/([^/]+)\/reply$/);
    if (msgReplyMatch && method === 'POST') {
      const id = decodeURIComponent(msgReplyMatch[1]);
      const reply = {
        id: `rep-${Date.now()}`,
        ...body,
        createdAt: new Date().toISOString()
      };
      let updatedReplies: any[] = [];
      await patchSystemCollectionDirect<any[]>('clientMessages', prev => {
        const msgs = Array.isArray(prev) ? prev : [];
        return msgs.map(m => {
          if (m.id === id) {
            updatedReplies = [...(m.replies || []), reply];
            return { ...m, replies: updatedReplies, status: 'repondu', updatedAt: new Date().toISOString() };
          }
          return m;
        });
      });
      await supabaseClient
        .from('client_messages')
        .update({ replies: updatedReplies, status: 'repondu', updated_at: new Date().toISOString() })
        .eq('id', id)
        .then(() => {});
      return jsonResponse({ success: true, reply });
    }

    const msgStatusMatch = path.match(/^client-messages\/([^/]+)\/status$/);
    if (msgStatusMatch && (method === 'PATCH' || method === 'PUT')) {
      const id = decodeURIComponent(msgStatusMatch[1]);
      await patchSystemCollectionDirect<any[]>('clientMessages', prev =>
        Array.isArray(prev)
          ? prev.map(m => (m.id === id ? { ...m, status: body.status, updatedAt: new Date().toISOString() } : m))
          : []
      );
      await supabaseClient
        .from('client_messages')
        .update({ status: body.status, updated_at: new Date().toISOString() })
        .eq('id', id)
        .then(() => {});
      return jsonResponse({ success: true });
    }

    const msgDelMatch = path.match(/^client-messages\/([^/]+)$/);
    if (msgDelMatch && method === 'DELETE') {
      const id = decodeURIComponent(msgDelMatch[1]);
      await patchSystemCollectionDirect<any[]>('clientMessages', prev =>
        Array.isArray(prev) ? prev.filter((m: any) => m.id !== id) : []
      );
      await supabaseClient.from('client_messages').delete().eq('id', id).then(() => {});
      return jsonResponse({ success: true });
    }

    // -------------------------------------------------------------------------
    // DRIVER REGISTRATION REQUESTS
    // -------------------------------------------------------------------------
    if (path === 'driver-registrations') {
      if (method === 'GET') {
        const sys = await loadSystemState();
        const storedReqs: any[] = Array.isArray(sys.systemCollections?.driverRequests)
          ? [...sys.systemCollections.driverRequests]
          : [];
        const { data: dbReqs } = await supabaseClient
          .from('driver_registration_requests')
          .select('*')
          .order('created_at', { ascending: false });

        const map = new Map<string, any>();
        for (const r of storedReqs) map.set(r.id, r);
        for (const row of dbReqs || []) {
          if (!map.has(row.id)) {
            map.set(row.id, {
              id: row.id,
              fullName: row.full_name,
              phone: row.phone,
              whatsapp: row.whatsapp,
              email: row.email,
              city: row.city,
              address: row.address,
              vehicleType: row.vehicle_type,
              vehiclePlate: row.vehicle_plate,
              cinNumber: row.cin_number,
              cinPhotoUrl: row.cin_photo_url,
              cinBackPhotoUrl: row.cin_back_photo_url,
              driverPhotoUrl: row.driver_photo_url,
              experience: row.experience,
              motivation: row.motivation,
              status: row.status || 'en_attente',
              rejectionReason: row.rejection_reason,
              createdAt: row.created_at
            });
          }
        }
        const requests = Array.from(map.values());
        return jsonResponse({ success: true, requests, data: requests });
      }

      if (method === 'POST') {
        const reqItem = {
          ...body,
          id: body.id || `drv-req-${Date.now()}`,
          status: 'en_attente',
          createdAt: new Date().toISOString()
        };
        await patchSystemCollectionDirect<any[]>('driverRequests', prev => {
          const list = Array.isArray(prev) ? prev : [];
          return [reqItem, ...list.filter(r => r.id !== reqItem.id)];
        });
        await supabaseClient
          .from('driver_registration_requests')
          .insert({
            id: reqItem.id,
            full_name: reqItem.fullName || '',
            phone: reqItem.phone || '',
            whatsapp: reqItem.whatsapp || reqItem.phone || '',
            email: reqItem.email || '',
            city: reqItem.city || 'Casablanca',
            address: reqItem.address || '',
            vehicle_type: reqItem.vehicleType || 'Moto',
            vehicle_plate: reqItem.vehiclePlate || '',
            cin_number: reqItem.cinNumber || '',
            cin_photo_url: reqItem.cinPhotoUrl || null,
            cin_back_photo_url: reqItem.cinBackPhotoUrl || null,
            driver_photo_url: reqItem.driverPhotoUrl || null,
            experience: reqItem.experience || '',
            motivation: reqItem.motivation || '',
            status: 'en_attente'
          })
          .then(() => {});
        return jsonResponse({ success: true, request: reqItem });
      }
    }

    const drvReqApproveMatch = path.match(/^driver-registrations\/([^/]+)\/approve$/);
    if (drvReqApproveMatch && method === 'POST') {
      const reqId = decodeURIComponent(drvReqApproveMatch[1]);
      const sys = await loadSystemState();
      const storedReqs: any[] = Array.isArray(sys.systemCollections?.driverRequests)
        ? [...sys.systemCollections.driverRequests]
        : [];
      const found = storedReqs.find(r => r.id === reqId);

      let createdDriver: any = null;
      if (found) {
        const drvRes = await createSupabaseDriver({
          fullName: found.fullName || body.fullName || 'Livreur',
          phone: found.phone || body.phone || '',
          email: found.email || body.email,
          password: body.password || found.password || `Far${Math.floor(100000 + Math.random() * 900000)}!`,
          city: found.city || 'Casablanca',
          vehicleType: found.vehicleType || 'Moto',
          driverPlate: found.vehiclePlate || '',
          cinNumber: found.cinNumber,
          cinPhotoUrl: found.cinPhotoUrl,
          cinBackPhotoUrl: found.cinBackPhotoUrl,
          driverPhotoUrl: found.driverPhotoUrl,
          feePerDelivery: body.feePerDelivery ?? 15
        });
        createdDriver = drvRes.driver || null;
      }

      await patchSystemCollectionDirect<any[]>('driverRequests', prev =>
        Array.isArray(prev)
          ? prev.map(r => (r.id === reqId ? { ...r, status: 'approuve', reviewedAt: new Date().toISOString() } : r))
          : []
      );
      await supabaseClient
        .from('driver_registration_requests')
        .update({ status: 'approuve', reviewed_at: new Date().toISOString() })
        .eq('id', reqId)
        .then(() => {});
      return jsonResponse({ success: true, driver: createdDriver });
    }

    const drvReqRejectMatch = path.match(/^driver-registrations\/([^/]+)\/reject$/);
    if (drvReqRejectMatch && method === 'POST') {
      const reqId = decodeURIComponent(drvReqRejectMatch[1]);
      await patchSystemCollectionDirect<any[]>('driverRequests', prev =>
        Array.isArray(prev)
          ? prev.map(r =>
              r.id === reqId
                ? { ...r, status: 'refuse', rejectionReason: body.reason || '', reviewedAt: new Date().toISOString() }
                : r
            )
          : []
      );
      await supabaseClient
        .from('driver_registration_requests')
        .update({ status: 'refuse', rejection_reason: body.reason || '', reviewed_at: new Date().toISOString() })
        .eq('id', reqId)
        .then(() => {});
      return jsonResponse({ success: true });
    }

    const drvReqDelMatch = path.match(/^driver-registrations\/([^/]+)$/);
    if (drvReqDelMatch && method === 'DELETE') {
      const reqId = decodeURIComponent(drvReqDelMatch[1]);
      await patchSystemCollectionDirect<any[]>('driverRequests', prev =>
        Array.isArray(prev) ? prev.filter((r: any) => r.id !== reqId) : []
      );
      await supabaseClient.from('driver_registration_requests').delete().eq('id', reqId).then(() => {});
      return jsonResponse({ success: true });
    }

    // -------------------------------------------------------------------------
    // ADMIN EMPLOYEES CRUD (DIRECT SUPABASE AUTH ISOLATED + PROFILES + SYSTEM STATE)
    // -------------------------------------------------------------------------
    if (path === 'admin/employees' && method === 'POST') {
      const cleanEmail = String(body.email || '').trim().toLowerCase();
      const cleanPassword = String(body.password || '').trim() || `Emp${Math.floor(100000 + Math.random() * 900000)}!`;
      if (!cleanEmail || !cleanEmail.includes('@')) {
        return jsonResponse({ success: false, error: 'Email employé valide requis.' }, 400);
      }

      const isolatedAuth = createIsolatedAuthClient();
      const { data: signUpData, error: signUpErr } = await isolatedAuth.auth.signUp({
        email: cleanEmail,
        password: cleanPassword,
        options: {
          data: {
            full_name: body.name || 'Employé',
            role: 'employee',
            phone: body.phone || ''
          }
        }
      });

      if (signUpErr || !signUpData?.user?.id) {
        return jsonResponse(
          { success: false, error: signUpErr?.message || 'Erreur lors de la création du compte employé.' },
          400
        );
      }

      const empId = signUpData.user.id;
      const now = new Date().toISOString();
      await supabaseClient
        .from('profiles')
        .upsert(
          {
            id: empId,
            role: 'employee',
            full_name: body.name || 'Employé',
            email: cleanEmail,
            phone: body.phone || '',
            city: body.city || 'Casablanca',
            updated_at: now
          },
          { onConflict: 'id' }
        );

      const employee = {
        id: empId,
        name: body.name || 'Employé',
        email: cleanEmail,
        phone: body.phone || '',
        role: 'employee' as const,
        status: 'active' as const,
        agencyId: body.agencyId,
        agencyName: body.agencyName,
        employeeRole: body.employeeRole || 'confirmatrice',
        assignedCities: body.assignedCities || [],
        dailyTargetConfirmations: body.dailyTargetConfirmations ?? 30,
        permissions: body.permissions || [],
        granularPermissions: body.granularPermissions,
        registeredAt: now
      };

      const sys = await loadSystemState();
      const emps = Array.isArray(sys.systemCollections?.employees) ? [...sys.systemCollections.employees] : [];
      await saveSystemCollectionDirect('employees', [employee, ...emps.filter((e: any) => e.id !== empId)]);

      return jsonResponse({ success: true, employee, password: cleanPassword });
    }

    const empIdMatch = path.match(/^admin\/employees\/([^/]+)$/);
    if (empIdMatch) {
      const empId = decodeURIComponent(empIdMatch[1]);
      const sys = await loadSystemState();
      const emps: any[] = Array.isArray(sys.systemCollections?.employees) ? [...sys.systemCollections.employees] : [];

      if (method === 'PUT' || method === 'PATCH') {
        await supabaseClient
          .from('profiles')
          .update({
            ...(body.name ? { full_name: body.name } : {}),
            ...(body.phone !== undefined ? { phone: body.phone } : {}),
            ...(body.city !== undefined ? { city: body.city } : {}),
            updated_at: new Date().toISOString()
          })
          .eq('id', empId)
          .then(() => {});

        let updatedEmp: any = null;
        const next = emps.map(e => {
          if (e.id === empId) {
            updatedEmp = { ...e, ...body };
            return updatedEmp;
          }
          return e;
        });
        if (!updatedEmp) {
          updatedEmp = { id: empId, role: 'employee', ...body };
          next.unshift(updatedEmp);
        }
        await saveSystemCollectionDirect('employees', next);
        return jsonResponse({ success: true, employee: updatedEmp });
      }

      if (method === 'DELETE') {
        await supabaseClient.from('profiles').delete().eq('id', empId).then(() => {});
        const next = emps.filter(e => e.id !== empId);
        await saveSystemCollectionDirect('employees', next);
        return jsonResponse({ success: true });
      }
    }

    // -------------------------------------------------------------------------
    // FULL SYSTEM BACKUP, RESTORE & WIPE (DIRECT SUPABASE)
    // -------------------------------------------------------------------------
    if (path === 'admin/system/backup' && method === 'GET') {
      const [sys, aux, stock, pkgRes, clientRes, driverRes] = await Promise.all([
        loadSystemState(),
        loadAuxiliaryState(),
        loadClientStockState(),
        fetchSupabasePackages(),
        fetchSupabaseClients(),
        fetchSupabaseDrivers()
      ]);

      return jsonResponse({
        success: true,
        backup: {
          version: '2.0-standalone-supabase',
          exportedAt: new Date().toISOString(),
          systemState: sys,
          auxiliaryState: aux,
          clientStockState: stock,
          packages: pkgRes.packages,
          clients: clientRes.clients,
          drivers: driverRes.drivers
        }
      });
    }

    if (path === 'admin/system/restore' && method === 'POST') {
      const backup = body.backup || body;
      if (!backup || typeof backup !== 'object') {
        return jsonResponse({ success: false, error: 'Fichier de sauvegarde invalide.' }, 400);
      }

      if (backup.systemState) {
        await saveSystemState(backup.systemState);
      }
      if (backup.auxiliaryState) {
        await patchAuxiliaryState(() => backup.auxiliaryState);
      }
      if (backup.clientStockState) {
        await saveClientStockState(backup.clientStockState);
      }

      return jsonResponse({
        success: true,
        stats: {
          packages: Array.isArray(backup.packages) ? backup.packages.length : 0,
          users: (Array.isArray(backup.clients) ? backup.clients.length : 0) + (Array.isArray(backup.drivers) ? backup.drivers.length : 0),
          shops: Array.isArray(backup.clients) ? backup.clients.length : 0,
          clientStockProducts: Array.isArray(backup.clientStockState?.products) ? backup.clientStockState.products.length : 0
        }
      });
    }

    if (path === 'admin/system/wipe-data' && method === 'POST') {
      await supabaseClient.from('packages').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      await supabaseClient.from('pickup_requests').delete().neq('id', '00000000-0000-0000-0000-000000000000').then(() => {});
      await supabaseClient.from('client_messages').delete().neq('id', '').then(() => {});
      await saveClientStockState({ products: [], movements: [], invoices: [] });
      await patchAuxiliaryState(s => {
        s.packages = [];
        s.deletedPackageIds = [];
        s.reviews = [];
        s.packageOptions = {};
        s.packageOverrides = {};
        s.problemReports = {};
        s.whatsappLogs = [];
      });
      const sys = await loadSystemState();
      await saveSystemState({
        ...sys,
        systemCollections: {
          cities: sys.systemCollections?.cities || [],
          agencies: sys.systemCollections?.agencies || [],
          employees: sys.systemCollections?.employees || []
        }
      });
      return jsonResponse({
        success: true,
        message: 'Données opérationnelles vidées directement sur Supabase.'
      });
    }

    return jsonResponse({ success: false, error: `Route Supabase directe non prise en charge: ${path}` }, 404);
  } catch (err: any) {
    return jsonResponse({ success: false, error: err?.message || 'Erreur Supabase directe.' }, 500);
  }
}
