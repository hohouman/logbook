import fs from 'fs/promises';
import path from 'path';
import puppeteer from 'puppeteer';

import { CONFIG_DIR, GENERATED_DIR, ensureDirs, listConfigFiles } from './lib/paths.js';
import { delay } from './lib/util.js';
import { parseUrl } from './lib/url.js';
import { shouldRefreshItem } from './lib/refresh.js';
import { downloadAndConvertImage } from './lib/image.js';
import { getSteamData } from './lib/providers/steam.js';
import { getDoubanData } from './lib/providers/douban.js';
import { getMusicBrainzAlbumData } from './lib/providers/musicbrainz.js';

const BROWSER_ARGS = [
  '--no-sandbox',
  '--disable-setuid-sandbox',
  '--disable-dev-shm-usage',
  '--disable-accelerated-2d-canvas',
  '--disable-gpu',
  '--window-size=1920,1080',
];

/** 懒加载的 Puppeteer 浏览器单例（整轮抓取复用） */
let browserPromise = null;
const getBrowser = () => (browserPromise ??= puppeteer.launch({ headless: true, args: BROWSER_ARGS }));
async function closeBrowser() {
  if (!browserPromise) return;
  const browser = await browserPromise.catch(() => null);
  await browser?.close().catch(() => {});
  browserPromise = null;
}

/** 按平台抓取原始数据 */
async function fetchByPlatform(parsed) {
  switch (parsed.platform) {
    case 'steam':
      return getSteamData(parsed.id, parsed.url);
    case 'douban':
      return getDoubanData(await getBrowser(), parsed.id, parsed.type, parsed.url);
    case 'musicbrainz':
      return getMusicBrainzAlbumData(parsed.id, parsed.url);
    default:
      return null;
  }
}

/** 归一化 URL，用于合并后按配置顺序排序（忽略末尾斜杠与大小写） */
function normalizeUrl(url) {
  return (url || '').replace(/\/+$/, '').toLowerCase();
}

/** 处理单个 URL：命中缓存则跳过，否则抓取并下载封面 */
async function processUrl(url, existingDataMap) {
  const parsed = parseUrl(url);
  if (!parsed) {
    console.log(`无法解析 URL: ${url}`);
    return null;
  }

  const cacheKey = `${parsed.platform}_${parsed.id}`;
  const cached = existingDataMap[cacheKey];
  if (cached && !shouldRefreshItem(parsed, cached)) return cached;

  const data = await fetchByPlatform(parsed);
  if (!data) {
    console.log(`无法获取数据: ${url}`);
    return null;
  }

  if (data.coverUrl) {
    data.localCoverPath = await downloadAndConvertImage(data.coverUrl, `${data.type}_${data.id}_cover.webp`);
  }
  if (data.posterUrl) {
    data.localPosterPath = await downloadAndConvertImage(
      data.posterUrl,
      `${data.type}_${data.id}_poster.webp`,
      { width: 600, height: 900 },
    );
  }

  return data;
}

/** 读取 JSON 文件，失败返回 fallback */
async function readJson(filePath, fallback) {
  try {
    return JSON.parse(await fs.readFile(filePath, 'utf-8'));
  } catch {
    return fallback;
  }
}

/** 处理一个配置文件（URL 列表）→ 生成数据文件 */
async function processConfigFile(configFile) {
  // configFile 来自 listConfigFiles() 的目录扫描，文件必然存在，无需再判空创建。
  const configPath = path.join(CONFIG_DIR, configFile);
  const urls = await readJson(configPath, null);
  if (!Array.isArray(urls)) {
    console.error(`${configFile} 格式错误，应为 URL 数组`);
    return;
  }

  const generatedFile = path.join(GENERATED_DIR, configFile);
  const existingRaw = await readJson(generatedFile, []);
  const existingData = Array.isArray(existingRaw) ? existingRaw : [];
  const existingDataMap = Object.fromEntries(
    existingData.map((item) => [`${item.platform}_${item.id}`, item]),
  );

  console.log(`处理 ${configFile}，共 ${urls.length} 个链接`);

  const results = [];
  for (const url of urls) {
    const result = await processUrl(url, existingDataMap);
    if (result) results.push(result);
    await delay(1000); // 控频
  }

  // 保留旧数据中本轮未覆盖的条目
  const resultKeys = new Set(results.map((item) => `${item.platform}_${item.id}`));
  const merged = [
    ...results,
    ...existingData.filter((item) => !resultKeys.has(`${item.platform}_${item.id}`)),
  ];

  // 按配置文件中的 URL 顺序稳定排序（忽略末尾斜杠差异）
  const order = new Map(urls.map((url, index) => [normalizeUrl(url), index]));
  merged.sort((a, b) => {
    const ai = order.get(normalizeUrl(a.url)) ?? Number.MAX_SAFE_INTEGER;
    const bi = order.get(normalizeUrl(b.url)) ?? Number.MAX_SAFE_INTEGER;
    return ai - bi;
  });

  await fs.writeFile(generatedFile, JSON.stringify(merged, null, 2));
}

async function main() {
  await ensureDirs();
  try {
    const configFiles = await listConfigFiles();
    for (const configFile of configFiles) {
      await processConfigFile(configFile);
    }
    console.log('所有数据处理完成！');
  } catch (error) {
    console.error('处理过程中出现错误:', error);
    process.exitCode = 1;
  } finally {
    await closeBrowser();
  }
}

await main();
