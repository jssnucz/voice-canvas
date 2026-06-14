import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '../../services/api';
import { useDiagramStore } from '../../store/diagramStore';
import { buildDiagramState } from '../../services/stateSerializer';
import type { DiagramListItem } from '@shared/types';

export function DiagramHistory() {
  const [open, setOpen] = useState(false);
  const [diagrams, setDiagrams] = useState<DiagramListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveName, setSaveName] = useState('');
  const [backendDown, setBackendDown] = useState(false);
  // Use getState() for imperative store access — no subscription needed.
  // Previously useDiagramStore() without selector subscribed to every store
  // change (including 10Hz audioState), causing unnecessary re-renders.

  const fetchList = useCallback(async () => {
    if (backendDown) return;
    setLoading(true);
    try {
      const list = await apiClient.listDiagrams();
      setDiagrams(list);
      setBackendDown(false);
    } catch {
      setBackendDown(true);
    } finally {
      setLoading(false);
    }
  }, [backendDown]);

  useEffect(() => {
    if (open) fetchList();
  }, [open, fetchList]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const state = useDiagramStore.getState();
      const name = saveName.trim() || `未命名图表 ${new Date().toLocaleString('zh-CN')}`;
      await apiClient.createDiagram({
        name,
        mode: state.mode,
        state: buildDiagramState(state),
      });
      setSaveName('');
      fetchList();
    } catch (err: any) {
      alert('保存失败: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleLoad = async (id: string) => {
    try {
      const diagram = await apiClient.getDiagram(id);
      const st = diagram.state;
      useDiagramStore.getState().clearAll();
      // Restore mode
      useDiagramStore.getState().setMode(diagram.mode);
      // Restore elements one by one
      for (const el of st.elements) {
        useDiagramStore.getState().addElement({
          id: el.id,
          type: el.type,
          label: el.label,
          voiceAliases: el.voiceAliases,
          position: el.position,
          size: el.size,
          style: el.style,
        });
      }
      // Restore edges
      for (const edge of st.edges) {
        useDiagramStore.getState().addEdge(edge);
      }
      if (st.selectedId) useDiagramStore.getState().setSelected(st.selectedId);
      if (st.lastMentionedId) useDiagramStore.getState().setLastMentioned(st.lastMentionedId);
    } catch (err: any) {
      alert('加载失败: ' + err.message);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`确定删除「${name}」吗？`)) return;
    try {
      await apiClient.deleteDiagram(id);
      fetchList();
    } catch (err: any) {
      alert('删除失败: ' + err.message);
    }
  };

  const modeLabel: Record<string, string> = {
    flowchart: '流程图',
    architecture: '架构图',
    sequence: '时序图',
  };

  return (
    <>
      {/* Toggle button */}
      <button
        onClick={() => setOpen(!open)}
        className="absolute left-2 top-2 z-30 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg text-sm transition-colors border border-gray-600"
        title="历史记录"
      >
        {open ? '◀ 收起' : '📋 历史'}
      </button>

      {/* Sidebar */}
      {open && (
        <div className="absolute left-0 top-0 bottom-0 w-72 bg-gray-850 border-r border-gray-700 z-20 flex flex-col"
             style={{ backgroundColor: '#1a1d24' }}>
          {/* Header */}
          <div className="p-3 border-b border-gray-700 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-300">📋 历史记录</h3>
            <button onClick={() => setOpen(false)} className="text-gray-500 hover:text-gray-300 text-lg leading-none">&times;</button>
          </div>

          {/* Save form */}
          <div className="p-3 border-b border-gray-700">
            <div className="flex gap-2">
              <input
                type="text"
                value={saveName}
                onChange={(e) => setSaveName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSave()}
                placeholder="图表名称（可选）"
                className="flex-1 bg-gray-700 text-gray-200 text-sm px-2 py-1.5 rounded border border-gray-600 focus:outline-none focus:border-blue-500"
                disabled={saving || backendDown}
              />
              <button
                onClick={handleSave}
                disabled={saving || backendDown}
                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white text-sm rounded transition-colors shrink-0"
              >
                {saving ? '...' : '保存'}
              </button>
            </div>
          </div>

          {/* List */}
          <div className="flex-1 overflow-y-auto">
            {loading && (
              <div className="p-4 text-center text-gray-500 text-sm">加载中...</div>
            )}
            {backendDown && (
              <div className="p-4 text-center text-gray-400 text-sm">
                ⚠️ 后端未启动<br />
                <span className="text-xs text-gray-500">请先运行 server：cd server && npm run dev</span>
              </div>
            )}
            {!loading && !backendDown && diagrams.length === 0 && (
              <div className="p-4 text-center text-gray-500 text-sm">
                暂无保存的图表<br />
                <span className="text-xs text-gray-600">输入名称后点击"保存"</span>
              </div>
            )}
            {diagrams.map((d) => (
              <div
                key={d.id}
                className="group px-3 py-2.5 border-b border-gray-700/50 hover:bg-gray-800 cursor-pointer transition-colors"
                onClick={() => handleLoad(d.id)}
              >
                <div className="flex items-center justify-between">
                  <div className="truncate flex-1">
                    <div className="text-sm text-gray-200 truncate">{d.name}</div>
                    <div className="text-xs text-gray-500 mt-0.5">
                      {modeLabel[d.mode] || d.mode}
                      <span className="mx-1.5">·</span>
                      {new Date(d.updated_at).toLocaleDateString('zh-CN')}
                    </div>
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDelete(d.id, d.name); }}
                    className="opacity-0 group-hover:opacity-100 text-gray-500 hover:text-red-400 text-sm transition-all"
                    title="删除"
                  >
                    🗑
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
