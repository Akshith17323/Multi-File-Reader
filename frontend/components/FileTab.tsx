"use client";

import { X, FileText, BookOpen, Code, FileQuestion, AlignLeft } from "lucide-react";

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

export default function FileTab({ file, isActive, onClick, onClose }: FileTabProps) {
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
            title={file.name}
            className={`
        group relative w-full flex items-center gap-3 px-4 py-3 rounded-xl
        transition-all duration-200 text-left
        ${isActive
                    ? "bg-[#252830] text-white border border-blue-500/30 shadow-lg shadow-blue-500/10"
                    : "bg-[#1a1a1a]/50 text-[#a2a2a2] hover:bg-[#1f2128] hover:text-white border border-transparent"
                }
      `}
        >
            {/* File Type Icon */}
            <div
                className={`
        flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center
        ${isActive ? activeBg : "bg-[#2a2c34]"}
      `}
            >
                <Icon size={16} className={isActive ? color : "text-[#737373]"} />
            </div>

            {/* File Name */}
            <div className="flex-1 min-w-0 flex flex-col">
                <span className="text-sm font-medium truncate">{file.name}</span>
                <span
                    className={`text-xs ${isActive ? "text-blue-400" : "text-[#525252]"
                        }`}
                >
                    {getTypeBadge()}
                </span>
            </div>

            {/* Close Button */}
            <button
                onClick={onClose}
                className={`
          flex-shrink-0 w-6 h-6 rounded-md flex items-center justify-center
          opacity-0 group-hover:opacity-100 transition-opacity
          hover:bg-red-500/20 hover:text-red-400
          ${isActive ? "text-[#a2a2a2]" : "text-[#525252]"}
        `}
            >
                <X size={14} />
            </button>
        </button>
    );
}
