import React, { useCallback, useState } from 'react';
import { Upload, FileText, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { parsePDF, PDFParseResult } from '@/lib/pdf-parser';

interface PDFUploaderProps {
  onPDFParsed: (result: PDFParseResult) => void;
  className?: string;
}

export function PDFUploader({ onPDFParsed, className }: PDFUploaderProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFile = useCallback(async (file: File) => {
    if (file.type !== 'application/pdf') {
      setError('Please upload a PDF file');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      console.log('Starting PDF parse for:', file.name);
      const result = await parsePDF(file);
      console.log('PDF parse result:', result);
      if (result.videos.length === 0) {
        setError('No video links found in this PDF. Make sure the PDF contains YouTube, Vimeo, or Brightcove links.');
      } else {
        onPDFParsed(result);
      }
    } catch (err) {
      console.error('Error parsing PDF:', err);
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(`Failed to parse PDF: ${errorMessage}`);
    } finally {
      setIsLoading(false);
    }
  }, [onPDFParsed]);

  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);

    const file = e.dataTransfer.files[0];
    if (file) {
      handleFile(file);
    }
  }, [handleFile]);

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFile(file);
    }
  }, [handleFile]);

  return (
    <div
      className={cn(
        'relative flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-8 transition-all duration-200',
        isDragging 
          ? 'border-primary bg-accent/50' 
          : 'border-muted-foreground/25 hover:border-primary/50 hover:bg-accent/30',
        isLoading && 'pointer-events-none opacity-60',
        className
      )}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
    >
      <input
        type="file"
        accept=".pdf"
        onChange={handleFileInput}
        className="absolute inset-0 cursor-pointer opacity-0"
        disabled={isLoading}
      />

      {isLoading ? (
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Scanning PDF for video links...</p>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-4">
          <div className="rounded-full bg-primary/10 p-4">
            {isDragging ? (
              <FileText className="h-10 w-10 text-primary" />
            ) : (
              <Upload className="h-10 w-10 text-primary" />
            )}
          </div>
          <div className="text-center">
            <p className="text-lg font-medium">
              {isDragging ? 'Drop your PDF here' : 'Upload a PDF'}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Drag and drop or tap to browse
            </p>
          </div>
        </div>
      )}

      {error && (
        <p className="mt-4 text-sm text-destructive">{error}</p>
      )}
    </div>
  );
}
