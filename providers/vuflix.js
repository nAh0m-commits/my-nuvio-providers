var BASE_URL = 'https://vuflix.co';

var HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Accept': 'application/json, text/plain, */*',
  'Accept-Language': 'en-US,en;q=0.9',
  'Referer': BASE_URL + '/',
  'Origin': BASE_URL,
  'Cookie': 'vf_ps=guest_active; path=/; domain=.vuflix.co'
};

function VuflixScraper() {}

VuflixScraper.prototype.getStreams = function(item) {
  var streams = [];
  var mediaType = item.type === 'movie' ? 'movie' : 'tv';
  var mediaId = item.tmdbId || item.id;

  if (!mediaId) {
    return Promise.resolve(streams);
  }

  // Build target query strings matching PlayTorrio's batch structure
  var targetKey = mediaType + ':' + mediaId;
  if (mediaType === 'tv' && item.season && item.episode) {
    targetKey += ':' + item.season + ':' + item.episode;
  }

  var batchUrl = BASE_URL + '/api/media/batch?ids=' + encodeURIComponent(targetKey) + '&lang=en';

  return fetch(batchUrl, { 
    method: 'GET',
    headers: HEADERS 
  })
    .then(function(res) {
      if (!res.ok) return null;
      return res.json();
    })
    .then(function(data) {
      if (!data) return streams;

      var info = data[targetKey] || data[mediaType + ':' + mediaId] || (Array.isArray(data) ? data[0] : data);

      if (info) {
        var token = info.streamToken || info.token || info.t;
        var sig = info.signature || info.sig || info.s;

        if (token && sig) {
          var relayUrl = BASE_URL + '/api/player/v-relay?t=' + encodeURIComponent(token) + '&s=' + encodeURIComponent(sig);

          streams.push({
            name: 'Vuflix',
            title: 'Vuflix - ' + (mediaType === 'tv' ? 'S' + item.season + 'E' + item.episode : 'Movie') + ' (Auto)',
            url: relayUrl,
            type: 'm3u8',
            headers: HEADERS
          });
        }
      }

      return streams;
    })
    .catch(function(err) {
      console.error('[Vuflix] Provider execution error:', err);
      return streams;
    });
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = new VuflixScraper();
}
