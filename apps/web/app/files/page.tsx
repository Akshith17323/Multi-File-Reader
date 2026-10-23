"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2, BookOpen, AlertCircle, Edit2 } from "lucide-react";
import { toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { apiClient } from "@/services/apiClient";
import dynamic from "next/dynamic";
import { createReaderUrl, getLastReaderSession, removeFileFromReaderSession } from "@/utils/readerSession";
import { getLocalLibraryFiles, removeLocalLibraryFile, updateLocalLibraryFile } from "@/utils/localLibrary";
import { deleteBookmarkUnified, getLocalBookmark, saveLocalBookmark } from "@/utils/localBookmarks";
import { isLocalFileUrl, normalizeFileUrl } from "@/utils/fileUrls";
import { isElectron } from "@/hooks/useEnvironment";

const FilePreview = dynamic(() => import("@/components/FilePreview"), { ssr: false });

interface FileData {
  name: string;
  url: string;
  id: string;
  thumbnailUrl?: string;
  metadata: {
    size: string;
    updated: string;
    contentType: string;
  };
}

export default function FilesPage() {
  const [files, setFiles] = useState<FileData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [editingFileId, setEditingFileId] = useState<string | null>(null);
  const [newFileName, setNewFileName] = useState("");
  const [fileToDelete, setFileToDelete] = useState<{ id: string; name: string } | null>(null);

  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [sortBy, setSortBy] = useState("createdAt");
  const [sortOrder, setSortOrder] = useState("desc");

  const router = useRouter();
  const requestVersion = useRef(0);
  const mutationInFlight = useRef(false);
  const [mutating, setMutating] = useState(false);

  useEffect(() => {
    setPage(1);
  }, [search, typeFilter, sortBy, sortOrder]);

  const fetchFiles = async () => {
    const version = ++requestVersion.current;
    setLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem("token");
      if (!token && !isElectron()) { router.replace("/auth/login"); return; }
      if (!token) {
        const localFiles = getLocalLibraryFiles().filter(file => file.name.toLowerCase().includes(search.toLowerCase()) && (!typeFilter || file.metadata.contentType.includes(typeFilter === "txt" ? "text/plain" : typeFilter)));
        localFiles.sort((a, b) => (sortBy === "name" ? a.name.localeCompare(b.name) : Date.parse(a.metadata.updated) - Date.parse(b.metadata.updated)) * (sortOrder === "asc" ? 1 : -1));
        const pages = Math.max(1, Math.ceil(localFiles.length / 24));
        const currentPage = Math.min(page, pages);
        setTotalPages(pages);
        setPage(currentPage);
        setFiles(localFiles.slice((currentPage - 1) * 24, currentPage * 24));
        return;
      }
      const params = new URLSearchParams({ page: String(page), limit: "24", sortBy, order: sortOrder });
      if (search) params.set("search", search);
      if (typeFilter) params.set("type", typeFilter);
      const data = await apiClient.getAllFiles(token, params.toString());
      if (version !== requestVersion.current) return;
      if (!Array.isArray(data?.files)) throw new Error("Invalid file list returned by server");
      setFiles(data.files.map((file: FileData) => ({ ...file, url: normalizeFileUrl(file.url) })));
      setTotalPages(Math.max(1, data.pagination?.totalPages || 1));
      if (data.pagination?.currentPage && data.pagination.currentPage !== page) setPage(data.pagination.currentPage);
    } catch (error) {
      if (version === requestVersion.current) setError(error instanceof Error ? error.message : "Failed to load files");
    } finally {
      if (version === requestVersion.current) setLoading(false);
    }
  };

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      fetchFiles();
    }, 500);
    const requests = requestVersion;
    return () => { clearTimeout(timeoutId); requests.current++; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, typeFilter, page, sortBy, sortOrder]);

  const handleDelete = (filename: string, fileId: string) => {
    setFileToDelete({ id: fileId, name: filename });
  };

  const confirmDelete = async () => {
    if (!fileToDelete || mutationInFlight.current) return;
    mutationInFlight.current = true;
    setMutating(true);
    const deletingFile = files.find(file => file.id === fileToDelete.id);
    setFileToDelete(null);
    try {
      const token = localStorage.getItem("token");
      if (!token && !isElectron()) throw new Error("Please sign in again");
      if (deletingFile) {
        if (token && !deletingFile.id.startsWith("local_")) await apiClient.deleteFile(token, deletingFile.id);
        removeLocalLibraryFile(deletingFile.url);
        await deleteBookmarkUnified(token, deletingFile.url);
        removeFileFromReaderSession(deletingFile.url);
        setFiles(prev => prev.filter(file => file.id !== deletingFile.id));
        await fetchFiles();
        toast.success("File deleted successfully");
      }
    } catch (error) { toast.error(error instanceof Error ? error.message : "Could not delete file"); }
    finally { mutationInFlight.current = false; setMutating(false); }
  };

  const handleRename = async (fileId: string) => {
    if (mutationInFlight.current) return;
    if (!newFileName.trim()) { toast.error("File name cannot be empty"); return; }
    mutationInFlight.current = true;
    setMutating(true);
    try {
      const token = localStorage.getItem("token");
      if (!token && !isElectron()) throw new Error("Please sign in again");
      const original = files.find(file => file.id === fileId)!;
      const extension = original.name.includes(".") ? original.name.slice(original.name.lastIndexOf(".")) : "";
      const requestedName = newFileName.trim().toLowerCase().endsWith(extension.toLowerCase()) ? newFileName.trim() : newFileName.trim() + extension;
      const result = token && !fileId.startsWith("local_") ? await apiClient.updateFile(token, fileId, requestedName) : null;
      const name = result?.file?.fileName || requestedName;
      updateLocalLibraryFile(original.url, { name });
      const bookmark = getLocalBookmark(original.url);
      if (bookmark) saveLocalBookmark({ ...bookmark, fileName: name }, true);
      setFiles(prev => prev.map(file => file.id === fileId ? { ...file, name } : file));
      setEditingFileId(null);
      setNewFileName("");
      toast.success("File renamed successfully");
    } catch (error) { toast.error(error instanceof Error ? error.message : "Could not rename file"); }
    finally { mutationInFlight.current = false; setMutating(false); }
  };

  const handleRead = (file: FileData) => {
    if (isLocalFileUrl(file.url) && !isElectron()) { toast.info("Open this local file in the desktop app."); return; }
    router.push(createReaderUrl([file.url]));
  };

  const handleOpenInNewTab = (file: FileData) => {
    if (isLocalFileUrl(file.url) && !isElectron()) { toast.info("Open this local file in the desktop app."); return; }
    const urls = getLastReaderSession()?.fileUrls || [];
    const existing = urls.indexOf(file.url);
    if (existing >= 0) router.push(createReaderUrl(urls, existing));
    else router.push(createReaderUrl([...urls, file.url], urls.length));
  };

  const getFileIcon = (type: string) => {
    if (type === "application/pdf") return "PDF";
    if (type === "application/epub+zip") return "EPUB";
    return "DOC";
  };

  const handleSortChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    if (value === "newest") { setSortBy("createdAt"); setSortOrder("desc"); }
    else if (value === "oldest") { setSortBy("createdAt"); setSortOrder("asc"); }
    else if (value === "a-z") { setSortBy("name"); setSortOrder("asc"); }
    else if (value === "z-a") { setSortBy("name"); setSortOrder("desc"); }
  };

  return (
    <div className="min-h-screen px-4 sm:px-6 lg:px-8 py-4 sm:py-6 relative bg-background overflow-hidden">

      {/* Ambient Glowing Orbs for Glassmorphism Depth */}
      <div className="absolute top-20 left-10 w-96 h-96 bg-primary/10 rounded-full blur-3xl pointer-events-none -z-0" />
      <div className="absolute top-1/3 right-10 w-[500px] h-[500px] bg-purple-600/10 rounded-full blur-3xl pointer-events-none -z-0" />
      <div className="absolute bottom-20 left-1/3 w-[600px] h-[600px] bg-blue-500/10 rounded-full blur-3xl pointer-events-none -z-0" />

      <div className="w-full max-w-[1700px] mx-auto relative z-10">
        {/* Header Section */}
        <div className="flex flex-row justify-between items-center mb-5 gap-4">
          <div className="space-y-0.5">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-foreground tracking-tight">
              My Library
            </h1>
            <p className="text-foreground-muted text-xs sm:text-sm font-medium">
              Manage your digital collection
            </p>
          </div>

          <button
            onClick={() => router.push("/fileupload")}
            className="group flex items-center gap-2 px-5 py-2.5 bg-primary text-white rounded-xl font-bold text-sm shadow-[0_4px_15px_var(--color-primary-glow)] hover:shadow-[0_8px_20px_var(--color-primary-glow)] hover:-translate-y-0.5 transition-all duration-300 ease-out relative overflow-hidden shrink-0"
          >
            <div className="absolute inset-0 bg-white/20 opacity-100 sm:opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity duration-300 ease-in-out" />
            <span className="text-lg font-light leading-none relative z-10">+</span>
            <span className="relative z-10">Upload New</span>
          </button>
        </div>

        {/* Controls Bar */}
        <div className="bg-surface/80 backdrop-blur-2xl p-2.5 rounded-2xl border border-border-subtle shadow-[0_4px_20px_rgb(0,0,0,0.03)] dark:shadow-[0_4px_20px_rgb(0,0,0,0.2)] mb-5 flex flex-col md:flex-row gap-2.5 transition-all duration-300">
          <input
            type="text"
            placeholder="Search by title..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 px-4 py-2 bg-surface/60 backdrop-blur-md border border-border-subtle rounded-xl focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary-glow focus:bg-surface/90 transition-all duration-200 text-sm text-foreground placeholder-foreground-muted"
          />

          <div className="flex gap-2">
            <div className="relative">
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="h-full px-4 pr-8 py-2 bg-surface/60 backdrop-blur-md border border-border-subtle rounded-xl focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary-glow focus:bg-surface/90 transition-all duration-200 text-sm text-foreground cursor-pointer appearance-none min-w-28"
              >
                <option value="">All Types</option>
                <option value="pdf">PDF</option>
                <option value="epub">EPUB</option>
                <option value="txt">TXT</option>
              </select>
              <div className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-foreground-muted text-xs">▼</div>
            </div>

            <div className="relative">
              <select
                onChange={handleSortChange}
                className="h-full px-4 pr-8 py-2 bg-surface/60 backdrop-blur-md border border-border-subtle rounded-xl focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary-glow focus:bg-surface/90 transition-all duration-200 text-sm text-foreground cursor-pointer appearance-none min-w-32"
              >
                <option value="newest">Newest First</option>
                <option value="oldest">Oldest First</option>
                <option value="a-z">Name (A-Z)</option>
                <option value="z-a">Name (Z-A)</option>
              </select>
              <div className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-foreground-muted text-xs">▼</div>
            </div>
          </div>
        </div>

        {/* Error State */}
        {error && !loading && (
          <div className="bg-red-500/10 border border-red-500/50 rounded-2xl p-6 mb-8 flex items-center gap-4">
            <AlertCircle className="text-red-500 shrink-0" size={24} />
            <div>
              <h3 className="text-red-500 font-bold mb-1">Error Loading Files</h3>
              <p className="text-red-400 text-sm">{error}</p>
              <button
                onClick={fetchFiles}
                className="mt-3 text-sm text-red-400 hover:text-red-300 underline"
              >
                Try Again
              </button>
            </div>
          </div>
        )}

        {/* Loading State */}
        {loading ? (
          <div className="flex justify-center items-center h-96">
            <div className="relative">
              <div className="w-16 h-16 border-4 border-border-subtle border-t-primary rounded-full animate-spin"></div>
            </div>
          </div>
        ) : error ? null : files.length === 0 ? (
          <div className="text-center py-32 px-4 rounded-3xl bg-surface backdrop-blur-2xl border border-border-subtle border-dashed">
            <BookOpen size={80} className="mx-auto mb-6 text-border-subtle" />
            <h3 className="text-3xl font-bold text-foreground mb-3">
              {search || typeFilter ? "No files found" : "Your library is empty"}
            </h3>
            <p className="text-foreground-muted text-lg mb-10 max-w-md mx-auto">
              {search || typeFilter
                ? "Try adjusting your filters or search terms"
                : "Ready to start reading? Upload your first book to begin building your collection."
              }
            </p>
            {!search && !typeFilter && (
              <button
                onClick={() => router.push("/fileupload")}
                className="px-10 py-4 bg-primary text-white hover:bg-primary-hover rounded-xl font-bold text-lg shadow-[0_8px_20px_var(--color-primary-glow)] hover:shadow-[0_12px_25px_var(--color-primary-glow)] hover:-translate-y-1 transition-all duration-500 ease-out"
              >
                Start Uploading
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7 gap-3.5 pb-8">
              {files.map((file) => (
                <div
                  key={file.id}
                  className="group relative bg-surface/85 backdrop-blur-2xl rounded-2xl overflow-hidden flex flex-col shadow-sm hover:shadow-lg dark:shadow-[0_4px_20px_rgb(0,0,0,0.3)] hover:-translate-y-1 transition-all duration-300 ease-out border border-border-subtle"
                >
                  <div className="aspect-[3/4] relative bg-background overflow-hidden group-hover:scale-102 transition-transform duration-300">
                    <div className="w-full h-full">
                      <FilePreview url={file.url} type={file.metadata.contentType} thumbnailUrl={file.thumbnailUrl} />
                    </div>

                    <div className="absolute top-2 left-2 z-10">
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-surface-hover/90 backdrop-blur-md text-primary shadow-sm border border-border-subtle">
                        {getFileIcon(file.metadata.contentType)}
                      </span>
                    </div>

                    <div className="absolute inset-0 bg-black/40 opacity-100 sm:opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity duration-200 ease-in-out flex items-center justify-center gap-1.5 p-2">
                      <button
                        onClick={() => handleRead(file)}
                        className="bg-primary/95 text-white border border-white/20 px-3 py-1.5 rounded-lg shadow-md transform scale-90 group-hover:scale-100 transition-all duration-200 hover:bg-primary font-semibold text-xs"
                      >
                        Open
                      </button>
                      <button
                        onClick={() => handleOpenInNewTab(file)}
                        className="bg-blue-600/95 text-white border border-white/20 px-2.5 py-1.5 rounded-lg shadow-md transform scale-90 group-hover:scale-100 transition-all duration-200 hover:bg-blue-600 font-semibold text-xs"
                      >
                        + Tab
                      </button>
                    </div>
                  </div>

                  <div className="p-3 flex-1 flex flex-col bg-surface/80 backdrop-blur-md">
                    <div className="flex justify-between items-start gap-1.5">
                      <div className="flex-1 min-w-0">
                        {editingFileId === file.id ? (
                          <div className="space-y-1.5">
                            <input
                              type="text"
                              value={newFileName}
                              onChange={(e) => setNewFileName(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleRename(file.id);
                                if (e.key === 'Escape') { setEditingFileId(null); setNewFileName(""); }
                              }}
                              className="w-full px-2 py-1 bg-background border border-primary rounded text-foreground text-xs focus:outline-none"
                              autoFocus
                            />
                            <div className="flex gap-1.5">
                              <button
                                disabled={mutating}
                                  onClick={() => handleRename(file.id)}
                                className="flex-1 px-2 py-1 bg-primary hover:bg-primary-hover text-white rounded text-[10px] font-bold transition-all"
                              >
                                Save
                              </button>
                              <button
                                onClick={() => { setEditingFileId(null); setNewFileName(""); }}
                                className="flex-1 px-2 py-1 bg-border-subtle hover:bg-foreground-muted text-white rounded text-[10px] font-bold transition-all"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <h3 className="font-bold text-xs sm:text-sm text-foreground line-clamp-1 leading-tight mb-0.5" title={file.name}>
                              {file.name}
                            </h3>
                            <p className="text-[11px] text-foreground-muted flex items-center gap-1.5 truncate">
                              <span>{file.metadata.size}</span>
                              {file.metadata.updated && (
                                <>
                                  <span className="w-1 h-1 rounded-full bg-border-subtle shrink-0" />
                                  <span className="truncate">{new Date(file.metadata.updated).toLocaleDateString()}</span>
                                </>
                              )}
                            </p>
                          </>
                        )}
                      </div>

                      {editingFileId !== file.id && (
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingFileId(file.id);
                              setNewFileName(file.name);
                            }}
                            className="text-foreground-muted hover:text-primary transition-colors p-1"
                            title="Rename File"
                          >
                            <Edit2 size={13} />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDelete(file.name, file.id);
                            }}
                            className="text-foreground-muted hover:text-[#ef4444] transition-colors p-1"
                            title="Delete File"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="flex justify-center items-center gap-3 pb-8">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="px-4 py-1.5 bg-surface/80 backdrop-blur-xl border border-border-subtle text-foreground rounded-xl text-xs font-semibold disabled:opacity-40 disabled:cursor-not-allowed hover:bg-surface-hover hover:border-primary/40 shadow-sm transition-all"
                >
                  Previous
                </button>
                <div className="px-3.5 py-1.5 bg-surface/70 backdrop-blur-xl border border-border-subtle rounded-xl text-foreground-muted text-xs font-medium shadow-sm">
                  Page <span className="text-foreground font-bold">{page}</span> of <span className="text-foreground font-bold">{totalPages}</span>
                </div>
                <button
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="px-4 py-1.5 bg-surface/80 backdrop-blur-xl border border-border-subtle text-foreground rounded-xl text-xs font-semibold disabled:opacity-40 disabled:cursor-not-allowed hover:bg-surface-hover hover:border-primary/40 shadow-sm transition-all"
                >
                  Next
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Glassmorphic Delete Confirmation Modal */}
      {fileToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-surface/90 backdrop-blur-2xl border border-border-subtle rounded-2xl p-5 max-w-sm w-full shadow-2xl animate-in zoom-in-95 duration-200 space-y-4">
            <div className="w-10 h-10 rounded-xl bg-red-500/10 border border-red-500/20 text-red-500 flex items-center justify-center">
              <Trash2 size={20} />
            </div>
            <div>
              <h3 className="text-lg font-bold text-foreground mb-1">Delete File</h3>
              <p className="text-foreground-muted text-xs">
                Are you sure you want to delete <span className="font-semibold text-foreground">&quot;{fileToDelete.name}&quot;</span>? This action cannot be undone.
              </p>
            </div>
            <div className="flex gap-2.5 pt-1">
              <button
                onClick={() => setFileToDelete(null)}
                className="flex-1 py-2 px-3 bg-surface-hover/80 hover:bg-surface-hover text-foreground font-semibold text-xs rounded-xl border border-border-subtle transition-all duration-200"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                className="flex-1 py-2 px-3 bg-red-600 hover:bg-red-700 text-white font-semibold text-xs rounded-xl shadow-md hover:shadow-red-600/30 transition-all duration-200"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
