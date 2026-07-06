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
 * 解决豆瓣的JavaScript挑战
 * @param {Page} page - Puppeteer页面对象
 * @returns {Promise<boolean>} 是否成功解决挑战
 */
async function solveDoubanChallenge(page) {
  try {
    // 检查是否有挑战表单
    const hasChallengeForm = await page.$('#sec');
    if (!hasChallengeForm) {
      return true; // 没有挑战，直接返回成功
    }

    console.log('检测到豆瓣反爬虫挑战，正在解决...');

    // 在页面上下文中执行挑战计算
    const solved = await page.evaluate(async () => {
      // SHA-512 哈希函数
      function sha512(string) {
        return new Promise((resolve, reject) => {
          let buffer = (new TextEncoder).encode(string);
          crypto.subtle.digest('SHA-512', buffer.buffer).then(result => {
            resolve(Array.from(new Uint8Array(result)).map(
              c => c.toString(16).padStart(2, '0')
            ).join(''));
          }, reject);
        });
      }

      // 计算nonce
      async function process(data, difficulty = 4) {
        let hash;
        let nonce = 0;
        const targetSubStr = Array(difficulty + 1).join('0');

        do {
          nonce += 1;
          hash = await sha512(data + nonce);
        } while (hash.substr(0, difficulty) !== targetSubStr);
        
        return nonce;
      }

      // 获取挑战数据
      const cha = document.querySelector("#cha").value;
      
      // 计算解决方案
      const sol = await process(cha);
      
      // 填充解决方案
      document.querySelector("#sol").value = sol;
      
      return true;
    });

    if (solved) {
      console.log('挑战计算完成，提交表单...');
      
      // 提交表单
      await page.evaluate(() => {
        document.querySelector("#sec").requestSubmit();
      });

      // 等待页面跳转和加载
      await page.waitForNavigation({ 
        waitUntil: 'networkidle2',
        timeout: 30000 
      });

      console.log('✓ 挑战解决成功，页面已加载');
      return true;
    }

    return false;
  } catch (error) {
    console.error('解决挑战失败:', error.message);
    return false;
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
    
    // 添加更多的请求头来模拟真实浏览器
    await page.setExtraHTTPHeaders({
      'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      'Upgrade-Insecure-Requests': '1',
      'Cache-Control': 'max-age=0'
    });
    
    // 添加 cookies 来绕过部分反爬虫检测
    await page.setCookie({
      name: 'll',
      value: '1082896593',
      domain: '.douban.com',
      path: '/'
    });
    
    const host = type === 'movie' ? 'movie' : type === 'book' ? 'book' : 'music';
    const pageUrl = `https://${host}.douban.com/subject/${doubanId}/`;
    
    // 添加随机延迟以避免过于频繁的请求
    await new Promise(resolve => setTimeout(resolve, Math.random() * 2000 + 1000));
    
    // 先加载页面（不等待networkidle2，因为可能会被挑战拦截）
    await page.goto(pageUrl, {
      waitUntil: 'domcontentloaded',
      timeout: 30000
    });

    // 解决挑战（如果有）
    const challengeSolved = await solveDoubanChallenge(page);
    
    if (!challengeSolved) {
      console.error('无法解决豆瓣挑战');
      await browser.close();
      return null;
    }
    
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

      // 改进封面图提取逻辑 - 增强版
      let coverUrl = '';
      
      // 尝试多种选择器来获取封面图
      const coverSelectors = [
        '#mainpic img',
        '#mainpic a img',
        'a.nbg img',
        '.nbg img',
        'img[alt*="封面"]',
        'img[src*="doubanio.com"]'
      ];
      
      for (const selector of coverSelectors) {
        const img = document.querySelector(selector);
        if (img) {
          coverUrl = img.getAttribute('src') || img.getAttribute('data-lazy') || img.getAttribute('data-src');
          if (coverUrl && !coverUrl.includes('default')) {
            break;
          }
        }
      }
      
      // 如果还没找到，尝试从链接获取
      if (!coverUrl || coverUrl.includes('default')) {
        const coverLink = document.querySelector('#mainpic a');
        if (coverLink) {
          coverUrl = coverLink.getAttribute('href');
        }
      }
      
      // 清理豆瓣图片 URL（移除 douban.com 的反盗链参数）
      if (coverUrl && coverUrl.includes('douban.com')) {
        coverUrl = coverUrl.replace(/\?.*$/, ''); // 移除查询参数
      }
      
      // 确保使用 HTTPS
      if (coverUrl && coverUrl.startsWith('http://')) {
        coverUrl = coverUrl.replace('http://', 'https://');
      }

      let releaseDate = '';
      let director = [];
      let actors = [];
      let author = [];
      let artist = [];
      let publisher = [];
      
      // DEBUG: 返回原始HTML用于调试
      const debugInfoHtml = document.getElementById('info') ? document.getElementById('info').innerHTML.substring(0, 3000) : 'No info div';

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
          // 获取所有包含.pl类的span元素（这些是字段标签）
          const labelSpans = infoDiv.querySelectorAll('span.pl');
          
          for (const labelSpan of labelSpans) {
            const labelText = labelSpan.textContent.trim();
            
            // 匹配出版年
            if (labelText.includes('出版年')) {
              // 获取span后面的文本节点
              let nextNode = labelSpan.nextSibling;
              while (nextNode) {
                if (nextNode.nodeType === Node.TEXT_NODE) {
                  const yearMatch = nextNode.textContent.match(/(\d{4}(-\d{1,2}(-\d{1,2})?)?)/);
                  if (yearMatch) {
                    releaseDate = yearMatch[0];
                    break;
                  }
                }
                nextNode = nextNode.nextSibling;
              }
            }
            
            // 匹配作者
            if (labelText === '作者' || labelText === '作者:') {
              // 尝试获取链接形式的作者
              const link = labelSpan.nextElementSibling;
              if (link && link.tagName === 'A') {
                author.push(link.textContent.trim());
              } else {
                // 如果是纯文本，获取下一个文本节点
                let nextNode = labelSpan.nextSibling;
                while (nextNode) {
                  if (nextNode.nodeType === Node.TEXT_NODE) {
                    const authorText = nextNode.textContent.trim().replace(/^[:：]\s*/, '');
                    if (authorText && authorText.length > 0) {
                      author.push(authorText);
                      break;
                    }
                  }
                  nextNode = nextNode.nextSibling;
                }
              }
            }
            
            // 匹配出版社 - 改进版：支持链接和纯文本两种形式
            if (labelText === '出版社' || labelText === '出版社:') {
              // 首先尝试获取链接形式的出版社
              const link = labelSpan.nextElementSibling;
              if (link && link.tagName === 'A') {
                publisher.push(link.textContent.trim());
              } else {
                // 如果是纯文本，获取span后面的直接文本节点
                let nextNode = labelSpan.nextSibling;
                while (nextNode) {
                  if (nextNode.nodeType === Node.TEXT_NODE) {
                    const pubText = nextNode.textContent.trim();
                    // 清理文本：移除冒号、空格等
                    const cleanedText = pubText.replace(/^[:：]\s*/, '').replace(/\s+/g, ' ').trim();
                    
                    // 检查是否是有效的出版社名称（不是空字符串，不包含特定关键词）
                    if (cleanedText && 
                        cleanedText.length > 0 && 
                        !cleanedText.includes('出品方') && 
                        !cleanedText.includes('原作名') && 
                        !cleanedText.includes('ISBN') &&
                        !cleanedText.includes('统一书号') &&
                        !cleanedText.includes('定价') &&
                        !cleanedText.includes('页数') &&
                        !cleanedText.includes('装帧')) {
                      publisher.push(cleanedText);
                      break;
                    }
                  }
                  nextNode = nextNode.nextSibling;
                }
              }
            }
          }
          
          // 额外的出版社提取逻辑：检查"出品方"作为次要出版社
          const producerLabel = Array.from(infoDiv.querySelectorAll('span.pl')).find(span => 
            span.textContent.trim() === '出品方' || span.textContent.trim() === '出品方:'
          );
          
          if (producerLabel) {
            const producerLink = producerLabel.nextElementSibling;
            if (producerLink && producerLink.tagName === 'A') {
              const producerName = producerLink.textContent.trim();
              if (producerName && !publisher.includes(producerName)) {
                publisher.push(producerName);
              }
            } else {
              // 处理纯文本形式的出品方
              let nextNode = producerLabel.nextSibling;
              while (nextNode) {
                if (nextNode.nodeType === Node.TEXT_NODE) {
                  const producerText = nextNode.textContent.trim().replace(/^[:：]\s*/, '');
                  if (producerText && producerText.length > 0 && !publisher.includes(producerText)) {
                    publisher.push(producerText);
                    break;
                  }
                }
                nextNode = nextNode.nextSibling;
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

        // 改进描述提取 - 根据类型使用不同的选择器
      let desc = '';
      
      if (type === 'movie') {
        // 电影描述：尝试多个选择器
        // 1. 优先从 v:summary 获取
        const summaryEl = document.querySelector('[property="v:summary"]');
        if (summaryEl && summaryEl.textContent.trim()) {
          desc = summaryEl.textContent.trim();
        } else {
          // 2. 尝试从 #link-report-intra 获取（你提供的HTML中的结构）
          const linkReportIntra = document.querySelector('#link-report-intra');
          if (linkReportIntra && linkReportIntra.textContent.trim()) {
            desc = linkReportIntra.textContent.trim();
          } else {
            // 3. 尝试从 .related-info .indent 获取
            const relatedInfoIndent = document.querySelector('.related-info .indent');
            if (relatedInfoIndent && relatedInfoIndent.textContent.trim()) {
              desc = relatedInfoIndent.textContent.trim();
            } else {
              // 4. 尝试从任何包含 "剧情简介" 的 h2 附近的区域获取
              const allH2 = document.querySelectorAll('h2');
              for (const h2 of allH2) {
                if (h2.textContent.includes('剧情简介')) {
                  const parent = h2.closest('.related-info, .indent');
                  if (parent) {
                    desc = parent.textContent.trim();
                    break;
                  }
                }
              }
            }
          }
        }
      } else if (type === 'book') {
        // 书籍描述：从 .intro div 获取
        const introDiv = document.querySelector('.intro, #link-report .intro, .indent .intro');
        if (introDiv && introDiv.textContent.trim()) {
          // 获取所有段落并拼接
          const paragraphs = introDiv.querySelectorAll('p');
          if (paragraphs.length > 0) {
            desc = Array.from(paragraphs).map(p => p.textContent.trim()).join('\n\n');
          } else {
            desc = introDiv.textContent.trim();
          }
        } else {
          // 备用：尝试从其他位置获取
          const summaryAll = document.querySelector('.related-info .all.hidden, .summary .all.hidden');
          if (summaryAll && summaryAll.textContent.trim()) {
            desc = summaryAll.textContent.trim();
          }
        }
      } else if (type === 'album') {
        // 专辑描述：从相关区域获取
        const summaryEl = document.querySelector('[property="v:summary"]');
        if (summaryEl && summaryEl.textContent.trim()) {
          desc = summaryEl.textContent.trim();
        } else {
          const relatedInfo = document.querySelector('.related-info');
          if (relatedInfo && relatedInfo.textContent.trim()) {
            desc = relatedInfo.textContent.trim();
          }
        }
      }
      
      // 清理和限制描述长度
      
      if (desc) {
        // 移除多余的空格和换行
        desc = desc.replace(/\s+/g, ' ').trim();
        // 限制描述长度
        if (desc.length > 500) {
          desc = desc.substring(0, 500) + '...';
        }
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

    // 备用方法：如果publisher为空，尝试从HTML中用正则表达式提取
    console.log(`[DEBUG] 检查出版社提取: type=${type}, publisher=${JSON.stringify(data.publisher)}, length=${data.publisher ? data.publisher.length : 'N/A'}`);
    
    if (type === 'book' && (!data.publisher || data.publisher.length === 0)) {
      console.log('[DEBUG] 条件满足，开始备用提取...');
      try {
        const html = await page.content();
        console.log(`[DEBUG] HTML长度: ${html.length}`);
        
        // 匹配模式：<span class="pl">出版社:</span> XXX<br/> 或 <span class="pl">出版社:</span> XXX
        const publisherMatch = html.match(/<span\s+class="pl">出版社:<\/span>\s*([^<\n]+)/);
        console.log(`[DEBUG] 正则匹配结果: ${publisherMatch ? `"${publisherMatch[1]}"` : 'null'}`);
        
        if (publisherMatch && publisherMatch[1]) {
          const extractedPublisher = publisherMatch[1].trim();
          console.log(`[DEBUG] 提取的出版社: "${extractedPublisher}"`);
          
          if (extractedPublisher && extractedPublisher.length > 0) {
            console.log(`[SUCCESS] 通过正则表达式提取到出版社: ${extractedPublisher}`);
            data.publisher = [extractedPublisher];
          } else {
            console.log('[DEBUG] 提取的出版社为空字符串');
          }
        } else {
          console.log('[DEBUG] 主正则未匹配，尝试备用模式...');
          // 尝试其他可能的模式
          const altMatch = html.match(/出版社[:：]\s*([^<\n]+)/);
          if (altMatch && altMatch[1]) {
            const altPublisher = altMatch[1].trim();
            console.log(`[SUCCESS] 通过备用模式提取到出版社: ${altPublisher}`);
            data.publisher = [altPublisher];
          } else {
            console.log('[FAILED] 所有正则表达式都未匹配到出版社');
          }
        }
      } catch (error) {
        console.log(`[ERROR] 备用出版社提取失败: ${error.message}`);
        console.log(error.stack);
      }
    } else {
      console.log('[DEBUG] 条件不满足，跳过备用提取');
    }

    await browser.close();

    if (!data.title) {
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
      url: url || pageUrl,
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

  if (parsed.type === 'book') {
    // 如果作者或出版社为空，需要刷新
    if (!item.author || !item.publisher || item.publisher.length === 0) {
      return true;
    }
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
        // 正在处理URL（日志已移除）
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
      // 处理完成（日志已移除）
    }
    
    console.log('所有数据处理完成！');
  } catch (error) {
    console.error('处理过程中出现错误:', error);
    process.exit(1);
  }
}

// 运行主函数
await main();
