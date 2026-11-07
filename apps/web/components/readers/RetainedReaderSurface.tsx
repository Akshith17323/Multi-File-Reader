"use client";

import { Component, createRef, type ReactNode } from 'react';

interface Props { layoutKey: string; pageNumber: number; children: ReactNode }

// Capture before React removes/reflows pages or PDF.js clears a canvas. Keep
// the previous pixels visible until the requested layout has finished painting.
export default class RetainedReaderSurface extends Component<Props> {
    private root = createRef<HTMLDivElement>();
    private snapshot = createRef<HTMLCanvasElement>();

    getSnapshotBeforeUpdate(previous: Props) {
        if (previous.layoutKey === this.props.layoutKey && previous.pageNumber === this.props.pageNumber) return null;
        const root = this.root.current;
        const snapshot = this.snapshot.current;
        if (!root || !snapshot) return null;
        // Rapid option changes can arrive before the next layout paints.
        if (snapshot.style.display === 'block') return null;
        const bounds = root.getBoundingClientRect();
        if (!bounds.width || !bounds.height) return null;
        // Scrolling updates the bookmark without needing a copy of the page.
        if (previous.layoutKey === this.props.layoutKey) {
            const target = root.querySelector<HTMLCanvasElement>(`[data-pdf-page="${this.props.pageNumber}"] canvas`);
            const page = target?.getBoundingClientRect();
            if (target && target.width && getComputedStyle(target).visibility !== 'hidden' && page && page.bottom > bounds.top && page.top < bounds.bottom) return null;
        }
        snapshot.width = Math.ceil(bounds.width);
        snapshot.height = Math.ceil(bounds.height);
        const context = snapshot.getContext('2d');
        if (!context) return null;
        context.fillStyle = getComputedStyle(document.body).backgroundColor;
        context.fillRect(0, 0, snapshot.width, snapshot.height);
        let painted = false;
        root.querySelectorAll<HTMLCanvasElement>('.react-pdf__Page canvas').forEach(canvas => {
            const page = canvas.getBoundingClientRect();
            if (!canvas.width || getComputedStyle(canvas).visibility === 'hidden' || page.bottom <= bounds.top || page.top >= bounds.bottom) return;
            context.drawImage(canvas, page.left - bounds.left, page.top - bounds.top, page.width, page.height);
            painted = true;
        });
        if (painted) snapshot.style.display = 'block';
        return null;
    }

    componentDidUpdate() { /* The reader releases the snapshot after painting. */ }

    reveal = (layoutKey: string) => {
        if (layoutKey === this.props.layoutKey && this.snapshot.current) this.snapshot.current.style.display = 'none';
    };

    render() {
        return <div ref={this.root} className="relative h-full w-full min-h-0 overflow-hidden">
            {this.props.children}
            <canvas ref={this.snapshot} aria-hidden="true" data-reader-snapshot className="pointer-events-none absolute inset-0 z-10 h-full w-full" style={{ display: 'none' }} />
        </div>;
    }
}
