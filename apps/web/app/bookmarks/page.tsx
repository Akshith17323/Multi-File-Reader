"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiClient } from "@/services/apiClient";
import { getLocalBookmarksMap, mergeBookmarks, deleteBookmarkUnified } from "@/utils/localBookmarks";
import { createReaderUrl } from "@/utils/readerSession";
import { isElectron } from "@/hooks/useEnvironment";
import { isLocalFileUrl } from "@/utils/fileUrls";
import { BookOpen, Trash2, Clock, AlertCircle } from "lucide-react";
import { toast } from "react-toastify";
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
            if (!token && !isElectron()) {
                toast.error("Please login to view bookmarks");
                router.push("/auth/login");
                setLoading(false);
                return;
            }

            const local = getLocalBookmarksMap();
            const remote = token ? (await apiClient.getAllBookmarks(token)).bookmarks || [] : [];
            setBookmarks(mergeBookmarks(remote, local).map(bookmark => ({ ...bookmark, id: bookmark.fileUrl, fileName: bookmark.fileName || "Untitled document", lastRead: bookmark.lastRead || "" })));

        } catch (error: unknown) {
            const local = mergeBookmarks([], getLocalBookmarksMap());
            if (local.length) {
                setBookmarks(local.map(bookmark => ({ ...bookmark, id: bookmark.fileUrl, fileName: bookmark.fileName || "Untitled document", lastRead: bookmark.lastRead || "" })));
                return;
            }
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
            await deleteBookmarkUnified(token, bookmark.fileUrl);

            toast.success("Progress cleared successfully");
            setBookmarks(prev => prev.filter(b => b.id !== bookmark.id));

        } catch (error: unknown) {
            const err = error as Error;
            console.error("❌ Error deleting bookmark:", err);
            toast.error(err.message || "Failed to delete bookmark");
        }
    };

    const handleContinueReading = (bookmark: Bookmark) => {
        if (isLocalFileUrl(bookmark.fileUrl) && !isElectron()) { toast.info("Open this local document in the desktop app."); return; }
        router.push(createReaderUrl([bookmark.fileUrl]));
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
        <div className="min-h-screen px-4 sm:px-6 lg:px-8 py-4 sm:py-6 relative bg-background overflow-hidden">

            {/* Ambient Blurred Glowing Orbs for Glassmorphism Depth */}
            <div className="absolute top-20 left-10 w-96 h-96 bg-primary/10 rounded-full blur-3xl pointer-events-none -z-0" />
            <div className="absolute top-1/3 right-10 w-[500px] h-[500px] bg-purple-600/10 rounded-full blur-3xl pointer-events-none -z-0" />
            <div className="absolute bottom-20 left-1/3 w-[600px] h-[600px] bg-blue-500/10 rounded-full blur-3xl pointer-events-none -z-0" />

            <div className="w-full max-w-[1700px] mx-auto relative z-10">
                {/* Header */}
                <div className="flex flex-row justify-between items-center mb-5 gap-4">
                    <div className="space-y-0.5">
                        <h1 className="text-2xl sm:text-3xl font-extrabold text-foreground tracking-tight">
                            My Bookmarks
                        </h1>
                        <p className="text-foreground-muted text-xs sm:text-sm font-medium">
                            Continue where you left off
                        </p>
                    </div>
                    {bookmarks.length > 0 && (
                        <div className="px-3 py-1.5 bg-surface/80 backdrop-blur-2xl border border-border-subtle rounded-xl shadow-xs text-xs font-semibold text-foreground-muted">
                            <span className="text-foreground font-bold">{bookmarks.length}</span> {bookmarks.length === 1 ? 'saved item' : 'saved items'}
                        </div>
                    )}
                </div>

                {/* Error State */}
                {error && !loading && (
                    <div className="bg-red-500/10 border border-red-500/50 rounded-xl p-4 mb-5 flex items-center gap-3">
                        <AlertCircle className="text-red-500 shrink-0" size={20} />
                        <div>
                            <h3 className="text-red-500 font-bold text-sm mb-0.5">Error Loading Bookmarks</h3>
                            <p className="text-red-400 text-xs">{error}</p>
                            <button
                                onClick={fetchBookmarks}
                                className="mt-2 text-xs text-red-400 hover:text-red-300 underline"
                            >
                                Try Again
                            </button>
                        </div>
                    </div>
                )}

                {/* Loading State */}
                {loading ? (
                    <div className="flex justify-center items-center h-64">
                        <div className="w-12 h-12 border-3 border-border-subtle border-t-primary rounded-full animate-spin"></div>
                    </div>
                ) : error ? null : bookmarks.length === 0 ? (
                    <div className="text-center py-20 px-4 rounded-2xl bg-surface backdrop-blur-2xl border border-border-subtle border-dashed">
                        <BookOpen size={60} className="mx-auto mb-4 text-border-subtle" />
                        <h3 className="text-2xl font-bold text-foreground mb-2">
                            No Bookmarks Yet
                        </h3>
                        <p className="text-foreground-muted text-sm mb-6 max-w-sm mx-auto">
                            Start reading a book and your progress will be saved here automatically.
                        </p>
                        <button
                            onClick={() => router.push("/files")}
                            className="px-6 py-2.5 bg-primary text-white rounded-xl font-bold text-sm shadow-[0_4px_15px_var(--color-primary-glow)] hover:shadow-[0_8px_20px_var(--color-primary-glow)] hover:-translate-y-0.5 transition-all duration-300 relative overflow-hidden group"
                        >
                            <div className="absolute inset-0 bg-white/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                            <span className="relative z-10">Browse Files</span>
                        </button>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-3.5 pb-8">
                        {bookmarks.map((bookmark) => (
                            <div
                                key={bookmark.id}
                                className="group bg-surface/85 backdrop-blur-2xl rounded-2xl p-3.5 border border-border-subtle transition-all duration-300 hover:-translate-y-1 shadow-sm hover:shadow-md dark:shadow-[0_4px_20px_rgb(0,0,0,0.2)] flex flex-col justify-between"
                            >
                                <div>
                                    <div className="flex items-start justify-between gap-2 mb-2">
                                        <div className="flex items-center gap-1.5 flex-wrap">
                                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-surface-hover/80 backdrop-blur-md text-primary border border-border-subtle">
                                                {getFileType(bookmark.fileName || '')}
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
                                            className="text-foreground-muted hover:text-[#ef4444] transition-colors p-1 shrink-0"
                                            title="Clear Progress"
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                    </div>

                                    <h3 className="font-bold text-xs sm:text-sm text-foreground line-clamp-1 mb-2.5" title={bookmark.fileName}>
                                        {bookmark.fileName || 'Untitled'}
                                    </h3>
                                </div>

                                <div>
                                    {/* Progress Bar */}
                                    <div className="mb-2.5">
                                        <div className="flex justify-between items-center mb-1">
                                            <span className="text-[11px] text-foreground-muted">Progress</span>
                                            <span className="text-[11px] font-bold text-primary">
                                                {getProgressText(bookmark)}
                                            </span>
                                        </div>
                                        <div className="w-full h-1.5 bg-surface/60 backdrop-blur-md rounded-full overflow-hidden border border-border-subtle/50">
                                            <div
                                                className="h-full bg-linear-to-r from-primary to-purple-600 shadow-[0_0_8px_var(--color-primary-glow)] transition-all duration-300"
                                                style={{ width: `${bookmark.progress || 0}%` }}
                                            />
                                        </div>
                                    </div>

                                    {/* Continue Reading Button */}
                                    <button
                                        onClick={() => handleContinueReading(bookmark)}
                                        className="w-full flex items-center justify-center gap-1.5 px-3 py-2 bg-primary text-white rounded-xl font-bold text-xs shadow-sm hover:shadow-md hover:bg-primary-hover hover:-translate-y-0.5 transition-all duration-200 relative overflow-hidden group/btn"
                                    >
                                        <div className="absolute inset-0 bg-white/20 opacity-0 group-hover/btn:opacity-100 transition-opacity duration-200" />
                                        <BookOpen size={14} className="relative z-10" />
                                        <span className="relative z-10">Continue</span>
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Glassmorphic Clear Progress Confirmation Modal */}
            {bookmarkToDelete && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-md animate-in fade-in duration-200">
                    <div className="bg-surface/90 backdrop-blur-2xl border border-border-subtle rounded-2xl p-5 max-w-sm w-full shadow-2xl animate-in zoom-in-95 duration-200 space-y-4">
                        <div className="w-10 h-10 rounded-xl bg-red-500/10 border border-red-500/20 text-red-500 flex items-center justify-center">
                            <Trash2 size={20} />
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-foreground mb-1">Clear Reading Progress</h3>
                            <p className="text-foreground-muted text-xs">
                                Are you sure you want to clear saved progress for <span className="font-semibold text-foreground">&quot;{bookmarkToDelete.fileName}&quot;</span>?
                            </p>
                        </div>
                        <div className="flex gap-2.5 pt-1">
                            <button
                                onClick={() => setBookmarkToDelete(null)}
                                className="flex-1 py-2 px-3 bg-surface-hover/80 hover:bg-surface-hover text-foreground font-semibold text-xs rounded-xl border border-border-subtle transition-all duration-200"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={confirmDeleteBookmark}
                                className="flex-1 py-2 px-3 bg-red-600 hover:bg-red-700 text-white font-semibold text-xs rounded-xl shadow-md hover:shadow-red-600/30 transition-all duration-200"
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
