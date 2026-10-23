import ePub, { type Book, type Rendition, type Location } from 'epubjs';

// EPUB.js 0.3 drops failed assets from its replacement array, shifting every
// subsequent image/font URL. Keep a placeholder so damaged optional assets do
// not corrupt otherwise readable chapters. Scope the workaround to this book.
export function createReaderBook(): Book {
    const book = ePub();
    const replace = (book as unknown as { replacements: () => Promise<void> }).replacements.bind(book);
    Object.assign(book, {
        replacements() {
            const resources = book.resources;
            const createUrl = resources.createUrl.bind(resources);
            resources.createUrl = async (url: string) => {
                try { return await createUrl(url); }
                catch { return 'data:application/octet-stream,'; }
            };
            return replace();
        },
    });
    return book;
}

export function epubProgress(book: Book, location: Location): number {
    if (location.atEnd) return 100;
    if (location.atStart) return 0;
    // Chapter/page progress is available immediately. Generating character
    // locations would parse every chapter and contend with page rendering.
    const chapters: number[] = [];
    book.spine.each((section: { linear: boolean; index: number }) => {
        if (section.linear) chapters.push(section.index);
    });
    const chapter = Math.max(0, chapters.indexOf(location.start.index));
    const { page, total } = location.start.displayed;
    return Math.min(100, Math.max(0, (chapter + (page - 1) / Math.max(1, total)) / Math.max(1, chapters.length) * 100));
}

// EPUB.js emits displayError without rejecting display(), so its queue can
// remain pending. Surface the event and provide a finite wait for broken files.
export function displayEpub(rendition: Rendition, target?: string): Promise<void> {
    return new Promise((resolve, reject) => {
        const finish = (error?: unknown) => {
            clearTimeout(timer);
            rendition.off('displayError', fail);
            if (error) reject(error);
            else resolve();
        };
        const fail = (error: unknown) => finish(error || new Error('Could not display this chapter'));
        const timer = setTimeout(() => fail(new Error('This chapter took too long to render. Try opening it again.')), 30000);
        rendition.on('displayError', fail);
        rendition.display(target).then(() => finish(), fail);
    });
}
