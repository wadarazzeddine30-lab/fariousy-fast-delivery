import React, { useState } from 'react';
import { usePWAInstall } from '../../hooks/usePWAInstall';
import { 
  Download, 
  Smartphone, 
  CheckCircle2, 
  Share2, 
  PlusSquare, 
  X, 
  ArrowDownToLine, 
  Sparkles,
  ShieldCheck,
  Zap
} from 'lucide-react';

interface PWAInstallModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const PWAInstallModal: React.FC<PWAInstallModalProps> = ({ isOpen, onClose }) => {
  const { isInstallable, isInstalled, isIOS, isAndroid, install } = usePWAInstall();
  const [installSuccess, setInstallSuccess] = useState(false);

  if (!isOpen) return null;

  const handleInstallClick = async () => {
    if (isInstallable) {
      const success = await install();
      if (success) {
        setInstallSuccess(true);
        setTimeout(() => {
          onClose();
        }, 2000);
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-end sm:items-center justify-center p-3 sm:p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-md w-full p-6 text-white shadow-2xl space-y-5 animate-in fade-in zoom-in-95">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-white flex items-center justify-center shadow-lg shadow-red-950/60 p-1.5">
              <img 
                src="/pwa-192x192.png" 
                alt="FARIOUSY Logo" 
                className="w-full h-full object-contain rounded-xl"
              />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-black text-white">FARIOUSY Driver</span>
                <span className="px-2 py-0.5 bg-red-950 text-red-400 border border-red-800/60 rounded-full text-[10px] font-bold">APK / PWA</span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">تطبيق الموزع للهاتف الذكي</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-xl bg-slate-800/80 hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Success Banner */}
        {installSuccess && (
          <div className="p-3 bg-emerald-950/80 border border-emerald-700/60 rounded-2xl flex items-center gap-2.5 text-emerald-300 text-xs font-bold">
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
            <span>تم تثبيت التطبيق بنجاح على هاتفك! يمكنك فتحه من الشاشة الرئيسية.</span>
          </div>
        )}

        {/* Status: Already installed */}
        {isInstalled ? (
          <div className="p-4 bg-emerald-950/40 border border-emerald-800/50 rounded-2xl text-center space-y-2">
            <div className="w-10 h-10 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <h4 className="text-sm font-black text-emerald-300">التطبيق مثبت حالياً ويعمل كـ APK</h4>
            <p className="text-xs text-slate-400">
              أنت تستخدم التطبيق في الوضع المستقل (Standalone Mode) بأعلى سرعة وبدون متصفح.
            </p>
          </div>
        ) : (
          <>
            {/* Direct Android 1-Click Install Button */}
            {isInstallable ? (
              <div className="space-y-3">
                <button
                  onClick={handleInstallClick}
                  className="w-full py-3.5 px-4 bg-gradient-to-r from-red-600 via-rose-600 to-red-600 hover:from-red-500 hover:to-rose-500 text-white rounded-2xl text-xs font-black flex items-center justify-center gap-2.5 shadow-xl shadow-red-950/80 active:scale-98 transition"
                >
                  <ArrowDownToLine className="w-5 h-5" />
                  <span>تثبيت التطبيق على الهاتف (Install APK)</span>
                </button>
                <p className="text-[11px] text-center text-slate-400">
                  ⚡ تثبيت فوري على شاشة الهاتف مع دعم العمل بدون إنترنت ومسح الباركود
                </p>
              </div>
            ) : null}

            {/* Android Manual Guide (Chrome / Samsung Internet) */}
            {(!isInstallable || isAndroid) && !isIOS && (
              <div className="bg-slate-950/60 border border-slate-800/80 rounded-2xl p-4 space-y-3">
                <div className="flex items-center gap-2 text-xs font-bold text-slate-200">
                  <Smartphone className="w-4 h-4 text-emerald-400" />
                  <span>طريقة التثبيت على هواتف الأندرويد (Android APK) :</span>
                </div>
                <ol className="text-xs text-slate-300 space-y-2 list-decimal list-inside pr-1 leading-relaxed">
                  <li>
                    اضغط على <span className="font-bold text-white">خيارات المتصفح (⋮)</span> أعلى الشاشة في Chrome.
                  </li>
                  <li>
                    اختر <span className="font-bold text-red-400">"تثبيت التطبيق"</span> أو <span className="font-bold text-red-400">"Ajouter à l'écran d'accueil"</span>.
                  </li>
                  <li>
                    سيظهر تطبيق <span className="font-bold text-white">FARIOUSY Driver</span> فوراً بأيقونته في شاشة هاتفك مثل أي تطبيق APK عادي.
                  </li>
                </ol>
              </div>
            )}

            {/* iOS Safari Guide */}
            {isIOS && (
              <div className="bg-slate-950/60 border border-slate-800/80 rounded-2xl p-4 space-y-3">
                <div className="flex items-center gap-2 text-xs font-bold text-slate-200">
                  <Share2 className="w-4 h-4 text-blue-400" />
                  <span>طريقة التثبيت على أجهزة iPhone (iOS Safari) :</span>
                </div>
                <ol className="text-xs text-slate-300 space-y-2 list-decimal list-inside pr-1 leading-relaxed">
                  <li>
                    اضغط على زر المشاركة <span className="font-bold text-white font-mono">[Share]</span> أسفل شاشة Safari.
                  </li>
                  <li>
                    انزل لأسفل واضغط على <span className="font-bold text-blue-400">"Sur l'écran d'accueil" (Add to Home Screen)</span>.
                  </li>
                  <li>
                    اضغط على <span className="font-bold text-white">"Ajouter"</span> لتثبيت التطبيق.
                  </li>
                </ol>
              </div>
            )}
          </>
        )}

        {/* Features highlights */}
        <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-800/80 text-center">
          <div className="bg-slate-950/40 p-2.5 rounded-xl border border-slate-800/40">
            <Zap className="w-4 h-4 text-amber-400 mx-auto mb-1" />
            <span className="text-[10px] font-bold text-slate-300 block">سريع وخفيف</span>
          </div>
          <div className="bg-slate-950/40 p-2.5 rounded-xl border border-slate-800/40">
            <ShieldCheck className="w-4 h-4 text-emerald-400 mx-auto mb-1" />
            <span className="text-[10px] font-bold text-slate-300 block">حفظ بدون نت</span>
          </div>
          <div className="bg-slate-950/40 p-2.5 rounded-xl border border-slate-800/40">
            <Sparkles className="w-4 h-4 text-red-400 mx-auto mb-1" />
            <span className="text-[10px] font-bold text-slate-300 block">سكانير كاميرا</span>
          </div>
        </div>

        {/* Close Button */}
        <button
          onClick={onClose}
          className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold transition"
        >
          إغلاق
        </button>
      </div>
    </div>
  );
};
