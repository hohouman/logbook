import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url)); // scripts/lib
const ROOT = path.join(__dirname, '../..');

export const CONFIG_DIR = path.join(ROOT, 'src/config');
export const CONTENT_DIR = path.join(ROOT, 'src/content');
export const GENERATED_DIR = path.join(CONTENT_DIR, '_generated');
export const PUBLIC_GENERATED_DIR = path.join(ROOT, 'public/generated');

/** 要处理的配置文件（URL 列表）→ 对应的生成数据文件同名 */
export const CONFIG_FILES = ['games.json', 'movies.json', 'books.json', 'albums.json'];

/** 确保生成目录存在 */
export async function ensureDirs() {
  await fs.mkdir(GENERATED_DIR, { recursive: true });
  await fs.mkdir(PUBLIC_GENERATED_DIR, { recursive: true });
}
