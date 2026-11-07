"use client";

import { useEffect, useRef, useState } from 'react';
import { FileText, Book, Loader2 } from 'lucide-react';
import { detectFileType, getDocumentUrl, isLocalFileUrl } from '@/utils/fileUrls';
import { isElectron } from '@/hooks/useEnvironment';

type Preview = { image?: string; text?: string };
const previews = new Map<string, Preview>();

interface FilePreviewProps { url?: string; type: string; thumbnailUrl?: string | null }

function DocumentPreview({ url, type, thumbnailUrl }: FilePreviewProps) {
  const container = useRef<HTMLDivElement>(null);
  const cacheKey = `${url}:${type}`;
  const [preview, setPreview] = useState<Preview | undefined>(() => previews.get(cacheKey));
  const [imageFailed, setImageFailed] = useState(false);
  const [visible, setVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [unavailable, setUnavailable] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) { setVisible(true); observer.disconnect(); }
    }, { rootMargin: '200px' });
    if (container.current) observer.observe(container.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (unavailable || !visible || preview || !url || (thumbnailUrl && !imageFailed)) return;
    if (isLocalFileUrl(url) && !isElectron()) return;
    let canceled = false;
    let cleanup: (() => void) | undefined;
    const controller = new AbortController();
    setLoading(true);
    const generate = async (): Promise<Preview> => {
      const format = detectFileType(type) === 'unsupported' ? detectFileType(url) : detectFileType(type);
      if (format === 'pdf') {
        const { pdfjs } = await import('react-pdf');
        if (canceled) return {};
        pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString();
        const task = pdfjs.getDocument(getDocumentUrl(url));
        cleanup = () => { void task.destroy(); };
        const pdf = await task.promise;
        if (canceled) return {};
        const page = await pdf.getPage(1);
        const viewport = page.getViewport({ scale: 480 / page.getViewport({ scale: 1 }).width });
        const canvas = document.createElement('canvas');
        canvas.width = Math.ceil(viewport.width); canvas.height = Math.ceil(viewport.height);
        const context = canvas.getContext('2d');
        if (!context) throw new Error('Preview unavailable');
        await page.render({ canvas, canvasContext: context, viewport }).promise;
        return { image: canvas.toDataURL('image/webp', .85) };
      }
      const response = await fetch(getDocumentUrl(url), { signal: controller.signal });
      if (!response.ok) throw new Error('File unavailable');
      if (format === 'epub') {
        const { default: ePub } = await import('epubjs');
        if (canceled) return {};
        const book = ePub();
        cleanup = () => { book.destroy(); };
        await book.open(await response.arrayBuffer(), 'binary');
        if (canceled) return {};
        const cover = await book.coverUrl();
        if (cover) {
          const blob = await (await fetch(cover, { signal: controller.signal })).blob();
          const image = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(String(reader.result)); reader.onerror = reject; reader.readAsDataURL(blob);
          });
          return { image };
        }
        const section = book.spine.get(0);
        if (section) {
          await section.load(book.load.bind(book));
          return { text: section.document?.documentElement.textContent?.trim().slice(0, 2000) || book.packaging.metadata.title };
        }
        return { text: book.packaging.metadata.title };
      }
      // Only a short excerpt is needed, even for a large text document.
      const reader = response.body?.getReader();
      if (!reader) return { text: (await response.text()).slice(0, 2000) };
      const decoder = new TextDecoder();
      let text = '';
      try {
        while (text.length < 2000) {
          const chunk = await reader.read();
          if (chunk.done) break;
          text += decoder.decode(chunk.value, { stream: true });
        }
      } finally { await reader.cancel(); }
      return { text: text.slice(0, 2000) || 'Empty document' };
    };
    void generate().then(result => {
      if (canceled) return;
      if (previews.size >= 64) previews.delete(previews.keys().next().value!);
      previews.set(cacheKey, result); setPreview(result);
    }).catch(() => { if (!canceled) setUnavailable(true); }).finally(() => {
      cleanup?.(); cleanup = undefined;
      if (!canceled) setLoading(false);
    });
    return () => { canceled = true; controller.abort(); cleanup?.(); cleanup = undefined; };
  }, [visible, url, type, thumbnailUrl, imageFailed, preview, cacheKey, unavailable]);

  const image = !imageFailed && thumbnailUrl ? thumbnailUrl : preview?.image;
  return <div ref={container} className="relative flex h-full w-full items-center justify-center overflow-hidden bg-surface-hover/50">
    {image ? (
      // Runtime document previews may use data URLs and the desktop's local protocol.
      // eslint-disable-next-line @next/next/no-img-element
      <img src={image} alt="Document preview" className="h-full w-full object-contain object-top" onError={() => { setImageFailed(true); if (preview?.image) { setPreview(undefined); previews.delete(cacheKey); setUnavailable(true); } }} />
    ) : preview?.text ? <div className="h-full w-full overflow-hidden bg-background px-5 pb-5 pt-12 text-left"><p className="whitespace-pre-wrap break-words font-serif text-xs leading-relaxed text-foreground/80">{preview.text}</p></div>
      : <div className="flex flex-col items-center gap-3 p-6 text-center text-foreground-muted">
        {loading ? <Loader2 size={28} className="animate-spin text-primary" /> : type === 'application/epub+zip' ? <Book size={36} /> : <FileText size={36} />}
        <span className="text-xs">{loading ? 'Loading preview…' : isLocalFileUrl(url || '') && !isElectron() ? 'Preview in desktop app' : unavailable ? 'Preview unavailable' : 'Document preview'}</span>
      </div>}
  </div>;
}

export default function FilePreview(props: FilePreviewProps) {
  // A new URL or thumbnail resets failed images and any pending preview work.
  return <DocumentPreview key={`${props.url}:${props.thumbnailUrl}`} {...props} />;
}
