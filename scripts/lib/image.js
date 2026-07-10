import fs from 'fs/promises';
import path from 'path';
import { Buffer } from 'buffer';
import sharp from 'sharp';
import { PUBLIC_GENERATED_DIR } from './paths.js';
import { backoff } from './util.js';

const MAX_RETRIES = 3;
const DOUBAN_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36';

/** 豆瓣图片需带 Referer 绕过防盗链 */
function buildHeaders(url) {
  if (url.includes('doubanio.com') || url.includes('douban.com')) {
    return { Referer: 'https://www.douban.com/', 'User-Agent': DOUBAN_UA };
  }
  return {};
}

/**
 * 下载图片并转换为优化后的 WebP，存入 public/generated。
 * @returns {Promise<string|null>} 站点内的相对路径，失败返回 null
 */
export async function downloadAndConvertImage(url, fileName, options = {}) {
  if (!url) return null;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await fetch(url, { headers: buildHeaders(url) });

      if (!response.ok) {
        if (response.status === 403 || response.status === 404) {
          console.error(`图片不可用 (${response.status})，跳过: ${url}`);
          return null;
        }
        if (attempt < MAX_RETRIES) {
          await backoff(attempt);
          continue;
        }
        throw new Error(`下载失败: ${response.statusText}`);
      }

      const buffer = Buffer.from(await response.arrayBuffer());
      if (buffer.length === 0) throw new Error('下载的图片数据为空');

      const optimized = await sharp(buffer)
        .resize(options.width || 500, options.height || 750, {
          fit: 'inside',
          withoutEnlargement: true,
        })
        .webp({ quality: 80 })
        .toBuffer();

      await fs.writeFile(path.join(PUBLIC_GENERATED_DIR, fileName), optimized);
      console.log(`✓ 图片已保存: ${fileName}`);
      return `/generated/${fileName}`;
    } catch (error) {
      console.error(`下载/转换失败 (尝试 ${attempt}/${MAX_RETRIES}) ${url}: ${error.message}`);
      if (attempt < MAX_RETRIES) await backoff(attempt);
    }
  }

  console.error(`✗ 图片最终失败，已重试 ${MAX_RETRIES} 次: ${url}`);
  return null;
}
