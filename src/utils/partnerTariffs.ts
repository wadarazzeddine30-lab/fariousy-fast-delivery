import { PackageItem, Partner } from '../types';

export function normalizeCityKey(city?: string | null): string {
  if (!city) return '';
  return String(city)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[-_']/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function findPartnerCityTariffEntry(
  partner: Pick<Partner, 'cityTariffs'> | undefined | null,
  cityName?: string | null
): { key: string; fee: number } | null {
  const tariffs = partner?.cityTariffs;
  if (!tariffs || typeof tariffs !== 'object') return null;

  const targetNorm = normalizeCityKey(cityName);
  if (!targetNorm) return null;

  for (const [k, v] of Object.entries(tariffs)) {
    if (v === undefined || v === null || Number.isNaN(Number(v))) continue;
    if (normalizeCityKey(k) === targetNorm) {
      return { key: k, fee: Number(v) };
    }
  }
  return null;
}

export function isCityCoveredByPartner(
  partner: Pick<Partner, 'cityTariffs'> | undefined | null,
  cityName?: string | null
): boolean {
  const tariffs = partner?.cityTariffs;
  if (!tariffs || typeof tariffs !== 'object' || Object.keys(tariffs).length === 0) {
    return true;
  }
  return findPartnerCityTariffEntry(partner, cityName) !== null;
}

export function getPartnerCityFee(
  partner: Pick<Partner, 'deliveryFee' | 'cityTariffs'> | undefined | null,
  cityName?: string | null,
  fallbackPackageFee?: number | null
): number {
  const cityMatch = findPartnerCityTariffEntry(partner, cityName);
  if (cityMatch !== null) {
    return cityMatch.fee;
  }
  if (fallbackPackageFee !== undefined && fallbackPackageFee !== null && !Number.isNaN(Number(fallbackPackageFee))) {
    return Number(fallbackPackageFee);
  }
  if (partner?.deliveryFee !== undefined && partner?.deliveryFee !== null && !Number.isNaN(Number(partner.deliveryFee))) {
    return Number(partner.deliveryFee);
  }
  return 30;
}

export function getPartnerFeeForPackage(
  partner: Pick<Partner, 'deliveryFee' | 'cityTariffs'> | undefined | null,
  pkg: Pick<PackageItem, 'city' | 'partnerDeliveryFee' | 'deliveredBy'>
): number {
  if (pkg.deliveredBy === 'admin') {
    return 0;
  }
  if (
    pkg.partnerDeliveryFee !== undefined &&
    pkg.partnerDeliveryFee !== null &&
    !Number.isNaN(Number(pkg.partnerDeliveryFee))
  ) {
    return Number(pkg.partnerDeliveryFee);
  }
  return getPartnerCityFee(partner, pkg.city, pkg.partnerDeliveryFee);
}

export function resolvePackagePartner(
  pkg: Pick<PackageItem, 'partnerId' | 'partnerName' | 'destinationAgency'>,
  partners: Partner[]
): Partner | undefined {
  if (!partners || partners.length === 0) return undefined;
  if (pkg.partnerId) {
    const byId = partners.find(p => p.id === pkg.partnerId);
    if (byId) return byId;
  }
  if (pkg.partnerName) {
    const target = pkg.partnerName.trim().toLowerCase();
    const byName = partners.find(p => (p.name || '').trim().toLowerCase() === target);
    if (byName) return byName;
  }
  if (pkg.destinationAgency) {
    const ag = pkg.destinationAgency.trim().toLowerCase();
    const byAgency = partners.find(p => {
      const pname = (p.name || '').trim().toLowerCase();
      const pcity = (p.city || '').trim().toLowerCase();
      return (
        ag === pname ||
        ag === `partenaire: ${pname}` ||
        (pcity && ag === `agence ${pcity}`)
      );
    });
    if (byAgency) return byAgency;
  }
  return undefined;
}

export function isPackageAssignedToPartner(
  pkg: Pick<PackageItem, 'isTransferredToPartner' | 'partnerId' | 'partnerName' | 'destinationAgency'>,
  partners: Partner[]
): boolean {
  if (pkg.isTransferredToPartner || pkg.partnerId || pkg.partnerName) {
    return true;
  }
  return Boolean(resolvePackagePartner(pkg, partners));
}
