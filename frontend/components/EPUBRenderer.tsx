"use client";

import { useEffect, useRef, useState, forwardRef, useImperativeHandle } from "react";
import ePub, { Book, Rendition } from "epubjs";
import { Loader2, AlertCircle } from "lucide-react";

export interface EPUBRendererRef {
    next: () => void;
    prev: () => void;
}

interface EPUBRendererProps {
    url: string;
    onLocationChange: (cfi: string) => void;
    onProgressChange?: (percentage: number) => void;
    viewMode: "single" | "continuous" | "two-page";
    fontSize: number;
}

const EPUBRenderer = forwardRef<EPUBRendererRef, EPUBRendererProps>(({
    url,
    onLocationChange,
    onProgressChange,
    viewMode,
    fontSize,
}, ref) => {
    const viewerRef = useRef<HTMLDivElement | null>(null);
    const renditionRef = useRef<Rendition | null>(null);
    const bookRef = useRef<Book | null>(null);

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [currentLocation, setCurrentLocation] = useState<string>("");
    const [isBookReady, setIsBookReady] = useState(false);

    const touchStartRef = useRef<number | null>(null);

    useImperativeHandle(ref, () => ({
        next: () => {
            if (renditionRef.current) renditionRef.current.next();
        },
        prev: () => {
            if (renditionRef.current) renditionRef.current.prev();
        }
    }));

    // Initialize Book
    useEffect(() => {
        if (!url || !viewerRef.current) return;

        let cancelled = false;

        const initBook = async () => {
            try {
                setLoading(true);
                setError(null);

                const proxiedUrl = `${process.env.NEXT_PUBLIC_BACKEND_URL}/proxy?url=${encodeURIComponent(url)}`;
                const book = ePub(proxiedUrl);
                bookRef.current = book;
                setIsBookReady(true);

                await book.ready;
                if (!cancelled && book.locations.length() === 0) {
                    await book.locations.generate(1000);
                }
            } catch (err: unknown) {
                console.error("❌ Error initializing EPUB:", err);
                if (!cancelled) {
                    setError((err as Error).message || "Failed to load EPUB.");
                    setLoading(false);
                }
            }
        };

        initBook();

        return () => {
            cancelled = true;
            setIsBookReady(false);
            try {
                renditionRef.current?.destroy();
                bookRef.current?.destroy();
            } catch { }
        };
    }, [url]);

    // Re-render when viewMode changes or book is ready
    useEffect(() => {
        if (!isBookReady || !bookRef.current || !viewerRef.current) return;

        const reRender = async () => {
            setLoading(true);
            try {
                const currentLoc = renditionRef.current?.location?.start?.cfi || currentLocation;

                if (renditionRef.current) {
                    renditionRef.current.destroy();
                }

                const width = "100%";
                const height = "100%";

                let flow = "paginated";
                let manager = "default";
                let spread = "auto";

                if (viewMode === "single") {
                    spread = "none";
                } else if (viewMode === "two-page") {
                    spread = "always";
                } else if (viewMode === "continuous") {
                    flow = "scrolled-doc";
                    manager = "continuous";
                    spread = "none";
                }

                const rendition = bookRef.current!.renderTo(viewerRef.current!, {
                    width,
                    height,
                    flow,
                    manager,
                    spread,
                });

                rendition.themes.register("dark", {
                    "body": {
                        "background": "transparent",
                        "color": "#e5e5e5"
                    },
                    "a": {
                        "color": "#a78bfa"
                    },
                    "p": {
                        "color": "#e5e5e5"
                    },
                    "h1": {
                        "color": "#ffffff"
                    },
                    "h2": {
                        "color": "#ffffff"
                    },
                    "h3": {
                        "color": "#ffffff"
                    }
                });

                rendition.themes.select("dark");

                renditionRef.current = rendition;

                await rendition.display(currentLoc || undefined);
                rendition.themes.fontSize(`${fontSize}%`);

                // Touch handling
                rendition.on("touchstart", (e: TouchEvent) => {
                    touchStartRef.current = e.changedTouches[0].clientX;
                });

                rendition.on("touchend", (e: TouchEvent) => {
                    if (touchStartRef.current === null) return;
                    const touchEnd = e.changedTouches[0].clientX;
                    const distance = touchStartRef.current - touchEnd;

                    if (distance > 50) {
                        rendition.next();
                    } else if (distance < -50) {
                        rendition.prev();
                    }
                    touchStartRef.current = null;
                });

                rendition.on("relocated", (location: { start: { cfi: string } }) => {
                    if (location?.start?.cfi) {
                        setCurrentLocation(location.start.cfi);
                        onLocationChange(location.start.cfi);

                        if (onProgressChange && bookRef.current) {
                            const percentage = bookRef.current.locations.percentageFromCfi(location.start.cfi);
                            onProgressChange(percentage);
                        }
                    }
                });


            } catch (error) {
                console.error("Error changing view mode:", error);
            } finally {
                setLoading(false);
            }
        };

        reRender();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [viewMode, isBookReady, onLocationChange]);

    // Handle font size dynamically without full re-render
    useEffect(() => {
        if (renditionRef.current && isBookReady) {
            renditionRef.current.themes.fontSize(`${fontSize}%`);
        }
    }, [fontSize, isBookReady]);

    // Handle Resize
    useEffect(() => {
        if (!renditionRef.current || !viewerRef.current) return;

        const resizeObserver = new ResizeObserver((entries) => {
            const { width, height } = entries[0].contentRect;
            requestAnimationFrame(() => {
                if (renditionRef.current && typeof renditionRef.current.resize === "function") {
                    renditionRef.current.resize(width, height);
                }
            });
        });

        resizeObserver.observe(viewerRef.current);

        return () => resizeObserver.disconnect();
    }, [isBookReady]);

    if (error) {
        return (
            <div className="flex items-center justify-center h-full">
                <div className="bg-red-500/10 border border-red-500/50 p-6 rounded-xl text-center max-w-md mx-4">
                    <AlertCircle className="mx-auto mb-3 text-red-500" size={32} />
                    <p className="text-red-400">{error}</p>
                </div>
            </div>
        );
    }

    return (
        <div className="relative w-full h-full">
            {loading && (
                <div className="absolute inset-0 flex items-center justify-center bg-[#0a0a0a]/50 z-20">
                    <div className="flex flex-col items-center gap-3">
                        <Loader2 className="animate-spin text-purple-500" size={40} />
                        <p className="text-white">Loading Book...</p>
                    </div>
                </div>
            )}

            <div className="w-full h-full text-white" ref={viewerRef} />
        </div>
    );
});

EPUBRenderer.displayName = "EPUBRenderer";

export default EPUBRenderer;
