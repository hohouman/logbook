/**
 * 主题色与选中文字色：从 hero 壁纸采样主色调，写入 CSS 变量，
 * 并随滚动淡出 hero。此模块只在浏览器端运行。
 */

const FALLBACK_COLOR = '#8f4e2b';
const DEFAULT_BG = '#f4efe6';
const DEFAULT_INK = '#1f1a17';

interface Rgb {
  r: number;
  g: number;
  b: number;
}

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

function hexToRgb(hex: string): Rgb | null {
  const normalized = hex.replace('#', '');
  if (normalized.length !== 6) return null;
  return {
    r: Number.parseInt(normalized.slice(0, 2), 16),
    g: Number.parseInt(normalized.slice(2, 4), 16),
    b: Number.parseInt(normalized.slice(4, 6), 16),
  };
}

const rgbToHex = (r: number, g: number, b: number): string =>
  `#${[r, g, b]
    .map((value) => Math.round(clamp(value, 0, 255)).toString(16).padStart(2, '0'))
    .join('')}`;

/** 背景色与文字色按透明度混合，得到可读的选中背景色 */
function mixSelectionColor(bg: Rgb, ink: Rgb, opacity = 0.2): string {
  const r = Math.round(bg.r * (1 - opacity) + ink.r * opacity);
  const g = Math.round(bg.g * (1 - opacity) + ink.g * opacity);
  const b = Math.round(bg.b * (1 - opacity) + ink.b * opacity);
  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
}

/** 从图片采样平均色作为主题色 */
async function sampleThemeColor(url: string): Promise<string> {
  try {
    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.src = url;

    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = reject;
    });

    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    if (!context) return FALLBACK_COLOR;

    const size = 64;
    canvas.width = size;
    canvas.height = size;
    context.drawImage(image, 0, 0, size, size);

    const { data } = context.getImageData(0, 0, size, size);
    let red = 0;
    let green = 0;
    let blue = 0;
    let count = 0;

    for (let index = 0; index < data.length; index += 16) {
      red += data[index];
      green += data[index + 1];
      blue += data[index + 2];
      count += 1;
    }

    if (count === 0) return FALLBACK_COLOR;
    return rgbToHex(red / count, green / count, blue / count);
  } catch {
    return FALLBACK_COLOR;
  }
}

function readCssColor(name: string, fallback: string): string {
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return value.startsWith('#') ? value : fallback;
}

async function applyThemeColor(wallpaper: string): Promise<void> {
  const root = document.documentElement;
  const color = await sampleThemeColor(wallpaper);
  const rgb = hexToRgb(color);
  if (!rgb) return;

  const rgbTuple = `${rgb.r}, ${rgb.g}, ${rgb.b}`;
  root.style.setProperty('--theme-color', color);
  root.style.setProperty('--theme-color-rgb', rgbTuple);
  root.style.setProperty('--theme-surface', `rgba(${rgbTuple}, 0.14)`);
  root.style.setProperty('--theme-surface-strong', `rgba(${rgbTuple}, 0.24)`);

  const bg = hexToRgb(readCssColor('--bg', DEFAULT_BG));
  const ink = hexToRgb(readCssColor('--ink', DEFAULT_INK));
  if (bg && ink) {
    root.style.setProperty('--selection-bg', mixSelectionColor(bg, ink, 0.2));
  }
}

function createHeroOpacityUpdater() {
  const root = document.documentElement;
  return () => {
    const limit = Math.max(window.innerHeight * 0.9, 1);
    const value = Math.max(0.28, 1 - window.scrollY / limit);
    root.style.setProperty('--hero-opacity', String(value));
  };
}

/**
 * 初始化主题：采样壁纸主色 + 绑定滚动淡出。
 * @param wallpaper hero 壁纸 URL
 */
export function initTheme(wallpaper: string): void {
  const updateHeroOpacity = createHeroOpacityUpdater();

  const start = () => {
    void applyThemeColor(wallpaper);
    updateHeroOpacity();
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true });
  } else {
    start();
  }

  window.addEventListener('scroll', updateHeroOpacity, { passive: true });
  window.addEventListener('resize', updateHeroOpacity);
}
