"use client";

import { X, FileText, BookOpen, Code, FileQuestion, AlignLeft, Cloud, HardDrive } from "lucide-react";

export interface FileTabData {
    id: string;
    url: string;
    name: string;
    type: string;
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
    const isLocal = isLocalFile(file.url, file.id);

    const getIconAndColor = () => {
        switch (file.type.toLowerCase()) {
            case "pdf":
                return { Icon: FileText, color: "text-red-500", activeBg: "bg-red-500/10" };
            case "epub":
                return { Icon: BookOpen, color: "text-emerald-500", activeBg: "bg-emerald-500/10" };
            case "code":
            case "js":
            case "ts":
            case "py":
            case "json":
                return { Icon: Code, color: "text-emerald-400", activeBg: "bg-emerald-500/20" };
            case "txt":
            case "text":
            case "md":
                return { Icon: AlignLeft, color: "text-sky-500", activeBg: "bg-sky-500/10" };
            default:
                return { Icon: FileQuestion, color: "text-gray-400", activeBg: "bg-gray-500/20" };
        }
    };

    const { Icon, color, activeBg } = getIconAndColor();

    const getTypeBadge = () => {
        return file.type.toUpperCase();
    };

    return (
        <div
            title={`${file.name} (${isLocal ? "Local Disk" : "Cloud"})`}
            className={`
        group relative w-full flex items-center gap-2 px-3 py-2 rounded-2xl
        transition-all duration-200 text-left
        ${isActive
                    ? "bg-primary/10 text-foreground border border-primary/30 shadow-sm"
                    : "bg-surface-hover/40 text-foreground-muted hover:bg-surface-hover hover:text-foreground border border-border-subtle"
                }
      `}
        >
            <button
                type="button"
                onClick={onClick}
                aria-pressed={isActive}
                className="flex min-w-0 flex-1 items-center gap-3 rounded-xl py-1 text-left cursor-pointer"
            >
                {/* File Type Icon */}
                <div
                    className={`
            shrink-0 w-8 h-8 rounded-lg flex items-center justify-center
            ${isActive ? activeBg : "bg-surface"}
          `}
                >
                    <Icon size={16} className={isActive ? color : "text-foreground-muted"} />
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
                                isLocal ? "text-emerald-500" : "text-primary"
                            }`}
                        >
                            {isLocal ? <HardDrive size={10} /> : <Cloud size={10} />}
                            <span>{isLocal ? "Local" : "Cloud"}</span>
                        </span>
                    </div>
                </div>
            </button>

            {/* Close Button */}
            <button
                type="button"
                onClick={(e) => {
                    e.stopPropagation();
                    onClose(e);
                }}
                className={`
          p-1.5 rounded-lg opacity-70 group-hover:opacity-100 group-focus-within:opacity-100 transition-all shrink-0
          ${isActive
                        ? "hover:bg-primary-hover text-primary hover:text-white"
                        : "hover:bg-border-subtle text-foreground-muted hover:text-foreground"
                    }
        `}
                title="Close Tab"
                aria-label={`Close ${file.name}`}
            >
                <X size={14} />
            </button>
        </div>
    );
}
