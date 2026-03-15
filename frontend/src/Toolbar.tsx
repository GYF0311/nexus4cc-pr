import { useState, useRef, useEffect, RefObject } from 'react'
import type { Terminal } from '@xterm/xterm'

interface Props {
  sendToWs: (data: string) => void
  scrollToBottom: () => void
  termRef: RefObject<Terminal | null>
  onLogout: () => void
}

interface KeyDef {
  id: string
  label: string
  seq: string
  desc: string
  action?: 'scrollToBottom'
}

const ALL_KEYS: KeyDef[] = [
  { id: 'esc',         label: 'Esc',    seq: '\x1b',     desc: '取消 / Vim Normal' },
  { id: 'tab',         label: 'Tab',    seq: '\t',       desc: '接受建议 / 补全' },
  { id: 'ctrl-c',      label: '^C',     seq: '\x03',     desc: '取消当前输入/生成' },
  { id: 'enter',       label: '↵',      seq: '\r',       desc: '提交' },
  { id: 'up',          label: '↑',      seq: '\x1b[A',   desc: '上一条历史' },
  { id: 'down',        label: '↓',      seq: '\x1b[B',   desc: '下一条历史' },
  { id: 'ctrl-l',      label: '^L',     seq: '\x0c',     desc: '清屏（保留对话）' },
  { id: 'ctrl-r',      label: '^R',     seq: '\x12',     desc: '历史搜索' },
  { id: 'ctrl-d',      label: '^D',     seq: '\x04',     desc: '退出会话 / EOF' },
  { id: 'ctrl-u',      label: '^U',     seq: '\x15',     desc: '删除整行' },
  { id: 'ctrl-k',      label: '^K',     seq: '\x0b',     desc: '删至行尾' },
  { id: 'ctrl-y',      label: '^Y',     seq: '\x19',     desc: '粘贴已删内容' },
  { id: 'ctrl-o',      label: '^O',     seq: '\x0f',     desc: '切换详细输出' },
  { id: 'ctrl-t',      label: '^T',     seq: '\x14',     desc: '任务列表开关' },
  { id: 'ctrl-b',      label: '^B',     seq: '\x02',     desc: '后台任务' },
  { id: 'ctrl-g',      label: '^G',     seq: '\x07',     desc: '在编辑器中打开' },
  { id: 'ctrl-f',      label: '^F',     seq: '\x06',     desc: '终止所有后台 Agent' },
  { id: 'ctrl-j',      label: '^J',     seq: '\x0a',     desc: '换行（多行输入）' },
  { id: 'shift-tab',   label: 'S-Tab',  seq: '\x1b[Z',   desc: '切换权限模式' },
  { id: 'esc-esc',     label: 'EscEsc', seq: '\x1b\x1b', desc: '回滚 / 总结' },
  { id: 'alt-b',       label: 'M-B',    seq: '\x1bb',    desc: '向后移动一词' },
  { id: 'alt-f',       label: 'M-F',    seq: '\x1bf',    desc: '向前移动一词' },
  { id: 'slash',       label: '/',      seq: '/',        desc: '斜杠命令' },
  { id: 'bang',        label: '!',      seq: '!',        desc: 'Bash 模式' },
  { id: 'at',          label: '@',      seq: '@',        desc: '文件路径补全' },
  { id: 'yes',         label: 'Yes',    seq: 'yes\r',    desc: '输入 yes 并确认' },
  { id: 'no',          label: 'No',     seq: 'no\r',     desc: '输入 no 并确认' },
  { id: 'tmux-new',    label: '＋W',    seq: '\x02c',    desc: 'tmux: 新窗口' },
  { id: 'tmux-prev',   label: '←W',    seq: '\x02p',    desc: 'tmux: 上一窗口' },
  { id: 'tmux-next',   label: '→W',    seq: '\x02n',    desc: 'tmux: 下一窗口' },
  { id: 'tmux-list',   label: '☰W',    seq: '\x02w',    desc: 'tmux: 窗口列表' },
  { id: 'tmux-rename', label: '✎W',    seq: '\x02,',    desc: 'tmux: 重命名窗口' },
  { id: 'scroll-btm',  label: '↓↓',    seq: '',         desc: '滚动到底部', action: 'scrollToBottom' },
]

const KEY_MAP = Object.fromEntries(ALL_KEYS.map(k => [k.id, k]))

const DEFAULT_PINNED   = ['esc', 'tab', 'ctrl-c', 'up', 'down', 'enter', 'ctrl-l', 'ctrl-r']
const DEFAULT_EXPANDED = [
  'ctrl-d', 'ctrl-u', 'ctrl-k', 'ctrl-y', 'ctrl-b', 'ctrl-o', 'ctrl-t',
  'ctrl-f', 'ctrl-g', 'ctrl-j', 'shift-tab', 'esc-esc',
  'alt-b', 'alt-f', 'slash', 'bang', 'at', 'yes', 'no',
  'tmux-new', 'tmux-prev', 'tmux-next', 'tmux-list', 'tmux-rename', 'scroll-btm',
]

const CONFIG_KEY = 'nexus_toolbar_v2'
const COLLAPSED_KEY = 'nexus_toolbar_collapsed'

interface Config { pinned: string[]; expanded: string[] }

function loadConfig(): Config {
  try {
    const s = localStorage.getItem(CONFIG_KEY)
    if (s) return JSON.parse(s)
  } catch {}
  return { pinned: [...DEFAULT_PINNED], expanded: [...DEFAULT_EXPANDED] }
}
function saveConfig(c: Config) { localStorage.setItem(CONFIG_KEY, JSON.stringify(c)) }

// ---- 拖拽状态 ----
interface DragState {
  section: 'pinned' | 'expanded'
  fromIdx: number
  toIdx: number
  startY: number
  currentY: number
}

const ITEM_HEIGHT = 48 // px，每行编辑项高度

export default function Toolbar({ sendToWs, scrollToBottom, onLogout }: Props) {
  const [config, setConfig]       = useState<Config>(loadConfig)
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem(COLLAPSED_KEY) === 'true')
  const [editing, setEditing]     = useState(false)
  const [drag, setDrag]           = useState<DragState | null>(null)
  const rootRef = useRef<HTMLDivElement>(null)
  const editScrollRef = useRef<HTMLDivElement>(null)

  // 根元素：阻止 touchstart 默认行为，防止键盘弹出
  // React 合成事件是 passive 的，必须用原生监听器才能调用 preventDefault
  useEffect(() => {
    const el = rootRef.current
    if (!el) return
    const prevent = (e: TouchEvent) => e.preventDefault()
    el.addEventListener('touchstart', prevent, { passive: false })
    return () => el.removeEventListener('touchstart', prevent)
  }, [])

  // 编辑区滚动容器：stopPropagation 阻止冒泡到根元素
  // 使根元素的 preventDefault 不影响此区域，浏览器可正常处理滚动
  useEffect(() => {
    const el = editScrollRef.current
    if (!el) return
    const stopProp = (e: TouchEvent) => e.stopPropagation()
    el.addEventListener('touchstart', stopProp, { passive: true })
    return () => el.removeEventListener('touchstart', stopProp)
  }, [editing])

  function updateConfig(next: Config) { setConfig(next); saveConfig(next) }

  function handleKey(key: KeyDef) {
    if (key.action === 'scrollToBottom') scrollToBottom()
    else sendToWs(key.seq)
  }

  function removeKey(section: 'pinned' | 'expanded', id: string) {
    updateConfig({ ...config, [section]: config[section].filter(k => k !== id) })
  }

  function addKey(section: 'pinned' | 'expanded', id: string) {
    if (config[section].includes(id)) return
    updateConfig({ ...config, [section]: [...config[section], id] })
  }

  function resetConfig() {
    updateConfig({ pinned: [...DEFAULT_PINNED], expanded: [...DEFAULT_EXPANDED] })
  }

  // ---- 拖拽逻辑 ----
  function onDragStart(section: 'pinned' | 'expanded', idx: number, clientY: number) {
    setDrag({ section, fromIdx: idx, toIdx: idx, startY: clientY, currentY: clientY })
  }

  function onDragMove(clientY: number) {
    if (!drag) return
    const delta = clientY - drag.startY
    const shift = Math.round(delta / ITEM_HEIGHT)
    const len = config[drag.section].length
    const toIdx = Math.max(0, Math.min(len - 1, drag.fromIdx + shift))
    setDrag(prev => prev ? { ...prev, currentY: clientY, toIdx } : null)
  }

  function onDragEnd() {
    if (!drag || drag.fromIdx === drag.toIdx) { setDrag(null); return }
    const arr = [...config[drag.section]]
    const [item] = arr.splice(drag.fromIdx, 1)
    arr.splice(drag.toIdx, 0, item)
    updateConfig({ ...config, [drag.section]: arr })
    setDrag(null)
  }

  // 拖拽中预览排列
  function getDisplayIds(section: 'pinned' | 'expanded'): string[] {
    if (!drag || drag.section !== section) return config[section]
    const arr = [...config[section]]
    const [item] = arr.splice(drag.fromIdx, 1)
    arr.splice(drag.toIdx, 0, item)
    return arr
  }

  const usedIds = new Set([...config.pinned, ...config.expanded])
  const availableKeys = ALL_KEYS.filter(k => !usedIds.has(k.id))

  // ---- 渲染按键 ----
  function renderKeys(ids: string[]) {
    return (
      <div style={s.row}>
        {ids.map(id => {
          const key = KEY_MAP[id]
          if (!key) return null
          return (
            <button
              key={id}
              style={s.key}
              onPointerDown={(e) => { e.preventDefault(); e.stopPropagation(); handleKey(key) }}
            >
              {key.label}
            </button>
          )
        })}
      </div>
    )
  }

  // ---- 编辑面板 ----
  if (editing) {
    return (
      <div ref={rootRef} style={s.editPanel}>
        {/* 头部 */}
        <div style={s.editHeader}>
          <span style={s.editTitle}>工具栏编辑</span>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onPointerDown={(e) => { e.preventDefault(); resetConfig() }} style={s.editBtnSm}>重置</button>
            <button onPointerDown={(e) => { e.preventDefault(); setEditing(false) }} style={s.editBtnPrimary}>完成</button>
          </div>
        </div>

        {/* 列表 */}
        <div ref={editScrollRef} style={s.editScroll}>
          {(['pinned', 'expanded'] as const).map(section => (
            <div key={section} style={s.editSection}>
              <div style={s.editSectionTitle}>
                {section === 'pinned' ? '📌 固定行（始终显示）' : '📂 展开区'}
              </div>
              {getDisplayIds(section).map((id, idx) => {
                const key = KEY_MAP[id]
                if (!key) return null
                const isDragging = drag?.section === section && drag.toIdx === idx && drag.fromIdx !== idx
                const isSource   = drag?.section === section && drag.fromIdx === idx && drag.fromIdx !== drag.toIdx
                return (
                  <div
                    key={id}
                    style={{
                      ...s.editRow,
                      ...(isDragging ? s.editRowTarget : {}),
                      ...(isSource   ? s.editRowSource : {}),
                    }}
                  >
                    {/* 拖拽手柄 */}
                    <div
                      style={s.dragHandle}
                      onTouchStart={(e) => onDragStart(section, idx, e.touches[0].clientY)}
                      onTouchMove={(e) => onDragMove(e.touches[0].clientY)}
                      onTouchEnd={() => onDragEnd()}
                    >
                      ☰
                    </div>
                    <span style={s.editLabel}>{key.label}</span>
                    <span style={s.editDesc}>{key.desc}</span>
                    <button
                      style={s.removeBtn}
                      onPointerDown={(e) => { e.preventDefault(); removeKey(section, id) }}
                    >
                      ×
                    </button>
                  </div>
                )
              })}
            </div>
          ))}

          {/* 可添加 */}
          {availableKeys.length > 0 && (
            <div style={s.editSection}>
              <div style={s.editSectionTitle}>➕ 可添加</div>
              {availableKeys.map(key => (
                <div key={key.id} style={s.editRow}>
                  <span style={s.editLabel}>{key.label}</span>
                  <span style={s.editDesc}>{key.desc}</span>
                  <div style={{ display: 'flex', gap: 4, marginLeft: 'auto', flexShrink: 0 }}>
                    <button style={s.addBtn} onPointerDown={(e) => { e.preventDefault(); addKey('pinned', key.id) }}>固定</button>
                    <button style={s.addBtn} onPointerDown={(e) => { e.preventDefault(); addKey('expanded', key.id) }}>展开</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    )
  }

  // ---- 正常工具栏 ----
  return (
    <div ref={rootRef} style={s.container}>
      <div style={s.topBar}>
        <button style={s.iconBtn} onPointerDown={(e) => { e.preventDefault(); setCollapsed(v => { const n = !v; localStorage.setItem(COLLAPSED_KEY, String(n)); return n }) }}>
          {collapsed ? '▲' : '▼'}
        </button>
        <button style={s.iconBtn} onPointerDown={(e) => { e.preventDefault(); setEditing(true) }}>✏</button>
        <button style={s.logoutBtn} onPointerDown={(e) => { e.preventDefault(); onLogout() }}>退出</button>
      </div>

      {renderKeys(config.pinned)}

      {!collapsed && (
        <div style={s.expandedRows}>
          {chunk(config.expanded, 8).map((row, i) => (
            <div key={i} style={s.row}>
              {row.map(id => {
                const key = KEY_MAP[id]
                if (!key) return null
                return (
                  <button
                    key={id}
                    style={s.key}
                    onPointerDown={(e) => { e.preventDefault(); e.stopPropagation(); handleKey(key) }}
                  >
                    {key.label}
                  </button>
                )
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function chunk<T>(arr: T[], n: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n))
  return out
}

const s: Record<string, React.CSSProperties> = {
  container: {
    background: '#16213e',
    borderTop: '1px solid #334155',
    userSelect: 'none',
    flexShrink: 0,
  },
  topBar: {
    display: 'flex',
    alignItems: 'center',
    padding: '3px 6px',
    gap: 4,
  },
  iconBtn: {
    background: 'transparent',
    border: 'none',
    color: '#64748b',
    cursor: 'pointer',
    fontSize: 14,
    padding: '4px 8px',
    borderRadius: 4,
  },
  logoutBtn: {
    background: 'transparent',
    border: '1px solid #334155',
    borderRadius: 4,
    color: '#64748b',
    cursor: 'pointer',
    fontSize: 12,
    padding: '2px 8px',
    marginLeft: 'auto',
  },
  row: {
    display: 'flex',
    gap: 4,
    padding: '2px 6px',
    flexWrap: 'wrap',
  },
  expandedRows: { paddingBottom: 4 },
  key: {
    background: '#0f3460',
    border: '1px solid #334155',
    borderRadius: 6,
    color: '#e2e8f0',
    cursor: 'pointer',
    fontSize: 12,
    fontFamily: 'monospace',
    minWidth: 38,
    padding: '6px 7px',
    textAlign: 'center',
    touchAction: 'manipulation',
    WebkitTapHighlightColor: 'transparent',
    flexShrink: 0,
  },
  // ---- 编辑面板 ----
  editPanel: {
    background: '#16213e',
    borderTop: '1px solid #334155',
    flexShrink: 0,
    display: 'flex',
    flexDirection: 'column',
    maxHeight: '55vh',
  },
  editHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '8px 10px',
    borderBottom: '1px solid #334155',
    flexShrink: 0,
  },
  editTitle: { color: '#e2e8f0', fontSize: 14, fontWeight: 600 },
  editScroll: { overflowY: 'auto', flex: 1 },
  editSection: { marginBottom: 4 },
  editSectionTitle: {
    color: '#64748b',
    fontSize: 11,
    padding: '6px 10px 3px',
    letterSpacing: 0.5,
  },
  editRow: {
    display: 'flex',
    alignItems: 'center',
    padding: '0 10px',
    height: ITEM_HEIGHT,
    gap: 8,
    borderBottom: '1px solid #1e293b',
    boxSizing: 'border-box',
  },
  editRowTarget: {
    background: '#1e3a5f',
    borderColor: '#3b82f6',
  },
  editRowSource: {
    opacity: 0.35,
  },
  dragHandle: {
    color: '#475569',
    fontSize: 16,
    cursor: 'grab',
    padding: '8px 4px',
    flexShrink: 0,
    touchAction: 'none',
  },
  editLabel: {
    color: '#e2e8f0',
    fontFamily: 'monospace',
    fontSize: 13,
    minWidth: 48,
    flexShrink: 0,
  },
  editDesc: {
    color: '#64748b',
    fontSize: 11,
    flex: 1,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  removeBtn: {
    background: 'transparent',
    border: 'none',
    color: '#ef4444',
    cursor: 'pointer',
    fontSize: 18,
    padding: '0 2px',
    flexShrink: 0,
    lineHeight: 1,
  },
  addBtn: {
    background: '#0f3460',
    border: '1px solid #334155',
    borderRadius: 4,
    color: '#93c5fd',
    cursor: 'pointer',
    fontSize: 11,
    padding: '4px 8px',
  },
  editBtnSm: {
    background: 'transparent',
    border: '1px solid #334155',
    borderRadius: 4,
    color: '#64748b',
    cursor: 'pointer',
    fontSize: 12,
    padding: '4px 10px',
  },
  editBtnPrimary: {
    background: '#3b82f6',
    border: 'none',
    borderRadius: 4,
    color: '#fff',
    cursor: 'pointer',
    fontSize: 12,
    fontWeight: 600,
    padding: '4px 12px',
  },
}
