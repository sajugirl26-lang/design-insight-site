/** Data loading utilities for Astro pages (server-side). */
import fs from 'node:fs';
import path from 'node:path';

const DATA_DIR = path.resolve('public/data');

function readJSON<T>(filename: string): T {
  const filePath = path.join(DATA_DIR, filename);
  const raw = fs.readFileSync(filePath, 'utf-8');
  return JSON.parse(raw) as T;
}

// Types
export interface Insight {
  id: string;
  topic: string;
  topic_ko: string;
  stance: string;
  novelty_raw: string;
  novelty_adjusted?: string;
  actionability: { actionable: boolean; advice?: string };
  text_ko: string;
  keywords: string[];
}

export interface Card {
  video_id: string;
  channel: string;
  channel_group: string;
  title: string;
  title_ko: string;
  published_at: string;
  summary_ko: string;
  summary_short_ko: string;
  categories: string[];
  insights: Insight[];
  keywords: string[];
  youtube_url: string;
  date?: string;
}

export interface Timeline {
  generated_at: string;
  total_cards: number;
  cards: Card[];
}

export interface ChannelInfo {
  id: string;
  name: string;
  url: string;
  group: string;
  subscribers: string;
  description: string;
  total_videos: number;
  total_insights: number;
  latest_date: string;
}

export interface ChannelsData {
  channels: ChannelInfo[];
  groups: Record<string, { name_ko: string; description: string }>;
}

export interface CategoryInfo {
  id: string;
  name_ko: string;
  description: string;
  count: number;
}

export interface SearchItem {
  id: string;
  title: string;
  channel: string;
  summary: string;
  keywords: string[];
  categories: string[];
  date: string;
}

// Data loaders
export function getTimeline(): Timeline {
  return readJSON<Timeline>('timeline.json');
}

export function getChannels(): ChannelsData {
  return readJSON<ChannelsData>('channels.json');
}

export function getCategories(): { categories: CategoryInfo[] } {
  return readJSON<{ categories: CategoryInfo[] }>('categories.json');
}

export function getSearchIndex(): { items: SearchItem[] } {
  return readJSON<{ items: SearchItem[] }>('search.json');
}

export function getKeywords(): Record<string, any> {
  return readJSON<Record<string, any>>('keywords.json');
}
