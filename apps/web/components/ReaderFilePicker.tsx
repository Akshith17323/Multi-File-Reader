"use client";

import { useEffect, useRef, useState } from 'react';
import { BookOpen, FileText, FolderOpen, Loader2, X } from 'lucide-react';
import { loadLibraryPage } from '@/services/library';
import { getLocalLibraryFiles } from '@/utils/localLibrary';
import { detectFileType, isLocalFileUrl, normalizeFileUrl } from '@/utils/fileUrls';
import { isElectron } from '@/hooks/useEnvironment';
import Link from 'next/link';
import type { FileTabData } from './readers/types';

export default function ReaderFilePicker({ onClose, onOpen, onOpenLocal, openUrls }: {
  onClose: () => void; onOpen: (file: FileTabData) => void; onOpenLocal?: () => void; openUrls: string[];
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [files, setFiles] = useState<FileTabData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  useEffect(() => { dialogRef.current?.showModal(); }, []);
  useEffect(() => {
    let canceled = false;
    setLoading(true); setError('');
    const timer = setTimeout(async () => {
      const local = getLocalLibraryFiles().filter(file => file.name.toLowerCase().includes(search.toLowerCase()));
      const toTab = (file: { name: string; url: string }): FileTabData => {
        const url = normalizeFileUrl(file.url);
        return { id: url, name: file.name, url, type: detectFileType(url) };
      };
      try {
        const token = localStorage.getItem('token');
        const data = await loadLibraryPage(token, { search, page, limit: 24, sortBy: 'name', order: 'asc' });
        if (canceled) return;
        setFiles(data.files.map(toTab)); setPages(data.pagination?.totalPages || 1);
        setError(data.warning || '');
        if (data.pagination?.currentPage && data.pagination.currentPage !== page) setPage(data.pagination.currentPage);
      } catch (err) {
        if (canceled) return;
        setFiles(local.map(toTab)); setPages(1);
        setError(err instanceof Error ? err.message : 'Could not load your library');
      } finally { if (!canceled) setLoading(false); }
    }, 250);
    return () => { canceled = true; clearTimeout(timer); };
  }, [search, page, retry]);

  return <dialog ref={dialogRef} aria-labelledby="reader-picker-title" onCancel={onClose} onClick={event => {
    if (event.target !== event.currentTarget) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) onClose();
  }}
    className="fixed inset-0 m-auto max-h-[85svh] w-[calc(100%-2rem)] max-w-xl overflow-hidden rounded-2xl border border-border-subtle bg-background p-0 text-foreground shadow-2xl backdrop:bg-black/50 backdrop:backdrop-blur-sm">
    <div className="flex max-h-[85svh] flex-col">
      <header className="flex items-center justify-between gap-3 border-b border-border-subtle p-4"><div><h2 id="reader-picker-title" className="font-semibold">Open a document</h2><p className="mt-1 text-xs text-foreground-muted">Choose from your library to add a tab.</p></div><button type="button" onClick={onClose} aria-label="Close document picker" className="mfr-icon-button h-10 w-10"><X size={18}/></button></header>
      <div className="space-y-3 p-4">
        <input autoFocus type="search" value={search} onChange={event => { setSearch(event.target.value); setPage(1); }} placeholder="Search your library…" aria-label="Search library" className="mfr-input" />
        {onOpenLocal && <button type="button" className="mfr-button-secondary w-full" onClick={onOpenLocal}><FolderOpen size={16}/>Open local file</button>}
        {error && <div role="alert" className="text-xs text-foreground">{error} <button type="button" onClick={() => setRetry(value=>value+1)} className="underline">Try again</button></div>}
      </div>
      <div className="min-h-20 overflow-y-auto px-4 pb-4" aria-busy={loading}>
        {loading ? <div role="status" className="flex items-center justify-center gap-2 p-6 text-sm text-foreground-muted"><Loader2 size={18} className="animate-spin"/>Loading library…</div> : files.length ? files.map(file => {
          const unavailable = isLocalFileUrl(file.url) && !isElectron();
          const Icon = file.type === 'epub' ? BookOpen : FileText;
          return <button key={file.id} type="button" disabled={unavailable} onClick={() => onOpen(file)} title={unavailable ? 'Open this file in the desktop app' : file.name}
            className="flex w-full items-center gap-3 rounded-xl p-3 text-left hover:bg-surface-hover disabled:cursor-not-allowed disabled:opacity-50">
            <Icon size={20} className="shrink-0 text-primary"/><span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium">{file.name}</span><span className="text-xs text-foreground-muted">{unavailable ? 'Available in the desktop app' : file.type.toUpperCase()}</span></span><span className="shrink-0 text-xs text-primary">{openUrls.includes(file.url) ? 'Switch to tab' : 'Open'}</span>
          </button>;
        }) : <p className="py-6 text-center text-sm text-foreground-muted">{search ? 'No documents match your search.' : 'Your library is empty.'}</p>}
      </div>
      {pages > 1 && <footer className="flex items-center justify-between border-t border-border-subtle p-3 text-xs"><button type="button" disabled={page<=1 || loading} onClick={()=>setPage(value=>value-1)} className="mfr-button-secondary">Previous</button><span>{page} / {pages}</span><button type="button" disabled={page>=pages || loading} onClick={()=>setPage(value=>value+1)} className="mfr-button-secondary">Next</button></footer>}
      <div className="border-t border-border-subtle px-4 py-3 text-xs text-foreground-muted">Need to add a file? <Link href="/fileupload" className="font-medium text-primary underline">Add files</Link></div>
    </div>
  </dialog>;
}
