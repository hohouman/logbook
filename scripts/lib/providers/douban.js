import { delay } from '../util.js';

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

/**
 * 解决豆瓣的 SHA-512 工作量证明挑战（若存在）。
 * @returns {Promise<boolean>} 是否可继续（无挑战或已解决）
 */
async function solveChallenge(page) {
  try {
    if (!(await page.$('#sec'))) return true; // 无挑战

    console.log('检测到豆瓣反爬挑战，正在解算...');
    const solved = await page.evaluate(async () => {
      const sha512 = (str) =>
        crypto.subtle
          .digest('SHA-512', new TextEncoder().encode(str).buffer)
          .then((buf) =>
            Array.from(new Uint8Array(buf))
              .map((c) => c.toString(16).padStart(2, '0'))
              .join(''),
          );

      const process = async (data, difficulty = 4) => {
        const target = '0'.repeat(difficulty);
        let nonce = 0;
        let hash;
        do {
          nonce += 1;
          hash = await sha512(data + nonce);
        } while (hash.slice(0, difficulty) !== target);
        return nonce;
      };

      const cha = document.querySelector('#cha').value;
      document.querySelector('#sol').value = await process(cha);
      return true;
    });

    if (!solved) return false;

    await page.evaluate(() => document.querySelector('#sec').requestSubmit());
    await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 });
    console.log('✓ 挑战已解决');
    return true;
  } catch (error) {
    console.error(`解决豆瓣挑战失败: ${error.message}`);
    return false;
  }
}

/** 在页面上下文中提取条目信息（DOM 解析） */
function extractInPage(type) {
  const extractText = (selector) => {
    const el = document.querySelector(selector);
    return el ? el.textContent.trim() : '';
  };

  const titleEl = document.querySelector('h1 span[property="v:itemreviewed"]');
  const title = titleEl ? titleEl.textContent.trim() : extractText('h1') || '';

  // ---- 封面 ----
  let coverUrl = '';
  const coverSelectors = [
    '#mainpic img',
    '#mainpic a img',
    'a.nbg img',
    '.nbg img',
    'img[alt*="封面"]',
    'img[src*="doubanio.com"]',
    'img[src*="douban.com"]',
    '#s-lnk-img img',
    '#sync-adaptor-cover img',
  ];
  for (const selector of coverSelectors) {
    const img = document.querySelector(selector);
    if (img) {
      const src = img.getAttribute('src') || img.getAttribute('data-lazy') || img.getAttribute('data-src');
      if (src && !src.includes('default')) {
        coverUrl = src;
        break;
      }
    }
  }
  if (!coverUrl || coverUrl.includes('default')) {
    const coverLink = document.querySelector('#mainpic a');
    if (coverLink) coverUrl = coverLink.getAttribute('href') || coverUrl;
  }
  if (!coverUrl || coverUrl.includes('default')) {
    const ld = document.querySelector('script[type="application/ld+json"]');
    if (ld) {
      try {
        const json = JSON.parse(ld.textContent);
        if (json.image) coverUrl = json.image;
      } catch {
        /* 忽略 */
      }
    }
  }
  if (coverUrl && coverUrl.includes('douban.com')) coverUrl = coverUrl.replace(/\?.*$/, '');
  if (coverUrl && coverUrl.startsWith('http://')) coverUrl = coverUrl.replace('http://', 'https://');

  let releaseDate = '';
  let director = [];
  let actors = [];
  let author = [];
  let artist = [];
  let publisher = [];

  const textAfterLabel = (labelSpan, cleaner = (t) => t) => {
    let node = labelSpan.nextSibling;
    while (node) {
      if (node.nodeType === Node.TEXT_NODE) {
        const text = cleaner(node.textContent);
        if (text) return text;
      }
      node = node.nextSibling;
    }
    return '';
  };

  if (type === 'movie') {
    const releaseEl = document.querySelector('[property="v:initialReleaseDate"]');
    if (releaseEl) releaseDate = releaseEl.textContent.trim();
    director = Array.from(document.querySelectorAll('[rel="v:directedBy"]')).map((el) => el.textContent.trim());
    actors = Array.from(document.querySelectorAll('[rel="v:starring"]')).map((el) => el.textContent.trim());
  } else if (type === 'book') {
    const info = document.getElementById('info');
    if (info) {
      for (const label of info.querySelectorAll('span.pl')) {
        const text = label.textContent.trim();

        if (text.includes('出版年')) {
          const raw = textAfterLabel(label, (t) => t);
          const m = raw.match(/(\d{4}(-\d{1,2}(-\d{1,2})?)?)/);
          if (m) releaseDate = m[0];
        }

        if (text === '作者' || text === '作者:') {
          const link = label.nextElementSibling;
          if (link && link.tagName === 'A') author.push(link.textContent.trim());
          else {
            const t = textAfterLabel(label, (s) => s.trim().replace(/^[:：]\s*/, ''));
            if (t) author.push(t);
          }
        }

        if (text === '出版社' || text === '出版社:') {
          const link = label.nextElementSibling;
          if (link && link.tagName === 'A') publisher.push(link.textContent.trim());
          else {
            const t = textAfterLabel(label, (s) =>
              s.trim().replace(/^[:：]\s*/, '').replace(/\s+/g, ' '),
            );
            const invalid = ['出品方', '原作名', 'ISBN', '统一书号', '定价', '页数', '装帧'];
            if (t && !invalid.some((k) => t.includes(k))) publisher.push(t);
          }
        }
      }

      const producer = Array.from(info.querySelectorAll('span.pl')).find(
        (s) => s.textContent.trim() === '出品方' || s.textContent.trim() === '出品方:',
      );
      if (producer) {
        const link = producer.nextElementSibling;
        const name =
          link && link.tagName === 'A'
            ? link.textContent.trim()
            : textAfterLabel(producer, (s) => s.trim().replace(/^[:：]\s*/, ''));
        if (name && !publisher.includes(name)) publisher.push(name);
      }
    }
  } else if (type === 'album') {
    const info = document.getElementById('info');
    if (info) {
      for (const span of info.querySelectorAll('span.pl')) {
        const text = span.textContent.trim();

        if (text.includes('发行时间')) {
          const raw = textAfterLabel(span, (t) => t.replace(/\u00a0/g, ' '));
          const m = raw.match(/(\d{4}-\d{2}-\d{2}|\d{4}-\d{2}|\d{4})/);
          if (m) releaseDate = m[0];
        }

        if (text.includes('表演者')) {
          const links = span.parentElement?.querySelectorAll('a') || [];
          artist = Array.from(links).map((a) => a.textContent.trim()).filter(Boolean);
        }

        if (text.includes('出版者')) {
          const t = textAfterLabel(span, (s) => s.replace(/\u00a0/g, ' ').trim());
          if (t && !t.includes('<') && !t.includes('\n')) publisher.push(t);
        }
      }
    }
  }

  // ---- 描述 ----
  let desc = '';
  if (type === 'movie') {
    desc =
      extractText('[property="v:summary"]') ||
      extractText('#link-report-intra') ||
      extractText('.related-info .indent');
    if (!desc) {
      for (const h2 of document.querySelectorAll('h2')) {
        if (h2.textContent.includes('剧情简介')) {
          const parent = h2.closest('.related-info, .indent');
          if (parent) {
            desc = parent.textContent.trim();
            break;
          }
        }
      }
    }
  } else if (type === 'book') {
    const intro = document.querySelector('.intro, #link-report .intro, .indent .intro');
    if (intro) {
      const paragraphs = intro.querySelectorAll('p');
      desc = paragraphs.length
        ? Array.from(paragraphs).map((p) => p.textContent.trim()).join('\n\n')
        : intro.textContent.trim();
    } else {
      desc = extractText('.related-info .all.hidden, .summary .all.hidden');
    }
  } else if (type === 'album') {
    desc = extractText('[property="v:summary"]') || extractText('.related-info');
  }

  if (desc) {
    desc = desc.replace(/\s+/g, ' ').trim();
    if (desc.length > 500) desc = desc.slice(0, 500) + '...';
  }

  return { title, coverUrl, releaseDate, director, actors, author, artist, publisher, description: desc };
}

/**
 * 从豆瓣抓取电影/书籍/专辑数据。复用外部传入的 browser 实例。
 * @param {import('puppeteer').Browser} browser
 * @returns {Promise<object|null>}
 */
export async function getDoubanData(browser, doubanId, type, url) {
  const page = await browser.newPage();
  try {
    await page.setUserAgent(USER_AGENT);
    await page.setViewport({ width: 1920, height: 1080 });
    await page.setExtraHTTPHeaders({
      'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      'Upgrade-Insecure-Requests': '1',
      'Cache-Control': 'max-age=0',
    });
    await page.setCookie({ name: 'll', value: '1082896593', domain: '.douban.com', path: '/' });

    const host = type === 'movie' ? 'movie' : type === 'book' ? 'book' : 'music';
    const pageUrl = `https://${host}.douban.com/subject/${doubanId}/`;

    await delay(Math.random() * 2000 + 1000);
    await page.goto(pageUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });

    if (!(await solveChallenge(page))) {
      console.error('无法解决豆瓣挑战');
      return null;
    }

    await page
      .waitForSelector('#content', { timeout: 10000 })
      .catch(() => console.log('页面加载超时，仍尝试提取'));

    const pageTitle = await page.title();
    if (pageTitle.includes('访问太频繁') || pageTitle.includes('验证码')) {
      console.error(`豆瓣反爬检测: ${pageTitle}`);
      return null;
    }

    const data = await page.evaluate(extractInPage, type);

    // 备用：正则兜底提取书籍出版社
    if (type === 'book' && (!data.publisher || data.publisher.length === 0)) {
      const html = await page.content();
      const match =
        html.match(/<span\s+class="pl">出版社:<\/span>\s*([^<\n]+)/) ||
        html.match(/出版社[:：]\s*([^<\n]+)/);
      if (match?.[1]?.trim()) {
        data.publisher = [match[1].trim()];
        console.log(`豆瓣 ${doubanId}: 正则兜底提取到出版社`);
      }
    }

    if (!data.title) return null;

    return {
      id: doubanId,
      title: data.title,
      developer: data.director?.length ? data.director : data.author || [],
      director: data.director || [],
      author: data.author || [],
      artist: data.artist || [],
      publisher: data.publisher || [],
      releaseDate: data.releaseDate,
      description: data.description,
      coverUrl: data.coverUrl,
      type,
      platform: 'douban',
      url: url || pageUrl,
    };
  } catch (error) {
    console.error(`获取豆瓣${type}数据失败 ${doubanId}: ${error.message}`);
    return null;
  } finally {
    await page.close().catch(() => {});
  }
}
