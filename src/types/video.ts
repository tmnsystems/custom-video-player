export interface Video {
  id: string;
  url: string;
  title: string;
  platform: 'brightcove' | 'youtube' | 'vimeo' | 'unknown';
  page: number;
  chapter?: string;
  thumbnailUrl?: string;
  duration?: number;
}

export interface Chapter {
  id: string;
  title: string;
  videos: Video[];
  startPage: number;
  endPage: number;
}

export interface Playlist {
  id: string;
  name: string;
  description?: string;
  videos: Video[];
  createdAt: Date;
  updatedAt: Date;
  sourceFileName?: string;
}

export interface PlaybackState {
  currentVideoIndex: number;
  isPlaying: boolean;
  autoPlayEnabled: boolean;
}

export interface AppState {
  playlists: Playlist[];
  favorites: string[]; // Video IDs
  currentPlaylist: Playlist | null;
  playbackState: PlaybackState;
}
