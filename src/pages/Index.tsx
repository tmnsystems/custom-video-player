import React, { useState, useCallback } from 'react';
import { PlaylistProvider, usePlaylist } from '@/contexts/PlaylistContext';
import { PDFUploader } from '@/components/PDFUploader';
import { VideoPlayer } from '@/components/VideoPlayer';
import { VideoList } from '@/components/VideoList';
import { PlaylistList } from '@/components/PlaylistList';
import { FavoritesList } from '@/components/FavoritesList';
import { ThemeToggle } from '@/components/ThemeToggle';
import { PDFParseResult } from '@/lib/pdf-parser';
import { 
  ListMusic, 
  Heart, 
  Upload, 
  Menu, 
  Play
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { cn } from '@/lib/utils';

function AppContent() {
  const [showUploader, setShowUploader] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { 
    currentPlaylist, 
    createPlaylist, 
    playbackState,
    playNext,
    playlists 
  } = usePlaylist();

  const handlePDFParsed = useCallback((result: PDFParseResult) => {
    const name = result.fileName.replace('.pdf', '');
    createPlaylist(name, result.videos, result.fileName);
    setShowUploader(false);
  }, [createPlaylist]);

  const currentVideo = currentPlaylist?.videos[playbackState.currentVideoIndex];

  // Show uploader if no playlists
  const shouldShowUploader = playlists.length === 0 || showUploader;

  return (
    <div className="flex h-screen flex-col bg-background">
      {/* Header */}
      <header className="flex h-14 shrink-0 items-center justify-between border-b px-4">
        <div className="flex items-center gap-3">
          <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="lg:hidden">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-80 p-0" aria-describedby={undefined}>
              <div className="sr-only">
                <h2>Navigation Menu</h2>
              </div>
              <SidebarContent onClose={() => setSidebarOpen(false)} />
            </SheetContent>
          </Sheet>
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
              <Play className="h-4 w-4 fill-current text-primary-foreground" />
            </div>
            <span className="text-lg font-semibold">PDF Playlist</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowUploader(true)}
            className="gap-2"
          >
            <Upload className="h-4 w-4" />
            <span className="hidden sm:inline">Upload PDF</span>
          </Button>
          <ThemeToggle />
        </div>
      </header>

      {/* Main Content */}
      <div className="flex min-h-0 flex-1">
        {/* Sidebar - Desktop */}
        <aside className="hidden w-80 shrink-0 border-r lg:block">
          <SidebarContent />
        </aside>

        {/* Main Area */}
        <main className="flex-1 overflow-auto">
          {shouldShowUploader ? (
            <div className="flex h-full flex-col items-center justify-center p-6">
              <div className="w-full max-w-md">
                <h1 className="mb-2 text-center text-2xl font-bold">
                  {playlists.length === 0 ? 'Welcome!' : 'Add a PDF'}
                </h1>
                <p className="mb-6 text-center text-muted-foreground">
                  Upload a PDF with video links to create a playlist
                </p>
                <PDFUploader onPDFParsed={handlePDFParsed} />
                {playlists.length > 0 && (
                  <Button
                    variant="ghost"
                    className="mt-4 w-full"
                    onClick={() => setShowUploader(false)}
                  >
                    Cancel
                  </Button>
                )}
              </div>
            </div>
          ) : currentVideo ? (
            <div className="flex h-full flex-col lg:flex-row">
              {/* Video Player - minimal padding on mobile */}
              <div className="shrink-0 px-2 pt-2 sm:p-4 lg:flex-1 lg:p-6">
                <VideoPlayer 
                  video={currentVideo} 
                  onEnded={playNext}
                  className="mx-auto max-w-4xl"
                />
              </div>

              {/* Video List - Mobile - scrollable, takes remaining space */}
              <div className="min-h-0 flex-1 border-t lg:hidden">
                <div className="h-full overflow-hidden px-2 pb-2 pt-2">
                  <h3 className="mb-2 px-2 text-sm font-semibold">
                    {currentPlaylist?.name} ({currentPlaylist?.videos.length})
                  </h3>
                  <div className="h-[calc(100%-2rem)] overflow-auto rounded-lg border">
                    <VideoList videos={currentPlaylist?.videos || []} />
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex h-full flex-col items-center justify-center p-6 text-center">
              <div className="rounded-full bg-secondary p-6">
                <ListMusic className="h-12 w-12 text-muted-foreground" />
              </div>
              <h2 className="mt-4 text-xl font-semibold">Select a playlist</h2>
              <p className="mt-2 text-muted-foreground">
                Choose a playlist from the sidebar to start watching
              </p>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

function SidebarContent({ onClose }: { onClose?: () => void }) {
  const { currentPlaylist } = usePlaylist();

  return (
    <div className="flex h-full flex-col">
      <Tabs defaultValue="playlists" className="flex h-full flex-col">
        <TabsList className="mx-4 mt-4 grid w-auto grid-cols-2">
          <TabsTrigger value="playlists" className="gap-2">
            <ListMusic className="h-4 w-4" />
            Playlists
          </TabsTrigger>
          <TabsTrigger value="favorites" className="gap-2">
            <Heart className="h-4 w-4" />
            Favorites
          </TabsTrigger>
        </TabsList>

        <TabsContent value="playlists" className="mt-0 flex-1 overflow-hidden">
          <PlaylistList 
            className="h-full" 
            onPlaylistSelect={onClose}
          />
        </TabsContent>

        <TabsContent value="favorites" className="mt-0 flex-1 overflow-hidden">
          <FavoritesList className="h-full" />
        </TabsContent>
      </Tabs>

      {/* Current Playlist Videos */}
      {currentPlaylist && (
        <div className="hidden border-t lg:block">
          <div className="border-b p-4">
            <h3 className="font-semibold">{currentPlaylist.name}</h3>
            <p className="text-sm text-muted-foreground">
              {currentPlaylist.videos.length} videos
            </p>
          </div>
          <div className="h-64">
            <VideoList videos={currentPlaylist.videos} />
          </div>
        </div>
      )}
    </div>
  );
}

export default function Index() {
  return (
    <PlaylistProvider>
      <AppContent />
    </PlaylistProvider>
  );
}
