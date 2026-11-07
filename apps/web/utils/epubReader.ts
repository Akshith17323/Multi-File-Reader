import ePub, { type Book, type Rendition, type Location } from 'epubjs';

type ResourceInternals = {
    urls: string[];
    replacementUrls: string[];
    cssUrls: string[];
    relativeTo: (url: string) => string[];
};

export function replaceEpubUrls(content: string, urls: string[], replacements: string[]): string {
    const lookup = new Map(urls.map((url, index): [string, string] => [url, replacements[index]]).filter(([url, replacement]) => url && replacement));
    if (!lookup.size) return content;
    const pattern = [...lookup.keys()].sort((a, b) => b.length - a.length).map(url => url.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
    return content.replace(new RegExp(pattern, 'g'), match => lookup.get(match)!);
}

// Load archive assets when their chapter is rendered. EPUB.js normally unzips
// the whole manifest before displaying page one, including unused large images.
export function createReaderBook(): Book {
    const book = ePub();
    const cssUrls: string[] = [];
    const preparing = new Set<Promise<void>>();
    let disposed = false;
    const destroy = book.destroy.bind(book);
    const release = () => {
        cssUrls.forEach(url => URL.revokeObjectURL(url));
        cssUrls.length = 0;
        destroy();
    };
    book.destroy = () => {
        if (disposed) return;
        disposed = true;
        // A chapter may still be unzipping when its tab is closed.
        if (preparing.size) void Promise.allSettled([...preparing]).then(release);
        else release();
    };
    // This is an instance-level compatibility hook for EPUB.js 0.3's private
    // asset preparation step. Keep URL indices even when optional assets fail.
    Object.assign(book, {
        replacements() {
            const resources = book.resources;
            const internals = resources as unknown as ResourceInternals;
            const resourceUrls = [...internals.urls];
            const replacements = resourceUrls.map(() => '');
            internals.replacementUrls = replacements;
            const promises = new Map<number, Promise<string>>();
            const cssFiles = new Set(internals.cssUrls);
            const relativeTo = internals.relativeTo.bind(resources);
            const createUrl = resources.createUrl.bind(resources);
            resources.substitute = (content: string, url?: string) => replaceEpubUrls(content, url ? relativeTo(url) : resourceUrls, replacements);

            async function prepare(content: string, base: string, ancestors: Set<number>): Promise<string> {
                const relativeUrls = relativeTo(base);
                // Asset loading and CSS rewriting recurse through imports.
                // eslint-disable-next-line @typescript-eslint/no-use-before-define, no-use-before-define
                await Promise.all(relativeUrls.map((url, index) => url && content.includes(url) ? loadAsset(index, ancestors) : undefined));
                return replaceEpubUrls(content, relativeUrls, replacements);
            }

            function loadAsset(index: number, ancestors: Set<number>): Promise<string> {
                if (ancestors.has(index)) return Promise.resolve('data:text/css,');
                const cached = promises.get(index);
                if (cached) return cached;
                const promise = (async () => {
                    try {
                        const href = resourceUrls[index];
                        if (cssFiles.has(href)) {
                            const absolute = book.resolve(href);
                            const css = await book.archive.getText(absolute);
                            if (typeof css !== 'string') return 'data:text/css,';
                            const rewritten = await prepare(css, absolute, new Set([...ancestors, index]));
                            const url = URL.createObjectURL(new Blob([rewritten], { type: 'text/css' }));
                            cssUrls.push(url);
                            return url;
                        }
                        return await createUrl(book.resolve(href));
                    } catch { return 'data:application/octet-stream,'; }
                })().then(url => { replacements[index] = url; return url; });
                promises.set(index, promise);
                return promise;
            }

            book.spine.hooks.serialize.register((output: string, section: { url: string; output: string }) => {
                if (disposed) return;
                const task = prepare(output, section.url, new Set()).then(content => { section.output = content; });
                preparing.add(task);
                void task.then(() => preparing.delete(task), () => preparing.delete(task));
                return task;
            });
            return Promise.resolve();
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
        let timer: ReturnType<typeof setTimeout> | undefined = undefined;
        let settled = false;
        // The event handler shares cleanup with the promise callbacks.
        // eslint-disable-next-line @typescript-eslint/no-use-before-define, no-use-before-define
        function fail(error: unknown) { finish(error || new Error('Could not display this chapter')); }
        function finish(error?: unknown) {
            if (settled) return;
            settled = true;
            clearTimeout(timer);
            rendition.off('displayError', fail);
            if (error) reject(error);
            else resolve();
        }
        timer = setTimeout(() => fail(new Error('This chapter took too long to render. Try opening it again.')), 30000);
        rendition.on('displayError', fail);
        try {
            const section = rendition.book.spine.get(target);
            if (!section) { fail(new Error('Could not find this chapter')); return; }
            // Validate/load the target before it enters EPUB.js's display
            // queue. Its manager can leave missing chapters pending forever.
            Promise.resolve(section.load(rendition.book.load.bind(rendition.book)))
                .then(() => settled ? undefined : rendition.display(target)).then(() => finish(), fail);
        }
        catch (error) { fail(error); }
    });
}
