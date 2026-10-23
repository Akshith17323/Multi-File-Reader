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
import { isElectron } from "@/hooks/useEnvironment";
import { saveLocalFileToLibrary } from "@/utils/localLibrary";
import { getBookmarkUnified, saveBookmarkUnified, deleteBookmarkUnified } from "@/utils/localBookmarks";
import { saveReaderSession, getLastReaderSession, clearReaderSession, createReaderUrl, parseReaderFiles, clampActiveIndex } from "@/utils/readerSession";
import { getFileName, normalizeFileUrl, isLocalFileUrl } from "@/utils/fileUrls";
import { getLocalLibraryFiles } from "@/utils/localLibrary";
import { apiClient } from "@/services/apiClient";
import { DocumentSearch } from "@/components/DocumentSearch";
import { migrateLocalAnnotations } from "@/utils/localAnnotations";
import { AlertTriangle, Link2 } from "lucide-react";
import { toast } from "react-toastify";

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
    const [loadedBookmarks, setLoadedBookmarks] = useState<Record<string, boolean>>({});
    const [initialLocations, setInitialLocations] = useState<Record<string, ReaderLocationState>>({});

    // Common view options
    const [viewMode, setViewMode] = useState<ViewMode>("single");
    const [fitMode, setFitMode] = useState<FitMode>("width");
    const [zoom, setZoom] = useState(1.0);
    const [fontSize, setFontSize] = useState(100);

    // Multi-tab location state dictionary (keyed by tab file ID)
    const [tabStates, setTabStates] = useState<Record<string, ReaderLocationState>>({});

    // Polymorphic handles for each active reader instance
    const readerRefs = useRef<Record<string, ReaderHandle | null>>({});

    // Extensibility State (Search & Annotations)
    const [isSearchOpen, setIsSearchOpen] = useState(false);

    // Initialize files from URL params or restore last session
    useEffect(() => {
        if (!filesParam) {
            const lastSession = getLastReaderSession();
            if (lastSession && lastSession.fileUrls.length > 0) {
                router.replace(createReaderUrl(lastSession.fileUrls, lastSession.activeIndex));
                return;
            }
            router.push("/files");
            return;
        }

        try {
            const fileUrls = parseReaderFiles(filesParam);
            if (!fileUrls.length) { router.replace("/files"); return; }

            const files: FileTabData[] = fileUrls.map((url) => {
                const fileName = getLocalLibraryFiles().find(file => file.url === url)?.name || getFileName(url);
                const fileType = ReaderFactory.detectFileType(url);

                return {
                    id: url,
                    url,
                    name: fileName,
                    type: fileType,
                };
            });

            setOpenFiles(prev => files.map(file => prev.find(existing => existing.url === file.url) || file));
            setActiveFileIndex(clampActiveIndex(Number(activeParam), files.length));
            setIsInitialized(true);

        } catch (error) {
            console.error("Error parsing files:", error);
            router.push("/files");
        }
    }, [filesParam, activeParam, router]);

    // Update URL and persist session when tabs or active file changes
    useEffect(() => {
        if (!isInitialized || openFiles.length === 0) return;

        const fileUrls = openFiles.map((f) => f.url);
        sessionStorage.setItem("readerFiles", JSON.stringify(fileUrls));
        saveReaderSession(fileUrls, activeFileIndex);
        const newUrl = createReaderUrl(fileUrls, activeFileIndex);
        if (`${window.location.pathname}${window.location.search}` !== newUrl) window.history.replaceState(null, "", newUrl);
    }, [openFiles, activeFileIndex, isInitialized]);

    // Load bookmark for active file (unified local-first with cloud sync)
    useEffect(() => {
        if (!isInitialized || openFiles.length === 0) return;

        let canceled = false;
        const token = localStorage.getItem("token");
        const load = async () => {
            for (const file of openFiles) {
                if (loadedBookmarks[file.id]) continue;
                const data = await getBookmarkUnified(token, file.url);
                if (canceled) return;
                const location = { pageNumber: data?.pageNumber, totalPages: data?.totalPages, cfi: data?.cfi, progress: data?.progress };
                setInitialLocations(prev => ({ ...prev, [file.id]: location }));
                setTabStates(prev => ({ ...prev, [file.id]: location }));
                setLoadedBookmarks(prev => ({ ...prev, [file.id]: true }));
            }
        };
        void load();
        return () => { canceled = true; };
    }, [openFiles, isInitialized, loadedBookmarks]);

    // Save bookmark for specific file tab
    const saveBookmark = useCallback(async (fileId: string, location: ReaderLocationState) => {
        const file = openFiles.find((f) => f.id === fileId);
        if (!file) return;

        try {
            const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
            await saveBookmarkUnified(token, {
                fileUrl: file.url,
                fileName: file.name,
                pageNumber: location.pageNumber,
                totalPages: location.totalPages,
                cfi: location.cfi,
                progress: location.progress,
            });
        } catch (err) {
            console.error("Failed to save bookmark", err);
        }
    }, [openFiles]);

    // Check if active local file is missing/moved on disk
    useEffect(() => {
        if (!isInitialized || openFiles.length === 0) return;
        if (!isElectron() || !(window as any).electronAPI?.invoke) return;

        const currentActive = openFiles[activeFileIndex];
        if (!currentActive) return;

        const isLocal = isLocalFileUrl(currentActive.url);

        if (!isLocal) return;

        (window as any).electronAPI
            .invoke("check-local-files-status", [currentActive.url])
            .then((statusMap: Record<string, { exists: boolean; path: string; error?: string }>) => {
                if (statusMap) {
                    setOfflineFiles((prev) => ({ ...prev, ...statusMap }));
                }
            })
            .catch((err: any) => console.warn("Failed to check active file status:", err));
    }, [activeFileIndex, openFiles, isInitialized]);

    const activeFile = openFiles[activeFileIndex];
    const activeLocation = activeFile ? tabStates[activeFile.id] : undefined;
    const isOffline = activeFile ? offlineFiles[activeFile.url]?.exists === false || offlineFiles[activeFile.url]?.readable === false : false;
    const offlinePath = activeFile ? offlineFiles[activeFile.url]?.path || activeFile.url : "";

    const handleRelinkActiveFile = async () => {
        if (!activeFile) return;
        try {
            if (!(window as any).electronAPI?.invoke) {
                toast.info("Relinking is supported in the desktop app");
                return;
            }

            setIsRelinking(true);
            const result = await (window as any).electronAPI.invoke("relink-local-file", {
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
            const newUrl = normalizeFileUrl(result.newUrl);
            const libraryFile = getLocalLibraryFiles().find(file => file.url === oldUrl);
            if (libraryFile && localStorage.getItem("token")) {
                await apiClient.updateFile(localStorage.getItem("token")!, libraryFile.id, { fileUrl: newUrl, fileName: result.fileName, fileSize: result.fileSize, fileType: result.fileType });
            }
            await saveLocalFileToLibrary({ name: result.fileName, url: newUrl, size: result.fileSize, contentType: result.fileType });
            const newName = result.fileName;

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

            migrateLocalAnnotations(oldUrl, newUrl);

            const updatedFiles = openFiles.map((file, index) => {
                if (index === activeFileIndex) {
                    const fileType = ReaderFactory.detectFileType(newUrl);
                    return {
                        ...file,
                        url: newUrl,
                        name: newName,
                        type: fileType,
                    };
                }
                return file;
            });

            setOpenFiles(updatedFiles);

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
            if (!(window as any).electronAPI?.invoke) {
                toast.info("Local file access is available in desktop app");
                return;
            }

            const result = await (window as any).electronAPI.invoke("open-local-file");
            if (!result || result.canceled) return;

            if (result.error) {
                toast.error(`Permission/access error: ${result.error}`);
                return;
            }

            await saveLocalFileToLibrary({
                name: result.fileName,
                url: result.url,
                size: result.fileSize,
                contentType: result.fileType,
            });

            const existingIndex = openFiles.findIndex((f) => f.url === result.url);
            if (existingIndex >= 0) {
                setActiveFileIndex(existingIndex);
                toast.info(`Switched to "${result.fileName}"`);
                return;
            }

            const fileType = ReaderFactory.detectFileType(result.url);

            const newTabData: FileTabData = {
                id: result.url,
                url: result.url,
                name: result.fileName,
                type: fileType,
            };

            const updatedFiles = [...openFiles, newTabData];
            setOpenFiles(updatedFiles);
            setActiveFileIndex(updatedFiles.length - 1);
            toast.success(`Opened "${result.fileName}" in new tab`);
        } catch (err: any) {
            toast.error(err.message || "Failed to open local file");
        }
    };

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
            clearReaderSession();
            sessionStorage.removeItem("readerFiles");
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

    // Polymorphic Next/Prev Page Actions
    const handleNextPage = useCallback(() => {
        if (!activeFile) return;
        readerRefs.current[activeFile.id]?.next();
    }, [activeFile]);

    const handlePrevPage = useCallback(() => {
        if (!activeFile) return;
        readerRefs.current[activeFile.id]?.prev();
    }, [activeFile]);

    // Keyboard navigation & search shortcut
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            const target = e.target as HTMLElement;
            if (target?.closest("input, textarea, select, [contenteditable=true]")) return;
            if (e.key === "Escape") { setIsSearchOpen(false); return; }
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "f") {
                e.preventDefault();
                setIsSearchOpen(true);
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
    }, [handleNextPage, handlePrevPage]);

    if (!isInitialized || openFiles.length === 0) {
        return (
            <div className="h-[calc(100svh-var(--titlebar-height))] bg-background flex items-center justify-center text-foreground">
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
            isSearchOpen={isSearchOpen}
            onToggleSearch={() => setIsSearchOpen((prev) => !prev)}
        >
            <div className="flex h-full min-h-0 flex-col">
            {isSearchOpen && activeFile && <DocumentSearch file={activeFile} onClose={() => setIsSearchOpen(false)} onGoToPage={(page) => readerRefs.current[activeFile.id]?.goToPage?.(page)} onGoToCfi={(cfi) => readerRefs.current[activeFile.id]?.goToCfi?.(cfi)} />}
            <div className="min-h-0 flex-1">
            {isOffline ? (
                <div className="w-full h-full flex items-center justify-center overflow-y-auto p-4 sm:p-6 bg-background/60 text-foreground relative">
                    <div className="mfr-panel relative z-10 max-w-xl w-full mx-auto rounded-3xl p-5 sm:p-8 shadow-sm flex flex-col items-center text-center">
                        <div className="w-16 h-16 rounded-2xl bg-red-500/15 border border-red-500/30 flex items-center justify-center text-red-500 mb-5 shadow-[0_0_30px_rgba(239,68,68,0.3)]">
                            <AlertTriangle size={34} className="animate-pulse" />
                        </div>

                        <h2 className="text-2xl font-extrabold tracking-tight text-foreground mb-2">
                            File unavailable
                        </h2>

                        <p className="text-foreground-muted text-sm sm:text-base max-w-md mb-6 leading-relaxed">
                            Multi-File Reader could not find this file on disk. It may have been moved, renamed, or deleted.
                        </p>

                        <div className="w-full bg-background/80 border border-border-subtle rounded-2xl p-4 mb-8 text-left">
                            <span className="text-[11px] font-bold text-foreground-muted uppercase tracking-wider block mb-1">
                                Last Known Disk Location
                            </span>
                            <p className="font-mono text-xs sm:text-sm text-foreground break-all select-text bg-surface/50 p-2.5 rounded-xl border border-border-subtle">
                                {offlinePath}
                            </p>
                        </div>

                        <div className="flex flex-col sm:flex-row items-center gap-3 w-full justify-center">
                            <button
                                onClick={handleRelinkActiveFile}
                                disabled={isRelinking}
                                className="mfr-button-primary w-full sm:w-auto"
                            >
                                <Link2 size={18} />
                                <span>{isRelinking ? "Relinking..." : "Locate file"}</span>
                            </button>

                            <button
                                onClick={() => router.push("/files")}
                                className="mfr-button-secondary w-full sm:w-auto"
                            >
                                Return to Library
                            </button>
                        </div>
                    </div>
                </div>
            ) : (
                /* Multi-Tab Polymorphic Reader Container */
                <div className="relative w-full h-full overflow-hidden">
                    {openFiles.filter(file => loadedBookmarks[file.id]).map((file) => {
                        const index = openFiles.findIndex(item => item.id === file.id);
                        const isActive = index === activeFileIndex;
                        return (
                            <div
                                key={file.url}
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
                                    initialLocation={initialLocations[file.id]}
                                    onLocationChange={(loc) => handleTabLocationChange(file.id, loc)}
                                />
                            </div>
                        );
                    })}
                </div>
            )}
            </div>
            </div>
        </UnifiedReaderLayout>
    );
}

export default function ReaderPage() {
    return (
        <Suspense
            fallback={
                <div className="h-[calc(100svh-var(--titlebar-height))] bg-background flex items-center justify-center text-foreground">
                    Loading Reader...
                </div>
            }
        >
            <ReaderContent />
        </Suspense>
    );
}
