import gamesData from '../content/_generated/games.json';
import moviesData from '../content/_generated/movies.json';
import booksData from '../content/_generated/books.json';
import albumsData from '../content/_generated/albums.json';

/** 单条媒体条目（游戏 / 电影 / 书籍 / 专辑） */
export interface MediaItem {
  id: string;
  title: string;
  developer?: string[];
  publisher?: string[];
  director?: string[];
  author?: string[];
  artist?: string[];
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

/**
 * 一条卡片 meta 字段的描述。
 * - keys 按优先级取第一个有值的字段
 * - 有 fallback 时始终显示（用 fallback 兜底）；无 fallback 时仅在有值时显示
 */
export interface MetaField {
  label: string;
  keys: (keyof MediaItem)[];
  fallback?: string;
}

export type CollectionKey = 'games' | 'movies' | 'books' | 'albums';

export interface CollectionConfig {
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
  /** 封面来源字段，按优先级取第一个有值的 */
  coverKeys: (keyof MediaItem)[];
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
  /** 原始数据 */
  data: unknown;
  /** 无数据时的占位条目 */
  fallbackItems?: MediaItem[];
}

const RELEASE: MetaField = { label: 'Release', keys: ['releaseDate'], fallback: 'TBA' };

export const collections: Record<CollectionKey, CollectionConfig> = {
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
    data: gamesData,
  },
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
    data: moviesData,
  },
  books: {
    key: 'books',
    navLabel: '小说',
    titleEn: 'Books',
    subtitle: '那些我读过的小说',
    tag: 'Book',
    variant: 'square',
    coverKeys: ['localCoverPath'],
    metaFields: [
      { label: 'Author', keys: ['author', 'developer'], fallback: 'Unknown' },
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
    data: booksData,
  },
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
    data: albumsData,
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
  },
};

/** 有序集合列表（导航、标签页顺序） */
export const collectionList: CollectionConfig[] = [
  collections.games,
  collections.movies,
  collections.books,
  collections.albums,
];

/** 兼容 `[...]` 与 `{ items: [...] }` 两种数据形态 */
function normalize(data: unknown): MediaItem[] {
  if (Array.isArray(data)) return data as MediaItem[];
  const items = (data as { items?: MediaItem[] } | null)?.items;
  return Array.isArray(items) ? items : [];
}

/** 取集合条目；为空且配置了占位条目时返回占位条目 */
export function getCollectionItems(config: CollectionConfig): MediaItem[] {
  const items = normalize(config.data);
  if (items.length === 0 && config.fallbackItems) return config.fallbackItems;
  return items;
}

/** 集合条目数量（不含占位条目） */
export function getCollectionCount(config: CollectionConfig): number {
  return normalize(config.data).length;
}
