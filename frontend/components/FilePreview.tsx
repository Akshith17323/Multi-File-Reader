"use client";

import { useState, useEffect, useRef } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import ePub from "epubjs";
import { FileText, Book } from "lucide-react";

// Configure worker (reuse the same worker config as PDFViewer)
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

interface FilePreviewProps {
    url: string;
    type: string;
}

export default function FilePreview({ url, type }: FilePreviewProps) {
    const proxiedUrl = `${process.env.NEXT_PUBLIC_BACKEND_URL}/proxy?url=${encodeURIComponent(url)}`;
    const [coverUrl, setCoverUrl] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);

    useEffect(() => {
        let mounted = true;

        const fetchCover = async () => {
            if (type === "application/epub+zip") {
                try {
                    const book = ePub(proxiedUrl);
                    const cover = await book.coverUrl();
                    if (mounted && cover) {
                        setCoverUrl(cover);
                    } else if (mounted) {
                        setError(true); // No cover found
                    }
                } catch (err) {
                    console.error("Error fetching EPUB cover:", err);
                    if (mounted) setError(true);
                } finally {
                    if (mounted) setLoading(false);
                }
            } else if (type === "application/pdf") {
                // PDF handling is done directly in render via react-pdf
                // Wait for Document onLoadSuccess to set loading=false
            } else {
                setLoading(false);
                setError(true);
            }
        };

        fetchCover();

        return () => {
            mounted = false;
        };
    }, [url, type]);

    const containerRef = useRef<HTMLDivElement>(null);
    const [containerWidth, setContainerWidth] = useState<number>(0);

    useEffect(() => {
        const observer = new ResizeObserver((entries) => {
            if (entries[0]) {
                setContainerWidth(entries[0].contentRect.width);
            }
        });

        if (containerRef.current) {
            observer.observe(containerRef.current);
        }

        return () => observer.disconnect();
    }, []);

    if (type === "application/pdf") {
        return (
            <div ref={containerRef} className="w-full h-full bg-gray-800 flex items-center justify-center overflow-hidden relative">
                {error ? (
                    <div className="flex flex-col items-center text-gray-500">
                        <FileText size={32} />
                        <span className="text-xs mt-2">Preview Error</span>
                    </div>
                ) : (
                    <Document
                        file={proxiedUrl}
                        onLoadSuccess={() => {
                            setLoading(false);
                            console.log("PDF loaded successfully");
                        }}
                        onLoadError={(err) => {
                            console.error("PDF Load Error:", err);
                            setLoading(false);
                            setError(true);
                        }}
                        loading={
                            <div className="absolute inset-0 flex items-center justify-center bg-gray-800">
                                <div className="w-6 h-6 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
                            </div>
                        }
                        className="w-full h-full flex items-center justify-center"
                    >
                        {!loading && containerWidth > 0 && (
                            <Page
                                pageNumber={1}
                                width={containerWidth}
                                renderTextLayer={false}
                                renderAnnotationLayer={false}
                                className="shadow-md !bg-transparent"
                            />
                        )}
                    </Document>
                )}
            </div>
        );
    }

    if (type === "application/epub+zip") {
        if (loading) {
            return (
                <div className="w-full h-full bg-gray-800 flex items-center justify-center">
                    <div className="w-6 h-6 border-2 border-fuchsia-500 border-t-transparent rounded-full animate-spin" />
                </div>
            );
        }

        if (coverUrl) {
            return (
                <img
                    src={coverUrl}
                    alt="Book Cover"
                    className="w-full h-full object-cover"
                />
            );
        }
    }

    // Fallback for errors or other types
    return (
        <div className="w-full h-full bg-gradient-to-br from-gray-700 to-gray-800 flex items-center justify-center">
            {type === "application/epub+zip" ? (
                <Book size={40} className="text-gray-500" />
            ) : (
                <FileText size={40} className="text-gray-500" />
            )}
        </div>
    );
}
