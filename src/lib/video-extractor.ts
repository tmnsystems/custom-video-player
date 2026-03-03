import { Video } from '@/types/video';

// Video URL patterns for different platforms
const VIDEO_PATTERNS = {
  brightcove: [
    /players\.brightcove\.net\/(\d+)\/[^/]+\/index\.html\?videoId=(\d+)/gi,
    /bcove\.video\/([a-zA-Z0-9]+)/gi,
  ],
  youtube: [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/gi,
  ],
  vimeo: [
    /vimeo\.com\/(?:video\/)?(\d+)/gi,
    /player\.vimeo\.com\/video\/(\d+)/gi,
  ],
};

function generateId(): string {
  return Math.random().toString(36).substring(2, 15);
}

function detectPlatform(url: string): Video['platform'] {
  if (url.includes('brightcove') || url.includes('bcove.video')) {
    return 'brightcove';
  }
  if (url.includes('youtube') || url.includes('youtu.be')) {
    return 'youtube';
  }
  if (url.includes('vimeo')) {
    return 'vimeo';
  }
  return 'unknown';
}

function extractVideoId(url: string, platform: Video['platform']): string | null {
  const patterns = VIDEO_PATTERNS[platform as keyof typeof VIDEO_PATTERNS];
  if (!patterns) return null;

  for (const pattern of patterns) {
    pattern.lastIndex = 0; // Reset regex
    const match = pattern.exec(url);
    if (match) {
      // For Brightcove, the video ID is the last capture group
      return match[match.length - 1];
    }
  }
  return null;
}

function generateThumbnailUrl(url: string, platform: Video['platform']): string | undefined {
  const videoId = extractVideoId(url, platform);
  if (!videoId) return undefined;

  switch (platform) {
    case 'youtube':
      return `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`;
    case 'vimeo':
      // Vimeo requires API call for thumbnails, return undefined for now
      return undefined;
    default:
      return undefined;
  }
}

function generateVideoTitle(url: string, platform: Video['platform'], index: number): string {
  const videoId = extractVideoId(url, platform);
  const platformName = platform.charAt(0).toUpperCase() + platform.slice(1);
  
  if (videoId) {
    return `${platformName} Video ${index + 1}`;
  }
  return `Video ${index + 1}`;
}

// General URL pattern to find any http/https links
const URL_PATTERN = /https?:\/\/[^\s<>"{}|\\^`\[\]]+/gi;

export function extractVideosFromText(text: string, pageNumber: number = 1): Video[] {
  const videos: Video[] = [];
  const seenUrls = new Set<string>();

  // Find all URLs in the text
  const urlMatches = text.match(URL_PATTERN) || [];

  for (const url of urlMatches) {
    // Clean up URL (remove trailing punctuation)
    const cleanUrl = url.replace(/[.,;:!?)]+$/, '');
    
    if (seenUrls.has(cleanUrl)) continue;
    
    const platform = detectPlatform(cleanUrl);
    
    // Check if it's a video URL
    const isVideoUrl = platform !== 'unknown' || 
      cleanUrl.includes('video') || 
      cleanUrl.includes('player') ||
      cleanUrl.includes('embed');

    if (isVideoUrl) {
      seenUrls.add(cleanUrl);
      videos.push({
        id: generateId(),
        url: cleanUrl,
        title: generateVideoTitle(cleanUrl, platform, videos.length),
        platform,
        page: pageNumber,
        thumbnailUrl: generateThumbnailUrl(cleanUrl, platform),
      });
    }
  }

  return videos;
}

// New function that extracts videos from links with their associated text
export function extractVideosFromTextWithTitles(
  links: { url: string; title: string }[], 
  pageNumber: number = 1
): Video[] {
  const videos: Video[] = [];
  const seenUrls = new Set<string>();

  for (const { url, title } of links) {
    // Clean up URL
    const cleanUrl = url.replace(/[.,;:!?)]+$/, '');
    
    if (seenUrls.has(cleanUrl)) continue;
    
    const platform = detectPlatform(cleanUrl);
    
    // Check if it's a video URL
    const isVideoUrl = platform !== 'unknown' || 
      cleanUrl.includes('video') || 
      cleanUrl.includes('player') ||
      cleanUrl.includes('embed');

    if (isVideoUrl) {
      seenUrls.add(cleanUrl);
      
      // Use the link text as title if available, otherwise generate one
      const videoTitle = title && title.length > 0 
        ? title 
        : generateVideoTitle(cleanUrl, platform, videos.length);
      
      videos.push({
        id: generateId(),
        url: cleanUrl,
        title: videoTitle,
        platform,
        page: pageNumber,
        thumbnailUrl: generateThumbnailUrl(cleanUrl, platform),
      });
    }
  }

  return videos;
}

export function groupVideosByChapter(videos: Video[], chapterTitles: string[]): Map<string, Video[]> {
  const chapters = new Map<string, Video[]>();
  
  if (chapterTitles.length === 0) {
    chapters.set('All Videos', videos);
    return chapters;
  }

  // Simple grouping by page ranges
  // This is a basic implementation - could be enhanced with actual PDF chapter detection
  const videosPerChapter = Math.ceil(videos.length / chapterTitles.length);
  
  chapterTitles.forEach((title, index) => {
    const start = index * videosPerChapter;
    const end = Math.min(start + videosPerChapter, videos.length);
    const chapterVideos = videos.slice(start, end);
    if (chapterVideos.length > 0) {
      chapters.set(title, chapterVideos);
    }
  });

  return chapters;
}

// Extract Brightcove player details from URL for in-page embed
export interface BrightcovePlayerInfo {
  accountId: string;
  playerId: string;
  videoId: string;
}

export function extractBrightcoveInfo(url: string): BrightcovePlayerInfo | null {
  // Pattern: players.brightcove.net/{accountId}/{playerId}_default/index.html?videoId={videoId}
  const fullPattern = /players\.brightcove\.net\/(\d+)\/([^/]+)_default\/index\.html\?videoId=(\d+)/i;
  const match = url.match(fullPattern);
  
  if (match) {
    return {
      accountId: match[1],
      playerId: match[2],
      videoId: match[3],
    };
  }
  
  // Alternative pattern without player ID (use 'default')
  const simplePattern = /players\.brightcove\.net\/(\d+)\/[^/]+\/index\.html\?videoId=(\d+)/i;
  const simpleMatch = url.match(simplePattern);
  
  if (simpleMatch) {
    return {
      accountId: simpleMatch[1],
      playerId: 'default',
      videoId: simpleMatch[2],
    };
  }
  
  return null;
}

export function getEmbedUrl(video: Video): string {
  const { url, platform } = video;

  switch (platform) {
    case 'youtube': {
      const videoId = extractVideoId(url, 'youtube');
      if (videoId) {
        return `https://www.youtube.com/embed/${videoId}?autoplay=1&enablejsapi=1`;
      }
      break;
    }
    case 'vimeo': {
      const videoId = extractVideoId(url, 'vimeo');
      if (videoId) {
        return `https://player.vimeo.com/video/${videoId}?autoplay=1`;
      }
      break;
    }
    case 'brightcove': {
      // Brightcove URLs - add autoplay parameters
      // Use autoplay=true and playsinline for better autoplay support
      const separator = url.includes('?') ? '&' : '?';
      const hasAutoplay = url.includes('autoplay');
      if (hasAutoplay) {
        return url;
      }
      return `${url}${separator}autoplay=true&playsinline=true`;
    }
    default:
      return url;
  }

  return url;
}
