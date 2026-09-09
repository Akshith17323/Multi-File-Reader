"use client";

import { useState, ReactNode } from "react";
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
}

export default function UnifiedReaderLayout({
    children,
    openFiles,
    activeFileIndex,
    onTabChange,
    onTabClose,
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
        <div className="h-screen flex flex-col bg-[#0a0a0a] overflow-hidden">
            {/* Background Gradients (Subtle) */}
            <div className="absolute top-0 left-0 w-full h-full bg-[#0a0a0a]" />
            <div className="absolute top-[-10%] left-[-5%] w-[400px] h-[400px] bg-violet-600/5 rounded-full blur-[100px] pointer-events-none mix-blend-screen" />
            <div className="absolute bottom-[-10%] right-[-5%] w-[400px] h-[400px] bg-fuchsia-600/5 rounded-full blur-[100px] pointer-events-none mix-blend-screen" />

            {/* Top Control Bar */}
            <div className="relative z-20 bg-[#1a1a1a]/80 backdrop-blur-xl border-b border-[#2e2f36] px-6 py-3">
                <div className="flex items-center justify-between gap-4">
                    {/* Left: Back to Library */}
                    <div className="flex items-center gap-4">
                        <button
                            onClick={handleBackToLibrary}
                            className="p-2 hover:bg-[#2e2f36] rounded-lg text-[#a2a2a2] hover:text-white transition-colors"
                            title="Back to Library"
                        >
                            <ChevronLeft size={20} />
                        </button>

                        {activeFile && (
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-lg bg-[#252830] flex items-center justify-center">
                                    {isPdf ? (
                                        <FileText size={16} className="text-blue-400" />
                                    ) : (
                                        <ScrollText size={16} className="text-purple-400" />
                                    )}
                                </div>
                                <div>
                                    <h2 className="text-sm font-semibold text-white truncate max-w-[300px]">
                                        {activeFile.name}
                                    </h2>
                                    <p className="text-xs text-[#737373]">
                                        {activeFile.type.toUpperCase()}
                                    </p>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Center: Page Navigation (for paginated modes) */}
                    {(viewMode === "single" || viewMode === "two-page") && (isEpub || (currentPage && totalPages)) && (
                        <div className="flex items-center gap-3 bg-[#252830] rounded-lg px-4 py-2">
                            <button
                                onClick={onPrevPage}
                                disabled={!isEpub && !!currentPage && currentPage <= 1}
                                className="p-1 text-[#a2a2a2] hover:text-white disabled:opacity-30 disabled:hover:text-[#a2a2a2] transition-colors"
                            >
                                <ChevronLeft size={18} />
                            </button>
                            <span className="text-sm font-medium text-white min-w-20 text-center">
                                {isEpub && epubProgress !== undefined 
                                    ? `${Math.round(epubProgress * 100)}%` 
                                    : `${currentPage} / ${totalPages}`}
                            </span>
                            <button
                                onClick={onNextPage}
                                disabled={!isEpub && !!currentPage && !!totalPages && currentPage >= totalPages}
                                className="p-1 text-[#a2a2a2] hover:text-white disabled:opacity-30 disabled:hover:text-[#a2a2a2] transition-colors"
                            >
                                <ChevronLeft size={18} className="rotate-180" />
                            </button>
                        </div>
                    )}

                    {/* Right: View Mode & Controls */}
                    <div className="flex items-center gap-2">
                        {/* View Mode Toggles */}
                        <div className="flex items-center gap-1 bg-[#252830] rounded-lg p-1">
                            <button
                                onClick={() => onViewModeChange("single")}
                                className={`p-2 rounded transition-colors ${viewMode === "single"
                                    ? "bg-blue-500/20 text-blue-400"
                                    : "text-[#737373] hover:text-white"
                                    }`}
                                title="Single Page"
                            >
                                <FileText size={16} />
                            </button>
                            <button
                                onClick={() => onViewModeChange("two-page")}
                                className={`p-2 rounded transition-colors ${viewMode === "two-page"
                                    ? "bg-blue-500/20 text-blue-400"
                                    : "text-[#737373] hover:text-white"
                                    }`}
                                title="Two Page"
                            >
                                <Columns size={16} />
                            </button>
                            <button
                                onClick={() => onViewModeChange("continuous")}
                                className={`p-2 rounded transition-colors ${viewMode === "continuous"
                                    ? "bg-blue-500/20 text-blue-400"
                                    : "text-[#737373] hover:text-white"
                                    }`}
                                title="Continuous Scroll"
                            >
                                <ScrollText size={16} />
                            </button>
                        </div>

                        {/* Fit Mode (PDF only) */}
                        {isPdf && (
                            <div className="flex items-center gap-1 bg-[#252830] rounded-lg p-1">
                                <button
                                    onClick={() => onFitModeChange("width")}
                                    className={`p-2 rounded transition-colors ${fitMode === "width"
                                        ? "bg-blue-500/20 text-blue-400"
                                        : "text-[#737373] hover:text-white"
                                        }`}
                                    title="Fit Width"
                                >
                                    <ArrowLeftRight size={16} />
                                </button>
                                <button
                                    onClick={() => onFitModeChange("height")}
                                    className={`p-2 rounded transition-colors ${fitMode === "height"
                                        ? "bg-blue-500/20 text-blue-400"
                                        : "text-[#737373] hover:text-white"
                                        }`}
                                    title="Fit Height"
                                >
                                    <ArrowUpDown size={16} />
                                </button>
                            </div>
                        )}

                        {/* Zoom Controls (PDF with 'none' fit mode) */}
                        {isPdf && fitMode === "none" && zoom && (
                            <div className="flex items-center gap-2 bg-[#252830] rounded-lg px-3 py-2">
                                <button
                                    onClick={onZoomOut}
                                    className="text-[#a2a2a2] hover:text-white transition-colors"
                                >
                                    <ZoomOut size={16} />
                                </button>
                                <span className="text-sm text-white font-medium min-w-[3ch] text-center">
                                    {Math.round(zoom * 100)}%
                                </span>
                                <button
                                    onClick={onZoomIn}
                                    className="text-[#a2a2a2] hover:text-white transition-colors"
                                >
                                    <ZoomIn size={16} />
                                </button>
                            </div>
                        )}

                        {/* Font Size Controls (EPUB only) */}
                        {isEpub && fontSize && (
                            <div className="flex items-center gap-2 bg-[#252830] rounded-lg px-3 py-2">
                                <button
                                    onClick={onFontSizeDecrease}
                                    className="text-[#a2a2a2] hover:text-white transition-colors"
                                >
                                    <ZoomOut size={16} />
                                </button>
                                <span className="text-sm text-white font-medium min-w-[3ch] text-center">
                                    {fontSize}%
                                </span>
                                <button
                                    onClick={onFontSizeIncrease}
                                    className="text-[#a2a2a2] hover:text-white transition-colors"
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
            bg-[#16171b]/95 backdrop-blur-xl border-r border-[#2e2f36] flex flex-col
            transition-all duration-300
            ${isSidebarCollapsed ? "w-0" : "w-72"}
          `}
                >
                    {!isSidebarCollapsed && (
                        <>
                            <div className="p-4 border-b border-[#2e2f36]">
                                <h3 className="text-xs font-semibold text-[#737373] uppercase tracking-wider mb-1">
                                    Open Files
                                </h3>
                                <p className="text-xs text-[#525252]">
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
                            <div className="p-3 border-t border-[#2e2f36]">
                                <button
                                    onClick={handleBackToLibrary}
                                    className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium transition-colors"
                                >
                                    <span className="text-xl">+</span>
                                    <span>Add File</span>
                                </button>
                            </div>

                            {/* Quick Stats at Bottom */}
                            {activeFile && (
                                <div className="p-4 border-t border-[#2e2f36] bg-[#1a1a1a]/50">
                                    <div className="text-xs text-[#737373] space-y-1">
                                        {((currentPage && totalPages) || (isEpub && epubProgress !== undefined)) ? (
                                            <div className="flex justify-between">
                                                <span>Progress</span>
                                                <span className="text-white font-medium">
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
                </div>

                {/* Main Reading Area */}
                <div className="flex-1 overflow-hidden">
                    {children}
                </div>
            </div>
        </div>
    );
}
