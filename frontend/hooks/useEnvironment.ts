'use client';
import { useState, useEffect } from 'react';

export function useEnvironment() {
  const [isElectron, setIsElectron] = useState(false);

  useEffect(() => {
    // Check if we are running in Electron by looking for our exposed API
    if (typeof window !== 'undefined' && (window as any).electronAPI) {
      setIsElectron(true);
    }
  }, []);

  return { isElectron };
}
