"use client";

import { useState, useRef, useEffect } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";
import { Loader2, AlertCircle } from "lucide-react";
import type { ReaderStatus, ViewMode } from './readers/types';

// Configure worker
pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();

interface PDFRendererProps {
    blobUrl: string;
    pageNumber: number;
    onPageChange: (page: number) => void;
    onLoadSuccess: (pages: number) => void;
    viewMode: ViewMode;
    fitMode: "width" | "height" | "none";
    scale: number;
    isActive: boolean;
    onStatusChange?: (status: ReaderStatus) => void;
}

export default function PDFRenderer({
    blobUrl,
    pageNumber,
    onPageChange,
    onLoadSuccess,
    viewMode,
    fitMode,
    scale,
    isActive,
    onStatusChange,
}: PDFRendererProps) {
    const continuous = viewMode === "continuous" || viewMode === "two-page-continuous";
    const twoPages = viewMode.startsWith("two-page");
    const [numPages, setNumPages] = useState<number>(0);
    const [containerWidth, setContainerWidth] = useState<number>(0);
    const [containerHeight, setContainerHeight] = useState<number>(0);
    const containerRef = useRef<HTMLDivElement>(null);

    // Touch handling for swipe navigation
    const [touchStart, setTouchStart] = useState<number | null>(null);
    const [touchEnd, setTouchEnd] = useState<number | null>(null);

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
        onLoadSuccess(numPages);
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
        if (touchStart === null || touchEnd === null) return;
        const distance = touchStart - touchEnd;
        const isLeftSwipe = distance > 50;
        const isRightSwipe = distance < -50;

        if (viewMode === "single" || viewMode === "two-page") {
            const increment = viewMode === "two-page" ? 2 : 1;
            if (isLeftSwipe && pageNumber < numPages) {
                onPageChange(Math.min(pageNumber + increment, numPages));
            }
            if (isRightSwipe && pageNumber > 1) {
                onPageChange(Math.max(pageNumber - increment, 1));
            }
        }
    };

    // Calculate Page Dimensions based on Fit Mode
    const getPageDimensions = () => {
        if (!containerWidth || (fitMode === "height" && !containerHeight)) return {};

        let availableWidth = containerWidth; // ResizeObserver reports the content box, excluding padding.
        if (twoPages) {
            availableWidth = (containerWidth - 16) / 2;
        }

        switch (fitMode) {
            case "width":
                return { width: Math.max(100, availableWidth) };
            case "height":
                return { height: Math.max(100, containerHeight) };
            case "none":
                return { scale: scale };
            default:
                return { width: Math.max(100, availableWidth) };
        }
    };

    const visiblePageRef = useRef(pageNumber);
    const onPageChangeRef = useRef(onPageChange);
    const pendingRestoreRef = useRef<number | null>(null);
    const userScrollingRef = useRef(false);
    const restoreRenderedPage = () => {
        const container = containerRef.current;
        const target = pendingRestoreRef.current;
        if (!container || target === null) return;
        userScrollingRef.current = false;
        // Earlier canvases must have their final heights before we can restore a later page.
        for (let page = 1; page <= target; page++) {
            if (!container.querySelector(`[data-page-number="${page}"] canvas`)) return;
        }
        const element = container.querySelector<HTMLElement>(`[data-page-number="${target}"]`);
        if (!element) return;
        container.scrollTop += element.getBoundingClientRect().top - container.getBoundingClientRect().top - 16;
        visiblePageRef.current = target;
        pendingRestoreRef.current = null;
    };
    useEffect(() => { onPageChangeRef.current = onPageChange; }, [onPageChange]);
    useEffect(() => {
        if (!isActive || !continuous || !numPages || !containerRef.current) return;
        const container = containerRef.current;
        // Restore the current page before observing scroll updates.
        userScrollingRef.current = false;
        pendingRestoreRef.current = pageNumber;
        restoreRenderedPage();
        visiblePageRef.current = pageNumber;
        const visiblePages = new Map<Element, number>();
        const observer = new IntersectionObserver(entries => {
            for (const entry of entries) {
                if (entry.isIntersecting) visiblePages.set(entry.target, entry.intersectionRatio);
                else visiblePages.delete(entry.target);
            }
            if (pendingRestoreRef.current !== null || !userScrollingRef.current) return;
            const visible = [...visiblePages].sort((a, b) => b[1] - a[1])[0]?.[0];
            if (visible) {
                const visiblePage = Number((visible as HTMLElement).dataset.pageNumber);
                const page = twoPages ? Math.floor((visiblePage - 1) / 2) * 2 + 1 : visiblePage;
                if (page && page !== visiblePageRef.current) {
                    visiblePageRef.current = page;
                    onPageChangeRef.current(page);
                }
            }
        }, { root: container, threshold: [0.1, 0.5, 0.9] });
        container.querySelectorAll(".react-pdf__Page").forEach(page => observer.observe(page));
        return () => observer.disconnect();
        // Page changes caused by scrolling must not recreate the observer.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isActive, viewMode, continuous, twoPages, numPages, containerWidth, containerHeight, fitMode, scale]);

    useEffect(() => {
        if (continuous && containerRef.current && visiblePageRef.current !== pageNumber) {
            userScrollingRef.current = false;
            pendingRestoreRef.current = pageNumber;
            restoreRenderedPage();
        }
    }, [pageNumber, continuous]);

    const pageProps = getPageDimensions();

    return (
        <div
            ref={containerRef}
            tabIndex={0}
            aria-label="PDF pages"
            onKeyDown={event => {
                if (['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End', ' '].includes(event.key)) userScrollingRef.current = true;
            }}
            className="w-full h-full overflow-auto bg-background/80 p-4 pb-[calc(var(--reader-controls-height,76px)+40px)] touch-pan-y"
            onTouchStart={onTouchStart}
            onWheel={() => { userScrollingRef.current = true; }}
            onPointerDown={() => { userScrollingRef.current = true; }}
            onTouchMove={event => { userScrollingRef.current = true; onTouchMove(event); }}
            onTouchEnd={onTouchEnd}
        >
            <Document
                file={blobUrl}
                onSourceSuccess={() => onStatusChange?.('loading')}
                onLoadError={() => onStatusChange?.('error')}
                onSourceError={() => onStatusChange?.('error')}
                onItemClick={({ pageNumber: page }) => { if (page) onPageChange(page); }}
                onLoadSuccess={onDocumentLoadSuccess}
                error={<div role="alert" className="flex flex-col items-center gap-3 p-6 text-foreground"><AlertCircle /><p>Could not load this PDF. Check the file and try opening it again.</p></div>}
                className="flex flex-col items-center min-h-full"
                loading={
                    <div className="flex flex-col items-center justify-center h-40 text-foreground gap-3">
                        <Loader2 className="w-8 h-8 text-primary animate-spin" />
                        <span className="text-sm text-foreground-muted">Loading PDF...</span>
                    </div>
                }
            >
                {numPages > 0 && (
                    <>
                        {/* Single Page Mode */}
                        {viewMode === "single" && (
                            <Page
                                pageNumber={pageNumber}
                                renderTextLayer={true}
                                renderAnnotationLayer={true}
                                {...pageProps}
                                className="shadow-2xl mb-4 transition-all duration-300"
                            />
                        )}

                        {/* Continuous pages, grouped into spreads when two pages are selected. */}
                        {continuous && Array.from({ length: Math.ceil(numPages / (twoPages ? 2 : 1)) }, (_, row) => {
                            const first = row * (twoPages ? 2 : 1) + 1;
                            return <div key={first} className="mb-4 flex shrink-0 gap-4">
                                {Array.from({ length: twoPages && first < numPages ? 2 : 1 }, (_, column) => <Page
                                    key={first + column}
                                    pageNumber={first + column}
                                    renderTextLayer={true}
                                    renderAnnotationLayer={true}
                                    onRenderSuccess={restoreRenderedPage}
                                    {...pageProps}
                                    className="shadow-2xl"
                                />)}
                            </div>;
                        })}

                        {/* Two Page Mode */}
                        {viewMode === "two-page" && (
                            <div className="flex justify-center gap-4">
                                <Page
                                    pageNumber={pageNumber}
                                    renderTextLayer={true}
                                    renderAnnotationLayer={true}
                                    {...pageProps}
                                    className="shadow-2xl"
                                />
                                {pageNumber + 1 <= numPages && (
                                    <Page
                                        pageNumber={pageNumber + 1}
                                        renderTextLayer={true}
                                        renderAnnotationLayer={true}
                                        {...pageProps}
                                        className="shadow-2xl"
                                    />
                                )}
                            </div>
                        )}
                    </>
                )}
            </Document>
        </div>
    );
}
