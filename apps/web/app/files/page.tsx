"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2, BookOpen, AlertCircle, Edit2, Sparkles, ChevronDown, Search, FileText, Layers, BookmarkCheck } from "lucide-react";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { apiClient } from "@/services/apiClient";
import dynamic from "next/dynamic";

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

  useEffect(() => {
    setPage(1);
  }, [search, typeFilter, sortBy, sortOrder]);

  const fetchFiles = async () => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      if (search) params.append("search", search);
      if (typeFilter) params.append("type", typeFilter);

      params.append("page", page.toString());
      params.append("limit", "24");
      params.append("sortBy", sortBy);
      params.append("order", sortOrder);

      const token = localStorage.getItem("token");
      if (!token) {
        toast.error("Please login to view files");
        router.push("/auth/login");
        setLoading(false);
        return;
      }

      const data = await apiClient.getAllFiles(token, params.toString());

      if (data.files && data.pagination) {
        setFiles(data.files);
        setTotalPages(data.pagination.totalPages);
      } else if (Array.isArray(data)) {
        setFiles(data);
        setTotalPages(1);
      } else {
        throw new Error("Invalid response format from server");
      }
    } catch (error: unknown) {
      console.error("❌ Error fetching files:", error);
      const msg = error instanceof Error ? error.message : "Failed to load files";
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      fetchFiles();
    }, 500);
    return () => clearTimeout(timeoutId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, typeFilter, page, sortBy, sortOrder]);

  const handleDelete = (filename: string, fileId: string) => {
    setFileToDelete({ id: fileId, name: filename });
  };

  const confirmDelete = async () => {
    if (!fileToDelete) return;
    const { id: fileId } = fileToDelete;
    setFileToDelete(null);

    try {
      const token = localStorage.getItem("token");
      if (token) {
        await apiClient.deleteFile(token, fileId);
      }

      toast.success("File deleted successfully");
      setFiles((prev) => prev.filter((f) => f.id !== fileId));
      setTimeout(() => fetchFiles(), 500);
    } catch (error: unknown) {
      console.error("Error deleting file:", error);
      const msg = error instanceof Error ? error.message : "Failed to delete file";
      toast.error(msg);
    }
  };

  const handleRename = async (fileId: string) => {
    if (!newFileName.trim()) {
      toast.error("File name cannot be empty");
      return;
    }

    try {
      const token = localStorage.getItem("token");
      if (!token) {
        toast.error("Please login");
        return;
      }

      await apiClient.updateFile(token, fileId, newFileName.trim());
      toast.success("File renamed successfully");

      setFiles((prev) =>
        prev.map((f) => (f.id === fileId ? { ...f, name: newFileName.trim() } : f))
      );

      setEditingFileId(null);
      setNewFileName("");
    } catch (error: unknown) {
      console.error("Error renaming file:", error);
      const msg = error instanceof Error ? error.message : "Failed to rename file";
      toast.error(msg);
    }
  };

  const handleRead = (file: FileData) => {
    router.push(`/reader?files=${encodeURIComponent(file.url)}&active=0`);
  };

  const handleOpenInNewTab = (file: FileData) => {
    const currentReaderFiles = sessionStorage.getItem("readerFiles");

    if (currentReaderFiles) {
      const existingUrls = currentReaderFiles.split(",");

      if (existingUrls.includes(file.url)) {
        toast.info("File is already open");
        const activeIndex = existingUrls.indexOf(file.url);
        const encodedFiles = existingUrls.map(encodeURIComponent).join(",");
        router.push(`/reader?files=${encodedFiles}&active=${activeIndex}`);
        return;
      }

      const newFilesList = [...existingUrls, file.url].map(encodeURIComponent).join(",");
      const newActiveIndex = existingUrls.length;
      router.push(`/reader?files=${newFilesList}&active=${newActiveIndex}`);
    } else {
      handleRead(file);
    }
  };

  const getFileBadge = (type: string) => {
    if (type === "application/pdf") return { label: "PDF", color: "text-red-500", bg: "bg-red-500/10 border-red-500/20" };
    if (type === "application/epub+zip") return { label: "EPUB", color: "text-emerald-500", bg: "bg-emerald-500/10 border-emerald-500/20" };
    return { label: "TXT", color: "text-sky-500", bg: "bg-sky-500/10 border-sky-500/20" };
  };

  const handleSortChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    if (value === "newest") {
      setSortBy("createdAt");
      setSortOrder("desc");
    } else if (value === "oldest") {
      setSortBy("createdAt");
      setSortOrder("asc");
    } else if (value === "a-z") {
      setSortBy("name");
      setSortOrder("asc");
    } else if (value === "z-a") {
      setSortBy("name");
      setSortOrder("desc");
    }
  };

  return (
    <div className="min-h-screen px-4 sm:px-6 lg:px-8 py-5 sm:py-7 relative bg-background overflow-hidden">
      <ToastContainer position="top-right" theme="light" />

      {/* Ambient Blurred Glowing Orbs for Glassmorphism Depth (Matching Landing Page) */}
      <div className="absolute top-1/4 left-10 w-80 h-80 bg-primary/15 rounded-full blur-3xl pointer-events-none -z-0" />
      <div className="absolute bottom-1/4 right-10 w-[400px] h-[400px] bg-purple-600/15 rounded-full blur-3xl pointer-events-none -z-0" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-blue-500/10 rounded-full blur-3xl pointer-events-none -z-0" />

      <div className="w-full max-w-[1600px] mx-auto relative z-10 space-y-6">
        {/* Header Section */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-surface/80 backdrop-blur-2xl border border-border-subtle shadow-xs">
              <Sparkles size={14} className="text-primary animate-pulse" />
              <span className="text-[11px] font-bold uppercase tracking-wider text-foreground-muted">
                Digital Library
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight text-foreground leading-tight">
              My{" "}
              <span className="bg-clip-text text-transparent bg-linear-to-r from-primary via-purple-500 to-blue-500 drop-shadow-[0_0_12px_var(--color-primary-glow)]">
                Collection
              </span>
            </h1>
            <p className="text-foreground-muted text-xs sm:text-sm font-medium">
              Browse, search, and continue reading your documents
            </p>
          </div>

          <button
            onClick={() => router.push("/fileupload")}
            className="group relative overflow-hidden px-5 py-2.5 bg-primary text-white rounded-xl font-bold text-sm shadow-[0_4px_15px_var(--color-primary-glow)] hover:shadow-[0_8px_20px_var(--color-primary-glow)] hover:-translate-y-0.5 transition-all duration-200 shrink-0 flex items-center gap-2"
          >
            <div className="absolute inset-0 bg-white/20 opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
            <span className="text-lg font-light leading-none relative z-10">+</span>
            <span className="relative z-10">Upload New</span>
          </button>
        </div>

        {/* Controls Bar (Glassmorphic Card) */}
        <div className="bg-surface/75 backdrop-blur-2xl p-3 sm:p-4 rounded-2xl sm:rounded-3xl border border-border-subtle shadow-sm flex flex-col md:flex-row gap-3 transition-all duration-200">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-foreground-muted pointer-events-none" />
            <input
              type="text"
              placeholder="Search by title..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-surface-hover/65 backdrop-blur-md border border-border-subtle rounded-xl focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary-glow transition-all duration-200 text-sm text-foreground placeholder-foreground-muted"
            />
          </div>

          <div className="flex flex-wrap gap-2.5">
            <div className="relative">
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="h-full pl-3.5 pr-8 py-2 bg-surface-hover/65 backdrop-blur-md border border-border-subtle rounded-xl focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary-glow transition-all duration-200 text-xs sm:text-sm font-semibold text-foreground cursor-pointer appearance-none min-w-28"
              >
                <option value="">All Formats</option>
                <option value="pdf">PDF</option>
                <option value="epub">EPUB</option>
              </select>
              <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-foreground-muted pointer-events-none" />
            </div>

            <div className="relative">
              <select
                onChange={handleSortChange}
                className="h-full pl-3.5 pr-8 py-2 bg-surface-hover/65 backdrop-blur-md border border-border-subtle rounded-xl focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary-glow transition-all duration-200 text-xs sm:text-sm font-semibold text-foreground cursor-pointer appearance-none min-w-32"
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

        {/* Error State */}
        {error && !loading && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-4 sm:p-5 flex items-start gap-3 text-xs sm:text-sm">
            <AlertCircle className="text-red-500 shrink-0 mt-0.5" size={20} />
            <div className="flex-1">
              <h3 className="text-red-500 font-bold mb-0.5">Error Loading Collection</h3>
              <p className="text-red-400 font-medium">{error}</p>
              <button
                onClick={fetchFiles}
                className="mt-2 text-xs text-red-400 hover:text-red-300 underline font-semibold cursor-pointer"
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
        ) : files.length === 0 ? (
          /* Empty State (Styled with Landing Page Showcase) */
          <div className="text-center py-16 px-6 rounded-3xl bg-surface/75 backdrop-blur-2xl border border-border-subtle shadow-xl max-w-2xl mx-auto space-y-6">
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
                  : "Upload your first PDF, EPUB, or TXT file to start reading with smooth view transitions."}
              </p>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 max-w-lg mx-auto pt-2">
              <div className="flex items-center gap-2 rounded-xl bg-surface-hover/65 border border-border-subtle p-2.5 text-left">
                <FileText size={16} className="text-red-500 shrink-0" />
                <span className="text-xs font-bold text-foreground">PDF</span>
              </div>
              <div className="flex items-center gap-2 rounded-xl bg-surface-hover/65 border border-border-subtle p-2.5 text-left">
                <BookOpen size={16} className="text-emerald-500 shrink-0" />
                <span className="text-xs font-bold text-foreground">EPUB</span>
              </div>
              <div className="flex items-center gap-2 rounded-xl bg-surface-hover/65 border border-border-subtle p-2.5 text-left">
                <FileText size={16} className="text-sky-500 shrink-0" />
                <span className="text-xs font-bold text-foreground">TXT</span>
              </div>
              <div className="flex items-center gap-2 rounded-xl bg-surface-hover/65 border border-border-subtle p-2.5 text-left">
                <Layers size={16} className="text-purple-500 shrink-0" />
                <span className="text-xs font-bold text-foreground">Multi-Tab</span>
              </div>
            </div>

            <div className="pt-2">
              <button
                onClick={() => router.push("/fileupload")}
                className="relative overflow-hidden px-7 py-3 bg-primary text-white rounded-xl font-bold text-sm shadow-[0_4px_15px_var(--color-primary-glow)] hover:shadow-[0_8px_20px_var(--color-primary-glow)] hover:-translate-y-0.5 transition-all duration-200 group inline-flex items-center gap-2"
              >
                <span className="relative z-10">Upload Your First File</span>
                <div className="absolute inset-0 bg-white/20 opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* File Cards Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7 gap-3.5 pb-8">
              {files.map((file) => {
                const badge = getFileBadge(file.metadata.contentType);

                return (
                  <div
                    key={file.id}
                    className="group relative bg-surface/75 backdrop-blur-2xl rounded-2xl overflow-hidden flex flex-col shadow-sm hover:shadow-xl hover:border-primary/40 transition-all duration-300 ease-out border border-border-subtle hover:-translate-y-1"
                  >
                    {/* Cover Preview Area */}
                    <div className="aspect-[3/4] relative bg-background overflow-hidden group-hover:scale-102 transition-transform duration-300">
                      <div className="w-full h-full">
                        <FilePreview url={file.url} type={file.metadata.contentType} thumbnailUrl={file.thumbnailUrl} />
                      </div>

                      {/* Format Badge */}
                      <div className="absolute top-2 left-2 z-10">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md backdrop-blur-md shadow-xs border ${badge.bg} ${badge.color}`}>
                          {badge.label}
                        </span>
                      </div>

                      {/* Hover Overlay with Quick Actions */}
                      <div className="absolute inset-0 bg-black/50 backdrop-blur-[2px] opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center gap-1.5 p-2">
                        <button
                          onClick={() => handleRead(file)}
                          className="bg-primary hover:bg-primary-hover text-white px-3 py-1.5 rounded-xl shadow-md transform scale-90 group-hover:scale-100 transition-all duration-200 font-bold text-xs cursor-pointer"
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
                                  onClick={() => handleRename(file.id)}
                                  className="flex-1 px-2 py-1 bg-primary hover:bg-primary-hover text-white rounded-md text-[10px] font-bold transition-all"
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
                              className="text-foreground-muted hover:text-red-500 transition-colors p-1 rounded-md hover:bg-red-500/10"
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
      </div>

      {/* Glassmorphic Delete Confirmation Modal */}
      {fileToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-surface/90 backdrop-blur-2xl border border-border-subtle rounded-3xl p-6 max-w-sm w-full shadow-2xl animate-in zoom-in-95 duration-200 space-y-4">
            <div className="w-11 h-11 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-500 flex items-center justify-center">
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
                className="flex-1 py-2 px-3 bg-red-600 hover:bg-red-700 text-white font-semibold text-xs rounded-xl shadow-md hover:shadow-red-600/30 transition-all duration-200 cursor-pointer"
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
