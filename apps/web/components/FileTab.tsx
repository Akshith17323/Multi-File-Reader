"use client";

import { X, FileText, BookOpen, Cloud, HardDrive } from "lucide-react";

export interface FileTabData {
    id: string;
    url: string;
    name: string;
    type: "pdf" | "epub" | "txt";
}

interface FileTabProps {
    file: FileTabData;
    isActive: boolean;
    onClick: () => void;
    onClose: (e: React.MouseEvent) => void;
}

function isLocalFile(url: string, id?: string): boolean {
    if (id && id.startsWith("local_")) return true;
    if (!url) return false;
    return (
        url.startsWith("mfr-local://") ||
        url.startsWith("file://") ||
        url.startsWith("/") ||
        /^[a-zA-Z]:[\\/]/.test(url)
    );
}

export default function FileTab({ file, isActive, onClick, onClose }: FileTabProps) {
    const Icon = file.type === "epub" ? BookOpen : FileText;
    const isLocal = isLocalFile(file.url, file.id);

    const getTypeBadge = () => {
        return file.type.toUpperCase();
    };

    return (
        <button
            onClick={onClick}
            title={`${file.name} (${isLocal ? "Local Disk" : "Cloud"})`}
            className={`
        group relative w-full flex items-center gap-3 px-4 py-3 rounded-xl
        transition-all duration-200 text-left
        ${isActive
                    ? "bg-surface text-foreground border border-primary/50 shadow-md shadow-primary/20"
                    : "bg-background text-foreground-muted hover:bg-surface-hover hover:text-foreground border border-transparent"
                }
      `}
        >
            {/* File Type Icon */}
            <div
                className={`
        shrink-0 w-8 h-8 rounded-lg flex items-center justify-center
        ${isActive ? "bg-primary/20" : "bg-surface"}
      `}
            >
                <Icon size={16} className={isActive ? "text-primary" : "text-foreground-muted"} />
            </div>

            {/* File Name & Badges */}
            <div className="flex-1 min-w-0 flex flex-col">
                <span className="text-sm font-medium truncate">{file.name}</span>
                <div className="flex items-center gap-1.5 mt-0.5">
                    <span
                        className={`text-[10px] font-bold px-1.5 py-0.5 rounded transition-colors ${
                            isActive ? "bg-primary/20 text-primary" : "bg-surface text-foreground-muted"
                        }`}
                    >
                        {getTypeBadge()}
                    </span>
                    <span
                        className={`text-[10px] font-semibold flex items-center gap-1 ${
                            isLocal ? "text-emerald-400" : "text-sky-400"
                        }`}
                    >
                        {isLocal ? <HardDrive size={10} /> : <Cloud size={10} />}
                        <span>{isLocal ? "Local" : "Cloud"}</span>
                    </span>
                </div>
            </div>

            {/* Close Button */}
            <button
                onClick={(e) => {
                    e.stopPropagation();
                    onClose(e);
                }}
                className={`
          p-1.5 rounded-md opacity-0 group-hover:opacity-100 transition-all shrink-0
          ${isActive
                        ? "hover:bg-primary-hover text-primary hover:text-white"
                        : "hover:bg-border-subtle text-foreground-muted hover:text-foreground"
                    }
        `}
                title="Close Tab"
            >
                <X size={14} />
            </button>
        </button>
    );
}
