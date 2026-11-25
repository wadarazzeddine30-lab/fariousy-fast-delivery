/**
 * Compresses an uploaded/captured image File into a lightweight JPEG data URL
 * suitable for reliable network upload, localStorage backup, and Supabase JSONB storage.
 */
export async function compressImageFileToDataUrl(
  file: File,
  maxEdge: number = 1024,
  quality: number = 0.76,
  maxChars?: number
): Promise<string> {
  const targetMaxChars = maxChars ?? (maxEdge <= 560 ? 85_000 : 280_000);

  const encodeDrawable = (
    drawable: CanvasImageSource,
    srcWidth: number,
    srcHeight: number
  ): string => {
    let width = Math.max(1, srcWidth);
    let height = Math.max(1, srcHeight);
    if (width > maxEdge || height > maxEdge) {
      if (width >= height) {
        height = Math.max(1, Math.round((height * maxEdge) / width));
        width = maxEdge;
      } else {
        width = Math.max(1, Math.round((width * maxEdge) / height));
        height = maxEdge;
      }
    }

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Canvas 2D indisponible.');
    }

    let currentW = width;
    let currentH = height;
    let output = '';

    for (let scalePass = 0; scalePass < 4; scalePass++) {
      canvas.width = Math.max(64, Math.round(currentW));
      canvas.height = Math.max(64, Math.round(currentH));
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(drawable, 0, 0, canvas.width, canvas.height);

      const qualities = scalePass === 0
        ? [quality, Math.min(quality, 0.6), 0.48]
        : [0.55, 0.42];

      for (const q of qualities) {
        output = canvas.toDataURL('image/jpeg', q);
        if (output && output.length <= targetMaxChars) {
          return output;
        }
      }

      currentW *= 0.75;
      currentH *= 0.75;
    }

    return output;
  };

  // 1. Try createImageBitmap first (handles EXIF rotation & mobile camera formats better)
  if (typeof createImageBitmap === 'function') {
    let bitmap: ImageBitmap | null = null;
    try {
      bitmap = await createImageBitmap(file);
      const compressed = encodeDrawable(bitmap, bitmap.width, bitmap.height);
      if (compressed && compressed.startsWith('data:image/')) {
        return compressed;
      }
    } catch {
      // Fall through to FileReader + HTMLImageElement
    } finally {
      try {
        bitmap?.close();
      } catch {}
    }
  }

  // 2. Fallback: FileReader + HTMLImageElement
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Impossible de lire le fichier image.'));
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : '';
      if (!result) {
        reject(new Error('Fichier image vide.'));
        return;
      }
      const img = new Image();
      img.onerror = () => {
        // Never return a multi-MB raw data URL that would blow up HTTP/Supabase limits
        if (result.startsWith('data:image/') && result.length <= Math.max(targetMaxChars * 2, 220_000)) {
          resolve(result);
        } else {
          reject(new Error('Format d’image non supporté ou fichier trop volumineux.'));
        }
      };
      img.onload = () => {
        try {
          const compressed = encodeDrawable(img, img.naturalWidth || img.width, img.naturalHeight || img.height);
          if (compressed && compressed.length <= Math.max(targetMaxChars * 2.5, 300_000)) {
            resolve(compressed);
          } else {
            reject(new Error('Image trop volumineuse après compression.'));
          }
        } catch {
          if (result.length <= Math.max(targetMaxChars * 2, 220_000)) {
            resolve(result);
          } else {
            reject(new Error('Impossible de compresser cette image.'));
          }
        }
      };
      img.src = result;
    };
    reader.readAsDataURL(file);
  });
}

/**
 * Triggers a clean browser file download for a data URL or image URL without window.open.
 */
export function downloadImageUrl(imageUrl: string, fileName: string = 'recu_virement_bancaire.jpg'): void {
  if (!imageUrl) return;
  try {
    if (imageUrl.startsWith('data:')) {
      const parts = imageUrl.split(',');
      const mimeMatch = parts[0].match(/:(.*?);/);
      const mime = mimeMatch ? mimeMatch[1] : 'image/jpeg';
      const byteString = atob(parts[1] || '');
      const ab = new ArrayBuffer(byteString.length);
      const ia = new Uint8Array(ab);
      for (let i = 0; i < byteString.length; i++) {
        ia[i] = byteString.charCodeAt(i);
      }
      const blob = new Blob([ab], { type: mime });
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(blobUrl), 2500);
      return;
    }

    const a = document.createElement('a');
    a.href = imageUrl;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  } catch {
    const a = document.createElement('a');
    a.href = imageUrl;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }
}

