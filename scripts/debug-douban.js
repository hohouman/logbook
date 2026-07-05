import puppeteer from 'puppeteer';

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

      console.log('挑战解决成功，页面已加载');
      return true;
    }

    return false;
  } catch (error) {
    console.error('解决挑战失败:', error.message);
    return false;
  }
}

/**
 * 获取豆瓣数据（带挑战解决）
 */
async function getDoubanDataWithChallenge(doubanId, type) {
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
    
    console.log(`正在访问豆瓣页面：${pageUrl}`);
    
    // 添加随机延迟以避免过于频繁的请求
    await new Promise(resolve => setTimeout(resolve, Math.random() * 2000 + 1000));
    
    await page.goto(pageUrl, {
      waitUntil: 'domcontentloaded',
      timeout: 30000
    });

    // 解决挑战
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
    console.log(`页面标题: ${pageTitle}`);
    
    if (pageTitle.includes('访问太频繁') || pageTitle.includes('验证码')) {
      console.error(`豆瓣反爬虫检测：${pageTitle}`);
      await browser.close();
      return null;
    }

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

      let title = '';
      let coverUrl = '';
      let releaseDate = '';
      let director = [];
      let actors = [];
      let author = [];
      let artist = [];
      let publisher = [];
      let desc = '';

      if (type === 'movie') {
        title = extractText('[property="v:itemreviewed"]') || extractText('h1 span:first-child');
        coverUrl = extractAttribute('#mainpic img', 'src');
        releaseDate = extractText('[property="v:initialReleaseDate"]');
        
        const directorEls = document.querySelectorAll('[rel="v:directedBy"]');
        director = Array.from(directorEls).map(el => el.textContent.trim());
        
        const actorEls = document.querySelectorAll('[rel="v:starring"]');
        actors = Array.from(actorEls).map(el => el.textContent.trim());
        
        // 电影描述：尝试多个选择器
        const summaryEl = document.querySelector('[property="v:summary"]');
        if (summaryEl && summaryEl.textContent.trim()) {
          desc = summaryEl.textContent.trim();
        } else {
          const linkReportIntra = document.querySelector('#link-report-intra');
          if (linkReportIntra && linkReportIntra.textContent.trim()) {
            desc = linkReportIntra.textContent.trim();
          } else {
            const relatedInfoIndent = document.querySelector('.related-info .indent');
            if (relatedInfoIndent && relatedInfoIndent.textContent.trim()) {
              desc = relatedInfoIndent.textContent.trim();
            }
          }
        }
      } else if (type === 'book') {
        title = extractText('[property="v:itemreviewed"]') || extractText('h1 span');
        coverUrl = extractAttribute('#mainpic img', 'src');
        releaseDate = extractText('[property="v:datePublished"]');
        
        const authorEls = document.querySelectorAll('[rel="v:author"]');
        author = Array.from(authorEls).map(el => el.textContent.trim());
        
        const publisherEl = document.querySelector('.publisher');
        if (publisherEl) {
          publisher = [publisherEl.textContent.trim()];
        }
        
        // 书籍描述：从 .intro div 获取
        const introDiv = document.querySelector('.intro, #link-report .intro, .indent .intro');
        if (introDiv && introDiv.textContent.trim()) {
          const paragraphs = introDiv.querySelectorAll('p');
          if (paragraphs.length > 0) {
            desc = Array.from(paragraphs).map(p => p.textContent.trim()).join('\n\n');
          } else {
            desc = introDiv.textContent.trim();
          }
        }
      } else if (type === 'album') {
        title = extractText('[property="v:itemreviewed"]') || extractText('h1 span');
        coverUrl = extractAttribute('#mainpic img', 'src');
        releaseDate = extractText('[property="v:datePublished"]');
        
        const artistEls = document.querySelectorAll('[rel="v:artist"]');
        artist = Array.from(artistEls).map(el => el.textContent.trim());
        
        const publisherEl = document.querySelector('[property="v:publisher"]');
        if (publisherEl) {
          publisher = [publisherEl.textContent.trim()];
        }
        
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
        desc = desc.replace(/\s+/g, ' ').trim();
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

    await browser.close();

    if (!data.title) {
      console.log(`未找到豆瓣${type} ID ${doubanId} 的数据`);
      return null;
    }

    console.log(`✓ 成功获取${type}数据: ${data.title}`);
    return data;

  } catch (error) {
    console.error(`获取豆瓣${type}数据失败:`, error.message);
    await browser.close();
    return null;
  }
}

// 测试
const testData = await getDoubanDataWithChallenge('26754880', 'movie');
console.log('\n测试结果:', JSON.stringify(testData, null, 2));
