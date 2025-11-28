'use client';

import React, { useState, useMemo, useCallback } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

// Set worker source
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

interface Highlight {
    box: number[]; // [x1, y1, x2, y2, ...]
    page: number;
    color?: string;
    label?: string;
}

interface PageMetadata {
    page_number: number;
    width: number;
    height: number;
    unit: string;
    angle?: number;
    words?: Array<{ content: string; polygon: number[]; confidence?: number }>;
}

interface PdfViewerProps {
    url: string;
    highlights?: Highlight[];
    metadata?: { pages: PageMetadata[] };
    focusedLabel?: string | null;
    /** Optional render prop for overlays that need to be positioned over the PDF page */
    renderOverlay?: (pageNumber: number, pageDimensions: { width: number; height: number } | null) => React.ReactNode;
}

// Helper to get viewBox and styling for a page
function getPageViewBoxInfo(pageNum: number, metadata?: { pages: PageMetadata[] }, pageDimensions?: { width: number; height: number } | null, highlights?: Highlight[]) {
    let viewBox: string | undefined;
    let strokeWidth = 2;
    let fontSize = 12;
    let textOffset = 5;

    // 1. Try to use explicit metadata from backend
    if (metadata?.pages) {
        const pageMeta = metadata.pages.find((p: PageMetadata) => p.page_number === pageNum);
        if (pageMeta) {
            viewBox = `0 0 ${pageMeta.width} ${pageMeta.height}`;
            if (pageMeta.width < 50) {
                strokeWidth = 0.02;
                fontSize = 0.15;
                textOffset = 0.1;
            }
        }
    }

    // 2. Fallback Heuristic
    const pageHighlights = highlights?.filter(h => h.page === pageNum) || [];
    if (!viewBox && pageDimensions && pageHighlights.length > 0) {
        const maxCoord = Math.max(...pageHighlights.flatMap(h => h.box));
        if (maxCoord < 50 && pageDimensions.width > 100) {
            const aspectRatio = pageDimensions.width / pageDimensions.height;
            const assumedWidth = 8.5;
            const assumedHeight = assumedWidth / aspectRatio;
            viewBox = `0 0 ${assumedWidth} ${assumedHeight}`;
            strokeWidth = 0.02;
            fontSize = 0.15;
            textOffset = 0.1;
        } else {
            viewBox = `0 0 ${pageDimensions.width} ${pageDimensions.height}`;
        }
    } else if (!viewBox && pageDimensions) {
        viewBox = `0 0 ${pageDimensions.width} ${pageDimensions.height}`;
    }

    return { viewBox, strokeWidth, fontSize, textOffset };
}

export const PdfViewerWithHighlights: React.FC<PdfViewerProps> = ({ url, highlights = [], metadata, focusedLabel, renderOverlay }) => {
    const [numPages, setNumPages] = useState<number | null>(null);
    const [pageDimensions, setPageDimensions] = useState<Map<number, { width: number; height: number }>>(new Map());

    function onDocumentLoadSuccess({ numPages }: { numPages: number }) {
        setNumPages(numPages);
    }

    const onPageLoadSuccess = useCallback((pageNum: number) => (page: { width: number; height: number }) => {
        setPageDimensions(prev => {
            const newMap = new Map(prev);
            newMap.set(pageNum, { width: page.width, height: page.height });
            return newMap;
        });
    }, []);

    // Scroll to highlight logic
    const containerRef = React.useRef<HTMLDivElement>(null);

    React.useEffect(() => {
        if (focusedLabel && containerRef.current) {
            const el = containerRef.current.querySelector(`#highlight-${focusedLabel}`);
            if (el) {
                el.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
                const polygon = el.querySelector('polygon');
                if (polygon) {
                    const originalStroke = polygon.getAttribute('stroke');
                    const originalWidth = polygon.getAttribute('stroke-width');
                    polygon.setAttribute('stroke', '#ff0000');
                    polygon.setAttribute('stroke-width', String(Number(originalWidth) * 2));
                    setTimeout(() => {
                        if (originalStroke) polygon.setAttribute('stroke', originalStroke);
                        if (originalWidth) polygon.setAttribute('stroke-width', originalWidth);
                    }, 1000);
                }
            }
        }
    }, [focusedLabel]);

    // Render a single page with its highlights
    const renderPage = (pageNum: number) => {
        const dims = pageDimensions.get(pageNum);
        const pageHighlights = highlights.filter(h => h.page === pageNum);
        const { viewBox, strokeWidth, fontSize, textOffset } = getPageViewBoxInfo(pageNum, metadata, dims, highlights);

        return (
            <div key={pageNum} className="relative inline-block mb-4">
                {/* Page number indicator */}
                <div className="absolute -top-6 left-0 text-xs text-slate-500 font-mono">
                    Page {pageNum} of {numPages}
                </div>

                <Page
                    pageNumber={pageNum}
                    renderTextLayer={false}
                    renderAnnotationLayer={false}
                    onLoadSuccess={onPageLoadSuccess(pageNum)}
                    width={600}
                />

                {/* SVG Overlay for highlights */}
                {viewBox && pageHighlights.length > 0 && (
                    <svg
                        className="absolute inset-0 pointer-events-none"
                        viewBox={viewBox}
                        style={{ width: '100%', height: '100%' }}
                    >
                        {pageHighlights.map((h, i) => {
                            const points = h.box.reduce((acc, val, idx) => {
                                return idx % 2 === 0 ? `${acc} ${val}` : `${acc},${val}`;
                            }, "").trim();

                            return (
                                <g key={i} id={`highlight-${h.label}`}>
                                    <polygon
                                        points={points}
                                        fill={h.color || "rgba(0, 180, 216, 0.2)"}
                                        stroke={h.color || "rgba(0, 180, 216, 1)"}
                                        strokeWidth={strokeWidth}
                                    />
                                    {h.label && (
                                        <text
                                            x={h.box[0]}
                                            y={h.box[1] - textOffset}
                                            fill={h.color || "#00b4d8"}
                                            fontSize={fontSize}
                                            fontWeight="bold"
                                        >
                                            {h.label}
                                        </text>
                                    )}
                                </g>
                            );
                        })}
                    </svg>
                )}

                {/* Custom Overlay for Human-in-the-Loop correction on all pages */}
                {renderOverlay && renderOverlay(pageNum, dims || null)}
            </div>
        );
    };

    return (
        <div ref={containerRef} className="relative w-full h-full bg-slate-900 overflow-auto flex flex-col items-center p-4 pt-8">
            <Document
                file={url}
                onLoadSuccess={onDocumentLoadSuccess}
                className="flex flex-col items-center"
            >
                {numPages && Array.from({ length: numPages }, (_, i) => renderPage(i + 1))}
            </Document>

            {/* Page count indicator at bottom */}
            {numPages && numPages > 1 && (
                <div className="sticky bottom-4 bg-slate-800/90 backdrop-blur-sm text-slate-300 text-xs px-3 py-1.5 rounded-full border border-white/10">
                    {numPages} pages total - scroll to view all
                </div>
            )}
        </div>
    );
};
