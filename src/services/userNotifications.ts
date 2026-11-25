import { NotificationAudienceScope, UserNotificationMessage, UserRole } from '../types';
import {
  getAuthenticatedActor,
  isStaffRole,
  loadUserNotificationsState,
  saveUserNotificationsState,
  fetchSupabaseClients,
  fetchSupabaseDrivers,
  loadSystemState,
  supabaseRealtime
} from './supabase';
import { buildLiveTrackingUrl, getRichStatusMeta } from '../utils/trackingNotifications';

export interface NotificationRecipientOption {
  id: string;
  name: string;
  companyName?: string;
  email?: string;
  city?: string;
  phone?: string;
}

export interface NotificationRecipientsPayload {
  clients: NotificationRecipientOption[];
  drivers: NotificationRecipientOption[];
  employees: NotificationRecipientOption[];
}

export interface FetchUserNotificationsResponse {
  success: boolean;
  notifications: UserNotificationMessage[];
  unreadCount: number;
  sentNotifications?: UserNotificationMessage[];
  recipients?: NotificationRecipientsPayload;
  error?: string;
}

export interface SendUserNotificationPayload {
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'alert';
  targetScope: NotificationAudienceScope;
  targetRole?: UserRole;
  targetUserId?: string;
  targetUserEmail?: string;
  targetUserName?: string;
}

function getReadIds(notif: any): string[] {
  if (Array.isArray(notif.readByUserIds)) return notif.readByUserIds;
  if (Array.isArray(notif.readBy)) return notif.readBy;
  return [];
}

function getDeletedIds(notif: any): string[] {
  if (Array.isArray(notif.deletedByUserIds)) return notif.deletedByUserIds;
  if (Array.isArray(notif.dismissedBy)) return notif.dismissedBy;
  return [];
}

function matchesAudience(
  notif: any,
  actor: { id: string; email: string; role: string }
): boolean {
  const deletedBy = getDeletedIds(notif);
  if (deletedBy.includes(actor.id)) return false;

  const scope = String(notif.targetScope || '').toLowerCase();
  if (scope === 'all') return true;
  if (scope === 'clients' || scope === 'all_clients') return actor.role === 'client';
  if (scope === 'drivers' || scope === 'all_drivers') return actor.role === 'driver';
  if (scope === 'employees' || scope === 'all_employees') return actor.role === 'employee';
  if (scope === 'role') return String(notif.targetRole || '').toLowerCase() === actor.role;
  if (scope === 'user') {
    const actorIds = [actor.id, (actor as any).shopId].filter(Boolean);
    return (
      (Boolean(notif.targetUserId) && actorIds.includes(notif.targetUserId)) ||
      (Boolean(notif.targetUserEmail) &&
        String(notif.targetUserEmail).toLowerCase() === actor.email.toLowerCase())
    );
  }
  return false;
}

export async function fetchUserNotifications(): Promise<FetchUserNotificationsResponse> {
  try {
    const actor = await getAuthenticatedActor();
    if (!actor) {
      return { success: true, notifications: [], unreadCount: 0 };
    }

    const state = await loadUserNotificationsState();
    const all: any[] = Array.isArray(state.userNotifications) ? state.userNotifications : [];

    const visible: UserNotificationMessage[] = all
      .filter(n => matchesAudience(n, actor))
      .map(n => {
        const readByUserIds = getReadIds(n);
        const deletedByUserIds = getDeletedIds(n);
        const isRead = readByUserIds.includes(actor.id);
        return {
          ...n,
          readByUserIds,
          deletedByUserIds,
          isRead,
          readCount: readByUserIds.length
        };
      });

    const unreadCount = visible.filter(n => !n.isRead).length;

    let recipients: NotificationRecipientsPayload | undefined;
    let sentNotifications: UserNotificationMessage[] | undefined;

    if (isStaffRole(actor.role)) {
      sentNotifications = all.map(n => {
        const readByUserIds = getReadIds(n);
        const deletedByUserIds = getDeletedIds(n);
        return {
          ...n,
          readByUserIds,
          deletedByUserIds,
          isRead: readByUserIds.includes(actor.id),
          readCount: readByUserIds.length
        };
      });
      const [clientsRes, driversRes, sys] = await Promise.all([
        fetchSupabaseClients(),
        fetchSupabaseDrivers(),
        loadSystemState()
      ]);
      const employeesRaw: any[] = Array.isArray(sys.systemCollections?.employees)
        ? sys.systemCollections.employees
        : [];
      recipients = {
        clients: (clientsRes.clients || []).map(c => ({
          id: c.id,
          name: c.name,
          companyName: c.companyName,
          email: c.email,
          city: c.city,
          phone: c.phone
        })),
        drivers: (driversRes.drivers || []).map(d => ({
          id: d.id,
          name: d.name,
          email: d.email,
          city: d.city,
          phone: d.phone
        })),
        employees: employeesRaw.map(e => ({
          id: e.id,
          name: e.name,
          email: e.email,
          city: e.city,
          phone: e.phone
        }))
      };
    }

    return {
      success: true,
      notifications: visible,
      unreadCount,
      sentNotifications,
      recipients
    };
  } catch (err: any) {
    return {
      success: false,
      notifications: [],
      unreadCount: 0,
      error: err?.message || 'Erreur lors du chargement des notifications.'
    };
  }
}

export async function sendAdminNotification(
  payload: SendUserNotificationPayload
): Promise<{ success: boolean; notification?: UserNotificationMessage; error?: string }> {
  try {
    const actor = await getAuthenticatedActor();
    if (!actor || !isStaffRole(actor.role)) {
      return { success: false, error: 'Autorisation administrateur requise.' };
    }

    const state = await loadUserNotificationsState();
    const notification: UserNotificationMessage = {
      id: `unotif-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      title: payload.title.trim(),
      message: payload.message.trim(),
      type: payload.type || 'info',
      targetScope: payload.targetScope,
      targetRole: payload.targetRole,
      targetUserId: payload.targetUserId,
      targetUserEmail: payload.targetUserEmail,
      targetUserName: payload.targetUserName,
      senderId: actor.id,
      senderName: actor.name,
      senderRole: (actor.role as UserRole) || 'admin',
      readByUserIds: [],
      deletedByUserIds: [],
      isRead: false,
      readCount: 0,
      createdAt: new Date().toISOString()
    };

    const next = [notification, ...(state.userNotifications || [])].slice(0, 300);
    await saveUserNotificationsState(next);
    supabaseRealtime.broadcastUserNotification({
      notificationId: notification.id,
      targetScope: notification.targetScope,
      targetUserId: notification.targetUserId,
      targetUserEmail: notification.targetUserEmail,
      title: notification.title,
      message: notification.message,
      createdAt: notification.createdAt
    });
    return { success: true, notification };
  } catch (err: any) {
    return { success: false, error: err?.message || "Erreur lors de l'envoi." };
  }
}

export async function createAutoStatusNotification(params: {
  clientId?: string;
  clientEmail?: string;
  clientName?: string;
  trackingNumber: string;
  recipientName: string;
  city: string;
  codAmount: number;
  newStatus: string;
  statusLabel?: string;
  updatedBy?: string;
  comment?: string;
}): Promise<{ success: boolean; notification?: UserNotificationMessage }> {
  try {
    if (!params.clientId && !params.clientEmail) {
      return { success: false };
    }
    const meta = getRichStatusMeta(params.newStatus, params.statusLabel);
    const trackingUrl = buildLiveTrackingUrl(params.trackingNumber);
    const title = `${meta.emoji} ${params.trackingNumber} — ${meta.fr} (${meta.ar})`;
    const commentSuffix = params.comment ? ` · ${params.comment}` : '';
    const message = `الزبون: ${params.recipientName} (${params.city}) · COD: ${params.codAmount} DH${commentSuffix} · رابط التتبع المباشر: ${trackingUrl}`;

    const state = await loadUserNotificationsState();
    const notification: UserNotificationMessage = {
      id: `autonotif-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      title,
      message,
      type: meta.notifType,
      targetScope: 'user',
      targetRole: 'client',
      targetUserId: params.clientId,
      targetUserEmail: params.clientEmail,
      targetUserName: params.clientName,
      senderId: 'system-realtime',
      senderName: params.updatedBy || 'FARIOUSY Suivi Direct',
      senderRole: 'admin',
      readByUserIds: [],
      deletedByUserIds: [],
      isRead: false,
      readCount: 0,
      createdAt: new Date().toISOString()
    };

    const next = [notification, ...(state.userNotifications || [])].slice(0, 300);
    await saveUserNotificationsState(next);
    supabaseRealtime.broadcastUserNotification({
      notificationId: notification.id,
      targetScope: 'user',
      targetUserId: params.clientId,
      targetUserEmail: params.clientEmail,
      title: notification.title,
      message: notification.message,
      createdAt: notification.createdAt
    });
    return { success: true, notification };
  } catch {
    return { success: false };
  }
}

export async function markUserNotificationRead(
  notificationId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const actor = await getAuthenticatedActor();
    if (!actor) return { success: false, error: 'Non authentifié.' };

    const state = await loadUserNotificationsState();
    const next = (state.userNotifications || []).map((n: any) => {
      if (n.id !== notificationId) return n;
      const readByUserIds = [...getReadIds(n)];
      if (!readByUserIds.includes(actor.id)) readByUserIds.push(actor.id);
      return { ...n, readByUserIds };
    });
    await saveUserNotificationsState(next);
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message };
  }
}

export async function markAllUserNotificationsRead(): Promise<{
  success: boolean;
  markedCount?: number;
  error?: string;
}> {
  try {
    const actor = await getAuthenticatedActor();
    if (!actor) return { success: false, error: 'Non authentifié.' };

    const state = await loadUserNotificationsState();
    let markedCount = 0;
    const next = (state.userNotifications || []).map((n: any) => {
      if (!matchesAudience(n, actor)) return n;
      const readByUserIds = [...getReadIds(n)];
      if (!readByUserIds.includes(actor.id)) {
        readByUserIds.push(actor.id);
        markedCount++;
      }
      return { ...n, readByUserIds };
    });
    await saveUserNotificationsState(next);
    return { success: true, markedCount };
  } catch (err: any) {
    return { success: false, error: err?.message };
  }
}

export async function deleteUserNotification(
  notificationId: string,
  options?: { global?: boolean }
): Promise<{ success: boolean; error?: string }> {
  try {
    const actor = await getAuthenticatedActor();
    if (!actor) return { success: false, error: 'Non authentifié.' };

    const state = await loadUserNotificationsState();
    let next: any[];
    if (options?.global && isStaffRole(actor.role)) {
      next = (state.userNotifications || []).filter((n: any) => n.id !== notificationId);
    } else {
      next = (state.userNotifications || []).map((n: any) => {
        if (n.id !== notificationId) return n;
        const deletedByUserIds = [...getDeletedIds(n)];
        if (!deletedByUserIds.includes(actor.id)) deletedByUserIds.push(actor.id);
        return { ...n, deletedByUserIds };
      });
    }
    await saveUserNotificationsState(next);
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message };
  }
}

export async function clearReadUserNotifications(): Promise<{
  success: boolean;
  removedCount?: number;
  error?: string;
}> {
  try {
    const actor = await getAuthenticatedActor();
    if (!actor) return { success: false, error: 'Non authentifié.' };

    const state = await loadUserNotificationsState();
    let removedCount = 0;
    const next = (state.userNotifications || []).map((n: any) => {
      const readByUserIds = getReadIds(n);
      if (readByUserIds.includes(actor.id)) {
        const deletedByUserIds = [...getDeletedIds(n)];
        if (!deletedByUserIds.includes(actor.id)) {
          deletedByUserIds.push(actor.id);
          removedCount++;
        }
        return { ...n, deletedByUserIds };
      }
      return n;
    });
    await saveUserNotificationsState(next);
    return { success: true, removedCount };
  } catch (err: any) {
    return { success: false, error: err?.message };
  }
}
