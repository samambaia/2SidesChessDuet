
import React from 'react';
import { cn } from '@/lib/utils';

interface ChessLogoProps {
  className?: string;
  iconOnly?: boolean;
}

export function ChessLogo({ className, iconOnly = false }: ChessLogoProps) {
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <div className="bg-primary p-0.5 rounded-xl shadow-lg shadow-primary/20 flex items-center justify-center overflow-hidden w-11 h-11">
        <img
          src="/icon-192.png"
          alt="2Sides Logo"
          className="w-full h-full object-cover rounded-lg"
        />
      </div>
      {!iconOnly && (
        <div className="flex flex-col leading-none">
          <span className="font-black text-xl tracking-tighter italic">2Sides</span>
          <span className="text-[10px] font-bold uppercase tracking-[0.3em] opacity-60">Chess</span>
        </div>
      )}
    </div>
  );
}
