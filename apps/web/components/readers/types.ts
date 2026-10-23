export type ViewMode = "single" | "continuous" | "two-page";
export type FitMode = "width" | "height" | "none";
export type ReaderStatus = 'loading' | 'ready' | 'error';

export interface ReaderViewOptions {
    viewMode: ViewMode;
    fitMode: FitMode;
    zoom: number;
    fontSize: number;
}

export interface ReaderLocationState {
    pageNumber?: number;
    totalPages?: number;
    cfi?: string;
    progress?: number;
    atStart?: boolean;
    atEnd?: boolean;
}

export interface ReaderHandle {
    next: () => void;
    prev: () => void;
    goToPage?: (page: number) => void;
    goToCfi?: (cfi: string) => void;
    goToLine?: (line: number) => void;
}

export interface FileTabData {
    id: string;
    url: string;
    name: string;
    type: string;
}

export interface BaseReaderProps {
    file: FileTabData;
    isActive: boolean;
    viewOptions: ReaderViewOptions;
    initialLocation?: ReaderLocationState;
    onLocationChange?: (location: ReaderLocationState) => void;
    onStatusChange?: (status: ReaderStatus) => void;
}
