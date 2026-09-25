"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2, BookOpen, AlertCircle, Edit2 } from "lucide-react";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import dynamic from "next/dynamic";

const FilePreview = dynamic(() => import("@/components/FilePreview"), { ssr: false });

interface FileData {
  name: string; url: string; id: string;
  metadata: { size: string; updated: string; contentType: string; };
}

export default function FilesPage() {
  const [files, setFiles] = useState<FileData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [sortBy, setSortBy] = useState("createdAt");
  const [sortOrder, setSortOrder] = useState("desc");
  
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  
  const [editingFileId, setEditingFileId] = useState<string | null>(null);
  const [newFileName, setNewFileName] = useState("");
  const router = useRouter();

  useEffect(() => { setPage(1); }, [search, typeFilter, sortBy, sortOrder]);

  useEffect(() => {
    const tid = setTimeout(() => fetchFiles(), 500);
    return () => clearTimeout(tid);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, typeFilter, page, sortBy, sortOrder]);

  const fetchFiles = async () => {
    setLoading(true); setError(null);
    try {
      const token = localStorage.getItem("token");
      if (!token) {
        toast.error("Please login to view files");
        return router.push("/auth/login");
      }

      const params = new URLSearchParams({ page: page.toString(), limit: "12", sortBy, order: sortOrder });
      if (search) params.append("search", search);
      if (typeFilter) params.append("type", typeFilter);

      const res = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/files?${params.toString()}`, { headers: { Authorization: `Bearer ${token}` } });
      if (res.status === 401) {
        localStorage.removeItem("token"); localStorage.removeItem("user");
        window.dispatchEvent(new Event("auth-change"));
        toast.error("Session expired, please login again");
        return router.push("/auth/login");
      }

      if (!res.ok) throw new Error((await res.json().catch(()=>({}))).error || `Server error: ${res.status}`);
      
      const data = await res.json();
      setFiles(data.files || (Array.isArray(data) ? data : []));
      setTotalPages(data.pagination?.totalPages || 1);
    } catch (err: any) {
      setError(err.message || "Failed to load files");
      toast.error(err.message || "Failed to load files");
    } finally {
      setLoading(false);
    }
  };

  const handleAction = async (method: string, endpoint: string, successMsg: string, body?: any) => {
    const token = localStorage.getItem("token");
    if (!token) return toast.error("Please login");
    const res = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}${endpoint}`, {
      method, headers: { Authorization: `Bearer ${token}`, ...(body && { 'Content-Type': 'application/json' }) },
      body: body ? JSON.stringify(body) : undefined
    });
    if (!res.ok) throw new Error((await res.json().catch(()=>({}))).error || "Request failed");
    toast.success(successMsg);
  };

  const handleDelete = async (file: FileData) => {
    if (!confirm(`Are you sure you want to delete "${file.name}"?`)) return;
    try {
      await handleAction("DELETE", `/files/${encodeURIComponent(file.name)}`, "File deleted successfully");
      setFiles(prev => prev.filter(f => f.id !== file.id));
      setTimeout(() => fetchFiles(), 500);
    } catch (err: any) { toast.error(err.message); }
  };

  const handleRename = async (fileId: string) => {
    if (!newFileName.trim()) return toast.error("File name cannot be empty");
    try {
      await handleAction("PATCH", `/files/${fileId}`, "File renamed successfully", { fileName: newFileName.trim() });
      setFiles(prev => prev.map(f => f.id === fileId ? { ...f, name: newFileName.trim() } : f));
      setEditingFileId(null); setNewFileName("");
    } catch (err: any) { toast.error(err.message); }
  };

  const handleRead = (file: FileData, newTab = false) => {
    const urls = sessionStorage.getItem("readerFiles")?.split(",") || [];
    if (newTab && urls.length > 0) {
      if (urls.includes(file.url)) {
        toast.info("File is already open");
        return router.push(`/reader?files=${urls.map(encodeURIComponent).join(",")}&active=${urls.indexOf(file.url)}`);
      }
      const nextUrls = [...urls, file.url].map(encodeURIComponent).join(",");
      router.push(`/reader?files=${nextUrls}&active=${urls.length}`);
    } else {
      router.push(`/reader?files=${encodeURIComponent(file.url)}&active=0`);
    }
  };

  const handleSortChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const v = e.target.value;
    setSortBy(v === "newest" || v === "oldest" ? "createdAt" : "name");
    setSortOrder(v === "newest" || v === "z-a" ? "desc" : "asc");
  };

  return (
    <div className="min-h-screen p-8 md:p-12 relative bg-background">
      <ToastContainer position="top-right" theme="light" />
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row justify-between items-end mb-16 gap-8">
          <div className="space-y-1">
            <h1 className="text-3xl md:text-4xl font-extrabold text-foreground tracking-tight">My Library</h1>
            <p className="text-foreground-muted text-base font-medium">Manage your digital collection</p>
          </div>
          <button onClick={() => router.push("/fileupload")} className="flex items-center gap-3 px-8 py-4 bg-primary hover:bg-primary-hover text-white rounded-2xl font-bold text-lg shadow-xl hover:shadow-2xl hover:-translate-y-1 transition-all">
            <span className="text-2xl font-light leading-none">+</span><span>Upload New</span>
          </button>
        </div>

        <div className="bg-surface/50 backdrop-blur-sm p-4 rounded-2xl border border-border-subtle/50 mb-12 flex flex-col lg:flex-row gap-4">
          <input type="text" placeholder="Search by title..." value={search} onChange={e => setSearch(e.target.value)} className="flex-1 px-6 py-4 bg-background border border-border-subtle rounded-xl focus:outline-none focus:border-primary text-foreground" />
          <div className="flex gap-4">
            <div className="relative">
              <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)} className="h-full px-8 py-4 bg-background border border-border-subtle rounded-xl focus:outline-none focus:border-primary text-foreground cursor-pointer appearance-none min-w-40">
                <option value="">All Types</option><option value="pdf">PDF</option><option value="epub">EPUB</option>
              </select>
              <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-foreground-muted">▼</div>
            </div>
            <div className="relative">
              <select onChange={handleSortChange} className="h-full px-8 py-4 bg-background border border-border-subtle rounded-xl focus:outline-none focus:border-primary text-foreground cursor-pointer appearance-none min-w-40">
                <option value="newest">Newest First</option><option value="oldest">Oldest First</option><option value="a-z">Name (A-Z)</option><option value="z-a">Name (Z-A)</option>
              </select>
              <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-foreground-muted">▼</div>
            </div>
          </div>
        </div>

        {error && !loading && (
          <div className="bg-red-500/10 border border-red-500/50 rounded-2xl p-6 mb-8 flex items-center gap-4">
            <AlertCircle className="text-red-500 shrink-0" size={24} />
            <div>
              <h3 className="text-red-500 font-bold mb-1">Error Loading Files</h3>
              <p className="text-red-400 text-sm">{error}</p>
              <button onClick={fetchFiles} className="mt-3 text-sm text-red-400 hover:text-red-300 underline">Try Again</button>
            </div>
          </div>
        )}

        {loading ? (
          <div className="flex justify-center items-center h-96"><div className="w-16 h-16 border-4 border-border-subtle border-t-primary rounded-full animate-spin" /></div>
        ) : files.length === 0 ? (
          <div className="text-center py-32 px-4 rounded-3xl bg-surface border border-border-subtle border-dashed">
            <BookOpen size={80} className="mx-auto mb-6 text-border-subtle" />
            <h3 className="text-3xl font-bold text-foreground mb-3">{search || typeFilter ? "No files found" : "Your library is empty"}</h3>
            <p className="text-foreground-muted text-lg mb-10 max-w-md mx-auto">{search || typeFilter ? "Try adjusting your filters or search terms" : "Ready to start reading? Upload your first book to begin building your collection."}</p>
            {!search && !typeFilter && <button onClick={() => router.push("/fileupload")} className="px-10 py-4 bg-primary text-white hover:bg-primary-hover rounded-xl font-bold text-lg shadow-xl hover:-translate-y-1 transition-all">Start Uploading</button>}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8 pb-12">
              {files.map(f => (
                <div key={f.id} className="group relative bg-surface rounded-2xl overflow-hidden flex flex-col shadow-xl hover:shadow-2xl hover:-translate-y-2 transition-all border border-border-subtle hover:border-border-subtle">
                  <div className="aspect-3/4 relative bg-background overflow-hidden group-hover:scale-105 transition-transform duration-500">
                    <div className="w-full h-full"><FilePreview url={f.url} type={f.metadata.contentType} /></div>
                    <div className="absolute top-4 left-4 z-10"><span className="text-xs font-bold px-3 py-1.5 rounded-lg bg-surface-hover/90 backdrop-blur-md text-primary shadow-lg border border-border-subtle">{f.metadata.contentType === "application/pdf" ? "PDF" : f.metadata.contentType === "application/epub+zip" ? "EPUB" : "DOC"}</span></div>
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center gap-3">
                      <button onClick={() => handleRead(f)} className="bg-primary text-white px-4 py-2 rounded-lg shadow-xl transform scale-75 group-hover:scale-100 transition-transform font-medium text-sm">Open</button>
                      <button onClick={() => handleRead(f, true)} className="bg-blue-600 text-white px-4 py-2 rounded-lg shadow-xl transform scale-75 group-hover:scale-100 transition-transform font-medium text-sm">+ New Tab</button>
                    </div>
                  </div>
                  <div className="p-5 flex-1 flex flex-col bg-surface">
                    <div className="flex justify-between items-start gap-3">
                      <div className="flex-1 min-w-0">
                        {editingFileId === f.id ? (
                          <div className="space-y-2">
                            <input type="text" value={newFileName} onChange={e => setNewFileName(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') handleRename(f.id); if (e.key === 'Escape') setEditingFileId(null); }} className="w-full px-3 py-2 bg-background border border-primary rounded-lg text-foreground text-sm focus:outline-none" autoFocus />
                            <div className="flex gap-2">
                              <button onClick={() => handleRename(f.id)} className="flex-1 px-3 py-1.5 bg-primary hover:bg-primary-hover text-white rounded-lg text-xs font-bold">Save</button>
                              <button onClick={() => setEditingFileId(null)} className="flex-1 px-3 py-1.5 bg-border-subtle hover:bg-foreground-muted text-white rounded-lg text-xs font-bold">Cancel</button>
                            </div>
                          </div>
                        ) : (
                          <><h3 className="font-bold text-lg text-foreground line-clamp-1 mb-1" title={f.name}>{f.name}</h3><p className="text-sm text-foreground-muted flex items-center gap-2"><span>{f.metadata.size}</span>{f.metadata.updated && <><span className="w-1 h-1 rounded-full bg-border-subtle" /><span>{new Date(f.metadata.updated).toLocaleDateString()}</span></>}</p></>
                        )}
                      </div>
                      {editingFileId !== f.id && (
                        <div className="flex gap-2">
                          <button onClick={() => { setEditingFileId(f.id); setNewFileName(f.name); }} className="text-foreground-muted hover:text-primary p-1 shrink-0"><Edit2 size={18} /></button>
                          <button onClick={() => handleDelete(f)} className="text-foreground-muted hover:text-[#ef4444] p-1 shrink-0"><Trash2 size={18} /></button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
            {totalPages > 1 && (
              <div className="flex justify-center items-center gap-4 pb-20">
                <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="px-6 py-3 bg-border-subtle text-foreground rounded-xl font-bold disabled:opacity-50 hover:bg-foreground-muted">Previous</button>
                <span className="text-foreground-muted font-medium">Page <span className="text-foreground">{page}</span> of <span className="text-foreground">{totalPages}</span></span>
                <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="px-6 py-3 bg-border-subtle text-foreground rounded-xl font-bold disabled:opacity-50 hover:bg-foreground-muted">Next</button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
