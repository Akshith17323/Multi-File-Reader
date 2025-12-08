"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { FileText, Trash2, BookOpen, Loader2, AlertCircle, Edit2 } from "lucide-react";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import dynamic from "next/dynamic";

const FilePreview = dynamic(() => import("@/components/FilePreview"), { ssr: false });

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
  const [editingFileId, setEditingFileId] = useState<string | null>(null);
  const [newFileName, setNewFileName] = useState("");

  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [sortBy, setSortBy] = useState("createdAt");
  const [sortOrder, setSortOrder] = useState("desc");

  const router = useRouter();

  useEffect(() => {
    setPage(1);
  }, [search, typeFilter, sortBy, sortOrder]);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      fetchFiles();
    }, 500);
    return () => clearTimeout(timeoutId);
  }, [search, typeFilter, page, sortBy, sortOrder]);

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
      if (!token) {
        toast.error("Please login to view files");
        router.push("/auth/login");
        setLoading(false);
        return;
      }

      const res = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/files?${params.toString()}`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      if (res.status === 401) {
        toast.error("Session expired, please login again");
        router.push("/auth/login");
        return;
      }

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || `Server error: ${res.status}`);
      }

      const data = await res.json();

      // Handle paginated response
      if (data.files && data.pagination) {
        setFiles(data.files);
        setTotalPages(data.pagination.totalPages);
      }
      // Fallback for non-paginated response (backward compatibility)
      else if (Array.isArray(data)) {
        setFiles(data);
        setTotalPages(1);
      }
      else {
        throw new Error('Invalid response format from server');
      }

    } catch (error: any) {
      console.error("❌ Error fetching files:", error);
      setError(error.message || "Failed to load files");
      toast.error(error.message || "Failed to load files");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (filename: string, fileId: string) => {
    if (!confirm(`Are you sure you want to delete "${filename}"?`)) return;

    try {
      const token = localStorage.getItem("token");
      if (!token) {
        toast.error("Please login");
        return;
      }

      const res = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/files/${encodeURIComponent(filename)}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ error: 'Delete failed' }));
        throw new Error(errorData.error || "Failed to delete file");
      }

      toast.success("File deleted successfully");

      // Remove from local state immediately for better UX
      setFiles(prev => prev.filter((f) => f.id !== fileId));

      // Re-fetch to update pagination
      setTimeout(() => fetchFiles(), 500);

    } catch (error: any) {
      console.error("❌ Error deleting file:", error);
      toast.error(error.message || "Failed to delete file");
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

      const res = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/files/${fileId}`, {
        method: "PATCH",
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ fileName: newFileName.trim() })
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ message: 'Rename failed' }));
        throw new Error(errorData.message || "Failed to rename file");
      }

      toast.success("File renamed successfully");

      // Update local state
      setFiles(prev => prev.map(f =>
        f.id === fileId ? { ...f, name: newFileName.trim() } : f
      ));

      // Reset edit state
      setEditingFileId(null);
      setNewFileName("");

    } catch (error: any) {
      console.error("❌ Error renaming file:", error);
      toast.error(error.message || "Failed to rename file");
    }
  };

  const handleRead = (file: FileData) => {
    const type = file.metadata.contentType;
    if (type === "application/pdf") {
      router.push(`/reader/pdfreader?url=${encodeURIComponent(file.url)}&id=${file.id}`);
    } else if (type === "application/epub+zip") {
      router.push(`/reader/epubreader?url=${encodeURIComponent(file.url)}&id=${file.id}`);
    } else {
      toast.info("This file type is not supported for reading yet.");
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
    <div className="min-h-screen p-8 md:p-12 relative bg-[#0a0a0a]">
      <ToastContainer position="top-right" theme="dark" />

      <div className="max-w-7xl mx-auto">
        {/* Header Section */}
        <div className="flex flex-col md:flex-row justify-between items-end mb-16 gap-8">
          <div className="space-y-1">
            <h1 className="text-3xl md:text-4xl font-extrabold text-[#f5f5f5] tracking-tight">
              My Library
            </h1>
            <p className="text-[#a3a3a3] text-base font-medium">
              Manage your digital collection
            </p>
          </div>

          <button
            onClick={() => router.push("/fileupload")}
            className="group flex items-center gap-3 px-8 py-4 bg-[#d97706] hover:bg-[#b45309] text-white rounded-2xl font-bold text-lg shadow-xl shadow-[#d97706]/20 hover:shadow-2xl hover:shadow-[#d97706]/30 hover:-translate-y-1 transition-all duration-300"
          >
            <span className="text-2xl font-light leading-none">+</span>
            <span>Upload New</span>
          </button>
        </div>

        {/* Controls Bar */}
        <div className="bg-[#171717]/50 backdrop-blur-sm p-4 rounded-2xl border border-[#404040]/50 mb-12 flex flex-col lg:flex-row gap-4">
          <input
            type="text"
            placeholder="Search by title..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 px-6 py-4 bg-[#0a0a0a] border border-[#404040] rounded-xl focus:outline-none focus:border-[#d97706] focus:ring-1 focus:ring-[#d97706] transition-all text-[#f5f5f5] placeholder-[#525252]"
          />

          <div className="flex gap-4">
            <div className="relative">
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="h-full px-8 py-4 bg-[#0a0a0a] border border-[#404040] rounded-xl focus:outline-none focus:border-[#d97706] transition-colors text-[#f5f5f5] cursor-pointer appearance-none min-w-[160px]"
              >
                <option value="">All Types</option>
                <option value="pdf">PDF</option>
                <option value="epub">EPUB</option>
              </select>
              <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-[#a3a3a3]">▼</div>
            </div>

            <div className="relative">
              <select
                onChange={handleSortChange}
                className="h-full px-8 py-4 bg-[#0a0a0a] border border-[#404040] rounded-xl focus:outline-none focus:border-[#d97706] transition-colors text-[#f5f5f5] cursor-pointer appearance-none min-w-[160px]"
              >
                <option value="newest">Newest First</option>
                <option value="oldest">Oldest First</option>
                <option value="a-z">Name (A-Z)</option>
                <option value="z-a">Name (Z-A)</option>
              </select>
              <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-[#a3a3a3]">▼</div>
            </div>
          </div>
        </div>

        {/* Error State */}
        {error && !loading && (
          <div className="bg-red-500/10 border border-red-500/50 rounded-2xl p-6 mb-8 flex items-center gap-4">
            <AlertCircle className="text-red-500 flex-shrink-0" size={24} />
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
              <div className="w-16 h-16 border-4 border-[#262626] border-t-[#d97706] rounded-full animate-spin"></div>
            </div>
          </div>
        ) : files.length === 0 ? (
          <div className="text-center py-32 px-4 rounded-3xl bg-[#171717] border border-[#404040] border-dashed">
            <BookOpen size={80} className="mx-auto mb-6 text-[#404040]" />
            <h3 className="text-3xl font-bold text-[#f5f5f5] mb-3">
              {search || typeFilter ? "No files found" : "Your library is empty"}
            </h3>
            <p className="text-[#a3a3a3] text-lg mb-10 max-w-md mx-auto">
              {search || typeFilter
                ? "Try adjusting your filters or search terms"
                : "Ready to start reading? Upload your first book to begin building your collection."
              }
            </p>
            {!search && !typeFilter && (
              <button
                onClick={() => router.push("/fileupload")}
                className="px-10 py-4 bg-[#f5f5f5] text-[#0a0a0a] hover:bg-white rounded-xl transition-all font-bold text-lg shadow-xl hover:shadow-2xl hover:-translate-y-1"
              >
                Start Uploading
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8 pb-12">
              {files.map((file) => (
                <div
                  key={file.id}
                  className="group relative bg-[#171717] rounded-2xl overflow-hidden flex flex-col shadow-xl hover:shadow-2xl hover:shadow-black/50 hover:-translate-y-2 transition-all duration-300 border border-[#262626] hover:border-[#404040]"
                >
                  <div className="aspect-[3/4] relative bg-[#0f0f0f] overflow-hidden group-hover:scale-105 transition-transform duration-500">
                    <div className="w-full h-full">
                      <FilePreview url={file.url} type={file.metadata.contentType} />
                    </div>

                    <div className="absolute top-4 left-4 z-10">
                      <span className="text-xs font-bold px-3 py-1.5 rounded-lg bg-[#262626]/90 backdrop-blur-md text-[#d97706] shadow-lg border border-[#404040]">
                        {getFileIcon(file.metadata.contentType)}
                      </span>
                    </div>

                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
                      <button
                        onClick={() => handleRead(file)}
                        className="bg-[#d97706] text-white p-4 rounded-full shadow-xl transform scale-75 group-hover:scale-100 transition-transform duration-300"
                      >
                        <BookOpen size={24} />
                      </button>
                    </div>
                  </div>

                  <div className="p-5 flex-1 flex flex-col bg-[#171717]">
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
                              className="w-full px-3 py-2 bg-[#0a0a0a] border border-[#d97706] rounded-lg text-[#f5f5f5] text-sm focus:outline-none"
                              autoFocus
                            />
                            <div className="flex gap-2">
                              <button
                                onClick={() => handleRename(file.id)}
                                className="flex-1 px-3 py-1.5 bg-[#d97706] hover:bg-[#b45309] text-white rounded-lg text-xs font-bold transition-colors"
                              >
                                Save
                              </button>
                              <button
                                onClick={() => { setEditingFileId(null); setNewFileName(""); }}
                                className="flex-1 px-3 py-1.5 bg-[#262626] hover:bg-[#404040] text-white rounded-lg text-xs font-bold transition-colors"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <h3 className="font-bold text-lg text-[#f5f5f5] line-clamp-1 leading-tight mb-1" title={file.name}>
                              {file.name}
                            </h3>
                            <p className="text-sm text-[#737373] flex items-center gap-2">
                              <span>{file.metadata.size}</span>
                              {file.metadata.updated && (
                                <>
                                  <span className="w-1 h-1 rounded-full bg-[#404040]" />
                                  <span>{new Date(file.metadata.updated).toLocaleDateString()}</span>
                                </>
                              )}
                            </p>
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
                            className="text-[#525252] hover:text-[#d97706] transition-colors p-1 flex-shrink-0"
                            title="Rename File"
                          >
                            <Edit2 size={18} />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDelete(file.name, file.id);
                            }}
                            className="text-[#525252] hover:text-[#ef4444] transition-colors p-1 flex-shrink-0"
                            title="Delete File"
                          >
                            <Trash2 size={18} />
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
              <div className="flex justify-center items-center gap-4 pb-20">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="px-6 py-3 bg-[#262626] text-[#f5f5f5] rounded-xl font-bold disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[#404040] transition-colors"
                >
                  Previous
                </button>
                <span className="text-[#a3a3a3] font-medium">
                  Page <span className="text-[#f5f5f5]">{page}</span> of <span className="text-[#f5f5f5]">{totalPages}</span>
                </span>
                <button
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="px-6 py-3 bg-[#262626] text-[#f5f5f5] rounded-xl font-bold disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[#404040] transition-colors"
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
