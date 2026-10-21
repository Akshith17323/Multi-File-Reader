"use client";

import { useState, useEffect, Suspense, useRef, RefObject } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import UnifiedReaderLayout, { ViewMode, FitMode } from "@/components/UnifiedReaderLayout";
import { FileTabData } from "@/components/FileTab";
import dynamic from "next/dynamic";
import { isElectron } from "@/hooks/useEnvironment";
import { saveLocalFileToLibrary } from "@/utils/localLibrary";
import { getBookmarkUnified, saveBookmarkUnified, deleteBookmarkUnified } from "@/utils/localBookmarks";
import { saveReaderSession, getLastReaderSession, clearReaderSession } from "@/utils/readerSession";
import { migrateLocalAnnotations } from "@/utils/localAnnotations";
import { AlertTriangle, Link2 } from "lucide-react";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

import { EPUBRendererRef } from "@/components/EPUBRenderer";

const PDFRenderer = dynamic(() => import("@/components/PDFRenderer"), { ssr: false });
const EPUBRenderer = dynamic(() => import("@/components/EPUBRenderer"), { ssr: false });
const TextRenderer = dynamic(() => import("@/components/TextRenderer"), { ssr: false });

interface ActiveFileReaderProps {
    activeFile: FileTabData | undefined;
    pdfPage: number;
    handlePdfPageChange: (page: number) => void;
    handlePdfLoadSuccess: (pages: number) => void;
    viewMode: ViewMode;
    fitMode: FitMode;
    zoom: number;
    epubRef: RefObject<EPUBRendererRef | null>;
    handleEpubLocationChange: (cfi: string) => void;
    setEpubProgress: (progress: number) => void;
    fontSize: number;
    initialEpubLocation?: string;
}

function getReaderSourceUrl(url: string): string {
    if (url.startsWith("mfr-local://") || url.startsWith("blob:") || url.startsWith("data:")) {
        return url;
    }
    if (url.startsWith("/") || /^[a-zA-Z]:[\\/]/.test(url) || url.startsWith("file://")) {
        const cleanPath = url.replace(/^file:\/\//, "");
        return `mfr-local://${cleanPath}`;
    }
    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:2007";
    return `${backendUrl}/proxy?url=${encodeURIComponent(url)}`;
}

function ActiveFileReader({
    activeFile,
    pdfPage,
    handlePdfPageChange,
    handlePdfLoadSuccess,
    viewMode,
    fitMode,
    zoom,
    epubRef,
    handleEpubLocationChange,
    setEpubProgress,
    fontSize,
    initialEpubLocation,
}: ActiveFileReaderProps) {
    if (!activeFile) return null;
    const sourceUrl = getReaderSourceUrl(activeFile.url);

    switch (activeFile.type) {
        case "pdf":
            return (
                <PDFRenderer
                    key={activeFile.id}
                    blobUrl={sourceUrl}
                    pageNumber={pdfPage}
                    onPageChange={handlePdfPageChange}
                    onLoadSuccess={handlePdfLoadSuccess}
                    viewMode={viewMode}
                    fitMode={fitMode}
                    scale={zoom}
                />
            );
        case "epub":
            return (
                <EPUBRenderer
                    key={activeFile.id}
                    ref={epubRef}
                    url={sourceUrl}
                    initialLocation={initialEpubLocation}
                    onLocationChange={handleEpubLocationChange}
                    onProgressChange={setEpubProgress}
                    viewMode={viewMode}
                    fontSize={fontSize}
                />
            );
        case "txt":
            return (
                <TextRenderer
                    key={activeFile.id}
                    url={sourceUrl}
                    fontSize={fontSize}
                    viewMode={viewMode}
                />
            );
        default:
            return <div className="text-foreground">Unsupported file type</div>;
    }
}

function ReaderContent() {
    const searchParams = useSearchParams();
    const router = useRouter();

    // Parse file URLs and active index from query params
    const filesParam = searchParams.get("files");
    const activeParam = searchParams.get("active");

    const [openFiles, setOpenFiles] = useState<FileTabData[]>([]);
    const [activeFileIndex, setActiveFileIndex] = useState(0);
    const [isInitialized, setIsInitialized] = useState(false);
    const [offlineFiles, setOfflineFiles] = useState<
        Record<string, { exists: boolean; path: string; error?: string; readable?: boolean; isLocal?: boolean }>
    >({});
    const [isRelinking, setIsRelinking] = useState(false);

    // Reader state
    const [viewMode, setViewMode] = useState<ViewMode>("single");
    const [fitMode, setFitMode] = useState<FitMode>("width");
    const [zoom, setZoom] = useState(1.0);
    const [fontSize, setFontSize] = useState(100);

    // PDF-specific state
    const [pdfPage, setPdfPage] = useState(1);
    const [pdfTotalPages, setPdfTotalPages] = useState(0);

    // EPUB-specific state
    const epubRef = useRef<EPUBRendererRef>(null);
    const [epubProgress, setEpubProgress] = useState<number>(0);
    const [epubLocation, setEpubLocation] = useState<string | undefined>(undefined);

    // Feature 6 Extensibility State (Search & Annotations)
    const [isSearchOpen, setIsSearchOpen] = useState(false);

    // Initialize files from URL params or restore last session (Feature 7)
    useEffect(() => {
        if (!filesParam) {
            // Check if there is a saved previous session to resume
            const lastSession = getLastReaderSession();
            if (lastSession && lastSession.fileUrls.length > 0) {
                const encodedFiles = lastSession.fileUrls.map((url) => encodeURIComponent(url)).join(",");
                router.replace(`/reader?files=${encodedFiles}&active=${lastSession.activeIndex}`);
                return;
            }
            router.push("/files");
            return;
        }

        try {
            // Decode the files parameter (format: encodedUrl1,encodedUrl2,encodedUrl3)
            const fileUrls = filesParam.split(",").map((url) => decodeURIComponent(url));

            const files: FileTabData[] = fileUrls.map((url, index) => {
                const fileName = url.split("/").pop() || `File ${index + 1}`;
                const lowerUrl = url.toLowerCase();
                const fileType = lowerUrl.endsWith(".pdf") ? "pdf" : lowerUrl.endsWith(".txt") ? "txt" : "epub";

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

    // Update URL and persist session when tabs or active file changes (Feature 7)
    useEffect(() => {
        if (!isInitialized || openFiles.length === 0) return;

        const fileUrls = openFiles.map((f) => f.url);
        const encodedFileUrls = fileUrls.map((url) => encodeURIComponent(url)).join(",");
        const newUrl = `/reader?files=${encodedFileUrls}&active=${activeFileIndex}`;

        // Save to sessionStorage for cross-tab awareness
        sessionStorage.setItem("readerFiles", fileUrls.join(","));

        // Persist session for Feature 7 (Session Restore on next launch / reload)
        saveReaderSession(fileUrls, activeFileIndex);

        // Use replaceState to avoid cluttering history
        window.history.replaceState({}, "", newUrl);
    }, [openFiles, activeFileIndex, isInitialized]);

    // Load bookmark for active file (Feature 4: Local-first with cloud fallback/merge)
    useEffect(() => {
        if (!isInitialized || openFiles.length === 0) return;

        const activeFile = openFiles[activeFileIndex];
        if (!activeFile) return;

        const loadBookmark = async () => {
            try {
                const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
                const data = await getBookmarkUnified(token, activeFile.url);

                if (data) {
                    if (activeFile.type === "pdf" && data.pageNumber) {
                        setPdfPage(data.pageNumber);
                    }
                    if (activeFile.type === "epub" && data.cfi) {
                        setEpubLocation(data.cfi);
                    }
                }
            } catch (err) {
                console.error("Failed to load bookmark", err);
            }
        };

        loadBookmark();
    }, [activeFileIndex, openFiles, isInitialized]);

    // Save bookmark (Feature 4: Always persists locally for offline/guest, syncs to cloud if token present)
    const saveBookmark = async (pageNumber?: number, cfi?: string, customProgress?: number) => {
        if (!isInitialized || openFiles.length === 0) return;

        const activeFile = openFiles[activeFileIndex];
        if (!activeFile) return;

        try {
            const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;

            let progress = customProgress ?? 0;
            if (activeFile.type === "pdf" && pageNumber && pdfTotalPages > 0) {
                progress = Math.round((pageNumber / pdfTotalPages) * 100);
            } else if (activeFile.type === "epub" && customProgress !== undefined) {
                progress = Math.round(customProgress * 100);
            }

            await saveBookmarkUnified(token, {
                fileUrl: activeFile.url,
                fileName: activeFile.name,
                pageNumber: pageNumber || (activeFile.type === "pdf" ? pdfPage : undefined),
                totalPages: pdfTotalPages || undefined,
                cfi: cfi || (activeFile.type === "epub" ? epubLocation : undefined),
                progress,
            });
        } catch (err) {
            console.error("Failed to save bookmark", err);
        }
    };

    const activeFile = openFiles[activeFileIndex];
    const isOffline = activeFile ? offlineFiles[activeFile.url]?.exists === false : false;
    const offlinePath = activeFile ? offlineFiles[activeFile.url]?.path || activeFile.url : "";

    // Check if active local file is missing/moved on disk
    useEffect(() => {
        if (!isInitialized || openFiles.length === 0) return;
        if (!isElectron() || !window.electronAPI?.invoke) return;

        const currentActive = openFiles[activeFileIndex];
        if (!currentActive) return;

        const isLocal =
            currentActive.url.startsWith("mfr-local://") ||
            currentActive.url.startsWith("file://") ||
            currentActive.url.startsWith("/") ||
            /^[a-zA-Z]:[\\/]/.test(currentActive.url);

        if (!isLocal) return;

        window.electronAPI
            .invoke("check-local-files-status", [currentActive.url])
            .then((statusMap: Record<string, { exists: boolean; path: string; error?: string }>) => {
                if (statusMap) {
                    setOfflineFiles((prev) => ({ ...prev, ...statusMap }));
                }
            })
            .catch((err) => console.warn("Failed to check active file status:", err));
    }, [activeFileIndex, openFiles, isInitialized]);

    const handleRelinkActiveFile = async () => {
        if (!activeFile) return;
        try {
            if (!window.electronAPI?.invoke) {
                toast.info("Relinking is supported in the desktop app");
                return;
            }

            setIsRelinking(true);
            const result = await window.electronAPI.invoke("relink-local-file", {
                oldUrl: activeFile.url,
                originalFileName: activeFile.name,
            });

            if (!result || result.canceled) {
                setIsRelinking(false);
                return;
            }

            if (result.error) {
                toast.error(`Relink failed: ${result.error}`);
                setIsRelinking(false);
                return;
            }

            const oldUrl = activeFile.url;
            const newUrl = result.newUrl;
            const newName = result.fileName;

            // Migrate bookmarks (local + cloud)
            const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
            try {
                const oldBookmark = await getBookmarkUnified(token, oldUrl);
                if (oldBookmark) {
                    await saveBookmarkUnified(token, {
                        ...oldBookmark,
                        fileUrl: newUrl,
                        fileName: newName,
                    });
                    await deleteBookmarkUnified(token, oldUrl);
                }
            } catch (bErr) {
                console.warn("Could not migrate bookmark on relink:", bErr);
            }

            // Migrate local annotations (Feature 6 forward compatibility)
            migrateLocalAnnotations(oldUrl, newUrl);

            // Update openFiles state with the new URL and name
            const updatedFiles = openFiles.map((file, index) => {
                if (index === activeFileIndex) {
                    const lowerUrl = newUrl.toLowerCase();
                    const fileType = lowerUrl.endsWith(".pdf") ? "pdf" : lowerUrl.endsWith(".txt") ? "txt" : "epub";
                    return {
                        ...file,
                        url: newUrl,
                        name: newName,
                        type: fileType as any,
                    };
                }
                return file;
            });

            setOpenFiles(updatedFiles);

            // Clear offline flag for old & new URL
            setOfflineFiles((prev) => {
                const next = { ...prev };
                delete next[oldUrl];
                next[newUrl] = { exists: true, readable: true, path: result.newPath };
                return next;
            });

            toast.success(`Relinked successfully to "${newName}"`);
        } catch (err: any) {
            toast.error(err.message || "Failed to relink file");
        } finally {
            setIsRelinking(false);
        }
    };

    const handleOpenLocalFile = async () => {
        try {
            if (!window.electronAPI?.invoke) {
                toast.info("Local file access is available in desktop app");
                return;
            }

            const result = await window.electronAPI.invoke("open-local-file");
            if (!result || result.canceled || !result.url) return;

            if (result.error) {
                toast.error(`Permission/access error: ${result.error}`);
                return;
            }

            // Persist to user's library
            await saveLocalFileToLibrary({
                name: result.fileName,
                url: result.url,
                size: result.fileSize,
                contentType: result.fileType,
            });

            // Check if already open
            const existingIndex = openFiles.findIndex((f) => f.url === result.url);
            if (existingIndex >= 0) {
                setActiveFileIndex(existingIndex);
                toast.info(`Switched to "${result.fileName}"`);
                return;
            }

            // Append as new tab
            const lowerUrl = result.url.toLowerCase();
            const fileType = lowerUrl.endsWith(".pdf") ? "pdf" : lowerUrl.endsWith(".txt") ? "txt" : "epub";

            const newTabData: FileTabData = {
                id: `file_${openFiles.length}_${Date.now()}`,
                url: result.url,
                name: result.fileName,
                type: fileType as any,
            };

            const updatedFiles = [...openFiles, newTabData];
            setOpenFiles(updatedFiles);
            setActiveFileIndex(updatedFiles.length - 1);
            toast.success(`Opened "${result.fileName}" in new tab`);
        } catch (err: any) {
            toast.error(err.message || "Failed to open local file");
        }
    };

    // Handlers
    const handleTabChange = (index: number) => {
        setActiveFileIndex(index);
        // Reset reader state when switching files
        setPdfPage(1);
        setPdfTotalPages(0);
        setEpubLocation(undefined);
    };

    const handleTabClose = (index: number) => {
        const newFiles = openFiles.filter((_, i) => i !== index);

        if (newFiles.length === 0) {
            // No files left, clear session and return to library
            clearReaderSession();
            sessionStorage.removeItem("readerFiles");
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

    const handleEpubLocationChange = (cfi: string) => {
        setEpubLocation(cfi);
        saveBookmark(undefined, cfi);
    };

    const handleNextPage = () => {
        if (activeFile?.type === "epub") {
            epubRef.current?.next();
        } else {
            const increment = viewMode === "two-page" ? 2 : 1;
            setPdfPage((prev) => {
                const next = Math.min(prev + increment, pdfTotalPages);
                saveBookmark(next);
                return next;
            });
        }
    };

    const handlePrevPage = () => {
        if (activeFile?.type === "epub") {
            epubRef.current?.prev();
        } else {
            const increment = viewMode === "two-page" ? 2 : 1;
            setPdfPage((prev) => {
                const next = Math.max(prev - increment, 1);
                saveBookmark(next);
                return next;
            });
        }
    };

    // Keyboard navigation & search shortcut
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "f") {
                e.preventDefault();
                setIsSearchOpen((prev) => !prev);
                return;
            }
            if (e.key === "ArrowRight") {
                handleNextPage();
            } else if (e.key === "ArrowLeft") {
                handlePrevPage();
            }
        };

        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeFile, viewMode, pdfTotalPages]);

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
            onOpenLocalFile={isElectron() ? handleOpenLocalFile : undefined}
            currentPage={activeFile?.type === "pdf" && !isOffline ? pdfPage : undefined}
            totalPages={activeFile?.type === "pdf" && !isOffline ? pdfTotalPages : undefined}
            epubProgress={activeFile?.type === "epub" && !isOffline ? epubProgress : undefined}
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
            isSearchOpen={isSearchOpen}
            onToggleSearch={() => setIsSearchOpen((prev) => !prev)}
        >
            <ToastContainer position="top-right" theme="dark" />
            {isOffline ? (
                <div className="w-full h-full min-h-[600px] flex items-center justify-center p-6 bg-[#0c0d10] text-foreground select-none relative overflow-hidden">
                    {/* Cinematic DaVinci Hazard Striping Overlay */}
                    <div
                        className="absolute inset-0 opacity-10 pointer-events-none"
                        style={{
                            backgroundImage: `repeating-linear-gradient(-45deg, #ef4444 0px, #ef4444 20px, transparent 20px, transparent 40px)`,
                        }}
                    />

                    {/* Ambient Glow */}
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-red-600/10 blur-[120px] rounded-full pointer-events-none" />

                    {/* Central Warning Card */}
                    <div className="relative z-10 max-w-xl w-full mx-auto bg-surface/90 backdrop-blur-2xl border-2 border-red-500/30 rounded-3xl p-8 sm:p-10 shadow-[0_20px_60px_rgba(0,0,0,0.6)] flex flex-col items-center text-center">
                        {/* Warning Icon Badge */}
                        <div className="w-16 h-16 rounded-2xl bg-red-500/15 border border-red-500/30 flex items-center justify-center text-red-500 mb-5 shadow-[0_0_30px_rgba(239,68,68,0.3)]">
                            <AlertTriangle size={34} className="animate-pulse" />
                        </div>

                        {/* Title */}
                        <h2 className="text-2xl sm:text-3xl font-black tracking-[0.2em] text-red-500 uppercase mb-2">
                            Media Offline
                        </h2>

                        {/* Subtitle */}
                        <p className="text-foreground-muted text-sm sm:text-base max-w-md mb-6 leading-relaxed">
                            Multi-File Reader could not find this file on disk. It may have been moved, renamed, or deleted.
                        </p>

                        {/* Last Known Path Card */}
                        <div className="w-full bg-background/80 border border-border-subtle rounded-2xl p-4 mb-8 text-left">
                            <span className="text-[11px] font-bold text-foreground-muted uppercase tracking-wider block mb-1">
                                Last Known Disk Location
                            </span>
                            <p className="font-mono text-xs sm:text-sm text-foreground break-all select-text bg-surface/50 p-2.5 rounded-xl border border-border-subtle">
                                {offlinePath}
                            </p>
                        </div>

                        {/* Action Buttons */}
                        <div className="flex flex-col sm:flex-row items-center gap-3 w-full justify-center">
                            <button
                                onClick={handleRelinkActiveFile}
                                disabled={isRelinking}
                                className="w-full sm:w-auto flex items-center justify-center gap-2.5 px-8 py-4 bg-red-600 hover:bg-red-500 text-white font-bold rounded-2xl shadow-[0_0_25px_rgba(239,68,68,0.4)] hover:shadow-[0_0_35px_rgba(239,68,68,0.6)] transition-all transform hover:scale-105 active:scale-95 cursor-pointer disabled:opacity-50"
                            >
                                <Link2 size={18} />
                                <span>{isRelinking ? "Relinking..." : "Relink Media File..."}</span>
                            </button>

                            <button
                                onClick={() => router.push("/files")}
                                className="w-full sm:w-auto px-6 py-4 bg-surface hover:bg-surface-hover text-foreground border border-border-subtle hover:border-foreground-muted rounded-2xl font-bold text-sm transition-colors cursor-pointer"
                            >
                                Return to Library
                            </button>
                        </div>
                    </div>
                </div>
            ) : (
                <ActiveFileReader
                    activeFile={activeFile}
                    pdfPage={pdfPage}
                    handlePdfPageChange={handlePdfPageChange}
                    handlePdfLoadSuccess={handlePdfLoadSuccess}
                    viewMode={viewMode}
                    fitMode={fitMode}
                    zoom={zoom}
                    epubRef={epubRef}
                    handleEpubLocationChange={handleEpubLocationChange}
                    setEpubProgress={setEpubProgress}
                    fontSize={fontSize}
                    initialEpubLocation={epubLocation}
                />
            )}
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
