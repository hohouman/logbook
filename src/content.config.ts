import { defineCollection, z } from 'astro:content';

// 游戏、电影、书籍、专辑的元数据 schema
const mediaSchema = z.object({
  id: z.string(),
  title: z.string(),
  developer: z.array(z.string()).optional().default([]),
  publisher: z.array(z.string()).optional().default([]),
  director: z.array(z.string()).optional().default([]),
  author: z.array(z.string()).optional().default([]),
  artist: z.array(z.string()).optional().default([]),
  releaseDate: z.string().optional().default(''),
  description: z.string().optional().default(''),
  coverUrl: z.string(),
  posterUrl: z.string().optional(),
  localCoverPath: z.string().optional(),
  localPosterPath: z.string().optional(),
  type: z.enum(['game', 'movie', 'book', 'album']),
  platform: z.enum(['steam', 'epic', 'douban', 'musicbrainz'])
});

// 博客文章 schema
const postSchema = z.object({
  title: z.string(),
  pubDate: z.date().optional(),
  description: z.string().optional(),
  tags: z.array(z.string()).optional(),
  author: z.string().optional(),
  image: z.string().optional(),
});

export const collections = {
  // 自动生成的媒体数据
  games: defineCollection({ 
    loader: () => import('./content/_generated/games.json').then(m => m.default),
    schema: mediaSchema.extend({ type: z.literal('game') })
  }),
  movies: defineCollection({ 
    loader: () => import('./content/_generated/movies.json').then(m => m.default),
    schema: mediaSchema.extend({ type: z.literal('movie') })
  }),
  books: defineCollection({ 
    loader: () => import('./content/_generated/books.json').then(m => m.default),
    schema: mediaSchema.extend({ type: z.literal('book') })
  }),
  albums: defineCollection({ 
    loader: () => import('./content/_generated/albums.json').then(m => m.default),
    schema: mediaSchema.extend({ type: z.literal('album') })
  }),
  // 博客文章
  posts: defineCollection({ 
    type: 'content',
    schema: postSchema 
  }),
};
