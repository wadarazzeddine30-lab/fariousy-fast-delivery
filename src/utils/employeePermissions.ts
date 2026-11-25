import { EmployeeSubRole, UserProfile } from '../types';

export interface EmployeePermissionItem {
  id: string;
  label: string;
  shortLabel: string;
  description?: string;
}

export interface EmployeePermissionGroup {
  key: string;
  title: string;
  items: EmployeePermissionItem[];
}

export const EMPLOYEE_ROLE_LABELS: Record<EmployeeSubRole, string> = {
  support: 'الدعم وخدمة الزبناء (Support)',
  responsable_villes: 'مسؤول المدن (Responsable Villes)',
  confirmatrice: 'مؤكدة طلبيات (Confirmation)',
  agent_hub: 'عامل مستودع / توزيع (Agent Hub)',
  superviseur: 'مشرف فريق (Superviseur)',
  polyvalent: 'متعدد المهام (Polyvalent)'
};

export const EMPLOYEE_ROLE_SHORT_LABELS: Record<EmployeeSubRole, string> = {
  support: 'Support',
  responsable_villes: 'Responsable villes',
  confirmatrice: 'Confirmation',
  agent_hub: 'Agent Hub',
  superviseur: 'Superviseur',
  polyvalent: 'Polyvalent'
};

export const EMPLOYEE_ROLE_BADGES: Record<
  EmployeeSubRole,
  { bg: string; text: string; border: string }
> = {
  support: {
    bg: 'bg-sky-50',
    text: 'text-sky-800',
    border: 'border-sky-200'
  },
  responsable_villes: {
    bg: 'bg-indigo-50',
    text: 'text-indigo-800',
    border: 'border-indigo-200'
  },
  confirmatrice: {
    bg: 'bg-emerald-50',
    text: 'text-emerald-800',
    border: 'border-emerald-200'
  },
  agent_hub: {
    bg: 'bg-amber-50',
    text: 'text-amber-800',
    border: 'border-amber-200'
  },
  superviseur: {
    bg: 'bg-red-50',
    text: 'text-red-800',
    border: 'border-red-200'
  },
  polyvalent: {
    bg: 'bg-slate-100',
    text: 'text-slate-800',
    border: 'border-slate-300'
  }
};

export const EMPLOYEE_TASK_PERMISSION_GROUPS: EmployeePermissionGroup[] = [
  {
    key: 'support_group',
    title: 'خدمة الزبناء والدعم والتأكيد',
    items: [
      {
        id: 'messages',
        label: 'الرسائل ودعم التجار (Messages & Support)',
        shortLabel: 'الرسائل والدعم'
      },
      {
        id: 'confirmation',
        label: 'مركز التأكيد والطلبيات (Confirmation)',
        shortLabel: 'التأكيد'
      },
      {
        id: 'reviews',
        label: 'آراء وتقييمات الزبناء (Avis)',
        shortLabel: 'الآراء'
      },
      {
        id: 'blacklist',
        label: 'اللائحة السوداء للزبناء (Blacklist)',
        shortLabel: 'Blacklist'
      }
    ]
  },
  {
    key: 'ops_group',
    title: 'تسيير العمليات، المدن والموزعين',
    items: [
      {
        id: 'packages_manage',
        label: 'إدارة الطرود وتغيير الحالات (Colis)',
        shortLabel: 'الطرود'
      },
      {
        id: 'drivers',
        label: 'إدارة الموزعين وطلبات السائقين (Livreurs)',
        shortLabel: 'الموزعين'
      },
      {
        id: 'pickups',
        label: 'طلبات الاستلام وتعيين السائق (Ramassages)',
        shortLabel: 'الاستلام'
      },
      {
        id: 'cities_rates',
        label: 'المدن والتعريفات وتواصل المدن (Villes)',
        shortLabel: 'المدن'
      },
      {
        id: 'clients',
        label: 'التجار والموافقات (Clients)',
        shortLabel: 'التجار'
      },
      {
        id: 'partners',
        label: 'الشركاء والإرسال (Partenaires)',
        shortLabel: 'الشركاء'
      },
      {
        id: 'stock',
        label: 'إدارة المخزون (Stock)',
        shortLabel: 'المخزون'
      },
      {
        id: 'bons',
        label: 'البونات وملفات التوصيل (Bons)',
        shortLabel: 'البونات'
      },
      {
        id: 'hubs',
        label: 'الوكالات والمركبات (Hubs & Véhicules)',
        shortLabel: 'الوكالات'
      },
      {
        id: 'scanner',
        label: 'ماسح الرمز الشريطي (Scanner)',
        shortLabel: 'Scanner'
      }
    ]
  },
  {
    key: 'control_group',
    title: 'لوحة القيادة، المالية والإجراءات',
    items: [
      {
        id: 'dashboard',
        label: 'لوحة القيادة والإحصائيات (Dashboard)',
        shortLabel: 'لوحة القيادة'
      },
      {
        id: 'finance',
        label: 'المالية والتحويلات و Les Dettes',
        shortLabel: 'المالية'
      },
      {
        id: 'settings',
        label: 'إعدادات النظام العامة (Paramètres)',
        shortLabel: 'الإعدادات'
      },
      {
        id: 'can_create',
        label: 'إنشاء الطرود والسجلات (+ إنشاء)',
        shortLabel: '+ إنشاء'
      },
      {
        id: 'can_edit',
        label: 'تعديل المعلومات والحالات',
        shortLabel: 'تعديل'
      },
      {
        id: 'can_delete',
        label: 'حذف الطرود والسجلات',
        shortLabel: 'حذف'
      }
    ]
  }
];

export const ALL_EMPLOYEE_PERMISSION_IDS: string[] = EMPLOYEE_TASK_PERMISSION_GROUPS.flatMap(g =>
  g.items.map(i => i.id)
);

export const PERMISSION_SHORT_LABELS: Record<string, string> = EMPLOYEE_TASK_PERMISSION_GROUPS.reduce(
  (acc, group) => {
    for (const item of group.items) {
      acc[item.id] = item.shortLabel;
    }
    return acc;
  },
  {} as Record<string, string>
);

export const DEFAULT_PERMISSIONS_BY_ROLE: Record<EmployeeSubRole, string[]> = {
  support: [
    'dashboard',
    'messages',
    'confirmation',
    'packages_manage',
    'reviews',
    'blacklist',
    'clients',
    'pickups',
    'can_edit'
  ],
  responsable_villes: [
    'dashboard',
    'packages_manage',
    'drivers',
    'pickups',
    'cities_rates',
    'hubs',
    'bons',
    'scanner',
    'messages',
    'can_create',
    'can_edit'
  ],
  confirmatrice: [
    'dashboard',
    'confirmation',
    'packages_manage',
    'messages',
    'blacklist',
    'can_edit'
  ],
  agent_hub: [
    'dashboard',
    'packages_manage',
    'scanner',
    'stock',
    'pickups',
    'bons',
    'can_edit'
  ],
  superviseur: [
    'dashboard',
    'confirmation',
    'packages_manage',
    'messages',
    'drivers',
    'pickups',
    'cities_rates',
    'clients',
    'partners',
    'stock',
    'bons',
    'hubs',
    'scanner',
    'reviews',
    'blacklist',
    'finance',
    'can_create',
    'can_edit'
  ],
  polyvalent: [
    'dashboard',
    'confirmation',
    'packages_manage',
    'messages',
    'drivers',
    'pickups',
    'cities_rates',
    'stock',
    'bons',
    'scanner',
    'blacklist',
    'can_create',
    'can_edit'
  ]
};

export function normalizeCityKey(city?: string | null): string {
  if (!city) return '';
  return String(city)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
}

export function getUserAssignedCities(user?: UserProfile | null): string[] {
  if (!user || !Array.isArray(user.assignedCities)) return [];
  return user.assignedCities
    .map(c => String(c || '').trim())
    .filter(Boolean);
}

export function isCityAllowedForUser(
  user?: UserProfile | null,
  cityName?: string | null
): boolean {
  if (!user) return false;
  if (user.role === 'super_admin' || user.role === 'admin') return true;
  if (user.role !== 'employee') return true;

  const assigned = getUserAssignedCities(user);
  if (assigned.length === 0) return true;

  const target = normalizeCityKey(cityName);
  if (!target) return false;

  return assigned.some(assignedCity => normalizeCityKey(assignedCity) === target);
}

export function getEffectiveEmployeePermissions(user?: UserProfile | null): string[] {
  if (!user) return [];
  if (user.role === 'super_admin' || user.role === 'admin') {
    return ALL_EMPLOYEE_PERMISSION_IDS;
  }
  if (user.role !== 'employee') return [];
  if (Array.isArray(user.permissions) && user.permissions.length > 0) {
    return user.permissions;
  }
  return DEFAULT_PERMISSIONS_BY_ROLE[user.employeeRole || 'confirmatrice'] || DEFAULT_PERMISSIONS_BY_ROLE.confirmatrice;
}

export function hasEmployeePermission(
  user: UserProfile | null | undefined,
  permId: string
): boolean {
  if (!user) return false;
  if (user.role === 'super_admin' || user.role === 'admin') return true;
  if (user.role !== 'employee') return false;
  const effective = getEffectiveEmployeePermissions(user);
  return effective.includes(permId);
}

export function hasAnyEmployeePermission(
  user: UserProfile | null | undefined,
  permIds: string[]
): boolean {
  if (!user) return false;
  if (user.role === 'super_admin' || user.role === 'admin') return true;
  if (user.role !== 'employee') return false;
  return permIds.some(id => hasEmployeePermission(user, id));
}

export const ADMIN_TAB_PERMISSION_MAP: Record<string, string> = {
  admin_dashboard: 'dashboard',
  admin_confirmation: 'confirmation',
  admin_packages: 'packages_manage',
  admin_pickups: 'pickups',
  admin_clients: 'clients',
  admin_approvals: 'clients',
  admin_reviews: 'reviews',
  admin_drivers: 'drivers',
  admin_driver_approvals: 'drivers',
  admin_partners: 'partners',
  admin_partner_dispatch: 'partners',
  admin_api_partners: 'partners',
  admin_vehicles: 'hubs',
  admin_vehicle_add: 'hubs',
  admin_finance: 'finance',
  admin_debts: 'finance',
  admin_stock: 'stock',
  admin_bons: 'bons',
  admin_employees: '__admin_only__',
  admin_blacklist: 'blacklist',
  admin_settings: 'settings',
  admin_cities: 'cities_rates',
  admin_hubs: 'hubs',
  admin_messages: 'messages'
};

export function isTabAllowedForUser(
  user: UserProfile | null | undefined,
  tab: string
): boolean {
  if (!user) return false;
  if (user.role === 'super_admin' || user.role === 'admin') return true;
  if (user.role !== 'employee') return true;
  const requiredPerm = ADMIN_TAB_PERMISSION_MAP[tab];
  if (!requiredPerm) return true;
  if (requiredPerm === '__admin_only__') return false;
  return hasEmployeePermission(user, requiredPerm);
}

const ORDERED_ADMIN_FALLBACK_TABS: string[] = [
  'admin_dashboard',
  'admin_messages',
  'admin_confirmation',
  'admin_packages',
  'admin_pickups',
  'admin_drivers',
  'admin_cities',
  'admin_clients',
  'admin_stock',
  'admin_bons',
  'admin_partners',
  'admin_hubs',
  'admin_reviews',
  'admin_blacklist',
  'admin_finance',
  'admin_settings'
];

export function getFirstAllowedAdminTab(user: UserProfile | null | undefined): string {
  if (!user || user.role === 'admin' || user.role === 'super_admin') {
    return 'admin_dashboard';
  }
  for (const tab of ORDERED_ADMIN_FALLBACK_TABS) {
    if (isTabAllowedForUser(user, tab)) {
      return tab;
    }
  }
  return 'admin_packages';
}
