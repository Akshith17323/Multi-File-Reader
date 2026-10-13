"use client";

import { ComponentType, forwardRef } from "react";
import dynamic from "next/dynamic";
import { BaseReaderProps, ReaderHandle } from "./types";

// Dynamic lazy imports for each format reader
const PDFReaderAdapter = dynamic(() => import("./adapters/PDFReaderAdapter"), { ssr: false });
const EPUBReaderAdapter = dynamic(() => import("./adapters/EPUBReaderAdapter"), { ssr: false });
const TextReaderAdapter = dynamic(() => import("./adapters/TextReaderAdapter"), { ssr: false });
const UnsupportedReaderAdapter = dynamic(() => import("./adapters/UnsupportedReaderAdapter"), { ssr: false });

type ReaderComponent = ComponentType<BaseReaderProps & { ref?: React.Ref<ReaderHandle> }>;

export class ReaderFactory {
    private static registry: Map<string, ReaderComponent> = new Map<string, ReaderComponent>([
        ["pdf", PDFReaderAdapter as ReaderComponent],
        ["epub", EPUBReaderAdapter as ReaderComponent],
        ["txt", TextReaderAdapter as ReaderComponent],
        ["text", TextReaderAdapter as ReaderComponent],
        ["code", TextReaderAdapter as ReaderComponent],
        ["md", TextReaderAdapter as ReaderComponent],
        ["markdown", TextReaderAdapter as ReaderComponent],
        ["json", TextReaderAdapter as ReaderComponent],
        ["js", TextReaderAdapter as ReaderComponent],
        ["jsx", TextReaderAdapter as ReaderComponent],
        ["ts", TextReaderAdapter as ReaderComponent],
        ["tsx", TextReaderAdapter as ReaderComponent],
        ["py", TextReaderAdapter as ReaderComponent],
        ["html", TextReaderAdapter as ReaderComponent],
        ["css", TextReaderAdapter as ReaderComponent],
        ["unsupported", UnsupportedReaderAdapter as ReaderComponent],
    ]);

    /**
     * Register a new reader implementation for a file type (Open/Closed Principle)
     */
    public static register(type: string, component: ReaderComponent) {
        this.registry.set(type.toLowerCase(), component);
    }

    /**
     * Detect the canonical file type from a URL, filename, or mime type
     */
    public static detectFileType(input: string): string {
        if (!input) return "unsupported";

        const cleanInput = input.split("?")[0].toLowerCase();
        const extension = cleanInput.split(".").pop() || "";

        if (extension === "pdf" || cleanInput.includes("application/pdf")) {
            return "pdf";
        }
        if (extension === "epub" || cleanInput.includes("application/epub+zip")) {
            return "epub";
        }
        if (["txt", "log", "csv", "tsv"].includes(extension) || cleanInput.includes("text/plain")) {
            return "txt";
        }
        if (["md", "markdown"].includes(extension) || cleanInput.includes("text/markdown")) {
            return "md";
        }
        if (["json", "js", "jsx", "ts", "tsx", "py", "html", "css", "yaml", "yml", "sh", "sql"].includes(extension)) {
            return "code";
        }

        return "unsupported";
    }

    /**
     * Resolves and returns the Reader component for the given type
     */
    public static getReader(type: string): ReaderComponent {
        const normalized = type.toLowerCase().trim();
        return this.registry.get(normalized) || (UnsupportedReaderAdapter as ReaderComponent);
    }
}

/**
 * Polymorphic React Component created by the factory
 */
export const ReaderRenderer = forwardRef<ReaderHandle, BaseReaderProps>(function ReaderRenderer(
    props,
    ref
) {
    const Component = ReaderFactory.getReader(props.file.type);
    return <Component {...props} ref={ref} />;
});
