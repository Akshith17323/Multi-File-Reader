"use client";

import { useEffect, useRef, useState } from "react";
import { Search, X, Loader2 } from "lucide-react";
import { getDocumentUrl } from "@/utils/fileUrls";
import { decodeText } from '@/utils/textReader';
import type { FileTabData } from "./FileTab";

type Result = { text: string; page?: number; cfi?: string; line?: number };

export function DocumentSearch({ file, onClose, onGoToPage, onGoToCfi, onGoToLine }: {
  file: FileTabData;
  onClose: () => void;
  onGoToPage: (page: number) => void;
  onGoToCfi?: (cfi: string) => void;
  onGoToLine?: (line: number) => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Result[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const supported = file.type !== "unsupported";

  useEffect(() => { inputRef.current?.focus(); }, [file.url]);

  useEffect(() => {
    let canceled = false;
    const controller = new AbortController();
    let cleanup: (() => void) | undefined;
    setResults([]);
    setError("");
    if (!query.trim() || !supported) { setLoading(false); return; }
    setLoading(true);
    const timer = setTimeout(async () => {
      try {
        const matches: Result[] = [];
        const needle = query.trim().toLowerCase();
        const url = getDocumentUrl(file.url);
        if (file.type === "pdf") {
          const { pdfjs } = await import("react-pdf");
          pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();
          const task = pdfjs.getDocument(url);
          cleanup = () => { void task.destroy(); };
          if (canceled) { cleanup(); return; }
          const pdf = await task.promise;
          for (let page = 1; page <= pdf.numPages && matches.length < 50 && !canceled; page++) {
            const content = await (await pdf.getPage(page)).getTextContent();
            const text = content.items.map(item => "str" in item ? item.str : "").join(" ");
            const index = text.toLowerCase().indexOf(needle);
            if (index >= 0) matches.push({ page, text: text.slice(Math.max(0, index - 50), index + needle.length + 100) });
          }
        } else if (file.type === "epub") {
          const ePub = (await import("epubjs")).default;
          const book = ePub();
          cleanup = () => book.destroy();
          const response = await fetch(url, { signal: controller.signal });
          if (!response.ok) throw new Error('Could not load book for search');
          const data = await response.arrayBuffer();
          if (canceled) return;
          await book.open(data, "binary");
          const sections: any[] = (book.spine as any).spineItems;
          for (const section of sections) {
            if (canceled || matches.length >= 50) break;
            await section.load(book.load.bind(book));
            for (const match of section.find(query.trim())) matches.push({ text: match.excerpt, cfi: match.cfi });
            section.unload();
          }
        } else {
          const response = await fetch(url, { signal: controller.signal });
          if (!response.ok) throw new Error("Could not load document for search");
          const text = decodeText(await response.arrayBuffer(), response.headers.get('content-type') || '');
          text.split("\n").forEach((line, index) => {
            if (matches.length < 50 && line.toLowerCase().includes(needle)) matches.push({ line: index + 1, text: `Line ${index + 1}: ${line.slice(0, 200)}` });
          });
        }
        if (!canceled) setResults(matches.slice(0, 50));
      } catch (err) {
        if (!canceled) setError(err instanceof Error ? err.message : "Search failed");
      } finally {
        cleanup?.();
        cleanup = undefined;
        if (!canceled) setLoading(false);
      }
    }, 300);
    return () => { canceled = true; clearTimeout(timer); controller.abort(); cleanup?.(); };
  }, [query, file.url, file.type, supported]);

  return (
    <section aria-label="Search document" className="shrink-0 border-b border-border-subtle bg-surface p-3">
      <div className="flex items-center gap-2">
        <Search size={16} className="text-primary" />
        <input ref={inputRef} value={query} onChange={event => setQuery(event.target.value)} aria-label="Search in this document" placeholder="Search this document..." className="mfr-input" disabled={!supported} />
        <button type="button" onClick={onClose} aria-label="Close document search" className="mfr-icon-button h-9 w-9"><X size={16} /></button>
      </div>
      <div role="status" className="mt-2 max-h-40 overflow-y-auto text-xs text-foreground-muted">
        {!supported ? "Search is unavailable for this format." : loading ? <span className="inline-flex items-center gap-2"><Loader2 size={12} className="animate-spin" />Searching...</span> : error || (query.trim() && !results.length ? "No matches found." : "")}
        {results.map((result, index) => result.page || result.cfi || result.line ? (
          <button key={index} type="button" className="block w-full rounded-lg p-2 text-left hover:bg-surface-hover" onClick={() => result.page ? onGoToPage(result.page) : result.cfi ? onGoToCfi?.(result.cfi) : onGoToLine?.(result.line!)}>
            {result.page && <strong className="mr-2 text-primary">Page {result.page}</strong>}{result.text}
          </button>
        ) : <p key={index} className="p-2">{result.text}</p>)}
      </div>
    </section>
  );
}
