import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import puppeteer from 'puppeteer';
import { Buffer } from 'buffer';
import sharp from 'sharp';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CONTENT_DIR = path.join(__dirname, '../src/content');
const CONFIG_DIR = path.join(__dirname, '../src/config'); // 配置文件目录
const GENERATED_DIR = path.join(CONTENT_DIR, '_generated');
const PUBLIC_GENERATED_DIR = path.join(__dirname, '../public/generated');

// 确保生成目录存在
await fs.mkdir(GENERATED_DIR, { recursive: true });
await fs.mkdir(PUBLIC_GENERATED_DIR, { recursive: true });

/**
 * 从Steam API获取游戏数据
 */
async function getSteamData(appId, url) {
  try {
    // 优先尝试简体中文 (schinese)，然后繁体中文 (tchinese)，最后默认语言
    const languages = ['schinese', 'tchinese', ''];
    
    for (const lang of languages) {
      try {
        const apiUrl = lang 
          ? `https://store.steampowered.com/api/appdetails?appids=${appId}&l=${lang}`
          : `https://store.steampowered.com/api/appdetails?appids=${appId}`;
        
        const response = await fetch(apiUrl);
        const data = await response.json();
        const appData = data[appId]?.data;
        
        if (appData) {
          console.log(`使用${lang || '默认'}语言获取Steam数据`);
          return {
            id: appId,
            title: appData.name,
            developer: appData.developers,
            publisher: appData.publishers,
            releaseDate: appData.release_date.date,
            description: appData.short_description,
            coverUrl: appData.header_image,
            posterUrl: `https://cdn.akamai.steamstatic.com/steam/apps/${appId}/library_600x900.jpg`,
            type: 'game',
            platform: 'steam',
            url: url || `https://store.steampowered.com/app/${appId}/`
          };
        }
      } catch (error) {
        console.log(`尝试${lang || '默认'}语言失败:`, error.message);
        continue;
      }
    }
    
    console.log(`未找到Steam应用ID ${appId} 的数据`);
    return null;
  } catch (error) {
    console.error(`获取Steam数据失败 ${appId}:`, error.message);
    return null;
  }
}

/**
 * 从豆瓣获取电影/书籍数据
 */
async function getDoubanData(doubanId, type, url) {
  const browser = await puppeteer.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--disable-gpu',
      '--window-size=1920,1080'
    ]
  });
  
  try {
    const page = await browser.newPage();
    
    // 设置更真实的 User-Agent 和 viewport
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    await page.setViewport({ width: 1920, height: 1080 });
    
    // 添加额外的请求头来模拟真实浏览器
    await page.setExtraHTTPHeaders({
      'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8'
    });
    
    const host = type === 'movie' ? 'movie' : type === 'book' ? 'book' : 'music';
    const pageUrl = `https://${host}.douban.com/subject/${doubanId}/`;
    
    console.log(`正在访问豆瓣页面：${pageUrl}`);
    
    await page.goto(pageUrl, {
      waitUntil: 'networkidle2',
      timeout: 30000
    });
    
    // 等待页面完全加载
    await page.waitForSelector('#content', { timeout: 10000 }).catch(() => {
      console.log(`页面加载超时，但仍尝试提取数据`);
    });
    
    // 检查是否有反爬虫提示
    const pageTitle = await page.title();
    if (pageTitle.includes('访问太频繁') || pageTitle.includes('验证码')) {
      console.error(`豆瓣反爬虫检测：${pageTitle}`);
      await browser.close();
      return null;
    }

    // 获取页面数据 - 使用DOM查询而不是innerText解析
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

      // 改进封面图提取逻辑
      let coverUrl = '';
      const coverImg = document.querySelector('#mainpic img');
      if (coverImg) {
        coverUrl = coverImg.getAttribute('src') || coverImg.getAttribute('data-lazy');
      }
      
      // 如果没有找到，尝试其他选择器
      if (!coverUrl) {
        const coverLink = document.querySelector('#mainpic a');
        if (coverLink) {
          coverUrl = coverLink.getAttribute('href');
        }
      }
      
      // 清理豆瓣图片 URL（移除 douban.com 的反盗链参数）
      if (coverUrl && coverUrl.includes('douban.com')) {
        coverUrl = coverUrl.replace(/\?.*$/, ''); // 移除查询参数
      }

      let releaseDate = '';
      let director = [];
      let actors = [];
      let author = [];
      let artist = [];
      let publisher = [];

      // 根据类型使用不同的DOM选择器
      if (type === 'movie') {
        // 提取电影信息 - 使用DOM选择器
        const releaseDateEl = document.querySelector('[property="v:initialReleaseDate"]');
        if (releaseDateEl) {
          releaseDate = releaseDateEl.textContent.trim();
        }

        const directorEls = document.querySelectorAll('[rel="v:directedBy"]');
        director = Array.from(directorEls).map(el => el.textContent.trim());

        const actorEls = document.querySelectorAll('[rel="v:starring"]');
        actors = Array.from(actorEls).map(el => el.textContent.trim());
        
      } else if (type === 'book') {
        // 提取书籍信息 - 使用DOM选择器
        const infoDiv = document.getElementById('info');
        if (infoDiv) {
          const spans = infoDiv.querySelectorAll('span');
          
          for (const span of spans) {
            const text = span.textContent;
            
            // 匹配出版年
            if (text.includes('出版年')) {
              // 获取span后面的文本节点
              const nextNode = span.nextSibling;
              if (nextNode && nextNode.nodeType === Node.TEXT_NODE) {
                const yearMatch = nextNode.textContent.match(/(\d{4}(-\d{1,2})?)/);
                if (yearMatch) {
                  releaseDate = yearMatch[0];
                }
              }
            }
            
            // 匹配作者
            if (text.trim() === '作者' || text.includes('作者:')) {
              const link = span.nextElementSibling;
              if (link && link.tagName === 'A') {
                author.push(link.textContent.trim());
              }
            }
            
            // 匹配出版社
            if (text.includes('出版社')) {
              const link = span.nextElementSibling;
              if (link && link.tagName === 'A') {
                publisher.push(link.textContent.trim());
              }
            }
          }
        }
        
      } else if (type === 'album') {
        // 提取专辑信息 - 使用DOM选择器
        const infoDiv = document.getElementById('info');
        if (infoDiv) {
          const spans = infoDiv.querySelectorAll('span.pl');
          
          for (const span of spans) {
            const text = span.textContent.trim();
            
            // 匹配发行时间
            if (text.includes('发行时间')) {
              // 获取span后面的兄弟文本节点
              let nextNode = span.nextSibling;
              while (nextNode) {
                if (nextNode.nodeType === Node.TEXT_NODE) {
                  const nodeText = nextNode.textContent.replace(/\u00a0/g, ' ').trim(); // 替换&nbsp;为空格
                  const timeMatch = nodeText.match(/(\d{4}-\d{2}-\d{2}|\d{4}-\d{2}|\d{4})/);
                  if (timeMatch) {
                    releaseDate = timeMatch[0];
                    break;
                  }
                }
                nextNode = nextNode.nextSibling;
              }
            }
            
            // 匹配表演者
            if (text.includes('表演者')) {
              const parentSpan = span.parentElement;
              if (parentSpan) {
                const links = parentSpan.querySelectorAll('a');
                artist = Array.from(links).map(a => a.textContent.trim()).filter(Boolean);
              }
            }
            
            // 匹配出版者
            if (text.includes('出版者')) {
              // 获取span后面的兄弟文本节点
              let nextNode = span.nextSibling;
              while (nextNode) {
                if (nextNode.nodeType === Node.TEXT_NODE) {
                  const nodeText = nextNode.textContent.replace(/\u00a0/g, ' ').trim();
                  if (nodeText && !nodeText.includes('<') && !nodeText.includes('\n')) {
                    publisher.push(nodeText);
                    break;
                  }
                }
                nextNode = nextNode.nextSibling;
              }
            }
          }
        }
      }

      // 改进描述提取
      let desc = extractText('[property="v:summary"]');
      if (!desc) {
        const summaryAll = document.querySelector('.related-info .all.hidden, .summary .all.hidden');
        if (summaryAll) {
          desc = summaryAll.textContent.trim();
        } else {
          desc = extractText('.related-info') || extractText('.summary');
        }
      }
      
      // 限制描述长度
      if (desc.length > 500) {
        desc = desc.substring(0, 500) + '...';
      }

      return {
        title: title,
        coverUrl: coverUrl,
        releaseDate: releaseDate,
        director: director,
        actors: actors,
        author: author,
        artist: artist,
        publisher: publisher,
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
      director: data.director || [],
      author: data.author || [],
      artist: data.artist || [],
      publisher: data.publisher || [],
      releaseDate: data.releaseDate,
      description: data.description,
      coverUrl: data.coverUrl,
      type: type,
      platform: 'douban',
      url: url || pageUrl
    };
  } catch (error) {
    await browser.close().catch(() => {});
    console.error(`获取豆瓣${type}数据失败 ${doubanId}:`, error.message);
    return null;
  }
}

/**
 * 从MusicBrainz和Cover Art Archive获取专辑数据
 */
async function getMusicBrainzAlbumData(releaseId, url) {
  try {
    const response = await fetch(`https://musicbrainz.org/ws/2/release/${releaseId}?inc=artist-credits+labels&fmt=json`, {
      headers: {
        'User-Agent': 'logbook/1.0.0 (https://houman.top)'
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    const artist = (data['artist-credit'] || [])
      .map((item) => item.name)
      .filter(Boolean);
    const publisher = (data['label-info'] || [])
      .map((item) => item.label?.name)
      .filter(Boolean);

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
      url: url || `https://musicbrainz.org/release/${releaseId}`
    };
  } catch (error) {
    console.error(`获取MusicBrainz专辑数据失败 ${releaseId}:`, error.message);
    return null;
  }
}

/**
 * 下载并转换图片为WebP格式
 */
async function downloadAndConvertImage(url, fileName, options = {}) {
  if (!url) return null;

  try {
    // 为豆瓣图片添加特殊的请求头以避免防盗链问题
    const headers = {};
    if (url.includes('doubanio.com') || url.includes('douban.com')) {
      // 设置Referer为豆瓣网站，绕过防盗链
      headers['Referer'] = 'https://www.douban.com/';
      headers['User-Agent'] = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36';
    }
    
    const response = await fetch(url, { headers });
    
    if (!response.ok) {
      console.warn(`图片下载失败 (${response.status}): ${url}`);
      throw new Error(`Failed to download image: ${response.statusText}`);
    }

    const imageBuffer = Buffer.from(await response.arrayBuffer());
    
    // 使用sharp将图片转换为WebP格式并优化
    const optimizedImageBuffer = await sharp(imageBuffer)
      .resize(options.width || 500, options.height || 750, { fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 80 })
      .toBuffer();

    // 存储在公开目录中，静态构建后可直接访问。
    const imagePath = path.join(PUBLIC_GENERATED_DIR, fileName);
    await fs.writeFile(imagePath, optimizedImageBuffer);
    
    console.log(`✓ 图片下载成功: ${fileName}`);
    return `/generated/${fileName}`;
  } catch (error) {
    console.error(` 下载或转换图片失败 ${url}:`, error.message);
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

    // 豆瓣音乐
    if (parsedUrl.hostname.includes('music.douban.com')) {
      const match = parsedUrl.pathname.match(/\/subject\/(\d+)/);
      if (match) {
        return { platform: 'douban', id: match[1], type: 'album', url };
      }
    }

    // MusicBrainz release
    if (parsedUrl.hostname.includes('musicbrainz.org')) {
      const match = parsedUrl.pathname.match(/\/release\/([a-f0-9-]+)/i);
      if (match) {
        return { platform: 'musicbrainz', id: match[1], type: 'album', url };
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
  if (existingDataMap[cacheKey] && !shouldRefreshItem(parsed, existingDataMap[cacheKey])) {
    return existingDataMap[cacheKey];
  }

  let data = null;

  if (parsed.platform === 'steam') {
    data = await getSteamData(parsed.id, parsed.url);
  } else if (parsed.platform === 'douban') {
    data = await getDoubanData(parsed.id, parsed.type, parsed.url);
  } else if (parsed.platform === 'musicbrainz') {
    data = await getMusicBrainzAlbumData(parsed.id, parsed.url);
  }

  if (!data) {
    console.log(`无法获取数据: ${url}`);
    return null;
  }

  // 下载并转换封面图片
  if (data.coverUrl) {
    const fileName = `${data.type}_${data.id}_cover.webp`;
    const imagePath = await downloadAndConvertImage(data.coverUrl, fileName);
    data.localCoverPath = imagePath;
  }

  if (data.posterUrl) {
    const fileName = `${data.type}_${data.id}_poster.webp`;
    const imagePath = await downloadAndConvertImage(data.posterUrl, fileName, { width: 600, height: 900 });
    data.localPosterPath = imagePath;
  }

  return data;
}

function shouldRefreshItem(parsed, item) {
  if (!item) return true;

  if (parsed.platform === 'steam' && (!item.posterUrl || !item.localPosterPath)) {
    return true;
  }

  if (parsed.type === 'movie' && !item.director) {
    return true;
  }

  if (parsed.type === 'book' && !item.author) {
    return true;
  }

  if (parsed.type === 'album' && !item.artist) {
    return true;
  }

  return false;
}

/**
 * 主函数
 */
async function main() {
  try {
    // 读取配置文件
    const configFiles = ['games.json', 'movies.json', 'books.json', 'albums.json'];
    
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

      // 读取现有生成的数据 - 修改为使用新的数据目录
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

      // 写入生成的文件 - 使用新的数据目录
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
