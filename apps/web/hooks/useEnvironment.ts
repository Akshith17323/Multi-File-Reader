'use client';
import { useState, useEffect } from 'react';

// For non-React files like apiClient.ts
export function isElectron(): boolean {
  if (typeof window !== 'undefined' && (window as any).electronAPI) {
    return true;
  }
  return false;
}

// For React components
export function useEnvironment() {
  const [isElectronState, setIsElectronState] = useState(false);

  useEffect(() => {
    // Check if we are running in Electron by looking for our exposed API
    if (typeof window !== 'undefined' && (window as any).electronAPI) {
      setIsElectronState(true);
    }
  }, []);

  return { isElectron: isElectronState };
}
