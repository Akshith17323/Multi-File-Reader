"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2, BookOpen, AlertCircle, Edit2, ChevronDown, Search, FileText, Layers, Upload, Monitor, Cloud, FolderOpen } from "lucide-react";
import { toast } from "react-toastify";
import AppShell, { PageHeader } from "@/components/ui/AppShell";
import { apiClient } from "@/services/apiClient";
import dynamic from "next/dynamic";
import { createReaderUrl, getLastReaderSession, removeFileFromReaderSession } from "@/utils/readerSession";
import { removeLocalLibraryFile, updateLocalLibraryFile } from "@/utils/localLibrary";
import { deleteBookmarkUnified, getLocalBookmark, saveLocalBookmark } from "@/utils/localBookmarks";
import { isLocalFileUrl, normalizeFileUrl } from "@/utils/fileUrls";
import { FileAdapter } from "@/services/fileAdapter";
import { loadLibraryPage } from "@/services/library";
import { useEnvironment } from "@/hooks/useEnvironment";
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
  const { isElectron: isDesktop } = useEnvironment();
  const [openingLocal, setOpeningLocal] = useState(false);
  const localPickerBusy = useRef(false);
  const [warning, setWarning] = useState("");
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
      const data = await loadLibraryPage(token, { page, limit: 24, sortBy, order: sortOrder, search, type: typeFilter });
      if (version !== requestVersion.current) return;
      if (!Array.isArray(data?.files)) throw new Error("Invalid file list returned by server");
      setWarning(data.warning || "");
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

  const openLocal = async (folder = false) => {
    if (localPickerBusy.current) return;
    localPickerBusy.current = true; setOpeningLocal(true);
    try {
      const result = await FileAdapter.openLocalFiles(folder);
      if (!result) return;
      if (!result.files.length) toast.info("No readable PDF, EPUB, or TXT files found.");
      else { await fetchFiles(); toast.success(`${result.files.length} local ${result.files.length === 1 ? 'file' : 'files'} added`); }
      if (result.skipped) toast.info(`${result.skipped} files or folders could not be read.`);
    } catch (error) { toast.error(error instanceof Error ? error.message : "Could not open local files"); }
    finally { localPickerBusy.current = false; setOpeningLocal(false); }
  };

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

  const getFileBadge = (type: string) => {
    return {
      label: type === "application/pdf" ? "PDF" : type === "application/epub+zip" ? "EPUB" : "TXT",
      color: "text-foreground",
      bg: "bg-surface-hover/95 border-border-subtle",
    };
  };

  const handleSortChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    if (value === "newest") { setSortBy("createdAt"); setSortOrder("desc"); }
    else if (value === "oldest") { setSortBy("createdAt"); setSortOrder("asc"); }
    else if (value === "a-z") { setSortBy("name"); setSortOrder("asc"); }
    else if (value === "z-a") { setSortBy("name"); setSortOrder("desc"); }
  };

  return (
    <AppShell contentClassName="space-y-7">
        <PageHeader
          eyebrow="Digital library"
          title="My"
          accent="Collection"
          description="Browse, search, and continue reading your documents."
          action={<div className="flex flex-wrap gap-2">
            {isDesktop && <>
              <button disabled={openingLocal} onClick={() => openLocal()} className="mfr-button-primary"><Monitor size={16} />{openingLocal ? 'Opening…' : 'Open local files'}</button>
              <button disabled={openingLocal} onClick={() => openLocal(true)} className="mfr-button-secondary"><FolderOpen size={16} />Open folder</button>
            </>}
            <button onClick={() => router.push("/fileupload")} className={isDesktop ? "mfr-button-secondary" : "mfr-button-primary"}><Upload size={16} />{isDesktop ? 'Add files' : 'Upload files'}</button>
          </div>}
        />

        {/* Controls Bar (Glassmorphic Card) */}
        <div className="mfr-panel p-3 sm:p-4 rounded-2xl shadow-sm flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-foreground-muted pointer-events-none" />
            <input
              type="search"
              aria-label="Search library by title"
              placeholder="Search by title..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="mfr-input pl-10"
            />
          </div>

          <div className="flex flex-wrap gap-2.5">
            <div className="relative">
              <select
                aria-label="Filter by file format"
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="mfr-input pr-8 font-semibold cursor-pointer appearance-none min-w-28"
              >
                <option value="">All Formats</option>
                <option value="pdf">PDF</option>
                <option value="epub">EPUB</option>
                <option value="txt">TXT</option>
              </select>
              <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-foreground-muted pointer-events-none" />
            </div>

            <div className="relative">
              <select
                aria-label="Sort files"
                onChange={handleSortChange}
                className="mfr-input pr-8 font-semibold cursor-pointer appearance-none min-w-32"
              >
                <option value="newest">Newest First</option>
                <option value="oldest">Oldest First</option>
                <option value="a-z">Name (A-Z)</option>
                <option value="z-a">Name (Z-A)</option>
              </select>
              <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-foreground-muted pointer-events-none" />
            </div>
          </div>
        </div>

        {warning && <p role="status" className="text-sm text-foreground-muted">{warning}</p>}

        {/* Error State */}
        {error && !loading && (
          <div className="bg-foreground/10 border border-foreground/30 rounded-2xl p-4 sm:p-5 flex items-start gap-3 text-xs sm:text-sm">
            <AlertCircle className="text-foreground shrink-0 mt-0.5" size={20} />
            <div className="flex-1">
              <h3 className="text-foreground font-bold mb-0.5">Error Loading Collection</h3>
              <p className="text-foreground font-medium">{error}</p>
              <button
                onClick={fetchFiles}
                className="mt-2 text-xs text-foreground hover:text-foreground underline font-semibold cursor-pointer"
              >
                Try Again
              </button>
            </div>
          </div>
        )}

        {/* Loading State */}
        {loading ? (
          <div className="flex justify-center items-center h-80">
            <div className="relative">
              <div className="w-12 h-12 border-3 border-border-subtle border-t-primary rounded-full animate-spin" />
            </div>
          </div>
        ) : error ? null : files.length === 0 ? (
          /* Empty State (Styled with Landing Page Showcase) */
          <div className="mfr-panel text-center py-12 px-6 rounded-3xl shadow-sm space-y-6">
            <div className="flex h-16 w-16 mx-auto items-center justify-center rounded-2xl bg-primary/10 text-primary border border-primary/20 shadow-inner">
              <BookOpen size={30} />
            </div>

            <div className="space-y-2">
              <h3 className="text-2xl font-extrabold text-foreground tracking-tight">
                {search || typeFilter ? "No matching files" : "Your library is ready"}
              </h3>
              <p className="text-foreground-muted text-xs sm:text-sm max-w-md mx-auto leading-relaxed">
                {search || typeFilter
                  ? "Try clearing your search query or format filter to discover your documents."
                  : isDesktop ? "Open local files or a folder to start your library." : "Upload your first PDF, EPUB, or TXT file and keep all your reading in one place."}
              </p>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 max-w-lg mx-auto pt-2">
              <div className="flex items-center gap-2 rounded-xl bg-surface-hover/65 border border-border-subtle p-2.5 text-left">
                <FileText size={16} className="text-foreground shrink-0" />
                <span className="text-xs font-bold text-foreground">PDF</span>
              </div>
              <div className="flex items-center gap-2 rounded-xl bg-surface-hover/65 border border-border-subtle p-2.5 text-left">
                <BookOpen size={16} className="text-foreground shrink-0" />
                <span className="text-xs font-bold text-foreground">EPUB</span>
              </div>
              <div className="flex items-center gap-2 rounded-xl bg-surface-hover/65 border border-border-subtle p-2.5 text-left">
                <FileText size={16} className="text-foreground shrink-0" />
                <span className="text-xs font-bold text-foreground">TXT</span>
              </div>
              <div className="flex items-center gap-2 rounded-xl bg-surface-hover/65 border border-border-subtle p-2.5 text-left">
                <Layers size={16} className="text-foreground shrink-0" />
                <span className="text-xs font-bold text-foreground">Multi-Tab</span>
              </div>
            </div>

            <div className="pt-2">
              <button
                onClick={() => router.push("/fileupload")}
                className="mfr-button-primary overflow-hidden group"
              >
                <span className="relative z-10">{isDesktop ? "Add your first files" : "Upload your first file"}</span>
                <div className="absolute inset-0 bg-white/20 opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* File Cards Grid */}
            <div className="grid grid-cols-1 min-[420px]:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5 pb-4">
              {files.map((file) => {
                const badge = getFileBadge(file.metadata.contentType);

                return (
                  <div
                    key={file.id}
                    className="mfr-panel group relative rounded-2xl overflow-hidden flex flex-col shadow-sm hover:shadow-xl hover:border-primary/40 transition-all duration-300 hover:-translate-y-1"
                  >
                    {/* Cover Preview Area */}
                    <div className="aspect-[3/4] relative bg-background overflow-hidden group-hover:scale-102 transition-transform duration-300">
                      <div className="w-full h-full">
                        <FilePreview url={file.url} type={file.metadata.contentType} thumbnailUrl={file.thumbnailUrl} />
                      </div>

                      <span title={isLocalFileUrl(file.url) ? "Local file · on your computer" : "Cloud file"}
                        className="absolute right-2 top-2 z-10 flex h-8 w-8 items-center justify-center rounded-full border border-border-subtle bg-surface-hover/90 text-foreground shadow-sm backdrop-blur-md">
                        {isLocalFileUrl(file.url) ? <Monitor size={16} aria-hidden="true" /> : <Cloud size={16} aria-hidden="true" />}
                        <span className="sr-only">{isLocalFileUrl(file.url) ? 'Local file' : 'Cloud file'}</span>
                      </span>
                      {/* Format Badge */}
                      <div className="absolute top-2 left-2 z-10">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md backdrop-blur-md shadow-xs border ${badge.bg} ${badge.color}`}>
                          {badge.label}
                        </span>
                      </div>

                      {/* Hover Overlay with Quick Actions */}
                      <div className="absolute inset-x-0 bottom-0 bg-surface/80 backdrop-blur-xl opacity-100 sm:opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity duration-200 flex items-center justify-center gap-1.5 p-3">
                        <button
                          onClick={() => handleRead(file)}
                          className="bg-primary hover:bg-primary-hover text-on-primary px-3 py-1.5 rounded-xl shadow-md transform scale-90 group-hover:scale-100 transition-all duration-200 font-bold text-xs cursor-pointer"
                        >
                          Open
                        </button>
                        <button
                          onClick={() => handleOpenInNewTab(file)}
                          className="bg-surface/90 hover:bg-surface text-foreground border border-border-subtle px-2.5 py-1.5 rounded-xl shadow-md transform scale-90 group-hover:scale-100 transition-all duration-200 font-bold text-xs cursor-pointer"
                        >
                          + Tab
                        </button>
                      </div>
                    </div>

                    {/* Card Footer Info */}
                    <div className="p-3 flex-1 flex flex-col justify-between bg-surface/60 backdrop-blur-md">
                      <div className="flex justify-between items-start gap-1.5">
                        <div className="flex-1 min-w-0">
                          {editingFileId === file.id ? (
                            <div className="space-y-1.5">
                              <input
                                type="text"
                                value={newFileName}
                                onChange={(e) => setNewFileName(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") handleRename(file.id);
                                  if (e.key === "Escape") {
                                    setEditingFileId(null);
                                    setNewFileName("");
                                  }
                                }}
                                className="w-full px-2 py-1 bg-background border border-primary rounded-lg text-foreground text-xs focus:outline-none"
                                autoFocus
                              />
                              <div className="flex gap-1.5">
                                <button
                                  disabled={mutating}
                                  onClick={() => handleRename(file.id)}
                                  className="flex-1 px-2 py-1 bg-primary hover:bg-primary-hover text-on-primary rounded-md text-[10px] font-bold transition-all"
                                >
                                  Save
                                </button>
                                <button
                                  onClick={() => {
                                    setEditingFileId(null);
                                    setNewFileName("");
                                  }}
                                  className="flex-1 px-2 py-1 bg-border-subtle text-foreground rounded-md text-[10px] font-bold transition-all"
                                >
                                  Cancel
                                </button>
                              </div>
                            </div>
                          ) : (
                            <>
                              <h3
                                className="font-bold text-xs sm:text-sm text-foreground line-clamp-1 leading-tight mb-0.5 group-hover:text-primary transition-colors"
                                title={file.name}
                              >
                                {file.name}
                              </h3>
                              <p className="text-[11px] text-foreground-muted flex items-center gap-1.5 truncate">
                                <span>{file.metadata.size}</span>
                                {file.metadata.updated && (
                                  <>
                                    <span className="w-1 h-1 rounded-full bg-border-subtle shrink-0" />
                                    <span className="truncate">
                                      {new Date(file.metadata.updated).toLocaleDateString()}
                                    </span>
                                  </>
                                )}
                              </p>
                            </>
                          )}
                        </div>

                        {editingFileId !== file.id && (
                          <div className="flex items-center gap-0.5 shrink-0">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setEditingFileId(file.id);
                                setNewFileName(file.name);
                              }}
                              className="text-foreground-muted hover:text-primary transition-colors p-1 rounded-md hover:bg-surface-hover"
                              title="Rename File"
                            >
                              <Edit2 size={13} />
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDelete(file.name, file.id);
                              }}
                              className="text-foreground-muted hover:text-foreground transition-colors p-1 rounded-md hover:bg-foreground/10"
                              title="Delete File"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="flex justify-center items-center gap-3 pb-8">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="px-4 py-1.5 bg-surface/75 backdrop-blur-xl border border-border-subtle text-foreground rounded-xl text-xs font-semibold disabled:opacity-40 disabled:cursor-not-allowed hover:bg-surface-hover hover:border-primary/40 shadow-xs transition-all"
                >
                  Previous
                </button>
                <div className="px-3.5 py-1.5 bg-surface/75 backdrop-blur-xl border border-border-subtle rounded-xl text-foreground-muted text-xs font-medium shadow-xs">
                  Page <span className="text-foreground font-bold">{page}</span> of{" "}
                  <span className="text-foreground font-bold">{totalPages}</span>
                </div>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="px-4 py-1.5 bg-surface/75 backdrop-blur-xl border border-border-subtle text-foreground rounded-xl text-xs font-semibold disabled:opacity-40 disabled:cursor-not-allowed hover:bg-surface-hover hover:border-primary/40 shadow-xs transition-all"
                >
                  Next
                </button>
              </div>
            )}
          </>
        )}
      {/* Glassmorphic Delete Confirmation Modal */}
      {fileToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-surface/90 backdrop-blur-2xl border border-border-subtle rounded-3xl p-6 max-w-sm w-full shadow-2xl animate-in zoom-in-95 duration-200 space-y-4">
            <div className="w-11 h-11 rounded-2xl bg-foreground/10 border border-foreground/20 text-foreground flex items-center justify-center">
              <Trash2 size={22} />
            </div>
            <div>
              <h3 className="text-lg font-bold text-foreground mb-1">Delete Document</h3>
              <p className="text-foreground-muted text-xs leading-relaxed">
                Are you sure you want to delete{" "}
                <span className="font-semibold text-foreground">&quot;{fileToDelete.name}&quot;</span>? This action cannot be undone.
              </p>
            </div>
            <div className="flex gap-2.5 pt-1">
              <button
                onClick={() => setFileToDelete(null)}
                className="flex-1 py-2 px-3 bg-surface-hover/80 hover:bg-surface-hover text-foreground font-semibold text-xs rounded-xl border border-border-subtle transition-all duration-200 cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                className="flex-1 py-2 px-3 bg-primary hover:bg-primary text-on-primary font-semibold text-xs rounded-xl shadow-md hover:shadow-foreground/30 transition-all duration-200 cursor-pointer"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
