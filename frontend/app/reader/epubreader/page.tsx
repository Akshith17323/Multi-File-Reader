"use client";

import React, { useEffect, useRef, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import ePub, { Book, Rendition } from "epubjs";
import { ChevronLeft, ChevronRight, Menu, X, AlertCircle, Loader2, Globe, Bookmark, Info, ZoomIn, ZoomOut, Search, FileText, ScrollText, Columns } from "lucide-react";

function ReaderContent() {
  const searchParams = useSearchParams();
  const url = searchParams.get("url");

  const viewerRef = useRef<HTMLDivElement | null>(null);
  const renditionRef = useRef<Rendition | null>(null);
  const bookRef = useRef<Book | null>(null);

  const [showControls, setShowControls] = useState(true);
  // const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null); // Unused

  const [loading, setLoading] = useState(true);
  const [chapters, setChapters] = useState<{ label: string; href: string }[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [currentLocation, setCurrentLocation] = useState<string>("");
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [fontSize, setFontSize] = useState(100);
  const [viewMode, setViewMode] = useState<'single' | 'two-page' | 'continuous'>('two-page');
  const [isBookReady, setIsBookReady] = useState(false);

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

        const proxiedUrl = `${process.env.NEXT_PUBLIC_BACKEND_URL}/proxy?url=${encodeURIComponent(url)}`;
        const book = ePub(proxiedUrl);
        bookRef.current = book;
        setIsBookReady(true);

        const toc = await book.loaded.navigation;
        if (!cancelled && toc?.toc) {
          setChapters(
            toc.toc.map((item: { label: string; href: string }) => ({
              label: item.label,
              href: item.href,
            }))
          );
        }
      } catch (err: unknown) {
        console.error("❌ Error initializing EPUB:", err);
        if (!cancelled) {
          setError((err as Error).message || "Failed to load EPUB.");
          setLoading(false);
        }
      }
    };

    initBook();

    return () => {
      cancelled = true;
      setIsBookReady(false);
      try {
        renditionRef.current?.destroy();
        bookRef.current?.destroy();
      } catch { }
    };
  }, [url]);

  // Load Bookmark on Init
  useEffect(() => {
    const loadBookmark = async () => {
      const id = searchParams.get("id");
      if (!id) return;
      try {
        const token = localStorage.getItem("token");
        if (!token) return;

        const res = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/api/bookmarks?fileId=${id}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
          if (data.cfi) {
            setCurrentLocation(data.cfi);
          }
        }
      } catch (err) {
        console.error("Failed to load bookmark", err);
      }
    };
    loadBookmark();
  }, [url, searchParams]); // Added searchParams dep

  // Save Bookmark Handler
  const saveProgress = async (cfi: string) => {
    const id = searchParams.get("id");
    if (!id) return;
    try {
      const token = localStorage.getItem("token");
      if (!token) return;

      let progress = 0;
      if (bookRef.current) {
        const locations = bookRef.current.locations;
        // @ts-ignore - locations.length is sometimes a function or property context dependent, safe check
        if (locations.length() > 0) {
          progress = Math.round(locations.percentageFromCfi(cfi) * 100);
        }
      }

      await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/api/bookmarks`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          fileId: id,
          cfi: cfi,
          progress: progress,
          total: 100
        })
      });
    } catch (err) {
      console.error("Failed to save progress", err);
    }
  };

  // Re-render when viewMode changes or book is ready
  useEffect(() => {
    if (!isBookReady || !bookRef.current || !viewerRef.current) return;

    const reRender = async () => {
      setLoading(true);
      try {
        // Save current location if possible, else rely on state
        const currentLoc = renditionRef.current?.location?.start?.cfi || currentLocation;

        // Destroy previous rendition to cleanly switch modes
        if (renditionRef.current) {
          renditionRef.current.destroy();
        }

        const width = "100%";
        const height = "100%";

        let flow = "paginated";
        let manager = "default";
        let spread = "auto";

        if (viewMode === "single") {
          spread = "none";
        } else if (viewMode === "two-page") {
          spread = "always"; // Force two page
        } else if (viewMode === "continuous") {
          flow = "scrolled-doc";
          manager = "continuous";
          spread = "none";
        }

        const rendition = bookRef.current!.renderTo(viewerRef.current!, {
          width,
          height,
          flow,
          manager,
          spread
        });

        renditionRef.current = rendition;

        await rendition.display(currentLoc || undefined);
        rendition.themes.fontSize(`${fontSize}%`);

        // Re-attach listeners
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
          } else {
            // Toggle controls on tap (if not scrolling significantly)
            setShowControls(prev => !prev);
          }
          touchStartRef.current = null;
        });

        rendition.on("click", () => {
          setShowControls(prev => !prev);
        });

        rendition.on("relocated", (location: { start: { cfi: string } }) => {
          if (location?.start?.cfi) {
            setCurrentLocation(location.start.cfi);
            // Save Progress (Debounce handled by natural reading speed + minimal request weight)
            // But let's verify we don't spam. Relocated fires on every page turn.
            saveProgress(location.start.cfi);
          }
        });

        // Apply initial font size again just in case
        rendition.themes.fontSize(`${fontSize}%`);

        // Generate locations for percentage calculation if not already
        if (bookRef.current && bookRef.current.locations.length() === 0) {
          // This is heavy, maybe run in background
          bookRef.current.locations.generate(1000);
        }

      } catch (error) {
        console.error("Error changing view mode:", error);
      } finally {
        setLoading(false);
      }
    };

    reRender();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewMode, isBookReady]);

  // Handle Resize for responsive reflow
  useEffect(() => {
    if (!renditionRef.current || !viewerRef.current) return;

    const resizeObserver = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      // Debounce or just call resize
      requestAnimationFrame(() => {
        // @ts-ignore
        renditionRef.current?.resize(width, height);
      });
    });

    resizeObserver.observe(viewerRef.current);

    return () => resizeObserver.disconnect();
  }, [isBookReady]); // Re-bind if book reloads

  useEffect(() => {
    if (renditionRef.current) {
      renditionRef.current.themes.fontSize(`${fontSize}%`);
    }
  }, [fontSize]);

  const goNext = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    renditionRef.current?.next();
  };
  const goPrev = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    renditionRef.current?.prev();
  };

  const goToHref = (href: string) => {
    renditionRef.current?.display(href);
    if (window.innerWidth < 1024) { // Close on mobile only preferably, but consistent with PDF behvaior
      setIsSidebarOpen(false);
    }
  };

  const increaseFontSize = () => setFontSize(s => Math.min(s + 20, 200));
  const decreaseFontSize = () => setFontSize(s => Math.max(s - 20, 50));


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

  const title = decodeURIComponent(url).split('/').pop();

  return (
    <div className="h-dvh flex flex-col lg:flex-row bg-gray-900 overflow-hidden relative">
      {/* Background Gradients */}
      <div className="absolute top-[-20%] left-[-10%] w-[500px] h-[500px] bg-violet-600/30 rounded-full blur-[120px] pointer-events-none mix-blend-screen" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[500px] h-[500px] bg-fuchsia-600/30 rounded-full blur-[120px] pointer-events-none mix-blend-screen" />

      {/* Header Removed as per user request */}
      <div className={`absolute top-0 right-0 p-4 z-50 transition-all duration-300 ${showControls ? 'translate-y-0 opacity-100' : '-translate-y-full opacity-0'}`}>
        <div className="flex items-center gap-3 lg:hidden">
          <button
            onClick={(e) => { e.stopPropagation(); setIsSidebarOpen(true); }}
            className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-semibold transition-colors"
          >
            <Menu size={16} />
            MENU
          </button>
        </div>
      </div>

      {/* Sidebar Drawer */}
      <div className={`
        fixed inset-y-0 right-0 w-80 bg-[#16171b] border-l border-[#2e2f36] z-[60] transform transition-transform duration-300 ease-in-out text-[#a2a2a2]
        lg:static lg:transform-none lg:z-0 lg:shrink-0
        ${isSidebarOpen ? 'translate-x-0' : 'translate-x-full'} lg:translate-x-0
      `}>
        <div className="p-4 border-b border-[#2e2f36] flex items-center justify-between">
          <div>
            <h2 className="text-white font-semibold text-sm">You are reading</h2>
            <p className="text-xs truncate max-w-[200px] text-blue-400">{title}</p>
          </div>

          <button
            onClick={() => setIsSidebarOpen(false)}
            className="p-2 hover:bg-[#2e2f36] rounded-md text-[#a2a2a2] hover:text-white transition-colors lg:hidden"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-4 space-y-6 overflow-y-auto h-[calc(100vh-65px)]">
          {/* Navigation */}
          <div className="bg-[#1f2128] rounded-lg p-3 space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-2"><Globe size={14} /> Language</span>
              <span className="text-white">English</span>
            </div>
            <div className="flex items-center gap-2 bg-[#2a2c34] p-2 rounded-md justify-between">
              <button
                onClick={goPrev}
                className="p-1 hover:text-white"
              >
                <ChevronLeft size={16} />
              </button>
              <div className="text-center">
                <span className="text-white text-sm font-medium">Navigate</span>
              </div>
              <button
                onClick={goNext}
                className="p-1 hover:text-white"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>

          <div className="space-y-1">
            <button className="w-full flex items-center gap-3 px-3 py-3 rounded-md hover:bg-[#1f2128] text-sm transition-colors">
              <Bookmark size={18} />
              <span>Bookmark</span>
            </button>
            <button className="w-full flex items-center gap-3 px-3 py-3 rounded-md hover:bg-[#1f2128] text-sm transition-colors">
              <Info size={18} />
              <span>Detail</span>
            </button>
          </div>

          {/* View Mode Controls */}
          <div className="bg-[#1f2128] rounded-lg overflow-hidden">
            {[
              { id: 'single', label: 'Single Page', icon: FileText },
              { id: 'two-page', label: 'Two Page', icon: Columns },
              { id: 'continuous', label: 'Long Strip', icon: ScrollText },
            ].map((mode) => (
              <button
                key={mode.id}
                onClick={() => setViewMode(mode.id as 'single' | 'two-page' | 'continuous')}
                className={`w-full flex items-center justify-between px-4 py-3 text-sm transition-colors border-b border-[#2e2f36] last:border-0 ${viewMode === mode.id ? "text-blue-400 bg-[#252830]" : "hover:bg-[#252830] hover:text-gray-200"
                  }`}
              >
                <div className="flex items-center gap-3">
                  <mode.icon size={18} />
                  <span>{mode.label}</span>
                </div>
                {viewMode === mode.id && <div className="w-1.5 h-1.5 rounded-full bg-blue-400" />}
              </button>
            ))}
          </div>

          {/* Font Size Control */}
          <div className="bg-[#1f2128] rounded-lg p-3 flex items-center justify-between">
            <span className="text-sm font-medium text-white flex items-center gap-2">
              <Search size={16} /> Font Size
            </span>
            <div className="flex items-center gap-3 bg-[#2a2c34] rounded px-2 py-1">
              <button
                onClick={decreaseFontSize}
                className="p-1 hover:text-white"
              >
                <ZoomOut size={16} />
              </button>
              <span className="text-xs text-white min-w-[3ch] text-center">{fontSize}%</span>
              <button
                onClick={increaseFontSize}
                className="p-1 hover:text-white"
              >
                <ZoomIn size={16} />
              </button>
            </div>
          </div>

          {/* Chapters / Content */}
          <div className="pt-4 border-t border-[#2e2f36]">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Table of Contents</h3>
            {chapters.length === 0 ? (
              <p className="text-gray-500 text-sm italic">No chapters found.</p>
            ) : (
              <ul className="space-y-1">
                {chapters.map((chapter, idx) => (
                  <li key={idx}>
                    <button
                      onClick={() => goToHref(chapter.href)}
                      className="w-full text-left px-3 py-2 text-sm rounded-md hover:bg-[#252830] hover:text-gray-200 transition-colors truncate"
                      title={chapter.label}
                    >
                      {chapter.label || `Chapter ${idx + 1}`}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

        </div>
      </div>

      {/* Overlay for sidebar (Mobile Only) */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-[55] backdrop-blur-[2px] transition-opacity lg:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Main Reader Area */}
      <main className="flex-1 relative z-10 w-full h-full min-w-0 transition-all duration-300">
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

        {/* EPub Viewer Container */}
        <div style={{ background: '#fff' }} className="w-full h-full pb-20" ref={viewerRef} />
      </main>

      {/* Floating Controls (Mobile/Tablet primarily, or bottom nav) */}
      <div
        className={`absolute bottom-6 left-1/2 -translate-x-1/2 lg:left-[calc(50%-10rem)] bg-black/80 backdrop-blur-xl border border-white/10 rounded-full px-6 py-3 flex items-center gap-8 shadow-2xl z-50 transition-all duration-300 ${showControls ? 'translate-y-0 opacity-100' : 'translate-y-full opacity-0'}`}
        onClick={(e) => e.stopPropagation()}
      >
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