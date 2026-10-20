import { isElectron } from '../hooks/useEnvironment';

type ApiOptions = {
  method?: string;
  headers?: Record<string, string>;
  body?: any;
};

async function universalFetch(endpoint: string, options: ApiOptions = {}) {
  const { method = 'GET', headers = {}, body } = options;
  
    if (isElectron() && window.electronAPI) {
      // Desktop: proxy through IPC to avoid CORS
      const result = await window.electronAPI.invoke('api-request', {
        endpoint,
        method,
        headers,
        body,
      });
      
      if (!result.ok) {
        throw new Error(result.error || result.data?.message || result.data?.Message || 'API request failed');
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

export const apiClient = {
  // --- Auth ---
  login: (data: any) => universalFetch('/api/auth/login', { method: 'POST', body: data }),
  signup: (data: any) => universalFetch('/api/auth/signup', { method: 'POST', body: data }),
  logout: () => universalFetch('/api/auth/logout', { method: 'POST' }),

  // --- Files ---
  getAllFiles: (token: string, params: string) => 
    universalFetch(`/files?${params}`, { headers: { Authorization: `Bearer ${token}` } }),
    
  deleteFile: (token: string, fileId: string) => 
    universalFetch(`/files/${fileId}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } }),
    
  updateFile: (
    token: string,
    fileId: string,
    updateData: string | { fileName?: string; fileUrl?: string; fileSize?: string; fileType?: string }
  ) => {
    const body = typeof updateData === "string" ? { fileName: updateData } : updateData;
    return universalFetch(`/files/${fileId}`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${token}` },
      body,
    });
  },

  registerLocalFile: (
    token: string,
    data: { fileName: string; fileUrl: string; fileSize?: string; fileType?: string }
  ) =>
    universalFetch('/files/local', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: data,
    }),

  // --- Bookmarks ---
  getAllBookmarks: (token: string) => 
    universalFetch('/api/bookmarks/all', { headers: { Authorization: `Bearer ${token}` } }),
    
  getBookmark: (token: string, fileUrl: string) => 
    universalFetch(`/api/bookmarks?fileUrl=${encodeURIComponent(fileUrl)}`, { headers: { Authorization: `Bearer ${token}` } }),
    
  upsertBookmark: (token: string, data: any) => 
    universalFetch('/api/bookmarks', { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: data }),
    
  deleteBookmark: (token: string, fileUrl: string) => 
    universalFetch(`/api/bookmarks?fileUrl=${encodeURIComponent(fileUrl)}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } }),
};
