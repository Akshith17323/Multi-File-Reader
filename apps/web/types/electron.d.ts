export {};
declare global {
  interface Window {
    electronAPI?: {
      invoke: (channel: string, ...args: unknown[]) => Promise<any>;
      send: (channel: string, ...args: unknown[]) => void;
      on: (channel: string, callback: (...args: unknown[]) => void) => void;
      removeListener: (channel: string, callback: (...args: unknown[]) => void) => void;
      getFilePath?: (file: File) => string;
    };
  }
}
