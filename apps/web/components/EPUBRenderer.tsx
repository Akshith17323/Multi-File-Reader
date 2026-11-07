"use client";

import { useEffect, useRef, useState, forwardRef, useImperativeHandle } from "react";
import { type Book, type Contents, Rendition, EpubCFI } from "epubjs";
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

function updateContentTheme(contents: Contents) {
    const dark = document.documentElement.classList.contains('dark');
    const root = contents.document.documentElement;
    root.style.setProperty('--epub-background', dark ? '#000000' : '#ffffff');
    root.style.setProperty('--epub-foreground', dark ? '#ffffff' : '#000000');
    root.style.colorScheme = dark ? 'dark' : 'light';
}

function applyReaderTheme(rendition: Rendition) {
    // Published typings describe one Contents, but EPUB.js returns an array.
    (rendition.getContents() as unknown as Contents[]).forEach(updateContentTheme);
}

function initializeReaderTheme(rendition: Rendition) {
    rendition.themes.register('app', {
        body: { background: 'var(--epub-background) !important', color: 'var(--epub-foreground) !important' },
        'p, h1, h2, h3, h4, h5, h6, a': { color: 'var(--epub-foreground) !important' },
    });
    rendition.themes.select('app');
    rendition.hooks.content.register(updateContentTheme);
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
    const openedUrlRef = useRef<string | null>(null);
    const callbackRef = useRef(onLocationChange);
    const optionsRef = useRef({ fontSize, viewMode });
    const statusRef = useRef(onStatusChange);
    const activeRef = useRef(isActive);
    const refreshRef = useRef<() => void>(() => {});
    const reportErrorRef = useRef<(error: unknown) => void>(() => {});
    const [loadedBook, setLoadedBook] = useState<{ url: string; book: Book } | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [retry, setRetry] = useState(0);
    useEffect(() => { callbackRef.current = onLocationChange; }, [onLocationChange]);
    useEffect(() => { statusRef.current = onStatusChange; }, [onStatusChange]);
    useEffect(() => {
        optionsRef.current = { fontSize, viewMode };
        refreshRef.current();
    }, [fontSize, viewMode]);
    useEffect(() => { activeRef.current = isActive; if (isActive) refreshRef.current(); }, [isActive]);

    useImperativeHandle(ref, () => ({
        next: () => renditionRef.current?.next().catch(error => { reportErrorRef.current(error); throw error; }),
        prev: () => renditionRef.current?.prev().catch(error => { reportErrorRef.current(error); throw error; }),
        display: async (cfi) => {
            const rendition = renditionRef.current;
            if (!rendition) return;
            const target = new EpubCFI(cfi);
            target.collapse(true);
            try { await displayEpub(rendition, target.toString()); }
            catch (error) { reportErrorRef.current(error); throw error; }
        },
    }));

    // Fetch/unzip once per document. Page layouts reuse the loaded views.
    useEffect(() => {
        let canceled = false;
        let settled = false;
        const controller = new AbortController();
        const book = createReaderBook();
        if (openedUrlRef.current !== url) locationRef.current = initialCfi || "";
        openedUrlRef.current = url;
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
                // open() reads the package; opened completes reader setup.
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
            if (settled) book.destroy();
        };
        // Saved progress is only consumed when opening a document.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [url, retry]);

    useEffect(() => {
        const viewer = viewerRef.current;
        if (!viewer || !loadedBook || loadedBook.url !== url) return;
        const { book } = loadedBook;
        const contentHooks = book.spine.hooks.content;
        type Entry = {
            rendition: Rendition; host: HTMLDivElement;
            hooks: ReturnType<typeof contentHooks.list>;
            ready: boolean; spread: string; fontSize: number; width: number; height: number;
        };
        const entries = new Map<string, Entry>();
        let current: Entry | undefined;
        let canceled = false;
        let updating = false;
        let requested = 0;
        let resizeTimer: ReturnType<typeof setTimeout> | undefined;
        let dark = document.documentElement.classList.contains('dark');
        setLoading(true);
        setError(null);
        statusRef.current?.('loading');

        const fail = (err: unknown) => {
            if (canceled) return;
            setError(err instanceof Error ? err.message : 'Could not display this chapter');
            setLoading(false);
            statusRef.current?.('error');
        };
        reportErrorRef.current = fail;
        const reportLocation = () => {
            const location = current?.rendition.location;
            if (canceled || updating || !activeRef.current || !location?.start?.cfi) return;
            locationRef.current = location.start.cfi;
            callbackRef.current(location.start.cfi, epubProgress(book, location), location.atStart, location.atEnd);
        };
        const createEntry = (continuous: boolean, width: number, height: number): Entry => {
            const host = document.createElement('div');
            Object.assign(host.style, { position: 'absolute', inset: '0', visibility: 'hidden', pointerEvents: 'none' });
            host.inert = true;
            host.setAttribute('aria-hidden', 'true');
            viewer.appendChild(host);
            const previousHooks = new Set(contentHooks.list());
            const rendition = new Rendition(book, {
                width, height,
                flow: continuous ? 'scrolled-continuous' : 'paginated',
                manager: continuous ? 'continuous' : 'default',
                spread: 'none', minSpreadWidth: 0, allowScriptedContent: false,
            });
            const entry: Entry = {
                rendition, host, hooks: contentHooks.list().filter(hook => !previousHooks.has(hook)),
                ready: false, spread: '', fontSize: 0, width, height,
            };
            void rendition.attachTo(host).catch(fail);
            initializeReaderTheme(rendition);
            rendition.on('displayError', (err: unknown) => { if (current === entry || !current) fail(err); });
            rendition.on('relocated', () => { if (current === entry) reportLocation(); });
            rendition.on('keydown', (event: KeyboardEvent) => {
                const target = event.target as HTMLElement;
                if (current !== entry || event.defaultPrevented || target?.closest('input, textarea, select, [contenteditable=true]')) return;
                if (event.key === 'ArrowRight') { event.preventDefault(); void rendition.next().catch(fail); }
                else if (event.key === 'ArrowLeft') { event.preventDefault(); void rendition.prev().catch(fail); }
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
                if (!start || !point || continuous || current !== entry) return;
                const distance = start.x - point.clientX;
                if (Math.abs(distance) <= 50 || Math.abs(distance) <= Math.abs(start.y - point.clientY)) return;
                if (distance > 0) void rendition.next().catch(fail);
                else void rendition.prev().catch(fail);
            });
            return entry;
        };

        const update = async () => {
            if (canceled || updating || !activeRef.current) return;
            updating = true;
            let applied = -1;
            try {
                while (!canceled && applied !== requested) {
                    applied = requested;
                    const { width, height } = viewer.getBoundingClientRect();
                    if (!width || !height) break;
                    const { viewMode: mode, fontSize: size } = optionsRef.current;
                    const continuous = mode === 'continuous' || mode === 'two-page-continuous';
                    const key = continuous ? 'continuous' : 'paginated';
                    let entry = entries.get(key);
                    if (!entry) { entry = createEntry(continuous, width, height); entries.set(key, entry); }
                    await entry.rendition.started;
                    if (canceled) return;
                    const spread = mode.startsWith('two-page') ? 'always' : 'none';
                    const changed = !entry.ready || current !== entry || entry.spread !== spread || entry.fontSize !== size || entry.width !== width || entry.height !== height;
                    if (changed) {
                        // Single/two-page layouts reflow the existing iframe.
                        // Scroll mode has its own cached view, prepared while
                        // the previous view remains visible.
                        if (entry.spread !== spread) entry.rendition.spread(spread, 0);
                        if (entry.fontSize !== size) entry.rendition.themes.fontSize(`${size}%`);
                        if (entry.width !== width || entry.height !== height) resizeRendition(entry.rendition, width, height, locationRef.current);
                        let target: string | undefined;
                        try {
                            if (locationRef.current && book.spine.get(locationRef.current)) {
                                const cfi = new EpubCFI(locationRef.current);
                                cfi.collapse(true);
                                target = cfi.toString();
                            }
                        } catch { /* An obsolete bookmark should open at the beginning. */ }
                        await displayEpub(entry.rendition, target);
                        if (canceled) return;
                        entry.ready = true;
                        entry.spread = spread; entry.fontSize = size; entry.width = width; entry.height = height;
                        await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
                    }
                    if (canceled || applied !== requested) continue;
                    entries.forEach(candidate => {
                        const visible = candidate === entry;
                        candidate.host.style.visibility = visible ? 'visible' : 'hidden';
                        candidate.host.style.pointerEvents = visible ? 'auto' : 'none';
                        candidate.host.inert = !visible;
                        candidate.host.setAttribute('aria-hidden', String(!visible));
                    });
                    current = entry;
                    renditionRef.current = entry.rendition;
                    setLoading(false);
                    setError(null);
                    statusRef.current?.('ready');
                }
            } catch (err) { fail(err); }
            finally { updating = false; reportLocation(); }
        };
        const refresh = () => { requested++; void update(); };
        refreshRef.current = refresh;
        const resizeObserver = new ResizeObserver(() => {
            clearTimeout(resizeTimer);
            resizeTimer = setTimeout(refresh, 100);
        });
        resizeObserver.observe(viewer);
        const themeObserver = new MutationObserver(() => {
            const nextDark = document.documentElement.classList.contains('dark');
            if (nextDark === dark) return;
            dark = nextDark;
            entries.forEach(entry => applyReaderTheme(entry.rendition));
        });
        themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
        refresh();
        return () => {
            canceled = true;
            clearTimeout(resizeTimer);
            refreshRef.current = () => {};
            reportErrorRef.current = () => {};
            resizeObserver.disconnect();
            themeObserver.disconnect();
            renditionRef.current = null;
            entries.forEach(entry => {
                entry.hooks.forEach(hook => contentHooks.deregister(hook));
                entry.rendition.q.stop();
                entry.rendition.destroy();
                entry.host.remove();
            });
        };
    }, [loadedBook, url]);

    return (
        <div className="relative h-full w-full min-h-0 overflow-hidden pb-[calc(var(--reader-controls-height,76px)+24px)]">
            <div ref={viewerRef} aria-label="EPUB pages" className="relative h-full w-full overflow-hidden bg-background/60 text-foreground" />
            {(loading || error) && <div className="absolute inset-0 z-20 flex items-center justify-center bg-background/90 p-6">
                {error ? <div role="alert" className="text-center text-foreground"><AlertCircle className="mx-auto mb-3" /><p>{error}</p><button type="button" className="mfr-button-secondary mt-4" onClick={() => setRetry(value => value + 1)}>Try again</button></div> : <div role="status" className="flex items-center gap-3 text-foreground-muted"><Loader2 className="animate-spin text-primary" />Loading book...</div>}
            </div>}
        </div>
    );
});

export default EPUBRenderer;
