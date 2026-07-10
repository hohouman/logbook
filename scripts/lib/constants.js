/** 浏览器 User-Agent，供豆瓣网页抓取与图片下载（带豆瓣 Referer 防盗链） */
export const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

/**
 * API 调用用的应用标识 User-Agent（MusicBrainz 等开放 API 明确要求带联系方式）。
 * 与上面的浏览器 UA 用途不同，切勿混用，否则可能被风控或违规。
 */
export const API_USER_AGENT = 'logbook/1.0.0 (https://houman.top)';
