"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiClient } from "@/services/apiClient";
import { getLocalBookmarksMap, mergeBookmarks, deleteBookmarkUnified } from "@/utils/localBookmarks";
import { createReaderUrl } from "@/utils/readerSession";
import { isElectron } from "@/hooks/useEnvironment";
import { isLocalFileUrl } from "@/utils/fileUrls";
import { BookOpen, Trash2, Clock, FileText, Layers, ArrowRight, BookmarkCheck } from "lucide-react";
import AppShell, { PageHeader } from "@/components/ui/AppShell";
import InlineNotice, { type NoticeMessage } from "@/components/ui/InlineNotice";
import { CLOUD_STORAGE_ENABLED, CLOUD_STORAGE_UNAVAILABLE_MESSAGE } from "@/config/serviceStatus";

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
    const [notice, setNotice] = useState<NoticeMessage | null>(null);
    const [bookmarkToDelete, setBookmarkToDelete] = useState<Bookmark | null>(null);
    const router = useRouter();

    const fetchBookmarks = async () => {
        setLoading(true);
        setError(null);

        try {
            const token = localStorage.getItem("token");
            if (!token && !isElectron()) {
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
        setNotice(null);

        try {
            const token = localStorage.getItem("token");
            await deleteBookmarkUnified(token, bookmark.fileUrl);

            setNotice({ tone: "success", message: "Progress cleared successfully." });
            setBookmarks(prev => prev.filter(b => b.id !== bookmark.id));

        } catch (error: unknown) {
            const err = error as Error;
            console.error("❌ Error deleting bookmark:", err);
            setNotice({ tone: "error", message: err.message || "Failed to delete bookmark" });
        }
    };

    const handleContinueReading = (bookmark: Bookmark) => {
        if (!CLOUD_STORAGE_ENABLED && !isLocalFileUrl(bookmark.fileUrl)) { setNotice({ tone: "warning", message: CLOUD_STORAGE_UNAVAILABLE_MESSAGE }); return; }
        if (isLocalFileUrl(bookmark.fileUrl) && !isElectron()) { setNotice({ tone: "info", message: "Open this local document in the desktop app." }); return; }
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

    const getFormatBadge = (fileName: string) => {
        const ext = fileName?.toLowerCase().split('.').pop() || '';
        if (ext === 'pdf') {
            return {
                label: 'PDF',
                icon: <FileText size={12} className="text-foreground" />,
                badgeClass: 'bg-foreground/10 text-foreground border-foreground/20'
            };
        }
        if (ext === 'epub') {
            return {
                label: 'EPUB',
                icon: <BookOpen size={12} className="text-foreground" />,
                badgeClass: 'bg-foreground/10 text-foreground border-foreground/20'
            };
        }
        return {
            label: ext ? ext.toUpperCase() : 'DOC',
            icon: <Layers size={12} className="text-foreground" />,
            badgeClass: 'bg-foreground/10 text-foreground border-foreground/20'
        };
    };

    return (
        <AppShell contentClassName="space-y-7">
                <PageHeader
                    eyebrow="Reading history"
                    title="My"
                    accent="Bookmarks"
                    description="Pick up right where you left off across any document."
                    action={bookmarks.length > 0 ? <div className="mfr-panel flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-semibold text-foreground-muted"><BookmarkCheck size={16} className="text-primary" /><span className="font-bold text-foreground">{bookmarks.length}</span>{bookmarks.length === 1 ? "bookmark saved" : "bookmarks saved"}</div> : undefined}
                />

                {notice && <InlineNotice tone={notice.tone} onDismiss={() => setNotice(null)}>{notice.message}</InlineNotice>}

                {/* Error State */}
                {error && !loading && (
                    <InlineNotice tone="error" title="Could not load your bookmarks" action={<button type="button" onClick={fetchBookmarks} className="mfr-button-secondary">Try again</button>}>{error}</InlineNotice>
                )}

                {/* Loading State */}
                {loading ? (
                    <div className="flex flex-col justify-center items-center h-72 gap-3">
                        <div className="w-12 h-12 border-3 border-border-subtle border-t-primary rounded-full animate-spin"></div>
                        <p className="text-xs text-foreground-muted font-medium">Loading reading history...</p>
                    </div>
                ) : error ? null : bookmarks.length === 0 ? (
                    <div className="mfr-panel text-center py-12 px-6 rounded-xl space-y-4">
                        <div className="w-12 h-12 rounded-lg bg-surface-hover border border-border-subtle flex items-center justify-center mx-auto mb-2 text-foreground-muted">
                            <BookOpen size={24} />
                        </div>
                        <h3 className="text-xl font-semibold text-foreground mb-1">
                            No Bookmarks Yet
                        </h3>
                        <p className="text-foreground-muted text-xs sm:text-sm mb-4 max-w-md mx-auto leading-relaxed">
                            Start reading any document in your library and your latest page and progress will be saved here automatically.
                        </p>

                        {/* Supported Formats preview */}
                        <div className="grid grid-cols-3 gap-2 max-w-sm mx-auto mb-4">
                            <div className="p-2 rounded-lg bg-surface-hover/50 border border-border-subtle text-center">
                                <span className="text-xs font-medium text-foreground">PDF</span>
                                <p className="text-[10px] text-foreground-muted">Saved page</p>
                            </div>
                            <div className="p-2 rounded-lg bg-surface-hover/50 border border-border-subtle text-center">
                                <span className="text-xs font-medium text-foreground">EPUB</span>
                                <p className="text-[10px] text-foreground-muted">Reading position</p>
                            </div>
                            <div className="p-2 rounded-lg bg-surface-hover/50 border border-border-subtle text-center">
                                <span className="text-xs font-medium text-foreground">TXT</span>
                                <p className="text-[10px] text-foreground-muted">Saved progress</p>
                            </div>
                        </div>

                        <button
                            onClick={() => router.push("/files")}
                            className="mfr-button-primary inline-flex items-center gap-1.5"
                        >
                            <span>Explore Library</span>
                            <ArrowRight size={14} />
                        </button>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 pb-4">
                        {bookmarks.map((bookmark) => {
                            const badge = getFormatBadge(bookmark.fileName || '');
                            return (
                                <div
                                    key={bookmark.id}
                                    className="mfr-panel group rounded-xl p-4 border border-border-subtle bg-surface hover:border-primary/30 transition-colors flex flex-col justify-between"
                                >
                                    <div>
                                        <div className="flex items-start justify-between gap-2 mb-2.5">
                                            <div className="flex items-center gap-1.5 flex-wrap">
                                                <span className={`inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded border ${badge.badgeClass}`}>
                                                    {badge.icon}
                                                    {badge.label}
                                                </span>
                                                <span className="text-[11px] text-foreground-muted flex items-center gap-1 font-mono">
                                                    <Clock size={11} />
                                                    {new Date(bookmark.lastRead).toLocaleDateString()}
                                                </span>
                                            </div>

                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleDelete(bookmark);
                                                }}
                                                className="text-foreground-muted hover:text-foreground p-1 rounded-md transition-colors shrink-0"
                                                title="Clear Progress"
                                            >
                                                <Trash2 size={13} />
                                            </button>
                                        </div>

                                        <h3
                                            className="font-medium text-sm text-foreground line-clamp-2 mb-3 leading-snug"
                                            title={bookmark.fileName}
                                        >
                                            {bookmark.fileName || 'Untitled Document'}
                                        </h3>
                                    </div>

                                    <div className="space-y-3 pt-1">
                                        {/* Progress Bar */}
                                        <div>
                                            <div className="flex justify-between items-center mb-1">
                                                <span className="text-[11px] font-medium text-foreground-muted">Progress</span>
                                                <span className="text-[11px] font-mono tabular-nums text-foreground">
                                                    {getProgressText(bookmark)}
                                                </span>
                                            </div>
                                            <div className="w-full h-1 bg-surface-hover rounded-full overflow-hidden border border-border-subtle">
                                                <div
                                                    className="h-full bg-primary shadow-[0_0_8px_var(--color-primary-glow)] transition-all duration-300"
                                                    style={{ width: `${Math.min(100, Math.max(0, bookmark.progress || 0))}%` }}
                                                />
                                            </div>
                                        </div>

                                        {/* Continue Reading Button */}
                                        <button
                                            onClick={() => handleContinueReading(bookmark)}
                                            className="mfr-button-primary w-full"
                                        >
                                            <BookOpen size={14} />
                                            <span>Continue Reading</span>
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            {/* Clear Progress Confirmation Modal */}
            {bookmarkToDelete && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
                    <div className="bg-surface border border-border-subtle rounded-xl p-6 max-w-sm w-full space-y-4">
                        <div className="w-10 h-10 rounded-lg bg-surface-hover border border-border-subtle text-foreground flex items-center justify-center">
                            <Trash2 size={20} />
                        </div>
                        <div>
                            <h3 className="text-base font-semibold text-foreground mb-1">Clear Bookmark</h3>
                            <p className="text-foreground-muted text-xs leading-relaxed">
                                Are you sure you want to clear saved progress for <span className="font-medium text-foreground">&quot;{bookmarkToDelete.fileName}&quot;</span>?
                            </p>
                        </div>
                        <div className="flex gap-2 pt-1">
                            <button
                                onClick={() => setBookmarkToDelete(null)}
                                className="flex-1 py-1.5 px-3 bg-surface hover:bg-surface-hover text-foreground font-medium text-xs rounded-md border border-border-subtle transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={confirmDeleteBookmark}
                                className="flex-1 py-1.5 px-3 bg-primary hover:bg-primary-hover text-on-primary font-medium text-xs rounded-md transition-colors"
                            >
                                Clear
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </AppShell>
    );
}
