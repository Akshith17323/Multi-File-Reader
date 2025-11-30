"use client";

import React, { useEffect, useRef, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import ePub, { Book, Rendition } from "epubjs";
import { ChevronLeft, ChevronRight, Menu, X, AlertCircle, Loader2 } from "lucide-react";

function ReaderContent() {
  const searchParams = useSearchParams();
  const url = searchParams.get("url");

  const viewerRef = useRef<HTMLDivElement | null>(null);
  const renditionRef = useRef<Rendition | null>(null);
  const bookRef = useRef<Book | null>(null);

  const [loading, setLoading] = useState(true);
  const [chapters, setChapters] = useState<{ label: string; href: string }[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [currentLocation, setCurrentLocation] = useState<string>("");
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Touch handling
  const touchStartRef = useRef<number | null>(null);

  useEffect(() => {
    if (!url) {
      setError("Missing 'url' query parameter.");
      setLoading(false);
      return;
    }

    if (!viewerRef.current) return;

    let cancelled = false;

    const initBook = async () => {
      try {
        setLoading(true);

        const book = ePub(url);
        bookRef.current = book;

        const rendition = book.renderTo(viewerRef.current!, {
          width: "100%",
          height: "100%",
          spread: "always",
          flow: "paginated",
        });

        renditionRef.current = rendition;

        await rendition.display();

        // Swipe handling within iframe
        rendition.on("touchstart", (e: TouchEvent) => {
          touchStartRef.current = e.changedTouches[0].clientX;
        });

        rendition.on("touchend", (e: TouchEvent) => {
          if (touchStartRef.current === null) return;
          const touchEnd = e.changedTouches[0].clientX;
          const distance = touchStartRef.current - touchEnd;

          if (distance > 50) {
            rendition.next();
          } else if (distance < -50) {
            rendition.prev();
          }
          touchStartRef.current = null;
        });

        const toc = await book.loaded.navigation;
        if (!cancelled && toc?.toc) {
          setChapters(
            toc.toc.map((item: any) => ({
              label: item.label,
              href: item.href,
            }))
          );
        }

        rendition.on("relocated", (location: any) => {
          if (!location?.start?.cfi || cancelled) return;
          setCurrentLocation(location.start.cfi);
        });

        if (!cancelled) setLoading(false);
      } catch (err: any) {
        console.error("Error initializing EPUB:", err);
        if (!cancelled) {
          setError(err.message || "Failed to load EPUB.");
          setLoading(false);
        }
      }
    };

    initBook();

    return () => {
      cancelled = true;
      try {
        renditionRef.current?.destroy();
        bookRef.current?.destroy();
      } catch { }
    };
  }, [url]);

  const goNext = () => renditionRef.current?.next();
  const goPrev = () => renditionRef.current?.prev();

  const goToHref = (href: string) => {
    renditionRef.current?.display(href);
    setIsSidebarOpen(false);
  };

  if (!url) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black text-white">
        <div className="bg-white/5 p-8 rounded-2xl border border-white/10 text-center">
          <AlertCircle className="mx-auto mb-4 text-red-500" size={48} />
          <p className="text-xl font-bold mb-2">No File Selected</p>
          <p className="text-gray-400">Please open this page via the Files list.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-[100dvh] flex flex-col bg-gray-900 overflow-hidden relative">
      {/* Background Gradients */}
      <div className="absolute top-[-20%] left-[-10%] w-[500px] h-[500px] bg-violet-600/30 rounded-full blur-[120px] pointer-events-none mix-blend-screen" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[500px] h-[500px] bg-fuchsia-600/30 rounded-full blur-[120px] pointer-events-none mix-blend-screen" />

      {/* Header */}
      <header className="bg-white/5 backdrop-blur-xl border-b border-white/10 px-4 py-3 flex items-center justify-between z-20">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsSidebarOpen(true)}
            className="p-2 hover:bg-white/10 rounded-lg text-white transition-colors"
          >
            <Menu size={24} />
          </button>
          <div>
            <h1 className="text-white font-semibold text-sm sm:text-base">EPUB Reader</h1>
            <p className="text-xs text-gray-400 truncate max-w-[150px] sm:max-w-md">
              {decodeURIComponent(url).split('/').pop()}
            </p>
          </div>
        </div>
      </header>

      {/* Sidebar Drawer */}
      <div className={`
        fixed inset-y-0 left-0 w-80 bg-gray-900/95 backdrop-blur-2xl border-r border-white/10 z-50 transform transition-transform duration-300 ease-in-out
        ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <div className="p-4 border-b border-white/10 flex items-center justify-between">
          <h2 className="text-white font-bold">Table of Contents</h2>
          <button
            onClick={() => setIsSidebarOpen(false)}
            className="p-2 hover:bg-white/10 rounded-lg text-gray-400 hover:text-white"
          >
            <X size={20} />
          </button>
        </div>
        <div className="overflow-y-auto h-full pb-20">
          {chapters.length === 0 ? (
            <p className="p-4 text-gray-500 text-sm">No chapters found.</p>
          ) : (
            <ul className="py-2">
              {chapters.map((chapter, idx) => (
                <li key={idx}>
                  <button
                    onClick={() => goToHref(chapter.href)}
                    className="w-full text-left px-4 py-3 text-gray-300 hover:bg-white/5 hover:text-white transition-colors text-sm truncate"
                  >
                    {chapter.label || `Chapter ${idx + 1}`}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Overlay for sidebar */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 backdrop-blur-sm"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Main Reader Area */}
      <main className="flex-1 relative z-10">
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center text-white bg-gray-900 z-20">
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="animate-spin text-blue-500" size={40} />
              <p>Loading Book...</p>
            </div>
          </div>
        )}

        {error && (
          <div className="absolute inset-0 flex items-center justify-center z-20">
            <div className="bg-red-500/10 border border-red-500/50 p-6 rounded-xl text-center max-w-md mx-4">
              <AlertCircle className="mx-auto mb-3 text-red-500" size={32} />
              <p className="text-red-400">{error}</p>
            </div>
          </div>
        )}

        <div className="w-full h-full bg-white/5" ref={viewerRef} />
      </main>

      {/* Floating Controls */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-black/80 backdrop-blur-xl border border-white/10 rounded-full px-6 py-3 flex items-center gap-8 shadow-2xl z-20">
        <button
          onClick={goPrev}
          className="text-white hover:text-blue-400 transition-colors active:scale-95"
        >
          <ChevronLeft size={28} />
        </button>

        <div className="w-px h-6 bg-white/20" />

        <button
          onClick={goNext}
          className="text-white hover:text-blue-400 transition-colors active:scale-95"
        >
          <ChevronRight size={28} />
        </button>
      </div>
    </div>
  );
}

export default function ReaderPage() {
  return (
    <Suspense fallback={<div className="h-screen bg-black flex items-center justify-center text-white">Loading...</div>}>
      <ReaderContent />
    </Suspense>
  );
}