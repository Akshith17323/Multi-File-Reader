'use client';
import React, { useEffect, useState } from 'react';
import { useEnvironment } from '../hooks/useEnvironment';
import { WindowAdapter } from '../services/windowAdapter';

export default function DesktopTitlebar() {
  const { isElectron } = useEnvironment();
  const [mounted, setMounted] = useState(false);
  const [maximized, setMaximized] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    document.documentElement.style.setProperty("--titlebar-height", isElectron ? "32px" : "0px");
    return () => { document.documentElement.style.removeProperty("--titlebar-height"); };
  }, [isElectron]);

  useEffect(() => {
    const api = window.electronAPI;
    if (!isElectron || !api) return;
    let active = true;
    const updateState = (state: unknown) => {
      if (active && state && typeof state === "object" && "maximized" in state) {
        setMaximized(Boolean(state.maximized));
      }
    };
    const unsubscribe = api.on("window-state-changed", updateState);
    void api.invoke("get-window-state").then(updateState).catch(() => {});
    return () => {
      active = false;
      unsubscribe?.();
    };
  }, [isElectron]);

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
        className="flex justify-between items-center h-8 w-full fixed top-0 z-[100] px-3 select-none backdrop-blur-2xl bg-surface/75 border-b border-border-subtle shadow-xs"
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
            type="button"
            title="Minimize window"
            aria-label="Minimize window"
            onClick={handleMinimize} 
            className="hover:bg-surface-hover w-7 h-7 flex items-center justify-center rounded transition-colors text-foreground-muted hover:text-foreground"
          >
            ─
          </button>
          <button 
            type="button"
            title={maximized ? "Restore window" : "Maximize window"}
            aria-label={maximized ? "Restore window" : "Maximize window"}
            onClick={handleMaximize} 
            className="hover:bg-surface-hover w-7 h-7 flex items-center justify-center rounded transition-colors text-foreground-muted hover:text-foreground"
          >
            {maximized ? "❐" : "□"}
          </button>
          <button 
            type="button"
            title="Close window"
            aria-label="Close window"
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
