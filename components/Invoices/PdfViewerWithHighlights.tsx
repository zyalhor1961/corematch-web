'use client';

import React, { useState, useMemo } from 'react';
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
}

interface PdfViewerProps {
    url: string;
    highlights?: Highlight[];
    metadata?: { pages: PageMetadata[] };
}

export const PdfViewerWithHighlights: React.FC<PdfViewerProps> = ({ url, highlights = [], metadata }) => {
    const [numPages, setNumPages] = useState<number | null>(null);
    const [pageDimensions, setPageDimensions] = useState<{ width: number; height: number } | null>(null);

    function onDocumentLoadSuccess({ numPages }: { numPages: number }) {
        setNumPages(numPages);
    }

    function onPageLoadSuccess(page: any) {
        setPageDimensions({ width: page.width, height: page.height });
    }

    // Filter highlights for the current page (assuming single page view for now or first page)
    const currentPage = 1;
    const pageHighlights = useMemo(() =>
        highlights.filter(h => h.page === currentPage),
        [highlights, currentPage]);

    // Determine ViewBox
    let viewBox = undefined;
    let strokeWidth = 2;
    let fontSize = 12;
    let textOffset = 5;

    // 1. Try to use explicit metadata from backend
    if (metadata?.pages) {
        const pageMeta = metadata.pages.find((p: any) => p.page_number === currentPage);
        if (pageMeta) {
            viewBox = `0 0 ${pageMeta.width} ${pageMeta.height}`;
            // Adjust styling for small units (inches)
            if (pageMeta.width < 50) {
                strokeWidth = 0.02;
                fontSize = 0.15;
                textOffset = 0.1;
            }
        }
    }

    // 2. Fallback Heuristic: If no metadata, check if highlights look like inches (small values) vs pixels
    if (!viewBox && pageDimensions && pageHighlights.length > 0) {
        const maxCoord = Math.max(...pageHighlights.flatMap(h => h.box));
        // If max coordinate is small (e.g. < 50) and page is large (pixels), assume inches
        if (maxCoord < 50 && pageDimensions.width > 100) {
            // Assume standard width of 8.5 inches (Letter)
            // Calculate height based on aspect ratio of the rendered page
            const aspectRatio = pageDimensions.width / pageDimensions.height;
            const assumedWidth = 8.5;
            const assumedHeight = assumedWidth / aspectRatio;
            viewBox = `0 0 ${assumedWidth} ${assumedHeight}`;

            // Adjust styling for inches
            strokeWidth = 0.02;
            fontSize = 0.15;
            textOffset = 0.1;

            console.log("DEBUG: Using Fallback Scaling (Inches)", { assumedWidth, assumedHeight });
        } else {
            // Assume pixels
            viewBox = `0 0 ${pageDimensions.width} ${pageDimensions.height}`;
        }
    } else if (!viewBox && pageDimensions) {
        viewBox = `0 0 ${pageDimensions.width} ${pageDimensions.height}`;
    }

    console.log("DEBUG: PdfViewer Props", { url, highlights, metadata });
    console.log("DEBUG: ViewBox", viewBox);

    return (
        <div className="relative w-full h-full bg-slate-900 overflow-auto flex justify-center p-4">
            <Document
                file={url}
                onLoadSuccess={onDocumentLoadSuccess}
                className="shadow-2xl"
            >
                <div className="relative">
                    <Page
                        pageNumber={currentPage}
                        renderTextLayer={false}
                        renderAnnotationLayer={false}
                        onLoadSuccess={onPageLoadSuccess}
                        width={600} // Fixed width for display, scaling handled via SVG viewBox
                    />

                    {/* SVG Overlay */}
                    {viewBox && (
                        <svg
                            className="absolute inset-0 pointer-events-none"
                            viewBox={viewBox}
                            style={{ width: '100%', height: '100%' }}
                        >
                            {pageHighlights.map((h, i) => {
                                // Convert flat list [x1, y1, x2, y2...] to polygon points string "x1,y1 x2,y2 ..."
                                const points = h.box.reduce((acc, val, idx) => {
                                    return idx % 2 === 0 ? `${acc} ${val}` : `${acc},${val}`;
                                }, "").trim();

                                return (
                                    <g key={i}>
                                        <polygon
                                            points={points}
                                            fill={h.color || "rgba(0, 180, 216, 0.2)"} // Teal transparent
                                            stroke={h.color || "rgba(0, 180, 216, 1)"} // Teal solid
                                            strokeWidth={strokeWidth}
                                        />
                                        {h.label && (
                                            <text
                                                x={h.box[0]}
                                                y={h.box[1] - textOffset}
                                                fill={h.color || "#00b4d8"} // Teal text
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
                </div>
            </Document>
        </div>
    );
};
