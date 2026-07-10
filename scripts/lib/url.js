/** 各站点主机 → 解析规则 */
const MATCHERS = [
  { host: 'store.steampowered.com', re: /\/app\/(\d+)/, build: (id, url) => ({ platform: 'steam', id, url }) },
  { host: 'movie.douban.com', re: /\/subject\/(\d+)/, build: (id, url) => ({ platform: 'douban', id, type: 'movie', url }) },
  { host: 'book.douban.com', re: /\/subject\/(\d+)/, build: (id, url) => ({ platform: 'douban', id, type: 'book', url }) },
  { host: 'music.douban.com', re: /\/subject\/(\d+)/, build: (id, url) => ({ platform: 'douban', id, type: 'album', url }) },
  { host: 'musicbrainz.org', re: /\/release\/([a-f0-9-]+)/i, build: (id, url) => ({ platform: 'musicbrainz', id, type: 'album', url }) },
];

/**
 * 解析媒体 URL，得到平台、ID 与类型。
 * @returns {{platform:string,id:string,type?:string,url:string}|null}
 */
export function parseUrl(url) {
  try {
    const { hostname, pathname } = new URL(url);
    for (const { host, re, build } of MATCHERS) {
      if (!hostname.includes(host)) continue;
      const match = pathname.match(re);
      if (match) return build(match[1], url);
    }
    return null;
  } catch (error) {
    console.error(`无效的 URL: ${url} (${error.message})`);
    return null;
  }
}
