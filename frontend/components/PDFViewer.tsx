"use client";

import { useState, useRef, useEffect } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut, Settings, Check, X } from "lucide-react";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";

// Configure worker
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

interface PDFViewerProps {
    blobUrl: string;
    title?: string;
}

type FitMode = "width" | "height" | "both" | "none";

export default function PDFViewer({ blobUrl, title = "PDF Reader" }: PDFViewerProps) {
    const [numPages, setNumPages] = useState<number>(0);
    const [pageNumber, setPageNumber] = useState<number>(1);
    const [scale, setScale] = useState<number>(1.0);
    const [containerWidth, setContainerWidth] = useState<number>(0);
    const [containerHeight, setContainerHeight] = useState<number>(0);
    const containerRef = useRef<HTMLDivElement>(null);
    const [touchStart, setTouchStart] = useState<number | null>(null);
    const [touchEnd, setTouchEnd] = useState<number | null>(null);

    // Settings State
    const [showSettings, setShowSettings] = useState(false);
    const [fitMode, setFitMode] = useState<FitMode>("width");
    const [showControls, setShowControls] = useState(true); // Default to visible

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

        if (isLeftSwipe && pageNumber < numPages) {
            setPageNumber(p => p + 1);
        }
        if (isRightSwipe && pageNumber > 1) {
            setPageNumber(p => p - 1);
        }
    };

    // Toggle controls on tap
    const handleContentClick = () => {
        setShowControls(!showControls);
        if (showSettings) setShowSettings(false); // Close settings if open
    };

    // Calculate Page Dimensions based on Fit Mode
    const getPageDimensions = () => {
        if (!containerWidth || !containerHeight) return {};

        switch (fitMode) {
            case "width":
                return { width: containerWidth };
            case "height":
                return { height: containerHeight };
            case "both":
                // React-pdf doesn't have a direct "contain" prop, but we can approximate or let CSS handle it if we set one dimension.
                // Better approach: calculate aspect ratio if possible, but we don't know page ratio easily before render.
                // Fallback: Use height for contain if landscape, width if portrait. 
                // For simplicity, let's default to height as it ensures full visibility vertically.
                return { height: containerHeight };
            case "none":
                return { scale: scale }; // Use manual scale
            default:
                return { width: containerWidth };
        }
    };

    const pageProps = getPageDimensions();

    return (
        <div className="h-full flex flex-col bg-gray-900 relative overflow-hidden">
            {/* Background Gradients */}
            <div className="absolute top-[-20%] left-[-10%] w-[500px] h-[500px] bg-violet-600/30 rounded-full blur-[120px] pointer-events-none mix-blend-screen" />
            <div className="absolute bottom-[-20%] right-[-10%] w-[500px] h-[500px] bg-fuchsia-600/30 rounded-full blur-[120px] pointer-events-none mix-blend-screen" />

            {/* Header Controls */}
            <div className={`absolute top-0 left-0 w-full bg-gradient-to-b from-black/80 to-transparent backdrop-blur-sm border-b border-white/10 px-4 py-3 flex items-center justify-between z-50 transition-all duration-300 ${showControls || showSettings ? 'translate-y-0 opacity-100' : '-translate-y-full opacity-0'}`}>
                <h1 className="text-white font-semibold truncate max-w-[150px] sm:max-w-md drop-shadow-md">{title}</h1>

                <div className="flex items-center gap-2">
                    {/* Settings Toggle */}
                    <button
                        onClick={(e) => { e.stopPropagation(); setShowSettings(!showSettings); }}
                        className={`p-2 rounded-lg transition-colors ${showSettings ? 'bg-white text-black' : 'text-gray-300 hover:text-white hover:bg-white/10'}`}
                    >
                        <Settings size={20} />
                    </button>

                    {/* Zoom Controls (Only show in 'none' mode or always allow override?) */}
                    {fitMode === 'none' && (
                        <>
                            <button
                                onClick={(e) => { e.stopPropagation(); setScale(s => Math.max(0.5, s - 0.1)); }}
                                className="p-2 text-gray-300 hover:text-white hover:bg-white/10 rounded-lg transition-colors hidden sm:block"
                            >
                                <ZoomOut size={20} />
                            </button>
                            <span className="text-gray-300 text-sm min-w-[3ch] text-center hidden sm:block drop-shadow-md">
                                {Math.round(scale * 100)}%
                            </span>
                            <button
                                onClick={(e) => { e.stopPropagation(); setScale(s => Math.min(2.0, s + 0.1)); }}
                                className="p-2 text-gray-300 hover:text-white hover:bg-white/10 rounded-lg transition-colors hidden sm:block"
                            >
                                <ZoomIn size={20} />
                            </button>
                        </>
                    )}
                </div>
            </div>

            {/* Settings Menu */}
            {showSettings && (
                <div className="absolute top-16 right-4 w-64 bg-black/90 backdrop-blur-xl border border-white/10 rounded-2xl p-4 shadow-2xl z-50 animate-in fade-in slide-in-from-top-2">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="text-white font-semibold">View Settings</h3>
                        <button onClick={() => setShowSettings(false)} className="text-gray-400 hover:text-white">
                            <X size={18} />
                        </button>
                    </div>

                    <div className="space-y-2">
                        <p className="text-xs text-gray-400 uppercase tracking-wider font-bold">Fit Mode</p>
                        {[
                            { id: "width", label: "Fit Width" },
                            { id: "height", label: "Fit Height" },
                            { id: "both", label: "Fit Both" },
                            { id: "none", label: "No Limit" },
                        ].map((mode) => (
                            <button
                                key={mode.id}
                                onClick={() => {
                                    setFitMode(mode.id as FitMode);
                                    // Reset scale if switching to none to a reasonable default or keep current
                                    if (mode.id === 'none') setScale(1.0);
                                }}
                                className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors ${fitMode === mode.id
                                    ? "bg-violet-600 text-white"
                                    : "text-gray-300 hover:bg-white/10"
                                    }`}
                            >
                                {mode.label}
                                {fitMode === mode.id && <Check size={16} />}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* PDF Container */}
            <div
                ref={containerRef}
                onClick={handleContentClick}
                className={`flex-1 overflow-auto p-0 flex items-center touch-pan-y relative z-10 ${fitMode === 'height' || fitMode === 'both' ? 'justify-center' : 'justify-center'
                    }`}
                onTouchStart={onTouchStart}
                onTouchMove={onTouchMove}
                onTouchEnd={onTouchEnd}
            >
                <Document
                    file={blobUrl}
                    onLoadSuccess={onDocumentLoadSuccess}
                    className="shadow-2xl"
                    loading={
                        <div className="flex items-center justify-center h-screen text-white">
                            Loading PDF...
                        </div>
                    }
                >
                    <Page
                        pageNumber={pageNumber}
                        renderTextLayer={false}
                        renderAnnotationLayer={false}
                        {...pageProps}
                        className={`overflow-hidden shadow-2xl transition-all duration-300 ${fitMode === 'both' ? 'object-contain max-w-full max-h-full' : ''
                            }`}
                    />
                </Document>
            </div>

            {/* Floating Navigation Bar */}
            <div className={`absolute bottom-6 left-1/2 -translate-x-1/2 bg-black/80 backdrop-blur-xl border border-white/10 rounded-full px-6 py-3 flex items-center gap-6 shadow-2xl z-50 transition-all duration-300 ${showControls ? 'translate-y-0 opacity-100' : 'translate-y-full opacity-0'}`}>
                <button
                    onClick={(e) => { e.stopPropagation(); setPageNumber((p) => Math.max(1, p - 1)); }}
                    disabled={pageNumber <= 1}
                    className="text-white hover:text-blue-400 disabled:opacity-30 disabled:hover:text-white transition-colors"
                >
                    <ChevronLeft size={24} />
                </button>

                <span className="text-white font-medium min-w-[80px] text-center">
                    {pageNumber} / {numPages || "--"}
                </span>

                <button
                    onClick={(e) => { e.stopPropagation(); setPageNumber((p) => Math.min(numPages, p + 1)); }}
                    disabled={pageNumber >= numPages}
                    className="text-white hover:text-blue-400 disabled:opacity-30 disabled:hover:text-white transition-colors"
                >
                    <ChevronRight size={24} />
                </button>
            </div>
        </div>
    );
}
