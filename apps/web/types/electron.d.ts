export interface ElectronApiResponse<T = any> {
  ok: boolean;
  status?: number;
  data?: T;
  error?: string;
  canceled?: boolean;
}

export interface ElectronAPI {
  invoke: (
    channel:
      | 'get-version'
      | 'api-request'
      | 'select-and-upload-file'
      | 'upload-dropped-file'
      | 'open-local-file'
      | 'check-file-permission'
      | 'check-local-files-status'
      | 'relink-local-file',
    ...args: any[]
  ) => Promise<any>;
  send: (
    channel: 'window-minimize' | 'window-maximize' | 'window-close',
    ...args: any[]
  ) => void;
  on?: (channel: string, func: (...args: any[]) => void) => void;
  removeListener?: (channel: string, func: (...args: any[]) => void) => void;
  getFilePath?: (file: File) => string;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}
