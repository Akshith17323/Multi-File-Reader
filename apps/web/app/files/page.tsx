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
  const [sourceFilter, setSourceFilter] = useState<"" | "cloud" | "local">("");
  const [editingFileId, setEditingFileId] = useState<string | null>(null);
  const [newFileName, setNewFileName] = useState("");
  const [offlineFiles, setOfflineFiles] = useState<
    Record<string, { exists: boolean; path: string; error?: string; readable?: boolean; isLocal?: boolean }>
  >({});
  const [fileToDelete, setFileToDelete] = useState<{ id: string; name: string } | null>(null);

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
      params.append("limit", "24");
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

  const handleDelete = (filename: string, fileId: string) => {
    setFileToDelete({ id: fileId, name: filename });
  };

  const confirmDelete = async () => {
    if (!fileToDelete) return;
    const { id: fileId } = fileToDelete;
    setFileToDelete(null);

    try {
      removeLocalLibraryFile(fileId);
      const targetObj = files.find((f) => f.id === fileId);
      if (targetObj) removeLocalLibraryFile(targetObj.url);

      const token = localStorage.getItem("token");
      if (token && fileId && !fileId.startsWith("local_")) {
        await apiClient.deleteFile(token, fileId);
      }

      toast.success("File deleted successfully");
      setFiles(prev => prev.filter((f) => f.id !== fileId));
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

      setFiles(prev => prev.map(f =>
        f.id === fileId ? { ...f, name: newFileName.trim() } : f
      ));

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

  const handleOpenLocalFile = async () => {
    try {
      const result = await (window as any).electronAPI?.invoke('open-local-file');
      if (result && !result.canceled && result.url) {
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
    if (!isElectron() || !(window as any).electronAPI?.invoke || files.length === 0) return;

    const localFiles = files.filter(
      (f) =>
        f.url.startsWith("mfr-local://") ||
        f.url.startsWith("file://") ||
        f.url.startsWith("/") ||
        /^[a-zA-Z]:[\\/]/.test(f.url)
    );

    if (localFiles.length === 0) return;

    let isMounted = true;
    (window as any).electronAPI
      .invoke("check-local-files-status", localFiles.map((f) => f.url))
      .then((statusMap: Record<string, { exists: boolean; path: string; error?: string }>) => {
        if (isMounted && statusMap) {
          setOfflineFiles((prev) => ({ ...prev, ...statusMap }));
        }
      })
      .catch((err: any) => console.warn("Failed to check local files status:", err));

    return () => {
      isMounted = false;
    };
  }, [files]);

  const handleRelink = async (file: FileData) => {
    try {
      if (!(window as any).electronAPI?.invoke) {
        toast.info("Relinking is supported in the desktop app");
        return;
      }

      const result = await (window as any).electronAPI.invoke("relink-local-file", {
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

        if (file.id && !file.id.startsWith("local_")) {
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
      <ToastContainer position="top-right" theme="light" />

      {/* Ambient Glowing Orbs */}
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

          <div className="flex items-center gap-2.5">
            {lastSession && lastSession.fileUrls && lastSession.fileUrls.length > 0 && (
              <button
                onClick={() => {
                  const encoded = lastSession.fileUrls.map((url) => encodeURIComponent(url)).join(",");
                  router.push(`/reader?files=${encoded}&active=${lastSession.activeIndex}`);
                }}
                className="hidden sm:flex items-center gap-2 px-3.5 py-2 bg-primary/10 hover:bg-primary/20 text-primary border border-primary/30 rounded-xl font-bold text-xs transition-all duration-200 shadow-xs cursor-pointer"
                title={`Resume reading ${lastSession.fileUrls.length} file${lastSession.fileUrls.length === 1 ? "" : "s"}`}
              >
                <RotateCcw size={14} className="text-primary" />
                <span>Resume ({lastSession.fileUrls.length})</span>
              </button>
            )}

            {isElectron() && (
              <button
                onClick={handleOpenLocalFile}
                className="flex items-center gap-2 px-3.5 py-2 bg-surface hover:bg-surface-hover text-foreground border border-border-subtle hover:border-primary/50 rounded-xl font-bold text-xs transition-all duration-200 shadow-xs cursor-pointer"
                title="Select and read a local file from your disk"
              >
                <BookOpen size={15} className="text-primary" />
                <span className="hidden sm:inline">Open Local File</span>
                <span className="sm:hidden">Local</span>
              </button>
            )}

            <button
              onClick={() => router.push("/fileupload")}
              className="group flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-xl font-bold text-xs sm:text-sm shadow-[0_4px_15px_var(--color-primary-glow)] hover:shadow-[0_8px_20px_var(--color-primary-glow)] hover:-translate-y-0.5 transition-all duration-200 ease-out relative overflow-hidden shrink-0"
            >
              <div className="absolute inset-0 bg-white/20 opacity-0 group-hover:opacity-100 transition-opacity duration-200 ease-in-out" />
              <span className="text-base font-light leading-none relative z-10">+</span>
              <span className="relative z-10">Upload New</span>
            </button>
          </div>
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

          <div className="flex flex-wrap gap-2">
            <div className="relative">
              <select
                value={sourceFilter}
                onChange={(e) => setSourceFilter(e.target.value as any)}
                className="h-full px-4 pr-8 py-2 bg-surface/60 backdrop-blur-md border border-border-subtle rounded-xl focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary-glow focus:bg-surface/90 transition-all duration-200 text-sm text-foreground cursor-pointer appearance-none min-w-28"
              >
                <option value="">All Sources</option>
                <option value="cloud">Cloud</option>
                <option value="local">Local</option>
              </select>
              <div className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-foreground-muted">
                <ChevronDown size={14} />
              </div>
            </div>

            <div className="relative">
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="h-full px-4 pr-8 py-2 bg-surface/60 backdrop-blur-md border border-border-subtle rounded-xl focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary-glow focus:bg-surface/90 transition-all duration-200 text-sm text-foreground cursor-pointer appearance-none min-w-28"
              >
                <option value="">All Types</option>
                <option value="pdf">PDF</option>
                <option value="epub">EPUB</option>
              </select>
              <div className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-foreground-muted">
                <ChevronDown size={14} />
              </div>
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
              <div className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-foreground-muted">
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
          <div className="text-center py-20 px-4 rounded-3xl bg-surface backdrop-blur-2xl border border-border-subtle border-dashed">
            <BookOpen size={64} className="mx-auto mb-4 text-border-subtle" />
            <h3 className="text-2xl font-bold text-foreground mb-2">
              {search || typeFilter || sourceFilter ? "No files found" : "Your library is empty"}
            </h3>
            <p className="text-foreground-muted text-sm mb-6 max-w-md mx-auto">
              {search || typeFilter || sourceFilter
                ? "Try adjusting your filters or search terms"
                : "Ready to start reading? Upload your first book to begin building your collection."
              }
            </p>
            {!search && !typeFilter && !sourceFilter && (
              <button
                onClick={() => router.push("/fileupload")}
                className="px-6 py-2.5 bg-primary text-white hover:bg-primary-hover rounded-xl font-bold text-sm shadow-[0_4px_15px_var(--color-primary-glow)] hover:-translate-y-0.5 transition-all duration-200"
              >
                Start Uploading
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7 gap-3.5 pb-8">
              {files.map((file) => {
                const isOffline = offlineFiles[file.url]?.exists === false;
                const offlinePath = offlineFiles[file.url]?.path || file.url;
                const isLocal = isLocalFile(file.url, file.id);

                return (
                  <div
                    key={file.id}
                    className={`group relative bg-surface/85 backdrop-blur-2xl rounded-2xl overflow-hidden flex flex-col shadow-sm hover:shadow-lg dark:shadow-[0_4px_20px_rgb(0,0,0,0.3)] hover:-translate-y-1 transition-all duration-300 ease-out border ${
                      isOffline ? "border-red-500/60 dark:border-red-500/50" : "border-border-subtle"
                    }`}
                  >
                    <div className="aspect-[3/4] relative bg-background overflow-hidden group-hover:scale-102 transition-transform duration-300">
                      <div className="w-full h-full">
                        {isOffline ? (
                          <div className="w-full h-full bg-[#121316] relative flex flex-col items-center justify-center p-3 text-center overflow-hidden">
                            <div
                              className="absolute inset-0 opacity-15 pointer-events-none"
                              style={{
                                backgroundImage: `repeating-linear-gradient(45deg, #ef4444 0px, #ef4444 12px, transparent 12px, transparent 24px)`,
                              }}
                            />
                            <div className="relative z-10 w-9 h-9 rounded-xl bg-red-500/20 border border-red-500/40 flex items-center justify-center text-red-500 mb-1.5 shadow-[0_0_15px_rgba(239,68,68,0.35)]">
                              <AlertTriangle size={18} className="animate-pulse" />
                            </div>
                            <span className="relative z-10 text-[9px] font-black tracking-widest text-red-400 uppercase px-2 py-0.5 rounded bg-red-500/15 border border-red-500/30 mb-1">
                              Media Offline
                            </span>
                            <p
                              className="relative z-10 text-[10px] text-zinc-400 line-clamp-1 max-w-[140px] break-all font-mono mb-2 px-1"
                              title={offlinePath}
                            >
                              {offlinePath.split("/").pop() || "File missing"}
                            </p>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleRelink(file);
                              }}
                              className="relative z-10 flex items-center gap-1 px-3 py-1 bg-red-600 hover:bg-red-500 text-white rounded-lg text-[10px] font-bold shadow-md shadow-red-600/30 transition-all hover:scale-105 active:scale-95 cursor-pointer"
                              title="Locate and relink this file on disk"
                            >
                              <Link2 size={12} />
                              <span>Relink</span>
                            </button>
                          </div>
                        ) : (
                          <FilePreview url={file.url} type={file.metadata.contentType} thumbnailUrl={file.thumbnailUrl} />
                        )}
                      </div>

                      {/* Top Left: Type Badge */}
                      <div className="absolute top-2 left-2 z-10">
                        {isOffline ? (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-red-600/95 backdrop-blur-md text-white shadow-sm border border-red-400 flex items-center gap-1">
                            <AlertCircle size={10} />
                            OFFLINE
                          </span>
                        ) : (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-surface-hover/90 backdrop-blur-md text-primary shadow-sm border border-border-subtle">
                            {getFileIcon(file.metadata.contentType)}
                          </span>
                        )}
                      </div>

                      {/* Top Right: Cloud vs Local */}
                      <div className="absolute top-2 right-2 z-10">
                        {isLocal ? (
                          <span
                            className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-emerald-500/20 backdrop-blur-md text-emerald-400 shadow-sm border border-emerald-500/30 flex items-center gap-1"
                            title="Local Disk File"
                          >
                            <HardDrive size={10} />
                            <span>Local</span>
                          </span>
                        ) : (
                          <span
                            className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-sky-500/20 backdrop-blur-md text-sky-400 shadow-sm border border-sky-500/30 flex items-center gap-1"
                            title="Cloud Stored File"
                          >
                            <Cloud size={10} />
                            <span>Cloud</span>
                          </span>
                        )}
                      </div>

                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-200 ease-in-out flex items-center justify-center gap-1.5 p-2">
                        {isOffline ? (
                          <>
                            <button
                              onClick={() => handleRelink(file)}
                              className="bg-red-600 hover:bg-red-500 text-white px-3 py-1.5 rounded-lg shadow-md font-bold text-xs flex items-center gap-1 cursor-pointer"
                            >
                              <Link2 size={13} />
                              Relink
                            </button>
                            <button
                              onClick={() => handleRead(file)}
                              className="bg-white/10 hover:bg-white/20 text-white px-2.5 py-1.5 rounded-lg text-xs font-medium border border-white/20 cursor-pointer"
                            >
                              Inspect
                            </button>
                          </>
                        ) : (
                          <>
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
                          </>
                        )}
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
                              {isOffline ? (
                                <div className="flex items-center justify-between text-[11px] text-red-400 font-medium">
                                  <span className="flex items-center gap-1 truncate">
                                    <AlertTriangle size={11} className="shrink-0 text-red-500" />
                                    <span>Missing</span>
                                  </span>
                                  <button
                                    onClick={() => handleRelink(file)}
                                    className="underline font-bold hover:text-red-300 cursor-pointer ml-1.5 shrink-0"
                                  >
                                    Relink
                                  </button>
                                </div>
                              ) : (
                                <p className="text-[11px] text-foreground-muted flex items-center gap-1.5 truncate">
                                  <span>{file.metadata.size}</span>
                                  {file.metadata.updated && (
                                    <>
                                      <span className="w-1 h-1 rounded-full bg-border-subtle shrink-0" />
                                      <span className="truncate">{new Date(file.metadata.updated).toLocaleDateString()}</span>
                                    </>
                                  )}
                                </p>
                              )}
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
                );
              })}
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
