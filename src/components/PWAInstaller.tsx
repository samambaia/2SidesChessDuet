
'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Download, X, Smartphone } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';

export function PWAInstaller() {
  const isMobile = useIsMobile();
  const [showPrompt, setShowPrompt] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

  useEffect(() => {
    // Detect if already installed/standalone
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches 
      || (window.navigator as any).standalone 
      || document.referrer.includes('android-app://');

    if (isStandalone) return;

    // Listen for Chrome's install prompt
    const handleBeforeInstallPrompt = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
      if (isMobile) setShowPrompt(true);
    };

    // For iOS and general mobile detection if beforeinstallprompt is not supported
    if (isMobile && !isStandalone) {
      setTimeout(() => setShowPrompt(true), 3000);
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
  }, [isMobile]);

  const handleInstall = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setShowPrompt(false);
      }
      setDeferredPrompt(null);
    } else {
      // iOS specific instructions or generic alert
      alert('Para instalar: toque no ícone de compartilhamento e depois em "Adicionar à Tela de Início".');
    }
  };

  if (!showPrompt) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 z-[100] animate-in slide-in-from-bottom-full duration-500">
      <div className="bg-primary text-primary-foreground p-6 rounded-[2rem] shadow-2xl flex flex-col gap-4 border-4 border-white/20 backdrop-blur-lg">
        <button 
          onClick={() => setShowPrompt(false)}
          className="absolute top-4 right-4 p-1 hover:bg-white/10 rounded-full transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
        
        <div className="flex items-center gap-4">
          <div className="bg-white/20 p-3 rounded-2xl">
            <Smartphone className="w-8 h-8" />
          </div>
          <div className="flex-1">
            <h3 className="font-black uppercase tracking-tight text-lg leading-none">Instalar ChessDuet</h3>
            <p className="text-sm opacity-90 mt-1">Adicione à sua tela inicial para jogar com sua filha como um aplicativo real!</p>
          </div>
        </div>

        <Button 
          onClick={handleInstall}
          variant="secondary" 
          className="w-full h-14 rounded-2xl font-black uppercase tracking-widest text-primary gap-3 shadow-xl"
        >
          <Download className="w-5 h-5" />
          Instalar Agora
        </Button>
      </div>
    </div>
  );
}
