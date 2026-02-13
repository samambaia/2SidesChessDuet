
import React from 'react';
import { cn } from '@/lib/utils';

interface ChessLogoProps {
  className?: string;
  iconOnly?: boolean;
}

export function ChessLogo({ className, iconOnly = false }: ChessLogoProps) {
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div className="bg-primary p-2 rounded-xl shadow-lg shadow-primary/20">
        <svg 
          viewBox="0 0 24 24" 
          className="h-6 w-6 text-primary-foreground fill-current"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path d="M19,22H5V20H19V22M17,10C17,11.05 17,12.11 17,13.17C17,14.24 16.34,15.19 15.33,15.58C14.33,15.97 13.24,15.72 12.5,15C11.76,15.72 10.67,15.97 9.67,15.58C8.66,15.19 8,14.24 8,13.17C8,12.11 8,11.05 8,10C8,8.15 9.17,6.5 10.82,5.77C10.45,4.71 10.74,3.53 11.58,2.79C12.42,2.05 13.63,1.91 14.61,2.43C15.59,2.95 16.14,4.02 16,5.1V5.1C16.6,5.36 17,6 17,6.67V10M15,10V7H13V10H15M11,10V8H9V10H11M15,13V12H9V13C9,13.55 9.45,14 10,14H14C14.55,14 15,13.55 15,13Z" />
        </svg>
      </div>
      {!iconOnly && <span className="font-bold text-xl tracking-tight">ChessDuet</span>}
    </div>
  );
}
