import React from 'react';
import { Keyboard } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Button } from '@/components/ui/button';

export function KeyboardShortcutsHelp() {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <Keyboard className="h-4 w-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="left" className="max-w-xs">
          <div className="space-y-2 text-sm">
            <p className="font-semibold">Keyboard Shortcuts</p>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1">
              <kbd className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">N</kbd>
              <span>Next video</span>
              <kbd className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">P</kbd>
              <span>Previous video</span>
              <kbd className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">A</kbd>
              <span>Toggle auto-play</span>
            </div>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
