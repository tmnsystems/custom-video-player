import React from 'react';
import { usePlaylist } from '@/contexts/PlaylistContext';
import { VideoList } from './VideoList';
import { Heart } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FavoritesListProps {
  className?: string;
}

export function FavoritesList({ className }: FavoritesListProps) {
  const { getFavoriteVideos, currentPlaylist, setCurrentVideoIndex } = usePlaylist();
  const favoriteVideos = getFavoriteVideos();

  if (favoriteVideos.length === 0) {
    return (
      <div className={cn('flex flex-col items-center justify-center p-8 text-center', className)}>
        <div className="rounded-full bg-secondary p-4">
          <Heart className="h-8 w-8 text-muted-foreground" />
        </div>
        <h3 className="mt-4 text-lg font-medium">No favorites yet</h3>
        <p className="mt-2 text-sm text-muted-foreground">
          Tap the heart icon on any video to add it to your favorites
        </p>
      </div>
    );
  }

  return (
    <div className={cn('h-full', className)}>
      <div className="border-b p-4">
        <h2 className="text-lg font-semibold">Favorites</h2>
        <p className="text-sm text-muted-foreground">
          {favoriteVideos.length} video{favoriteVideos.length !== 1 ? 's' : ''}
        </p>
      </div>
      <VideoList videos={favoriteVideos} />
    </div>
  );
}
