import React, { useRef, useState } from 'react';
import { Camera, CheckCircle2, CreditCard, Loader2, Trash2, Upload, User } from 'lucide-react';
import { compressImageFileToDataUrl } from '../../utils/imageCompress';

interface KycPhotoUploadProps {
  label: string;
  sublabel?: string;
  value: string;
  onChange: (dataUrl: string) => void;
  required?: boolean;
  variant?: 'id_card' | 'portrait';
  captureMode?: 'environment' | 'user';
  disabled?: boolean;
  lang?: 'ar' | 'fr';
}

export const KycPhotoUpload: React.FC<KycPhotoUploadProps> = ({
  label,
  sublabel,
  value,
  onChange,
  required = false,
  variant = 'id_card',
  captureMode = 'environment',
  disabled = false,
  lang = 'ar'
}) => {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const isFr = lang === 'fr';

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLocalError(null);

    if (!file.type.startsWith('image/')) {
      setLocalError(isFr ? 'Veuillez sélectionner une image valide (JPG / PNG).' : 'يرجى اختيار صورة صالحة (JPG / PNG).');
      return;
    }

    setIsProcessing(true);
    try {
      const compressed = await compressImageFileToDataUrl(file, variant === 'portrait' ? 900 : 1200, 0.78);
      onChange(compressed);
    } catch {
      setLocalError(isFr ? "Impossible de traiter l'image, veuillez réessayer." : 'تعذر معالجة الصورة، يرجى المحاولة بصورة أخرى.');
    } finally {
      setIsProcessing(false);
      if (inputRef.current) {
        inputRef.current.value = '';
      }
    }
  };

  const isPortrait = variant === 'portrait';

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <label className="block text-[11px] font-bold text-slate-700">
          {label} {required && <span className="text-red-500">*</span>}
        </label>
        {value && (
          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded-md">
            <CheckCircle2 className="w-3 h-3" />
            <span>{isFr ? 'Prête' : 'جاهزة'}</span>
          </span>
        )}
      </div>

      {sublabel && <p className="text-[10px] text-slate-500 leading-tight">{sublabel}</p>}

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture={captureMode}
        onChange={handleFileChange}
        disabled={disabled || isProcessing}
        className="hidden"
      />

      {value ? (
        <div className="relative group rounded-xl border border-emerald-300 bg-emerald-50/40 p-2 flex items-center gap-3">
          <img
            src={value}
            alt={label}
            className={
              isPortrait
                ? 'w-14 h-14 rounded-full object-cover border-2 border-white shadow-xs shrink-0'
                : 'w-20 h-14 rounded-lg object-cover border border-slate-200 bg-white shadow-xs shrink-0'
            }
          />
          <div className="flex-1 min-w-0">
            <p className="text-[11px] font-bold text-slate-800 truncate">{label}</p>
            <p className="text-[10px] text-emerald-700 font-medium">
              {isFr ? 'Photo jointe avec succès' : 'تم إرفاق الصورة بنجاح'}
            </p>
            <div className="flex items-center gap-1.5 mt-1.5">
              <button
                type="button"
                disabled={disabled || isProcessing}
                onClick={() => inputRef.current?.click()}
                className="px-2 py-1 text-[10px] font-bold text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg transition-colors cursor-pointer flex items-center gap-1"
              >
                <Camera className="w-3 h-3 text-slate-600" />
                <span>{isFr ? 'Changer' : 'تغيير'}</span>
              </button>
              <button
                type="button"
                disabled={disabled || isProcessing}
                onClick={() => onChange('')}
                className="px-2 py-1 text-[10px] font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg transition-colors cursor-pointer flex items-center gap-1"
              >
                <Trash2 className="w-3 h-3" />
                <span>{isFr ? 'Supprimer' : 'حذف'}</span>
              </button>
            </div>
          </div>
        </div>
      ) : (
        <button
          type="button"
          disabled={disabled || isProcessing}
          onClick={() => inputRef.current?.click()}
          className="w-full p-3 rounded-xl border-2 border-dashed border-slate-300 hover:border-red-400 bg-slate-50 hover:bg-red-50/40 transition-all cursor-pointer flex items-center gap-3 text-left"
        >
          <div
            className={`w-10 h-10 ${
              isPortrait ? 'rounded-full' : 'rounded-xl'
            } bg-white border border-slate-200 text-red-600 flex items-center justify-center shrink-0 shadow-2xs`}
          >
            {isProcessing ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : isPortrait ? (
              <User className="w-4 h-4" />
            ) : (
              <CreditCard className="w-4 h-4" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <span className="text-[11px] font-bold text-slate-800 block">
              {isProcessing
                ? isFr
                  ? 'Compression de la photo...'
                  : 'جاري ضغط الصورة...'
                : isPortrait
                ? isFr
                  ? 'Importer ou prendre une photo de profil'
                  : 'رفع أو التقاط الصورة الشخصية'
                : isFr
                ? 'Importer ou photographier la carte nationale (CIN)'
                : 'رفع أو تصوير البطاقة الوطنية (CIN)'}
            </span>
            <span className="text-[10px] text-slate-500 block truncate">
              {isPortrait
                ? 'Cliquez pour choisir ou prendre un selfie clair'
                : 'Cliquez pour importer ou photographier la carte'}
            </span>
          </div>
          <Upload className="w-4 h-4 text-slate-400 shrink-0" />
        </button>
      )}

      {localError && <p className="text-[10px] font-semibold text-rose-600">{localError}</p>}
    </div>
  );
};
