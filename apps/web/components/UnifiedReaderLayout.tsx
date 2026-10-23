"use client";

import { useEffect, useState, ReactNode } from "react";
import { ChevronLeft, ZoomIn, ZoomOut, FileText, ScrollText, Columns, ArrowLeftRight, ArrowUpDown, PanelLeftClose, PanelLeftOpen, BookOpen, Plus, Search, Cloud, HardDrive } from "lucide-react";
import { useRouter } from "next/navigation";
import FileTab, { FileTabData } from "./FileTab";
import { AmbientBackground } from "./ui/AppShell";
import ThemeToggle from "./ThemeToggle";

export type ViewMode = "single" | "continuous" | "two-page";
export type FitMode = "width" | "height" | "none";

function isLocalFile(url: string, id?: string): boolean {
    if (id && id.startsWith("local_")) return true;
    if (!url) return false;
    return (
        url.startsWith("mfr-local://") ||
        url.startsWith("file://") ||
        url.startsWith("/") ||
        /^[a-zA-Z]:[\\/]/.test(url)
    );
}

interface UnifiedReaderLayoutProps {
    children: ReactNode;
    openFiles: FileTabData[];
    activeFileIndex: number;
    onTabChange: (index: number) => void;
    onTabClose: (index: number) => void;
    onOpenLocalFile?: () => void;

    // Reader controls
    currentPage?: number;
    totalPages?: number;
    epubProgress?: number;
    onNextPage?: () => void;
    onPrevPage?: () => void;

    // View controls
    viewMode: ViewMode;
    onViewModeChange: (mode: ViewMode) => void;
    fitMode: FitMode;
    onFitModeChange: (mode: FitMode) => void;

    // Zoom controls (for PDF in 'none' fit mode)
    zoom?: number;
    onZoomIn?: () => void;
    onZoomOut?: () => void;

    // Font size controls (for EPUB)
    fontSize?: number;
    onFontSizeIncrease?: () => void;
    onFontSizeDecrease?: () => void;

    // Feature 6 Extensibility (Search & Annotations)
    isSearchOpen?: boolean;
    onToggleSearch?: () => void;
    activeSidebarTab?: "files" | "annotations" | "bookmarks";
    onSidebarTabChange?: (tab: "files" | "annotations" | "bookmarks") => void;
}

export default function UnifiedReaderLayout({
    children,
    openFiles,
    activeFileIndex,
    onTabChange,
    onTabClose,
    onOpenLocalFile,
    currentPage,
    totalPages,
    epubProgress,
    onNextPage,
    onPrevPage,
    viewMode,
    onViewModeChange,
    fitMode,
    onFitModeChange,
    zoom,
    onZoomIn,
    onZoomOut,
    fontSize,
    onFontSizeIncrease,
    onFontSizeDecrease,
    isSearchOpen,
    onToggleSearch,
    activeSidebarTab = "files",
    onSidebarTabChange,
}: UnifiedReaderLayoutProps) {
    const router = useRouter();
    const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(true);

    useEffect(() => {
        setIsSidebarCollapsed(window.matchMedia("(max-width: 639px)").matches);
    }, []);

    const activeFile = openFiles[activeFileIndex];
    const isEpub = activeFile?.type === "epub";
    const isPdf = activeFile?.type === "pdf";

    const handleClose = (index: number, e: React.MouseEvent) => {
        e.stopPropagation();
        onTabClose(index);
    };

    const handleBackToLibrary = () => {
        router.push("/files");
    };

    return (
        <main className="relative isolate flex h-[calc(100svh-var(--titlebar-height))] min-h-0 flex-col overflow-hidden bg-background p-2 sm:p-3">
            <AmbientBackground />

            {/* Top Control Bar */}
            <div className="mfr-panel relative z-20 shrink-0 rounded-2xl px-3 py-2.5 sm:px-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    {/* Left: Back to Library & Tabs Toggle */}
                    <div className="flex items-center gap-2">
                        <button
                            onClick={handleBackToLibrary}
                            className="p-2 hover:bg-surface-hover rounded-lg text-foreground-muted hover:text-foreground transition-colors"
                            title="Back to Library"
                        >
                            <ChevronLeft size={20} />
                        </button>

                        <button
                            onClick={() => setIsSidebarCollapsed((prev) => !prev)}
                            className="p-2 hover:bg-surface-hover rounded-lg text-foreground-muted hover:text-foreground transition-colors"
                            aria-expanded={!isSidebarCollapsed}
                            aria-controls="reader-sidebar"
                            title={isSidebarCollapsed ? "Show Open Files Tabs" : "Hide Open Files Tabs"}
                        >
                            {isSidebarCollapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
                        </button>

                        {activeFile && (
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-lg bg-surface-hover flex items-center justify-center">
                                    {isPdf ? (
                                        <FileText size={16} className="text-red-500" />
                                    ) : isEpub ? (
                                        <ScrollText size={16} className="text-emerald-500" />
                                    ) : (
                                        <FileText size={16} className="text-sky-500" />
                                    )}
                                </div>
                                <div>
                                    <h2 className="text-sm font-semibold text-foreground truncate max-w-[120px] min-[380px]:max-w-[160px] sm:max-w-[260px]">
                                        {activeFile.name}
                                    </h2>
                                    <div className="flex items-center gap-1.5 text-xs text-foreground-muted">
                                        <span>{activeFile.type.toUpperCase()}</span>
                                        <span>•</span>
                                        <span className={`inline-flex items-center gap-1 font-medium ${
                                            isLocalFile(activeFile.url, activeFile.id) ? "text-emerald-500" : "text-primary"
                                        }`}>
                                            {isLocalFile(activeFile.url, activeFile.id) ? (
                                                <>
                                                    <HardDrive size={11} />
                                                    <span>Local Disk</span>
                                                </>
                                            ) : (
                                                <>
                                                    <Cloud size={11} />
                                                    <span>Cloud</span>
                                                </>
                                            )}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Center: Page Navigation (for paginated modes) */}
                    {(viewMode === "single" || viewMode === "two-page") && (isEpub || (currentPage && totalPages)) && (
                        <div className="flex shrink-0 items-center gap-2 bg-surface-hover/65 rounded-xl px-3 py-2 border border-border-subtle">
                            <button
                                aria-label="Previous page"
                                onClick={onPrevPage}
                                disabled={!isEpub && !!currentPage && currentPage <= 1}
                                className="p-1 text-foreground-muted hover:text-foreground disabled:opacity-30 disabled:hover:text-foreground-muted transition-colors"
                            >
                                <ChevronLeft size={18} />
                            </button>
                            <span className="text-sm font-medium text-foreground min-w-20 text-center">
                                {isEpub && epubProgress !== undefined 
                                    ? `${Math.round(epubProgress * 100)}%` 
                                    : `${currentPage} / ${totalPages}`}
                            </span>
                            <button
                                aria-label="Next page"
                                onClick={onNextPage}
                                disabled={!isEpub && !!currentPage && !!totalPages && currentPage >= totalPages}
                                className="p-1 text-foreground-muted hover:text-foreground disabled:opacity-30 disabled:hover:text-foreground-muted transition-colors"
                            >
                                <ChevronLeft size={18} className="rotate-180" />
                            </button>
                        </div>
                    )}

                    {/* Right: View Mode & Controls */}
                    <div className="flex max-w-full items-center gap-2 overflow-x-auto pb-0.5">
                        <ThemeToggle />
                        {/* View Mode Toggles */}
                        <div className="flex shrink-0 items-center gap-1 bg-surface-hover/65 rounded-xl p-1 border border-border-subtle">
                            <button
                                onClick={() => onViewModeChange("single")}
                                className={`p-2 rounded-lg transition-colors ${viewMode === "single"
                                    ? "bg-primary/20 text-primary"
                                    : "text-foreground-muted hover:text-foreground hover:bg-surface-hover"
                                    }`}
                                title="Single Page"
                            >
                                <FileText size={16} />
                            </button>
                            <button
                                onClick={() => onViewModeChange("two-page")}
                                className={`p-2 rounded-lg transition-colors ${viewMode === "two-page"
                                    ? "bg-primary/20 text-primary"
                                    : "text-foreground-muted hover:text-foreground hover:bg-surface-hover"
                                    }`}
                                title="Two Page"
                            >
                                <Columns size={16} />
                            </button>
                            <button
                                onClick={() => onViewModeChange("continuous")}
                                className={`p-2 rounded-lg transition-colors ${viewMode === "continuous"
                                    ? "bg-primary/20 text-primary"
                                    : "text-foreground-muted hover:text-foreground hover:bg-surface-hover"
                                    }`}
                                title="Continuous Scroll"
                            >
                                <ScrollText size={16} />
                            </button>
                        </div>

                        {/* Fit Mode (PDF only) */}
                        {isPdf && (
                            <div className="flex shrink-0 items-center gap-1 bg-surface-hover/65 rounded-xl p-1 border border-border-subtle">
                                <button
                                    onClick={() => onFitModeChange("width")}
                                    className={`p-2 rounded-lg transition-colors ${fitMode === "width"
                                        ? "bg-primary/20 text-primary"
                                        : "text-foreground-muted hover:text-foreground hover:bg-surface-hover"
                                        }`}
                                    title="Fit Width"
                                >
                                    <ArrowLeftRight size={16} />
                                </button>
                                <button
                                    onClick={() => onFitModeChange("height")}
                                    className={`p-2 rounded-lg transition-colors ${fitMode === "height"
                                        ? "bg-primary/20 text-primary"
                                        : "text-foreground-muted hover:text-foreground hover:bg-surface-hover"
                                        }`}
                                    title="Fit Height"
                                >
                                    <ArrowUpDown size={16} />
                                </button>
                            </div>
                        )}

                        {/* Zoom Controls (PDF with 'none' fit mode) */}
                        {isPdf && fitMode === "none" && zoom && (
                            <div className="flex shrink-0 items-center gap-2 bg-surface-hover/65 rounded-xl px-3 py-2 border border-border-subtle">
                                <button
                                    onClick={onZoomOut}
                                    className="text-foreground-muted hover:text-foreground transition-colors"
                                >
                                    <ZoomOut size={16} />
                                </button>
                                <span className="text-sm text-foreground font-medium min-w-[3ch] text-center">
                                    {Math.round(zoom * 100)}%
                                </span>
                                <button
                                    onClick={onZoomIn}
                                    className="text-foreground-muted hover:text-foreground transition-colors"
                                >
                                    <ZoomIn size={16} />
                                </button>
                            </div>
                        )}

                        {/* Font Size Controls (EPUB & Text/Code) */}
                        {!isPdf && fontSize && (
                            <div className="flex shrink-0 items-center gap-2 bg-surface-hover/65 rounded-xl px-3 py-2 border border-border-subtle">
                                <button
                                    onClick={onFontSizeDecrease}
                                    className="text-foreground-muted hover:text-foreground transition-colors"
                                >
                                    <ZoomOut size={16} />
                                </button>
                                <span className="text-sm text-foreground font-medium min-w-[3ch] text-center">
                                    {fontSize}%
                                </span>
                                <button
                                    onClick={onFontSizeIncrease}
                                    className="text-foreground-muted hover:text-foreground transition-colors"
                                >
                                    <ZoomIn size={16} />
                                </button>
                            </div>
                        )}

                        {/* Search Toggle (Feature 6 Extensibility) */}
                        {onToggleSearch && (
                            <button
                                onClick={onToggleSearch}
                                className={`p-2 rounded-lg border transition-colors ${
                                    isSearchOpen
                                        ? "bg-primary/20 text-primary border-primary/40"
                                        : "bg-surface hover:bg-surface-hover text-foreground-muted hover:text-foreground border-border-subtle"
                                }`}
                                title="Search in document (Ctrl+F / Cmd+F)"
                            >
                                <Search size={16} />
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* Main Content Area */}
            <div className="flex-1 min-h-0 flex gap-3 overflow-hidden relative z-10 mt-3">
                {/* Left Sidebar - File Tabs */}
                <aside
                    id="reader-sidebar"
                    aria-label="Open files"
                    className={`
            mfr-panel rounded-2xl flex shrink-0 flex-col
            transition-all duration-300
            ${isSidebarCollapsed ? "hidden" : "absolute inset-y-0 left-0 z-30 w-[min(18rem,calc(100vw-2rem))] bg-surface-hover sm:static sm:w-72"}
          `}
                >
                    {!isSidebarCollapsed && (
                        <>
                            <div className="p-4 border-b border-border-subtle flex items-center justify-between">
                                {onSidebarTabChange ? (
                                    <div className="flex items-center gap-1 bg-background/50 p-1 rounded-xl border border-border-subtle">
                                        <button
                                            onClick={() => onSidebarTabChange("files")}
                                            className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-colors ${
                                                activeSidebarTab === "files"
                                                    ? "bg-primary text-white shadow-sm"
                                                    : "text-foreground-muted hover:text-foreground"
                                            }`}
                                        >
                                            Files ({openFiles.length})
                                        </button>
                                        <button
                                            onClick={() => onSidebarTabChange("bookmarks")}
                                            className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-colors ${
                                                activeSidebarTab === "bookmarks"
                                                    ? "bg-primary text-white shadow-sm"
                                                    : "text-foreground-muted hover:text-foreground"
                                            }`}
                                        >
                                            Bookmarks
                                        </button>
                                    </div>
                                ) : (
                                    <div>
                                        <h3 className="text-xs font-semibold text-foreground-muted uppercase tracking-wider mb-0.5">
                                            Open Files
                                        </h3>
                                        <p className="text-xs text-foreground-muted">
                                            {openFiles.length} {openFiles.length === 1 ? "file" : "files"} open
                                        </p>
                                    </div>
                                )}
                                {onOpenLocalFile && (
                                    <button
                                        onClick={onOpenLocalFile}
                                        className="p-1.5 bg-primary/10 hover:bg-primary/20 text-primary rounded-lg transition-colors cursor-pointer"
                                        title="Open local file from disk into a new tab"
                                    >
                                        <Plus size={16} />
                                    </button>
                                )}
                            </div>

                            <div className="flex-1 overflow-y-auto p-3 space-y-2">
                                {openFiles.map((file, index) => (
                                    <FileTab
                                        key={file.id}
                                        file={file}
                                        isActive={index === activeFileIndex}
                                        onClick={() => onTabChange(index)}
                                        onClose={(e) => handleClose(index, e)}
                                    />
                                ))}
                            </div>

                            {/* Add File Actions */}
                            <div className="p-3 border-t border-border-subtle flex flex-col gap-2">
                                {onOpenLocalFile && (
                                    <button
                                        onClick={onOpenLocalFile}
                                        className="mfr-button-primary w-full"
                                        title="Open a local book or document from disk into a new tab"
                                    >
                                        <BookOpen size={16} />
                                        <span>Open Local File</span>
                                    </button>
                                )}
                                <button
                                    onClick={handleBackToLibrary}
                                    className={`w-full ${onOpenLocalFile ? "mfr-button-secondary" : "mfr-button-primary"}`}
                                >
                                    <span>+</span>
                                    <span>Browse Library</span>
                                </button>
                            </div>

                            {/* Quick Stats at Bottom */}
                            {activeFile && (
                                <div className="p-4 border-t border-border-subtle bg-surface-hover/50">
                                    <div className="text-xs text-foreground-muted min-w-20">
                                        {((currentPage && totalPages) || (isEpub && epubProgress !== undefined)) ? (
                                            <div className="flex justify-between">
                                                <span>Progress</span>
                                                <span className="text-foreground font-medium">
                                                    {isEpub && epubProgress !== undefined
                                                        ? `${Math.round(epubProgress * 100)}%`
                                                        : Math.round(((currentPage || 0) / (totalPages || 1)) * 100) + "%"}
                                                </span>
                                            </div>
                                        ) : null}
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </aside>

                {/* Main Reading Area */}
                <div className="mfr-panel min-w-0 flex-1 overflow-hidden rounded-2xl">
                    {children}
                </div>
            </div>
        </main>
    );
}
