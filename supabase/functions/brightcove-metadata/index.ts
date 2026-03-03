import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface BrightcoveVideoInfo {
  accountId: string;
  videoId: string;
}

// Parse Brightcove URL to extract account ID and video ID
function parseBrightcoveUrl(url: string): BrightcoveVideoInfo | null {
  // Pattern: players.brightcove.net/{accountId}/{playerId}/index.html?videoId={videoId}
  const match = url.match(/players\.brightcove\.net\/(\d+)\/[^/]+\/index\.html\?videoId=(\d+)/i);
  if (match) {
    return { accountId: match[1], videoId: match[2] };
  }
  return null;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { url } = await req.json();
    
    if (!url) {
      return new Response(
        JSON.stringify({ error: 'URL is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const videoInfo = parseBrightcoveUrl(url);
    
    if (!videoInfo) {
      return new Response(
        JSON.stringify({ error: 'Invalid Brightcove URL', url }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Try to get video metadata via oEmbed (no API key required)
    // Brightcove oEmbed endpoint
    const oembedUrl = `https://players.brightcove.net/${videoInfo.accountId}/default_default/index.html?videoId=${videoInfo.videoId}`;
    const oembedApiUrl = `https://noembed.com/embed?url=${encodeURIComponent(oembedUrl)}`;
    
    console.log(`Fetching oEmbed for: ${oembedUrl}`);
    
    try {
      const oembedResponse = await fetch(oembedApiUrl);
      const oembedData = await oembedResponse.json();
      
      console.log('oEmbed response:', oembedData);
      
      // noembed might not have duration, but we can return what we have
      return new Response(
        JSON.stringify({
          success: true,
          accountId: videoInfo.accountId,
          videoId: videoInfo.videoId,
          title: oembedData.title || null,
          duration: oembedData.duration || null,
          thumbnail: oembedData.thumbnail_url || null,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } catch (oembedError) {
      console.log('oEmbed fetch failed:', oembedError);
      
      // Return basic info even if oEmbed fails
      return new Response(
        JSON.stringify({
          success: true,
          accountId: videoInfo.accountId,
          videoId: videoInfo.videoId,
          duration: null,
          note: 'Could not fetch additional metadata'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: String(error) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
