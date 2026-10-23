"use client";

import { useEffect, useRef, useState, forwardRef, useImperativeHandle } from "react";
import { type Book, Rendition, EpubCFI } from "epubjs";
import { Loader2, AlertCircle } from "lucide-react";
import { getDocumentUrl } from "@/utils/fileUrls";
import { createReaderBook, displayEpub, epubProgress } from "@/utils/epubReader";
import type { ReaderStatus, ViewMode } from './readers/types';

export interface EPUBRendererRef {
    next: () => Promise<unknown> | undefined;
    prev: () => Promise<unknown> | undefined;
    display: (cfi: string) => Promise<unknown> | undefined;
}

interface EPUBRendererProps {
    url: string;
    onLocationChange: (cfi: string, progress?: number, atStart?: boolean, atEnd?: boolean) => void;
    onStatusChange?: (status: ReaderStatus) => void;
    viewMode: ViewMode;
    fontSize: number;
    initialCfi?: string;
    isActive?: boolean;
}

function applyReaderTheme(rendition: Rendition) {
    const styles = getComputedStyle(document.documentElement);
    const foreground = styles.getPropertyValue("--foreground").trim();
    rendition.themes.register("app", {
        body: { background: "transparent", color: foreground },
        a: { color: styles.getPropertyValue("--primary").trim() },
        p: { color: foreground }, h1: { color: foreground }, h2: { color: foreground }, h3: { color: foreground },
    });
    rendition.themes.select("app");
}

// EPUB.js supports a restore CFI on resize; its published declaration omits it.
function resizeRendition(rendition: Rendition, width: number, height: number, cfi: string) {
    (rendition as Rendition & { resize: (width: number, height: number, cfi?: string) => void }).resize(width, height, cfi || undefined);
}

const EPUBRenderer = forwardRef<EPUBRendererRef, EPUBRendererProps>(function EPUBRenderer(
    { url, onLocationChange, onStatusChange, viewMode, fontSize, initialCfi, isActive = true }, ref
) {
    const viewerRef = useRef<HTMLDivElement>(null);
    const renditionRef = useRef<Rendition | null>(null);
    const locationRef = useRef(initialCfi || "");
    const callbackRef = useRef(onLocationChange);
    const fontSizeRef = useRef(fontSize);
    const statusRef = useRef(onStatusChange);
    const activeRef = useRef(isActive);
    const refreshRef = useRef<() => void>(() => {});
    const [loadedBook, setLoadedBook] = useState<{ url: string; book: Book } | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [retry, setRetry] = useState(0);
    useEffect(() => { callbackRef.current = onLocationChange; }, [onLocationChange]);
    useEffect(() => { statusRef.current = onStatusChange; }, [onStatusChange]);
    useEffect(() => {
        fontSizeRef.current = fontSize;
        renditionRef.current?.themes.fontSize(`${fontSize}%`);
        refreshRef.current();
    }, [fontSize]);
    useEffect(() => { activeRef.current = isActive; if (isActive) refreshRef.current(); }, [isActive]);

    useImperativeHandle(ref, () => ({
        next: () => renditionRef.current?.next(),
        prev: () => renditionRef.current?.prev(),
        display: async (cfi) => {
            const rendition = renditionRef.current;
            if (!rendition) return;
            const target = new EpubCFI(cfi);
            target.collapse(true);
            await displayEpub(rendition, target.toString());
        },
    }));

    // Fetch/unzip once per document. Layout changes only replace the rendition.
    useEffect(() => {
        let canceled = false;
        let settled = false;
        const controller = new AbortController();
        const book = createReaderBook();
        locationRef.current = initialCfi || "";
        setLoadedBook(null);
        setLoading(true);
        setError(null);
        statusRef.current?.('loading');
        const initialize = async () => {
            try {
                const response = await fetch(getDocumentUrl(url), { signal: controller.signal });
                if (!response.ok) throw new Error(`Could not load book (${response.status})`);
                const data = await response.arrayBuffer();
                if (canceled) return;
                await book.open(data, "binary");
                // open() only reads the package; opened also waits for assets.
                await book.opened;
                if (!canceled) setLoadedBook({ url, book });
            } catch (err) {
                if (!canceled) {
                    setError(err instanceof Error ? err.message : "Could not load book");
                    setLoading(false);
                    statusRef.current?.('error');
                }
            } finally {
                settled = true;
                if (canceled) book.destroy();
            }
        };
        void initialize();
        return () => {
            canceled = true;
            controller.abort();
            // Let any pending unzip/resource work finish before releasing it.
            // The rendering effect owns its rendition and destroys it once.
            Object.assign(book, { rendition: undefined });
            if (settled) book.destroy();
        };
        // Saved progress is only consumed when opening a document.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [url, retry]);

    useEffect(() => {
        const viewer = viewerRef.current;
        if (!viewer || !loadedBook || loadedBook.url !== url) return;
        const { book } = loadedBook;
        let canceled = false;
        let ready = false;
        let rendition: Rendition | undefined;
        let resizeTimer: ReturnType<typeof setTimeout> | undefined;
        let lastWidth = 0;
        let lastHeight = 0;
        const continuous = viewMode === 'continuous' || viewMode === 'two-page-continuous';
        setLoading(true);
        setError(null);
        statusRef.current?.('loading');

        const fail = (err: unknown) => {
            if (canceled) return;
            ready = false;
            setError(err instanceof Error ? err.message : 'Could not display this chapter');
            setLoading(false);
            statusRef.current?.('error');
        };
        const reportLocation = () => {
            const location = rendition?.location;
            if (canceled || !ready || !activeRef.current || !location?.start?.cfi) return;
            locationRef.current = location.start.cfi;
            callbackRef.current(location.start.cfi, epubProgress(book, location), location.atStart, location.atEnd);
        };
        const refresh = () => {
            if (canceled || !activeRef.current) return;
            const { width, height } = viewer.getBoundingClientRect();
            if (width <= 0 || height <= 0) return;
            if (!rendition) {
                lastWidth = width;
                lastHeight = height;
                rendition = new Rendition(book, {
                    width, height,
                    flow: continuous ? "scrolled-continuous" : "paginated",
                    manager: continuous ? "continuous" : "default",
                    spread: viewMode.startsWith('two-page') ? "always" : "none",
                    minSpreadWidth: 0,
                    allowScriptedContent: false,
                });
                renditionRef.current = rendition;
                rendition.attachTo(viewer);
                rendition.on('displayError', fail);
                rendition.on('relocated', reportLocation);
                rendition.on('keydown', (event: KeyboardEvent) => {
                    const target = event.target as HTMLElement;
                    if (event.defaultPrevented || target?.closest('input, textarea, select, [contenteditable=true]')) return;
                    if (event.key === 'ArrowRight') { event.preventDefault(); void rendition?.next().catch(fail); }
                    else if (event.key === 'ArrowLeft') { event.preventDefault(); void rendition?.prev().catch(fail); }
                    else if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'f') {
                        event.preventDefault(); window.dispatchEvent(new KeyboardEvent('keydown', { key: 'f', ctrlKey: event.ctrlKey, metaKey: event.metaKey }));
                    }
                });
                let touch: { x: number; y: number } | null = null;
                rendition.on('touchstart', (event: TouchEvent) => {
                    const point = event.changedTouches[0];
                    touch = point ? { x: point.clientX, y: point.clientY } : null;
                });
                rendition.on('touchend', (event: TouchEvent) => {
                    const start = touch;
                    touch = null;
                    const point = event.changedTouches[0];
                    if (!start || !point || continuous) return;
                    const distance = start.x - point.clientX;
                    if (Math.abs(distance) <= 50 || Math.abs(distance) <= Math.abs(start.y - point.clientY)) return;
                    if (distance > 0) void rendition?.next().catch(fail);
                    else void rendition?.prev().catch(fail);
                });
                applyReaderTheme(rendition);
                rendition.themes.fontSize(`${fontSizeRef.current}%`);
                let target: string | undefined;
                try {
                    if (locationRef.current && book.spine.get(locationRef.current)) {
                        const cfi = new EpubCFI(locationRef.current);
                        cfi.collapse(true);
                        target = cfi.toString();
                    }
                } catch { /* An obsolete bookmark should open at the beginning. */ }
                void displayEpub(rendition, target).then(() => {
                    if (canceled) return;
                    ready = true;
                    setLoading(false);
                    statusRef.current?.('ready');
                    reportLocation();
                }, fail);
            } else if (ready) {
                // Ignore hidden tabs and debounce sidebar drags to avoid queuing
                // overlapping displays while EPUB.js recalculates columns.
                if (width !== lastWidth || height !== lastHeight) {
                    lastWidth = width;
                    lastHeight = height;
                    resizeRendition(rendition, width, height, locationRef.current);
                }
                reportLocation();
            }
        };
        const scheduleRefresh = () => {
            clearTimeout(resizeTimer);
            resizeTimer = setTimeout(refresh, 100);
        };
        refreshRef.current = scheduleRefresh;
        const resizeObserver = new ResizeObserver(scheduleRefresh);
        resizeObserver.observe(viewer);
        const themeObserver = new MutationObserver(() => { if (rendition) applyReaderTheme(rendition); });
        themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
        refresh();
        return () => {
            canceled = true;
            clearTimeout(resizeTimer);
            refreshRef.current = () => {};
            resizeObserver.disconnect();
            themeObserver.disconnect();
            renditionRef.current = null;
            rendition?.q.stop();
            rendition?.destroy();
        };
    }, [loadedBook, url, viewMode]);

    return (
        <div className="relative h-full w-full min-h-0 overflow-hidden pb-[calc(var(--reader-controls-height,76px)+24px)]">
            <div ref={viewerRef} aria-label="EPUB pages" className="h-full w-full overflow-hidden bg-background/60 text-foreground" />
            {(loading || error) && <div className="absolute inset-0 z-20 flex items-center justify-center bg-background/90 p-6">
                {error ? <div role="alert" className="text-center text-foreground"><AlertCircle className="mx-auto mb-3" /><p>{error}</p><button type="button" className="mfr-button-secondary mt-4" onClick={() => setRetry(value => value + 1)}>Try again</button></div> : <div role="status" className="flex items-center gap-3 text-foreground-muted"><Loader2 className="animate-spin text-primary" />Loading book...</div>}
            </div>}
        </div>
    );
});

export default EPUBRenderer;
