import QRCode from 'qrcode';
import { jsPDF } from 'jspdf';
import { PackageItem } from '../types';

export interface TicketRenderOptions {
  vendeurName?: string;
  vendeurPhone?: string;
  vendeurAddress?: string;
  productName?: string;
  quantity?: string;
  comment?: string;
  codAmount?: number;
  agencyAddress?: string;
  canOpen?: boolean;
  allowTry?: boolean;
  isFragile?: boolean;
}

/**
 * Moroccan Region mapper based on Moroccan distribution hubs
 */
export function getMoroccanRegion(city: string = ''): string {
  const norm = city.trim().toLowerCase();
  if (!norm) return 'casablanca';
  if (/agadir|inezgane|dcheira|dchaira|taroudant|tiznit|ait melloul|ouled teima|biougra/i.test(norm)) return 'Souss Massa';
  if (/la[aâ]youne|boujdour|tarfaya|semara|es-semara|smara/i.test(norm)) return 'Laâyoune-Sakia El Hamra';
  if (/casablanca|casa|mohammedia|dar bouazza|bouskoura|nouaceur|m[eé]diouna/i.test(norm)) return 'casablanca';
  if (/rabat|sal[eé]|k[eé]nitra|skhirat|t[eé]mara|sidi kacem|sidi slimane/i.test(norm)) return 'Rabat-Salé-Kénitra';
  if (/marrakech|kech|essaouira|safi|chichaoua|el kelaa|benguerir/i.test(norm)) return 'Marrakech-Safi';
  if (/tanger|tangier|t[eé]touan|al hoceima|larache|asilah|chefchaouen|ksar el kebir/i.test(norm)) return 'Tanger-Tétouan-Al Hoceïma';
  if (/f[eèé]s|mekn[eèé]s|taza|sefrou|ifrane|azrou/i.test(norm)) return 'Fès-Meknès';
  if (/oujda|nador|berkane|taourirt|driouch|guercif/i.test(norm)) return 'Oriental';
  if (/dakhla|aousserd/i.test(norm)) return 'Dakhla-Oued Ed-Dahab';
  if (/beni mellal|b[eé]ni mellal|khouribga|khenifra|fquih ben salah/i.test(norm)) return 'Béni Mellal-Khénifra';
  if (/ouarzazate|zagora|tinghir|errachidia|erfoud|rissani/i.test(norm)) return 'Drâa-Tafilalet';
  if (/guelmim|tan-tan|sidi ifni|assa/i.test(norm)) return 'Guelmim-Oued Noun';
  return city;
}

/**
 * Generates deterministic 1D bar pattern for tracking code (kept for backwards compatibility)
 */
export function buildBarcodePattern(code: string): string {
  let bars = '1101';
  for (let i = 0; i < code.length; i++) {
    const charCode = code.charCodeAt(i);
    const pattern = (charCode * 7919) % 1024;
    const binary = pattern.toString(2).padStart(10, '0');
    bars += binary.replace(/00/g, '0').replace(/11/g, '110');
  }
  bars += '11011';
  return bars;
}

function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    if (!src) {
      resolve(null);
      return;
    }
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

function wrapTextLines(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  maxLines: number = 3
): string[] {
  const clean = (text || '').replace(/\s+/g, ' ').trim();
  if (!clean) return [];

  const words = clean.split(' ');
  const lines: string[] = [];
  let currentLine = '';

  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    if (ctx.measureText(testLine).width <= maxWidth) {
      currentLine = testLine;
    } else {
      if (currentLine) {
        lines.push(currentLine);
        if (lines.length >= maxLines) {
          const lastIdx = lines.length - 1;
          let trimmed = lines[lastIdx];
          while (trimmed.length > 3 && ctx.measureText(trimmed + '...').width > maxWidth) {
            trimmed = trimmed.slice(0, -1);
          }
          lines[lastIdx] = `${trimmed}...`;
          return lines;
        }
        currentLine = word;
      } else {
        let chunk = word;
        while (chunk.length > 3 && ctx.measureText(chunk + '...').width > maxWidth) {
          chunk = chunk.slice(0, -1);
        }
        lines.push(chunk);
        currentLine = '';
      }
    }
  }

  if (currentLine && lines.length < maxLines) {
    lines.push(currentLine);
  }
  return lines;
}

/**
 * Wraps value text where line 1 shares horizontal space with a bold label prefix
 * (e.g., "Adresse : ", "Téléphone : ", "Produit : ")
 */
function wrapPrefixedLines(
  ctx: CanvasRenderingContext2D,
  boldPrefix: string,
  boldFont: string,
  valueText: string,
  regularFont: string,
  maxWidth: number,
  maxLines: number = 3
): { firstLine: string; extraLines: string[]; prefixWidth: number } {
  ctx.font = boldFont;
  const prefixWidth = ctx.measureText(boldPrefix).width;

  const clean = (valueText || '').replace(/\s+/g, ' ').trim();
  if (!clean) return { firstLine: '', extraLines: [], prefixWidth };

  ctx.font = regularFont;
  const words = clean.split(' ');
  const lines: string[] = [];
  let currentLine = '';
  let limit = Math.max(80, maxWidth - prefixWidth);

  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    if (ctx.measureText(testLine).width <= limit) {
      currentLine = testLine;
    } else {
      if (currentLine) {
        lines.push(currentLine);
        if (lines.length >= maxLines) {
          const lastIdx = lines.length - 1;
          const curLimit = lastIdx === 0 ? limit : maxWidth;
          let trimmed = lines[lastIdx];
          while (trimmed.length > 3 && ctx.measureText(trimmed + '...').width > curLimit) {
            trimmed = trimmed.slice(0, -1);
          }
          lines[lastIdx] = `${trimmed}...`;
          return { firstLine: lines[0] || '', extraLines: lines.slice(1), prefixWidth };
        }
        currentLine = word;
        limit = maxWidth;
      } else {
        let chunk = word;
        while (chunk.length > 3 && ctx.measureText(chunk + '...').width > limit) {
          chunk = chunk.slice(0, -1);
        }
        lines.push(chunk);
        currentLine = '';
        limit = maxWidth;
        if (lines.length >= maxLines) {
          return { firstLine: lines[0] || '', extraLines: lines.slice(1), prefixWidth };
        }
      }
    }
  }

  if (currentLine && lines.length < maxLines) {
    lines.push(currentLine);
  }

  return {
    firstLine: lines[0] || '',
    extraLines: lines.slice(1),
    prefixWidth
  };
}

/**
 * Renders a crisp 300 DPI (1200x1200px = exact 100mm x 100mm square) thermal shipping ticket
 * matching the FARIOUSY 100/100 label design: double-bordered header + large QR top-right,
 * spacious Vendeur/Client columns, Produit/Commentaire row, and centered 2-line Arabic footer.
 */
export async function renderTicketTo100x100Canvas(
  pkg: PackageItem,
  options: TicketRenderOptions = {}
): Promise<HTMLCanvasElement> {
  if (typeof document !== 'undefined' && (document as any).fonts?.ready) {
    try {
      await (document as any).fonts.ready;
    } catch {
      // ignore font loading timeout
    }
  }

  const WIDTH = 1200;  // 100mm @ 300 DPI (12px = 1mm)
  const HEIGHT = 1200; // 100mm @ 300 DPI (exact 100x100 square)
  const M = 16;        // 1.33mm outer border margin
  const INNER_W = WIDTH - M * 2;  // 1168px
  const INNER_H = HEIGHT - M * 2; // 1168px
  const RIGHT_X = WIDTH - M;      // 1184px
  const BOTTOM_Y = HEIGHT - M;    // 1184px

  const measureCanvas = document.createElement('canvas');
  measureCanvas.width = WIDTH;
  measureCanvas.height = HEIGHT;
  const mctx = measureCanvas.getContext('2d');
  if (!mctx) throw new Error('Canvas 2D context unavailable');

  // Resolve values with defaults
  const vendeurName = (options.vendeurName ?? pkg.clientCompany ?? pkg.clientName ?? 'FARIOUSY CLIENT').trim();
  const vendeurPhone = (options.vendeurPhone ?? pkg.clientPhone ?? '--').trim();
  const rawVendeurAdr = (options.vendeurAddress ?? pkg.currentAgency ?? '').trim();
  const vendeurAddress = rawVendeurAdr && rawVendeurAdr !== '--' ? rawVendeurAdr : '';
  const productName = (options.productName ?? pkg.description ?? 'Colis Standard').trim();
  const quantity = (options.quantity ?? '1').trim();
  const comment = (options.comment ?? pkg.notes ?? 'شكرا لثقتكم').trim();
  const codAmount = options.codAmount ?? pkg.codAmount ?? 0;
  const agencyAddress = (options.agencyAddress ?? 'Lotissement al aouda').trim();
  const canOpen = options.canOpen !== undefined ? options.canOpen : (pkg.allowOpen !== undefined ? pkg.allowOpen : true);
  const allowTry = options.allowTry !== undefined ? options.allowTry : Boolean(pkg.allowTry);
  const isFragile = options.isFragile !== undefined ? options.isFragile : Boolean(pkg.isFragile);
  const regionName = getMoroccanRegion(pkg.city);

  // Header grid geometry (Left double-boxed section + Right QR column)
  const qrColX = 874;      // Left section = M..874 (858px), QR col = 874..1184 (310px)
  const subRowY = M + 206; // Top boxes height = 206px
  const subRowH = 106;     // Sub-row boxes height = 106px
  const headerHeight = 206 + subRowH; // 312px
  const crbtSplitX = 534;  // Splits Brand/Logo & CRBT (and "---" & OUVRIR LE COLIS)
  const dashSplitX = 414;  // Splits Region (M..414) and "---" (414..534)

  // Optional fragile & exchange banners + exact proportional heights to fill full 100x100mm square
  const fragileHeight = isFragile ? 48 : 0;
  const exHeight = pkg.isExchange ? 62 : 0;
  const remainingH = INNER_H - headerHeight - fragileHeight - exHeight; // 856px normal
  const footerHeight = 134;
  const partyRowHeight = (pkg.isExchange && isFragile) ? 372 : (pkg.isExchange || isFragile) ? 396 : 432;
  const prodRowHeight = remainingH - partyRowHeight - footerHeight;

  // Middle columns geometry
  const midX = WIDTH / 2;  // 600
  const vMaxW = midX - M - 44;
  const cX = midX + 24;
  const cMaxW = RIGHT_X - cX - 22;

  // Pre-wrap text
  mctx.font = '500 21px "Cairo", Arial, sans-serif';
  const agencyLines = wrapTextLines(mctx, agencyAddress, crbtSplitX - (M + 186) - 18, 2);

  mctx.font = '800 32px "Cairo", Arial, sans-serif';
  const vNameLines = wrapTextLines(mctx, vendeurName, vMaxW, 2);

  mctx.font = '700 30px "Cairo", Arial, sans-serif';
  const vAdrLines = vendeurAddress ? wrapTextLines(mctx, vendeurAddress, vMaxW, 2) : [];

  // Auto-fit client body font size so long addresses never overflow the 100x100 cell
  let cBodySize = 30;
  let cLineStep = 38;
  let cNameLines: string[] = [];
  let phoneWrapped = { firstLine: '', extraLines: [] as string[], prefixWidth: 0 };
  let addrWrapped = { firstLine: '', extraLines: [] as string[], prefixWidth: 0 };
  let villeWrapped = { firstLine: '', extraLines: [] as string[], prefixWidth: 0 };

  const phonesText = `${pkg.recipientPhone}${pkg.recipientPhone2 ? ` / ${pkg.recipientPhone2}` : ''}`;

  for (const candidate of [
    { size: 30, step: 38 },
    { size: 27, step: 34 },
    { size: 24, step: 30 }
  ]) {
    cBodySize = candidate.size;
    cLineStep = candidate.step;
    mctx.font = `800 ${cBodySize + 2}px "Cairo", Arial, sans-serif`;
    cNameLines = wrapTextLines(mctx, pkg.recipientName, cMaxW, 2);

    const boldF = `700 ${cBodySize}px "Cairo", Arial, sans-serif`;
    const regF = `500 ${cBodySize}px "Cairo", Arial, sans-serif`;
    phoneWrapped = wrapPrefixedLines(mctx, 'Téléphone : ', boldF, phonesText, regF, cMaxW, 2);
    addrWrapped = wrapPrefixedLines(mctx, 'Adresse : ', boldF, pkg.address || '', regF, cMaxW, 3);
    villeWrapped = wrapPrefixedLines(mctx, 'Ville : ', boldF, pkg.city || '', regF, cMaxW, 2);

    const totalClientH =
      42 + // top pad
      48 + // heading height
      cNameLines.length * (cLineStep + 2) +
      (1 + phoneWrapped.extraLines.length) * cLineStep +
      (1 + addrWrapped.extraLines.length) * cLineStep +
      (1 + villeWrapped.extraLines.length) * cLineStep +
      16;

    if (totalClientH <= partyRowHeight) break;
  }

  const prodWrapped = wrapPrefixedLines(
    mctx,
    'Produit : ',
    '700 26px "Cairo", Arial, sans-serif',
    productName,
    '500 26px "Cairo", Arial, sans-serif',
    vMaxW,
    3
  );

  mctx.font = '500 26px "Cairo", Arial, sans-serif';
  const comLines = wrapTextLines(mctx, comment || 'شكرا لثقتكم', cMaxW, 3);

  const canvas = document.createElement('canvas');
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context unavailable');

  // Pure white background
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  // Outer thick black border filling full 100x100 sheet
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 7;
  ctx.strokeRect(M, M, INNER_W, INNER_H);

  // Generate QR & load red FARIOUSY emblem in parallel
  const qrPromise = QRCode.toDataURL(pkg.trackingNumber, {
    margin: 1,
    width: 420,
    color: { dark: '#000000', light: '#ffffff' },
    errorCorrectionLevel: 'M'
  }).catch(() => '');

  const logoPromise = loadImage('/fariousy-logo.jpeg');
  const [qrUrl, logoImg] = await Promise.all([qrPromise, logoPromise]);
  const qrImg = qrUrl ? await loadImage(qrUrl) : null;

  // =========================================================================
  // ROW 1: DOUBLE-BOXED HEADER + RIGHT QR COLUMN
  // =========================================================================
  const headerBottom = M + headerHeight;

  // Outer thick separator under header and vertical divider before QR
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(M, headerBottom);
  ctx.lineTo(RIGHT_X, headerBottom);
  ctx.moveTo(qrColX, M);
  ctx.lineTo(qrColX, headerBottom);
  ctx.stroke();

  // Helper for inner double-bordered boxes in the top-left grid
  const drawDoubleBox = (x1: number, y1: number, x2: number, y2: number, pad = 8) => {
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 3;
    ctx.strokeRect(x1 + pad, y1 + pad, x2 - x1 - pad * 2, y2 - y1 - pad * 2);
  };

  // Grid lines inside left header area
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(M, subRowY);
  ctx.lineTo(qrColX, subRowY);
  ctx.moveTo(crbtSplitX, M);
  ctx.lineTo(crbtSplitX, headerBottom);
  ctx.moveTo(dashSplitX, subRowY);
  ctx.lineTo(dashSplitX, headerBottom);
  ctx.stroke();

  // Inner double borders for the 5 cells
  drawDoubleBox(M, M, crbtSplitX, subRowY, 8);                // Box 1: Logo + Brand
  drawDoubleBox(crbtSplitX, M, qrColX, subRowY, 8);           // Box 2: CRBT
  drawDoubleBox(M, subRowY, dashSplitX, headerBottom, 8);     // Box 3: Region/City
  drawDoubleBox(dashSplitX, subRowY, crbtSplitX, headerBottom, 8); // Box 4: ---
  drawDoubleBox(crbtSplitX, subRowY, qrColX, headerBottom, 8);     // Box 5: OUVRIR LE COLIS

  // Box 1 content: Cropped red bird emblem + FARIOUSY / fariousy.com / Address
  ctx.fillStyle = '#000000';
  if (logoImg && logoImg.width > 0 && logoImg.height > 0) {
    const sx = logoImg.width * 0.225;
    const sy = logoImg.height * 0.255;
    const sw = logoImg.width * 0.48;
    const sh = logoImg.height * 0.40;
    ctx.drawImage(logoImg, sx, sy, sw, sh, M + 28, M + 46, 134, 112);
  } else {
    ctx.strokeStyle = '#dc2626';
    ctx.lineWidth = 4;
    ctx.strokeRect(M + 30, M + 48, 120, 108);
    ctx.textAlign = 'center';
    ctx.font = '900 32px Arial, sans-serif';
    ctx.fillStyle = '#dc2626';
    ctx.fillText('FD', M + 90, M + 114);
    ctx.fillStyle = '#000000';
  }

  const brandTextX = M + 186;
  const brandStartY = agencyLines.length > 1 ? M + 68 : M + 80;
  ctx.textAlign = 'left';
  ctx.font = '800 24px "Cairo", Arial, sans-serif';
  ctx.fillText('FARIOUSY', brandTextX, brandStartY);
  ctx.font = '500 22px "Cairo", Arial, sans-serif';
  ctx.fillText('fariousy.com', brandTextX, brandStartY + 32);
  agencyLines.forEach((line, idx) => {
    ctx.fillText(line, brandTextX, brandStartY + 64 + idx * 26);
  });

  // Box 2 content: CRBT + Amount
  const crbtCenter = (crbtSplitX + qrColX) / 2;
  ctx.textAlign = 'center';
  ctx.font = '800 24px "Cairo", Arial, sans-serif';
  ctx.fillText('CRBT', crbtCenter, M + 90);

  const amountText = `${codAmount} DH`;
  ctx.font = amountText.length > 9
    ? '900 32px "Cairo", Arial, sans-serif'
    : '900 40px "Cairo", Arial, sans-serif';
  ctx.fillText(amountText, crbtCenter, M + 140);

  // Box 3 content: Region / Hub (auto-fit width cleanly)
  const box3Center = (M + dashSplitX) / 2;
  const box3MaxW = dashSplitX - M - 36;
  ctx.textAlign = 'center';
  let regFontSize = 28;
  ctx.font = `800 ${regFontSize}px "Cairo", Arial, sans-serif`;
  while (regFontSize > 18 && ctx.measureText(regionName).width > box3MaxW) {
    regFontSize -= 2;
    ctx.font = `800 ${regFontSize}px "Cairo", Arial, sans-serif`;
  }
  const regionDisplay = wrapTextLines(ctx, regionName, box3MaxW, 1)[0] || regionName;
  ctx.fillText(regionDisplay, box3Center, subRowY + 62);

  // Box 4 content: ---
  const box4Center = (dashSplitX + crbtSplitX) / 2;
  ctx.font = '800 28px "Cairo", Arial, sans-serif';
  ctx.fillText('---', box4Center, subRowY + 62);

  // Box 5 content: OUVRIR LE COLIS / NE PAS OUVRIR LE COLIS + ESSAYAGE : OUI / NON
  ctx.font = canOpen ? '800 20px "Cairo", Arial, sans-serif' : '800 17px "Cairo", Arial, sans-serif';
  ctx.fillText(
    canOpen ? 'OUVRIR LE COLIS' : 'NE PAS OUVRIR LE COLIS',
    crbtCenter,
    subRowY + 46
  );
  ctx.font = '800 17px "Cairo", Arial, sans-serif';
  ctx.fillText(
    allowTry ? 'ESSAYAGE : OUI' : 'ESSAYAGE : NON',
    crbtCenter,
    subRowY + 78
  );

  // Right QR Column: Large crisp QR Code + Tracking Number underneath
  const qrCenter = (qrColX + RIGHT_X) / 2;
  if (qrImg) {
    ctx.drawImage(qrImg, qrCenter - 114, M + 18, 228, 228);
  }
  ctx.textAlign = 'center';
  let trackFontSize = 22;
  ctx.font = `800 ${trackFontSize}px "Cairo", Arial, sans-serif`;
  while (trackFontSize > 15 && ctx.measureText(pkg.trackingNumber).width > RIGHT_X - qrColX - 20) {
    trackFontSize -= 1;
    ctx.font = `800 ${trackFontSize}px "Cairo", Arial, sans-serif`;
  }
  ctx.fillText(pkg.trackingNumber, qrCenter, headerBottom - 22);

  // =========================================================================
  // OPTIONAL FRAGILE & EXCHANGE BANNERS
  // =========================================================================
  let currentY = headerBottom;
  if (isFragile) {
    ctx.fillStyle = '#000000';
    ctx.fillRect(M, currentY, INNER_W, fragileHeight);
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.font = '900 24px "Cairo", Arial, sans-serif';
    ctx.fillText('⚠ ATTENTION FRAGILE — قابل للكسر', WIDTH / 2, currentY + 32);
    ctx.fillStyle = '#000000';
    currentY += fragileHeight;
  }
  if (pkg.isExchange) {
    ctx.fillStyle = '#000000';
    ctx.fillRect(M, currentY, INNER_W, exHeight);
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.font = '900 20px "Cairo", Arial, sans-serif';
    ctx.fillText("COLIS D'ÉCHANGE (طرد استبدال)", WIDTH / 2, currentY + 26);
    ctx.font = '700 17px "JetBrains Mono", monospace';
    ctx.fillText(
      `REPRENDRE ANCIEN COLIS : ${pkg.exchangeTrackingNumber || 'NON PRÉCISÉ'}`,
      WIDTH / 2,
      currentY + 51
    );
    ctx.fillStyle = '#000000';
    currentY += exHeight;
  }

  // =========================================================================
  // ROW 2: VENDEUR VS CLIENT (LARGE READABLE REFERENCE TYPOGRAPHY)
  // =========================================================================
  const partyRowBottom = currentY + partyRowHeight;
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(M, partyRowBottom);
  ctx.lineTo(RIGHT_X, partyRowBottom);
  ctx.moveTo(midX, currentY);
  ctx.lineTo(midX, partyRowBottom);
  ctx.stroke();

  // Left: Vendeur
  let vy = currentY + 62;
  ctx.textAlign = 'left';
  ctx.fillStyle = '#000000';
  ctx.font = '800 42px "Cairo", Arial, sans-serif';
  ctx.fillText('vendeur \u200E(البائع)\u200E :', M + 22, vy);
  vy += 48;

  ctx.font = '800 32px "Cairo", Arial, sans-serif';
  vNameLines.forEach(line => {
    ctx.fillText(line, M + 22, vy);
    vy += 40;
  });

  ctx.font = '800 32px Arial, sans-serif';
  ctx.fillText(vendeurPhone, M + 22, vy);
  vy += 40;

  if (vAdrLines.length > 0) {
    ctx.font = '700 30px "Cairo", Arial, sans-serif';
    vAdrLines.forEach(line => {
      ctx.fillText(line, M + 22, vy);
      vy += 38;
    });
  }

  // Right: Client
  let cy = currentY + 62;
  ctx.font = '800 42px "Cairo", Arial, sans-serif';
  ctx.fillText('client \u200E( المشتري )\u200E :', cX, cy);
  cy += 48;

  ctx.font = `800 ${cBodySize + 2}px "Cairo", Arial, sans-serif`;
  cNameLines.forEach(line => {
    ctx.fillText(line, cX, cy);
    cy += cLineStep + 2;
  });

  // Téléphone : <phone>
  ctx.font = `700 ${cBodySize}px "Cairo", Arial, sans-serif`;
  ctx.fillText('Téléphone : ', cX, cy);
  ctx.font = `500 ${cBodySize}px "Cairo", Arial, sans-serif`;
  ctx.fillText(phoneWrapped.firstLine, cX + phoneWrapped.prefixWidth, cy);
  cy += cLineStep;
  phoneWrapped.extraLines.forEach(line => {
    ctx.fillText(line, cX, cy);
    cy += cLineStep;
  });

  // Adresse : <address>
  ctx.font = `700 ${cBodySize}px "Cairo", Arial, sans-serif`;
  ctx.fillText('Adresse : ', cX, cy);
  ctx.font = `500 ${cBodySize}px "Cairo", Arial, sans-serif`;
  ctx.fillText(addrWrapped.firstLine, cX + addrWrapped.prefixWidth, cy);
  cy += cLineStep;
  addrWrapped.extraLines.forEach(line => {
    ctx.fillText(line, cX, cy);
    cy += cLineStep;
  });

  // Ville : <city>
  ctx.font = `700 ${cBodySize}px "Cairo", Arial, sans-serif`;
  ctx.fillText('Ville : ', cX, cy);
  ctx.font = `500 ${cBodySize}px "Cairo", Arial, sans-serif`;
  ctx.fillText(villeWrapped.firstLine, cX + villeWrapped.prefixWidth, cy);
  cy += cLineStep;
  villeWrapped.extraLines.forEach(line => {
    ctx.fillText(line, cX, cy);
    cy += cLineStep;
  });

  // =========================================================================
  // ROW 3: PRODUIT & QUANTITÉ VS CENTERED COMMENTAIRE
  // =========================================================================
  currentY = partyRowBottom;
  const prodBottom = currentY + prodRowHeight;

  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(M, prodBottom);
  ctx.lineTo(RIGHT_X, prodBottom);
  ctx.moveTo(midX, currentY);
  ctx.lineTo(midX, prodBottom);
  ctx.stroke();

  // Left: Produit & Quantité vertically centered inside cell
  const prodLinesCount = 1 + prodWrapped.extraLines.length;
  const prodBlockH = prodLinesCount * 36 + 44;
  let py = currentY + Math.max(48, (prodRowHeight - prodBlockH) / 2 + 24);
  ctx.textAlign = 'left';
  ctx.font = '700 26px "Cairo", Arial, sans-serif';
  ctx.fillText('Produit : ', M + 24, py);
  ctx.font = '500 26px "Cairo", Arial, sans-serif';
  ctx.fillText(prodWrapped.firstLine, M + 24 + prodWrapped.prefixWidth, py);
  py += 36;
  prodWrapped.extraLines.forEach(line => {
    ctx.fillText(line, M + 24, py);
    py += 36;
  });

  py += 14;
  ctx.font = '700 26px "Cairo", Arial, sans-serif';
  const qtyLabel = 'Quantité : ';
  const qtyLabelW = ctx.measureText(qtyLabel).width;
  ctx.fillText(qtyLabel, M + 24, py);
  ctx.font = '500 26px "Cairo", Arial, sans-serif';
  ctx.fillText(quantity, M + 24 + qtyLabelW, py);

  // Right: Centered Commentaire
  const commentCenterX = (midX + RIGHT_X) / 2;
  ctx.textAlign = 'center';
  ctx.font = '700 26px "Cairo", Arial, sans-serif';
  ctx.fillText('Commentaire :', commentCenterX, currentY + 86);
  ctx.font = '500 26px "Cairo", Arial, sans-serif';
  comLines.forEach((line, idx) => {
    ctx.fillText(line, commentCenterX, currentY + 156 + idx * 36);
  });

  // =========================================================================
  // ROW 4: 2-LINE ARABIC FOOTER DISCLAIMER
  // =========================================================================
  ctx.save();
  ctx.direction = 'rtl';
  ctx.textAlign = 'center';
  ctx.fillStyle = '#000000';
  ctx.font = '800 38px "Cairo", Arial, sans-serif';
  ctx.fillText('ملاحظة', WIDTH / 2, prodBottom + 56);
  ctx.font = '600 30px "Cairo", Arial, sans-serif';
  ctx.fillText('فاريوسي شركة مكلفة بالتوصيل فقط', WIDTH / 2, prodBottom + 106);
  ctx.restore();

  return canvas;
}

/**
 * Generates and downloads an exact 100mm x 100mm square thermal PDF.
 */
export async function downloadTicketPdf(
  pkg: PackageItem,
  options: TicketRenderOptions = {}
): Promise<void> {
  const canvas = await renderTicketTo100x100Canvas(pkg, options);
  const imgData = canvas.toDataURL('image/png', 1.0);

  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: [100, 100],
    compress: true
  });

  pdf.addImage(imgData, 'PNG', 0, 0, 100, 100, undefined, 'FAST');
  pdf.save(`Ticket-FARIOUSY-${pkg.trackingNumber}.pdf`);
}

/**
 * Generates and downloads a multi-page 100mm x 100mm thermal PDF for multiple packages (1 ticket per page).
 */
export async function downloadBatchTicketsPdf(packages: PackageItem[]): Promise<void> {
  if (!packages || packages.length === 0) return;

  const firstCanvas = await renderTicketTo100x100Canvas(packages[0]);

  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: [100, 100],
    compress: true
  });

  pdf.addImage(firstCanvas.toDataURL('image/png', 1.0), 'PNG', 0, 0, 100, 100, undefined, 'FAST');

  for (let i = 1; i < packages.length; i++) {
    const canvas = await renderTicketTo100x100Canvas(packages[i]);
    pdf.addPage([100, 100], 'portrait');
    pdf.addImage(canvas.toDataURL('image/png', 1.0), 'PNG', 0, 0, 100, 100, undefined, 'FAST');
  }

  const stamp = new Date().toISOString().slice(0, 10);
  pdf.save(`Tickets-FARIOUSY-${packages.length}-colis-${stamp}.pdf`);
}

/**
 * Generates and downloads a high-resolution 100x100mm thermal PNG (1200x1200 @ 300 DPI).
 */
export async function downloadTicketPng(
  pkg: PackageItem,
  options: TicketRenderOptions = {}
): Promise<void> {
  const canvas = await renderTicketTo100x100Canvas(pkg, options);
  const dataUrl = canvas.toDataURL('image/png', 1.0);
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = `Ticket-FARIOUSY-${pkg.trackingNumber}.png`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

/**
 * Prints the thermal ticket directly to a 100x100mm thermal label printer
 * at exact 100mm x 100mm dimensions so it fills the sheet cleanly edge-to-edge.
 */
export async function printTicket100x100(
  pkg: PackageItem,
  options: TicketRenderOptions = {}
): Promise<boolean> {
  const canvas = await renderTicketTo100x100Canvas(pkg, options);
  const dataUrl = canvas.toDataURL('image/png', 1.0);

  return new Promise((resolve) => {
    try {
      const existingFrame = document.getElementById('fariousy-print-iframe');
      if (existingFrame) existingFrame.remove();

      const iframe = document.createElement('iframe');
      iframe.id = 'fariousy-print-iframe';
      iframe.style.position = 'fixed';
      iframe.style.right = '0';
      iframe.style.bottom = '0';
      iframe.style.width = '10px';
      iframe.style.height = '10px';
      iframe.style.opacity = '0';
      iframe.style.border = '0';
      iframe.style.pointerEvents = 'none';
      document.body.appendChild(iframe);

      const frameDoc = iframe.contentWindow?.document || iframe.contentDocument;
      if (!frameDoc) {
        window.print();
        resolve(true);
        return;
      }

      frameDoc.open();
      frameDoc.write(`
        <!DOCTYPE html>
        <html lang="ar">
          <head>
            <meta charset="utf-8" />
            <title>Ticket-${pkg.trackingNumber}</title>
            <style>
              @page {
                size: 100mm 100mm;
                margin: 0mm;
              }
              * {
                box-sizing: border-box;
                margin: 0;
                padding: 0;
              }
              html, body {
                width: 100mm;
                height: 100mm;
                margin: 0;
                padding: 0;
                background: #ffffff;
                overflow: hidden;
                -webkit-print-color-adjust: exact;
                print-color-adjust: exact;
              }
              .ticket-page {
                width: 100mm;
                height: 100mm;
                display: flex;
                align-items: center;
                justify-content: center;
                page-break-after: avoid;
                break-inside: avoid;
              }
              .ticket-img {
                width: 100mm;
                height: 100mm;
                object-fit: contain;
                display: block;
              }
            </style>
          </head>
          <body>
            <div class="ticket-page">
              <img id="ticket-img" class="ticket-img" src="${dataUrl}" alt="${pkg.trackingNumber}" />
            </div>
          </body>
        </html>
      `);
      frameDoc.close();

      const triggerPrint = () => {
        try {
          iframe.contentWindow?.focus();
          iframe.contentWindow?.print();
          resolve(true);
        } catch (err) {
          console.warn('Iframe print failed, falling back to window.print():', err);
          window.print();
          resolve(true);
        }
      };

      const imgEl = frameDoc.getElementById('ticket-img') as HTMLImageElement | null;
      if (imgEl && !imgEl.complete) {
        imgEl.onload = () => setTimeout(triggerPrint, 120);
        imgEl.onerror = () => setTimeout(triggerPrint, 120);
      } else {
        setTimeout(triggerPrint, 200);
      }
    } catch (err) {
      console.warn('Print error fallback:', err);
      window.print();
      resolve(true);
    }
  });
}
