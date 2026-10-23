"use client";

import { X, FileText, BookOpen, Code, AlignLeft, FileQuestion } from 'lucide-react';
import { readerTabId, readerPanelId } from '@/utils/readerTabs';
export type { FileTabData } from './readers/types';
import type { FileTabData } from './readers/types';

export default function FileTab({ file, isActive, onClick, onClose }: {
  file: FileTabData; isActive: boolean; onClick: () => void; onClose: () => void;
}) {
  const Icon = file.type === 'pdf' ? FileText : file.type === 'epub' ? BookOpen : file.type === 'code' ? Code : file.type === 'unsupported' ? FileQuestion : AlignLeft;
  return (
    <div title={file.name} className={`group flex w-48 shrink-0 items-center gap-1 rounded-t-xl border border-b-0 px-2 sm:w-56 ${isActive ? 'border-border-subtle bg-background text-foreground' : 'border-transparent text-foreground-muted hover:bg-surface-hover'}`}
      onAuxClick={event => { if (event.button === 1) { event.preventDefault(); onClose(); } }}>
      <button type="button" role="tab" id={readerTabId(file.id)} aria-controls={readerPanelId(file.id)} aria-selected={isActive} tabIndex={isActive ? 0 : -1}
        onClick={onClick} className="flex min-h-11 min-w-0 flex-1 items-center gap-2 rounded-lg px-2 text-left">
        <Icon aria-hidden="true" size={16} className={`shrink-0 ${isActive ? 'text-primary' : ''}`} />
        <span className="truncate text-xs font-medium">{file.name}</span>
      </button>
      <button type="button" aria-label={`Close ${file.name}`} title={`Close ${file.name}`} tabIndex={isActive ? 0 : -1} onClick={onClose}
        className="mfr-icon-button h-8 w-8 hover:text-red-500"><X aria-hidden="true" size={14} /></button>
    </div>
  );
}
