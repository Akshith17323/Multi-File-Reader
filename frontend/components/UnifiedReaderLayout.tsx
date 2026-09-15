"use client";

import { useState, useEffect, ReactNode } from "react";
import { ChevronLeft, ZoomIn, ZoomOut, FileText, ScrollText, Columns, ArrowLeftRight, ArrowUpDown } from "lucide-react";
import { useRouter } from "next/navigation";
import FileTab, { FileTabData } from "./FileTab";

export type ViewMode = "single" | "continuous" | "two-page";
export type FitMode = "width" | "height" | "none";

interface UnifiedReaderLayoutProps {
    children: ReactNode;
    openFiles: FileTabData[];
    activeFileIndex: number;
    onTabChange: (index: number) => void;
    onTabClose: (index: number) => void;

    // Reader controls
    currentPage?: number;
    totalPages?: number;
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
}

export default function UnifiedReaderLayout({
    children,
    openFiles,
    activeFileIndex,
    onTabChange,
    onTabClose,
    currentPage,
    totalPages,
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
}: UnifiedReaderLayoutProps) {
    const router = useRouter();
    const [isSidebarCollapsed] = useState(false);

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
        <div className="h-screen flex flex-col bg-background overflow-hidden">
            {/* Background Gradients (Subtle) */}
            <div className="absolute top-0 left-0 w-full h-full bg-background" />
            <div className="absolute top-[-10%] left-[-5%] w-[400px] h-[400px] bg-violet-600/5 rounded-full blur-[100px] pointer-events-none mix-blend-multiply" />
            <div className="absolute bottom-[-10%] right-[-5%] w-[400px] h-[400px] bg-primary/5 rounded-full blur-[100px] pointer-events-none mix-blend-multiply" />

            {/* Top Control Bar */}
            <div className="relative z-20 bg-surface/80 backdrop-blur-xl border-b border-border-subtle px-6 py-3">
                <div className="flex items-center justify-between gap-4">
                    {/* Left: Back to Library */}
                    <div className="flex items-center gap-4">
                        <button
                            onClick={handleBackToLibrary}
                            className="p-2 hover:bg-surface-hover rounded-lg text-foreground-muted hover:text-foreground transition-colors"
                            title="Back to Library"
                        >
                            <ChevronLeft size={20} />
                        </button>

                        {activeFile && (
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-lg bg-surface-hover flex items-center justify-center">
                                    {isPdf ? (
                                        <FileText size={16} className="text-primary" />
                                    ) : (
                                        <ScrollText size={16} className="text-primary" />
                                    )}
                                </div>
                                <div>
                                    <h2 className="text-sm font-semibold text-foreground truncate max-w-[300px]">
                                        {activeFile.name}
                                    </h2>
                                    <p className="text-xs text-foreground-muted">
                                        {activeFile.type.toUpperCase()}
                                    </p>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Center: Page Navigation (for paginated modes) */}
                    {(viewMode === "single" || viewMode === "two-page") && currentPage && totalPages && (
                        <div className="flex items-center gap-3 bg-surface rounded-lg px-4 py-2 border border-border-subtle">
                            <button
                                onClick={onPrevPage}
                                disabled={currentPage <= 1}
                                className="p-1 text-foreground-muted hover:text-foreground disabled:opacity-30 disabled:hover:text-foreground-muted transition-colors"
                            >
                                <ChevronLeft size={18} />
                            </button>
                            <span className="text-sm font-medium text-foreground min-w-20 text-center">
                                {currentPage} / {totalPages}
                            </span>
                            <button
                                onClick={onNextPage}
                                disabled={currentPage >= totalPages}
                                className="p-1 text-foreground-muted hover:text-foreground disabled:opacity-30 disabled:hover:text-foreground-muted transition-colors"
                            >
                                <ChevronLeft size={18} className="rotate-180" />
                            </button>
                        </div>
                    )}

                    {/* Right: View Mode & Controls */}
                    <div className="flex items-center gap-2">
                        {/* View Mode Toggles */}
                        <div className="flex items-center gap-1 bg-surface rounded-lg p-1 border border-border-subtle">
                            <button
                                onClick={() => onViewModeChange("single")}
                                className={`p-2 rounded transition-colors ${viewMode === "single"
                                    ? "bg-primary/20 text-primary"
                                    : "text-foreground-muted hover:text-foreground hover:bg-surface-hover"
                                    }`}
                                title="Single Page"
                            >
                                <FileText size={16} />
                            </button>
                            <button
                                onClick={() => onViewModeChange("two-page")}
                                className={`p-2 rounded transition-colors ${viewMode === "two-page"
                                    ? "bg-primary/20 text-primary"
                                    : "text-foreground-muted hover:text-foreground hover:bg-surface-hover"
                                    }`}
                                title="Two Page"
                            >
                                <Columns size={16} />
                            </button>
                            <button
                                onClick={() => onViewModeChange("continuous")}
                                className={`p-2 rounded transition-colors ${viewMode === "continuous"
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
                            <div className="flex items-center gap-1 bg-surface rounded-lg p-1 border border-border-subtle">
                                <button
                                    onClick={() => onFitModeChange("width")}
                                    className={`p-2 rounded transition-colors ${fitMode === "width"
                                        ? "bg-primary/20 text-primary"
                                        : "text-foreground-muted hover:text-foreground hover:bg-surface-hover"
                                        }`}
                                    title="Fit Width"
                                >
                                    <ArrowLeftRight size={16} />
                                </button>
                                <button
                                    onClick={() => onFitModeChange("height")}
                                    className={`p-2 rounded transition-colors ${fitMode === "height"
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
                            <div className="flex items-center gap-2 bg-surface rounded-lg px-3 py-2 border border-border-subtle">
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

                        {/* Font Size Controls (EPUB only) */}
                        {isEpub && fontSize && (
                            <div className="flex items-center gap-2 bg-surface rounded-lg px-3 py-2 border border-border-subtle">
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
                    </div>
                </div>
            </div>

            {/* Main Content Area */}
            <div className="flex-1 flex overflow-hidden relative z-10">
                {/* Left Sidebar - File Tabs */}
                <div
                    className={`
            bg-surface/95 backdrop-blur-xl border-r border-border-subtle flex flex-col
            transition-all duration-300
            ${isSidebarCollapsed ? "w-0" : "w-72"}
          `}
                >
                    {!isSidebarCollapsed && (
                        <>
                            <div className="p-4 border-b border-border-subtle">
                                <h3 className="text-xs font-semibold text-foreground-muted uppercase tracking-wider mb-1">
                                    Open Files
                                </h3>
                                <p className="text-xs text-foreground-muted">
                                    {openFiles.length} {openFiles.length === 1 ? "file" : "files"} open
                                </p>
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

                            {/* Add New File Button */}
                            <div className="p-3 border-t border-border-subtle">
                                <button
                                    onClick={handleBackToLibrary}
                                    className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-primary hover:bg-primary-hover text-white rounded-xl font-medium transition-colors shadow-md hover:shadow-lg"
                                >
                                    <span className="text-xl">+</span>
                                    <span>Add File</span>
                                </button>
                            </div>

                            {/* Quick Stats at Bottom */}
                            {activeFile && (
                                <div className="p-4 border-t border-border-subtle bg-surface-hover/50">
                                    <div className="text-xs text-foreground-muted min-w-20">
                                        {currentPage && totalPages && (
                                            <div className="flex justify-between">
                                                <span>Progress</span>
                                                <span className="text-foreground font-medium">
                                                    {Math.round((currentPage / totalPages) * 100)}%
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </div>

                {/* Main Reading Area */}
                <div className="flex-1 overflow-hidden">
                    {children}
                </div>
            </div>
        </div>
    );
}
