"use client";

import { useState, useEffect, Suspense, useRef, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import UnifiedReaderLayout from "@/components/UnifiedReaderLayout";
import { FileTabData } from "@/components/FileTab";
import { ReaderFactory, ReaderRenderer } from "@/components/readers/ReaderFactory";
import {
    ReaderLocationState,
    ReaderHandle,
    ViewMode,
    FitMode,
} from "@/components/readers/types";
import { apiClient } from "@/services/apiClient";

function ReaderContent() {
    const searchParams = useSearchParams();
    const router = useRouter();

    // Parse file URLs and active index from query params
    const filesParam = searchParams.get("files");
    const activeParam = searchParams.get("active");

    const [openFiles, setOpenFiles] = useState<FileTabData[]>([]);
    const [activeFileIndex, setActiveFileIndex] = useState(0);
    const [isInitialized, setIsInitialized] = useState(false);

    // Common view options
    const [viewMode, setViewMode] = useState<ViewMode>("single");
    const [fitMode, setFitMode] = useState<FitMode>("width");
    const [zoom, setZoom] = useState(1.0);
    const [fontSize, setFontSize] = useState(100);

    // Multi-tab location state dictionary (keyed by tab file ID)
    const [tabStates, setTabStates] = useState<Record<string, ReaderLocationState>>({});

    // Polymorphic handles for each active reader instance
    const readerRefs = useRef<Record<string, ReaderHandle | null>>({});

    // Initialize files from URL params
    useEffect(() => {
        if (!filesParam) {
            router.push("/files");
            return;
        }

        try {
            // Decode the files parameter (format: encodedUrl1,encodedUrl2,encodedUrl3)
            const fileUrls = filesParam.split(",").map((url) => decodeURIComponent(url));

            const files: FileTabData[] = fileUrls.map((url, index) => {
                const fileName = url.split("/").pop() || `File ${index + 1}`;
                const fileType = ReaderFactory.detectFileType(url);

                return {
                    id: `file_${index}_${Date.now()}`,
                    url,
                    name: fileName,
                    type: fileType,
                };
            });

            setTimeout(() => {
                if (files.length > 0) {
                    setOpenFiles(files);
                    setActiveFileIndex(activeParam ? parseInt(activeParam, 10) : 0);
                }
                setIsInitialized(true);
            }, 0);
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

        sessionStorage.setItem("readerFiles", fileUrls);
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

                const data = await apiClient.getBookmark(token, activeFile.url);

                if (data) {
                    setTabStates((prev) => {
                        // Only set initial location if not already modified locally
                        if (prev[activeFile.id]?.pageNumber || prev[activeFile.id]?.cfi) {
                            return prev;
                        }
                        return {
                            ...prev,
                            [activeFile.id]: {
                                pageNumber: data.pageNumber,
                                totalPages: data.totalPages,
                                cfi: data.cfi,
                                progress: data.progress,
                            },
                        };
                    });
                }
            } catch (err) {
                console.error("Failed to load bookmark", err);
            }
        };

        loadBookmark();
    }, [activeFileIndex, openFiles, isInitialized]);

    // Save bookmark for specific file tab
    const saveBookmark = useCallback(async (fileId: string, location: ReaderLocationState) => {
        const file = openFiles.find((f) => f.id === fileId);
        if (!file) return;

        try {
            const token = localStorage.getItem("token");
            if (!token) return;

            await apiClient.upsertBookmark(token, {
                fileUrl: file.url,
                fileName: file.name,
                pageNumber: location.pageNumber,
                totalPages: location.totalPages,
                cfi: location.cfi,
                progress: location.progress || 0,
            });
        } catch (err) {
            console.error("Failed to save bookmark", err);
        }
    }, [openFiles]);

    // Handlers
    const handleTabLocationChange = useCallback((fileId: string, location: ReaderLocationState) => {
        setTabStates((prev) => ({
            ...prev,
            [fileId]: {
                ...prev[fileId],
                ...location,
            },
        }));
        saveBookmark(fileId, location);
    }, [saveBookmark]);

    const handleTabChange = (index: number) => {
        setActiveFileIndex(index);
    };

    const handleTabClose = (index: number) => {
        const closedFile = openFiles[index];
        const newFiles = openFiles.filter((_, i) => i !== index);

        if (closedFile) {
            delete readerRefs.current[closedFile.id];
            setTabStates((prev) => {
                const updated = { ...prev };
                delete updated[closedFile.id];
                return updated;
            });
        }

        if (newFiles.length === 0) {
            router.push("/files");
            return;
        }

        setOpenFiles(newFiles);

        if (index === activeFileIndex) {
            setActiveFileIndex(Math.max(0, index - 1));
        } else if (index < activeFileIndex) {
            setActiveFileIndex(activeFileIndex - 1);
        }
    };

    const activeFile = openFiles[activeFileIndex];
    const activeLocation = activeFile ? tabStates[activeFile.id] : undefined;

    // Polymorphic Next/Prev Page Actions
    const handleNextPage = useCallback(() => {
        if (!activeFile) return;
        readerRefs.current[activeFile.id]?.next();
    }, [activeFile]);

    const handlePrevPage = useCallback(() => {
        if (!activeFile) return;
        readerRefs.current[activeFile.id]?.prev();
    }, [activeFile]);

    // Keyboard navigation
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === "ArrowRight") {
                handleNextPage();
            } else if (e.key === "ArrowLeft") {
                handlePrevPage();
            }
        };

        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [handleNextPage, handlePrevPage]);

    if (!isInitialized || openFiles.length === 0) {
        return (
            <div className="h-screen bg-background flex items-center justify-center text-foreground">
                <p>Loading...</p>
            </div>
        );
    }

    return (
        <UnifiedReaderLayout
            openFiles={openFiles}
            activeFileIndex={activeFileIndex}
            onTabChange={handleTabChange}
            onTabClose={handleTabClose}
            currentPage={activeLocation?.pageNumber}
            totalPages={activeLocation?.totalPages}
            epubProgress={activeLocation?.progress !== undefined ? activeLocation.progress / 100 : undefined}
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
            {/* Multi-Tab Reader Container */}
            <div className="relative w-full h-full overflow-hidden">
                {openFiles.map((file, index) => {
                    const isActive = index === activeFileIndex;
                    return (
                        <div
                            key={file.id}
                            className={`w-full h-full ${isActive ? "block" : "hidden"}`}
                        >
                            <ReaderRenderer
                                ref={(handle) => {
                                    readerRefs.current[file.id] = handle;
                                }}
                                file={file}
                                isActive={isActive}
                                viewOptions={{
                                    viewMode,
                                    fitMode,
                                    zoom,
                                    fontSize,
                                }}
                                initialLocation={tabStates[file.id]}
                                onLocationChange={(loc) => handleTabLocationChange(file.id, loc)}
                            />
                        </div>
                    );
                })}
            </div>
        </UnifiedReaderLayout>
    );
}

export default function ReaderPage() {
    return (
        <Suspense
            fallback={
                <div className="h-screen bg-background flex items-center justify-center text-foreground">
                    Loading Reader...
                </div>
            }
        >
            <ReaderContent />
        </Suspense>
    );
}
