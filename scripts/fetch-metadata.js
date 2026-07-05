import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import puppeteer from 'puppeteer';
import { Buffer } from 'buffer';
import sharp from 'sharp';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 数据目录路径
const CONTENT_DIR = path.join(__dirname, '../src/content');
const CONFIG_DIR = path.join(CONTENT_DIR, 'config');
const GENERATED_DIR = path.join(CONTENT_DIR, '_generated');

// 确保生成目录存在
await fs.mkdir(GENERATED_DIR, { recursive: true });

/**
 * 从Steam API获取游戏数据
 */
async function getSteamData(appId) {
  try {
    const response = await fetch(`https://store.steampowered.com/api/appdetails?appids=${appId}`);
    const data = await response.json();
    const appData = data[appId]?.data;
    
    if (!appData) {
      console.log(`未找到Steam应用ID ${appId} 的数据`);
      return null;
    }

    return {
      id: appId,
      title: appData.name,
      developer: appData.developers,
      publisher: appData.publishers,
      releaseDate: appData.release_date.date,
      description: appData.short_description,
      coverUrl: appData.header_image,
      type: 'game',
      platform: 'steam'
    };
  } catch (error) {
    console.error(`获取Steam数据失败 ${appId}:`, error.message);
    return null;
  }
}

/**
 * 从Epic Games获取游戏数据
 */
async function getEpicData(productSlug) {
  try {
    const response = await fetch(`https://store.epicgames.com/p/${productSlug}`);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const html = await response.text();
    // 简单的解析方式，实际可能需要更复杂的解析
    const titleMatch = html.match(/<title[^>]*>(.*?)<\/title>/i);
    const title = titleMatch ? titleMatch[1].replace(' | Epic Games Store', '').trim() : productSlug;

    // 提取封面图URL (简化处理)
    const coverMatch = html.match(/"image":"([^"]*\.jpg|png|jpeg)"/i);
    let coverUrl = '';
    if (coverMatch) {
      coverUrl = coverMatch[1].replace(/\\u002F/g, '/');
    }

    return {
      id: productSlug,
      title: title,
      developer: [],
      publisher: ['Epic Games'],
      releaseDate: new Date().toISOString(),
      description: '',
      coverUrl: coverUrl,
      type: 'game',
      platform: 'epic'
    };
  } catch (error) {
    console.error(`获取Epic Games数据失败 ${productSlug}:`, error.message);
    return null;
  }
}

/**
 * 从豆瓣获取电影/书籍数据
 */
async function getDoubanData(doubanId, type) {
  try {
    const browser = await puppeteer.launch({ 
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    const page = await browser.newPage();
    
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');
    await page.goto(`https://${type === 'movie' ? 'movie' : 'book'}.douban.com/subject/${doubanId}/`, { 
      waitUntil: 'networkidle2',
      timeout: 30000 
    });

    // 获取页面数据
    const data = await page.evaluate((type) => {
      const extractText = (selector) => {
        const el = document.querySelector(selector);
        return el ? el.textContent.trim() : '';
      };

      const extractAttribute = (selector, attr) => {
        const el = document.querySelector(selector);
        return el ? el.getAttribute(attr) : '';
      };

      const titleEl = document.querySelector('h1 span[property="v:itemreviewed"]');
      const title = titleEl ? titleEl.textContent.trim() : extractText('h1') || '';

      const coverImg = document.querySelector('#mainpic .nbgnbg img');
      const coverUrl = coverImg ? coverImg.getAttribute('src') : extractAttribute('#mainpic .nbgnbg a img', 'src');

      const infoDiv = document.getElementById('info');
      const infoText = infoDiv ? infoDiv.innerText : '';
      
      let releaseDate = '';
      let director = [];
      let actors = [];
      let author = [];

      if (type === 'movie') {
        // 提取电影信息
        const dateMatch = infoText.match(/上映日期:\s*([^\n\r]+)/);
        releaseDate = dateMatch ? dateMatch[1].trim() : '';
        
        const directorMatch = infoText.match(/导演:\s*([^\n\r]+)/);
        if (directorMatch) {
          director = [directorMatch[1].trim()];
        }
        
        const actorMatch = infoText.match(/主演:\s*([^\n\r]+)/);
        if (actorMatch) {
          actors = actorMatch[1].split('/').map(a => a.trim());
        }
      } else if (type === 'book') {
        // 提取书籍信息
        const dateMatch = infoText.match(/出版年:\s*([^\n\r]+)/);
        releaseDate = dateMatch ? dateMatch[1].trim() : '';
        
        const authorMatch = infoText.match(/作者:\s*([^\n\r]+)/);
        if (authorMatch) {
          author = authorMatch[1].split('/');
        }
      }

      const desc = extractText('.related-info .all.hidden') || extractText('.related-info') || extractText('[property="v:summary"]');

      return {
        title: title,
        coverUrl: coverUrl,
        releaseDate: releaseDate,
        director: director,
        actors: actors,
        author: author,
        description: desc,
      };
    }, type);

    await browser.close();

    if (!data.title) {
      console.log(`未找到豆瓣${type} ID ${doubanId} 的数据`);
      return null;
    }

    return {
      id: doubanId,
      title: data.title,
      developer: data.director || data.author || [],
      publisher: [],
      releaseDate: data.releaseDate,
      description: data.description,
      coverUrl: data.coverUrl,
      type: type,
      platform: 'douban'
    };
  } catch (error) {
    console.error(`获取豆瓣${type}数据失败 ${doubanId}:`, error.message);
    return null;
  }
}

/**
 * 下载并转换图片为WebP格式
 */
async function downloadAndConvertImage(url, fileName) {
  if (!url) return null;

  try {
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`Failed to download image: ${response.statusText}`);
    }

    const imageBuffer = Buffer.from(await response.arrayBuffer());
    
    // 使用sharp将图片转换为WebP格式并优化
    const optimizedImageBuffer = await sharp(imageBuffer)
      .resize(400, 600, { fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 80 })
      .toBuffer();

    const imagePath = path.join(GENERATED_DIR, fileName);
    await fs.writeFile(imagePath, optimizedImageBuffer);
    
    return `/src/content/_generated/${fileName}`;
  } catch (error) {
    console.error(`下载或转换图片失败 ${url}:`, error.message);
    return null;
  }
}

/**
 * 解析URL获取平台和ID
 */
function parseUrl(url) {
  try {
    const parsedUrl = new URL(url);
    
    // Steam
    if (parsedUrl.hostname.includes('store.steampowered.com')) {
      const match = parsedUrl.pathname.match(/\/app\/(\d+)/);
      if (match) {
        return { platform: 'steam', id: match[1], url };
      }
    }
    
    // Epic Games
    if (parsedUrl.hostname.includes('epicgames.com')) {
      const segments = parsedUrl.pathname.split('/');
      const slugIndex = segments.indexOf('p');
      if (slugIndex !== -1 && segments[slugIndex + 1]) {
        return { platform: 'epic', id: segments[slugIndex + 1], url };
      }
    }
    
    // 豆瓣电影
    if (parsedUrl.hostname.includes('movie.douban.com')) {
      const match = parsedUrl.pathname.match(/\/subject\/(\d+)/);
      if (match) {
        return { platform: 'douban', id: match[1], type: 'movie', url };
      }
    }
    
    // 豆瓣图书
    if (parsedUrl.hostname.includes('book.douban.com')) {
      const match = parsedUrl.pathname.match(/\/subject\/(\d+)/);
      if (match) {
        return { platform: 'douban', id: match[1], type: 'book', url };
      }
    }

    return null;
  } catch (error) {
    console.error(`无效的URL: ${url}`, error.message);
    return null;
  }
}

/**
 * 处理单个URL
 */
async function processUrl(url, existingDataMap) {
  const parsed = parseUrl(url);
  if (!parsed) {
    console.log(`无法解析URL: ${url}`);
    return null;
  }

  // 如果已经存在数据且没有过期，则跳过
  const cacheKey = `${parsed.platform}_${parsed.id}`;
  if (existingDataMap[cacheKey]) {
    return existingDataMap[cacheKey];
  }

  let data = null;

  if (parsed.platform === 'steam') {
    data = await getSteamData(parsed.id);
  } else if (parsed.platform === 'epic') {
    data = await getEpicData(parsed.id);
  } else if (parsed.platform === 'douban') {
    data = await getDoubanData(parsed.id, parsed.type);
  }

  if (!data) {
    console.log(`无法获取数据: ${url}`);
    return null;
  }

  // 下载并转换封面图片
  if (data.coverUrl) {
    const ext = path.extname(data.coverUrl).split('.')[1] || 'webp';
    const fileName = `${data.type}_${data.id}_cover.webp`;
    const imagePath = await downloadAndConvertImage(data.coverUrl, fileName);
    data.localCoverPath = imagePath;
  }

  return data;
}

/**
 * 主函数
 */
async function main() {
  try {
    // 读取配置文件
    const configFiles = ['games.json', 'movies.json', 'books.json'];
    
    for (const configFile of configFiles) {
      const configPath = path.join(CONFIG_DIR, configFile);
      
      // 检查配置文件是否存在
      try {
        await fs.access(configPath);
      } catch {
        console.log(`配置文件不存在，创建默认文件: ${configFile}`);
        await fs.writeFile(configPath, JSON.stringify([], null, 2));
        continue;
      }
      
      const configContent = await fs.readFile(configPath, 'utf-8');
      let urls;
      
      try {
        urls = JSON.parse(configContent);
      } catch (e) {
        console.error(`${configFile} 不是有效的JSON文件`);
        continue;
      }
      
      if (!Array.isArray(urls)) {
        console.error(`${configFile} 格式错误，应为数组`);
        continue;
      }

      // 读取现有生成的数据
      const generatedFile = path.join(GENERATED_DIR, configFile);
      let existingData = [];
      let existingDataMap = {};
      
      try {
        const existingContent = await fs.readFile(generatedFile, 'utf-8');
        existingData = JSON.parse(existingContent);
        
        // 创建现有数据的映射，便于快速查找
        existingDataMap = existingData.reduce((acc, item) => {
          const key = `${item.platform}_${item.id}`;
          acc[key] = item;
          return acc;
        }, {});
      } catch {
        // 如果文件不存在或解析失败，则从空数组开始
        existingData = [];
        existingDataMap = {};
      }

      console.log(`处理 ${configFile}，共 ${urls.length} 个链接`);
      
      // 处理每个URL
      const results = [];
      for (const url of urls) {
        console.log(`正在处理: ${url}`);
        const result = await processUrl(url, existingDataMap);
        if (result) {
          results.push(result);
        }
        // 添加延迟以避免过于频繁的请求
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      // 合并新旧数据，保留原有的数据项
      const allResults = [...results, ...existingData.filter(item => !results.some(newItem => 
        newItem.platform === item.platform && newItem.id === item.id
      ))];

      // 写入生成的文件
      await fs.writeFile(generatedFile, JSON.stringify(allResults, null, 2));
      console.log(`完成处理 ${configFile}，共 ${allResults.length} 条数据 (${results.length} 条新数据)`);
    }
    
    console.log('所有数据处理完成！');
  } catch (error) {
    console.error('处理过程中出现错误:', error);
    process.exit(1);
  }
}

// 运行主函数
await main();