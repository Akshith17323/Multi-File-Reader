import { isElectron } from '../hooks/useEnvironment';

type ApiOptions = {
  method?: string;
  headers?: Record<string, string>;
  body?: any;
};

export class ApiAdapter {
  static async fetch(endpoint: string, options: ApiOptions = {}) {
    const { method = 'GET', headers = {}, body } = options;
    
    if (isElectron()) {
      // Desktop: proxy through IPC to avoid CORS
      const result = await (window as any).electronAPI.invoke('api-request', {
        endpoint,
        method,
        headers,
        body,
      });
      
      if (!result.ok) {
        throw new Error(result.error || result.data?.Message || 'API request failed');
      }
      
      return result.data;
    } else {
      // Web: normal fetch
      const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}${endpoint}`, {
        method,
        headers: {
          'Content-Type': 'application/json',
          ...headers,
        },
        body: body ? JSON.stringify(body) : undefined,
      });
      
      const data = await response.json().catch(() => null);
      
      if (!response.ok) {
        throw new Error(data?.Message || data?.error || 'API request failed');
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
    ApiAdapter.fetch(`/files/${fileId}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } }),
    
  updateFile: (token: string, filename: string, newFilename: string) => 
    ApiAdapter.fetch(`/files/${encodeURIComponent(filename)}`, { 
      method: 'PUT', 
      headers: { Authorization: `Bearer ${token}` },
      body: { newFilename } 
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
