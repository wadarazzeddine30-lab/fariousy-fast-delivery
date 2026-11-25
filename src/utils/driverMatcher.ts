import { CityTariff, PackageItem, UserProfile } from '../types';

export type DriverMatchType =
  | 'exact_zone'
  | 'exact_city'
  | 'same_region'
  | 'nearby_city'
  | 'available';

export interface DriverSuggestion {
  driver: UserProfile;
  score: number;
  matchType: DriverMatchType;
  matchLabel: string;
  matchReason: string;
  activeLoadCount: number;
}

function normalizeText(value?: string): string {
  if (!value) return '';
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\u0600-\u06ff\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Moroccan city proximity clusters for smart fallback suggestions
const CITY_PROXIMITY_GROUPS: string[][] = [
  ['casablanca', 'mohammedia', 'bouskoura', 'dar bouazza', 'berrechid', 'settat', 'el jadida', 'tit mellil'],
  ['rabat', 'sale', 'temara', 'skhirat', 'kenitra', 'bouknadel'],
  ['tanger', 'tetouan', 'martil', 'mdiq', 'fnideq', 'asilah', 'larache', 'ksar el kebir'],
  ['marrakech', 'safi', 'essaouira', 'benguerir', 'tamansourt'],
  ['fes', 'meknes', 'sefrou', 'ifrane', 'taza'],
  ['agadir', 'inezgane', 'ait melloul', 'tiznit', 'taroudant'],
  ['oujda', 'berkane', 'nador', 'taourirt'],
  ['laayoune', 'tarfaya', 'boujdour', 'smara', 'dakhla'],
  ['beni mellal', 'khouribga', 'fquih ben salah', 'kasba tadla']
];

// Common stop words in Moroccan addresses to ignore during zone token matching
const STOP_WORDS = new Set([
  'rue', 'avenue', 'av', 'bd', 'boulevard', 'quartier', 'hay', 'lot', 'lotissement',
  'imm', 'immeuble', 'apt', 'appartement', 'etage', 'nr', 'num', 'numero', 'pres',
  'maroc', 'morocco', 'centre', 'ville', 'zone', 'secteur', 'bloc', 'residence',
  'شارع', 'زنقة', 'حي', 'رقم', 'إقامة', 'شقة', 'طابق', 'قرب', 'مدينة', 'المغرب'
]);

function extractZoneTokens(text?: string): string[] {
  const norm = normalizeText(text);
  if (!norm) return [];
  return norm
    .split(' ')
    .filter(token => token.length >= 3 && !STOP_WORDS.has(token) && !/^\d+$/.test(token));
}

function areCitiesNearby(cityA: string, cityB: string): boolean {
  const a = normalizeText(cityA);
  const b = normalizeText(cityB);
  if (!a || !b) return false;
  return CITY_PROXIMITY_GROUPS.some(group =>
    group.some(c => a.includes(c) || c.includes(a)) &&
    group.some(c => b.includes(c) || c.includes(b))
  );
}

/**
 * Ranks available drivers for a given target city & address/zone.
 * Used by both one-click auto-assign and manual driver picker recommendations.
 */
export function suggestDriversForTarget(params: {
  targetCity?: string;
  targetAddress?: string;
  drivers: UserProfile[];
  cities: CityTariff[];
  packages?: PackageItem[];
}): DriverSuggestion[] {
  const { targetCity = '', targetAddress = '', drivers, cities, packages = [] } = params;

  const activeDrivers = drivers.filter(
    d =>
      d.role === 'driver' &&
      d.status !== 'inactive' &&
      d.status !== 'suspendu' &&
      d.accountStatus !== 'suspendu' &&
      d.accountStatus !== 'refuse'
  );

  const pool = activeDrivers.length > 0 ? activeDrivers : drivers.filter(d => d.role === 'driver');
  if (pool.length === 0) return [];

  const normTargetCity = normalizeText(targetCity);
  const targetTokens = extractZoneTokens(targetAddress);

  const targetCityRecord = cities.find(c => normalizeText(c.name) === normTargetCity);
  const targetRegion = normalizeText(targetCityRecord?.region);

  // Count active deliveries per driver for load balancing
  const loadMap = new Map<string, number>();
  packages.forEach(p => {
    if (
      p.driverId &&
      ['en_cours_livraison', 'ramasse', 'en_transit', 'arrive_destination', 'reporte', 'pas_de_reponse'].includes(p.status)
    ) {
      loadMap.set(p.driverId, (loadMap.get(p.driverId) || 0) + 1);
    }
  });

  const ranked: DriverSuggestion[] = pool.map(driver => {
    const normDriverCity = normalizeText(driver.city);
    const driverZoneText = `${driver.address || ''} ${driver.agencyName || ''}`;
    const driverTokens = extractZoneTokens(driverZoneText);
    const activeLoadCount = loadMap.get(driver.id) || 0;

    let score = 0;
    let matchType: DriverMatchType = 'available';
    let matchLabel = 'متاح للتوصيل';
    let matchReason = `سائق متاح (${activeLoadCount} طرد في الجولة)`;

    const cityExact =
      Boolean(normTargetCity && normDriverCity) &&
      (normDriverCity === normTargetCity ||
        normDriverCity.includes(normTargetCity) ||
        normTargetCity.includes(normDriverCity));

    const matchedZoneTokens = targetTokens.filter(t =>
      driverTokens.some(dt => dt === t || dt.includes(t) || t.includes(dt))
    );

    if (cityExact && matchedZoneTokens.length > 0) {
      score = 180 + matchedZoneTokens.length * 15;
      matchType = 'exact_zone';
      matchLabel = 'أقرب سائق (نفس المدينة والحي)';
      matchReason = `تطابق المدينة (${driver.city}) والمنطقة (${matchedZoneTokens.slice(0, 2).join(', ')})`;
    } else if (cityExact) {
      score = 120;
      matchType = 'exact_city';
      matchLabel = 'نفس المدينة';
      matchReason = `متواجد في ${driver.city || targetCity} • ${activeLoadCount} طرد نشط`;
    } else if (matchedZoneTokens.length > 0) {
      score = 95 + matchedZoneTokens.length * 10;
      matchType = 'exact_zone';
      matchLabel = 'تطابق المنطقة / الحي';
      matchReason = `يغطي المنطقة (${matchedZoneTokens.slice(0, 2).join(', ')})`;
    } else {
      const driverCityRecord = cities.find(c => normalizeText(c.name) === normDriverCity);
      const driverRegion = normalizeText(driverCityRecord?.region);

      if (targetRegion && driverRegion && targetRegion === driverRegion) {
        score = 65;
        matchType = 'same_region';
        matchLabel = 'نفس الجهة (قريب)';
        matchReason = `جهة ${targetCityRecord?.region || driver.city} (${driver.city || 'متاح'})`;
      } else if (areCitiesNearby(targetCity, driver.city || '')) {
        score = 50;
        matchType = 'nearby_city';
        matchLabel = 'مدينة مجاورة';
        matchReason = `قريب من ${targetCity} (ينطلق من ${driver.city})`;
      } else {
        score = 10;
        matchType = 'available';
        matchLabel = 'سائق متاح';
        matchReason = `${driver.city || 'شبكة وطنية'} • ${activeLoadCount} طرد نشط`;
      }
    }

    // Balance workload among equally matched drivers
    score -= Math.min(20, activeLoadCount * 2);

    return {
      driver,
      score,
      matchType,
      matchLabel,
      matchReason,
      activeLoadCount
    };
  });

  return ranked.sort((a, b) => b.score - a.score);
}

export function getBestDriverForTarget(params: {
  targetCity?: string;
  targetAddress?: string;
  drivers: UserProfile[];
  cities: CityTariff[];
  packages?: PackageItem[];
}): DriverSuggestion | null {
  const list = suggestDriversForTarget(params);
  return list[0] || null;
}
