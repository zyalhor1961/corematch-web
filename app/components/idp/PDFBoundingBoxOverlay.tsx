'use client';

/**
 * PDF Bounding Box Overlay
 *
 * Renders interactive bounding boxes over PDF pages
 * with synchronized highlighting on hover
 */

import React from 'react';

interface BoundingBox {
  fieldId: string;
  polygon: number[]; // [x1, y1, x2, y2, x3, y3, x4, y4] or [x1, y1, x2, y2]
  color: string;
  label: string;
}

interface PDFBoundingBoxOverlayProps {
  boundingBoxes: BoundingBox[];
  hoveredFieldId: string | null;
  onFieldHover: (fieldId: string | null) => void;
  scale: number;
  pageWidth: number;
  pageHeight: number;
}

export const PDFBoundingBoxOverlay: React.FC<PDFBoundingBoxOverlayProps> = ({
  boundingBoxes,
  hoveredFieldId,
  onFieldHover,
  scale,
  pageWidth,
  pageHeight
}) => {
  // Convert polygon points to rectangle for rendering
  const getRectFromPolygon = (polygon: number[]) => {
    if (polygon.length === 4) {
      // Simple rectangle [x1, y1, x2, y2]
      return {
        x: polygon[0] * scale,
        y: polygon[1] * scale,
        width: (polygon[2] - polygon[0]) * scale,
        height: (polygon[3] - polygon[1]) * scale
      };
    } else if (polygon.length === 8) {
      // Polygon [x1, y1, x2, y2, x3, y3, x4, y4]
      const xCoords = [polygon[0], polygon[2], polygon[4], polygon[6]];
      const yCoords = [polygon[1], polygon[3], polygon[5], polygon[7]];
      const minX = Math.min(...xCoords);
      const minY = Math.min(...yCoords);
      const maxX = Math.max(...xCoords);
      const maxY = Math.max(...yCoords);

      return {
        x: minX * scale,
        y: minY * scale,
        width: (maxX - minX) * scale,
        height: (maxY - minY) * scale
      };
    }

    return null;
  };

  return (
    <div
      className="absolute inset-0 pointer-events-none"
      style={{
        width: pageWidth * scale,
        height: pageHeight * scale
      }}
    >
      {boundingBoxes.map((bbox) => {
        const rect = getRectFromPolygon(bbox.polygon);
        if (!rect) return null;

        const isHovered = hoveredFieldId === bbox.fieldId;

        return (
          <div
            key={bbox.fieldId}
            className="absolute pointer-events-auto cursor-pointer transition-all duration-200"
            style={{
              left: `${rect.x}px`,
              top: `${rect.y}px`,
              width: `${rect.width}px`,
              height: `${rect.height}px`,
              border: `2px solid ${bbox.color}`,
              backgroundColor: isHovered ? `${bbox.color}30` : `${bbox.color}10`,
              boxShadow: isHovered ? `0 0 12px ${bbox.color}80` : 'none',
              zIndex: isHovered ? 10 : 1
            }}
            onMouseEnter={() => onFieldHover(bbox.fieldId)}
            onMouseLeave={() => onFieldHover(null)}
          >
            {/* Label tooltip on hover */}
            {isHovered && (
              <div
                className="absolute -top-8 left-0 px-2 py-1 rounded text-xs font-medium whitespace-nowrap shadow-lg z-20"
                style={{
                  backgroundColor: bbox.color,
                  color: 'white'
                }}
              >
                {bbox.label}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

// Helper function to generate unique color for each field
export const getFieldColor = (index: number): string => {
  const hue = (index * 137.5) % 360; // Golden angle for good color distribution
  return `hsl(${hue}, 70%, 55%)`;
};
