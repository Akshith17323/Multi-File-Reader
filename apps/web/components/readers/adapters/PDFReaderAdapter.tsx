"use client";

import { forwardRef, useImperativeHandle, useState, useEffect } from "react";
import dynamic from "next/dynamic";
import { BaseReaderProps, ReaderHandle } from "../types";

const PDFRenderer = dynamic(() => import("@/components/PDFRenderer"), { ssr: false });

const PDFReaderAdapter = forwardRef<ReaderHandle, BaseReaderProps>(function PDFReaderAdapter(
    { file, viewOptions, initialLocation, onLocationChange },
    ref
) {
    const [page, setPage] = useState<number>(initialLocation?.pageNumber || 1);
    const [totalPages, setTotalPages] = useState<number>(initialLocation?.totalPages || 0);

    // Sync if initial location is updated from bookmark
    useEffect(() => {
        if (initialLocation?.pageNumber && initialLocation.pageNumber !== page) {
            setPage(initialLocation.pageNumber);
        }
        if (initialLocation?.totalPages) {
            setTotalPages(initialLocation.totalPages);
        }
    }, [initialLocation?.pageNumber, initialLocation?.totalPages, page]);

    // Expose unified ReaderHandle to parent multi-tab controller
    useImperativeHandle(ref, () => ({
        next: () => {
            const increment = viewOptions.viewMode === "two-page" ? 2 : 1;
            setPage((prev) => {
                const nextVal = totalPages > 0 ? Math.min(prev + increment, totalPages) : prev + increment;
                onLocationChange?.({
                    pageNumber: nextVal,
                    totalPages,
                    progress: totalPages > 0 ? Math.round((nextVal / totalPages) * 100) : 0,
                });
                return nextVal;
            });
        },
        prev: () => {
            const increment = viewOptions.viewMode === "two-page" ? 2 : 1;
            setPage((prev) => {
                const prevVal = Math.max(prev - increment, 1);
                onLocationChange?.({
                    pageNumber: prevVal,
                    totalPages,
                    progress: totalPages > 0 ? Math.round((prevVal / totalPages) * 100) : 0,
                });
                return prevVal;
            });
        },
        goToPage: (targetPage: number) => {
            const clamped = Math.max(1, totalPages > 0 ? Math.min(targetPage, totalPages) : targetPage);
            setPage(clamped);
            onLocationChange?.({
                pageNumber: clamped,
                totalPages,
                progress: totalPages > 0 ? Math.round((clamped / totalPages) * 100) : 0,
            });
        },
    }));

    const handlePageChange = (newPage: number) => {
        setPage(newPage);
        onLocationChange?.({
            pageNumber: newPage,
            totalPages,
            progress: totalPages > 0 ? Math.round((newPage / totalPages) * 100) : 0,
        });
    };

    const handleLoadSuccess = (pages: number) => {
        setTotalPages(pages);
        onLocationChange?.({
            pageNumber: page,
            totalPages: pages,
            progress: Math.round((page / pages) * 100),
        });
    };

    const proxiedBlobUrl = `${process.env.NEXT_PUBLIC_BACKEND_URL}/proxy?url=${encodeURIComponent(file.url)}`;

    return (
        <div className="w-full h-full">
            <PDFRenderer
                blobUrl={proxiedBlobUrl}
                pageNumber={page}
                onPageChange={handlePageChange}
                onLoadSuccess={handleLoadSuccess}
                viewMode={viewOptions.viewMode}
                fitMode={viewOptions.fitMode}
                scale={viewOptions.zoom}
            />
        </div>
    );
});

export default PDFReaderAdapter;
