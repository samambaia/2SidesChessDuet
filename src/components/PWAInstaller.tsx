
"use client";

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Download, X, Award } from 'lucide-react';
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
      alert('To install 2ides Chess:\n\nOn iPhone: Tap "Share" and "Add to Home Screen".\nOn Android: Go to browser options and select "Install App".');
    }
  };

  if (!showPrompt) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 z-[100] animate-in slide-in-from-bottom-full duration-700">
      <div className="bg-primary text-primary-foreground p-6 rounded-[2.5rem] shadow-2xl flex flex-col gap-4 border-4 border-white/20 backdrop-blur-lg">
        <button 
          onClick={() => setShowPrompt(false)}
          className="absolute top-4 right-4 p-1 hover:bg-white/10 rounded-full transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
        
        <div className="flex items-center gap-4">
          <div className="bg-white/20 p-3 rounded-2xl">
            <Award className="w-8 h-8" />
          </div>
          <div className="flex-1">
            <h3 className="font-black uppercase tracking-tight text-lg leading-none italic">Install 2ides Chess</h3>
            <p className="text-[11px] opacity-90 mt-1 font-bold">Experience professional play with our native-like app!</p>
          </div>
        </div>

        <Button 
          onClick={handleInstall}
          variant="secondary" 
          className="w-full h-14 rounded-2xl font-black uppercase tracking-widest text-primary gap-3 shadow-xl active:scale-95 transition-transform"
        >
          <div className="bg-primary/10 p-1 rounded-lg">
            <Download className="w-5 h-5" />
          </div>
          INSTALL NOW
        </Button>
      </div>
    </div>
  );
}
