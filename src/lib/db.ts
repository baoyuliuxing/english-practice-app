import { openDB, type IDBPDatabase } from 'idb';
import type { PracticeSession, VocabItem } from '@/types';

const DB_NAME = 'english-practice-db';
const DB_VERSION = 2; // 升级到 v2，新增词汇表 store
const STORE_SESSIONS = 'sessions';
const STORE_VOCAB = 'vocabulary';

let dbPromise: Promise<IDBPDatabase> | null = null;

function getDB(): Promise<IDBPDatabase> {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db, oldVersion) {
        if (!db.objectStoreNames.contains(STORE_SESSIONS)) {
          db.createObjectStore(STORE_SESSIONS, { keyPath: 'id' });
        }
        if (oldVersion < 2 && !db.objectStoreNames.contains(STORE_VOCAB)) {
          db.createObjectStore(STORE_VOCAB, { keyPath: 'id' });
        }
      }
    });
  }
  return dbPromise;
}

// ── 会话 CRUD ──────────────────────────────────────────

export async function saveSession(session: PracticeSession): Promise<void> {
  const db = await getDB();
  // 自动关联日期
  if (!session.date) {
    session.date = formatDate(new Date(session.createdAt));
  }
  await db.put(STORE_SESSIONS, session);
}

export async function getSession(id: string): Promise<PracticeSession | undefined> {
  const db = await getDB();
  return db.get(STORE_SESSIONS, id);
}

export async function getAllSessions(): Promise<PracticeSession[]> {
  const db = await getDB();
  const all = await db.getAll(STORE_SESSIONS);
  // 按更新时间倒序
  return all.sort((a, b) => b.updatedAt - a.updatedAt);
}

/** 按日期获取会话 */
export async function getSessionsByDate(dateStr: string): Promise<PracticeSession[]> {
  const all = await getAllSessions();
  return all.filter(s => s.date === dateStr);
}

export async function deleteSession(id: string): Promise<void> {
  const db = await getDB();
  await db.delete(STORE_SESSIONS, id);
  // 同时删除关联词汇
  const vocab = await getAllVocab();
  const toDelete = vocab.filter(v => v.sessionId === id);
  for (const v of toDelete) {
    await deleteVocab(v.id);
  }
}

// ── 词汇本 CRUD ────────────────────────────────────────

export async function addVocabItem(item: VocabItem): Promise<void> {
  const db = await getDB();
  await db.put(STORE_VOCAB, item);
}

export async function getAllVocab(): Promise<VocabItem[]> {
  const db = await getDB();
  const all = await db.getAll(STORE_VOCAB);
  return all.sort((a, b) => b.addedAt - a.addedAt);
}

export async function getVocabBySession(sessionId: string): Promise<VocabItem[]> {
  const all = await getAllVocab();
  return all.filter(v => v.sessionId === sessionId);
}

export async function updateVocabMastered(id: string, mastered: boolean): Promise<void> {
  const db = await getDB();
  const item = await db.get(STORE_VOCAB, id);
  if (item) {
    item.mastered = mastered;
    item.reviewCount = (item.reviewCount || 0) + 1;
    await db.put(STORE_VOCAB, item);
  }
}

export async function deleteVocab(id: string): Promise<void> {
  const db = await getDB();
  await db.delete(STORE_VOCAB, id);
}

// ── 工具函数 ────────────────────────────────────────────

export function createSession(): PracticeSession {
  const now = Date.now();
  return {
    id: `session-${now}-${Math.random().toString(36).slice(2, 8)}`,
    title: new Date(now).toLocaleString('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }),
    createdAt: now,
    updatedAt: now,
    date: formatDate(new Date(now)),
    messages: [],
    correctedSentences: [],
    diaryGenerated: false
  };
}

export function genMessageId(): string {
  return `msg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function genVocabId(): string {
  return `vocab-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

export function formatDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function parseDate(dateStr: string): Date {
  return new Date(dateStr + 'T00:00:00');
}

/** 获取某月所有日期 */
export function getMonthDays(year: number, month: number): Date[] {
  const days: Date[] = [];
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  for (let d = new Date(firstDay); d <= lastDay; d.setDate(d.getDate() + 1)) {
    days.push(new Date(d));
  }
  return days;
}

/** 获取某月第一天是星期几（0=周日） */
export function getMonthFirstDayOfWeek(year: number, month: number): number {
  return new Date(year, month, 1).getDay();
}
