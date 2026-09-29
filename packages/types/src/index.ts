export interface FileData {
  name: string;
  url: string;
  id: string;
  metadata: {
    size: string;
    updated: string;
    contentType: string;
  };
}

export interface Bookmark {
  id: string;
  fileUrl: string;
  fileName: string;
  pageNumber?: number;
  totalPages?: number;
  cfi?: string;
  progress?: number;
  lastRead: string;
}

export interface AuthResponse {
  user: string;
  token: string;
}
