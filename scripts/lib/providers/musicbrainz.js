const USER_AGENT = 'logbook/1.0.0 (https://houman.top)';

/**
 * 从 MusicBrainz + Cover Art Archive 获取专辑数据。
 * @returns {Promise<object|null>}
 */
export async function getMusicBrainzAlbumData(releaseId, url) {
  try {
    const response = await fetch(
      `https://musicbrainz.org/ws/2/release/${releaseId}?inc=artist-credits+labels&fmt=json`,
      { headers: { 'User-Agent': USER_AGENT } },
    );

    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const data = await response.json();
    const artist = (data['artist-credit'] || []).map((item) => item.name).filter(Boolean);
    const publisher = (data['label-info'] || []).map((item) => item.label?.name).filter(Boolean);

    return {
      id: releaseId,
      title: data.title,
      artist,
      publisher,
      releaseDate: data.date || '',
      description: artist.length ? artist.join(', ') : '',
      coverUrl: `https://coverartarchive.org/release/${releaseId}/front-500`,
      type: 'album',
      platform: 'musicbrainz',
      url: url || `https://musicbrainz.org/release/${releaseId}`,
    };
  } catch (error) {
    console.error(`获取 MusicBrainz 专辑数据失败 ${releaseId}: ${error.message}`);
    return null;
  }
}
