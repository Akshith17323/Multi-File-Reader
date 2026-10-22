import { isElectron } from "@/hooks/useEnvironment";

export class WindowAdapter {
  static minimize() {
    if (isElectron()) {
      (window as any).electronAPI?.send('window-minimize');
    }
  }

  static maximize() {
    if (isElectron()) {
      (window as any).electronAPI?.send('window-maximize');
    }
  }

  static close() {
    if (isElectron()) {
      (window as any).electronAPI?.send('window-close');
    }
  }
}
