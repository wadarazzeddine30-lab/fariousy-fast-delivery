import React from 'react';
import { AlertTriangle, RefreshCw, RotateCcw } from 'lucide-react';

interface ErrorBoundaryProps {
  children: React.ReactNode;
  resetKey?: string | number;
  fallbackTitle?: string;
  compact?: boolean;
}

interface ErrorBoundaryState {
  hasError: boolean;
  errorMessage: string;
}

const EXPENDABLE_CACHE_KEYS = [
  'fariousy_audit_logs_v1',
  'fariousy_notifications_v1',
  'fariousy_partner_logs_v1',
  'fariousy_problem_reports_v1',
  'fariousy_transfer_receipts_v1'
];

function clearExpendableCachesSafely() {
  if (typeof window === 'undefined') return;
  try {
    for (const key of EXPENDABLE_CACHE_KEYS) {
      localStorage.removeItem(key);
    }
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && (k.startsWith('fariousy_driver_cache_') || k.startsWith('fariousy_sb_snapshot_'))) {
        keysToRemove.push(k);
      }
    }
    for (const k of keysToRemove) {
      localStorage.removeItem(k);
    }
  } catch {
    // ignore storage access issues
  }
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      errorMessage: ''
    };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      errorMessage: error?.message || 'Erreur inattendue'
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('[FARIOUSY ErrorBoundary]', error, errorInfo?.componentStack);
    // Proactively free bloated localStorage cache if QuotaExceededError triggered the crash
    const msg = String(error?.message || error?.name || '');
    if (/quota|storage|exceeded/i.test(msg)) {
      clearExpendableCachesSafely();
    }
  }

  componentDidUpdate(prevProps: ErrorBoundaryProps) {
    if (this.state.hasError && prevProps.resetKey !== this.props.resetKey) {
      this.setState({ hasError: false, errorMessage: '' });
    }
  }

  handleRetry = () => {
    clearExpendableCachesSafely();
    this.setState({ hasError: false, errorMessage: '' });
  };

  handleHardReload = () => {
    clearExpendableCachesSafely();
    if (typeof window !== 'undefined') {
      window.location.reload();
    }
  };

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    const { compact, fallbackTitle } = this.props;

    return (
      <div
        dir="rtl"
        className={
          compact
            ? 'w-full my-6 rounded-2xl border border-rose-200 bg-white p-6 shadow-sm text-center'
            : 'min-h-dvh w-full bg-slate-100 flex items-center justify-center p-4'
        }
      >
        <div className={compact ? 'max-w-md mx-auto' : 'max-w-md w-full rounded-2xl border border-rose-200 bg-white p-6 shadow-lg text-center'}>
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-50 border border-rose-200 text-rose-600">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <h2 className="text-base font-extrabold text-slate-900">
            {fallbackTitle || 'وقع خطأ مؤقت فهاد الصفحة'}
          </h2>
          <p className="mt-1.5 text-xs text-slate-600 leading-relaxed">
            تم إيقاف المشكل تلقائياً باش ماتبقاش الشاشة بيضاء. ضغط على «إعادة المحاولة» أو «تحديث التطبيق» باش تكمل خدمتك.
          </p>
          {this.state.errorMessage && (
            <p
              dir="ltr"
              className="mt-3 rounded-xl bg-slate-50 border border-slate-200 px-3 py-2 text-[11px] font-mono text-slate-500 break-words"
            >
              {this.state.errorMessage.slice(0, 180)}
            </p>
          )}
          <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
            <button
              type="button"
              onClick={this.handleRetry}
              className="inline-flex items-center gap-1.5 rounded-xl bg-red-600 hover:bg-red-700 px-4 py-2.5 text-xs font-bold text-white shadow-xs transition cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>إعادة المحاولة</span>
            </button>
            <button
              type="button"
              onClick={this.handleHardReload}
              className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 px-4 py-2.5 text-xs font-bold text-white shadow-xs transition cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>تحديث التطبيق</span>
            </button>
          </div>
        </div>
      </div>
    );
  }
}
