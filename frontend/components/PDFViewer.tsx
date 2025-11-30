"use client";

import { useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";

// Configure worker
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

interface PDFViewerProps {
    blobUrl: string;
    title?: string;
}

export default function PDFViewer({ blobUrl, title = "PDF Reader" }: PDFViewerProps) {
    const [numPages, setNumPages] = useState<number>(0);
    const [pageNumber, setPageNumber] = useState<number>(1);

    function onDocumentLoadSuccess({ numPages }: { numPages: number }) {
        setNumPages(numPages);
    }

    return (
        <div className="h-full flex flex-col">
            {/* Header */}
            <div className="bg-white px-4 py-3 shadow flex items-center justify-between z-10">
                <h1 className="text-xl font-semibold">{title}</h1>

                <div className="flex items-center gap-3">
                    <button
                        onClick={() => setPageNumber((p) => Math.max(1, p - 1))}
                        disabled={pageNumber <= 1}
                        className="px-3 py-1 bg-gray-200 rounded disabled:opacity-50"
                    >
                        Prev
                    </button>

                    <span className="text-sm">
                        Page {pageNumber} / {numPages || "?"}
                    </span>

                    <button
                        onClick={() => setPageNumber((p) => Math.min(numPages, p + 1))}
                        disabled={pageNumber >= numPages}
                        className="px-3 py-1 bg-gray-200 rounded disabled:opacity-50"
                    >
                        Next
                    </button>
                </div>
            </div>

            {/* PDF Container */}
            <div className="flex-1 overflow-auto p-4 flex justify-center">
                <Document
                    file={blobUrl}
                    onLoadSuccess={onDocumentLoadSuccess}
                    className="shadow-lg"
                >
                    <Page
                        pageNumber={pageNumber}
                        renderTextLayer={false}
                        renderAnnotationLayer={false}
                        scale={1.5}
                    />
                </Document>
            </div>
        </div>
    );
}
