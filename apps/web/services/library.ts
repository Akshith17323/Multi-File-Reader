import { apiClient } from '@/services/apiClient';
import { isElectron } from '@/hooks/useEnvironment';
import { getLocalLibraryFiles, type LocalFileRecord } from '@/utils/localLibrary';
import { getDocumentUrl, normalizeFileUrl } from '@/utils/fileUrls';

export type LibraryFile = LocalFileRecord & { thumbnailUrl?: string };
interface LibraryQuery { search?: string; type?: string; page: number; limit: number; sortBy?: string; order?: string }

export async function loadLibraryPage(token: string | null, query: LibraryQuery) {
  const local = isElectron() ? getLocalLibraryFiles() : [];
  const params = new URLSearchParams(Object.entries(query).filter(([, value]) => value !== undefined).map(([key, value]) => [key, String(value)]));
  if (token && !local.length) return apiClient.getAllFiles(token, params.toString());
  let cloud: LibraryFile[] = [];
  let warning = '';
  if (token) {
    try {
      // Merge before pagination so local entries never disappear between cloud pages.
      params.set('page', '1'); params.set('limit', '100');
      const first = await apiClient.getAllFiles(token, params.toString());
      cloud = first.files;
      for (let page = 2; page <= first.pagination.totalPages; page += 4) {
        const pages = await Promise.all(Array.from({ length: Math.min(4, first.pagination.totalPages - page + 1) }, (_, index) => {
          const next = new URLSearchParams(params); next.set('page', String(page + index));
          return apiClient.getAllFiles(token, next.toString());
        }));
        cloud.push(...pages.flatMap(result => result.files));
      }
    } catch (error) {
      if (localStorage.getItem('token') !== token) throw error;
      warning = 'Cloud files are unavailable. Your local files are ready to open.';
    }
  }
  const byUrl = new Map<string, LibraryFile>();
  for (const file of [...local, ...cloud]) byUrl.set(getDocumentUrl(file.url), { ...file, url: normalizeFileUrl(file.url) });
  const types: Record<string, string> = { pdf: 'application/pdf', epub: 'application/epub+zip', txt: 'text/plain' };
  const files = [...byUrl.values()].filter(file => file.name.toLowerCase().includes((query.search || '').toLowerCase()) && (!query.type || file.metadata.contentType === types[query.type]));
  files.sort((a, b) => (query.sortBy === 'name' ? a.name.localeCompare(b.name) : Date.parse(a.metadata.updated) - Date.parse(b.metadata.updated)) * (query.order === 'asc' ? 1 : -1));
  const totalPages = Math.max(1, Math.ceil(files.length / query.limit));
  const currentPage = Math.min(query.page, totalPages);
  return { files: files.slice((currentPage - 1) * query.limit, currentPage * query.limit), pagination: { totalPages, currentPage }, warning };
}
