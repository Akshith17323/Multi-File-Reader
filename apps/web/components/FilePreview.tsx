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
        <div className="w-full h-full bg-surface-hover flex flex-col items-center justify-center p-4 text-center">
            {type === "application/epub+zip" ? (
                <Book size={40} className="text-foreground-muted mb-2" />
            ) : (
                <FileText size={40} className="text-foreground-muted mb-2" />
            )}
            <span className="text-xs text-foreground-muted font-medium">Thumbnail not available</span>
        </div>
    );
}
