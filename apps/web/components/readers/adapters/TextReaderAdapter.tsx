"use client";

import { forwardRef, useImperativeHandle, useState, useEffect, useRef, useCallback } from "react";
import { useVirtualizer } from '@tanstack/react-virtual';
import { Loader2, AlertCircle } from "lucide-react";
import { getDocumentUrl } from "@/utils/fileUrls";
import { decodeText } from '@/utils/textReader';
import { BaseReaderProps, ReaderHandle } from "../types";

const TextReaderAdapter = forwardRef<ReaderHandle, BaseReaderProps>(function TextReaderAdapter(
    { file, viewOptions, onLocationChange, initialLocation, isActive, onStatusChange }, ref
) {
    const [lines, setLines] = useState<string[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [retry, setRetry] = useState(0);
    const [width, setWidth] = useState(800);
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const statusRef = useRef(onStatusChange);
    const callbackRef = useRef(onLocationChange);
    const initialProgressRef = useRef(initialLocation?.progress || 0);
    const restoredRef = useRef(false);
    const savedOffsetRef = useRef(0);
    const frameRef = useRef(0);
    const fontSize = viewOptions.fontSize / 100 * 14;
    useEffect(() => { statusRef.current = onStatusChange; }, [onStatusChange]);
    useEffect(() => { callbackRef.current = onLocationChange; }, [onLocationChange]);

    const estimateSize = useCallback((index: number) => {
        const columns = Math.max(1, Math.floor((Math.min(width, 1024) - 64) / (fontSize * 0.61)));
        return Math.max(1, Math.ceil(lines[index].length / columns)) * fontSize * 1.625 + 4;
    }, [lines, width, fontSize]);
    const virtualizer = useVirtualizer({
        count: lines.length,
        getScrollElement: () => scrollContainerRef.current,
        estimateSize,
        overscan: 12,
        paddingStart: 24,
        paddingEnd: 24,
        enabled: !loading && !error,
    });

    useEffect(() => {
        let canceled = false;
        const controller = new AbortController();
        restoredRef.current = false;
        savedOffsetRef.current = 0;
        initialProgressRef.current = Math.min(100, Math.max(0, initialLocation?.progress || 0));
        setLoading(true);
        setError(null);
        setLines([]);
        statusRef.current?.('loading');
        const fetchContent = async () => {
            try {
                const response = await fetch(getDocumentUrl(file.url), { signal: controller.signal });
                if (!response.ok) throw new Error(`Failed to load file (${response.status})`);
                const data = await response.arrayBuffer();
                if (!canceled) setLines(decodeText(data, response.headers.get('content-type') || '').split('\n'));
            } catch (err) {
                if (!canceled) {
                    setError(err instanceof Error ? err.message : 'Failed to load text file');
                    statusRef.current?.('error');
                }
            } finally {
                if (!canceled) setLoading(false);
            }
        };
        void fetchContent();
        return () => { canceled = true; controller.abort(); };
        // Restore only when opening a new document, not on saved-progress events.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [file.url, retry]);

    const reportLocation = useCallback(() => {
        const container = scrollContainerRef.current;
        if (!container || !restoredRef.current || !isActive) return;
        const maxScroll = Math.max(0, container.scrollHeight - container.clientHeight);
        savedOffsetRef.current = container.scrollTop;
        callbackRef.current?.({
            progress: maxScroll ? Math.min(100, Math.max(0, container.scrollTop / maxScroll * 100)) : 0,
            atStart: container.scrollTop <= 1,
            atEnd: maxScroll - container.scrollTop <= 1,
        });
    }, [isActive]);

    useEffect(() => {
        const container = scrollContainerRef.current;
        if (loading || error || !container) return;
        const observer = new ResizeObserver(([entry]) => {
            if (entry.contentRect.width > 0) setWidth(entry.contentRect.width);
        });
        observer.observe(container);
        return () => observer.disconnect();
    }, [loading, error]);

    useEffect(() => {
        if (loading || error || !isActive) return;
        const container = scrollContainerRef.current;
        if (!container) return;
        // Retain the visible line through wrapping/font changes. Re-measure only
        // when the layout changes, not on every scroll/progress update.
        const anchor = virtualizer.getVirtualItems().find(item => item.end > container.scrollTop);
        const offset = anchor ? container.scrollTop - anchor.start : 0;
        virtualizer.measure();
        const frame = requestAnimationFrame(() => {
            if (!restoredRef.current) {
                const maxScroll = Math.max(0, container.scrollHeight - container.clientHeight);
                container.scrollTop = maxScroll * initialProgressRef.current / 100;
                restoredRef.current = true;
            } else if (anchor) {
                virtualizer.scrollToIndex(anchor.index, { align: 'start' });
                container.scrollTop += offset;
            } else {
                container.scrollTop = savedOffsetRef.current;
            }
            statusRef.current?.('ready');
            reportLocation();
        });
        return () => cancelAnimationFrame(frame);
    }, [loading, error, isActive, fontSize, width, virtualizer, reportLocation]);

    useEffect(() => () => cancelAnimationFrame(frameRef.current), []);

    useImperativeHandle(ref, () => ({
        next: () => {
            const container = scrollContainerRef.current;
            if (container) container.scrollBy({ top: container.clientHeight * 0.8, behavior: 'smooth' });
        },
        prev: () => {
            const container = scrollContainerRef.current;
            if (container) container.scrollBy({ top: -container.clientHeight * 0.8, behavior: 'smooth' });
        },
        goToLine: (line) => {
            if (Number.isFinite(line) && lines.length) virtualizer.scrollToIndex(Math.max(0, Math.min(lines.length - 1, Math.trunc(line) - 1)), { align: 'center' });
        },
    }), [lines.length, virtualizer]);

    if (loading) return <div role="status" className="flex h-full w-full flex-col items-center justify-center bg-background text-foreground-muted"><Loader2 className="mb-3 h-8 w-8 animate-spin" /><p className="text-sm">Loading document...</p></div>;
    if (error) return <div role="alert" className="flex h-full w-full flex-col items-center justify-center bg-background p-6 text-foreground"><AlertCircle className="mb-3 h-10 w-10" /><p className="text-sm font-medium">Failed to display file</p><p className="mt-1 text-xs text-foreground-muted">{error}</p><button type="button" className="mfr-button-secondary mt-4" onClick={() => setRetry(value => value + 1)}>Try again</button></div>;

    return (
        <div className="h-full w-full min-h-0 bg-background pb-[calc(var(--reader-controls-height,76px)+24px)] text-foreground">
            <div ref={scrollContainerRef} tabIndex={0} aria-label="Text document" onScroll={() => {
                cancelAnimationFrame(frameRef.current);
                frameRef.current = requestAnimationFrame(reportLocation);
            }} className="h-full w-full overflow-auto px-4 font-mono select-text [overflow-anchor:none] sm:px-6" style={{ fontSize }}>
                <div className="relative mx-auto w-full max-w-5xl" style={{ height: virtualizer.getTotalSize() }}>
                    {virtualizer.getVirtualItems().map(item => (
                        <div key={item.key} ref={virtualizer.measureElement} data-index={item.index} data-line-number={item.index + 1}
                            className="absolute top-0 left-0 flex w-full rounded px-2 py-0.5 leading-relaxed hover:bg-surface-hover"
                            style={{ transform: `translateY(${item.start}px)` }}>
                            <span aria-hidden="true" className="w-12 shrink-0 pr-4 text-right font-light text-foreground-muted select-none">{item.index + 1}</span>
                            <span className="min-w-0 flex-1 whitespace-pre-wrap [overflow-wrap:anywhere]">{lines[item.index] || ' '}</span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
});

export default TextReaderAdapter;
