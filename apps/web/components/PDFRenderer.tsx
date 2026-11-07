"use client";

import { useState, useRef, useEffect } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import type { PDFPageProxy } from 'pdfjs-dist';
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";
import { Loader2, AlertCircle } from "lucide-react";
import RetainedReaderSurface from "./readers/RetainedReaderSurface";
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
    const surfaceRef = useRef<RetainedReaderSurface>(null);
    const [nearbyPages, setNearbyPages] = useState<Set<number>>(new Set());
    const [pageRatios, setPageRatios] = useState<Record<number, number>>({});
    const [loadError, setLoadError] = useState<string | null>(null);
    // ResizeObserver reports the content box, excluding padding.
    const availableWidth = twoPages ? (containerWidth - 16) / 2 : containerWidth;
    const pageProps = !containerWidth || (fitMode === 'height' && !containerHeight) ? {} :
        fitMode === 'height' ? { height: Math.max(100, containerHeight) } :
            fitMode === 'none' ? { scale } : { width: Math.max(100, availableWidth) };
    const renderKey = `${pageProps.width}:${pageProps.height}:${pageProps.scale}`;
    const layoutKey = `${viewMode}:${fitMode}:${scale}:${containerWidth}:${containerHeight}:${continuous ? '' : pageNumber}`;
    const finishLayout = () => {
        const container = containerRef.current;
        if (!container) return;
        const required = [pageNumber, ...(twoPages && pageNumber < numPages ? [pageNumber + 1] : [])];
        if (required.every(page => {
            const canvas = container.querySelector<HTMLCanvasElement>(`[data-page-number="${page}"] canvas`);
            return canvas && canvas.width > 0 && getComputedStyle(canvas).visibility !== 'hidden' && canvas.dataset.renderedLayout === renderKey;
        })) surfaceRef.current?.reveal(layoutKey);
    };

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
        setLoadError(null);
        setNumPages(numPages);
        onLoadSuccess(numPages);
    }

    function onDocumentError(error: Error) {
        const status = (error as Error & { status?: number }).status;
        setLoadError(status === 503
            ? 'Cloud storage is temporarily unavailable. Try again later or open a downloaded copy.'
            : status === 404 ? 'This PDF is no longer available in cloud storage.'
                : 'Could not load this PDF. Check the file and try opening it again.');
        onStatusChange?.('error');
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

    const visiblePageRef = useRef(pageNumber);
    const onPageChangeRef = useRef(onPageChange);
    const pendingRestoreRef = useRef<number | null>(null);
    const userScrollingRef = useRef(false);
    const restoreRenderedPage = () => {
        const container = containerRef.current;
        const target = pendingRestoreRef.current;
        if (!container || target === null) return;
        userScrollingRef.current = false;
        const element = container.querySelector<HTMLElement>(`[data-pdf-page="${target}"]`);
        if (!element) return;
        container.scrollTop += element.getBoundingClientRect().top - container.getBoundingClientRect().top - 16;
        visiblePageRef.current = target;
        const canvas = element.querySelector('canvas');
        if (canvas && canvas.width > 0 && getComputedStyle(canvas).visibility !== 'hidden') pendingRestoreRef.current = null;
    };
    const onPageLoadSuccess = (loaded: PDFPageProxy) => {
        const viewport = loaded.getViewport({ scale: 1 });
        const nextRatio = viewport.width / viewport.height;
        setPageRatios(previous => previous[loaded.pageNumber] === nextRatio ? previous : { ...previous, [loaded.pageNumber]: nextRatio });
    };
    const onPageRenderSuccess = (loaded: PDFPageProxy) => {
        const canvas = containerRef.current?.querySelector<HTMLCanvasElement>(`[data-pdf-page="${loaded.pageNumber}"] canvas`);
        if (canvas) canvas.dataset.renderedLayout = renderKey;
        restoreRenderedPage();
        finishLayout();
        onStatusChange?.('ready');
    };
    const onPageRenderError = () => surfaceRef.current?.reveal(layoutKey);
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
                const visiblePage = Number((visible as HTMLElement).dataset.pdfPage);
                const page = twoPages ? Math.floor((visiblePage - 1) / 2) * 2 + 1 : visiblePage;
                if (page && page !== visiblePageRef.current) {
                    visiblePageRef.current = page;
                    onPageChangeRef.current(page);
                }
            }
        }, { root: container, threshold: [0.1, 0.5, 0.9] });
        container.querySelectorAll("[data-pdf-page]").forEach(page => observer.observe(page));
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

    // Observe cheap page placeholders. Mount PDF canvases only near the
    // viewport instead of rendering the entire document in continuous mode.
    useEffect(() => {
        const container = containerRef.current;
        if (!continuous || !container || !numPages) return;
        const nearby = new Set<number>();
        const observer = new IntersectionObserver(entries => {
            entries.forEach(entry => {
                const page = Number((entry.target as HTMLElement).dataset.pdfPage);
                if (entry.isIntersecting) nearby.add(page);
                else nearby.delete(page);
            });
            setNearbyPages(new Set(nearby));
        }, { root: container, rootMargin: '100% 0px' });
        container.querySelectorAll('[data-pdf-page]').forEach(page => observer.observe(page));
        return () => observer.disconnect();
    }, [continuous, twoPages, numPages]);

    useEffect(() => {
        const frame = requestAnimationFrame(finishLayout);
        return () => cancelAnimationFrame(frame);
        // Callbacks always inspect the current committed page canvases.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [layoutKey, numPages, pageNumber]);

    const fallbackRatio = pageRatios[1] || pageRatios[pageNumber] || 612 / 792;
    const pages = continuous ? Array.from({ length: numPages }, (_, index) => index + 1) : [pageNumber, ...(twoPages && pageNumber < numPages ? [pageNumber + 1] : [])];

    return (
        <RetainedReaderSurface ref={surfaceRef} layoutKey={layoutKey} pageNumber={pageNumber}>
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
                onLoadError={onDocumentError}
                onSourceError={onDocumentError}
                onItemClick={({ pageNumber: page }) => { if (page) onPageChange(page); }}
                onLoadSuccess={onDocumentLoadSuccess}
                error={<div role="alert" className="flex flex-col items-center gap-3 p-6 text-foreground"><AlertCircle /><p>{loadError || 'Could not load this PDF. Check the file and try opening it again.'}</p></div>}
                className={`grid w-max min-w-full content-start justify-items-center gap-4 ${twoPages ? 'grid-cols-2' : 'grid-cols-1'}`}
                loading={
                    <div className="flex flex-col items-center justify-center h-40 text-foreground gap-3">
                        <Loader2 className="w-8 h-8 text-primary animate-spin" />
                        <span className="text-sm text-foreground-muted">Loading PDF...</span>
                    </div>
                }
            >
                {numPages > 0 && pages.map(page => {
                    const ratio = pageRatios[page] || fallbackRatio;
                    const width = pageProps.width || (pageProps.height ? pageProps.height * ratio : 612 * scale);
                    const height = pageProps.height || width / ratio;
                    const render = !continuous || nearbyPages.has(page) || page === pageNumber || (twoPages && page === pageNumber + 1);
                    return <div key={page} data-pdf-page={page} data-page-number={page} className="relative shrink-0 bg-white shadow-2xl" style={{ width, minHeight: height }}>
                        {render && <Page pageNumber={page} renderTextLayer renderAnnotationLayer {...pageProps}
                            onLoadSuccess={onPageLoadSuccess}
                            onRenderSuccess={onPageRenderSuccess}
                            onRenderError={onPageRenderError}
                        />}
                    </div>;
                })}
            </Document>
        </div>
        </RetainedReaderSurface>
    );
}
