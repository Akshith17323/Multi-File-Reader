"use client";

import { forwardRef, useImperativeHandle, useState, useEffect, useRef } from "react";
import { Loader2, AlertCircle } from "lucide-react";
import { BaseReaderProps, ReaderHandle } from "../types";

const TextReaderAdapter = forwardRef<ReaderHandle, BaseReaderProps>(function TextReaderAdapter(
    { file, viewOptions, onLocationChange },
    ref
) {
    const [content, setContent] = useState<string>("");
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);
    const scrollContainerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        let isMounted = true;
        const fetchContent = async () => {
            setLoading(true);
            setError(null);
            try {
                const proxyUrl = `${process.env.NEXT_PUBLIC_BACKEND_URL}/proxy?url=${encodeURIComponent(file.url)}`;
                const res = await fetch(proxyUrl);
                if (!res.ok) {
                    throw new Error(`Failed to load file (${res.status} ${res.statusText})`);
                }
                const text = await res.text();
                if (isMounted) {
                    setContent(text);
                }
            } catch (err: unknown) {
                if (isMounted) {
                    setError(err instanceof Error ? err.message : "Failed to load text file");
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
        };
    }, [file.url]);

    // Handle scroll progress
    const handleScroll = () => {
        const container = scrollContainerRef.current;
        if (!container) return;
        const { scrollTop, scrollHeight, clientHeight } = container;
        const maxScroll = scrollHeight - clientHeight;
        const progress = maxScroll > 0 ? Math.round((scrollTop / maxScroll) * 100) : 0;
        onLocationChange?.({ progress });
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
    }));

    if (loading) {
        return (
            <div className="w-full h-full flex flex-col items-center justify-center bg-[#0d0e12] text-[#a2a2a2]">
                <Loader2 className="w-8 h-8 animate-spin text-blue-500 mb-3" />
                <p className="text-sm">Loading document...</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="w-full h-full flex flex-col items-center justify-center bg-[#0d0e12] text-red-400 p-6">
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
            className="w-full h-full overflow-y-auto bg-[#0d0e12] text-[#e0e0e0] font-mono p-6 select-text"
            style={{ fontSize: `${(viewOptions.fontSize / 100) * 14}px` }}
        >
            <div className="max-w-5xl mx-auto space-y-0.5">
                {lines.map((line, idx) => (
                    <div key={idx} className="flex hover:bg-white/5 px-2 py-0.5 rounded transition-colors">
                        <span className="w-12 text-right pr-4 text-[#525252] select-none font-light text-xs leading-relaxed">
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
