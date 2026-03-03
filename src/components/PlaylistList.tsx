import React from 'react';
import { Playlist } from '@/types/video';
import { usePlaylist } from '@/contexts/PlaylistContext';
import { 
  ListMusic, 
  Trash2, 
  FileText, 
  Clock,
  ChevronRight 
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';
import { formatDistanceToNow } from 'date-fns';

interface PlaylistListProps {
  className?: string;
  onPlaylistSelect?: () => void;
}

export function PlaylistList({ className, onPlaylistSelect }: PlaylistListProps) {
  const { 
    playlists, 
    currentPlaylist, 
    setCurrentPlaylist, 
    deletePlaylist 
  } = usePlaylist();

  if (playlists.length === 0) {
    return (
      <div className={cn('flex flex-col items-center justify-center p-8 text-center', className)}>
        <div className="rounded-full bg-secondary p-4">
          <ListMusic className="h-8 w-8 text-muted-foreground" />
        </div>
        <h3 className="mt-4 text-lg font-medium">No playlists yet</h3>
        <p className="mt-2 text-sm text-muted-foreground">
          Upload a PDF to create your first playlist
        </p>
      </div>
    );
  }

  return (
    <ScrollArea className={cn('h-full', className)}>
      <div className="space-y-2 p-2">
        {playlists.map((playlist) => {
          const isActive = currentPlaylist?.id === playlist.id;
          const createdDate = new Date(playlist.createdAt);

          return (
            <div
              key={playlist.id}
              className={cn(
                'group relative rounded-lg border transition-all',
                isActive 
                  ? 'border-primary bg-accent' 
                  : 'border-transparent hover:border-border hover:bg-secondary/50'
              )}
            >
              <button
                onClick={() => {
                  setCurrentPlaylist(playlist);
                  onPlaylistSelect?.();
                }}
                className="flex w-full items-center gap-3 p-3 text-left"
              >
                {/* Icon */}
                <div className={cn(
                  'flex h-12 w-12 shrink-0 items-center justify-center rounded-lg',
                  isActive ? 'bg-primary text-primary-foreground' : 'bg-secondary'
                )}>
                  <ListMusic className="h-6 w-6" />
                </div>

                {/* Info */}
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{playlist.name}</p>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span>{playlist.videos.length} videos</span>
                    <span>•</span>
                    <span>{formatDistanceToNow(createdDate, { addSuffix: true })}</span>
                  </div>
                  {playlist.sourceFileName && (
                    <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                      <FileText className="h-3 w-3" />
                      <span className="truncate">{playlist.sourceFileName}</span>
                    </div>
                  )}
                </div>

                <ChevronRight className={cn(
                  'h-5 w-5 shrink-0 text-muted-foreground transition-transform',
                  isActive && 'text-primary'
                )} />
              </button>

              {/* Delete button - always visible */}
              <Button
                variant="ghost"
                size="icon"
                onClick={(e) => {
                  e.stopPropagation();
                  if (confirm(`Delete "${playlist.name}"?`)) {
                    deletePlaylist(playlist.id);
                  }
                }}
                className="absolute right-12 top-1/2 h-8 w-8 -translate-y-1/2 text-muted-foreground hover:bg-destructive hover:text-destructive-foreground"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          );
        })}
      </div>
    </ScrollArea>
  );
}
