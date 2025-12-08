"use client";

import { useState, useRef, useEffect } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut, Settings, Check, X, Menu, Grid, Columns, FileText, ScrollText, ArrowUpDown, ArrowLeftRight, Bookmark, Info, Globe, Search } from "lucide-react";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";

// Configure worker
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

interface PDFViewerProps {
    blobUrl: string;
    title?: string;
    fileUrl?: string;
}

type FitMode = "width" | "height" | "both" | "none";
type ViewMode = "single" | "continuous" | "two-page" | "two-page-continuous";

export default function PDFViewer({ blobUrl, title = "PDF Reader", fileUrl }: PDFViewerProps) {
    const [numPages, setNumPages] = useState<number>(0);
    const [pageNumber, setPageNumber] = useState<number>(1);
    const [scale, setScale] = useState<number>(1.0);
    const [containerWidth, setContainerWidth] = useState<number>(0);
    const [containerHeight, setContainerHeight] = useState<number>(0);
    const containerRef = useRef<HTMLDivElement>(null);
    const [touchStart, setTouchStart] = useState<number | null>(null);
    const [touchEnd, setTouchEnd] = useState<number | null>(null);

    // Settings State
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [fitMode, setFitMode] = useState<FitMode>("width");
    const [viewMode, setViewMode] = useState<ViewMode>("single");
    const [showControls, setShowControls] = useState(true);

    // Initial Bookmark Load
    useEffect(() => {
        if (!fileUrl) return;
        const loadBookmark = async () => {
            try {
                const token = localStorage.getItem("token");
                if (!token) return;

                const res = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/api/bookmarks?fileUrl=${encodeURIComponent(fileUrl)}`, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                if (res.ok) {
                    const data = await res.json();
                    if (data.pageNumber && data.pageNumber > 1) {
                        setPageNumber(data.pageNumber);
                    }
                }
            } catch (err) {
                console.error("Failed to load bookmark", err);
            }
        };
        loadBookmark();
    }, [fileUrl]);

    // Save Bookmark Debouncing
    useEffect(() => {
        if (!fileUrl || !numPages) return;

        const timeoutId = setTimeout(async () => {
            try {
                const token = localStorage.getItem("token");
                if (!token) return;

                const progressPct = Math.round((pageNumber / numPages) * 100);

                await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/api/bookmarks`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: `Bearer ${token}`
                    },
                    body: JSON.stringify({
                        fileUrl,
                        fileName: title,
                        pageNumber,
                        totalPages: numPages,
                        progress: progressPct
                    })
                });
            } catch (err) {
                console.error("Failed to save bookmark", err);
            }
        }, 1000); // Debounce for 1 second

        return () => clearTimeout(timeoutId);
    }, [pageNumber, fileUrl, numPages, title]);

    // Responsive sizing
    useEffect(() => {
        const resizeObserver = new ResizeObserver((entries) => {
            for (const entry of entries) {
                setContainerWidth(entry.contentRect.width);
                setContainerHeight(entry.contentRect.height);
            }
        });

        if (containerRef.current) {
            resizeObserver.observe(containerRef.current);
        }

        return () => resizeObserver.disconnect();
    }, []);

    function onDocumentLoadSuccess({ numPages }: { numPages: number }) {
        setNumPages(numPages);
    }

    // Swipe handlers
    const onTouchStart = (e: React.TouchEvent) => {
        setTouchEnd(null);
        setTouchStart(e.targetTouches[0].clientX);
    };

    const onTouchMove = (e: React.TouchEvent) => {
        setTouchEnd(e.targetTouches[0].clientX);
    };

    const onTouchEnd = () => {
        if (!touchStart || !touchEnd) return;
        const distance = touchStart - touchEnd;
        const isLeftSwipe = distance > 50;
        const isRightSwipe = distance < -50;

        if (viewMode === 'single' || viewMode === 'two-page') {
            if (isLeftSwipe && pageNumber < numPages) {
                changePage(1);
            }
            if (isRightSwipe && pageNumber > 1) {
                changePage(-1);
            }
        }
    };

    // Helper to change page respecting view mode
    const changePage = (delta: number) => {
        setPageNumber(prev => {
            const increment = viewMode === "two-page" ? delta * 2 : delta;
            const next = prev + increment;
            return Math.min(Math.max(1, next), numPages);
        });
    };

    // Calculate Page Dimensions based on Fit Mode
    const getPageDimensions = () => {
        if (!containerWidth) return {};

        let availableWidth = containerWidth;
        // Adjust for two-page view (split width)
        if (viewMode === "two-page" || viewMode === "two-page-continuous") {
            availableWidth = containerWidth / 2 - 20; // minimal gap
        }

        switch (fitMode) {
            case "width":
                return { width: availableWidth };
            case "height":
                return { height: containerHeight };
            case "both":
                return { height: containerHeight, width: availableWidth }; // Crude approximation for contain
            case "none":
                return { scale: scale };
            default:
                return { width: availableWidth };
        }
    };

    const pageProps = getPageDimensions();

    return (
        <div className="h-full flex flex-col bg-gray-900 relative overflow-hidden">
            {/* Background Gradients */}
            <div className="absolute top-[-20%] left-[-10%] w-[500px] h-[500px] bg-violet-600/30 rounded-full blur-[120px] pointer-events-none mix-blend-screen" />
            <div className="absolute bottom-[-20%] right-[-10%] w-[500px] h-[500px] bg-fuchsia-600/30 rounded-full blur-[120px] pointer-events-none mix-blend-screen" />

            {/* Header Controls Removed as per user request */}
            <div className={`absolute top-0 right-0 p-4 z-50 transition-all duration-300 ${showControls ? 'translate-y-0 opacity-100' : '-translate-y-full opacity-0'}`}>
                <div className="flex items-center gap-3 lg:hidden">
                    {/* Controls Trigger for Sidebar */}
                    <button
                        onClick={(e) => { e.stopPropagation(); setIsSidebarOpen(true); }}
                        className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-semibold transition-colors"
                    >
                        <Menu size={16} />
                        MENU
                    </button>
                </div>
            </div>

            {/* Sidebar Drawer */}
            <div className={`
                fixed inset-y-0 right-0 w-80 bg-[#16171b] border-l border-[#2e2f36] z-[60] transform transition-transform duration-300 ease-in-out text-[#a2a2a2]
                ${isSidebarOpen ? 'translate-x-0' : 'translate-x-full'} lg:translate-x-0
            `}>
                <div className="p-4 border-b border-[#2e2f36] flex items-center justify-between">
                    <div>
                        <h2 className="text-white font-semibold text-sm">You are reading</h2>
                        <p className="text-xs truncate max-w-[200px] text-blue-400">{title}</p>
                    </div>
                    {/* Only show close button on mobile or if user explicitly wants to close on desktop (optional, keeping it for flexibility) */}
                    <button
                        onClick={() => setIsSidebarOpen(false)}
                        className="p-2 hover:bg-[#2e2f36] rounded-md text-[#a2a2a2] hover:text-white transition-colors lg:hidden"
                    >
                        <X size={20} />
                    </button>
                </div>

                <div className="p-4 space-y-6 overflow-y-auto h-[calc(100vh-65px)]">
                    {/* Navigation */}
                    <div className="bg-[#1f2128] rounded-lg p-3 space-y-3">
                        <div className="flex items-center justify-between text-sm">
                            <span className="flex items-center gap-2"><Globe size={14} /> Language</span>
                            <span className="text-white">English</span>
                        </div>
                        <div className="flex items-center gap-2 bg-[#2a2c34] p-2 rounded-md justify-between">
                            <button
                                onClick={() => changePage(-1)}
                                disabled={pageNumber <= 1}
                                className="p-1 hover:text-white disabled:opacity-30"
                            >
                                <ChevronLeft size={16} />
                            </button>
                            <div className="text-center">
                                <span className="text-white text-sm font-medium">Page {pageNumber}</span>
                                <span className="text-xs text-gray-500 ml-1">/ {numPages}</span>
                            </div>
                            <button
                                onClick={() => changePage(1)}
                                disabled={pageNumber >= numPages}
                                className="p-1 hover:text-white disabled:opacity-30"
                            >
                                <ChevronRight size={16} />
                            </button>
                        </div>
                    </div>

                    <div className="space-y-1">
                        <button className="w-full flex items-center gap-3 px-3 py-3 rounded-md hover:bg-[#1f2128] text-sm transition-colors">
                            <Bookmark size={18} />
                            <span>Bookmark</span>
                        </button>
                        <button className="w-full flex items-center gap-3 px-3 py-3 rounded-md hover:bg-[#1f2128] text-sm transition-colors">
                            <Info size={18} />
                            <span>Detail</span>
                        </button>
                    </div>

                    {/* View Metrics */}
                    <div className="bg-[#1f2128] rounded-lg overflow-hidden">
                        {[
                            { id: "single", label: "Single Page", icon: FileText, type: 'view' },
                            { id: "continuous", label: "Long Strip", icon: ScrollText, type: 'view' },
                            { id: "two-page", label: "Two Page", icon: Columns, type: 'view' },
                            { id: "height", label: "Fit Height", icon: ArrowUpDown, type: 'fit' },
                            { id: "width", label: "Fit Width", icon: ArrowLeftRight, type: 'fit' },
                        ].map((item, idx) => {
                            const isActive = item.type === 'view' ? viewMode === item.id : fitMode === item.id;
                            return (
                                <button
                                    key={item.id + idx}
                                    onClick={() => {
                                        if (item.type === 'view') setViewMode(item.id as ViewMode);
                                        else setFitMode(item.id as FitMode);
                                    }}
                                    className={`w-full flex items-center justify-between px-4 py-3 text-sm transition-colors border-b border-[#2e2f36] last:border-0 ${isActive ? "text-blue-400 bg-[#252830]" : "hover:bg-[#252830] hover:text-gray-200"
                                        }`}
                                >
                                    <div className="flex items-center gap-3">
                                        <item.icon size={18} />
                                        <span>{item.label}</span>
                                    </div>
                                    {isActive && <div className="w-1.5 h-1.5 rounded-full bg-blue-400" />}
                                </button>
                            );
                        })}
                    </div>

                    {/* Zoom Controls (Visible only in Free Zoom) */}
                    {fitMode === 'none' && (
                        <div className="bg-[#1f2128] rounded-lg p-3 flex items-center justify-between">
                            <span className="text-sm font-medium text-white flex items-center gap-2">
                                <Search size={16} /> Zoom
                            </span>
                            <div className="flex items-center gap-3 bg-[#2a2c34] rounded px-2 py-1">
                                <button
                                    onClick={() => setScale(s => Math.max(0.5, s - 0.1))}
                                    className="p-1 hover:text-white"
                                >
                                    <ZoomOut size={16} />
                                </button>
                                <span className="text-xs text-white min-w-[3ch] text-center">{Math.round(scale * 100)}%</span>
                                <button
                                    onClick={() => setScale(s => Math.min(2.0, s + 0.1))}
                                    className="p-1 hover:text-white"
                                >
                                    <ZoomIn size={16} />
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Overlay for sidebar (Mobile Only) */}
            {isSidebarOpen && (
                <div
                    className="fixed inset-0 bg-black/50 z-[55] backdrop-blur-[2px] transition-opacity lg:hidden"
                    onClick={() => setIsSidebarOpen(false)}
                />
            )}

            {/* PDF Container */}
            <div
                ref={containerRef}
                onClick={() => setShowControls(prev => !prev)}
                className={`flex-1 overflow-auto bg-black/20 p-4 touch-pan-y relative z-10 transition-all duration-300 lg:mr-80`}
                onTouchStart={onTouchStart}
                onTouchMove={onTouchMove}
                onTouchEnd={onTouchEnd}
            >
                <Document
                    file={blobUrl}
                    onLoadSuccess={onDocumentLoadSuccess}
                    className="flex flex-col items-center min-h-full"
                    loading={
                        <div className="flex flex-col items-center justify-center h-40 text-white gap-3">
                            <div className="w-6 h-6 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
                            <span className="text-sm text-gray-400">Loading document...</span>
                        </div>
                    }
                >
                    {numPages > 0 && (
                        <>
                            {/* Render Logic based on View Mode */}
                            {viewMode === "single" && (
                                <Page
                                    pageNumber={pageNumber}
                                    renderTextLayer={false}
                                    renderAnnotationLayer={false}
                                    {...pageProps}
                                    className="shadow-2xl mb-4 transition-all duration-300"
                                />
                            )}

                            {viewMode === "continuous" && (
                                Array.from(new Array(numPages), (el, index) => (
                                    <Page
                                        key={`page_${index + 1}`}
                                        pageNumber={index + 1}
                                        renderTextLayer={false}
                                        renderAnnotationLayer={false}
                                        {...pageProps}
                                        className="shadow-2xl mb-4"
                                    />
                                ))
                            )}

                            {viewMode === "two-page" && (
                                <div className="flex justify-center gap-4 flex-wrap">
                                    <Page
                                        pageNumber={pageNumber}
                                        renderTextLayer={false}
                                        renderAnnotationLayer={false}
                                        {...pageProps}
                                        className="shadow-2xl"
                                    />
                                    {pageNumber + 1 <= numPages && (
                                        <Page
                                            pageNumber={pageNumber + 1}
                                            renderTextLayer={false}
                                            renderAnnotationLayer={false}
                                            {...pageProps}
                                            className="shadow-2xl"
                                        />
                                    )}
                                </div>
                            )}

                            {viewMode === "two-page-continuous" && (
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-7xl mx-auto">
                                    {Array.from(new Array(numPages), (el, index) => (
                                        <div key={`page_container_${index + 1}`} className="flex justify-center">
                                            <Page
                                                pageNumber={index + 1}
                                                renderTextLayer={false}
                                                renderAnnotationLayer={false}
                                                {...pageProps}
                                                className="shadow-2xl"
                                            />
                                        </div>
                                    ))}
                                </div>
                            )}
                        </>
                    )}
                </Document>
            </div>

            {/* Floating Navigation Bar (Only for Single/Two-Page modes) */}
            {(viewMode === "single" || viewMode === "two-page") && (
                <div className={`absolute bottom-6 left-1/2 -translate-x-1/2 bg-black/80 backdrop-blur-xl border border-white/10 rounded-full px-6 py-3 flex items-center gap-6 shadow-2xl z-50 transition-all duration-300 ${showControls ? 'translate-y-0 opacity-100' : 'translate-y-full opacity-0'}`}>
                    <button
                        onClick={(e) => { e.stopPropagation(); changePage(-1); }}
                        disabled={pageNumber <= 1}
                        className="text-white hover:text-blue-400 disabled:opacity-30 disabled:hover:text-white transition-colors"
                    >
                        <ChevronLeft size={24} />
                    </button>

                    <span className="text-white font-medium min-w-[80px] text-center">
                        {pageNumber} / {numPages || "--"}
                    </span>

                    <button
                        onClick={(e) => { e.stopPropagation(); changePage(1); }}
                        disabled={pageNumber >= numPages}
                        className="text-white hover:text-blue-400 disabled:opacity-30 disabled:hover:text-white transition-colors"
                    >
                        <ChevronRight size={24} />
                    </button>
                </div>
            )}
        </div>
    );
}
