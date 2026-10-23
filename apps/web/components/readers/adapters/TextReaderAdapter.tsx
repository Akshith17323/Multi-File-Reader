"use client";

import { forwardRef, useImperativeHandle, useState, useEffect, useRef } from "react";
import { Loader2, AlertCircle } from "lucide-react";
import { getDocumentUrl } from "@/utils/fileUrls";
import { BaseReaderProps, ReaderHandle } from "../types";

const TextReaderAdapter = forwardRef<ReaderHandle, BaseReaderProps>(function TextReaderAdapter(
    { file, viewOptions, onLocationChange, initialLocation, isActive, onStatusChange },
    ref
) {
    const [content, setContent] = useState<string>("");
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const statusRef = useRef(onStatusChange);
    useEffect(() => { statusRef.current = onStatusChange; }, [onStatusChange]);

    useEffect(() => {
        let isMounted = true;
        const controller = new AbortController();
        const fetchContent = async () => {
            setLoading(true);
            setError(null);
            statusRef.current?.('loading');
            try {
                const proxyUrl = getDocumentUrl(file.url);
                const res = await fetch(proxyUrl, { signal: controller.signal });
                if (!res.ok) {
                    throw new Error(`Failed to load file (${res.status} ${res.statusText})`);
                }
                const text = await res.text();
                if (isMounted) {
                    setContent(text);
                    statusRef.current?.('ready');
                }
            } catch (err: unknown) {
                if (isMounted) {
                    setError(err instanceof Error ? err.message : "Failed to load text file");
                    statusRef.current?.('error');
                }
            } finally {
                if (isMounted) {
                    setLoading(false);
                }
            }
        };

        fetchContent();
        return () => {
            isMounted = false;
            controller.abort();
        };
    }, [file.url]);

    const hasRestoredScroll = useRef(false);
    useEffect(() => {
        if (loading || !isActive || hasRestoredScroll.current || !scrollContainerRef.current) return;
        const container = scrollContainerRef.current;
        container.scrollTop = Math.max(0, container.scrollHeight - container.clientHeight) * ((initialLocation?.progress || 0) / 100);
        hasRestoredScroll.current = true;
        onLocationChange?.({ progress: initialLocation?.progress || 0, atStart: container.scrollTop <= 1, atEnd: container.scrollHeight - container.clientHeight - container.scrollTop <= 1 });
        // Initial position is reported once after restoring, without resetting it on progress events.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [loading, isActive, initialLocation?.progress]);

    // Handle scroll progress
    const handleScroll = () => {
        const container = scrollContainerRef.current;
        if (!container || !hasRestoredScroll.current || !isActive) return;
        const { scrollTop, scrollHeight, clientHeight } = container;
        const maxScroll = scrollHeight - clientHeight;
        const progress = maxScroll > 0 ? Math.round((scrollTop / maxScroll) * 100) : 0;
        onLocationChange?.({ progress, atStart: scrollTop <= 1, atEnd: maxScroll - scrollTop <= 1 });
    };

    // Expose unified ReaderHandle to parent multi-tab controller
    useImperativeHandle(ref, () => ({
        next: () => {
            const container = scrollContainerRef.current;
            if (container) {
                container.scrollBy({ top: container.clientHeight * 0.8, behavior: "smooth" });
            }
        },
        prev: () => {
            const container = scrollContainerRef.current;
            if (container) {
                container.scrollBy({ top: -container.clientHeight * 0.8, behavior: "smooth" });
            }
        },
        goToLine: (line) => {
            scrollContainerRef.current?.querySelector<HTMLElement>(`[data-line-number="${Math.max(1, Math.trunc(line))}"]`)?.scrollIntoView({ block: "center", behavior: "smooth" });
        },
    }));

    if (loading) {
        return (
            <div role="status" className="w-full h-full flex flex-col items-center justify-center bg-background text-foreground-muted">
                <Loader2 className="w-8 h-8 animate-spin text-blue-500 mb-3" />
                <p className="text-sm">Loading document...</p>
            </div>
        );
    }

    if (error) {
        return (
            <div role="alert" className="w-full h-full flex flex-col items-center justify-center bg-background text-red-500 p-6">
                <AlertCircle className="w-10 h-10 mb-3" />
                <p className="text-sm font-medium mb-1">Failed to display file</p>
                <p className="text-xs text-[#737373]">{error}</p>
            </div>
        );
    }

    const lines = content.split("\n");

    return (
        <div
            ref={scrollContainerRef}
            onScroll={handleScroll}
            className="w-full h-full overflow-y-auto bg-background text-foreground font-mono p-6 select-text"
            style={{ fontSize: `${(viewOptions.fontSize / 100) * 14}px` }}
        >
            <div className="max-w-5xl mx-auto space-y-0.5">
                {lines.map((line, idx) => (
                    <div key={idx} data-line-number={idx + 1} className="flex hover:bg-surface-hover px-2 py-0.5 rounded transition-colors">
                        <span className="w-12 shrink-0 text-right pr-4 text-foreground-muted select-none font-light text-xs leading-relaxed">
                            {idx + 1}
                        </span>
                        <span className="flex-1 whitespace-pre-wrap break-words leading-relaxed">
                            {line || " "}
                        </span>
                    </div>
                ))}
            </div>
        </div>
    );
});

export default TextReaderAdapter;
