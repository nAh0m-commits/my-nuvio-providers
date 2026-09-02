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

  extractSessionCookie(headers) {
    var setCookieValue = '';
    var cookies = [];
    var cookieChunks;
    var i;
    var cookieValue;

    if (!headers || typeof headers.get !== 'function') {
      return '';
    }

    setCookieValue = headers.get('set-cookie') || headers.get('Set-Cookie');
    if (!setCookieValue && typeof headers.forEach === 'function') {
      headers.forEach(function(value, key) {
        if (!setCookieValue && key && key.toLowerCase() === 'set-cookie') {
          setCookieValue = value;
        }
      });
    }

    if (!setCookieValue) {
      return '';
    }

    cookieChunks = String(setCookieValue).split(',');
    for (i = 0; i < cookieChunks.length; i += 1) {
      cookieValue = cookieChunks[i].trim();
      if (cookieValue) {
        cookies.push(cookieValue.split(';')[0]);
      }
    }

    return cookies.join('; ');
  }

  /**
   * Initializes a guest session to retrieve initial vf_ps cookie state.
   */
  initSession() {
    return fetch(`${BASE_URL}/api/inbox`, {
      headers: DEFAULT_HEADERS
    }).then(function(response) {
      var parsedCookie = this.extractSessionCookie(response && response.headers);
      if (parsedCookie) {
        this.sessionCookie = parsedCookie;
      }
      return this.sessionCookie;
    }.bind(this)).catch(function(err) {
      throw new Error('[Vuflix] Session initialization failed: ' + (err && err.message ? err.message : err));
    });
  }

  buildBatchHeaders() {
    return {
      'User-Agent': DEFAULT_HEADERS['User-Agent'],
      'Referer': DEFAULT_HEADERS['Referer'],
      'Origin': DEFAULT_HEADERS['Origin'],
      'Accept': DEFAULT_HEADERS['Accept'],
      'Cookie': this.sessionCookie
    };
  }

  getRelayParams(mediaInfo) {
    var relayToken = mediaInfo && (mediaInfo.streamToken || mediaInfo.t);
    var signature = mediaInfo && (mediaInfo.signature || mediaInfo.s);

    if (!relayToken || !signature) {
      return null;
    }

    return {
      relayToken: relayToken,
      signature: signature
    };
  }

  /**
   * Main entry point for Nuvio stream extraction.
   * @param {Object} item - Media request payload containing type, id (or tmdbId), season, episode.
   * @returns {Promise<Array>} Array of extracted stream objects.
   */
  getStreams(item) {
    var streams = [];
    var mediaType = item && item.type === 'movie' ? 'movie' : 'tv';
    var mediaId = item && (item.id || item.tmdbId);
    var mediaKey = mediaType + ':' + mediaId;
    var batchUrl = `${BASE_URL}/api/media/batch?ids=${mediaKey}&lang=en`;
    var shouldInitSession = !this.sessionCookie;

    if (!mediaId) {
      return Promise.resolve(streams);
    }

    return (shouldInitSession ? this.initSession() : Promise.resolve(this.sessionCookie))
      .then(function() {
        return fetch(batchUrl, {
          headers: this.buildBatchHeaders()
        });
      }.bind(this))
      .then(function(batchRes) {
        if (!batchRes || !batchRes.ok) {
          throw new Error('[Vuflix] Media batch request failed with status ' + (batchRes && batchRes.status ? batchRes.status : 'unknown'));
        }
        return batchRes.json();
      })
      .then(function(batchData) {
        var mediaInfo = batchData && batchData[mediaKey] ? batchData[mediaKey] : batchData;
        var relayParams = this.getRelayParams(mediaInfo);
        var streamUrl;

        if (!relayParams) {
          return streams;
        }

        streamUrl = `${BASE_URL}/api/player/v-relay?t=${encodeURIComponent(relayParams.relayToken)}&s=${encodeURIComponent(relayParams.signature)}`;

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

        return streams;
      }.bind(this))
      .catch(function(error) {
        console.error('[Vuflix] Error fetching streams:', error && error.message ? error.message : error);
        return streams;
      });
  }
}

// Module export for Nuvio provider runtime environment
if (typeof module !== 'undefined' && module.exports) {
  module.exports = new VuflixScraper();
}
