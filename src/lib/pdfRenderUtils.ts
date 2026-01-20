/**
 * Unified PDF Rendering Utilities
 * 
 * This module provides a single source of truth for coordinate conversion
 * and text rendering in PDFs. All PDF generation components should use these
 * utilities to ensure WYSIWYG consistency between the editor and final PDF.
 * 
 * Coordinate System:
 * - Editor: Top-left origin (0,0), Y increases downward, coordinates are normalized 0-1
 * - PDF (pdf-lib): Bottom-left origin (0,0), Y increases upward, coordinates are in points
 * 
 * The key principle is that the field's TOP-LEFT corner position is what we store
 * and what we convert. The text baseline is then calculated from the top of the field box.
 */

import { PDFFont, PDFPage, rgb, Color } from "pdf-lib";

export interface FieldCoordinates {
  x: number;      // Normalized 0-1 (relative to page width)
  y: number;      // Normalized 0-1 (relative to page height, from TOP)
  width?: number; // Normalized 0-1
  height?: number;// Normalized 0-1
}

export interface RenderFieldOptions {
  value: string;
  fontSize: number;
  font: PDFFont;
  page: PDFPage;
  coords: FieldCoordinates;
  align?: "left" | "center" | "right";
  textColor?: Color;
}

/**
 * Convert normalized coordinates (0-1, top-origin) to PDF points (bottom-origin)
 * 
 * @param coords - Normalized coordinates from the editor
 * @param pageWidth - PDF page width in points
 * @param pageHeight - PDF page height in points
 * @returns Coordinates in PDF points
 */
export function normalizedToPdfPoints(
  coords: FieldCoordinates,
  pageWidth: number,
  pageHeight: number
): { x_pt: number; y_pt: number; width_pt: number; height_pt: number } {
  const x_pt = coords.x * pageWidth;
  const width_pt = (coords.width || 0.1) * pageWidth;
  const height_pt = (coords.height || 0.03) * pageHeight;
  
  // Convert Y from top-origin to bottom-origin
  // The stored y is the TOP of the field box in normalized coordinates
  // We need to find where the TOP of the box is in PDF coordinates
  const y_top_from_top = coords.y * pageHeight;
  const y_top_from_bottom = pageHeight - y_top_from_top;
  
  // The field box starts at y_top_from_bottom (in PDF coords, this is the TOP of our box)
  // But since PDF coords go from bottom, the top of our box is at this y value
  // and the bottom of our box is at (y_top_from_bottom - height_pt)
  
  return {
    x_pt,
    y_pt: y_top_from_bottom, // This is the TOP of the field box in PDF coordinates
    width_pt,
    height_pt,
  };
}

/**
 * Calculate the text baseline position within a field box
 * 
 * The text baseline should be positioned so the text appears
 * at the top of the field box (with a small padding)
 * 
 * @param fieldTopY - The top of the field box in PDF coordinates
 * @param fontSize - Font size in points
 * @param paddingTop - Padding from top of field box (default 2pt)
 * @returns Y position for text baseline in PDF coordinates
 */
export function calculateTextBaseline(
  fieldTopY: number,
  fontSize: number,
  paddingTop: number = 0
): number {
  // In PDF, text is drawn from its baseline
  // To position text at the top of a box, we need to subtract the ascender
  // A rough approximation: baseline = top - ascender, where ascender ≈ 0.8 * fontSize
  // But for simplicity and alignment with editor preview, we use:
  // baseline = fieldTopY - fontSize (puts the top of the text near the top of the box)
  return fieldTopY - fontSize - paddingTop;
}

/**
 * Wrap text into lines that fit within a maximum width
 */
export function wrapText(
  text: string,
  font: PDFFont,
  fontSize: number,
  maxWidth: number
): string[] {
  const words = text.split(" ");
  const lines: string[] = [];
  let currentLine = "";

  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    const testWidth = font.widthOfTextAtSize(testLine, fontSize);

    if (testWidth > maxWidth && currentLine) {
      lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = testLine;
    }
  }
  if (currentLine) {
    lines.push(currentLine);
  }
  return lines;
}

/**
 * Render a field value onto a PDF page
 * 
 * This is the unified rendering function that should be used by all
 * PDF generation code to ensure consistent positioning.
 */
export function renderFieldToPdf(options: RenderFieldOptions): void {
  const { value, fontSize, font, page, coords, align = "left", textColor = rgb(0, 0, 0) } = options;
  
  if (!value) return;
  
  const { width: pageWidth, height: pageHeight } = page.getSize();
  const pdfCoords = normalizedToPdfPoints(coords, pageWidth, pageHeight);
  
  const { x_pt, y_pt, width_pt, height_pt } = pdfCoords;
  
  // Calculate line height and max lines
  const lineHeight = fontSize * 1.3;
  const maxLines = Math.max(1, Math.floor(height_pt / lineHeight));
  const isMultiline = maxLines > 1;
  
  // Calculate baseline for first line (from top of field box)
  const firstLineBaseline = calculateTextBaseline(y_pt, fontSize);
  
  if (isMultiline) {
    const lines = wrapText(value, font, fontSize, width_pt - 4);
    const linesToDraw = lines.slice(0, maxLines);
    
    for (let i = 0; i < linesToDraw.length; i++) {
      const lineY = firstLineBaseline - (i * lineHeight);
      const lineWidth = font.widthOfTextAtSize(linesToDraw[i], fontSize);
      
      let lineX = x_pt;
      if (align === "center") {
        lineX = x_pt + (width_pt - lineWidth) / 2;
      } else if (align === "right") {
        lineX = x_pt + width_pt - lineWidth;
      }
      
      // Clamp to page bounds
      lineX = Math.max(2, Math.min(lineX, pageWidth - lineWidth - 2));
      const clampedY = Math.max(2, Math.min(lineY, pageHeight - fontSize - 2));
      
      page.drawText(linesToDraw[i], {
        x: lineX,
        y: clampedY,
        size: fontSize,
        font,
        color: textColor,
      });
    }
  } else {
    const textWidth = font.widthOfTextAtSize(value, fontSize);
    
    let finalX = x_pt;
    if (align === "center") {
      finalX = x_pt + (width_pt - textWidth) / 2;
    } else if (align === "right") {
      finalX = x_pt + width_pt - textWidth;
    }
    
    // Clamp to page bounds
    finalX = Math.max(2, Math.min(finalX, pageWidth - textWidth - 2));
    const finalY = Math.max(2, Math.min(firstLineBaseline, pageHeight - fontSize - 2));
    
    page.drawText(value, {
      x: finalX,
      y: finalY,
      size: fontSize,
      font,
      color: textColor,
    });
  }
}

/**
 * Apply text transformation
 */
export function applyTextTransform(value: string, transform: string): string {
  switch (transform) {
    case "uppercase":
      return value.toUpperCase();
    case "lowercase":
      return value.toLowerCase();
    case "capitalize":
      return value.replace(/\b\w/g, (c) => c.toUpperCase());
    default:
      return value;
  }
}
