"use client";
import { useRef, useState } from "react";
import { FileText, Monitor, FolderOpen, CloudDownload, BookOpen, ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEnvironment } from "@/hooks/useEnvironment";
import { FileAdapter } from "@/services/fileAdapter";
import AppShell, { PageHeader } from "@/components/ui/AppShell";
import { FormatCard } from "@/components/ui/FormatShowcase";
import { createReaderUrl } from "@/utils/readerSession";
import DriveImportNotice from "@/components/DriveImportNotice";
import DesktopAppLink from "@/components/DesktopAppLink";
import InlineNotice from "@/components/ui/InlineNotice";

export default function AddFiles() {
  const { isElectron: isDesktop } = useEnvironment();
  const [openingLocal, setOpeningLocal] = useState(false);
  const localPickerBusy = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const openLocal = async (folder = false) => {
    if (localPickerBusy.current) return;
    localPickerBusy.current = true; setOpeningLocal(true); setError(null);
    try {
      const result = await FileAdapter.openLocalFiles(folder);
      if (!result) return;
      if (!result.files.length) { setError("No readable PDF, EPUB, or TXT files found."); return; }
      router.push(folder ? '/files' : createReaderUrl(result.files.map(file => file.url)));
    } catch (error) { setError(error instanceof Error ? error.message : "Could not open local files"); }
    finally { localPickerBusy.current = false; setOpeningLocal(false); }
  };

  return (
    <AppShell className="flex items-center" contentClassName="max-w-2xl">
        <button
          onClick={() => router.push('/files')}
          className="group mb-5 px-3.5 py-1.5 bg-surface/70 backdrop-blur-2xl border border-border-subtle rounded-xl text-foreground-muted hover:text-foreground hover:bg-surface-hover hover:border-primary/40 inline-flex items-center gap-2 transition-all duration-300 font-semibold text-xs tracking-wide shadow-xs"
        >
          <div className="w-6 h-6 rounded-full bg-surface-hover/80 border border-border-subtle flex items-center justify-center group-hover:border-primary transition-colors text-xs">
            <ArrowLeft size={12} />
          </div>
          Back to Library
        </button>

        <PageHeader
          eyebrow="Your digital library"
          title="Add"
          accent="files"
          description={isDesktop ? "Open books and documents stored on your computer." : "Read local files on desktop today. Google Drive import is coming soon."}
          className="mb-6"
        />

        <DriveImportNotice id="drive-import-notice" className="mb-6" showAction={false} />

        <div className="mfr-panel rounded-3xl p-5 shadow-xl sm:p-8">
          {isDesktop ? <div className="space-y-5 py-4 text-center">
            <Monitor size={40} className="mx-auto text-primary" aria-hidden="true" />
            <h2 className="text-xl font-semibold">Read from your computer</h2>
            <p className="text-sm text-foreground-muted">Your files stay on your computer. No upload or sign-in needed.</p>
            <div className="flex flex-col gap-3 sm:flex-row">
              <button disabled={openingLocal} onClick={() => openLocal()} className="mfr-button-primary flex-1"><FileText size={18} />Open local files</button>
              <button disabled={openingLocal} onClick={() => openLocal(true)} className="mfr-button-secondary flex-1"><FolderOpen size={18} />Open folder</button>
            </div>
            <p className="text-xs text-foreground-muted">PDF, EPUB, and TXT · Folders include files in subfolders.</p>
            {openingLocal && <p role="status" className="text-sm text-foreground-muted">Adding your files…</p>}
            {error && <InlineNotice tone="error" className="text-left">{error}</InlineNotice>}
          </div> : (
            <div className="space-y-5 py-4 text-center">
              <Monitor size={40} className="mx-auto text-primary" aria-hidden="true" />
              <h2 className="text-xl font-semibold">Keep reading on desktop</h2>
              <p className="text-sm leading-relaxed text-foreground-muted">Open local files or an entire folder in the desktop app. Your documents stay on your computer, with no upload or sign-in needed.</p>
              <DesktopAppLink className="mfr-button-primary" />
              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
                <FormatCard icon={<FileText size={20} />} label="PDF" detail="Documents" color="text-foreground" />
                <FormatCard icon={<BookOpen size={20} />} label="EPUB" detail="Books" color="text-foreground" />
                <FormatCard icon={<FileText size={20} />} label="TXT" detail="Plain text" color="text-foreground" />
              </div>
              <p className="text-xs leading-relaxed text-foreground-muted">Already have the desktop app? Open it and choose <strong className="font-semibold text-foreground">Open local files</strong> or <strong className="font-semibold text-foreground">Open folder</strong>.</p>
            </div>
          )}
          <div className="mt-5 border-t border-border-subtle pt-5 text-center">
            <button type="button" disabled aria-describedby="drive-import-notice" className="mfr-button-secondary w-full">
              <CloudDownload size={18} aria-hidden="true" />Import from Google Drive — coming soon
            </button>
          </div>
        </div>
    </AppShell>
  );
}
