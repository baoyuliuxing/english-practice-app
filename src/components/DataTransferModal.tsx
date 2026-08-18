import { useState, useRef, useMemo } from 'react';
import type { PracticeSession, VocabItem } from '@/types';
import {
  exportAllData,
  parseImport,
  importData,
  type ImportStats
} from '@/lib/dataTransfer';

interface Props {
  sessions: PracticeSession[];
  vocabList: VocabItem[];
  onImported: () => Promise<void> | void;
  onClose: () => void;
}

/**
 * 数据导入导出弹窗
 * - 导出：全部练习记录 + 日记 + 生词本 → 复制 / 下载 JSON
 * - 导入：粘贴 JSON 或纯文本日记 → 按 id/单词去重写入
 */
export function DataTransferModal({ sessions, vocabList, onImported, onClose }: Props) {
  const [tab, setTab] = useState<'export' | 'import'>('export');
  const [copied, setCopied] = useState(false);
  const [importText, setImportText] = useState('');
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ImportStats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const diaryCount = useMemo(
    () => sessions.filter(s => s.diaryGenerated && s.diary).length,
    [sessions]
  );

  const exportJson = useMemo(
    () => exportAllData(sessions, vocabList),
    [sessions, vocabList]
  );

  // ── 导出：复制 ────────────────────────────────────────

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(exportJson);
      setCopied(true);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = exportJson;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      setCopied(true);
    }
    setTimeout(() => setCopied(false), 2000);
  };

  // ── 导出：下载文件 ────────────────────────────────────

  const handleDownload = () => {
    const blob = new Blob([exportJson], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `english-practice-backup-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // ── 导入 ──────────────────────────────────────────────

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setImportText(String(reader.result || ''));
      setError(null);
      setResult(null);
    };
    reader.readAsText(file);
  };

  const handleImport = async () => {
    setError(null);
    setResult(null);
    if (!importText.trim()) {
      setError('请先粘贴导出的内容，或选择备份文件');
      return;
    }

    setImporting(true);
    try {
      const parsed = parseImport(importText);
      const stats = await importData(parsed, sessions, vocabList);
      setResult(stats);
      setImportText('');
      await onImported();
    } catch (err: any) {
      setError(err.message || '导入失败，请检查内容格式');
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 animate-fade-in">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg max-h-[85vh] flex flex-col rounded-2xl bg-slate-800 border border-slate-700 shadow-2xl animate-slide-up">
        {/* 标题栏 */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700">
          <h3 className="text-base font-semibold text-slate-100">⇄ 数据导入导出</h3>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg hover:bg-slate-700 flex items-center justify-center text-slate-400"
            aria-label="关闭"
          >
            ✕
          </button>
        </div>

        {/* 标签切换 */}
        <div className="flex px-5 pt-3 gap-2">
          <button
            onClick={() => setTab('export')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              tab === 'export'
                ? 'bg-brand-500 text-white'
                : 'bg-slate-700/50 text-slate-300 hover:bg-slate-700'
            }`}
          >
            导出
          </button>
          <button
            onClick={() => setTab('import')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              tab === 'import'
                ? 'bg-brand-500 text-white'
                : 'bg-slate-700/50 text-slate-300 hover:bg-slate-700'
            }`}
          >
            导入
          </button>
        </div>

        {/* 内容区 */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {tab === 'export' ? (
            <div className="flex flex-col gap-3">
              <p className="text-xs text-slate-400 leading-relaxed">
                导出全部数据：{sessions.length} 条练习记录（含 {diaryCount} 篇日记）、{vocabList.length} 个生词。
                换设备或换访问地址时，先在这里导出，再到新地址导入。
              </p>
              <textarea
                readOnly
                value={exportJson}
                className="w-full h-40 resize-none rounded-xl bg-slate-900 border border-slate-700 p-3 text-[10px] font-mono text-slate-400"
              />
              <div className="flex gap-3">
                <button
                  onClick={handleCopy}
                  className="flex-1 py-2.5 rounded-xl bg-brand-500 hover:bg-brand-600 text-white text-sm font-medium transition-colors"
                >
                  {copied ? '✓ 已复制' : '📋 复制全部'}
                </button>
                <button
                  onClick={handleDownload}
                  className="flex-1 py-2.5 rounded-xl bg-slate-700 hover:bg-slate-600 text-slate-100 text-sm font-medium transition-colors"
                >
                  ⬇ 下载文件
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              <p className="text-xs text-slate-400 leading-relaxed">
                粘贴之前导出的 JSON，或直接粘贴纯文本日记（第一行标题、第二行日期、之后正文）。
                已存在的记录和单词会自动跳过，不会重复。
              </p>
              <textarea
                value={importText}
                onChange={(e) => { setImportText(e.target.value); setError(null); setResult(null); }}
                placeholder="在此粘贴导出的内容…"
                className="w-full h-40 resize-none rounded-xl bg-slate-900 border border-slate-700 p-3 text-xs font-mono text-slate-200 placeholder:text-slate-600"
              />
              <div className="flex items-center gap-3">
                <input
                  ref={fileRef}
                  type="file"
                  accept=".json,.txt"
                  onChange={handleFile}
                  className="hidden"
                />
                <button
                  onClick={() => fileRef.current?.click()}
                  className="flex-1 py-2.5 rounded-xl bg-slate-700 hover:bg-slate-600 text-slate-100 text-sm font-medium transition-colors"
                >
                  📁 选择备份文件
                </button>
                <button
                  onClick={handleImport}
                  disabled={importing}
                  className="flex-1 py-2.5 rounded-xl bg-brand-500 hover:bg-brand-600 text-white text-sm font-medium transition-colors disabled:opacity-50"
                >
                  {importing ? '导入中…' : '⬆ 导入'}
                </button>
              </div>

              {error && (
                <div className="rounded-lg bg-red-500/10 border border-red-500/30 px-3 py-2 text-xs text-red-400">
                  ✗ {error}
                </div>
              )}

              {result && (
                <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/30 px-3 py-2.5 text-xs text-emerald-400 leading-relaxed">
                  ✓ 导入完成
                  {result.sessionImported > 0 && <div>· 练习记录/日记：新增 {result.sessionImported} 条</div>}
                  {result.sessionSkipped > 0 && <div>· 练习记录：跳过已存在 {result.sessionSkipped} 条</div>}
                  {result.vocabImported > 0 && <div>· 生词：新增 {result.vocabImported} 个</div>}
                  {result.vocabSkipped > 0 && <div>· 生词：跳过已存在 {result.vocabSkipped} 个</div>}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
