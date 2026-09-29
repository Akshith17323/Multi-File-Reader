export function isElectron(): boolean {
  if (typeof window !== 'undefined' && (window as any).electronAPI) {
    return true;
  }
  return false;
}
