import { useEffect, useRef, useState, useCallback } from 'react';
import ReactPlayer from 'react-player';
import { Video } from '@/types/video';
import { getEmbedUrl, extractBrightcoveInfo } from '@/lib/video-extractor';
import { usePlaylist } from '@/contexts/PlaylistContext';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import { useWorkerTimer } from '@/hooks/useWorkerTimer';
import { KeyboardShortcutsHelp } from '@/components/KeyboardShortcutsHelp';
import { supabase } from '@/integrations/supabase/client';
import { 
  SkipBack, 
  SkipForward, 
  Heart,
  Moon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface VideoPlayerProps {
  video: Video;
  onEnded?: () => void;
  className?: string;
}

// Declare Brightcove player global types
interface BrightcoveCatalog {
  getVideo: (videoId: string, callback: (error: any, video: any) => void) => void;
  load: (video: any) => void;
}

interface BrightcovePlayer {
  ready: (callback: () => void) => void;
  play: () => Promise<void>;
  pause: () => void;
  muted: (muted?: boolean) => boolean;
  duration: () => number;
  on: (event: string, callback: () => void) => void;
  off: (event: string, callback?: () => void) => void;
  one: (event: string, callback: () => void) => void;
  dispose: () => void;
  catalog?: BrightcoveCatalog;
  src: (sources?: any) => any;
}

declare global {
  interface Window {
    bc?: (element: HTMLElement, options?: any) => BrightcovePlayer;
    videojs?: {
      getPlayer: (id: string) => BrightcovePlayer | null;
    };
  }
}

export function VideoPlayer({ video, onEnded, className }: VideoPlayerProps) {
  const [isReady, setIsReady] = useState(false);
  const [showNextPrompt, setShowNextPrompt] = useState(false);
  const [countdown, setCountdown] = useState(5);
  
  // Timer state for Brightcove videos (fallback)
  const [timerSecondsLeft, setTimerSecondsLeft] = useState(0);
  const [timerActive, setTimerActive] = useState(false);
  const durationTimerStartedRef = useRef(false);
  
  // Brightcove player state
  const brightcoveContainerRef = useRef<HTMLDivElement>(null);
  const brightcovePlayerRef = useRef<any>(null);
  const [useBrightcoveSDK, setUseBrightcoveSDK] = useState(false);
  const [brightcoveLoading, setBrightcoveLoading] = useState(false);
  const [fetchedDuration, setFetchedDuration] = useState<number | null>(null);
  
  // Sleep timer state
  const [sleepTimerMinutes, setSleepTimerMinutes] = useState<number | null>(null);
  const [sleepTimerSecondsLeft, setSleepTimerSecondsLeft] = useState(0);
  const sleepTimerRef = useRef<NodeJS.Timeout | null>(null);
  
  const iframeRef = useRef<HTMLIFrameElement>(null);
  
  const { 
    toggleFavorite, 
    isFavorite, 
    playNext, 
    playPrevious, 
    playbackState,
    toggleAutoPlay,
    currentPlaylist,
    setCurrentVideoIndex,
    videoDuration,
    setVideoDuration,
  } = usePlaylist();

  const embedUrl = getEmbedUrl(video);
  const isVideoFavorite = isFavorite(video.id);
  const currentIndex = playbackState.currentVideoIndex;
  const totalVideos = currentPlaylist?.videos.length || 0;
  const hasNext = currentIndex < totalVideos - 1;
  const hasPrevious = currentIndex > 0;

  // Check if react-player can handle this URL (use original URL, not embed)
  const canUseReactPlayer = ReactPlayer.canPlay(video.url);
  const playerUrl = video.url;
  const isBrightcove = video.platform === 'brightcove';

  // Refs to hold latest values for timer callbacks (avoid stale closures)
  const playNextRef = useRef(playNext);
  const hasNextRef = useRef(hasNext);
  const autoPlayEnabledRef = useRef(playbackState.autoPlayEnabled);
  const currentPlaylistRef = useRef(currentPlaylist);
  const handleVideoEndedRef = useRef<() => void>(() => {});
  
  useEffect(() => {
    playNextRef.current = playNext;
    hasNextRef.current = hasNext;
    autoPlayEnabledRef.current = playbackState.autoPlayEnabled;
    currentPlaylistRef.current = currentPlaylist;
  }, [playNext, hasNext, playbackState.autoPlayEnabled, currentPlaylist]);

  // Web Worker timer for countdown (not throttled in background)
  const countdownTimer = useWorkerTimer({
    onTick: (remaining) => {
      console.log('Countdown tick:', remaining);
      setCountdown(remaining);
    },
    onComplete: () => {
      console.log('Web Worker countdown complete - calling playNext()');
      setShowNextPrompt(false);
      playNextRef.current();
    },
  });
  
  // Web Worker timer for video duration (not throttled in background)
  const durationTimer = useWorkerTimer({
    onTick: (remaining) => {
      setTimerSecondsLeft(remaining);
    },
    onComplete: () => {
      console.log('Web Worker duration timer complete - triggering handleVideoEnded');
      setTimerActive(false);
      durationTimerStartedRef.current = false;
      handleVideoEndedRef.current();
    },
  });

  // Handle video ended - triggers auto-play sequence
  const handleVideoEnded = useCallback(() => {
    console.log('Video ended - triggering auto-play sequence');
    console.log('autoPlayEnabled:', autoPlayEnabledRef.current);
    console.log('hasNext:', hasNextRef.current);
    console.log('currentPlaylist:', currentPlaylistRef.current?.name);
    
    // Stop duration timer
    durationTimer.stop();
    setTimerActive(false);
    durationTimerStartedRef.current = false;
    
    onEnded?.();
    
    if (autoPlayEnabledRef.current && hasNextRef.current && currentPlaylistRef.current) {
      console.log('Starting 5s countdown to next video (Web Worker)...');
      setShowNextPrompt(true);
      setCountdown(5);
      countdownTimer.start(5000);
    } else {
      console.log('Conditions not met for auto-advance');
    }
  }, [onEnded, countdownTimer, durationTimer]);

  // Keep handleVideoEndedRef updated
  useEffect(() => {
    handleVideoEndedRef.current = handleVideoEnded;
  }, [handleVideoEnded]);

  const cancelAutoPlay = useCallback(() => {
    setShowNextPrompt(false);
    countdownTimer.stop();
  }, [countdownTimer]);

  const skipToNext = useCallback(() => {
    cancelAutoPlay();
    durationTimer.stop();
    durationTimerStartedRef.current = false;
    setTimerActive(false);
    playNext();
  }, [cancelAutoPlay, playNext, durationTimer]);

  // Keyboard shortcuts - N for next, P for previous, A for auto-play toggle
  useKeyboardShortcuts({
    onNext: () => {
      if (hasNext) {
        toast.info('Skipping to next video...', { duration: 1500 });
        skipToNext();
      }
    },
    onPrevious: () => {
      if (hasPrevious) {
        toast.info('Going to previous video...', { duration: 1500 });
        playPrevious();
      }
    },
    onToggleAutoPlay: () => {
      toggleAutoPlay();
      toast.info(playbackState.autoPlayEnabled ? 'Auto-play disabled' : 'Auto-play enabled', { duration: 1500 });
    },
    enabled: true,
  });

  // Reset UI state when video changes (but DON'T dispose the Brightcove player to keep PiP alive)
  useEffect(() => {
    setShowNextPrompt(false);
    setCountdown(5);
    setTimerActive(false);
    setTimerSecondsLeft(0);
    setFetchedDuration(null);
    durationTimerStartedRef.current = false;
    countdownTimer.stop();
    durationTimer.stop();
  }, [video.id, countdownTimer, durationTimer]);

  // Track the current account/player to know when we need a new player vs just loading new video
  const currentBrightcoveAccountRef = useRef<string | null>(null);
  const currentBrightcovePlayerIdRef = useRef<string | null>(null);
  const playerReadyRef = useRef(false);
  
  // Initialize or reuse Brightcove in-page player
  useEffect(() => {
    const bcInfo = isBrightcove ? extractBrightcoveInfo(video.url) : null;
    
    if (!bcInfo || canUseReactPlayer || !brightcoveContainerRef.current) {
      return;
    }

    const isSamePlayer = 
      currentBrightcoveAccountRef.current === bcInfo.accountId &&
      currentBrightcovePlayerIdRef.current === bcInfo.playerId;

    // If we have an existing player for the same account/player, just load the new video
    if (isSamePlayer && brightcovePlayerRef.current && playerReadyRef.current) {
      console.log('Reusing existing Brightcove player, loading new video:', bcInfo.videoId);
      setIsReady(false);
      setBrightcoveLoading(true);
      
      const player = brightcovePlayerRef.current;
      
      // Use catalog to load the new video (keeps PiP alive!)
      if (player.catalog) {
        player.catalog.getVideo(bcInfo.videoId, (error: any, videoData: any) => {
          if (error) {
            console.error('Error loading video from catalog:', error);
            setBrightcoveLoading(false);
            return;
          }
          
          player.catalog.load(videoData);
          
          // Wait for loadedmetadata to know video is ready
          player.one('loadedmetadata', () => {
            console.log('New video loaded, duration:', player.duration());
            setIsReady(true);
            setBrightcoveLoading(false);
            setFetchedDuration(player.duration());
            
            // Start playback
            player.muted(false);
            player.play().catch((err: any) => {
              console.log('Autoplay blocked:', err);
              toast.info('Click the video to start playback', { duration: 3000 });
            });
          });
        });
      }
      return;
    }

    // Need to create a new player
    console.log('Creating new Brightcove in-page player:', bcInfo);
    setBrightcoveLoading(true);
    setUseBrightcoveSDK(true);
    setIsReady(false);
    playerReadyRef.current = false;

    // Clean up existing player if switching accounts/players
    if (brightcovePlayerRef.current) {
      try {
        brightcovePlayerRef.current.dispose();
      } catch (e) {
        console.log('Error disposing player:', e);
      }
      brightcovePlayerRef.current = null;
    }

    // Clear the container
    brightcoveContainerRef.current.innerHTML = '';
    
    // Update tracking refs
    currentBrightcoveAccountRef.current = bcInfo.accountId;
    currentBrightcovePlayerIdRef.current = bcInfo.playerId;

    // Create video-js element
    const videoElement = document.createElement('video-js');
    videoElement.id = `bc-player-persistent`;
    videoElement.className = 'vjs-fluid';
    videoElement.setAttribute('data-account', bcInfo.accountId);
    videoElement.setAttribute('data-player', bcInfo.playerId);
    videoElement.setAttribute('data-embed', 'default');
    videoElement.setAttribute('data-video-id', bcInfo.videoId);
    videoElement.setAttribute('controls', '');
    videoElement.setAttribute('playsinline', '');
    videoElement.style.width = '100%';
    videoElement.style.height = '100%';
    videoElement.style.position = 'absolute';
    videoElement.style.top = '0';
    videoElement.style.left = '0';

    brightcoveContainerRef.current.appendChild(videoElement);

    // Load Brightcove player script
    const scriptId = `bc-script-${bcInfo.accountId}-${bcInfo.playerId}`;
    let script = document.getElementById(scriptId) as HTMLScriptElement | null;
    
    const initPlayer = () => {
      if (window.bc && window.videojs) {
        try {
          // Initialize the player
          const player = window.bc(videoElement);
          brightcovePlayerRef.current = player;
          
          // Wait for player to be ready
          player.ready(() => {
            console.log('Brightcove player ready - calling play()');
            playerReadyRef.current = true;
            setIsReady(true);
            setBrightcoveLoading(false);
            
            // Get actual duration
            const duration = player.duration();
            if (duration && duration > 0) {
              console.log('Brightcove player duration:', duration);
              setFetchedDuration(duration);
            }
            
            // Listen for duration change
            player.on('durationchange', () => {
              const dur = player.duration();
              if (dur && dur > 0) {
                setFetchedDuration(dur);
              }
            });
            
            // Listen for video end - this persists across video loads
            player.on('ended', () => {
              console.log('Brightcove video ended event');
              handleVideoEndedRef.current();
            });
            
            // AUTO-PLAY: Start playback with sound
            player.muted(false); // Ensure unmuted
            player.play().catch((err: any) => {
              console.log('Autoplay blocked:', err);
              toast.info('Click the video to start playback', { duration: 3000 });
            });
          });
        } catch (err) {
          console.error('Error initializing Brightcove player:', err);
          setBrightcoveLoading(false);
          setUseBrightcoveSDK(false);
        }
      }
    };

    if (!script) {
      script = document.createElement('script');
      script.id = scriptId;
      script.src = `https://players.brightcove.net/${bcInfo.accountId}/${bcInfo.playerId}_default/index.min.js`;
      script.async = true;
      script.onload = initPlayer;
      script.onerror = () => {
        console.error('Failed to load Brightcove script');
        setBrightcoveLoading(false);
        setUseBrightcoveSDK(false);
      };
      document.head.appendChild(script);
    } else {
      // Script already loaded, just init
      initPlayer();
    }

    // Only dispose on unmount, not on video change
    return () => {
      // Don't dispose here - we want to keep the player for PiP
    };
  }, [video.id, video.url, isBrightcove, canUseReactPlayer]);
  
  // Cleanup on component unmount only
  useEffect(() => {
    return () => {
      if (brightcovePlayerRef.current) {
        try {
          brightcovePlayerRef.current.dispose();
        } catch (e) {
          // Ignore
        }
        brightcovePlayerRef.current = null;
        playerReadyRef.current = false;
      }
    };
  }, []);

  // Fetch Brightcove video metadata for accurate duration (fallback for iframe)
  useEffect(() => {
    if (isBrightcove && !canUseReactPlayer && !useBrightcoveSDK) {
      const fetchMetadata = async () => {
        try {
          const { data, error } = await supabase.functions.invoke('brightcove-metadata', {
            body: { url: video.url }
          });
          
          if (data?.duration) {
            console.log('Fetched Brightcove duration:', data.duration);
            setFetchedDuration(data.duration);
          }
        } catch (err) {
          console.log('Could not fetch Brightcove metadata:', err);
        }
      };
      
      fetchMetadata();
    }
  }, [video.url, isBrightcove, canUseReactPlayer, useBrightcoveSDK]);

  // Start duration timer for Brightcove videos when ready (fallback)

  // Start duration timer for Brightcove videos when ready (fallback)
  // Start duration timer for fallback (iframe) videos when ready - uses Web Worker
  useEffect(() => {
    // Only start timer if conditions are met and not already started
    if (!canUseReactPlayer && !useBrightcoveSDK && isReady && autoPlayEnabledRef.current && hasNextRef.current && !durationTimerStartedRef.current) {
      // Use fetched duration if available, otherwise use user setting
      const durationMinutes = fetchedDuration ? Math.ceil(fetchedDuration / 60) : videoDuration;
      const totalSeconds = durationMinutes * 60;
      
      console.log('Starting video duration timer (Web Worker):', totalSeconds, 'seconds');
      setTimerSecondsLeft(totalSeconds);
      setTimerActive(true);
      durationTimerStartedRef.current = true;
      
      // Start Web Worker timer (not throttled in background)
      durationTimer.start(totalSeconds * 1000);
    }
    
    return () => {
      // Cleanup handled by video.id change effect
    };
  }, [canUseReactPlayer, useBrightcoveSDK, isReady, videoDuration, fetchedDuration, durationTimer]);

  // Sleep timer effect
  useEffect(() => {
    if (sleepTimerMinutes !== null && sleepTimerMinutes > 0) {
      const totalSeconds = sleepTimerMinutes * 60;
      setSleepTimerSecondsLeft(totalSeconds);
      
      sleepTimerRef.current = setInterval(() => {
        setSleepTimerSecondsLeft(prev => {
          if (prev <= 1) {
            // Timer expired - pause playback
            if (sleepTimerRef.current) {
              clearInterval(sleepTimerRef.current);
              sleepTimerRef.current = null;
            }
            setSleepTimerMinutes(null);
            
            // Pause the Brightcove player
            if (brightcovePlayerRef.current) {
              brightcovePlayerRef.current.pause();
            }
            
            toast.info('Sleep timer ended - playback paused', { duration: 5000 });
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    
    return () => {
      if (sleepTimerRef.current) {
        clearInterval(sleepTimerRef.current);
        sleepTimerRef.current = null;
      }
    };
  }, [sleepTimerMinutes]);

  // Cancel sleep timer function
  const cancelSleepTimer = useCallback(() => {
    if (sleepTimerRef.current) {
      clearInterval(sleepTimerRef.current);
      sleepTimerRef.current = null;
    }
    setSleepTimerMinutes(null);
    setSleepTimerSecondsLeft(0);
    toast.info('Sleep timer cancelled', { duration: 2000 });
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (sleepTimerRef.current) {
        clearInterval(sleepTimerRef.current);
      }
      if (brightcovePlayerRef.current) {
        try {
          brightcovePlayerRef.current.dispose();
        } catch (e) {
          // Ignore
        }
      }
      // Web Worker timers clean themselves up via the hook
    };
  }, []);

  // Format seconds to mm:ss
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const effectiveDuration = fetchedDuration ? Math.ceil(fetchedDuration / 60) : videoDuration;
  const timerProgress = timerActive ? ((effectiveDuration * 60 - timerSecondsLeft) / (effectiveDuration * 60)) * 100 : 0;

  return (
    <div className={cn('flex flex-col', className)}>
      {/* Video Container */}
      <div className="relative aspect-video w-full overflow-hidden rounded-lg bg-player">
        {!isReady && (
          <div className="absolute inset-0 flex items-center justify-center z-10">
            <div className="h-12 w-12 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          </div>
        )}
        
        {canUseReactPlayer ? (
          <ReactPlayer
            src={playerUrl}
            width="100%"
            height="100%"
            playing={true}
            controls={true}
            onReady={() => setIsReady(true)}
            onEnded={() => {
              console.log('Video ended event fired!');
              handleVideoEnded();
            }}
            style={{ 
              opacity: isReady ? 1 : 0,
              transition: 'opacity 300ms',
            }}
          />
        ) : isBrightcove && extractBrightcoveInfo(video.url) ? (
          // Brightcove in-page embed - allows programmatic play() control
          <div 
            ref={brightcoveContainerRef}
            className={cn(
              'h-full w-full transition-opacity duration-300',
              isReady ? 'opacity-100' : 'opacity-0'
            )}
          />
        ) : (
          // Fallback to iframe for other unsupported platforms
          <iframe
            ref={iframeRef}
            key={video.id}
            src={embedUrl}
            className={cn(
              'h-full w-full transition-opacity duration-300',
              isReady ? 'opacity-100' : 'opacity-0'
            )}
            allow="autoplay; fullscreen; encrypted-media; picture-in-picture"
            allowFullScreen
            onLoad={() => {
              console.log('Iframe loaded for video:', video.title);
              setIsReady(true);
            }}
          />
        )}
      </div>

      {/* Video Info & Controls */}
      <div className="mt-4 space-y-4">
        {/* Title and Favorite */}
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-xl font-semibold">{video.title}</h2>
            <p className="text-sm text-muted-foreground">
              Page {video.page} • {video.platform}
            </p>
          </div>
          <div className="flex items-center gap-1">
            <KeyboardShortcutsHelp />
            <Button
              variant="ghost"
              size="icon"
              onClick={() => toggleFavorite(video.id)}
              className={cn(
                'shrink-0 transition-colors',
                isVideoFavorite && 'text-favorite'
              )}
            >
              <Heart className={cn('h-5 w-5', isVideoFavorite && 'fill-current')} />
            </Button>
          </div>
        </div>

        {/* Playback Controls - Compact for mobile */}
        <div className="flex items-center justify-between rounded-lg bg-secondary/50 p-2 sm:p-3">
          <div className="flex items-center gap-1 sm:gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={playPrevious}
              disabled={!hasPrevious}
              className="h-8 w-8 sm:h-10 sm:w-10"
              title="Previous (P)"
            >
              <SkipBack className="h-4 w-4 sm:h-5 sm:w-5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={playNext}
              disabled={!hasNext}
              className="h-8 w-8 sm:h-10 sm:w-10"
              title="Next (N)"
            >
              <SkipForward className="h-4 w-4 sm:h-5 sm:w-5" />
            </Button>
          </div>

          <div className="flex items-center gap-1 sm:gap-2">
            <span className="text-xs sm:text-sm text-muted-foreground">
              {currentIndex + 1}/{totalVideos}
            </span>
          </div>

          <div className="flex items-center gap-1 sm:gap-2">
            {/* Sleep Timer */}
            {sleepTimerMinutes !== null ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={cancelSleepTimer}
                className="h-8 gap-1 px-2 text-primary"
                title="Cancel sleep timer"
              >
                <Moon className="h-4 w-4" />
                <span className="text-xs font-mono">
                  {Math.floor(sleepTimerSecondsLeft / 60)}:{(sleepTimerSecondsLeft % 60).toString().padStart(2, '0')}
                </span>
              </Button>
            ) : (
              <select
                value=""
                onChange={(e) => {
                  const mins = Number(e.target.value);
                  if (mins > 0) {
                    setSleepTimerMinutes(mins);
                    toast.info(`Sleep timer set for ${mins} minutes`, { duration: 2000 });
                  }
                }}
                className="h-8 w-16 rounded-md border border-border bg-background px-1 text-xs"
                title="Set sleep timer"
              >
                <option value="">💤</option>
                <option value="15">15m</option>
                <option value="30">30m</option>
                <option value="45">45m</option>
                <option value="60">1hr</option>
                <option value="90">1.5h</option>
                <option value="120">2hr</option>
              </select>
            )}
            
            <Switch
              id="autoplay-toggle"
              checked={playbackState.autoPlayEnabled}
              onCheckedChange={toggleAutoPlay}
              className="scale-90 sm:scale-100"
            />
            <Label 
              htmlFor="autoplay-toggle" 
              className={cn(
                "text-xs sm:text-sm font-medium cursor-pointer hidden sm:inline",
                playbackState.autoPlayEnabled ? "text-primary" : "text-muted-foreground"
              )}
              title="Toggle auto-play (A)"
            >
              Auto
            </Label>
          </div>
        </div>

        {/* Auto-play Next Prompt */}
        {showNextPrompt && hasNext && currentPlaylist && (
          <div className="rounded-lg border-2 border-primary bg-primary/10 p-4 animate-in fade-in slide-in-from-bottom-2">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
                  <span className="text-lg font-bold">{countdown}</span>
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-primary">Playing next in {countdown}s</p>
                  <p className="truncate text-sm">
                    {currentPlaylist.videos[currentIndex + 1]?.title}
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={cancelAutoPlay}>
                  Cancel
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
