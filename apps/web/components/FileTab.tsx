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
                return { Icon: FileText, color: "text-blue-400", activeBg: "bg-blue-500/20" };
            case "epub":
                return { Icon: BookOpen, color: "text-purple-400", activeBg: "bg-purple-500/20" };
            case "code":
            case "js":
            case "ts":
            case "py":
            case "json":
                return { Icon: Code, color: "text-emerald-400", activeBg: "bg-emerald-500/20" };
            case "txt":
            case "text":
            case "md":
                return { Icon: AlignLeft, color: "text-amber-400", activeBg: "bg-amber-500/20" };
            default:
                return { Icon: FileQuestion, color: "text-gray-400", activeBg: "bg-gray-500/20" };
        }
    };

    const { Icon, color, activeBg } = getIconAndColor();

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
