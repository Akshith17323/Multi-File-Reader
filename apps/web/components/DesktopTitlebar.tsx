'use client';
import React, { useEffect, useState } from 'react';
import { useEnvironment } from '../hooks/useEnvironment';
import { WindowAdapter } from '../services/windowAdapter';

export default function DesktopTitlebar() {
  const { isElectron } = useEnvironment();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Avoid hydration mismatch by rendering nothing until mounted
  if (!mounted || !isElectron) return null;

  const handleMinimize = () => {
    WindowAdapter.minimize();
  };

  const handleMaximize = () => {
    WindowAdapter.maximize();
  };

  const handleClose = () => {
    WindowAdapter.close();
  };

  return (
    <>
      {/* Spacer to push content down when titlebar is active */}
      <div className="h-8 w-full flex-shrink-0" />
      
      {/* Fixed Titlebar */}
      <div 
        className="flex justify-between items-center h-8 w-full fixed top-0 z-[100] px-3 select-none backdrop-blur-xl bg-surface/80 border-b border-border-subtle"
        style={{ WebkitAppRegion: 'drag' } as any}
      >
        <div className="text-xs font-bold tracking-wider text-foreground-muted flex items-center gap-2">
          <span>MultiReader</span>
        </div>
        <div 
          className="flex space-x-1"
          style={{ WebkitAppRegion: 'no-drag' } as any}
        >
          <button 
            onClick={handleMinimize} 
            className="hover:bg-surface-hover w-7 h-7 flex items-center justify-center rounded transition-colors text-foreground-muted hover:text-foreground"
          >
            ─
          </button>
          <button 
            onClick={handleMaximize} 
            className="hover:bg-surface-hover w-7 h-7 flex items-center justify-center rounded transition-colors text-foreground-muted hover:text-foreground"
          >
            □
          </button>
          <button 
            onClick={handleClose} 
            className="hover:bg-red-500 w-7 h-7 flex items-center justify-center rounded transition-colors hover:text-white text-foreground-muted"
          >
            ✕
          </button>
        </div>
      </div>
    </>
  );
}
