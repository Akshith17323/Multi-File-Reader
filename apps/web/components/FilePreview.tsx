"use client";

import { useState } from "react";
import { FileText, Book } from "lucide-react";
import Image from "next/image";

interface FilePreviewProps {
    url: string;
    type: string;
    thumbnailUrl?: string | null;
}

export default function FilePreview({ url, type, thumbnailUrl }: FilePreviewProps) {
    const [imgError, setImgError] = useState(false);

    if (thumbnailUrl && !imgError) {
        return (
            <div className="relative w-full h-full bg-surface-hover">
                <Image
                    src={thumbnailUrl}
                    alt="File Cover"
                    fill
                    className="object-cover"
                    unoptimized
                    onError={() => setImgError(true)}
                />
            </div>
        );
    }

    // Fallback for errors, old files without thumbnails, or other types
    return (
        <div className="w-full h-full bg-surface/50 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center border-b border-border-subtle/40">
            <div className="w-16 h-16 rounded-2xl bg-surface-hover/80 backdrop-blur-xl border border-border-subtle flex items-center justify-center mb-3 shadow-inner">
                {type === "application/epub+zip" ? (
                    <Book size={32} className="text-emerald-500" />
                ) : (
                    <FileText size={32} className="text-primary" />
                )}
            </div>
            <span className="text-xs text-foreground-muted font-semibold tracking-wide">Document Preview</span>
        </div>
    );
}
