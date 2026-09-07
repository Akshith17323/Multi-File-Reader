"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import UnifiedReaderLayout, { ViewMode, FitMode } from "@/components/UnifiedReaderLayout";
import { FileTabData } from "@/components/FileTab";
import dynamic from "next/dynamic";

const PDFRenderer = dynamic(() => import("@/components/PDFRenderer"), { ssr: false });
const EPUBRenderer = dynamic(() => import("@/components/EPUBRenderer"), { ssr: false });

function ReaderContent() {
    const searchParams = useSearchParams();
    const router = useRouter();

    // Parse file URLs and active index from query params
    const filesParam = searchParams.get("files");
    const activeParam = searchParams.get("active");

    const [openFiles, setOpenFiles] = useState<FileTabData[]>([]);
    const [activeFileIndex, setActiveFileIndex] = useState(0);
    const [isInitialized, setIsInitialized] = useState(false);

    // Reader state
    const [viewMode, setViewMode] = useState<ViewMode>("single");
    const [fitMode, setFitMode] = useState<FitMode>("width");
    const [zoom, setZoom] = useState(1.0);
    const [fontSize, setFontSize] = useState(100);

    // PDF-specific state
    const [pdfPage, setPdfPage] = useState(1);
    const [pdfTotalPages, setPdfTotalPages] = useState(0);

    // EPUB-specific state
    const [epubChapters, setEpubChapters] = useState<{ label: string; href: string }[]>([]);

    // Initialize files from URL params
    useEffect(() => {
        if (!filesParam) {
            router.push("/files");
            return;
        }

        try {
            // Decode the files parameter (format: url1,url2,url3 or JSON)
            const fileUrls = filesParam.split(",").map((url) => decodeURIComponent(url));

            const files: FileTabData[] = fileUrls.map((url, index) => {
                const fileName = url.split("/").pop() || `File ${index + 1}`;
                const fileType = url.toLowerCase().endsWith(".pdf") ? "pdf" : "epub";

                return {
                    id: `file_${index}_${Date.now()}`,
                    url,
                    name: fileName,
                    type: fileType,
                };
            });

            if (files.length > 0) {
                setOpenFiles(files);
                setActiveFileIndex(activeParam ? parseInt(activeParam, 10) : 0);
            }
            setIsInitialized(true);
        } catch (error) {
            console.error("Error parsing files:", error);
            router.push("/files");
        }
    }, [filesParam, activeParam, router]);

    // Update URL when tabs or active file changes
    useEffect(() => {
        if (!isInitialized || openFiles.length === 0) return;

        const fileUrls = openFiles.map((f) => f.url).join(",");
        const encodedFileUrls = openFiles.map((f) => encodeURIComponent(f.url)).join(",");
        const newUrl = `/reader?files=${encodedFileUrls}&active=${activeFileIndex}`;

        // Save to sessionStorage so files page can detect reader is open
        sessionStorage.setItem("readerFiles", fileUrls);

        // Use replaceState to avoid adding to history on every tab switch
        window.history.replaceState({}, "", newUrl);
    }, [openFiles, activeFileIndex, isInitialized]);

    // Load bookmark for active file
    useEffect(() => {
        if (!isInitialized || openFiles.length === 0) return;

        const activeFile = openFiles[activeFileIndex];
        if (!activeFile) return;

        const loadBookmark = async () => {
            try {
                const token = localStorage.getItem("token");
                if (!token) return;

                const res = await fetch(
                    `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/bookmarks?fileUrl=${encodeURIComponent(activeFile.url)}`,
                    { headers: { Authorization: `Bearer ${token}` } }
                );

                if (res.ok) {
                    const data = await res.json();
                    if (activeFile.type === "pdf" && data.pageNumber) {
                        setPdfPage(data.pageNumber);
                    }
                    // For EPUB, the renderer will handle loading the CFI
                }
            } catch (err) {
                console.error("Failed to load bookmark", err);
            }
        };

        loadBookmark();
    }, [activeFileIndex, openFiles, isInitialized]);

    // Save bookmark
    const saveBookmark = async (pageNumber?: number, cfi?: string) => {
        if (!isInitialized || openFiles.length === 0) return;

        const activeFile = openFiles[activeFileIndex];
        if (!activeFile) return;

        try {
            const token = localStorage.getItem("token");
            if (!token) return;

            let progress = 0;
            if (activeFile.type === "pdf" && pageNumber && pdfTotalPages) {
                progress = Math.round((pageNumber / pdfTotalPages) * 100);
            }

            await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/api/bookmarks`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({
                    fileUrl: activeFile.url,
                    fileName: activeFile.name,
                    pageNumber: pageNumber || undefined,
                    totalPages: pdfTotalPages || undefined,
                    cfi: cfi || undefined,
                    progress,
                }),
            });
        } catch (err) {
            console.error("Failed to save bookmark", err);
        }
    };

    // Handlers
    const handleTabChange = (index: number) => {
        setActiveFileIndex(index);
        // Reset reader state when switching files
        setPdfPage(1);
        setPdfTotalPages(0);
    };

    const handleTabClose = (index: number) => {
        const newFiles = openFiles.filter((_, i) => i !== index);

        if (newFiles.length === 0) {
            // No files left, go back to library
            router.push("/files");
            return;
        }

        setOpenFiles(newFiles);

        // Adjust active index if needed
        if (index === activeFileIndex) {
            setActiveFileIndex(Math.max(0, index - 1));
        } else if (index < activeFileIndex) {
            setActiveFileIndex(activeFileIndex - 1);
        }
    };

    const handlePdfPageChange = (page: number) => {
        setPdfPage(page);
        saveBookmark(page);
    };

    const handlePdfLoadSuccess = (pages: number) => {
        setPdfTotalPages(pages);
    };

    const handleEpubLoadSuccess = (chapters: { label: string; href: string }[]) => {
        setEpubChapters(chapters);
    };

    const handleEpubLocationChange = (cfi: string) => {
        saveBookmark(undefined, cfi);
    };

    const handleNextPage = () => {
        const increment = viewMode === "two-page" ? 2 : 1;
        setPdfPage((prev) => Math.min(prev + increment, pdfTotalPages));
    };

    const handlePrevPage = () => {
        const increment = viewMode === "two-page" ? 2 : 1;
        setPdfPage((prev) => Math.max(prev - increment, 1));
    };

    if (!isInitialized || openFiles.length === 0) {
        return (
            <div className="h-screen bg-black flex items-center justify-center text-white">
                <p>Loading...</p>
            </div>
        );
    }

    const activeFile = openFiles[activeFileIndex];

    return (
        <UnifiedReaderLayout
            openFiles={openFiles}
            activeFileIndex={activeFileIndex}
            onTabChange={handleTabChange}
            onTabClose={handleTabClose}
            currentPage={activeFile?.type === "pdf" ? pdfPage : undefined}
            totalPages={activeFile?.type === "pdf" ? pdfTotalPages : undefined}
            onNextPage={handleNextPage}
            onPrevPage={handlePrevPage}
            viewMode={viewMode}
            onViewModeChange={setViewMode}
            fitMode={fitMode}
            onFitModeChange={setFitMode}
            zoom={zoom}
            onZoomIn={() => setZoom((z) => Math.min(2.0, z + 0.1))}
            onZoomOut={() => setZoom((z) => Math.max(0.5, z - 0.1))}
            fontSize={fontSize}
            onFontSizeIncrease={() => setFontSize((s) => Math.min(200, s + 20))}
            onFontSizeDecrease={() => setFontSize((s) => Math.max(50, s - 20))}
        >
            {activeFile?.type === "pdf" && (
                <PDFRenderer
                    key={activeFile.id}
                    blobUrl={`${process.env.NEXT_PUBLIC_BACKEND_URL}/proxy?url=${encodeURIComponent(activeFile.url)}`}
                    pageNumber={pdfPage}
                    onPageChange={handlePdfPageChange}
                    onLoadSuccess={handlePdfLoadSuccess}
                    viewMode={viewMode}
                    fitMode={fitMode}
                    scale={zoom}
                />
            )}

            {activeFile?.type === "epub" && (
                <EPUBRenderer
                    key={activeFile.id}
                    url={activeFile.url}
                    onLoadSuccess={handleEpubLoadSuccess}
                    onLocationChange={handleEpubLocationChange}
                    viewMode={viewMode}
                    fontSize={fontSize}
                />
            )}
        </UnifiedReaderLayout>
    );
}

export default function ReaderPage() {
    return (
        <Suspense
            fallback={
                <div className="h-screen bg-black flex items-center justify-center text-white">
                    Loading Reader...
                </div>
            }
        >
            <ReaderContent />
        </Suspense>
    );
}
