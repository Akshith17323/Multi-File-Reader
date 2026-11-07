"use client";

import { forwardRef, useImperativeHandle, useEffect, useRef } from "react";
import { FileQuestion, ExternalLink, Download } from "lucide-react";
import { BaseReaderProps, ReaderHandle } from "../types";

const UnsupportedReaderAdapter = forwardRef<ReaderHandle, BaseReaderProps>(function UnsupportedReaderAdapter(
    { file, onStatusChange },
    ref
) {
    const statusRef = useRef(onStatusChange);
    useEffect(() => { statusRef.current = onStatusChange; }, [onStatusChange]);
    useEffect(() => { statusRef.current?.('ready'); }, []);
    useImperativeHandle(ref, () => ({
        next: () => {},
        prev: () => {},
    }));

    const ext = file.name.split(".").pop()?.toUpperCase() || file.type.toUpperCase();

    return (
        <div className="w-full h-full flex flex-col items-center justify-center bg-background/60 text-foreground p-8">
            <div className="w-16 h-16 rounded-2xl bg-foreground/10 border border-foreground/20 flex items-center justify-center mb-4">
                <FileQuestion className="w-8 h-8 text-foreground" />
            </div>
            <h3 className="text-lg font-semibold mb-1">No Dedicated Viewer</h3>
            <p className="text-sm text-foreground-muted max-w-md text-center mb-6">
                The file <span className="text-foreground font-medium">&quot;{file.name}&quot;</span> ({ext}) does not have an integrated viewer.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3">
                <a
                    href={file.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mfr-button-secondary"
                >
                    <ExternalLink size={16} />
                    Open in New Window
                </a>
                <a
                    href={file.url}
                    download={file.name}
                    className="mfr-button-primary"
                >
                    <Download size={16} />
                    Download File
                </a>
            </div>
        </div>
    );
});

export default UnsupportedReaderAdapter;
