import React, { useMemo, useState } from 'react';
import {
  X,
  Smartphone,
  Download,
  ExternalLink,
  Copy,
  Check,
  CheckCircle2,
  AlertTriangle,
  MessageCircle,
  Sparkles,
  FileArchive,
  Loader2,
  Globe
} from 'lucide-react';
import { buildBrowserZipBlob } from '../../utils/browserZip';

interface DriverApkExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenDriverView?: () => void;
}

export const DriverApkExportModal: React.FC<DriverApkExportModalProps> = ({
  isOpen,
  onClose,
  onOpenDriverView
}) => {
  const defaultDriverUrl = useMemo(() => {
    if (typeof window === 'undefined') return 'https://app.fariousy.com/?app=driver';
    const origin = window.location.origin;
    return `${origin}/?app=driver`;
  }, []);

  const [driverUrl, setDriverUrl] = useState(defaultDriverUrl);
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [isDownloadingZip, setIsDownloadingZip] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [downloadSuccess, setDownloadSuccess] = useState(false);

  if (!isOpen) return null;

  const isInAiStudioFrame =
    typeof window !== 'undefined' &&
    (window.location.hostname.includes('aistudio.google.com') ||
      window.location.hostname === 'localhost' ||
      window.location.hostname === '127.0.0.1');

  const normalizedUrl = (() => {
    const trimmed = driverUrl.trim();
    if (!trimmed) return defaultDriverUrl;
    try {
      const u = new URL(trimmed.startsWith('http') ? trimmed : `https://${trimmed}`);
      if (!u.searchParams.has('app') && !u.searchParams.has('mode')) {
        u.searchParams.set('app', 'driver');
      }
      return u.toString();
    } catch {
      return trimmed;
    }
  })();

  const pwaBuilderUrl = `https://www.pwabuilder.com/reportcard?site=${encodeURIComponent(normalizedUrl)}`;

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(normalizedUrl);
      setCopiedUrl(true);
      setTimeout(() => setCopiedUrl(false), 2500);
    } catch {
      // ignore
    }
  };

  const whatsappShareUrl = `https://wa.me/?text=${encodeURIComponent(
    `السلام عليكم 🚚 هذا رابط تطبيق الموزع FARIOUSY Driver:\n${normalizedUrl}\n\nافتح الرابط في متصفح Chrome على هاتفك واضغط "تثبيت التطبيق" ليظهر كأيقونة APK على الشاشة الرئيسية.`
  )}`;

  const handleDownloadAndroidZip = async () => {
    setIsDownloadingZip(true);
    setDownloadError(null);
    setDownloadSuccess(false);
    try {
      const capacitorConfig = JSON.stringify(
        {
          appId: 'com.fariousy.driver',
          appName: 'FARIOUSY Driver',
          webDir: 'dist',
          bundledWebRuntime: false,
          server: {
            url: normalizedUrl,
            cleartext: false
          },
          android: {
            allowMixedContent: false
          }
        },
        null,
        2
      );

      const readmeContent = `# FARIOUSY Driver — Standalone Capacitor Android APK

This project connects 100% directly to Supabase without any custom backend server.

## Quick Build Steps
1. Install Node.js 18+ and Android Studio.
2. Run:
   npm install
   npm run build
   npx cap add android
   npx cap sync android
   npx cap open android
3. In Android Studio: Build > Build Bundle(s) / APK(s) > Build APK(s).

Configured Web/Driver URL: ${normalizedUrl}
`;

      const manifestSnippet = `<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android" package="com.fariousy.driver">
    <uses-permission android:name="android.permission.INTERNET" />
    <uses-permission android:name="android.permission.CAMERA" />
    <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />
</manifest>
`;

      const blob = buildBrowserZipBlob([
        { path: 'capacitor.config.json', data: capacitorConfig },
        { path: 'README.md', data: readmeContent },
        { path: 'android/app/src/main/AndroidManifest.snippet.xml', data: manifestSnippet }
      ]);

      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = 'FARIOUSY-Driver-Capacitor-APK-Config.zip';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(blobUrl);
      setDownloadSuccess(true);
    } catch (err: any) {
      setDownloadError(err?.message || 'تعذر تحميل مشروع Android APK.');
    } finally {
      setIsDownloadingZip(false);
    }
  };

  return (
    <div
      dir="rtl"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/70 backdrop-blur-xs no-print"
    >
      <div className="bg-white rounded-3xl max-w-2xl w-full shadow-2xl overflow-hidden flex flex-col max-h-[92vh] border border-slate-200">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-slate-950 text-white">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-white p-1.5 shadow-md">
              <img
                src="/pwa-192x192.png"
                alt="FARIOUSY Driver APK"
                className="w-full h-full object-contain rounded-xl"
              />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-black">تصدير تطبيق الموزع للأندرويد (APK)</h3>
                <span className="px-2 py-0.5 bg-red-600 text-white text-[10px] font-black rounded-full">
                  FARIOUSY Driver
                </span>
              </div>
              <p className="text-xs text-slate-400">
                إنشاء ملف APK حقيقي لتوزيعه على الموزعين مع دعم الكاميرا والباركود
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-5 text-slate-800">
          {/* Server URL Config */}
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-2.5">
            <label className="text-xs font-black text-slate-900 flex items-center gap-1.5">
              <Globe className="w-4 h-4 text-red-600" />
              <span>رابط تطبيق الموزع المباشر (Server URL inside APK)</span>
            </label>
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="url"
                dir="ltr"
                value={driverUrl}
                onChange={e => setDriverUrl(e.target.value)}
                placeholder="https://app.fariousy.com/?app=driver"
                className="flex-1 px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-xs font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-red-500"
              />
              <button
                type="button"
                onClick={handleCopyLink}
                className="px-3.5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer shrink-0"
              >
                {copiedUrl ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                <span>{copiedUrl ? 'تم النسخ' : 'نسخ الرابط'}</span>
              </button>
            </div>
            {isInAiStudioFrame && (
              <div className="flex items-start gap-2 text-[11px] text-amber-800 bg-amber-50 border border-amber-200 rounded-xl p-2.5">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <span>
                  ملاحظة مهمة: افتح الرابط المنشور (<strong>Shared App URL</strong> أو دومين{' '}
                  <span className="font-mono">app.fariousy.com</span>) وليس رابط صفحة AI Studio لكي يفتح التطبيق بشاشة كاملة وبدون شريط المعاينة.
                </span>
              </div>
            )}
          </div>

          {/* Readiness Checklist */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
            <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 font-bold flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>أيقونات PNG 512px</span>
            </div>
            <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 font-bold flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>Manifest APK جاهز</span>
            </div>
            <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 font-bold flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>كاميرا السكانير مفعلة</span>
            </div>
            <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 font-bold flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>شاشة دخول للموزع</span>
            </div>
          </div>

          {/* Method 1: Instant APK via PWABuilder */}
          <div className="border-2 border-red-200 bg-gradient-to-br from-red-50/70 to-white rounded-2xl p-4 space-y-3">
            <div className="flex items-start justify-between gap-2">
              <div>
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-red-600 text-white text-[10px] font-black mb-1.5">
                  <Sparkles className="w-3 h-3" />
                  الطريقة الأسرع (30 ثانية بدون كمبيوتر)
                </span>
                <h4 className="text-sm font-black text-slate-900">
                  1. استخراج ملف APK موقع وجاهز عبر PWABuilder
                </h4>
                <p className="text-xs text-slate-600 mt-0.5">
                  تطبيقك الآن مستوفي جميع شروط Android APK (أيقونات PNG + Service Worker + Standalone).
                </p>
              </div>
            </div>

            <ol className="text-xs text-slate-700 space-y-1 list-decimal list-inside bg-white/80 rounded-xl p-3 border border-red-100">
              <li>اضغط على الزر أسفله لفتح <strong>PWABuilder</strong> على رابط تطبيق الموزع الخاص بك.</li>
              <li>اضغط <strong>Package for Stores</strong> ثم اختر <strong>Android</strong> → <strong>Generate Package</strong>.</li>
              <li>حمّل ملف <strong>.apk</strong> وأرسله للموزعين عبر واتساب للتثبيت مباشرة.</li>
            </ol>

            <a
              href={pwaBuilderUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full py-3 px-4 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-black flex items-center justify-center gap-2 shadow-md transition"
            >
              <ExternalLink className="w-4 h-4" />
              <span>إنشاء وتحميل ملف APK الآن عبر PWABuilder</span>
            </a>
          </div>

          {/* Method 2: Native Android Studio / Gradle Project ZIP */}
          <div className="border border-slate-200 bg-slate-50/70 rounded-2xl p-4 space-y-3">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h4 className="text-sm font-black text-slate-900 flex items-center gap-2">
                  <FileArchive className="w-4 h-4 text-slate-800" />
                  <span>2. تحميل سورس مشروع Android APK الكامل (Android Studio / GitHub)</span>
                </h4>
                <p className="text-xs text-slate-600 mt-1">
                  ملف ZIP جاهز يضم كود الأندرويد الأصلي (`com.fariousy.driver`) مع إذن الكاميرا التلقائي للسكانير، فتح واتساب والمكالمات، وأيقونات التطبيق الرسمية.
                </p>
              </div>
            </div>

            {downloadError && (
              <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-xl text-xs font-bold text-rose-700">
                {downloadError}
              </div>
            )}

            {downloadSuccess && (
              <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs font-bold text-emerald-800">
                ✓ تم تحميل المشروع (`FARIOUSY-Driver-Android-APK-Project.zip`). افتحه في Android Studio واضغط Build APK، أو ارفعه على GitHub لبناء الـ APK تلقائياً.
              </div>
            )}

            <button
              type="button"
              disabled={isDownloadingZip}
              onClick={handleDownloadAndroidZip}
              className="w-full py-3 px-4 bg-slate-900 hover:bg-slate-800 disabled:opacity-60 text-white rounded-xl text-xs font-black flex items-center justify-center gap-2 cursor-pointer transition"
            >
              {isDownloadingZip ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>جاري تحضير حزمة الأندرويد...</span>
                </>
              ) : (
                <>
                  <Download className="w-4 h-4 text-emerald-400" />
                  <span>تحميل مشروع Android APK الجاهز (.ZIP)</span>
                </>
              )}
            </button>
          </div>

          {/* Method 3: Share directly via WhatsApp / Open Mobile App */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <a
              href={whatsappShareUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 cursor-pointer"
            >
              <MessageCircle className="w-4 h-4" />
              <span>إرسال رابط التطبيق للموزع (WhatsApp)</span>
            </a>

            <button
              type="button"
              onClick={() => {
                onClose();
                if (onOpenDriverView) {
                  onOpenDriverView();
                } else {
                  window.location.href = '/?app=driver';
                }
              }}
              className="py-2.5 px-4 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 rounded-xl text-xs font-bold flex items-center justify-center gap-2 cursor-pointer"
            >
              <Smartphone className="w-4 h-4 text-amber-600" />
              <span>معاينة تطبيق الموزع الآن</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
