"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { BookOpen, Trash2, Clock, AlertCircle } from "lucide-react";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

interface Bookmark {
    id: string; fileUrl: string; fileName: string;
    pageNumber?: number; totalPages?: number; cfi?: string;
    progress?: number; lastRead: string;
}

export default function BookmarksPage() {
    const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const router = useRouter();

    useEffect(() => { fetchBookmarks(); }, []);

    const fetchBookmarks = async () => {
        setLoading(true); setError(null);
        try {
            const token = localStorage.getItem("token");
            if (!token) {
                toast.error("Please login to view bookmarks");
                return router.push("/auth/login");
            }
            const res = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/api/bookmarks/all`, { headers: { Authorization: `Bearer ${token}` } });
            
            if (res.status === 401) {
                localStorage.removeItem("token"); localStorage.removeItem("user");
                window.dispatchEvent(new Event("auth-change"));
                toast.error("Session expired, please login again");
                return router.push("/auth/login");
            }
            if (!res.ok) throw new Error((await res.json().catch(()=>({}))).message || "Failed to fetch bookmarks");
            
            setBookmarks((await res.json()).bookmarks || []);
        } catch (err: any) {
            setError(err.message || "Failed to load bookmarks");
            toast.error(err.message || "Failed to load bookmarks");
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (b: Bookmark) => {
        if (!confirm(`Clear progress for "${b.fileName}"?`)) return;
        try {
            const token = localStorage.getItem("token");
            if (!token) return toast.error("Please login");

            const res = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/api/bookmarks?fileUrl=${encodeURIComponent(b.fileUrl)}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
            if (!res.ok) throw new Error("Failed to delete bookmark");
            
            toast.success("Progress cleared successfully");
            setBookmarks(prev => prev.filter(x => x.id !== b.id));
        } catch (err: any) {
            toast.error(err.message || "Failed to delete bookmark");
        }
    };

    if (loading) return <div className="min-h-screen flex justify-center items-center bg-background"><div className="w-16 h-16 border-4 border-border-subtle border-t-primary rounded-full animate-spin" /></div>;

    return (
        <div className="min-h-screen p-8 md:p-12 relative bg-background">
            <ToastContainer position="top-right" theme="light" />
            <div className="max-w-7xl mx-auto">
                <div className="mb-16">
                    <h1 className="text-3xl md:text-4xl font-extrabold text-foreground tracking-tight mb-2">My Bookmarks</h1>
                    <p className="text-foreground-muted text-base font-medium">Continue where you left off</p>
                </div>

                {error && (
                    <div className="bg-red-500/10 border border-red-500/50 rounded-2xl p-6 mb-8 flex items-center gap-4">
                        <AlertCircle className="text-red-500 shrink-0" size={24} />
                        <div>
                            <h3 className="text-red-500 font-bold mb-1">Error Loading Bookmarks</h3>
                            <p className="text-red-400 text-sm">{error}</p>
                            <button onClick={fetchBookmarks} className="mt-3 text-sm text-red-400 hover:text-red-300 underline">Try Again</button>
                        </div>
                    </div>
                )}

                {bookmarks.length === 0 && !error ? (
                    <div className="text-center py-32 px-4 rounded-3xl bg-surface border border-border-subtle border-dashed">
                        <BookOpen size={80} className="mx-auto mb-6 text-border-subtle" />
                        <h3 className="text-3xl font-bold text-foreground mb-3">No Bookmarks Yet</h3>
                        <p className="text-foreground-muted text-lg mb-10 max-w-md mx-auto">Start reading a book and your progress will be saved here automatically.</p>
                        <button onClick={() => router.push("/files")} className="px-10 py-4 bg-primary text-white hover:bg-primary-hover rounded-xl font-bold text-lg shadow-xl hover:-translate-y-1 transition-all">Browse Files</button>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {bookmarks.map(b => {
                            const ext = b.fileName?.toLowerCase().endsWith('.pdf') ? 'PDF' : b.fileName?.toLowerCase().endsWith('.epub') ? 'EPUB' : 'DOC';
                            const progText = b.progress != null ? `${Math.round(b.progress)}%` : (b.pageNumber && b.totalPages ? `Page ${b.pageNumber}/${b.totalPages}` : "In Progress");
                            
                            return (
                                <div key={b.id} className="group bg-surface rounded-2xl p-6 border border-border-subtle hover:border-foreground-muted transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl">
                                    <div className="flex items-start justify-between gap-4 mb-4">
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 mb-2">
                                                <span className="text-xs font-bold px-2 py-1 rounded-md bg-surface-hover text-primary border border-border-subtle">{ext}</span>
                                                <span className="text-xs text-foreground-muted flex items-center gap-1"><Clock size={12} />{new Date(b.lastRead).toLocaleDateString()}</span>
                                            </div>
                                            <h3 className="font-bold text-lg text-foreground line-clamp-2 mb-2" title={b.fileName}>{b.fileName || 'Untitled'}</h3>
                                        </div>
                                        <button onClick={() => handleDelete(b)} className="text-foreground-muted hover:text-[#ef4444] transition-colors p-2 shrink-0"><Trash2 size={18} /></button>
                                    </div>
                                    <div className="mb-4">
                                        <div className="flex justify-between items-center mb-2">
                                            <span className="text-sm text-foreground-muted">Progress</span>
                                            <span className="text-sm font-bold text-primary">{progText}</span>
                                        </div>
                                        <div className="w-full h-2 bg-border-subtle rounded-full overflow-hidden">
                                            <div className="h-full bg-linear-to-r from-primary to-purple-600 transition-all duration-300" style={{ width: `${b.progress || 0}%` }} />
                                        </div>
                                    </div>
                                    <button onClick={() => router.push(`/reader?files=${encodeURIComponent(b.fileUrl)}&active=0`)} className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-primary hover:bg-primary-hover text-white rounded-xl font-bold transition-all hover:shadow-lg hover:shadow-primary/20">
                                        <BookOpen size={18} /><span>Continue Reading</span>
                                    </button>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}
