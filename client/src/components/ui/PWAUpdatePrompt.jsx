import { useEffect, useState } from 'react';
import { RefreshCw, X } from 'lucide-react';
import { useRegisterSW } from 'virtual:pwa-register/react';

export default function PWAUpdatePrompt() {
  const [showPrompt, setShowPrompt] = useState(false);

  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(swUrl, r) {
      console.log('SW Registered:', swUrl);
      // Check for updates every hour
      if (r) {
        setInterval(() => {
          r.update();
        }, 60 * 60 * 1000);
      }
    },
    onRegisterError(error) {
      console.error('SW registration error', error);
    },
  });

  useEffect(() => {
    if (needRefresh) {
      setShowPrompt(true);
    }
  }, [needRefresh]);

  const handleUpdate = () => {
    updateServiceWorker(true);
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    setNeedRefresh(false);
  };

  if (!showPrompt) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-96 z-50">
      <div className="bg-emerald-600 text-white rounded-lg shadow-lg p-4 flex items-center gap-3">
        <RefreshCw className="w-6 h-6 flex-shrink-0 animate-spin-slow" />
        <div className="flex-1">
          <p className="font-medium">Update Available</p>
          <p className="text-sm text-emerald-100">A new version is ready. Refresh to update.</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleUpdate}
            className="px-3 py-1.5 bg-white text-emerald-600 rounded font-medium hover:bg-emerald-50 transition-colors"
          >
            Update
          </button>
          <button
            onClick={handleDismiss}
            className="p-1.5 hover:bg-emerald-500 rounded transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
}
