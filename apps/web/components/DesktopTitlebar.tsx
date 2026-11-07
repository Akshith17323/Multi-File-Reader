'use client';

import { useEffect, useState, type CSSProperties } from 'react';
import { Minus, Plus, X } from 'lucide-react';
import { useEnvironment } from '@/hooks/useEnvironment';
import { WindowAdapter } from '@/services/windowAdapter';

export default function DesktopTitlebar() {
  const { isElectron } = useEnvironment();
  const [maximized, setMaximized] = useState(false);
  const nativeControls = isElectron && window.electronAPI?.platform === 'darwin';

  useEffect(() => {
    const root = document.documentElement;
    if (isElectron) root.dataset.desktop = window.electronAPI?.platform || 'desktop';
    else delete root.dataset.desktop;
    return () => { delete root.dataset.desktop; };
  }, [isElectron]);

  useEffect(() => {
    const api = window.electronAPI;
    if (!isElectron || !api) return;
    let active = true;
    const updateState = (state: unknown) => {
      if (active && state && typeof state === 'object' && 'maximized' in state) setMaximized(Boolean(state.maximized));
    };
    const unsubscribe = api.on('window-state-changed', updateState);
    void api.invoke('get-window-state').then(updateState).catch(() => {});
    return () => { active = false; unsubscribe?.(); };
  }, [isElectron]);

  if (!isElectron || nativeControls) return null;

  return (
    <div aria-label="Window controls" className="fixed top-0 left-0 z-[100] flex h-14 w-24 select-none items-center px-4"
      style={{ WebkitAppRegion: 'drag' } as CSSProperties}>
      <div className="group flex items-center gap-2" style={{ WebkitAppRegion: 'no-drag' } as CSSProperties}>
        {[
          { label: 'Close window', action: WindowAdapter.close, color: 'bg-[#ff5f57]', Icon: X },
          { label: 'Minimize window', action: WindowAdapter.minimize, color: 'bg-[#febc2e]', Icon: Minus },
          { label: maximized ? 'Restore window' : 'Maximize window', action: WindowAdapter.maximize, color: 'bg-[#28c840]', Icon: Plus },
        ].map(({ label, action, color, Icon }) => <button key={label} type="button" title={label} aria-label={label} onClick={action}
          className={`flex h-3.5 w-3.5 items-center justify-center rounded-full border border-black/10 ${color}`}>
          <Icon size={10} strokeWidth={2.5} className="text-black/60 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100" />
        </button>)}
      </div>
    </div>
  );
}
