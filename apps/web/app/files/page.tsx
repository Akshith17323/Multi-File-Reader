"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2, BookOpen, AlertCircle, Edit2, AlertTriangle, Link2, RotateCcw, Cloud, HardDrive, ChevronDown } from "lucide-react";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { apiClient } from "@/services/apiClient";
import { isElectron } from "@/hooks/useEnvironment";
import dynamic from "next/dynamic";
import { getLocalLibraryFiles, saveLocalFileToLibrary, removeLocalLibraryFile } from "@/utils/localLibrary";
import { getLastReaderSession, ReaderSessionData } from "@/utils/readerSession";

const FilePreview = dynamic(() => import("@/components/FilePreview"), { ssr: false });

export function isLocalFile(url: string, id?: string): boolean {
  if (id && id.startsWith("local_")) return true;
  if (!url) return false;
  return (
    url.startsWith("mfr-local://") ||
    url.startsWith("file://") ||
    url.startsWith("/") ||
    /^[a-zA-Z]:[\\/]/.test(url)
  );
}

interface FileData {
  name: string;
  url: string;
  id: string;
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
  const [sourceFilter, setSourceFilter] = useState<"" | "cloud" | "local">("");
  const [editingFileId, setEditingFileId] = useState<string | null>(null);
  const [newFileName, setNewFileName] = useState("");
  const [offlineFiles, setOfflineFiles] = useState<
    Record<string, { exists: boolean; path: string; error?: string; readable?: boolean; isLocal?: boolean }>
  >({});

  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [sortBy, setSortBy] = useState("createdAt");
  const [sortOrder, setSortOrder] = useState("desc");
  const [lastSession, setLastSession] = useState<ReaderSessionData | null>(null);

  const router = useRouter();

  useEffect(() => {
    const session = getLastReaderSession();
    if (session && session.fileUrls && session.fileUrls.length > 0) {
      setLastSession(session);
    }
  }, []);

  useEffect(() => {
    setPage(1);
  }, [search, typeFilter, sourceFilter, sortBy, sortOrder]);

  const fetchFiles = async () => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      if (search) params.append("search", search);
      if (typeFilter) params.append("type", typeFilter);

      params.append("page", page.toString());
      params.append("limit", "12");
      params.append("sortBy", sortBy);
      params.append("order", sortOrder);

      const token = localStorage.getItem("token");
      if (!token && !isElectron()) {
        toast.error("Please login to view files");
        router.push("/auth/login");
        setLoading(false);
        return;
      }

      let serverFiles: FileData[] = [];
      let totalP = 1;

      if (token) {
        try {
          const data = await apiClient.getAllFiles(token, params.toString());
          if (data.files && data.pagination) {
            serverFiles = data.files;
            totalP = data.pagination.totalPages;
          } else if (Array.isArray(data)) {
            serverFiles = data;
            totalP = 1;
          }
        } catch (fetchErr) {
          console.warn("Could not fetch cloud files:", fetchErr);
        }
      }

      // Merge with local files stored in library
      const localLibrary = getLocalLibraryFiles();
      let filteredLocal = localLibrary;
      if (search) {
        const s = search.toLowerCase();
        filteredLocal = filteredLocal.filter((f) => f.name.toLowerCase().includes(s));
      }
      if (typeFilter) {
        const typeMap: Record<string, string> = {
          pdf: "application/pdf",
          epub: "application/epub+zip",
          txt: "text/plain",
        };
        const expectedType = typeMap[typeFilter];
        if (expectedType) {
          filteredLocal = filteredLocal.filter((f) => f.metadata.contentType === expectedType);
        }
      }

      const existingUrls = new Set(serverFiles.map((f) => f.url));
      const combined = [...serverFiles];
      for (const loc of filteredLocal) {
        if (!existingUrls.has(loc.url)) {
          combined.push(loc);
        }
      }

      // Filter by Source (Cloud vs Local)
      let finalFiles = combined;
      if (sourceFilter === "cloud") {
        finalFiles = finalFiles.filter((f) => !isLocalFile(f.url, f.id));
      } else if (sourceFilter === "local") {
        finalFiles = finalFiles.filter((f) => isLocalFile(f.url, f.id));
      }

      setFiles(finalFiles);
      setTotalPages(Math.max(totalP, 1));
    } catch (error: unknown) {
      console.error("Error fetching files:", error);
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
  }, [search, typeFilter, sourceFilter, page, sortBy, sortOrder]);

  const handleDelete = async (filename: string, fileId: string) => {
    if (!confirm(`Are you sure you want to delete "${filename}"?`)) return;

    try {
      // Remove from local library persistence
      removeLocalLibraryFile(fileId);
      const targetObj = files.find((f) => f.id === fileId);
      if (targetObj) removeLocalLibraryFile(targetObj.url);

      const token = localStorage.getItem("token");
      if (token && fileId && !fileId.startsWith("local_")) {
        await apiClient.deleteFile(token, fileId);
      }

      toast.success("File deleted successfully");

      // Remove from local state immediately for better UX
      setFiles(prev => prev.filter((f) => f.id !== fileId));

      // Re-fetch to update pagination
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

      // Update local state
      setFiles(prev => prev.map(f =>
        f.id === fileId ? { ...f, name: newFileName.trim() } : f
      ));

      // Reset edit state
      setEditingFileId(null);
      setNewFileName("");

    } catch (error: unknown) {
      console.error("Error renaming file:", error);
      const msg = error instanceof Error ? error.message : "Failed to rename file";
      toast.error(msg);
    }
  };

  const handleRead = (file: FileData) => {
    // Route to unified reader with file URL
    router.push(`/reader?files=${encodeURIComponent(file.url)}&active=0`);
  };

  const handleOpenLocalFile = async () => {
    try {
      const result = await window.electronAPI?.invoke('open-local-file');
      if (result && !result.canceled && result.url) {
        // Save to local library so it persists in the library view!
        await saveLocalFileToLibrary({
          name: result.fileName,
          url: result.url,
          size: result.fileSize,
          contentType: result.fileType
        });
        toast.success(`Opening local file: ${result.fileName}`);
        router.push(`/reader?files=${encodeURIComponent(result.url)}&active=0`);
      } else if (result?.error) {
        toast.error(`Permission/access error: ${result.error}`);
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to open local file');
    }
  };

  // Scan local files for DaVinci Resolve-style Media Offline status
  useEffect(() => {
    if (!isElectron() || !window.electronAPI?.invoke || files.length === 0) return;

    const localFiles = files.filter(
      (f) =>
        f.url.startsWith("mfr-local://") ||
        f.url.startsWith("file://") ||
        f.url.startsWith("/") ||
        /^[a-zA-Z]:[\\/]/.test(f.url)
    );

    if (localFiles.length === 0) return;

    let isMounted = true;
    window.electronAPI
      .invoke("check-local-files-status", localFiles.map((f) => f.url))
      .then((statusMap: Record<string, { exists: boolean; path: string; error?: string }>) => {
        if (isMounted && statusMap) {
          setOfflineFiles((prev) => ({ ...prev, ...statusMap }));
        }
      })
      .catch((err) => console.warn("Failed to check local files status:", err));

    return () => {
      isMounted = false;
    };
  }, [files]);

  const handleRelink = async (file: FileData) => {
    try {
      if (!window.electronAPI?.invoke) {
        toast.info("Relinking is supported in the desktop app");
        return;
      }

      const result = await window.electronAPI.invoke("relink-local-file", {
        oldUrl: file.url,
        originalFileName: file.name,
      });

      if (!result || result.canceled) return;

      if (result.error) {
        toast.error(`Relink failed: ${result.error}`);
        return;
      }

      const newUrl = result.newUrl;
      const newName = result.fileName;
      const newSize = result.fileSize;

      // Migrate bookmarks if any
      const token = localStorage.getItem("token");
      if (token) {
        try {
          const oldBookmark = await apiClient.getBookmark(token, file.url);
          if (oldBookmark) {
            await apiClient.upsertBookmark(token, {
              ...oldBookmark,
              fileUrl: newUrl,
              fileName: newName,
            });
            await apiClient.deleteBookmark(token, file.url).catch(() => null);
          }
        } catch (bErr) {
          console.warn("Could not migrate bookmark on relink:", bErr);
        }

        // Update file record in database if id exists
        if (file.id) {
          try {
            await apiClient.updateFile(token, file.id, {
              fileName: newName,
              fileUrl: newUrl,
              fileSize: newSize,
            });
          } catch (dbErr) {
            console.warn("Could not update file in database:", dbErr);
          }
        }
      }

      // Update local state
      setFiles((prev) =>
        prev.map((f) =>
          f.id === file.id
            ? {
                ...f,
                name: newName,
                url: newUrl,
                metadata: {
                  ...f.metadata,
                  size: newSize || f.metadata.size,
                },
              }
            : f
        )
      );

      // Clear offline state for this file
      setOfflineFiles((prev) => {
        const next = { ...prev };
        delete next[file.url];
        next[newUrl] = { exists: true, isLocal: true, readable: true, path: result.newPath };
        return next;
      });

      toast.success(`Relinked successfully to "${newName}"`);
    } catch (err: any) {
      toast.error(err.message || "Failed to relink file");
    }
  };

  const handleOpenInNewTab = (file: FileData) => {
    // Check if reader is already open by trying to access sessionStorage
    const currentReaderFiles = sessionStorage.getItem("readerFiles");

    if (currentReaderFiles) {
      // Reader is open, append the new file
      const existingUrls = currentReaderFiles.split(",");

      // Check if file is already open
      if (existingUrls.includes(file.url)) {
        toast.info("File is already open");
        // Navigate to reader and set this as active
        const activeIndex = existingUrls.indexOf(file.url);
        const encodedFiles = existingUrls.map(encodeURIComponent).join(",");
        router.push(`/reader?files=${encodedFiles}&active=${activeIndex}`);
        return;
      }

      // Add new file to the list
      const newFilesList = [...existingUrls, file.url].map(encodeURIComponent).join(",");
      const newActiveIndex = existingUrls.length; // New file will be last

      router.push(`/reader?files=${newFilesList}&active=${newActiveIndex}`);
    } else {
      // No reader open, just open this file
      handleRead(file);
    }
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
    <div className="min-h-screen p-8 md:p-12 relative bg-background">
      <ToastContainer position="top-right" theme="light" />

      <div className="max-w-7xl mx-auto">
        {/* Header Section */}
        <div className="flex flex-col md:flex-row justify-between items-end mb-16 gap-8">
          <div className="space-y-1">
            <h1 className="text-3xl md:text-4xl font-extrabold text-foreground tracking-tight">
              My Library
            </h1>
            <p className="text-foreground-muted text-base font-medium">
              Manage your digital collection
            </p>
          </div>

          <div className="flex items-center gap-3">
            {lastSession && lastSession.fileUrls && lastSession.fileUrls.length > 0 && (
              <button
                onClick={() => {
                  const encoded = lastSession.fileUrls.map((url) => encodeURIComponent(url)).join(",");
                  router.push(`/reader?files=${encoded}&active=${lastSession.activeIndex}`);
                }}
                className="group flex items-center gap-2.5 px-6 py-4 bg-primary/10 hover:bg-primary/20 text-primary border border-primary/30 rounded-2xl font-bold text-base transition-all duration-300 shadow-sm hover:shadow-md cursor-pointer"
                title={`Resume reading ${lastSession.fileUrls.length} file${lastSession.fileUrls.length === 1 ? "" : "s"}`}
              >
                <RotateCcw size={18} className="text-primary group-hover:-rotate-45 transition-transform" />
                <span>Resume Reading ({lastSession.fileUrls.length})</span>
              </button>
            )}

            {isElectron() && (
              <button
                onClick={handleOpenLocalFile}
                className="group flex items-center gap-2 px-6 py-4 bg-surface hover:bg-surface-hover text-foreground border border-border-subtle hover:border-primary/50 rounded-2xl font-bold text-base transition-all duration-300 shadow-sm hover:shadow-md cursor-pointer"
                title="Select and read a local file from your disk with full OS permissions"
              >
                <BookOpen size={20} className="text-primary" />
                <span>Open Local File</span>
              </button>
            )}

            <button
              onClick={() => router.push("/fileupload")}
              className="group flex items-center gap-3 px-8 py-4 bg-primary text-white rounded-2xl font-bold text-lg shadow-[0_8px_20px_var(--color-primary-glow)] hover:shadow-[0_12px_25px_var(--color-primary-glow)] hover:-translate-y-1 transition-all duration-300 relative overflow-hidden"
            >
              <div className="absolute inset-0 bg-white/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              <span className="text-2xl font-light leading-none relative z-10">+</span>
              <span className="relative z-10">Upload New</span>
            </button>
          </div>
        </div>

        {/* Controls Bar */}
        <div className="bg-surface backdrop-blur-2xl p-5 rounded-3xl border border-border-subtle shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.2)] mb-12 flex flex-col lg:flex-row gap-4 transition-all duration-300">
          <input
            type="text"
            placeholder="Search by title..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 px-6 py-4 bg-background/50 border border-border-subtle rounded-2xl focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary-glow transition-all text-foreground placeholder-foreground-muted"
          />

          <div className="flex flex-wrap gap-4">
            <div className="relative">
              <select
                value={sourceFilter}
                onChange={(e) => setSourceFilter(e.target.value as any)}
                className="h-full px-8 py-4 bg-background/50 border border-border-subtle rounded-2xl focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary-glow transition-all text-foreground cursor-pointer appearance-none min-w-40"
              >
                <option value="">All Sources</option>
                <option value="cloud">Cloud Storage</option>
                <option value="local">Local Disk</option>
              </select>
              <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-foreground-muted">
                <ChevronDown size={14} />
              </div>
            </div>

            <div className="relative">
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="h-full px-8 py-4 bg-background/50 border border-border-subtle rounded-2xl focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary-glow transition-all text-foreground cursor-pointer appearance-none min-w-40"
              >
                <option value="">All Types</option>
                <option value="pdf">PDF</option>
                <option value="epub">EPUB</option>
              </select>
              <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-foreground-muted">
                <ChevronDown size={14} />
              </div>
            </div>

            <div className="relative">
              <select
                onChange={handleSortChange}
                className="h-full px-8 py-4 bg-background/50 border border-border-subtle rounded-2xl focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary-glow transition-all text-foreground cursor-pointer appearance-none min-w-40"
              >
                <option value="newest">Newest First</option>
                <option value="oldest">Oldest First</option>
                <option value="a-z">Name (A-Z)</option>
                <option value="z-a">Name (Z-A)</option>
              </select>
              <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-foreground-muted">
                <ChevronDown size={14} />
              </div>
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
        ) : files.length === 0 ? (
          <div className="text-center py-32 px-4 rounded-3xl bg-surface border border-border-subtle border-dashed">
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
                className="px-10 py-4 bg-primary text-white hover:bg-primary-hover rounded-xl transition-all font-bold text-lg shadow-xl hover:shadow-2xl hover:-translate-y-1"
              >
                Start Uploading
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8 pb-12">
              {files.map((file) => {
                const isOffline = offlineFiles[file.url]?.exists === false;
                const offlinePath = offlineFiles[file.url]?.path || file.url;
                const isLocal = isLocalFile(file.url, file.id);

                return (
                <div
                  key={file.id}
                  className={`group relative bg-surface backdrop-blur-2xl rounded-3xl overflow-hidden flex flex-col shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.2)] hover:shadow-[0_15px_40px_rgb(0,0,0,0.08)] dark:hover:shadow-[0_15px_40px_rgb(0,0,0,0.4)] hover:-translate-y-2 transition-all duration-500 border ${
                    isOffline ? "border-red-500/50 dark:border-red-500/40" : "border-border-subtle"
                  }`}
                >
                  <div className="aspect-3/4 relative bg-background overflow-hidden group-hover:scale-105 transition-transform duration-500">
                    <div className="w-full h-full">
                      {isOffline ? (
                        <div className="w-full h-full bg-[#121316] relative flex flex-col items-center justify-center p-4 text-center overflow-hidden">
                          {/* DaVinci Resolve Hazard Stripes Pattern */}
                          <div
                            className="absolute inset-0 opacity-15 pointer-events-none"
                            style={{
                              backgroundImage: `repeating-linear-gradient(45deg, #ef4444 0px, #ef4444 12px, transparent 12px, transparent 24px)`,
                            }}
                          />

                          <div className="relative z-10 w-12 h-12 rounded-2xl bg-red-500/20 border border-red-500/40 flex items-center justify-center text-red-500 mb-2 shadow-[0_0_20px_rgba(239,68,68,0.35)]">
                            <AlertTriangle size={24} className="animate-pulse" />
                          </div>

                          <span className="relative z-10 text-[11px] font-black tracking-widest text-red-400 uppercase px-2.5 py-1 rounded bg-red-500/15 border border-red-500/30 mb-2">
                            Media Offline
                          </span>

                          <p
                            className="relative z-10 text-[11px] text-zinc-400 line-clamp-2 max-w-[200px] break-all font-mono mb-4 px-1"
                            title={offlinePath}
                          >
                            {offlinePath.split("/").pop() || "File missing"}
                          </p>

                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRelink(file);
                            }}
                            className="relative z-10 flex items-center gap-1.5 px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-red-600/30 transition-all hover:scale-105 active:scale-95 cursor-pointer"
                            title="Locate and relink this file on disk"
                          >
                            <Link2 size={14} />
                            <span>Relink Media</span>
                          </button>
                        </div>
                      ) : (
                        <FilePreview url={file.url} type={file.metadata.contentType} />
                      )}
                    </div>

                    {/* Top Left: Type Badge or Offline Warning */}
                    <div className="absolute top-4 left-4 z-10">
                      {isOffline ? (
                        <span className="text-xs font-bold px-3 py-1.5 rounded-lg bg-red-600/95 backdrop-blur-md text-white shadow-lg border border-red-400 flex items-center gap-1.5">
                          <AlertCircle size={12} />
                          OFFLINE
                        </span>
                      ) : (
                        <span className="text-xs font-bold px-3 py-1.5 rounded-lg bg-surface-hover/90 backdrop-blur-md text-primary shadow-lg border border-border-subtle">
                          {getFileIcon(file.metadata.contentType)}
                        </span>
                      )}
                    </div>

                    {/* Top Right: Cloud vs Local Storage Badge */}
                    <div className="absolute top-4 right-4 z-10">
                      {isLocal ? (
                        <span
                          className="text-xs font-bold px-2.5 py-1.5 rounded-lg bg-emerald-500/20 backdrop-blur-md text-emerald-400 shadow-lg border border-emerald-500/30 flex items-center gap-1.5"
                          title="Local Disk File"
                        >
                          <HardDrive size={13} className="text-emerald-400" />
                          <span>Local</span>
                        </span>
                      ) : (
                        <span
                          className="text-xs font-bold px-2.5 py-1.5 rounded-lg bg-sky-500/20 backdrop-blur-md text-sky-400 shadow-lg border border-sky-500/30 flex items-center gap-1.5"
                          title="Cloud Stored File"
                        >
                          <Cloud size={13} className="text-sky-400" />
                          <span>Cloud</span>
                        </span>
                      )}
                    </div>

                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center gap-2 p-3">
                      {isOffline ? (
                        <>
                          <button
                            onClick={() => handleRelink(file)}
                            className="bg-red-600 hover:bg-red-500 text-white px-4 py-2 rounded-xl shadow-xl font-bold text-sm flex items-center gap-1.5 transform scale-90 group-hover:scale-100 transition-all duration-300 cursor-pointer"
                          >
                            <Link2 size={16} />
                            Relink
                          </button>
                          <button
                            onClick={() => handleRead(file)}
                            className="bg-white/10 hover:bg-white/20 text-white px-3 py-2 rounded-xl text-xs font-medium border border-white/20 transform scale-90 group-hover:scale-100 transition-all duration-300 cursor-pointer"
                          >
                            Inspect
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            onClick={() => handleRead(file)}
                            className="bg-primary text-white px-4 py-2 rounded-lg shadow-xl transform scale-75 group-hover:scale-100 transition-transform duration-300 font-medium text-sm"
                          >
                            Open
                          </button>
                          <button
                            onClick={() => handleOpenInNewTab(file)}
                            className="bg-blue-600 text-white px-4 py-2 rounded-lg shadow-xl transform scale-75 group-hover:scale-100 transition-transform duration-300 font-medium text-sm"
                          >
                            + New Tab
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="p-5 flex-1 flex flex-col bg-surface">
                    <div className="flex justify-between items-start gap-3">
                      <div className="flex-1 min-w-0">
                        {editingFileId === file.id ? (
                          <div className="space-y-2">
                            <input
                              type="text"
                              value={newFileName}
                              onChange={(e) => setNewFileName(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleRename(file.id);
                                if (e.key === 'Escape') { setEditingFileId(null); setNewFileName(""); }
                              }}
                              className="w-full px-3 py-2 bg-background border border-primary rounded-lg text-foreground text-sm focus:outline-none"
                              autoFocus
                            />
                            <div className="flex gap-2">
                              <button
                                onClick={() => handleRename(file.id)}
                                className="flex-1 px-3 py-1.5 bg-primary hover:bg-primary-hover text-white rounded-lg text-xs font-bold transition-colors"
                              >
                                Save
                              </button>
                              <button
                                onClick={() => { setEditingFileId(null); setNewFileName(""); }}
                                className="flex-1 px-3 py-1.5 bg-border-subtle hover:bg-foreground-muted text-white rounded-lg text-xs font-bold transition-colors"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <h3 className="font-bold text-lg text-foreground line-clamp-1 leading-tight mb-1" title={file.name}>
                              {file.name}
                            </h3>
                            {isOffline ? (
                              <div className="flex items-center justify-between mt-1 text-xs text-red-400 font-medium">
                                <span className="flex items-center gap-1 truncate">
                                  <AlertTriangle size={13} className="shrink-0 text-red-500" />
                                  <span>Missing on disk</span>
                                </span>
                                <button
                                  onClick={() => handleRelink(file)}
                                  className="underline font-bold hover:text-red-300 cursor-pointer ml-2 shrink-0"
                                >
                                  Relink
                                </button>
                              </div>
                            ) : (
                              <div className="text-xs text-foreground-muted flex items-center gap-2 flex-wrap">
                                <span className={`inline-flex items-center gap-1 font-semibold ${isLocal ? "text-emerald-400" : "text-sky-400"}`}>
                                  {isLocal ? <HardDrive size={12} /> : <Cloud size={12} />}
                                  <span>{isLocal ? "Local Disk" : "Cloud"}</span>
                                </span>
                                <span className="w-1 h-1 rounded-full bg-border-subtle" />
                                <span>{file.metadata.size}</span>
                                {file.metadata.updated && (
                                  <>
                                    <span className="w-1 h-1 rounded-full bg-border-subtle" />
                                    <span>{new Date(file.metadata.updated).toLocaleDateString()}</span>
                                  </>
                                )}
                              </div>
                            )}
                          </>
                        )}
                      </div>

                      {editingFileId !== file.id && (
                        <div className="flex gap-2">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingFileId(file.id);
                              setNewFileName(file.name);
                            }}
                            className="text-foreground-muted hover:text-primary transition-colors p-1 shrink-0"
                            title="Rename File"
                          >
                            <Edit2 size={18} />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDelete(file.name, file.id);
                            }}
                            className="text-foreground-muted hover:text-[#ef4444] transition-colors p-1 shrink-0"
                            title="Delete File"
                          >
                            <Trash2 size={18} />
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
              <div className="flex justify-center items-center gap-4 pb-20">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="px-6 py-3 bg-border-subtle text-foreground rounded-xl font-bold disabled:opacity-50 disabled:cursor-not-allowed hover:bg-foreground-muted transition-colors"
                >
                  Previous
                </button>
                <span className="text-foreground-muted font-medium">
                  Page <span className="text-foreground">{page}</span> of <span className="text-foreground">{totalPages}</span>
                </span>
                <button
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="px-6 py-3 bg-border-subtle text-foreground rounded-xl font-bold disabled:opacity-50 disabled:cursor-not-allowed hover:bg-foreground-muted transition-colors"
                >
                  Next
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
