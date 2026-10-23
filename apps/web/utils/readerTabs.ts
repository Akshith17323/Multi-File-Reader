import type { FileTabData, ReaderViewOptions } from '@/components/readers/types';

export const DEFAULT_READER_OPTIONS: ReaderViewOptions = {
  viewMode: 'single', fitMode: 'width', zoom: 1, fontSize: 100,
};

export function getIndexAfterTabClose(activeIndex: number, closedIndex: number, count: number): number {
  if (count <= 1) return 0;
  if (closedIndex < activeIndex) return activeIndex - 1;
  if (closedIndex === activeIndex) return Math.min(closedIndex, count - 2);
  return activeIndex;
}

export function addReaderTab(files: FileTabData[], file: FileTabData): { files: FileTabData[]; activeIndex: number } {
  const existingIndex = files.findIndex(item => item.url === file.url);
  return existingIndex >= 0 ? { files, activeIndex: existingIndex } : { files: [...files, file], activeIndex: files.length };
}

export function readerTabId(id: string): string { return `reader-tab-${encodeURIComponent(id)}`; }
export function readerPanelId(id: string): string { return `reader-panel-${encodeURIComponent(id)}`; }
