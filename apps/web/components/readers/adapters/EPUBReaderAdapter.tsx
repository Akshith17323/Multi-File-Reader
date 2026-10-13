"use client";

import { forwardRef, useImperativeHandle, useRef, useState, useEffect } from "react";
import dynamic from "next/dynamic";
import { BaseReaderProps, ReaderHandle } from "../types";
import { EPUBRendererRef } from "@/components/EPUBRenderer";

const EPUBRenderer = dynamic(() => import("@/components/EPUBRenderer"), { ssr: false });

const EPUBReaderAdapter = forwardRef<ReaderHandle, BaseReaderProps>(function EPUBReaderAdapter(
    { file, viewOptions, initialLocation, onLocationChange },
    ref
) {
    const epubRef = useRef<EPUBRendererRef>(null);
    const [progress, setProgress] = useState<number>(initialLocation?.progress || 0);
    const [currentCfi, setCurrentCfi] = useState<string>(initialLocation?.cfi || "");

    useEffect(() => {
        if (initialLocation?.progress !== undefined) {
            setProgress(initialLocation.progress);
        }
        if (initialLocation?.cfi) {
            setCurrentCfi(initialLocation.cfi);
        }
    }, [initialLocation?.cfi, initialLocation?.progress]);

    // Expose unified ReaderHandle to parent multi-tab controller
    useImperativeHandle(ref, () => ({
        next: () => {
            epubRef.current?.next();
        },
        prev: () => {
            epubRef.current?.prev();
        },
    }));

    const handleLocationChange = (cfi: string) => {
        setCurrentCfi(cfi);
        onLocationChange?.({
            cfi,
            progress,
        });
    };

    const handleProgressChange = (newProgress: number) => {
        setProgress(newProgress);
        onLocationChange?.({
            cfi: currentCfi,
            progress: newProgress,
        });
    };

    return (
        <div className="w-full h-full">
            <EPUBRenderer
                ref={epubRef}
                url={file.url}
                initialCfi={initialLocation?.cfi}
                onLocationChange={handleLocationChange}
                onProgressChange={handleProgressChange}
                viewMode={viewOptions.viewMode}
                fontSize={viewOptions.fontSize}
            />
        </div>
    );
});

export default EPUBReaderAdapter;
