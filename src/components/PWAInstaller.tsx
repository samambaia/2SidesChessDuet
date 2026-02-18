
"use client";

import React, { useState, useEffect } from 'react';
import { Download, X } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';

export function PWAInstaller() {
  const isMobile = useIsMobile();
  const [showPrompt, setShowPrompt] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

  useEffect(() => {
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches 
      || (window.navigator as any).standalone;

    if (isStandalone) return;

    const handleBeforeInstallPrompt = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
      if (isMobile) setShowPrompt(true);
    };

    if (isMobile && !isStandalone) {
      const timer = setTimeout(() => setShowPrompt(true), 1500);
      return () => clearTimeout(timer);
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
  }, [isMobile]);

  const handleInstall = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') setShowPrompt(false);
      setDeferredPrompt(null);
    } else {
      alert('To install 2Sides Chess:\n\nOn iPhone: Tap "Share" and "Add to Home Screen".\nOn Android: Go to browser options and select "Install App".');
    }
  };

  if (!showPrompt) return null;

  return (
    <>
      <style>{`
        @keyframes pwa-slide-up {
          from { opacity: 0; transform: translateY(24px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes pwa-shimmer {
          0%   { background-position: -200% center; }
          100% { background-position: 200% center; }
        }
        .pwa-popup {
          animation: pwa-slide-up 0.45s cubic-bezier(0.22, 1, 0.36, 1) both;
        }
        .pwa-install-btn {
          background: linear-gradient(
            90deg,
            #d97706 0%,
            #f59e0b 30%,
            #fbbf24 50%,
            #f59e0b 70%,
            #d97706 100%
          );
          background-size: 200% auto;
          animation: pwa-shimmer 3s linear infinite;
          transition: transform 0.15s ease, box-shadow 0.15s ease;
        }
        .pwa-install-btn:active {
          transform: scale(0.97);
        }
        .pwa-install-btn:hover {
          box-shadow: 0 0 24px rgba(251, 191, 36, 0.45);
        }
        .pwa-close-btn:hover {
          background: rgba(255,255,255,0.12);
        }
      `}</style>

      <div className="fixed bottom-4 left-4 right-4 z-[100] pwa-popup">
        <div
          style={{
            background: 'linear-gradient(135deg, rgba(15,23,42,0.97) 0%, rgba(30,41,59,0.97) 100%)',
            border: '1px solid rgba(255,255,255,0.10)',
            borderRadius: '20px',
            boxShadow: '0 24px 48px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.04) inset',
            backdropFilter: 'blur(20px)',
            padding: '20px',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
            position: 'relative',
          }}
        >
          {/* Close button */}
          <button
            onClick={() => setShowPrompt(false)}
            className="pwa-close-btn"
            style={{
              position: 'absolute',
              top: '14px',
              right: '14px',
              width: '28px',
              height: '28px',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'rgba(255,255,255,0.5)',
              transition: 'background 0.2s, color 0.2s',
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
            }}
            aria-label="Dismiss"
          >
            <X size={16} />
          </button>

          {/* Header row */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px', paddingRight: '24px' }}>
            {/* Chess icon badge */}
            <div
              style={{
                width: '48px',
                height: '48px',
                borderRadius: '14px',
                background: 'linear-gradient(135deg, #1e3a5f 0%, #2563eb 100%)',
                border: '1px solid rgba(255,255,255,0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                fontSize: '26px',
                lineHeight: 1,
              }}
            >
              ♞
            </div>

            <div>
              <p
                style={{
                  fontFamily: "'Inter', sans-serif",
                  fontWeight: 700,
                  fontSize: '15px',
                  color: '#f8fafc',
                  letterSpacing: '-0.01em',
                  lineHeight: 1.2,
                  margin: 0,
                }}
              >
                Install 2Sides Chess
              </p>
              <p
                style={{
                  fontFamily: "'Inter', sans-serif",
                  fontWeight: 400,
                  fontSize: '12px',
                  color: 'rgba(148,163,184,1)',
                  marginTop: '3px',
                  lineHeight: 1.4,
                }}
              >
                Play offline · No browser needed · Faster experience
              </p>
            </div>
          </div>

          {/* Install button */}
          <button
            onClick={handleInstall}
            className="pwa-install-btn"
            style={{
              width: '100%',
              height: '48px',
              borderRadius: '12px',
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              fontFamily: "'Inter', sans-serif",
              fontWeight: 700,
              fontSize: '13px',
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              color: '#1c1917',
            }}
          >
            <Download size={16} strokeWidth={2.5} />
            Install Now
          </button>
        </div>
      </div>
    </>
  );
}
