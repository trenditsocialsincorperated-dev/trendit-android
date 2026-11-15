import React, { useState } from 'react';
import { Download, Share, Smartphone, X } from 'lucide-react';
import { usePWAInstall } from '@/hooks/usePWAInstall';

interface PWAInstallButtonProps {
  compact?: boolean;
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({ compact = false }) => {
  const { isInstalled, isIOS, promptInstall } = usePWAInstall();
  const [guideOpen, setGuideOpen] = useState(false);

  if (isInstalled) return null;

  const handleClick = async () => {
    const res = await promptInstall();
    if (res === 'manual') {
      setGuideOpen(true);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        className={
          compact
            ? 'min-h-[40px] px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#141824] hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold text-slate-800 dark:text-slate-200 inline-flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0'
            : 'w-full min-h-[44px] px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#141824] hover:bg-slate-100 dark:hover:bg-slate-800/80 text-sm font-semibold text-slate-800 dark:text-slate-100 flex items-center justify-center gap-2 transition-colors whitespace-nowrap shrink-0'
        }
      >
        <Download className="w-4 h-4 text-violet-500" />
        <span>Install App</span>
      </button>

      {guideOpen && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setGuideOpen(false)}
          className="fixed inset-0 z-[85] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm rounded-3xl bg-white dark:bg-[#121622] border border-slate-200 dark:border-slate-800 p-6 shadow-2xl"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-violet-500/10 text-violet-600 dark:text-violet-400 flex items-center justify-center">
                  <Smartphone className="w-5 h-5" />
                </div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                  Install Trendit
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setGuideOpen(false)}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {isIOS ? (
              <div className="space-y-3 text-sm text-slate-600 dark:text-slate-300">
                <p>Add Trendit directly to your iPhone or iPad Home Screen:</p>
                <ol className="list-decimal list-inside space-y-2">
                  <li>
                    Tap the <strong className="text-slate-900 dark:text-white">Share</strong>{' '}
                    <Share className="w-3.5 h-3.5 inline mx-0.5" /> icon in Safari.
                  </li>
                  <li>
                    Scroll down and select{' '}
                    <strong className="text-slate-900 dark:text-white">Add to Home Screen</strong>.
                  </li>
                </ol>
              </div>
            ) : (
              <div className="space-y-3 text-sm text-slate-600 dark:text-slate-300">
                <p>Add Trendit to your device Home Screen or Desktop:</p>
                <ol className="list-decimal list-inside space-y-2">
                  <li>
                    Open your browser menu (<strong className="text-slate-900 dark:text-white">⋮</strong> in Chrome or Edge).
                  </li>
                  <li>
                    Select <strong className="text-slate-900 dark:text-white">Install app</strong> or{' '}
                    <strong className="text-slate-900 dark:text-white">Add to Home screen</strong>.
                  </li>
                </ol>
              </div>
            )}

            <button
              type="button"
              onClick={() => setGuideOpen(false)}
              className="mt-6 w-full min-h-[44px] rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-semibold text-sm hover:opacity-90 transition-opacity"
            >
              Got it
            </button>
          </div>
        </div>
      )}
    </>
  );
};
