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
    ReaderViewOptions,
    ReaderStatus,
} from "@/components/readers/types";
import { isElectron } from "@/hooks/useEnvironment";
import { saveLocalFileToLibrary, updateLocalLibraryFile } from "@/utils/localLibrary";
import { getBookmarkUnified, saveBookmarkUnified, deleteBookmarkUnified, flushBookmarkSync } from "@/utils/localBookmarks";
import { saveReaderSession, getLastReaderSession, clearReaderSession, createReaderUrl, parseReaderFiles, clampActiveIndex } from "@/utils/readerSession";
import { getFileName, normalizeFileUrl, isLocalFileUrl } from "@/utils/fileUrls";
import { getLocalLibraryFiles } from "@/utils/localLibrary";
import { apiClient } from "@/services/apiClient";
import { DocumentSearch } from "@/components/DocumentSearch";
import { migrateLocalAnnotations } from "@/utils/localAnnotations";
import { AlertTriangle, Link2 } from "lucide-react";
import { toast } from "react-toastify";
import ReaderFilePicker from '@/components/ReaderFilePicker';
import { DEFAULT_READER_OPTIONS, addReaderTab, getIndexAfterTabClose, readerTabId, readerPanelId } from '@/utils/readerTabs';

function localStorageSafeToken() {
    return typeof window === "undefined" ? null : localStorage.getItem("token");
}

function ReaderContent() {
    const searchParams = useSearchParams();
    const router = useRouter();

    // Parse file URLs and active index from query params
    const filesParam = searchParams.get("files");
    const activeParam = searchParams.get("active");
    const accountScope = useRef(localStorageSafeToken());
    const appliedUrl = useRef<string | null>(null);
    const pendingNavigation = useRef<string | null>(null);

    const [openFiles, setOpenFiles] = useState<FileTabData[]>([]);
    const [activeFileIndex, setActiveFileIndex] = useState(0);
    const [isInitialized, setIsInitialized] = useState(false);
    const [offlineFiles, setOfflineFiles] = useState<
        Record<string, { exists: boolean; path: string; error?: string; readable?: boolean; isLocal?: boolean }>
    >({});
    const [isRelinking, setIsRelinking] = useState(false);
    const [loadedBookmarks, setLoadedBookmarks] = useState<Record<string, boolean>>({});
    const [initialLocations, setInitialLocations] = useState<Record<string, ReaderLocationState>>({});
    const [tabOptions, setTabOptions] = useState<Record<string, ReaderViewOptions>>({});
    const [readerStatuses, setReaderStatuses] = useState<Record<string, ReaderStatus>>({});
    const [startedTabs, setStartedTabs] = useState<Record<string, boolean>>({});
    const [retryCounts, setRetryCounts] = useState<Record<string, number>>({});
    const [isPickerOpen, setIsPickerOpen] = useState(false);
    const openingLocal = useRef(false);

    useEffect(() => {
        const checkAccount = () => {
            if (localStorage.getItem("token") !== accountScope.current) router.replace("/auth/login");
        };
        window.addEventListener("auth-change", checkAccount);
        window.addEventListener("storage", checkAccount);
        return () => { window.removeEventListener("auth-change", checkAccount); window.removeEventListener("storage", checkAccount); };
    }, [router]);

    // Common view options
    const activeOptions = tabOptions[openFiles[activeFileIndex]?.id] || DEFAULT_READER_OPTIONS;
    const { viewMode, fitMode, zoom, fontSize } = activeOptions;
    const updateViewOptions = (changes: Partial<ReaderViewOptions>) => {
        const id = openFiles[activeFileIndex]?.id;
        if (id) setTabOptions(prev => ({ ...prev, [id]: { ...(prev[id] || DEFAULT_READER_OPTIONS), ...changes } }));
    };

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
            if (!fileUrls.length && filesParam !== '[]') { router.replace("/files"); return; }
            const incomingUrl = createReaderUrl(fileUrls, Number(activeParam));
            if (appliedUrl.current === incomingUrl) return;
            appliedUrl.current = incomingUrl;
            pendingNavigation.current = incomingUrl;

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
            const retain = <T,>(values: Record<string, T>) => Object.fromEntries(Object.entries(values).filter(([id]) => files.some(file => file.id === id)));
            setLoadedBookmarks(retain); setInitialLocations(retain); setStartedTabs(retain); setReaderStatuses(retain); setTabStates(retain);
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
        const newUrl = createReaderUrl(fileUrls, activeFileIndex);
        // Wait for externally navigated tabs to render before persisting their state.
        if (pendingNavigation.current && pendingNavigation.current !== newUrl) return;
        pendingNavigation.current = null;
        appliedUrl.current = newUrl;
        sessionStorage.setItem("readerFiles", JSON.stringify(fileUrls));
        saveReaderSession(fileUrls, activeFileIndex);
        if (`${window.location.pathname}${window.location.search}` !== newUrl) window.history.replaceState(null, "", newUrl);
    }, [openFiles, activeFileIndex, isInitialized]);

    // Load bookmark for active file (unified local-first with cloud sync)
    useEffect(() => {
        if (!isInitialized || openFiles.length === 0) return;

        let canceled = false;
        const token = localStorage.getItem("token");
        const load = async () => {
            await Promise.all(openFiles.filter(file => !loadedBookmarks[file.id]).map(async file => {
                const data = await getBookmarkUnified(token, file.url);
                if (canceled) return;
                const location = { pageNumber: data?.pageNumber, totalPages: data?.totalPages, cfi: data?.cfi, progress: data?.progress };
                setInitialLocations(prev => ({ ...prev, [file.id]: location }));
                setTabStates(prev => ({ ...prev, [file.id]: location }));
                setLoadedBookmarks(prev => ({ ...prev, [file.id]: true }));
                if (data?.fileName && data.fileName !== 'Unknown') setOpenFiles(prev => prev.map(item => item.id === file.id ? { ...item, name: data.fileName! } : item));
            }));
        };
        void load();
        return () => { canceled = true; };
    }, [openFiles, isInitialized, loadedBookmarks]);

    // Save bookmark for specific file tab
    const saveBookmark = useCallback(async (fileId: string, location: ReaderLocationState) => {
        const file = openFiles.find((f) => f.id === fileId);
        if (!file || !loadedBookmarks[file.id]) return;

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
    }, [openFiles, loadedBookmarks]);

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
    const activeStatus = activeFile ? readerStatuses[activeFile.id] || 'loading' : 'loading';
    useEffect(() => {
        if (activeFile) setStartedTabs(prev => prev[activeFile.id] ? prev : { ...prev, [activeFile.id]: true });
    }, [activeFile]);
    const addFile = (file: FileTabData) => {
        const next = addReaderTab(openFiles, file);
        setOpenFiles(next.files); setActiveFileIndex(next.activeIndex); setIsPickerOpen(false); setIsSearchOpen(false);
    };
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
            if (newUrl === oldUrl) {
                setOfflineFiles(prev => ({ ...prev, [newUrl]: { exists: true, readable: true, path: result.newPath } }));
                toast.success('File is available again');
                return;
            }
            let libraryFile = getLocalLibraryFiles().find(file => file.url === oldUrl);
            const currentToken = localStorage.getItem("token");
            await flushBookmarkSync(currentToken, oldUrl);
            const oldBookmark = await getBookmarkUnified(currentToken, oldUrl);
            if (!libraryFile && currentToken) {
                const result = await apiClient.getAllFiles(currentToken, `search=${encodeURIComponent(activeFile.name)}&limit=100`);
                libraryFile = result.files?.find((file: { url: string }) => normalizeFileUrl(file.url) === oldUrl);
            }
            if (libraryFile && localStorage.getItem("token")) {
                if (!libraryFile.id.startsWith("local_")) await apiClient.updateFile(localStorage.getItem("token")!, libraryFile.id, { fileUrl: newUrl, fileName: result.fileName, fileSize: result.fileSize, fileType: result.fileType });
            }
            if (libraryFile && getLocalLibraryFiles().some(file => file.url === oldUrl)) updateLocalLibraryFile(oldUrl, { url: newUrl, name: result.fileName });
            else await saveLocalFileToLibrary({ name: result.fileName, url: newUrl, size: result.fileSize, contentType: result.fileType });
            const newName = result.fileName;

            const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
            try {
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
                        id: newUrl,
                        url: newUrl,
                        name: newName,
                        type: fileType,
                    };
                }
                return file;
            });

            const restoredLocation = activeLocation || oldBookmark || {};
            setInitialLocations(prev => ({ ...prev, [newUrl]: restoredLocation }));
            setTabStates(prev => ({ ...prev, [newUrl]: restoredLocation }));
            setLoadedBookmarks(prev => ({ ...prev, [newUrl]: true }));
            setTabOptions(prev => ({...prev, [newUrl]: prev[oldUrl] || DEFAULT_READER_OPTIONS}));
            setStartedTabs(prev => ({...prev, [newUrl]: true}));
            const uniqueFiles = updatedFiles.filter((file, index, files) => files.findIndex(item => item.url === file.url) === index);
            setOpenFiles(uniqueFiles);
            setActiveFileIndex(uniqueFiles.findIndex(file => file.url === newUrl));

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
        if (openingLocal.current) return;
        openingLocal.current = true;
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
            if (!result.url) return;

            await saveLocalFileToLibrary({
                name: result.fileName,
                url: result.url,
                size: result.fileSize,
                contentType: result.fileType,
            });

            const existingIndex = openFiles.findIndex((f) => f.url === result.url);
            if (existingIndex >= 0) {
                setActiveFileIndex(existingIndex);
                setIsPickerOpen(false);
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

            addFile(newTabData);
            toast.success(`Opened "${result.fileName}" in new tab`);
        } catch (err: any) {
            toast.error(err.message || "Failed to open local file");
        } finally {
            openingLocal.current = false;
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
        setActiveFileIndex(clampActiveIndex(index, openFiles.length));
    };

    const handleTabClose = (index: number) => {
        const closedFile = openFiles[index];
        if (!closedFile) return;
        const newFiles = openFiles.filter((_, i) => i !== index);

        if (closedFile) {
            delete readerRefs.current[closedFile.id];
            setLoadedBookmarks(prev => {
                const updated = { ...prev };
                delete updated[closedFile.id];
                return updated;
            });
            setInitialLocations(prev => {
                const updated = { ...prev };
                delete updated[closedFile.id];
                return updated;
            });
            setTabStates((prev) => {
                const updated = { ...prev };
                delete updated[closedFile.id];
                return updated;
            });
        }

        const remove = <T,>(values: Record<string,T>) => { const next = {...values}; delete next[closedFile.id]; return next; };
        setStartedTabs(remove); setReaderStatuses(remove); setRetryCounts(remove); setTabOptions(remove);
        void flushBookmarkSync(localStorage.getItem('token'), closedFile.url);
        if (newFiles.length === 0) {
            setOpenFiles([]);
            clearReaderSession();
            sessionStorage.removeItem("readerFiles");
            setActiveFileIndex(0);
            const emptyUrl = createReaderUrl([]);
            appliedUrl.current = emptyUrl;
            pendingNavigation.current = null;
            window.history.replaceState(null, '', emptyUrl);
            setIsSearchOpen(false);
            return;
        }

        setOpenFiles(newFiles);

        const nextIndex = getIndexAfterTabClose(activeFileIndex, index, openFiles.length);
        setActiveFileIndex(nextIndex);
        requestAnimationFrame(() => document.getElementById(readerTabId(newFiles[nextIndex].id))?.focus());
    };

    // Polymorphic Next/Prev Page Actions
    const handleNextPage = useCallback(() => {
        if (!activeFile || activeStatus !== 'ready' || isOffline) return;
        readerRefs.current[activeFile.id]?.next();
    }, [activeFile, activeStatus, isOffline]);

    const handlePrevPage = useCallback(() => {
        if (!activeFile || activeStatus !== 'ready' || isOffline) return;
        readerRefs.current[activeFile.id]?.prev();
    }, [activeFile, activeStatus, isOffline]);

    // Keyboard navigation & search shortcut
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            const target = e.target as HTMLElement;
            if (e.defaultPrevented || isPickerOpen || target?.closest('dialog, [role="tablist"]')) return;
            if (e.key === "Escape") { setIsSearchOpen(false); return; }
            if (target?.closest("input, textarea, select, [contenteditable=true]")) return;
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "f") {
                e.preventDefault();
                if (activeStatus === 'ready' && !isOffline) setIsSearchOpen(true);
                return;
            }
            if (e.key === "ArrowRight") {
                e.preventDefault();
                handleNextPage();
            } else if (e.key === "ArrowLeft") {
                e.preventDefault();
                handlePrevPage();
            }
        };

        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [handleNextPage, handlePrevPage, isPickerOpen, activeStatus, isOffline]);

    if (!isInitialized) {
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
            onAddFile={() => setIsPickerOpen(true)}
            currentPage={activeLocation?.pageNumber}
            totalPages={activeLocation?.totalPages}
            progress={activeLocation?.progress}
            atStart={activeLocation?.atStart}
            atEnd={activeLocation?.atEnd}
            status={isOffline ? 'error' : activeStatus}
            onGoToPage={page => activeFile && readerRefs.current[activeFile.id]?.goToPage?.(page)}
            onNextPage={handleNextPage}
            onPrevPage={handlePrevPage}
            viewMode={viewMode}
            onViewModeChange={(mode: ViewMode) => updateViewOptions({ viewMode: mode })}
            fitMode={fitMode}
            onFitModeChange={(mode: FitMode) => updateViewOptions({ fitMode: mode })}
            zoom={zoom}
            onZoomIn={() => updateViewOptions({ zoom: Math.min(2, Math.round((zoom + .1) * 10) / 10) })}
            onZoomOut={() => updateViewOptions({ zoom: Math.max(.5, Math.round((zoom - .1) * 10) / 10) })}
            fontSize={fontSize}
            onFontSizeIncrease={() => updateViewOptions({ fontSize: Math.min(200, fontSize + 20) })}
            onFontSizeDecrease={() => updateViewOptions({ fontSize: Math.max(50, fontSize - 20) })}
            isSearchOpen={isSearchOpen}
            onToggleSearch={() => setIsSearchOpen((prev) => !prev)}
        >
            <div className="flex h-full min-h-0 flex-col">
            {isSearchOpen && !isOffline && activeFile && <DocumentSearch key={activeFile.id} file={activeFile} onClose={() => setIsSearchOpen(false)} onGoToPage={(page) => readerRefs.current[activeFile.id]?.goToPage?.(page)} onGoToCfi={(cfi) => readerRefs.current[activeFile.id]?.goToCfi?.(cfi)} onGoToLine={line => readerRefs.current[activeFile.id]?.goToLine?.(line)} />}
            <div className="min-h-0 flex-1">
            {openFiles.length === 0 ? <div className="flex h-full flex-col items-center justify-center gap-4 p-6 text-center"><p className="text-lg font-semibold">Your reading space is ready</p><p className="text-sm text-foreground-muted">Open a document to start a new tab.</p><button type="button" className="mfr-button-primary" onClick={() => setIsPickerOpen(true)}>Open a document</button></div> : (
                <div className="relative h-full w-full">
                {isOffline && <div className="absolute inset-0 z-30 flex h-full w-full items-center justify-center overflow-y-auto bg-background p-4 text-foreground sm:p-6">
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
                }
                {/* Multi-Tab Polymorphic Reader Container */}
                <div className="relative w-full h-full overflow-hidden">
                    {activeFile && !loadedBookmarks[activeFile.id] && <div role="status" className="flex h-full items-center justify-center text-sm text-foreground-muted">Restoring reading position…</div>}
                    {openFiles.filter(file => loadedBookmarks[file.id] && startedTabs[file.id]).map((file) => {
                        const index = openFiles.findIndex(item => item.id === file.id);
                        const isActive = index === activeFileIndex;
                        return (
                            <div
                                key={file.url}
                                role="tabpanel" id={readerPanelId(file.id)} aria-labelledby={readerTabId(file.id)} hidden={!isActive || isOffline}
                                className={`w-full h-full ${isActive && !isOffline ? "block" : "hidden"}`}
                            >
                                <ReaderRenderer
                                    key={retryCounts[file.id] || 0}
                                    onStatusChange={status => setReaderStatuses(prev => prev[file.id] === status ? prev : { ...prev, [file.id]: status })}
                                    ref={(handle) => {
                                        readerRefs.current[file.id] = handle;
                                    }}
                                    file={file}
                                    isActive={isActive && !isOffline}
                                    viewOptions={tabOptions[file.id] || DEFAULT_READER_OPTIONS}
                                    initialLocation={retryCounts[file.id] ? tabStates[file.id] : initialLocations[file.id]}
                                    onLocationChange={(loc) => handleTabLocationChange(file.id, loc)}
                                />
                            </div>
                        );
                    })}
                </div>
                </div>
            )}
            </div>
            </div>
            {activeFile && !isOffline && activeStatus === 'error' && <button type="button" className="mfr-button-secondary fixed bottom-6 left-1/2 z-20 -translate-x-1/2" onClick={() => { setReaderStatuses(prev => ({...prev, [activeFile.id]: 'loading'})); setRetryCounts(prev => ({...prev, [activeFile.id]: (prev[activeFile.id] || 0) + 1})); }}>Retry loading document</button>}
            {isPickerOpen && <ReaderFilePicker onClose={() => setIsPickerOpen(false)} onOpen={addFile} onOpenLocal={isElectron() ? handleOpenLocalFile : undefined} openUrls={openFiles.map(file => file.url)} />}
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
