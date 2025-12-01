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
  const router = useRouter();

  useEffect(() => {
    // Debounce search to avoid too many requests
    const timeoutId = setTimeout(() => {
      fetchFiles();
    }, 500);
    return () => clearTimeout(timeoutId);
  }, [search, typeFilter]);

  const fetchFiles = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.append("search", search);
      if (typeFilter) params.append("type", typeFilter);

      const res = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/files?${params.toString()}`, {
        credentials: 'include'
      });
      if (!res.ok) throw new Error("Failed to fetch files");
      const data = await res.json();
      setFiles(data);
    } catch (error) {
      console.error("Error fetching files:", error);
      toast.error("Failed to load files");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (filename: string) => {
    if (!confirm(`Are you sure you want to delete "${filename}"?`)) return;

    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/files/${filename}`, {
        method: "DELETE",
        credentials: 'include'
      });

      if (!res.ok) throw new Error("Failed to delete file");

      toast.success("File deleted successfully");
      setFiles(files.filter((f) => f.name !== filename));
    } catch (error) {
      console.error("Error deleting file:", error);
      toast.error("Failed to delete file");
    }
  };

  const handleRead = (file: FileData) => {
    const type = file.metadata.contentType;
    if (type === "application/pdf") {
      router.push(`/reader/pdfreader?url=${encodeURIComponent(file.url)}`);
    } else if (type === "application/epub+zip") {
      router.push(`/reader/epubreader?url=${encodeURIComponent(file.url)}`);
    } else {
      toast.info("This file type is not supported for reading yet.");
    }
  };

  const formatSize = (bytes: string) => {
    const size = parseInt(bytes);
    if (isNaN(size)) return "Unknown size";
    if (size < 1024) return size + " B";
    if (size < 1024 * 1024) return (size / 1024).toFixed(1) + " KB";
    return (size / (1024 * 1024)).toFixed(1) + " MB";
  };

  const getFileIcon = (type: string) => {
    if (type === "application/pdf") return "PDF";
    if (type === "application/epub+zip") return "EPUB";
    return "DOC";
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white p-6 relative overflow-hidden">
      {/* Background Orbs */}
      <div className="absolute top-[-10%] left-[-10%] w-[600px] h-[600px] bg-violet-600/20 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[600px] h-[600px] bg-fuchsia-600/20 rounded-full blur-[120px] pointer-events-none" />

      <div className="max-w-7xl mx-auto relative z-10">
        <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-violet-400 to-fuchsia-400 bg-clip-text text-transparent">
            Your Library
          </h1>

          {/* Search and Filter Controls */}
          <div className="flex flex-col sm:flex-row gap-4 w-full md:w-auto">
            <input
              type="text"
              placeholder="Search files..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="px-4 py-2 bg-white/5 border border-white/10 rounded-lg focus:outline-none focus:border-violet-500 transition-colors w-full sm:w-64"
            />
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="px-4 py-2 bg-white/5 border border-white/10 rounded-lg focus:outline-none focus:border-violet-500 transition-colors text-gray-300"
            >
              <option value="">All Types</option>
              <option value="pdf">PDF</option>
              <option value="epub">EPUB</option>
            </select>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center items-center h-64">
            <Loader2 className="animate-spin text-violet-400" size={48} />
          </div>
        ) : files.length === 0 ? (
          <div className="text-center text-gray-400 mt-20">
            <p className="text-xl">No files found.</p>
            {search || typeFilter ? (
              <button
                onClick={() => { setSearch(""); setTypeFilter(""); }}
                className="mt-4 text-violet-400 hover:text-violet-300 underline"
              >
                Clear filters
              </button>
            ) : (
              <button
                onClick={() => router.push("/fileupload")}
                className="mt-4 px-6 py-2 bg-white/10 hover:bg-white/20 rounded-lg transition-colors"
              >
                Upload a Book
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-6">
            {files.map((file) => (
              <div
                key={file.name}
                className="group relative bg-white/5 backdrop-blur-md border border-white/10 rounded-xl overflow-hidden hover:bg-white/10 transition-all duration-300 flex flex-row h-48 shadow-lg hover:shadow-2xl hover:scale-[1.02]"
              >
                {/* Left: Preview Image */}
                <div className="w-32 sm:w-40 h-full relative flex-shrink-0 bg-gray-800 border-r border-white/10">
                  <FilePreview url={file.url} type={file.metadata.contentType} />

                  {/* Type Badge Overlay */}
                  <div className="absolute top-2 left-2">
                    <span className="text-[10px] font-bold px-2 py-1 rounded bg-black/60 text-white backdrop-blur-sm border border-white/10">
                      {getFileIcon(file.metadata.contentType)}
                    </span>
                  </div>
                </div>

                {/* Right: Details & Actions */}
                <div className="flex-1 p-4 flex flex-col justify-between relative min-w-0">
                  {/* Top: Metadata */}
                  <div>
                    <h3 className="font-bold text-lg text-white line-clamp-2 mb-2 group-hover:text-violet-300 transition-colors">
                      {file.name.split('-').slice(1).join('-')}
                    </h3>
                    <div className="flex items-center gap-4 text-sm text-gray-400">
                      <span className="flex items-center gap-1">
                        <FileText size={14} />
                        {formatSize(file.metadata.size)}
                      </span>
                      <span className="px-2 py-0.5 rounded-full bg-white/10 text-xs border border-white/5">
                        {getFileIcon(file.metadata.contentType)}
                      </span>
                    </div>
                  </div>

                  {/* Bottom: Actions */}
                  <div className="flex items-center gap-3 mt-2">
                    <button
                      onClick={() => handleRead(file)}
                      className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-700 rounded-lg text-sm font-medium transition-colors shadow-lg shadow-violet-900/20"
                    >
                      <BookOpen size={16} /> Read
                    </button>
                    <button
                      onClick={() => handleDelete(file.name)}
                      className="p-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 hover:text-red-300 rounded-lg transition-colors border border-red-500/20"
                      title="Delete File"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      <ToastContainer position="bottom-right" theme="dark" />
    </div>
  );
}
