"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
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
    const router = useRouter();

    useEffect(() => {
        fetchBookmarks();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

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

            const res = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/api/bookmarks/all`, {
                headers: {
                    Authorization: `Bearer ${token}`
                }
            });

            if (res.status === 401) {
                toast.error("Session expired, please login again");
                localStorage.removeItem("token");
                localStorage.removeItem("user");
                window.dispatchEvent(new Event("auth-change"));
                router.push("/auth/login");
                setLoading(false);
                return;
            }

            if (!res.ok) {
                const errorData = await res.json().catch(() => ({ message: 'Unknown error' }));
                throw new Error(errorData.message || "Failed to fetch bookmarks");
            }

            const data = await res.json();
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

    const handleDelete = async (bookmark: Bookmark) => {
        if (!confirm(`Clear progress for "${bookmark.fileName}"?`)) return;

        try {
            const token = localStorage.getItem("token");
            if (!token) {
                toast.error("Please login");
                return;
            }

            const res = await fetch(
                `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/bookmarks?fileUrl=${encodeURIComponent(bookmark.fileUrl)}`,
                {
                    method: "DELETE",
                    headers: {
                        Authorization: `Bearer ${token}`
                    }
                }
            );

            if (!res.ok) {
                throw new Error("Failed to delete bookmark");
            }

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
                            className="px-10 py-4 bg-primary text-white hover:bg-primary-hover rounded-xl transition-all font-bold text-lg shadow-xl hover:shadow-2xl hover:-translate-y-1"
                        >
                            Browse Files
                        </button>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {bookmarks.map((bookmark) => (
                            <div
                                key={bookmark.id}
                                className="group bg-surface rounded-2xl p-6 border border-border-subtle hover:border-foreground-muted transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl hover:shadow-black/50"
                            >
                                <div className="flex items-start justify-between gap-4 mb-4">
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-2">
                                            <span className="text-xs font-bold px-2 py-1 rounded-md bg-surface-hover text-primary border border-border-subtle">
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
                                    className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-primary hover:bg-primary-hover text-white rounded-xl font-bold transition-all hover:shadow-lg hover:shadow-primary/20"
                                >
                                    <BookOpen size={18} />
                                    <span>Continue Reading</span>
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
