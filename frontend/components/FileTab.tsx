"use client";

import { X, FileText, BookOpen } from "lucide-react";

export interface FileTabData {
    id: string;
    url: string;
    name: string;
    type: "pdf" | "epub";
}

interface FileTabProps {
    file: FileTabData;
    isActive: boolean;
    onClick: () => void;
    onClose: (e: React.MouseEvent) => void;
}

export default function FileTab({ file, isActive, onClick, onClose }: FileTabProps) {
    const Icon = file.type === "pdf" ? FileText : BookOpen;

    const getTypeBadge = () => {
        return file.type.toUpperCase();
    };

    return (
        <button
            onClick={onClick}
            title={file.name}
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
        flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center
        ${isActive ? "bg-primary/20" : "bg-surface"}
      `}
            >
                <Icon size={16} className={isActive ? "text-primary" : "text-foreground-muted"} />
            </div>

            {/* File Name */}
            <div className="flex-1 min-w-0 flex flex-col">
                <span className="text-sm font-medium truncate">{file.name}</span>
                <span
                    className={`text-xs transition-colors ${
                        isActive ? "text-primary" : "text-foreground-muted"
                    }`}
                >
                    {getTypeBadge()}
                </span>
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
            >
                <X size={14} />
            </button>
        </button>
    );
}
