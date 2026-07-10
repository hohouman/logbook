// 语言优先级：简体中文 → 繁体中文 → 默认
const LANGUAGES = ['schinese', 'tchinese', ''];

/**
 * 从 Steam 商店 API 获取游戏数据。
 * @returns {Promise<object|null>}
 */
export async function getSteamData(appId, url) {
  for (const lang of LANGUAGES) {
    try {
      const apiUrl = `https://store.steampowered.com/api/appdetails?appids=${appId}${lang ? `&l=${lang}` : ''}`;

      const response = await fetch(apiUrl);
      const data = await response.json();
      const appData = data[appId]?.data;
      if (!appData) continue;

      console.log(`Steam ${appId}: 使用${lang || '默认'}语言`);
      return {
        id: appId,
        title: appData.name,
        developer: appData.developers,
        publisher: appData.publishers,
        releaseDate: appData.release_date?.date,
        description: appData.short_description,
        coverUrl: appData.header_image,
        posterUrl: `https://cdn.akamai.steamstatic.com/steam/apps/${appId}/library_600x900.jpg`,
        type: 'game',
        platform: 'steam',
        url: url || `https://store.steampowered.com/app/${appId}/`,
      };
    } catch (error) {
      console.log(`Steam ${appId}: ${lang || '默认'}语言失败 - ${error.message}`);
    }
  }

  console.log(`未找到 Steam 应用 ${appId} 的数据`);
  return null;
}
