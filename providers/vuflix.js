var BASE_URL = 'https://vuflix.co';

var DEFAULT_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/152.0.0.0 Safari/537.36',
  'Referer': BASE_URL + '/',
  'Origin': BASE_URL,
  'Accept': 'application/json, text/plain, */*'
};

function VuflixScraper() {
  this.sessionCookie = '';
}

VuflixScraper.prototype.initSession = function() {
  var self = this;
  return fetch(BASE_URL + '/api/inbox', { headers: DEFAULT_HEADERS })
    .then(function(response) {
      var setCookie = response.headers.get('set-cookie');
      if (setCookie) {
        self.sessionCookie = setCookie.split(';')[0];
      }
    })
    .catch(function(err) {
      console.error('[Vuflix] Session init failed:', err);
    });
};

VuflixScraper.prototype.getStreams = function(item) {
  var self = this;
  var streams = [];

  var mediaType = item.type === 'movie' ? 'movie' : 'tv';
  var mediaId = item.id || item.tmdbId;

  if (!mediaId) {
    return Promise.resolve(streams);
  }

  // Handle TV show episode formatting if present
  var idString = mediaType + ':' + mediaId;
  if (mediaType === 'tv' && item.season && item.episode) {
    idString += ':' + item.season + ':' + item.episode;
  }

  var prepareSession = self.sessionCookie ? Promise.resolve() : self.initSession();

  return prepareSession
    .then(function() {
      var batchUrl = BASE_URL + '/api/media/batch?ids=' + idString + '&lang=en';
      var headers = Object.assign({}, DEFAULT_HEADERS);
      if (self.sessionCookie) {
        headers['Cookie'] = self.sessionCookie;
      }
      return fetch(batchUrl, { headers: headers });
    })
    .then(function(res) {
      if (!res.ok) return null;
      return res.json();
    })
    .then(function(batchData) {
      if (!batchData) return streams;

      var mediaInfo = batchData[idString] || batchData[mediaType + ':' + mediaId] || batchData;

      var relayToken = mediaInfo ? (mediaInfo.streamToken || mediaInfo.t) : null;
      var signature = mediaInfo ? (mediaInfo.signature || mediaInfo.s) : null;

      if (relayToken && signature) {
        var streamUrl = BASE_URL + '/api/player/v-relay?t=' + encodeURIComponent(relayToken) + '&s=' + encodeURIComponent(signature);

        streams.push({
          name: 'Vuflix Auto',
          title: 'Vuflix - ' + mediaType.toUpperCase() + ' (' + (item.quality || 'HD') + ')',
          url: streamUrl,
          type: 'm3u8',
          headers: {
            'User-Agent': DEFAULT_HEADERS['User-Agent'],
            'Referer': BASE_URL + '/',
            'Cookie': self.sessionCookie
          }
        });
      }

      return streams;
    })
    .catch(function(error) {
      console.error('[Vuflix] Stream extraction error:', error);
      return streams;
    });
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = new VuflixScraper();
}
