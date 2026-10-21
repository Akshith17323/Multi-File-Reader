"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiClient } from "@/services/apiClient";
import { BookOpen, Trash2, Clock, AlertCircle, Cloud, HardDrive } from "lucide-react";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

import { getLocalBookmarksMap, deleteBookmarkUnified } from "@/utils/localBookmarks";
import { isLocalFile } from "@/app/files/page";

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
    const router = useRouter();

    const fetchBookmarks = async () => {
        setLoading(true);
        setError(null);

        try {
            const localMap = getLocalBookmarksMap();
            const localList: Bookmark[] = Object.values(localMap).map((b) => ({
                id: b.fileUrl,
                fileUrl: b.fileUrl,
                fileName: b.fileName || b.fileUrl.split("/").pop() || "Untitled",
                pageNumber: b.pageNumber,
                totalPages: b.totalPages,
                cfi: b.cfi,
                progress: b.progress,
                lastRead: b.lastRead || new Date().toISOString(),
            }));

            const token = localStorage.getItem("token");
            if (!token) {
                setBookmarks(localList);
                setLoading(false);
                return;
            }

            let cloudList: Bookmark[] = [];
            try {
                const data = await apiClient.getAllBookmarks(token);
                cloudList = data.bookmarks || [];
            } catch (cErr) {
                console.warn("Could not fetch remote bookmarks, showing local:", cErr);
            }

            // Merge local and cloud bookmarks
            const mergedMap = new Map<string, Bookmark>();
            localList.forEach((b) => mergedMap.set(b.fileUrl, b));
            cloudList.forEach((b) => mergedMap.set(b.fileUrl, b));

            setBookmarks(Array.from(mergedMap.values()));
        } catch (error: unknown) {
            const err = error as Error;
            console.error("Error fetching bookmarks:", err);
            setError(err.message || "Failed to load bookmarks");
            toast.error(err.message || "Failed to load bookmarks");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchBookmarks();
    }, []);

    const handleDelete = async (bookmark: Bookmark) => {
        if (!confirm(`Clear progress for "${bookmark.fileName}"?`)) return;

        try {
            const token = localStorage.getItem("token");
            await deleteBookmarkUnified(token, bookmark.fileUrl);

            toast.success("Progress cleared successfully");
            setBookmarks(prev => prev.filter(b => b.fileUrl !== bookmark.fileUrl));

        } catch (error: unknown) {
            const err = error as Error;
            console.error("Error deleting bookmark:", err);
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

    const getFileType = (fileName: string) => {
        if (fileName?.toLowerCase().endsWith('.pdf')) return 'PDF';
        if (fileName?.toLowerCase().endsWith('.epub')) return 'EPUB';
        return 'DOC';
    };

    return (
        <div className="min-h-screen p-8 md:p-12 relative bg-background">
            <ToastContainer position="top-right" theme="light" />

            <div className="max-w-7xl mx-auto">
                {/* Header */}
                <div className="mb-16">
                    <h1 className="text-3xl md:text-4xl font-extrabold text-foreground tracking-tight mb-2">
                        My Bookmarks
                    </h1>
                    <p className="text-foreground-muted text-base font-medium">
                        Continue where you left off
                    </p>
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
                    <div className="text-center py-32 px-4 rounded-3xl bg-surface border border-border-subtle border-dashed">
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
                                className="group bg-surface backdrop-blur-2xl rounded-3xl p-6 border border-border-subtle transition-all duration-500 hover:-translate-y-2 shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:shadow-[0_15px_40px_rgb(0,0,0,0.08)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.2)] dark:hover:shadow-[0_15px_40px_rgb(0,0,0,0.4)]"
                            >
                                <div className="flex items-start justify-between gap-4 mb-4">
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-2">
                                            <span className="text-xs font-bold px-2 py-1 rounded-md bg-surface-hover text-primary border border-border-subtle">
                                                {getFileType(bookmark.fileName || '')}
                                            </span>
                                            <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-md flex items-center gap-1 ${
                                                isLocalFile(bookmark.fileUrl) ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30" : "bg-sky-500/15 text-sky-400 border border-sky-500/30"
                                            }`}>
                                                {isLocalFile(bookmark.fileUrl) ? <HardDrive size={10} /> : <Cloud size={10} />}
                                                <span>{isLocalFile(bookmark.fileUrl) ? "Local" : "Cloud"}</span>
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
                                        className="text-foreground-muted hover:text-[#ef4444] transition-colors p-2 shrink-0"
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
                                    <div className="w-full h-2 bg-border-subtle rounded-full overflow-hidden">
                                        <div
                                            className="h-full bg-linear-to-r from-primary to-purple-600 transition-all duration-300"
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
        </div>
    );
}
