/// <reference types="astro/client" />
const generatedModules = import.meta.glob('../content/_generated/*.json', { eager: true }) as Record<
  string,
  { default: unknown }
>;

/** 按集合 key 加载对应的生成数据（与 src/config/<key>.json 同名） */
function loadGenerated(key: string): unknown {
  const mod = generatedModules[`../content/_generated/${key}.json`];
  return mod ? mod.default : [];
}

/* ----------------------------- 领域数据模型 ----------------------------- */

/** 所有媒体条目的公共字段（游戏 / 电影 / 书籍 / 专辑 共享） */
interface MediaBase {
  id: string;
  title: string;
  releaseDate?: string;
  description?: string;
  coverUrl?: string;
  posterUrl?: string;
  localCoverPath?: string;
  localPosterPath?: string;
  type?: 'game' | 'movie' | 'book' | 'album';
  platform?: string;
  url?: string;
}

/** 游戏：开发商 / 发行商 */
export interface GameItem extends MediaBase {
  type?: 'game';
  developer?: string[];
  publisher?: string[];
}

/** 电影：导演 */
export interface MovieItem extends MediaBase {
  type?: 'movie';
  director?: string[];
}

/** 书籍：作者 / 发行商 */
export interface BookItem extends MediaBase {
  type?: 'book';
  author?: string[];
  publisher?: string[];
}

/** 专辑：艺人 / 发行商 */
export interface AlbumItem extends MediaBase {
  type?: 'album';
  artist?: string[];
  publisher?: string[];
}

/** 渲染层联合类型（卡片通过 metaFields / coverKeys 配置决定展示哪些字段） */
export type MediaItem = GameItem | MovieItem | BookItem | AlbumItem;

/* ----------------------------- 集合配置 ----------------------------- */

/**
 * 一条卡片 meta 字段的描述。
 * - keys 按优先级取第一个有值的字段（字符串键，支持各集合的领域字段）
 * - 有 fallback 时始终显示（用 fallback 兜底）；无 fallback 时仅在有值时显示
 */
export interface MetaField {
  label: string;
  keys: string[];
  fallback?: string;
}

export type CollectionKey = 'games' | 'movies' | 'books' | 'albums';

/** 单个集合的展示配置，数据强类型化为对应的领域条目 T */
export interface CollectionConfig<T extends MediaItem = MediaItem> {
  key: CollectionKey;
  /** 导航与标签页文案（中文） */
  navLabel: string;
  /** 英文短标题，用作 eyebrow / hero 大标题 */
  titleEn: string;
  /** 中文副标题 */
  subtitle: string;
  /** 卡片右上角标签 */
  tag: string;
  /** 卡片版式 */
  variant: 'portrait' | 'square';
  /** 封面来源字段，按优先级取第一个有值的（字符串键，支持各集合领域字段） */
  coverKeys: string[];
  /** 卡片 meta 字段 */
  metaFields: MetaField[];
  /** 描述缺省文案 */
  descFallback?: string;
  /** 首页面板长描述 */
  panelDesc: string;
  /** 独立页 section eyebrow */
  libEyebrow: string;
  /** 独立页 section 标题 */
  libTitle: string;
  /** 独立页 hero 胶囊 */
  chips: string[];
  /** hero 是否显示 “N items” 胶囊 */
  showCount: boolean;
  /** 空集合提示 */
  emptyText: string;
  /** 原始数据（领域强类型） */
  data: T[];
  /** 无数据时的占位条目 */
  fallbackItems?: T[];
}

const RELEASE: MetaField = { label: 'Release', keys: ['releaseDate'], fallback: 'TBA' };

export const collections = {
  games: {
    key: 'games',
    navLabel: '游戏',
    titleEn: 'Games',
    subtitle: '那些我玩过的游戏',
    tag: 'Game',
    variant: 'portrait',
    coverKeys: ['localPosterPath', 'localCoverPath'],
    metaFields: [
      { label: 'Developer', keys: ['developer'], fallback: 'Unknown' },
      { label: 'Publisher', keys: ['publisher'], fallback: 'Unknown' },
      RELEASE,
    ],
    descFallback: 'No description provided.',
    panelDesc: '封面和发行信息放在一起，像一排可以随手翻看的游戏盒。',
    libEyebrow: 'Library',
    libTitle: 'My Game Collection',
    chips: ['Steam', 'Cover-first layout'],
    showCount: true,
    emptyText: 'No games added yet. Check back later!',
    data: loadGenerated('games') as GameItem[],
  } as CollectionConfig<GameItem>,

  movies: {
    key: 'movies',
    navLabel: '电影',
    titleEn: 'Movies',
    subtitle: '那些我看过的影片',
    tag: 'Movie',
    variant: 'portrait',
    coverKeys: ['localCoverPath'],
    metaFields: [
      { label: 'Director', keys: ['director'], fallback: 'Unknown' },
      RELEASE,
    ],
    descFallback: 'No description provided.',
    panelDesc: '每一张海报，都是电影的第一句台词。',
    libEyebrow: 'Library',
    libTitle: 'My Movie Collection',
    chips: ['Poster-led cards', 'Cinematic spacing'],
    showCount: true,
    emptyText: 'No movies added yet. Check back later!',
    data: loadGenerated('movies') as MovieItem[],
  } as CollectionConfig<MovieItem>,

  books: {
    key: 'books',
    navLabel: '小说',
    titleEn: 'Books',
    subtitle: '那些我读过的小说',
    tag: 'Book',
    variant: 'square',
    coverKeys: ['localCoverPath'],
    metaFields: [
      { label: 'Author', keys: ['author'], fallback: 'Unknown' },
      { label: 'Publisher', keys: ['publisher'], fallback: 'Unknown' },
      RELEASE,
    ],
    descFallback: 'No description provided.',
    panelDesc: '像书架一样陈列封面、作者和出版时间，安静但容易回看。',
    libEyebrow: 'Library',
    libTitle: 'My Book Collection',
    chips: ['Reading shelf', 'Quiet layout'],
    showCount: true,
    emptyText: 'No books added yet. Check back later!',
    data: loadGenerated('books') as BookItem[],
  } as CollectionConfig<BookItem>,

  albums: {
    key: 'albums',
    navLabel: '专辑',
    titleEn: 'Albums',
    subtitle: '那些我爱听的CD',
    tag: 'Album',
    variant: 'square',
    coverKeys: ['localCoverPath'],
    metaFields: [
      { label: 'Artist', keys: ['artist'] },
      { label: 'Publisher', keys: ['publisher'] },
      { label: 'Release', keys: ['releaseDate'] },
    ],
    panelDesc: '唱片封面、歌手和发行信息并排呈现，保留一点翻专辑的感觉。',
    libEyebrow: 'Music',
    libTitle: 'My Album Notes',
    chips: ['Music notes', 'Listening log', 'Album shelf'],
    showCount: false,
    emptyText: 'No albums added yet. Check back later!',
    data: loadGenerated('albums') as AlbumItem[],
    fallbackItems: [
      {
        id: 'album-note-0',
        title: '正在循环',
        description: '这里以后可以放最近听得最多的专辑、歌单或者一些值得反复回听的作品。',
        type: 'album',
      },
      {
        id: 'album-note-1',
        title: '喜欢的声音',
        description: '偏爱的风格、制作人的名字、某种总会被我反复记住的气质。',
        type: 'album',
      },
      {
        id: 'album-note-2',
        title: '听歌记录',
        description: '我会把专辑页当作比歌单更安静的一种笔记空间。',
        type: 'album',
      },
    ],
  } as CollectionConfig<AlbumItem>,
};

/** 有序集合列表（导航、标签页顺序） */
export const collectionList = [
  collections.games,
  collections.movies,
  collections.books,
  collections.albums,
];

/**
 * “其他”面板的共享文案（首页、other 页、导航共用，单一来源避免重复硬编码）。
 * 字段与集合配置 CollectionConfig 对齐：titleEn/chips 对应 hero，libEyebrow/libTitle 对应 section。
 */
export const OTHER_SECTION = {
  key: 'other',
  navLabel: '其他',
  eyebrow: 'Other',
  /** hero 大标题（与集合页 titleEn 对齐） */
  titleEn: 'Other Interests',
  /** hero 副标题（中文） */
  title: '看起来，你想要更加了解我……',
  /** 首屏描述 */
  desc: 'More about me.',
  /** hero 胶囊（与集合页 chips 对齐） */
  chips: ['Music', 'Travel', 'Tech'],
  /** 独立页 section eyebrow */
  libEyebrow: 'Notes',
  /** 独立页 section 标题 */
  libTitle: 'My Other Interests',
} as const;

/** 生成数据始终是数组；非数组（理论上不会）时回退为空数组 */
function normalize(data: unknown): MediaItem[] {
  return Array.isArray(data) ? (data as MediaItem[]) : [];
}

/** 取集合条目；为空且配置了占位条目时返回占位条目 */
export function getCollectionItems(config: CollectionConfig<MediaItem>): MediaItem[] {
  const items = normalize(config.data);
  if (items.length === 0 && config.fallbackItems) return config.fallbackItems;
  return items;
}

/** 集合条目数量（不含占位条目） */
export function getCollectionCount(config: CollectionConfig<MediaItem>): number {
  return normalize(config.data).length;
}
