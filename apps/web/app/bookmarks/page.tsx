"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiClient } from "@/services/apiClient";
import { BookOpen, Trash2, Clock, AlertCircle, Sparkles, FileText, Layers, ArrowRight } from "lucide-react";
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
        router.push(`/reader?files=${encodeURIComponent(bookmark.fileUrl)}&active=0`);
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

    const getFormatBadge = (fileName: string) => {
        const ext = fileName?.toLowerCase().split('.').pop() || '';
        if (ext === 'pdf') {
            return {
                label: 'PDF',
                icon: <FileText size={12} className="text-red-500" />,
                badgeClass: 'bg-red-500/10 text-red-500 border-red-500/20'
            };
        }
        if (ext === 'epub') {
            return {
                label: 'EPUB',
                icon: <BookOpen size={12} className="text-green-500" />,
                badgeClass: 'bg-green-500/10 text-green-500 border-green-500/20'
            };
        }
        return {
            label: ext ? ext.toUpperCase() : 'DOC',
            icon: <Layers size={12} className="text-blue-500" />,
            badgeClass: 'bg-blue-500/10 text-blue-500 border-blue-500/20'
        };
    };

    return (
        <div className="min-h-screen px-4 sm:px-6 lg:px-8 py-6 relative bg-background overflow-hidden">
            <ToastContainer position="top-right" theme="light" />

            {/* Ambient Blurred Glowing Orbs for Glassmorphism Depth */}
            <div className="absolute top-1/4 left-10 w-80 h-80 bg-primary/15 rounded-full blur-3xl pointer-events-none -z-0" />
            <div className="absolute bottom-1/4 right-10 w-[400px] h-[400px] bg-purple-600/15 rounded-full blur-3xl pointer-events-none -z-0" />
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-blue-500/10 rounded-full blur-3xl pointer-events-none -z-0" />

            <div className="w-full max-w-[1700px] mx-auto relative z-10">
                {/* Header */}
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
                    <div>
                        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-surface/80 backdrop-blur-2xl border border-border-subtle shadow-xs mb-2">
                            <Sparkles size={14} className="text-primary animate-pulse" />
                            <span className="text-[11px] font-bold uppercase tracking-wider text-foreground-muted">
                                Reading History
                            </span>
                        </div>
                        <h1 className="text-2xl sm:text-3xl font-extrabold text-foreground tracking-tight">
                            My{" "}
                            <span className="bg-clip-text text-transparent bg-linear-to-r from-primary via-purple-500 to-blue-500 drop-shadow-[0_0_12px_var(--color-primary-glow)]">
                                Bookmarks
                            </span>
                        </h1>
                        <p className="text-foreground-muted text-xs sm:text-sm font-medium">
                            Pick up right where you left off across any document
                        </p>
                    </div>

                    {bookmarks.length > 0 && (
                        <div className="px-3.5 py-2 bg-surface/80 backdrop-blur-2xl border border-border-subtle rounded-xl shadow-xs text-xs font-semibold text-foreground-muted">
                            <span className="text-foreground font-bold">{bookmarks.length}</span> {bookmarks.length === 1 ? 'bookmark saved' : 'bookmarks saved'}
                        </div>
                    )}
                </div>

                {/* Error State */}
                {error && !loading && (
                    <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-4 mb-6 flex items-center gap-3 backdrop-blur-md">
                        <AlertCircle className="text-red-500 shrink-0" size={20} />
                        <div className="flex-1">
                            <h3 className="text-red-500 font-bold text-sm mb-0.5">Error Loading Bookmarks</h3>
                            <p className="text-red-400 text-xs">{error}</p>
                        </div>
                        <button
                            onClick={fetchBookmarks}
                            className="px-3 py-1.5 bg-red-500 text-white rounded-lg text-xs font-bold hover:bg-red-600 transition-colors shrink-0"
                        >
                            Retry
                        </button>
                    </div>
                )}

                {/* Loading State */}
                {loading ? (
                    <div className="flex flex-col justify-center items-center h-72 gap-3">
                        <div className="w-12 h-12 border-3 border-border-subtle border-t-primary rounded-full animate-spin"></div>
                        <p className="text-xs text-foreground-muted font-medium">Loading reading history...</p>
                    </div>
                ) : bookmarks.length === 0 ? (
                    <div className="text-center py-16 px-6 rounded-3xl bg-surface/65 backdrop-blur-2xl border border-border-subtle shadow-xl max-w-2xl mx-auto">
                        <div className="w-16 h-16 rounded-2xl bg-surface-hover/80 border border-border-subtle flex items-center justify-center mx-auto mb-4 text-primary shadow-sm">
                            <BookOpen size={30} />
                        </div>
                        <h3 className="text-2xl font-extrabold text-foreground mb-2">
                            No Bookmarks Yet
                        </h3>
                        <p className="text-foreground-muted text-xs sm:text-sm mb-6 max-w-md mx-auto">
                            Start reading any document in your library and your latest page and progress will be saved here automatically.
                        </p>

                        {/* Supported Formats preview */}
                        <div className="grid grid-cols-3 gap-2.5 max-w-sm mx-auto mb-6">
                            <div className="p-2 rounded-xl bg-surface-hover/50 border border-border-subtle text-center">
                                <span className="text-xs font-bold text-red-500">PDF</span>
                                <p className="text-[10px] text-foreground-muted">Page sync</p>
                            </div>
                            <div className="p-2 rounded-xl bg-surface-hover/50 border border-border-subtle text-center">
                                <span className="text-xs font-bold text-green-500">EPUB</span>
                                <p className="text-[10px] text-foreground-muted">CFI sync</p>
                            </div>
                            <div className="p-2 rounded-xl bg-surface-hover/50 border border-border-subtle text-center">
                                <span className="text-xs font-bold text-blue-500">TXT</span>
                                <p className="text-[10px] text-foreground-muted">Scroll sync</p>
                            </div>
                        </div>

                        <button
                            onClick={() => router.push("/files")}
                            className="relative overflow-hidden px-6 py-2.5 bg-primary text-white rounded-xl font-bold text-sm shadow-[0_4px_15px_var(--color-primary-glow)] hover:shadow-[0_8px_20px_var(--color-primary-glow)] hover:-translate-y-0.5 transition-all duration-300 group inline-flex items-center gap-2"
                        >
                            <span className="relative z-10">Explore Library</span>
                            <ArrowRight size={14} className="relative z-10 group-hover:translate-x-0.5 transition-transform" />
                            <div className="absolute inset-0 bg-white/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                        </button>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 pb-8">
                        {bookmarks.map((bookmark) => {
                            const badge = getFormatBadge(bookmark.fileName || '');
                            return (
                                <div
                                    key={bookmark.id}
                                    className="group bg-surface/75 backdrop-blur-2xl rounded-2xl p-4 border border-border-subtle hover:border-primary/40 hover:-translate-y-1 transition-all duration-300 shadow-sm hover:shadow-xl dark:shadow-[0_8px_25px_rgb(0,0,0,0.3)] flex flex-col justify-between"
                                >
                                    <div>
                                        <div className="flex items-start justify-between gap-2 mb-3">
                                            <div className="flex items-center gap-1.5 flex-wrap">
                                                <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-lg border ${badge.badgeClass}`}>
                                                    {badge.icon}
                                                    {badge.label}
                                                </span>
                                                <span className="text-[11px] text-foreground-muted flex items-center gap-1">
                                                    <Clock size={11} />
                                                    {new Date(bookmark.lastRead).toLocaleDateString()}
                                                </span>
                                            </div>

                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleDelete(bookmark);
                                                }}
                                                className="text-foreground-muted hover:text-red-500 hover:bg-red-500/10 p-1.5 rounded-lg transition-colors shrink-0"
                                                title="Clear Bookmark"
                                            >
                                                <Trash2 size={13} />
                                            </button>
                                        </div>

                                        <h3
                                            className="font-bold text-sm text-foreground group-hover:text-primary transition-colors line-clamp-2 mb-3 leading-snug"
                                            title={bookmark.fileName}
                                        >
                                            {bookmark.fileName || 'Untitled Document'}
                                        </h3>
                                    </div>

                                    <div className="space-y-3 pt-1">
                                        {/* Progress Bar with Glow */}
                                        <div>
                                            <div className="flex justify-between items-center mb-1.5">
                                                <span className="text-[11px] font-medium text-foreground-muted">Progress</span>
                                                <span className="text-[11px] font-bold text-primary">
                                                    {getProgressText(bookmark)}
                                                </span>
                                            </div>
                                            <div className="w-full h-1.5 bg-surface-hover/80 backdrop-blur-md rounded-full overflow-hidden border border-border-subtle">
                                                <div
                                                    className="h-full bg-linear-to-r from-primary via-purple-500 to-blue-500 shadow-[0_0_8px_var(--color-primary-glow)] transition-all duration-300"
                                                    style={{ width: `${Math.min(100, Math.max(0, bookmark.progress || 0))}%` }}
                                                />
                                            </div>
                                        </div>

                                        {/* Continue Reading Button */}
                                        <button
                                            onClick={() => handleContinueReading(bookmark)}
                                            className="relative overflow-hidden w-full flex items-center justify-center gap-2 px-3.5 py-2.5 bg-primary text-white rounded-xl font-bold text-xs sm:text-sm shadow-[0_4px_15px_var(--color-primary-glow)] hover:shadow-[0_8px_20px_var(--color-primary-glow)] hover:bg-primary-hover hover:-translate-y-0.5 transition-all duration-200 group/btn"
                                        >
                                            <div className="absolute inset-0 bg-white/20 opacity-0 group-hover/btn:opacity-100 transition-opacity duration-200" />
                                            <BookOpen size={14} className="relative z-10" />
                                            <span className="relative z-10">Continue Reading</span>
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Glassmorphic Clear Progress Confirmation Modal */}
            {bookmarkToDelete && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-md animate-in fade-in duration-200">
                    <div className="bg-surface/90 backdrop-blur-2xl border border-border-subtle rounded-3xl p-6 max-w-sm w-full shadow-2xl animate-in zoom-in-95 duration-200 space-y-4">
                        <div className="w-12 h-12 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-500 flex items-center justify-center">
                            <Trash2 size={22} />
                        </div>
                        <div>
                            <h3 className="text-lg font-extrabold text-foreground mb-1">Clear Bookmark</h3>
                            <p className="text-foreground-muted text-xs leading-relaxed">
                                Are you sure you want to clear saved progress for <span className="font-bold text-foreground">&quot;{bookmarkToDelete.fileName}&quot;</span>?
                            </p>
                        </div>
                        <div className="flex gap-2.5 pt-1">
                            <button
                                onClick={() => setBookmarkToDelete(null)}
                                className="flex-1 py-2.5 px-3 bg-surface-hover/80 hover:bg-surface-hover text-foreground font-bold text-xs rounded-xl border border-border-subtle transition-all duration-200"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={confirmDeleteBookmark}
                                className="flex-1 py-2.5 px-3 bg-red-600 hover:bg-red-700 text-white font-bold text-xs rounded-xl shadow-md hover:shadow-red-600/30 transition-all duration-200"
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

