import { isElectron } from '../hooks/useEnvironment';
import { clearAuthSession } from '@/utils/authSession';

export class ApiError extends Error {
  constructor(message: string, public status: number) {
    super(message);
    this.name = "ApiError";
  }
}

export function handleApiFailure(status: number, message: string, authenticated: boolean): never {
  if (status === 401 && authenticated) {
    clearAuthSession();
    if (!window.location.pathname.startsWith("/auth/")) {
      // A full navigation clears mounted readers after authentication expires.
      // This service runs outside React, where router hooks are unavailable.
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      window.location.assign("/auth/login");
    }
  }
  throw new ApiError(message, status);
}

type ApiOptions = {
  method?: string;
  headers?: Record<string, string>;
  body?: any;
};

export class ApiAdapter {
  static async fetch(endpoint: string, options: ApiOptions = {}) {
    const { method = 'GET', headers = {}, body } = options;
    
    if (isElectron() && typeof window !== 'undefined' && (window as any).electronAPI) {
      // Desktop: proxy through IPC to avoid CORS
      const result = await (window as any).electronAPI.invoke('api-request', {
        endpoint,
        method,
        headers,
        body,
      });
      
      if (!result.ok) {
        handleApiFailure(result.status || 0, result.error || result.data?.message || result.data?.Message || 'API request failed', Boolean(headers.Authorization));
      }
      
      return result.data;
    } else {
      // Web: normal fetch
      const baseUrl = (process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:2007').replace(/\/$/, '');
      const response = await fetch(`${baseUrl}${endpoint}`, {
        method,
        signal: AbortSignal.timeout(15000),
        headers: {
          'Content-Type': 'application/json',
          ...headers,
        },
        body: body ? JSON.stringify(body) : undefined,
      });
      
      const data = await response.json().catch(() => null);
      
      if (!response.ok) {
        handleApiFailure(response.status, data?.message || data?.Message || data?.error || 'API request failed', Boolean(headers.Authorization));
      }
      
      return data;
    }
  }
}

export const apiClient = {
  // --- Auth ---
  login: (data: any) => ApiAdapter.fetch('/api/auth/login', { method: 'POST', body: data }),
  signup: (data: any) => ApiAdapter.fetch('/api/auth/signup', { method: 'POST', body: data }),
  googleLogin: (token: string) => ApiAdapter.fetch('/api/auth/google', { method: 'POST', body: { token } }),
  logout: () => ApiAdapter.fetch('/api/auth/logout', { method: 'POST' }),

  // --- Files ---
  getAllFiles: (token: string, params: string) => 
    ApiAdapter.fetch(`/files?${params}`, { headers: { Authorization: `Bearer ${token}` } }),
    
  deleteFile: (token: string, fileId: string) => 
    ApiAdapter.fetch(`/files/${encodeURIComponent(fileId)}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } }),
    
  updateFile: (
    token: string,
    fileId: string,
    updateData: string | { fileName?: string; fileUrl?: string; fileSize?: string; fileType?: string }
  ) => {
    const body = typeof updateData === "string" ? { fileName: updateData } : updateData;
    return ApiAdapter.fetch(`/files/${encodeURIComponent(fileId)}`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${token}` },
      body,
    });
  },

  registerLocalFile: (
    token: string,
    data: { fileName: string; fileUrl: string; fileSize?: string; fileType?: string }
  ) =>
    ApiAdapter.fetch('/files/local', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: data,
    }),

  // --- Bookmarks ---
  getAllBookmarks: (token: string) => 
    ApiAdapter.fetch('/api/bookmarks/all', { headers: { Authorization: `Bearer ${token}` } }),
    
  getBookmark: (token: string, fileUrl: string) => 
    ApiAdapter.fetch(`/api/bookmarks?fileUrl=${encodeURIComponent(fileUrl)}`, { headers: { Authorization: `Bearer ${token}` } }),
    
  upsertBookmark: (token: string, data: any) => 
    ApiAdapter.fetch('/api/bookmarks', { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: data }),
    
  deleteBookmark: (token: string, fileUrl: string) => 
    ApiAdapter.fetch(`/api/bookmarks?fileUrl=${encodeURIComponent(fileUrl)}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } }),
};
