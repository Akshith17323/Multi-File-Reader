"use client";

import { useEffect, useRef, useState, forwardRef, useImperativeHandle } from "react";
import ePub, { Rendition, EpubCFI } from "epubjs";
import { Loader2, AlertCircle } from "lucide-react";
import { getDocumentUrl } from "@/utils/fileUrls";
import type { ReaderStatus } from './readers/types';

export interface EPUBRendererRef {
    next: () => Promise<unknown> | undefined;
    prev: () => Promise<unknown> | undefined;
    display: (cfi: string) => Promise<unknown> | undefined;
}

interface EPUBRendererProps {
    url: string;
    onLocationChange: (cfi: string, progress?: number, atStart?: boolean, atEnd?: boolean) => void;
    onStatusChange?: (status: ReaderStatus) => void;
    viewMode: "single" | "continuous" | "two-page";
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
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    useEffect(() => { callbackRef.current = onLocationChange; }, [onLocationChange]);
    useEffect(() => { statusRef.current = onStatusChange; }, [onStatusChange]);
    useEffect(() => { fontSizeRef.current = fontSize; renditionRef.current?.themes.fontSize(`${fontSize}%`); }, [fontSize]);

    useImperativeHandle(ref, () => ({
        next: () => renditionRef.current?.next(),
        prev: () => renditionRef.current?.prev(),
        display: (cfi) => {
            const target = new EpubCFI(cfi);
            target.collapse(true);
            locationRef.current = target.toString();
            return renditionRef.current?.display(locationRef.current);
        },
    }));

    useEffect(() => {
        if (!viewerRef.current) return;
        let canceled = false;
        const controller = new AbortController();
        const book = ePub();
        let rendition: Rendition | undefined;
        let readyToReport = false;
        setLoading(true);
        setError(null);
        statusRef.current?.('loading');
        const reportLocation = () => {
            const location = rendition?.location?.start?.cfi;
            if (canceled || !readyToReport || !location) return;
            locationRef.current = location;
            const percentage = book.locations.length() ? book.locations.percentageFromCfi(location) : undefined;
            callbackRef.current(location, percentage !== undefined && Number.isFinite(percentage) ? Math.min(100, Math.max(0, percentage * 100)) : undefined, rendition?.location?.atStart, rendition?.location?.atEnd);
        };
        const initialize = async () => {
            try {
                const response = await fetch(getDocumentUrl(url), { signal: controller.signal });
                if (!response.ok) throw new Error(`Could not load book (${response.status})`);
                const data = await response.arrayBuffer();
                if (canceled) return;
                await book.open(data, "binary");
                if (canceled || !viewerRef.current) return;
                rendition = book.renderTo(viewerRef.current, {
                    width: "100%", height: "100%",
                    flow: viewMode === "continuous" ? "scrolled-doc" : "paginated",
                    manager: viewMode === "continuous" ? "continuous" : "default",
                    spread: viewMode === "two-page" ? "always" : "none",
                });
                renditionRef.current = rendition;
                rendition.on('keydown', (event: KeyboardEvent) => {
                    const target = event.target as HTMLElement;
                    if (event.defaultPrevented || target?.closest('input, textarea, select, [contenteditable=true]')) return;
                    if (event.key === 'ArrowRight') { event.preventDefault(); void rendition?.next()?.catch(() => {}); }
                    else if (event.key === 'ArrowLeft') { event.preventDefault(); void rendition?.prev()?.catch(() => {}); }
                    else if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'f') {
                        event.preventDefault(); window.dispatchEvent(new KeyboardEvent('keydown', { key: 'f', ctrlKey: event.ctrlKey, metaKey: event.metaKey }));
                    }
                });
                applyReaderTheme(rendition);
                rendition.themes.fontSize(`${fontSizeRef.current}%`);
                rendition.on("relocated", reportLocation);
                let touchX: number | null = null;
                rendition.on("touchstart", (event: TouchEvent) => { touchX = event.changedTouches[0].clientX; });
                rendition.on("touchend", (event: TouchEvent) => {
                    if (touchX === null || viewMode === "continuous") return;
                    const distance = touchX - event.changedTouches[0].clientX;
                    if (distance > 50) void rendition?.next()?.catch(() => {});
                    else if (distance < -50) void rendition?.prev()?.catch(() => {});
                    touchX = null;
                });
                try { await rendition.display(locationRef.current || initialCfi || undefined); }
                catch { await rendition.display(); }
                if (canceled) return;
                readyToReport = true;
                setLoading(false);
                statusRef.current?.('ready');
                reportLocation();
                try { await book.locations.generate(1000); reportLocation(); }
                catch { /* The CFI remains sufficient to save position. */ }
            } catch (err) {
                if (!canceled) { setError(err instanceof Error ? err.message : "Could not load book"); setLoading(false); statusRef.current?.('error'); }
            }
        };
        void initialize();
        const themeObserver = new MutationObserver(() => { if (rendition) applyReaderTheme(rendition); });
        themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
        let lastWidth = 0;
        let lastHeight = 0;
        const resizeObserver = new ResizeObserver(entries => {
            const { width, height } = entries[0].contentRect;
            if (rendition && width > 0 && height > 0 && (width !== lastWidth || height !== lastHeight)) {
                lastWidth = width; lastHeight = height;
                resizeRendition(rendition, width, height, locationRef.current);
            }
        });
        resizeObserver.observe(viewerRef.current);
        return () => {
            canceled = true;
            controller.abort();
            themeObserver.disconnect();
            resizeObserver.disconnect();
            renditionRef.current = null;
            try { rendition?.destroy(); book.destroy(); } catch { /* Already destroyed during a failed load. */ }
        };
        // Callbacks and font size use refs so reading progress never rebuilds the book.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [url, viewMode]);

    useEffect(() => {
        if (isActive && viewerRef.current && renditionRef.current) {
            const { width, height } = viewerRef.current.getBoundingClientRect();
            if (width && height) resizeRendition(renditionRef.current, width, height, locationRef.current);
        }
    }, [isActive]);

    return (
        <div className="relative h-full w-full">
            <div ref={viewerRef} className="h-full w-full bg-background/60 text-foreground" />
            {(loading || error) && <div className="absolute inset-0 z-20 flex items-center justify-center bg-background/90 p-6">
                {error ? <div role="alert" className="text-center text-red-500"><AlertCircle className="mx-auto mb-3" /><p>{error}</p></div> : <div className="flex items-center gap-3 text-foreground-muted"><Loader2 className="animate-spin text-primary" />Loading book...</div>}
            </div>}
        </div>
    );
});

export default EPUBRenderer;
