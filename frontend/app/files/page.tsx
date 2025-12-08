"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { FileText, Trash2, BookOpen, Loader2 } from "lucide-react";
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
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("");

  // New States for Sorting & Pagination
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [sortBy, setSortBy] = useState("createdAt"); // 'createdAt' or 'name'
  const [sortOrder, setSortOrder] = useState("desc"); // 'asc' or 'desc'

  const router = useRouter();

  // Reset page when filters change
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
    try {
      const params = new URLSearchParams();
      if (search) params.append("search", search);
      if (typeFilter) params.append("type", typeFilter);

      params.append("page", page.toString());
      params.append("limit", "4");
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

      if (!res.ok) throw new Error("Failed to fetch files");

      const data = await res.json();

      // Handle the new response structure
      if (data.files) {
        setFiles(data.files);
        setTotalPages(data.pagination.totalPages);
      } else {
        // Fallback if backend hasn't updated/redeployed yet (safety)
        setFiles(Array.isArray(data) ? data : []);
      }

    } catch (error) {
      console.error("❌ Error fetching files:", error);
      toast.error("Failed to load files");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (filename: string) => {
    if (!confirm(`Are you sure you want to delete "${filename}"?`)) return;

    try {
      const token = localStorage.getItem("token");
      if (!token) {
        toast.error("Please login");
        return;
      }

      const res = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/files/${filename}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      if (!res.ok) throw new Error("Failed to delete file");

      toast.success("File deleted successfully");
      // Ideally re-fetch to maintain pagination, but local filter is faster for now
      setFiles(files.filter((f) => f.name !== filename));
      fetchFiles(); // Re-fetch to update counts/pagination
    } catch (error) {
      console.error("❌ Error deleting file:", error);
      toast.error("Failed to delete file");
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

  // Toggle Sort Helper
  const handleSortChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    if (value === "newest") { setSortBy("createdAt"); setSortOrder("desc"); }
    else if (value === "oldest") { setSortBy("createdAt"); setSortOrder("asc"); }
    else if (value === "a-z") { setSortBy("name"); setSortOrder("asc"); }
    else if (value === "z-a") { setSortBy("name"); setSortOrder("desc"); }
  };

  return (
    <div className="min-h-screen p-8 md:p-12 relative bg-[#0a0a0a]">
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
            {/* Type Filter */}
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

            {/* Sort Control */}
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

        {loading ? (
          <div className="flex justify-center items-center h-96">
            <div className="relative">
              <div className="w-16 h-16 border-4 border-[#262626] border-t-[#d97706] rounded-full animate-spin"></div>
            </div>
          </div>
        ) : files.length === 0 ? (
          <div className="text-center py-32 px-4 rounded-3xl bg-[#171717] border border-[#404040] border-dashed">
            <BookOpen size={80} className="mx-auto mb-6 text-[#404040]" />
            <h3 className="text-3xl font-bold text-[#f5f5f5] mb-3">Your library is empty</h3>
            <p className="text-[#a3a3a3] text-lg mb-10 max-w-md mx-auto">
              Ready to start reading? Upload your first book to begin building your collection.
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
                  {/* Preview Section - Maximized Size */}
                  <div className="aspect-[3/4] relative bg-[#0f0f0f] overflow-hidden group-hover:scale-105 transition-transform duration-500">
                    {/* Using the logic from previous step, ensure consistent sizing without padding */}
                    <div className="w-full h-full">
                      <FilePreview url={file.url} type={file.metadata.contentType} />
                    </div>

                    {/* Badge */}
                    <div className="absolute top-4 left-4 z-10">
                      <span className="text-xs font-bold px-3 py-1.5 rounded-lg bg-[#262626]/90 backdrop-blur-md text-[#d97706] shadow-lg border border-[#404040]">
                        {getFileIcon(file.metadata.contentType)}
                      </span>
                    </div>

                    {/* Hover Overlay */}
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
                      <button
                        onClick={() => handleRead(file)}
                        className="bg-[#d97706] text-white p-4 rounded-full shadow-xl transform scale-75 group-hover:scale-100 transition-transform duration-300"
                      >
                        <BookOpen size={24} />
                      </button>
                    </div>
                  </div>

                  {/* Content Section */}
                  <div className="p-5 flex-1 flex flex-col bg-[#171717]">
                    <div className="flex justify-between items-start gap-3">
                      <div>
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
                      </div>

                      <button
                        onClick={(e) => { e.stopPropagation(); handleDelete(file.name); }}
                        className="text-[#525252] hover:text-[#ef4444] transition-colors p-1"
                        title="Delete File"
                      >
                        <Trash2 size={18} />
                      </button>
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
                  className="px-6 py-3 bg-[#262626] text-[#f5f5f5] rounded-xl font-bold disabled:opacity-50 hover:bg-[#404040] transition-colors"
                >
                  Previous
                </button>
                <span className="text-[#a3a3a3] font-medium">
                  Page <span className="text-[#f5f5f5]">{page}</span> of <span className="text-[#f5f5f5]">{totalPages}</span>
                </span>
                <button
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="px-6 py-3 bg-[#262626] text-[#f5f5f5] rounded-xl font-bold disabled:opacity-50 hover:bg-[#404040] transition-colors"
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
