export {};
declare global {
  interface Window {
    electronAPI?: {
      backendUrl?: string;
      platform?: string;
      invoke: (channel: string, ...args: unknown[]) => Promise<any>;
      send: (channel: string, ...args: unknown[]) => void;
      on: (channel: string, callback: (...args: unknown[]) => void) => (() => void) | undefined;
      getFilePath?: (file: File) => string;
    };
  }
}
