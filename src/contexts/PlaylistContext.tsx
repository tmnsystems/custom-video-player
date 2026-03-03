import React, { createContext, useContext, useCallback, useMemo } from 'react';
import { Playlist, Video, PlaybackState } from '@/types/video';
import { useLocalStorage, STORAGE_KEYS } from '@/hooks/useLocalStorage';

interface PlaylistContextType {
  // Playlists
  playlists: Playlist[];
  currentPlaylist: Playlist | null;
  createPlaylist: (name: string, videos: Video[], sourceFileName?: string) => Playlist;
  deletePlaylist: (id: string) => void;
  updatePlaylist: (id: string, updates: Partial<Playlist>) => void;
  setCurrentPlaylist: (playlist: Playlist | null) => void;
  reorderVideos: (fromIndex: number, toIndex: number) => void;

  // Favorites
  favorites: string[];
  toggleFavorite: (videoId: string) => void;
  isFavorite: (videoId: string) => boolean;
  getFavoriteVideos: () => Video[];

  // Playback
  playbackState: PlaybackState;
  setCurrentVideoIndex: (index: number) => void;
  playNext: () => void;
  playPrevious: () => void;
  toggleAutoPlay: () => void;
  setIsPlaying: (isPlaying: boolean) => void;

  // Timer for Brightcove/unknown platforms (in minutes)
  videoDuration: number;
  setVideoDuration: (minutes: number) => void;
}

const PlaylistContext = createContext<PlaylistContextType | undefined>(undefined);

function generateId(): string {
  return Math.random().toString(36).substring(2, 15) + Date.now().toString(36);
}

export function PlaylistProvider({ children }: { children: React.ReactNode }) {
  const [playlists, setPlaylists] = useLocalStorage<Playlist[]>(STORAGE_KEYS.PLAYLISTS, []);
  const [favorites, setFavorites] = useLocalStorage<string[]>(STORAGE_KEYS.FAVORITES, []);
  const [currentPlaylistId, setCurrentPlaylistId] = useLocalStorage<string | null>(STORAGE_KEYS.LAST_PLAYLIST, null);
  const [autoPlayEnabled, setAutoPlayEnabled] = useLocalStorage<boolean>(STORAGE_KEYS.AUTOPLAY, true);
  const [videoDuration, setVideoDurationStorage] = useLocalStorage<number>(STORAGE_KEYS.VIDEO_DURATION, 10); // Default 10 minutes
  const [playbackState, setPlaybackState] = React.useState<PlaybackState>({
    currentVideoIndex: 0,
    isPlaying: false,
    autoPlayEnabled: true,
  });

  // Sync autoplay from localStorage
  React.useEffect(() => {
    setPlaybackState(prev => ({ ...prev, autoPlayEnabled }));
  }, [autoPlayEnabled]);

  const currentPlaylist = useMemo(() => {
    if (!currentPlaylistId) return null;
    return playlists.find(p => p.id === currentPlaylistId) || null;
  }, [playlists, currentPlaylistId]);

  const createPlaylist = useCallback((name: string, videos: Video[], sourceFileName?: string): Playlist => {
    const newPlaylist: Playlist = {
      id: generateId(),
      name,
      videos,
      sourceFileName,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    setPlaylists(prev => [...prev, newPlaylist]);
    setCurrentPlaylistId(newPlaylist.id);
    return newPlaylist;
  }, [setPlaylists, setCurrentPlaylistId]);

  const deletePlaylist = useCallback((id: string) => {
    setPlaylists(prev => prev.filter(p => p.id !== id));
    if (currentPlaylistId === id) {
      setCurrentPlaylistId(null);
    }
  }, [setPlaylists, currentPlaylistId, setCurrentPlaylistId]);

  const updatePlaylist = useCallback((id: string, updates: Partial<Playlist>) => {
    setPlaylists(prev => prev.map(p => 
      p.id === id ? { ...p, ...updates, updatedAt: new Date() } : p
    ));
  }, [setPlaylists]);

  const setCurrentPlaylist = useCallback((playlist: Playlist | null) => {
    setCurrentPlaylistId(playlist?.id || null);
    setPlaybackState(prev => ({ ...prev, currentVideoIndex: 0 }));
  }, [setCurrentPlaylistId]);

  const toggleFavorite = useCallback((videoId: string) => {
    setFavorites(prev => 
      prev.includes(videoId) 
        ? prev.filter(id => id !== videoId)
        : [...prev, videoId]
    );
  }, [setFavorites]);

  const isFavorite = useCallback((videoId: string) => {
    return favorites.includes(videoId);
  }, [favorites]);

  const getFavoriteVideos = useCallback(() => {
    const allVideos = playlists.flatMap(p => p.videos);
    return allVideos.filter(v => favorites.includes(v.id));
  }, [playlists, favorites]);

  const setCurrentVideoIndex = useCallback((index: number) => {
    setPlaybackState(prev => ({ ...prev, currentVideoIndex: index }));
  }, []);

  const playNext = useCallback(() => {
    if (!currentPlaylist) return;
    setPlaybackState(prev => {
      const nextIndex = prev.currentVideoIndex + 1;
      if (nextIndex >= currentPlaylist.videos.length) {
        return { ...prev, isPlaying: false }; // End of playlist
      }
      return { ...prev, currentVideoIndex: nextIndex };
    });
  }, [currentPlaylist]);

  const playPrevious = useCallback(() => {
    setPlaybackState(prev => ({
      ...prev,
      currentVideoIndex: Math.max(0, prev.currentVideoIndex - 1),
    }));
  }, []);

  const toggleAutoPlay = useCallback(() => {
    setAutoPlayEnabled(prev => !prev);
  }, [setAutoPlayEnabled]);

  const setIsPlaying = useCallback((isPlaying: boolean) => {
    setPlaybackState(prev => ({ ...prev, isPlaying }));
  }, []);

  const setVideoDuration = useCallback((minutes: number) => {
    setVideoDurationStorage(minutes);
  }, [setVideoDurationStorage]);

  // Reorder videos within the current playlist
  const reorderVideos = useCallback((fromIndex: number, toIndex: number) => {
    if (!currentPlaylistId) return;
    
    setPlaylists(prev => prev.map(p => {
      if (p.id !== currentPlaylistId) return p;
      
      const videos = [...p.videos];
      const [movedVideo] = videos.splice(fromIndex, 1);
      videos.splice(toIndex, 0, movedVideo);
      
      return { ...p, videos, updatedAt: new Date() };
    }));

    // Adjust current video index if needed
    setPlaybackState(prev => {
      const currentIdx = prev.currentVideoIndex;
      let newIndex = currentIdx;
      
      if (currentIdx === fromIndex) {
        // The current video was moved
        newIndex = toIndex;
      } else if (fromIndex < currentIdx && toIndex >= currentIdx) {
        // Video moved from before current to after - shift down
        newIndex = currentIdx - 1;
      } else if (fromIndex > currentIdx && toIndex <= currentIdx) {
        // Video moved from after current to before - shift up
        newIndex = currentIdx + 1;
      }
      
      return { ...prev, currentVideoIndex: newIndex };
    });
  }, [currentPlaylistId, setPlaylists]);

  const value: PlaylistContextType = {
    playlists,
    currentPlaylist,
    createPlaylist,
    deletePlaylist,
    updatePlaylist,
    setCurrentPlaylist,
    reorderVideos,
    favorites,
    toggleFavorite,
    isFavorite,
    getFavoriteVideos,
    playbackState,
    setCurrentVideoIndex,
    playNext,
    playPrevious,
    toggleAutoPlay,
    setIsPlaying,
    videoDuration,
    setVideoDuration,
  };

  return (
    <PlaylistContext.Provider value={value}>
      {children}
    </PlaylistContext.Provider>
  );
}

export function usePlaylist() {
  const context = useContext(PlaylistContext);
  if (context === undefined) {
    throw new Error('usePlaylist must be used within a PlaylistProvider');
  }
  return context;
}
