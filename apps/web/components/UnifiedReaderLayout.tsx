"use client";

import { useEffect, useState, type ReactNode } from 'react';
import { ArrowLeft, ChevronLeft, ChevronRight, ZoomIn, ZoomOut, FileText, ScrollText, Columns, ArrowLeftRight, ArrowUpDown, Plus, Search, BookOpen } from 'lucide-react';
import { useRouter } from 'next/navigation';
import ThemeToggle from './ThemeToggle';
import FileTab from './FileTab';
import { readerTabId } from '@/utils/readerTabs';
import type { FileTabData, ViewMode, FitMode, ReaderStatus } from './readers/types';

interface Props {
  children: ReactNode;
  openFiles: FileTabData[]; activeFileIndex: number;
  onTabChange: (index: number) => void; onTabClose: (index: number) => void;
  onAddFile: () => void;
  isSearchOpen: boolean; onToggleSearch: () => void;
  currentPage?: number; totalPages?: number; progress?: number;
  atStart?: boolean; atEnd?: boolean; status: ReaderStatus;
  onNextPage: () => void; onPrevPage: () => void; onGoToPage: (page: number) => void;
  viewMode: ViewMode; onViewModeChange: (mode: ViewMode) => void;
  fitMode: FitMode; onFitModeChange: (mode: FitMode) => void;
  zoom: number; onZoomIn: () => void; onZoomOut: () => void;
  fontSize: number; onFontSizeIncrease: () => void; onFontSizeDecrease: () => void;
}

export default function UnifiedReaderLayout(props: Props) {
  const { children, openFiles, activeFileIndex, onTabChange, onTabClose, onAddFile, status, currentPage, totalPages, progress, viewMode, fitMode, zoom, fontSize } = props;
  const router = useRouter();
  const [pageInput, setPageInput] = useState('');
  const activeFile = openFiles[activeFileIndex];
  const isPdf = activeFile?.type === 'pdf';
  const isEpub = activeFile?.type === 'epub';
  const isText = !!activeFile && !isPdf && !isEpub && activeFile.type !== 'unsupported';
  const ready = status === 'ready';
  useEffect(() => { setPageInput(String(currentPage || 1)); }, [currentPage, activeFile?.id]);
  useEffect(() => {
    const tab = activeFile && document.getElementById(readerTabId(activeFile.id));
    tab?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }, [activeFile]);
  const navigateTab = (index: number) => {
    onTabChange(index);
    document.getElementById(readerTabId(openFiles[index].id))?.focus();
  };
  const iconClass = 'mfr-icon-button h-10 w-10 disabled:cursor-not-allowed disabled:opacity-40';
  const modeClass = (selected: boolean) => `${iconClass} ${selected ? 'bg-primary/15 text-primary' : ''}`;

  return (
    <main aria-label="Document reader" className="flex h-[calc(100svh-var(--titlebar-height))] min-h-0 flex-col overflow-hidden bg-background">
      <header className="flex shrink-0 items-center justify-between gap-3 border-b border-border-subtle bg-surface px-3 py-2 sm:px-5">
        <div className="flex min-w-0 items-center gap-2">
          <button type="button" onClick={() => router.push('/files')} aria-label="Back to library" title="Back to library" className={iconClass}><ArrowLeft size={18} /></button>
          <BookOpen aria-hidden="true" size={18} className="hidden shrink-0 text-primary sm:block" />
          <h1 className="truncate text-sm font-semibold">{activeFile?.name || 'Reader'}</h1>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <ThemeToggle />
          <button type="button" onClick={onAddFile} className="mfr-button-secondary min-h-10 px-3 text-xs" aria-label="Add document"><Plus size={16} /><span className="hidden sm:inline">Add document</span></button>
        </div>
      </header>

      <div className="flex shrink-0 items-end border-b border-border-subtle bg-surface px-2 pt-2">
        <div role="tablist" aria-label="Open documents" aria-orientation="horizontal" className="flex min-w-0 flex-1 overflow-x-auto"
          onKeyDown={event => {
            if (!(event.target as HTMLElement).matches('[role="tab"]')) return;
            let next = activeFileIndex;
            if (event.key === 'ArrowRight') next = (activeFileIndex + 1) % openFiles.length;
            else if (event.key === 'ArrowLeft') next = (activeFileIndex - 1 + openFiles.length) % openFiles.length;
            else if (event.key === 'Home') next = 0;
            else if (event.key === 'End') next = openFiles.length - 1;
            else if (event.key === 'Delete') { event.preventDefault(); onTabClose(activeFileIndex); return; }
            else return;
            event.preventDefault(); event.stopPropagation(); navigateTab(next);
          }}>
          {openFiles.map((file, index) => <FileTab key={file.id} file={file} isActive={index === activeFileIndex} onClick={() => onTabChange(index)} onClose={() => onTabClose(index)} />)}
          {!openFiles.length && <span className="px-3 py-3 text-xs text-foreground-muted">No open documents</span>}
        </div>
        <button type="button" onClick={onAddFile} className={`${iconClass} mb-1 shrink-0`} aria-label="Open another document" title="Open another document"><Plus size={16} /></button>
      </div>

      {activeFile && <div aria-label="Reader controls" className="flex shrink-0 flex-wrap items-center gap-2 border-b border-border-subtle bg-surface px-3 py-2 sm:px-5">
        {(isPdf || isEpub || isText) && <div className="flex items-center gap-1">
          <button type="button" onClick={props.onPrevPage} aria-label="Previous page" title="Previous page" disabled={!ready || props.atStart || (isPdf && (currentPage || 1) <= 1)} className={iconClass}><ChevronLeft size={18} /></button>
          {isPdf ? <form className="flex items-center gap-2 text-xs" onSubmit={event => {
            event.preventDefault(); const page = Number(pageInput);
            if (Number.isInteger(page) && page >= 1 && page <= (totalPages || 0)) props.onGoToPage(page);
            else setPageInput(String(currentPage || 1));
          }}><input type="number" min={1} max={totalPages || 1} value={pageInput} onChange={event => setPageInput(event.target.value)}
            disabled={!ready} aria-label="Page number" className="h-9 w-14 rounded-lg border border-border-subtle bg-background px-2 text-center text-foreground" /><span className="whitespace-nowrap text-foreground-muted">/ {totalPages || '…'}</span><button type="submit" disabled={!ready} className="rounded-lg px-2 py-2 font-medium text-primary disabled:opacity-40">Go</button></form>
            : <span className="min-w-12 text-center text-xs font-medium">{progress === undefined ? '…' : `${Math.round(progress)}%`}</span>}
          <button type="button" onClick={props.onNextPage} aria-label="Next page" title="Next page" disabled={!ready || props.atEnd || (isPdf && !!totalPages && (currentPage || 1) + (viewMode === 'two-page' ? 1 : 0) >= totalPages)} className={iconClass}><ChevronRight size={18} /></button>
        </div>}

        {(isPdf || isEpub) && <div role="group" aria-label="Page layout" className="flex items-center gap-1 rounded-xl border border-border-subtle p-1">
          {([{ mode: 'single', label: 'Single Page', Icon: FileText }, { mode: 'two-page', label: 'Two Page', Icon: Columns }, { mode: 'continuous', label: 'Continuous Scroll', Icon: ScrollText }] as const).map(({mode, label, Icon}) =>
            <button key={mode} type="button" disabled={!ready} aria-label={label} title={label} aria-pressed={viewMode === mode} onClick={() => props.onViewModeChange(mode)} className={modeClass(viewMode === mode)}><Icon size={16} /></button>)}
        </div>}

        {isPdf && <>
          <div role="group" aria-label="Fit document" className="flex items-center gap-1">
            <button type="button" disabled={!ready} title="Fit Width" aria-label="Fit Width" aria-pressed={fitMode === 'width'} onClick={() => props.onFitModeChange('width')} className={modeClass(fitMode === 'width')}><ArrowLeftRight size={16} /></button>
            <button type="button" disabled={!ready} title="Fit Height" aria-label="Fit Height" aria-pressed={fitMode === 'height'} onClick={() => props.onFitModeChange('height')} className={modeClass(fitMode === 'height')}><ArrowUpDown size={16} /></button>
          </div>
          <div role="group" aria-label="Zoom" className="flex items-center">
            <button type="button" disabled={!ready || (fitMode === 'none' && zoom <= .5)} aria-label="Zoom out" onClick={() => { props.onFitModeChange('none'); props.onZoomOut(); }} className={iconClass}><ZoomOut size={16} /></button>
            <span className="min-w-14 text-center text-xs text-foreground-muted">{fitMode === 'none' ? `${Math.round(zoom * 100)}%` : fitMode === 'width' ? 'Width' : 'Height'}</span>
            <button type="button" disabled={!ready || (fitMode === 'none' && zoom >= 2)} aria-label="Zoom in" onClick={() => { props.onFitModeChange('none'); props.onZoomIn(); }} className={iconClass}><ZoomIn size={16} /></button>
          </div>
        </>}
        {(isEpub || isText) && <div role="group" aria-label="Text size" className="flex items-center">
          <button type="button" disabled={!ready || fontSize <= 50} aria-label="Decrease text size" onClick={props.onFontSizeDecrease} className={iconClass}><ZoomOut size={16} /></button>
          <span className="min-w-12 text-center text-xs text-foreground-muted">{fontSize}%</span>
          <button type="button" disabled={!ready || fontSize >= 200} aria-label="Increase text size" onClick={props.onFontSizeIncrease} className={iconClass}><ZoomIn size={16} /></button>
        </div>}
        <button type="button" disabled={!ready || activeFile.type === 'unsupported'} onClick={props.onToggleSearch} aria-label="Search document" title="Search document (⌘/Ctrl+F)" aria-pressed={props.isSearchOpen} className={`${modeClass(props.isSearchOpen)} ml-auto`}><Search size={18} /></button>
      </div>}
      <div className="min-h-0 min-w-0 flex-1">{children}</div>
    </main>
  );
}
