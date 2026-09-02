const BASE_URL = 'https://vuflix.co';

const DEFAULT_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/152.0.0.0 Safari/537.36',
  'Referer': `${BASE_URL}/`,
  'Origin': BASE_URL,
  'Accept': 'application/json, text/plain, */*'
};

class VuflixScraper {
  constructor() {
    this.sessionCookie = '';
  }

  /**
   * Initializes a guest session to retrieve initial vf_ps cookie state.
   */
  async initSession() {
    try {
      const response = await fetch(`${BASE_URL}/api/inbox`, {
        headers: DEFAULT_HEADERS
      });
      
      const setCookie = response.headers.get('set-cookie');
      if (setCookie) {
        this.sessionCookie = setCookie.split(';')[0];
      }
    } catch (err) {
      console.error('[Vuflix] Session initialization failed:', err);
    }
  }

  /**
   * Main entry point for Nuvio stream extraction.
   * @param {Object} item - Media request payload containing type, id (or tmdbId), season, episode.
   * @returns {Promise<Array>} Array of extracted stream objects.
   */
  async getStreams(item) {
    const streams = [];

    try {
      if (!this.sessionCookie) {
        await this.initSession();
      }

      const mediaType = item.type === 'movie' ? 'movie' : 'tv';
      const mediaId = item.id || item.tmdbId;

      if (!mediaId) {
        return streams;
      }

      // Step 1: Batch metadata call
      const batchUrl = `${BASE_URL}/api/media/batch?ids=${mediaType}:${mediaId}&lang=en`;
      const batchRes = await fetch(batchUrl, {
        headers: {
          ...DEFAULT_HEADERS,
          'Cookie': this.sessionCookie
        }
      });

      if (!batchRes.ok) {
        return streams;
      }

      const batchData = await batchRes.json();
      const mediaKey = `${mediaType}:${mediaId}`;
      const mediaInfo = batchData[mediaKey] || batchData;

      // Extract playback signatures/relay keys if returned by API
      const relayToken = mediaInfo?.streamToken || mediaInfo?.t;
      const signature = mediaInfo?.signature || mediaInfo?.s;

      if (relayToken && signature) {
        // Step 2: Build proxy/relay stream endpoint
        const streamUrl = `${BASE_URL}/api/player/v-relay?t=${encodeURIComponent(relayToken)}&s=${encodeURIComponent(signature)}`;

        streams.push({
          name: 'Vuflix Auto',
          title: `Vuflix - ${mediaType.toUpperCase()} (${item.quality || 'HD'})`,
          url: streamUrl,
          type: 'm3u8',
          headers: {
            'User-Agent': DEFAULT_HEADERS['User-Agent'],
            'Referer': `${BASE_URL}/`,
            'Cookie': this.sessionCookie
          }
        });
      }
    } catch (error) {
      console.error('[Vuflix] Error fetching streams:', error);
    }

    return streams;
  }
}

// Module export for Nuvio provider runtime environment
if (typeof module !== 'undefined' && module.exports) {
  module.exports = new VuflixScraper();
}
