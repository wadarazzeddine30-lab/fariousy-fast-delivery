import { CityTariff } from '../types';

export interface MoroccoRegionDef {
  id: string;
  name: string;
  shortName: string;
  path: string;
  labelX: number;
  labelY: number;
}

/**
 * 12 régions officielles du Royaume du Maroc (géométrie vectorielle SVG interactive)
 * viewBox: "0 0 340 360"
 */
export const MOROCCO_REGIONS: MoroccoRegionDef[] = [
  {
    id: 'tanger-tetouan-al-hoceima',
    name: 'Tanger-Tétouan-Al Hoceïma',
    shortName: 'Tanger - Nord',
    path: 'M 208 26 L 222 18 L 236 22 L 254 34 L 266 42 L 256 58 L 232 62 L 210 56 L 202 42 Z',
    labelX: 232,
    labelY: 42
  },
  {
    id: 'oriental',
    name: 'L’Oriental',
    shortName: 'Oriental',
    path: 'M 266 42 L 296 42 L 314 54 L 318 82 L 316 116 L 304 140 L 284 144 L 274 118 L 266 88 L 256 58 Z',
    labelX: 292,
    labelY: 92
  },
  {
    id: 'fes-meknes',
    name: 'Fès-Meknès',
    shortName: 'Fès - Meknès',
    path: 'M 210 56 L 232 62 L 256 58 L 266 88 L 274 118 L 252 132 L 228 122 L 214 96 Z',
    labelX: 244,
    labelY: 94
  },
  {
    id: 'rabat-sale-kenitra',
    name: 'Rabat-Salé-Kénitra',
    shortName: 'Rabat - Kénitra',
    path: 'M 184 74 L 202 42 L 210 56 L 214 96 L 194 106 L 176 96 Z',
    labelX: 196,
    labelY: 82
  },
  {
    id: 'casablanca-settat',
    name: 'Casablanca-Settat',
    shortName: 'Casablanca - Settat',
    path: 'M 142 124 L 164 102 L 176 96 L 194 106 L 196 132 L 172 146 L 146 140 Z',
    labelX: 170,
    labelY: 122
  },
  {
    id: 'beni-mellal-khenifra',
    name: 'Béni Mellal-Khénifra',
    shortName: 'Béni Mellal',
    path: 'M 194 106 L 214 96 L 228 122 L 224 150 L 196 154 L 182 142 L 196 132 Z',
    labelX: 208,
    labelY: 130
  },
  {
    id: 'draa-tafilalet',
    name: 'Drâa-Tafilalet',
    shortName: 'Drâa - Tafilalet',
    path: 'M 228 122 L 252 132 L 274 118 L 284 144 L 272 174 L 238 192 L 206 196 L 196 172 L 196 154 L 224 150 Z',
    labelX: 242,
    labelY: 162
  },
  {
    id: 'marrakech-safi',
    name: 'Marrakech-Safi',
    shortName: 'Marrakech - Safi',
    path: 'M 128 158 L 142 124 L 146 140 L 172 146 L 182 142 L 196 154 L 196 172 L 164 184 L 130 178 Z',
    labelX: 162,
    labelY: 162
  },
  {
    id: 'souss-massa',
    name: 'Souss-Massa',
    shortName: 'Souss - Massa',
    path: 'M 124 196 L 130 178 L 164 184 L 196 172 L 206 196 L 186 218 L 146 218 L 122 212 Z',
    labelX: 164,
    labelY: 200
  },
  {
    id: 'guelmim-oued-noun',
    name: 'Guelmim-Oued Noun',
    shortName: 'Guelmim - Noun',
    path: 'M 102 224 L 122 212 L 146 218 L 186 218 L 178 242 L 132 248 L 96 242 Z',
    labelX: 138,
    labelY: 232
  },
  {
    id: 'laayoune-sakia-el-hamra',
    name: 'Laâyoune-Sakia El Hamra',
    shortName: 'Laâyoune - Sakia',
    path: 'M 64 268 L 96 242 L 132 248 L 154 246 L 144 276 L 106 288 L 62 288 Z',
    labelX: 108,
    labelY: 268
  },
  {
    id: 'dakhla-oued-ed-dahab',
    name: 'Dakhla-Oued Ed-Dahab',
    shortName: 'Dakhla - Oued Eddahab',
    path: 'M 38 314 L 62 288 L 106 288 L 110 314 L 74 344 L 30 350 L 24 334 Z',
    labelX: 72,
    labelY: 318
  }
];

function normalizeCityKey(value: string): string {
  return String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/['’`-]/g, ' ')
    .replace(/\s+/g, ' ');
}

const CITY_TO_REGION_MAP: Record<string, string> = {
  // 1. Tanger-Tétouan-Al Hoceïma
  tanger: 'tanger-tetouan-al-hoceima',
  tangier: 'tanger-tetouan-al-hoceima',
  tetouan: 'tanger-tetouan-al-hoceima',
  chefchaouen: 'tanger-tetouan-al-hoceima',
  larache: 'tanger-tetouan-al-hoceima',
  'el hoceima': 'tanger-tetouan-al-hoceima',
  'al hoceima': 'tanger-tetouan-al-hoceima',
  hoceima: 'tanger-tetouan-al-hoceima',
  fnideq: 'tanger-tetouan-al-hoceima',
  mdiq: 'tanger-tetouan-al-hoceima',
  'm diq': 'tanger-tetouan-al-hoceima',
  'ksar el kebir': 'tanger-tetouan-al-hoceima',
  'ksar sghir': 'tanger-tetouan-al-hoceima',
  ouazzane: 'tanger-tetouan-al-hoceima',
  asilah: 'tanger-tetouan-al-hoceima',
  martil: 'tanger-tetouan-al-hoceima',

  // 2. L'Oriental
  oujda: 'oriental',
  nador: 'oriental',
  berkane: 'oriental',
  guercif: 'oriental',
  figuig: 'oriental',
  saidia: 'oriental',
  taourirt: 'oriental',
  jerada: 'oriental',
  driouch: 'oriental',
  midar: 'oriental',
  'zaio': 'oriental',

  // 3. Fès-Meknès
  fes: 'fes-meknes',
  meknes: 'fes-meknes',
  ifrane: 'fes-meknes',
  'el hajeb': 'fes-meknes',
  sefrou: 'fes-meknes',
  taza: 'fes-meknes',
  taounate: 'fes-meknes',
  missour: 'fes-meknes',
  azrou: 'fes-meknes',
  boulemane: 'fes-meknes',

  // 4. Rabat-Salé-Kénitra
  rabat: 'rabat-sale-kenitra',
  sale: 'rabat-sale-kenitra',
  temara: 'rabat-sale-kenitra',
  kenitra: 'rabat-sale-kenitra',
  skhirat: 'rabat-sale-kenitra',
  khemisset: 'rabat-sale-kenitra',
  'sidi kacem': 'rabat-sale-kenitra',
  'sidi slimane': 'rabat-sale-kenitra',
  'sidi yahya el gharb': 'rabat-sale-kenitra',
  tiflet: 'rabat-sale-kenitra',

  // 5. Casablanca-Settat
  casablanca: 'casablanca-settat',
  casa: 'casablanca-settat',
  mohammedia: 'casablanca-settat',
  'el jadida': 'casablanca-settat',
  settat: 'casablanca-settat',
  berrechid: 'casablanca-settat',
  benslimane: 'casablanca-settat',
  bouznika: 'casablanca-settat',
  azemmour: 'casablanca-settat',
  oualidia: 'casablanca-settat',
  'dar bouazza': 'casablanca-settat',
  bouskoura: 'casablanca-settat',

  // 6. Béni Mellal-Khénifra
  'beni mellal': 'beni-mellal-khenifra',
  azilal: 'beni-mellal-khenifra',
  demnate: 'beni-mellal-khenifra',
  'fkih ben saleh': 'beni-mellal-khenifra',
  khenifra: 'beni-mellal-khenifra',
  'kasba tadla': 'beni-mellal-khenifra',
  mrirt: 'beni-mellal-khenifra',
  boumia: 'beni-mellal-khenifra',
  khouribga: 'beni-mellal-khenifra',
  'oued zem': 'beni-mellal-khenifra',

  // 7. Drâa-Tafilalet
  errachidia: 'draa-tafilalet',
  ouarzazate: 'draa-tafilalet',
  zagora: 'draa-tafilalet',
  tinghir: 'draa-tafilalet',
  midelt: 'draa-tafilalet',
  arfoud: 'draa-tafilalet',
  erfoud: 'draa-tafilalet',
  rissani: 'draa-tafilalet',
  rich: 'draa-tafilalet',
  'boumalne dades': 'draa-tafilalet',
  'kelaat m gouna': 'draa-tafilalet',
  'm hamid el ghizlane': 'draa-tafilalet',
  merzouga: 'draa-tafilalet',
  skoura: 'draa-tafilalet',
  tinjdad: 'draa-tafilalet',
  agdez: 'draa-tafilalet',
  timahdite: 'draa-tafilalet',
  zaida: 'draa-tafilalet',

  // 8. Marrakech-Safi
  marrakech: 'marrakech-safi',
  marrakesh: 'marrakech-safi',
  safi: 'marrakech-safi',
  essaouira: 'marrakech-safi',
  'ben guerir': 'marrakech-safi',
  chichaoua: 'marrakech-safi',
  'ait ourir': 'marrakech-safi',
  'kelaat sraghna': 'marrakech-safi',
  'el kelaa des sraghna': 'marrakech-safi',
  youssoufia: 'marrakech-safi',

  // 9. Souss-Massa
  agadir: 'souss-massa',
  inezgane: 'souss-massa',
  'ait melloul': 'souss-massa',
  tiznit: 'souss-massa',
  taroudant: 'souss-massa',
  taliouine: 'souss-massa',
  belfaa: 'souss-massa',
  tazenakht: 'souss-massa',
  tata: 'souss-massa',
  biougra: 'souss-massa',

  // 10. Guelmim-Oued Noun
  guelmim: 'guelmim-oued-noun',
  'tan tan': 'guelmim-oued-noun',
  tantan: 'guelmim-oued-noun',
  assa: 'guelmim-oued-noun',
  'sidi ifni': 'guelmim-oued-noun',

  // 11. Laâyoune-Sakia El Hamra
  laayoune: 'laayoune-sakia-el-hamra',
  layoune: 'laayoune-sakia-el-hamra',
  boujdour: 'laayoune-sakia-el-hamra',
  'es semara': 'laayoune-sakia-el-hamra',
  smara: 'laayoune-sakia-el-hamra',
  tarfaya: 'laayoune-sakia-el-hamra',
  'el marsa': 'laayoune-sakia-el-hamra',
  akhfennir: 'laayoune-sakia-el-hamra',

  // 12. Dakhla-Oued Ed-Dahab
  dakhla: 'dakhla-oued-ed-dahab',
  'bir gandouz': 'dakhla-oued-ed-dahab',
  guerguerat: 'dakhla-oued-ed-dahab'
};

export function getRegionIdForCity(cityName: string, cityCatalog?: CityTariff[]): string | null {
  const key = normalizeCityKey(cityName);
  if (!key) return null;

  if (CITY_TO_REGION_MAP[key]) {
    return CITY_TO_REGION_MAP[key];
  }

  for (const [knownCity, regId] of Object.entries(CITY_TO_REGION_MAP)) {
    if (key.includes(knownCity) || knownCity.includes(key)) {
      return regId;
    }
  }

  if (cityCatalog && cityCatalog.length > 0) {
    const matched = cityCatalog.find(c => normalizeCityKey(c.name) === key);
    if (matched?.region) {
      const reg = normalizeCityKey(matched.region);
      if (reg.includes('casablanca') || reg.includes('doukkala')) return 'casablanca-settat';
      if (reg.includes('rabat')) return 'rabat-sale-kenitra';
      if (reg.includes('marrakech')) return 'marrakech-safi';
      if (reg.includes('tanger') || reg.includes('nord')) return 'tanger-tetouan-al-hoceima';
      if (reg.includes('fes') || reg.includes('meknes')) return 'fes-meknes';
      if (reg.includes('souss')) return 'souss-massa';
      if (reg.includes('oriental')) return 'oriental';
      if (reg.includes('beni mellal')) return 'beni-mellal-khenifra';
      if (reg.includes('tafilalt') || reg.includes('sud est')) return 'draa-tafilalet';
      if (reg.includes('dakhla')) return 'dakhla-oued-ed-dahab';
      if (reg.includes('guelmim')) return 'guelmim-oued-noun';
      if (reg.includes('laayoune') || reg.includes('sud')) return 'laayoune-sakia-el-hamra';
    }
  }

  return null;
}
