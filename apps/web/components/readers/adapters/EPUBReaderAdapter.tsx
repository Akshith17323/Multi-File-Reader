"use client";

import { forwardRef, useImperativeHandle, useRef, useCallback } from "react";
import dynamic from "next/dynamic";
import { BaseReaderProps, ReaderHandle } from "../types";
import type { EPUBRendererRef } from "@/components/EPUBRenderer";

const EPUBRenderer = dynamic(() => import("@/components/EPUBRenderer"), { ssr: false });

const EPUBReaderAdapter = forwardRef<ReaderHandle, BaseReaderProps>(function EPUBReaderAdapter(
    { file, viewOptions, initialLocation, onLocationChange, isActive, onStatusChange }, ref
) {
    const epubRef = useRef<EPUBRendererRef>(null);
    useImperativeHandle(ref, () => ({
        next: () => { void epubRef.current?.next()?.catch(() => {}); },
        prev: () => { void epubRef.current?.prev()?.catch(() => {}); },
        goToCfi: (cfi) => { void epubRef.current?.display(cfi)?.catch(() => {}); },
    }));
    const handleLocation = useCallback((cfi: string, progress?: number, atStart?: boolean, atEnd?: boolean) => {
        onLocationChange?.({ cfi, atStart, atEnd, ...(progress !== undefined ? { progress } : {}) });
    }, [onLocationChange]);
    return <EPUBRenderer ref={epubRef} url={file.url} initialCfi={initialLocation?.cfi}
        onLocationChange={handleLocation} onStatusChange={onStatusChange} viewMode={viewOptions.viewMode} fontSize={viewOptions.fontSize} isActive={isActive} />;
});

export default EPUBReaderAdapter;
