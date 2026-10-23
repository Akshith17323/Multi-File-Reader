"use client";

import { forwardRef, useImperativeHandle, useState, useCallback } from "react";
import dynamic from "next/dynamic";
import { getDocumentUrl } from "@/utils/fileUrls";
import { BaseReaderProps, ReaderHandle } from "../types";

const PDFRenderer = dynamic(() => import("@/components/PDFRenderer"), { ssr: false });

const PDFReaderAdapter = forwardRef<ReaderHandle, BaseReaderProps>(function PDFReaderAdapter(
    { file, viewOptions, initialLocation, onLocationChange, isActive, onStatusChange }, ref
) {
    const [page, setPage] = useState(initialLocation?.pageNumber || 1);
    const [totalPages, setTotalPages] = useState(initialLocation?.totalPages || 0);
    const changePage = useCallback((target: number) => {
        if (!totalPages || !Number.isFinite(target)) return;
        const next = Math.max(1, Math.min(Math.trunc(target), totalPages));
        setPage(next);
        onLocationChange?.({ pageNumber: next, totalPages, progress: Math.round((next / totalPages) * 100) });
    }, [totalPages, onLocationChange]);
    useImperativeHandle(ref, () => ({
        next: () => changePage(page + (viewOptions.viewMode === "two-page" ? 2 : 1)),
        prev: () => changePage(page - (viewOptions.viewMode === "two-page" ? 2 : 1)),
        goToPage: changePage,
    }), [changePage, page, viewOptions.viewMode]);
    const handleLoad = (pages: number) => {
        const current = Math.max(1, Math.min(page, pages));
        onStatusChange?.('ready');
        setTotalPages(pages);
        setPage(current);
        onLocationChange?.({ pageNumber: current, totalPages: pages, progress: Math.round((current / pages) * 100) });
    };
    return <PDFRenderer blobUrl={getDocumentUrl(file.url)} pageNumber={page} onPageChange={changePage}
        onLoadSuccess={handleLoad} onStatusChange={onStatusChange} viewMode={viewOptions.viewMode} fitMode={viewOptions.fitMode} scale={viewOptions.zoom} isActive={isActive} />;
});

export default PDFReaderAdapter;
