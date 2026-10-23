"use client";

import { useState, useRef, useEffect } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";
import { Loader2, AlertCircle } from "lucide-react";

// Configure worker
pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();

interface PDFRendererProps {
    blobUrl: string;
    pageNumber: number;
    onPageChange: (page: number) => void;
    onLoadSuccess: (pages: number) => void;
    viewMode: "single" | "continuous" | "two-page";
    fitMode: "width" | "height" | "none";
    scale: number;
}

export default function PDFRenderer({
    blobUrl,
    pageNumber,
    onPageChange,
    onLoadSuccess,
    viewMode,
    fitMode,
    scale,
}: PDFRendererProps) {
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

        let availableWidth = containerWidth - 40; // padding
        if (viewMode === "two-page") {
            availableWidth = containerWidth / 2 - 40;
        }

        switch (fitMode) {
            case "width":
                return { width: Math.max(100, availableWidth) };
            case "height":
                return { height: Math.max(100, containerHeight - 40) };
            case "none":
                return { scale: scale };
            default:
                return { width: Math.max(100, availableWidth) };
        }
    };

    useEffect(() => {
        if (viewMode !== "continuous" || !numPages || !containerRef.current) return;
        const container = containerRef.current;
        const observer = new IntersectionObserver(entries => {
            const visible = entries.filter(entry => entry.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
            if (visible) {
                const page = Number((visible.target as HTMLElement).dataset.pageNumber);
                if (page && page !== pageNumber) onPageChange(page);
            }
        }, { root: container, threshold: [0.1, 0.5, 0.9] });
        container.querySelectorAll(".react-pdf__Page").forEach(page => observer.observe(page));
        return () => observer.disconnect();
    }, [viewMode, numPages, pageNumber, onPageChange]);

    const previousPageRef = useRef(pageNumber);
    useEffect(() => {
        if (viewMode === "continuous" && containerRef.current && previousPageRef.current !== pageNumber) {
            const page = containerRef.current.querySelector<HTMLElement>(`[data-page-number="${pageNumber}"]`);
            if (page && (page.offsetTop < containerRef.current.scrollTop || page.offsetTop > containerRef.current.scrollTop + containerRef.current.clientHeight)) containerRef.current.scrollTop = page.offsetTop;
        }
        previousPageRef.current = pageNumber;
    }, [pageNumber, viewMode]);

    const pageProps = getPageDimensions();

    return (
        <div
            ref={containerRef}
            className="w-full h-full overflow-auto bg-background/80 p-4 touch-pan-y"
            onTouchStart={onTouchStart}
            onTouchMove={onTouchMove}
            onTouchEnd={onTouchEnd}
        >
            <Document
                file={blobUrl}
                onLoadSuccess={onDocumentLoadSuccess}
                error={<div role="alert" className="flex flex-col items-center gap-3 p-6 text-red-500"><AlertCircle /><p>Could not load this PDF. Check the file and try opening it again.</p></div>}
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

                        {/* Continuous Scroll Mode */}
                        {viewMode === "continuous" && (
                            Array.from(new Array(numPages), (el, index) => (
                                <Page
                                    key={`page_${index + 1}`}
                                    pageNumber={index + 1}
                                    renderTextLayer={true}
                                    renderAnnotationLayer={true}
                                    {...pageProps}
                                    className="shadow-2xl mb-4"
                                />
                            ))
                        )}

                        {/* Two Page Mode */}
                        {viewMode === "two-page" && (
                            <div className="flex justify-center gap-4 flex-wrap">
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
