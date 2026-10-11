"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiClient } from "@/services/apiClient";
import { BookOpen, Trash2, Clock, AlertCircle } from "lucide-react";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

interface Bookmark {
    id: string;
    fileUrl: string;
    fileName: string;
    pageNumber?: number;
    totalPages?: number;
    cfi?: string;
    progress?: number;
    lastRead: string;
}

export default function BookmarksPage() {
    const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [bookmarkToDelete, setBookmarkToDelete] = useState<Bookmark | null>(null);
    const router = useRouter();

    const fetchBookmarks = async () => {
        setLoading(true);
        setError(null);

        try {
            const token = localStorage.getItem("token");
            if (!token) {
                toast.error("Please login to view bookmarks");
                router.push("/auth/login");
                setLoading(false);
                return;
            }

            const data = await apiClient.getAllBookmarks(token);
            setBookmarks(data.bookmarks || []);

        } catch (error: unknown) {
            const err = error as Error;
            console.error("❌ Error fetching bookmarks:", err);
            setError(err.message || "Failed to load bookmarks");
            toast.error(err.message || "Failed to load bookmarks");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchBookmarks();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handleDelete = (bookmark: Bookmark) => {
        setBookmarkToDelete(bookmark);
    };

    const confirmDeleteBookmark = async () => {
        if (!bookmarkToDelete) return;
        const bookmark = bookmarkToDelete;
        setBookmarkToDelete(null);

        try {
            const token = localStorage.getItem("token");
            if (!token) {
                toast.error("Please login");
                return;
            }

            await apiClient.deleteBookmark(token, bookmark.fileUrl);

            toast.success("Progress cleared successfully");
            setBookmarks(prev => prev.filter(b => b.id !== bookmark.id));

        } catch (error: unknown) {
            const err = error as Error;
            console.error("❌ Error deleting bookmark:", err);
            toast.error(err.message || "Failed to delete bookmark");
        }
    };

    const handleContinueReading = (bookmark: Bookmark) => {
        // Determine file type from fileName or fileUrl
        const fileNameLower = bookmark.fileName?.toLowerCase() || '';
        const fileUrlLower = bookmark.fileUrl?.toLowerCase() || '';

        const isPDF = fileNameLower.endsWith('.pdf') || fileUrlLower.includes('.pdf');
        const isEPUB = fileNameLower.endsWith('.epub') || fileUrlLower.includes('.epub');

        if (isPDF) {
            router.push(`/reader/pdfreader?url=${encodeURIComponent(bookmark.fileUrl)}`);
        } else if (isEPUB) {
            router.push(`/reader/epubreader?url=${encodeURIComponent(bookmark.fileUrl)}`);
        } else {
            toast.info(`Unable to determine file type. FileName: ${bookmark.fileName}, URL: ${bookmark.fileUrl}`);
        }
    };

    const getProgressText = (bookmark: Bookmark) => {
        if (bookmark.progress !== null && bookmark.progress !== undefined) {
            return `${Math.round(bookmark.progress)}%`;
        }
        if (bookmark.pageNumber && bookmark.totalPages) {
            return `Page ${bookmark.pageNumber}/${bookmark.totalPages}`;
        }
        return "In Progress";
    };

    const getFileType = (fileName: string) => {
        if (fileName?.toLowerCase().endsWith('.pdf')) return 'PDF';
        if (fileName?.toLowerCase().endsWith('.epub')) return 'EPUB';
        return 'DOC';
    };

    return (
        <div className="min-h-screen p-8 md:p-12 relative bg-background overflow-hidden">
            <ToastContainer position="top-right" theme="light" />

            {/* Ambient Blurred Glowing Orbs for Glassmorphism Depth */}
            <div className="absolute top-20 left-10 w-96 h-96 bg-primary/10 rounded-full blur-3xl pointer-events-none -z-0" />
            <div className="absolute top-1/3 right-10 w-[500px] h-[500px] bg-purple-600/10 rounded-full blur-3xl pointer-events-none -z-0" />
            <div className="absolute bottom-20 left-1/3 w-[600px] h-[600px] bg-blue-500/10 rounded-full blur-3xl pointer-events-none -z-0" />

            <div className="max-w-7xl mx-auto relative z-10">
                {/* Header */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-16 gap-6">
                    <div>
                        <h1 className="text-3xl md:text-4xl font-extrabold text-foreground tracking-tight mb-2">
                            My Bookmarks
                        </h1>
                        <p className="text-foreground-muted text-base font-medium">
                            Continue where you left off
                        </p>
                    </div>
                    {bookmarks.length > 0 && (
                        <div className="px-4 py-2 bg-surface/80 backdrop-blur-2xl border border-border-subtle rounded-2xl shadow-sm text-sm font-semibold text-foreground-muted">
                            <span className="text-foreground font-bold">{bookmarks.length}</span> {bookmarks.length === 1 ? 'saved item' : 'saved items'}
                        </div>
                    )}
                </div>

                {/* Error State */}
                {error && !loading && (
                    <div className="bg-red-500/10 border border-red-500/50 rounded-2xl p-6 mb-8 flex items-center gap-4">
                        <AlertCircle className="text-red-500 shrink-0" size={24} />
                        <div>
                            <h3 className="text-red-500 font-bold mb-1">Error Loading Bookmarks</h3>
                            <p className="text-red-400 text-sm">{error}</p>
                            <button
                                onClick={fetchBookmarks}
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
                        <div className="w-16 h-16 border-4 border-border-subtle border-t-primary rounded-full animate-spin"></div>
                    </div>
                ) : bookmarks.length === 0 ? (
                    <div className="text-center py-32 px-4 rounded-3xl bg-surface backdrop-blur-2xl border border-border-subtle border-dashed">
                        <BookOpen size={80} className="mx-auto mb-6 text-border-subtle" />
                        <h3 className="text-3xl font-bold text-foreground mb-3">
                            No Bookmarks Yet
                        </h3>
                        <p className="text-foreground-muted text-lg mb-10 max-w-md mx-auto">
                            Start reading a book and your progress will be saved here automatically.
                        </p>
                        <button
                            onClick={() => router.push("/files")}
                            className="px-10 py-4 bg-primary text-white rounded-xl font-bold text-lg shadow-[0_8px_20px_var(--color-primary-glow)] hover:shadow-[0_12px_25px_var(--color-primary-glow)] hover:-translate-y-1 transition-all duration-300 relative overflow-hidden group"
                        >
                            <div className="absolute inset-0 bg-white/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                            <span className="relative z-10">Browse Files</span>
                        </button>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {bookmarks.map((bookmark) => (
                            <div
                                key={bookmark.id}
                                className="group bg-surface/80 backdrop-blur-2xl rounded-3xl p-6 border border-border-subtle transition-all duration-500 hover:-translate-y-2 shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:shadow-[0_15px_40px_rgb(0,0,0,0.08)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.2)] dark:hover:shadow-[0_15px_40px_rgb(0,0,0,0.4)]"
                            >
                                <div className="flex items-start justify-between gap-4 mb-4">
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-2">
                                            <span className="text-xs font-bold px-2.5 py-1 rounded-lg bg-surface-hover/80 backdrop-blur-md text-primary border border-border-subtle">
                                                {getFileType(bookmark.fileName || '')}
                                            </span>
                                            <span className="text-xs text-foreground-muted flex items-center gap-1">
                                                <Clock size={12} />
                                                {new Date(bookmark.lastRead).toLocaleDateString()}
                                            </span>
                                        </div>
                                        <h3 className="font-bold text-lg text-foreground line-clamp-2 mb-2" title={bookmark.fileName}>
                                            {bookmark.fileName || 'Untitled'}
                                        </h3>
                                    </div>

                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleDelete(bookmark);
                                        }}
                                        className="text-foreground-muted hover:text-[#ef4444] transition-colors p-2 shrink-0 hover:scale-110"
                                        title="Clear Progress"
                                    >
                                        <Trash2 size={18} />
                                    </button>
                                </div>

                                {/* Progress Bar */}
                                <div className="mb-4">
                                    <div className="flex justify-between items-center mb-2">
                                        <span className="text-sm text-foreground-muted">Progress</span>
                                        <span className="text-sm font-bold text-primary">
                                            {getProgressText(bookmark)}
                                        </span>
                                    </div>
                                    <div className="w-full h-2.5 bg-surface/60 backdrop-blur-md rounded-full overflow-hidden border border-border-subtle/50">
                                        <div
                                            className="h-full bg-linear-to-r from-primary to-purple-600 shadow-[0_0_8px_var(--color-primary-glow)] transition-all duration-500"
                                            style={{ width: `${bookmark.progress || 0}%` }}
                                        />
                                    </div>
                                </div>

                                {/* Continue Reading Button */}
                                <button
                                    onClick={() => handleContinueReading(bookmark)}
                                    className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-primary text-white rounded-xl font-bold text-sm shadow-[0_4px_15px_var(--color-primary-glow)] hover:shadow-[0_8px_25px_var(--color-primary-glow)] hover:-translate-y-0.5 transition-all duration-300 relative overflow-hidden group/btn"
                                >
                                    <div className="absolute inset-0 bg-white/20 opacity-0 group-hover/btn:opacity-100 transition-opacity duration-300" />
                                    <BookOpen size={18} className="relative z-10" />
                                    <span className="relative z-10">Continue Reading</span>
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Glassmorphic Clear Progress Confirmation Modal */}
            {bookmarkToDelete && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-md animate-in fade-in duration-200">
                    <div className="bg-surface/90 backdrop-blur-2xl border border-border-subtle rounded-3xl p-8 max-w-md w-full shadow-2xl animate-in zoom-in-95 duration-200 space-y-6">
                        <div className="w-14 h-14 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-500 flex items-center justify-center">
                            <Trash2 size={28} />
                        </div>
                        <div>
                            <h3 className="text-2xl font-bold text-foreground mb-2">Clear Reading Progress</h3>
                            <p className="text-foreground-muted text-sm">
                                Are you sure you want to clear saved progress for <span className="font-semibold text-foreground">&quot;{bookmarkToDelete.fileName}&quot;</span>?
                            </p>
                        </div>
                        <div className="flex gap-3 pt-2">
                            <button
                                onClick={() => setBookmarkToDelete(null)}
                                className="flex-1 py-3 px-5 bg-surface-hover/80 hover:bg-surface-hover text-foreground font-semibold rounded-xl border border-border-subtle transition-all duration-300"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={confirmDeleteBookmark}
                                className="flex-1 py-3 px-5 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-xl shadow-lg hover:shadow-red-600/30 transition-all duration-300"
                            >
                                Clear
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
