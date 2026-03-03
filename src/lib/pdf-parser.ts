import * as pdfjsLib from 'pdfjs-dist';
import { Video } from '@/types/video';
import { extractVideosFromTextWithTitles } from './video-extractor';

// Set up the worker using legacy build for better compatibility
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).toString();

export interface PDFParseResult {
  videos: Video[];
  pageCount: number;
  fileName: string;
}

export async function parsePDF(file: File): Promise<PDFParseResult> {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  
  const allVideos: Video[] = [];
  const seenUrls = new Set<string>();

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const textContent = await page.getTextContent();
    
    // Build a map of text by position for later matching with links
    const textItems = textContent.items as any[];
    
    // Extract annotations (clickable links) with their link text
    const annotations = await page.getAnnotations();
    const linksWithText: { url: string; title: string }[] = [];
    
    for (const annotation of annotations) {
      if (!annotation.url) continue;
      
      // Try to find the link text by looking at text items near the annotation rect
      let linkText = '';
      
      if (annotation.rect) {
        const [x1, y1, x2, y2] = annotation.rect;
        const annotationHeight = y2 - y1;
        const annotationWidth = x2 - x1;
        
        // Find text items that overlap or are near the annotation
        // Use a more generous tolerance to catch text that's slightly offset
        const matchingTexts = textItems
          .filter((item: any) => {
            if (!item.transform) return false;
            const itemX = item.transform[4];
            const itemY = item.transform[5];
            const itemWidth = item.width || 100; // Estimate if not available
            
            // Check if text overlaps horizontally with the annotation
            const horizontalOverlap = itemX < x2 + 20 && (itemX + itemWidth) > x1 - 20;
            // Check if text is on the same line (within vertical bounds + tolerance)
            const verticalMatch = itemY >= y1 - annotationHeight - 5 && itemY <= y2 + 10;
            
            return horizontalOverlap && verticalMatch;
          })
          .sort((a: any, b: any) => {
            // Sort by X position to get text in reading order
            return a.transform[4] - b.transform[4];
          });
        
        linkText = matchingTexts.map((item: any) => item.str).join(' ').trim();
        
        // Clean up extra spaces
        linkText = linkText.replace(/\s+/g, ' ');
      }
      
      // If we couldn't find link text from position, try to find it from contents
      if (!linkText && annotation.contents) {
        linkText = annotation.contents;
      }
      
      // If still no text, try to find the closest text item on the same line
      if (!linkText && annotation.rect) {
        const [x1, y1, x2, y2] = annotation.rect;
        const centerY = (y1 + y2) / 2;
        
        // Find text on the same horizontal line, sorted by distance from the link
        const nearbyText = textItems
          .filter((item: any) => {
            if (!item.transform || !item.str?.trim()) return false;
            const itemY = item.transform[5];
            // Must be on roughly the same line
            return Math.abs(itemY - centerY) < 15;
          })
          .sort((a: any, b: any) => {
            // Sort by distance from the annotation
            const distA = Math.abs(a.transform[4] - x1);
            const distB = Math.abs(b.transform[4] - x1);
            return distA - distB;
          });
        
        // Take the closest text that seems like a title (not just punctuation)
        for (const item of nearbyText) {
          const text = item.str.trim();
          if (text.length > 2 && !/^[\d.,;:!?]+$/.test(text)) {
            linkText = text;
            break;
          }
        }
      }
      
      linksWithText.push({
        url: annotation.url,
        title: linkText || '',
      });
    }
    
    const pageVideos = extractVideosFromTextWithTitles(linksWithText, pageNum);
    
    // Deduplicate across pages
    for (const video of pageVideos) {
      if (!seenUrls.has(video.url)) {
        seenUrls.add(video.url);
        allVideos.push(video);
      }
    }
  }

  return {
    videos: allVideos,
    pageCount: pdf.numPages,
    fileName: file.name,
  };
}

export function formatPageRange(videos: Video[]): string {
  if (videos.length === 0) return '';
  
  const pages = [...new Set(videos.map(v => v.page))].sort((a, b) => a - b);
  
  if (pages.length === 1) {
    return `Page ${pages[0]}`;
  }
  
  return `Pages ${pages[0]}-${pages[pages.length - 1]}`;
}
