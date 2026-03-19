import { useEffect, useRef, useCallback, useState } from 'react'
import { Terminal as XTerm, type ITheme } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { WebLinksAddon } from '@xterm/addon-web-links'
import '@xterm/xterm/css/xterm.css'
import Toolbar from './Toolbar'
import TabBar from './TabBar'
import SessionManager from './SessionManager'
import BottomNav from './BottomNav'
import WorkspaceSelector from './WorkspaceSelector'

interface TmuxWindow {
  index: number
  name: string
  active: boolean
}

interface Props {
  token: string
}

const FONT_SIZE_KEY = 'nexus_font_size'
const THEME_KEY = 'nexus_theme'
const TAP_THRESHOLD = 8

export type ThemeMode = 'dark' | 'light'

const DARK_THEME: ITheme = {
  background: '#1a1a2e',
  foreground: '#e2e8f0',
  cursor: '#e2e8f0',
  cursorAccent: '#1a1a2e',
  selectionBackground: '#264f78',
  selectionForeground: '#e2e8f0',
  black: '#1a1a2e',
  brightBlack: '#4a5568',
  red: '#fc8181',
  brightRed: '#feb2b2',
  green: '#68d391',
  brightGreen: '#9ae6b4',
  yellow: '#f6e05e',
  brightYellow: '#faf089',
  blue: '#63b3ed',
  brightBlue: '#90cdf4',
  magenta: '#b794f4',
  brightMagenta: '#d6bcfa',
  cyan: '#76e4f7',
  brightCyan: '#b2f5ea',
  white: '#e2e8f0',
  brightWhite: '#f7fafc',
}

const LIGHT_THEME: ITheme = {
  background: '#ffffff',
  foreground: '#333333',
  cursor: '#333333',
  cursorAccent: '#ffffff',
  selectionBackground: '#add6ff',
  selectionForeground: '#333333',
  black: '#000000',
  brightBlack: '#666666',
  red: '#cd3131',
  brightRed: '#f14c4c',
  green: '#00bc00',
  brightGreen: '#23d18b',
  yellow: '#949800',
  brightYellow: '#f5f543',
  blue: '#0451a5',
  brightBlue: '#3b8eea',
  magenta: '#bc05bc',
  brightMagenta: '#d670d6',
  cyan: '#0598bc',
  brightCyan: '#29b8db',
  white: '#cccccc',
  brightWhite: '#e5e5e5',
}

export const THEMES: Record<ThemeMode, ITheme> = {
  dark: DARK_THEME,
  light: LIGHT_THEME,
}

export function getInitialTheme(): ThemeMode {
  const saved = localStorage.getItem(THEME_KEY)
  if (saved === 'light' || saved === 'dark') return saved
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

// 模块加载时立即初始化 CSS vars，避免首帧颜色错乱
function initCssVars(mode: ThemeMode) {
  const isDark = mode === 'dark'
  const root = document.documentElement
  root.style.setProperty('--nexus-bg', isDark ? '#16213e' : '#f1f5f9')
  root.style.setProperty('--nexus-bg2', isDark ? '#0f3460' : '#dbeafe')
  root.style.setProperty('--nexus-border', isDark ? '#334155' : '#cbd5e1')
  root.style.setProperty('--nexus-text', isDark ? '#e2e8f0' : '#1e293b')
  root.style.setProperty('--nexus-text2', isDark ? '#94a3b8' : '#475569')
  root.style.setProperty('--nexus-muted', isDark ? '#64748b' : '#94a3b8')
  root.style.setProperty('--nexus-tab-active', isDark ? '#0f3460' : '#dbeafe')
  root.style.setProperty('--nexus-sheet-bg', isDark ? '#16213e' : '#f8fafc')
  root.style.setProperty('--nexus-menu-bg', isDark ? '#1e293b' : '#ffffff')
}
initCssVars(getInitialTheme())

// 复制模式覆盖层组件
function CopyModeOverlay({ termRef, themeMode }: { termRef: React.MutableRefObject<XTerm | null>, themeMode: ThemeMode }) {
  const [lines, setLines] = useState<string[]>([])
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const term = termRef.current
    if (!term) return

    // 获取终端缓冲区内容
    const buffer = term.buffer.active
    const lineCount = buffer.length
    const extractedLines: string[] = []

    for (let i = 0; i < lineCount; i++) {
      const line = buffer.getLine(i)
      if (line) {
        extractedLines.push(line.translateToString(true))
      }
    }

    setLines(extractedLines)

    // 滚动到底部
    setTimeout(() => {
      if (scrollRef.current) {
        scrollRef.current.scrollTop = scrollRef.current.scrollHeight
      }
    }, 10)
  }, [termRef])

  const bg = themeMode === 'dark' ? '#1a1a2e' : '#ffffff'
  const fg = themeMode === 'dark' ? '#e2e8f0' : '#333333'
  const fontFamily = 'Menlo, Monaco, "Cascadia Code", "Fira Code", monospace'
  const fontSize = termRef.current?.options.fontSize ?? 14

  return (
    <div
      ref={scrollRef}
      style={{
        position: 'fixed',
        top: 44, // 提示条高度
        left: 0,
        right: 0,
        bottom: 0,
        background: bg,
        color: fg,
        fontFamily,
        fontSize,
        lineHeight: '1.4',
        overflow: 'auto',
        zIndex: 99,
        padding: 8,
        whiteSpace: 'pre',
        userSelect: 'text',
        WebkitUserSelect: 'text',
      }}
      onClick={() => {
        // 点击空白处不关闭，只有点击按钮才关闭
      }}
    >
      {lines.map((line, i) => (
        <div key={i} style={{ minHeight: '1.4em' }}>
          {line || '\u00A0'}
        </div>
      ))}
    </div>
  )
}

function Sidebar({ windows, activeIndex, onSwitch, onClose, onAdd, onOpenSettings }: {
  windows: TmuxWindow[]
  activeIndex: number
  onSwitch: (index: number) => void
  onClose: (index: number) => void
  onAdd: () => void
  onOpenSettings: () => void
}) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)

  return (
    <div style={{
      width: 200,
      flexShrink: 0,
      background: 'var(--nexus-bg)',
      borderRight: '1px solid var(--nexus-border)',
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
    }}>
      <div style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>
        {windows.map(win => (
          <div
            key={win.index}
            style={{
              display: 'flex',
              alignItems: 'center',
              padding: '8px 12px',
              cursor: 'pointer',
              background: win.index === activeIndex ? 'var(--nexus-tab-active)' :
                          hoveredIndex === win.index ? 'var(--nexus-bg2)' : 'transparent',
              borderLeft: win.index === activeIndex ? '3px solid #3b82f6' : '3px solid transparent',
              transition: 'background 0.15s',
              gap: 8,
            }}
            onMouseEnter={() => setHoveredIndex(win.index)}
            onMouseLeave={() => setHoveredIndex(null)}
            onClick={() => onSwitch(win.index)}
          >
            <span style={{
              flex: 1,
              color: win.index === activeIndex ? 'var(--nexus-text)' : 'var(--nexus-text2)',
              fontSize: 13,
              fontFamily: 'Menlo, Monaco, "Cascadia Code", monospace',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              fontWeight: win.index === activeIndex ? 500 : 400,
            }}>{win.name}</span>
            {hoveredIndex === win.index && (
              <button
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#ef4444',
                  cursor: 'pointer',
                  fontSize: 14,
                  padding: '0 2px',
                  flexShrink: 0,
                  opacity: 0.7,
                  lineHeight: 1,
                }}
                onClick={(e) => { e.stopPropagation(); onClose(win.index) }}
                title="关闭"
              >×</button>
            )}
          </div>
        ))}
      </div>
      <div style={{
        borderTop: '1px solid var(--nexus-border)',
        padding: '8px',
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
      }}>
        <button
          style={{
            background: '#3b82f6',
            border: 'none',
            borderRadius: 6,
            color: '#fff',
            cursor: 'pointer',
            fontSize: 13,
            fontWeight: 600,
            padding: '8px 12px',
            width: '100%',
            textAlign: 'left',
          }}
          onClick={onAdd}
        >+ 新建会话</button>
        <button
          style={{
            background: 'transparent',
            border: '1px solid var(--nexus-border)',
            borderRadius: 6,
            color: 'var(--nexus-text2)',
            cursor: 'pointer',
            fontSize: 13,
            padding: '7px 12px',
            width: '100%',
            textAlign: 'left',
          }}
          onClick={onOpenSettings}
        >⚙ 配置管理</button>
      </div>
    </div>
  )
}

export default function Terminal({ token }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const termRef = useRef<XTerm | null>(null)
  const wsRef = useRef<WebSocket | null>(null)
  const userScrolledRef = useRef(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const [windows, setWindows] = useState<TmuxWindow[]>([])
  const [activeWindowIndex, setActiveWindowIndex] = useState(0)
  const [showSettings, setShowSettings] = useState(false)
  const [showNewSession, setShowNewSession] = useState(false)
  const [themeMode, setThemeMode] = useState<ThemeMode>(getInitialTheme)
  const [selectionMode, setSelectionMode] = useState(false)
  const selectionModeRef = useRef(selectionMode)
  selectionModeRef.current = selectionMode
  const [isWidePC, setIsWidePC] = useState(() => typeof window !== 'undefined' && window.innerWidth >= 1024)

  useEffect(() => {
    const check = () => setIsWidePC(window.innerWidth >= 1024)
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  // CSS vars 独立于 xterm，组件 mount 即执行
  const applyCssVars = useCallback((mode: ThemeMode) => {
    const isDark = mode === 'dark'
    const root = document.documentElement
    root.style.setProperty('--nexus-bg', isDark ? '#16213e' : '#f1f5f9')
    root.style.setProperty('--nexus-bg2', isDark ? '#0f3460' : '#dbeafe')
    root.style.setProperty('--nexus-border', isDark ? '#334155' : '#cbd5e1')
    root.style.setProperty('--nexus-text', isDark ? '#e2e8f0' : '#1e293b')
    root.style.setProperty('--nexus-text2', isDark ? '#94a3b8' : '#475569')
    root.style.setProperty('--nexus-muted', isDark ? '#64748b' : '#94a3b8')
    root.style.setProperty('--nexus-tab-active', isDark ? '#0f3460' : '#dbeafe')
    root.style.setProperty('--nexus-sheet-bg', isDark ? '#16213e' : '#f8fafc')
    root.style.setProperty('--nexus-menu-bg', isDark ? '#1e293b' : '#ffffff')
  }, [])

  const applyTheme = useCallback((mode: ThemeMode) => {
    applyCssVars(mode)
    localStorage.setItem(THEME_KEY, mode)
    const term = termRef.current
    if (term) term.options.theme = THEMES[mode]
  }, [applyCssVars])

  const toggleTheme = useCallback(() => {
    const newMode = themeMode === 'dark' ? 'light' : 'dark'
    setThemeMode(newMode)
    applyTheme(newMode)
  }, [themeMode, applyTheme])

  const sendToWs = useCallback((data: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(data)
    }
  }, [])

  useEffect(() => {
    applyTheme(themeMode)
  }, [themeMode, applyTheme])

  // 定期刷新窗口列表（每 2 秒），保持与 tmux 同步
  useEffect(() => {
    const interval = setInterval(fetchWindows, 2000)
    return () => clearInterval(interval)
  }, [])

  const scrollToBottom = useCallback(() => {
    termRef.current?.scrollToBottom()
    userScrolledRef.current = false
  }, [])

  async function fetchWindows() {
    try {
      const r = await fetch('/api/sessions', { headers: { Authorization: `Bearer ${token}` } })
      if (!r.ok) throw new Error(`HTTP ${r.status}`)
      const d = await r.json()
      const wins = d.windows ?? []
      setWindows(wins)
      const active = wins.find((w: TmuxWindow) => w.active)
      if (active) setActiveWindowIndex(active.index)
    } catch {
      // ignore
    }
  }

  async function attachToWindow(index: number) {
    try {
      const r = await fetch(`/api/sessions/${index}/attach`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      })
      if (r.ok) {
        setActiveWindowIndex(index)
      }
    } catch {
      // ignore
    }
  }

  async function closeWindow(index: number) {
    try {
      const r = await fetch(`/api/sessions/${index}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      })
      if (r.ok) {
        await fetchWindows()
      }
    } catch {
      // ignore
    }
  }

  async function createSession(relPath: string, shellType: 'claude' | 'bash' = 'claude', profile?: string) {
    try {
      const r = await fetch('/api/sessions', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ rel_path: relPath, shell_type: shellType, profile }),
      })
      if (r.ok) {
        // 等待一小段时间让 tmux 创建窗口，然后刷新列表
        await new Promise(resolve => setTimeout(resolve, 300))
        await fetchWindows()
      }
    } catch {
      // ignore
    }
  }

  function openNewSessionDialog() {
    setShowNewSession(true)
  }

  function handleCreateSession(path: string, shellType: 'claude' | 'bash', profile?: string) {
    setShowNewSession(false)
    createSession(path, shellType, profile)
  }

  useEffect(() => {
    const fontSize = parseInt(localStorage.getItem(FONT_SIZE_KEY) || '16', 10)
    const initialTheme = getInitialTheme()

    const term = new XTerm({
      theme: THEMES[initialTheme],
      fontSize,
      fontFamily: 'Menlo, Monaco, "Cascadia Code", "Fira Code", monospace',
      scrollback: 10000,
      cursorBlink: true,
      allowProposedApi: true,
    })

    const fitAddon = new FitAddon()
    const webLinksAddon = new WebLinksAddon()
    term.loadAddon(fitAddon)
    term.loadAddon(webLinksAddon)
    termRef.current = term

    const container = containerRef.current!
    term.open(container)
    fitAddon.fit()

    // Enable text selection - use auto for PC, but handle touch events for mobile scrolling
    const viewport = container.querySelector('.xterm-viewport') as HTMLElement
    if (viewport) {
      viewport.style.pointerEvents = 'auto'
      viewport.style.userSelect = 'text'
    }

    // Enable text selection in the terminal screen element
    const screen = container.querySelector('.xterm-screen') as HTMLElement
    if (screen) screen.style.userSelect = 'text'

    term.attachCustomKeyEventHandler((e: KeyboardEvent) => {
      if (e.ctrlKey && ['w', 't', 'n', 'l', 'r'].includes(e.key.toLowerCase())) {
        e.preventDefault()
        return true
      }
      return true
    })

    function getLineHeight(): number {
      const core = (term as any)._core
      const cellH = core?._renderService?.dimensions?.css?.cell?.height
      if (cellH && cellH > 0) return cellH
      const h = container.offsetHeight
      if (h > 0 && term.rows > 0) return h / term.rows
      return 20
    }

    const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:'
    const ws = new WebSocket(`${protocol}//${location.host}/ws?token=${encodeURIComponent(token)}`)
    wsRef.current = ws

    ws.onopen = () => {
      fitAddon.fit()
      ws.send(JSON.stringify({ type: 'resize', cols: term.cols, rows: term.rows }))
      fetchWindows()
    }

    ws.onmessage = (e) => {
      term.write(e.data)
      if (!userScrolledRef.current) term.scrollToBottom()
    }

    ws.onclose = (e) => {
      if (e.code === 4001) {
        term.write('\r\n\x1b[31m[Nexus: 认证失败，请刷新重新登录]\x1b[0m\r\n')
      } else {
        term.write('\r\n\x1b[33m[Nexus: 连接断开，正在重连...]\x1b[0m\r\n')
        setTimeout(() => location.reload(), 3000)
      }
    }

    ws.onerror = () => term.write('\r\n\x1b[31m[Nexus: WebSocket 错误]\x1b[0m\r\n')

    term.onData((data) => ws.send(data))

    let touchStartY = 0
    let touchLastY = 0
    let touchScrollRemainder = 0
    let cachedLineHeight = 20
    let isPinching = false
    let pinchStartDist = 0
    let pinchStartFontSize = fontSize

    function getTouchDist(e: TouchEvent): number {
      const dx = e.touches[0].clientX - e.touches[1].clientX
      const dy = e.touches[0].clientY - e.touches[1].clientY
      return Math.sqrt(dx * dx + dy * dy)
    }

    function onTouchStart(e: TouchEvent) {
      // 复制模式下允许默认行为（文本选择）
      if (selectionModeRef.current) return
      if (e.touches.length === 2) {
        isPinching = true
        pinchStartDist = getTouchDist(e)
        pinchStartFontSize = parseInt(localStorage.getItem(FONT_SIZE_KEY) || '16', 10)
      } else {
        isPinching = false
        touchStartY = e.touches[0].clientY
        touchLastY = e.touches[0].clientY
        touchScrollRemainder = 0
        cachedLineHeight = getLineHeight()
      }
    }

    function onTouchMove(e: TouchEvent) {
      // 复制模式下不处理滚动，允许文本选择
      if (selectionModeRef.current) return
      e.preventDefault()
      if (isPinching && e.touches.length === 2) {
        const dist = getTouchDist(e)
        const scale = dist / pinchStartDist
        const newSize = Math.round(Math.max(8, Math.min(32, pinchStartFontSize * scale)))
        if (newSize !== term.options.fontSize) {
          term.options.fontSize = newSize
          localStorage.setItem(FONT_SIZE_KEY, String(newSize))
          fitAddon.fit()
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'resize', cols: term.cols, rows: term.rows }))
          }
        }
      } else if (!isPinching) {
        const y = e.touches[0].clientY
        const deltaY = touchLastY - y
        touchLastY = y
        touchScrollRemainder += deltaY
        const lines = Math.trunc(touchScrollRemainder / cachedLineHeight)
        if (lines !== 0) {
          touchScrollRemainder -= lines * cachedLineHeight
          term.scrollLines(lines)
          const buffer = (term as any).buffer?.active
          if (buffer) {
            const atBottom = buffer.viewportY >= buffer.baseY
            userScrolledRef.current = !atBottom
            window.dispatchEvent(new CustomEvent('nexus:atbottom', { detail: atBottom }))
          }
        }
      }
    }

    function onTouchEnd(e: TouchEvent) {
      // 复制模式下不处理点击
      if (selectionModeRef.current) return
      if (isPinching) {
        isPinching = false
        return
      }
      const endY = e.changedTouches[0].clientY
      if (Math.abs(endY - touchStartY) < TAP_THRESHOLD) {
        inputRef.current?.focus({ preventScroll: true })
      }
    }

    container.addEventListener('touchstart', onTouchStart, { passive: true })
    container.addEventListener('touchmove', onTouchMove, { passive: false })
    container.addEventListener('touchend', onTouchEnd, { passive: true })

    function sendResize() {
      fitAddon.fit()
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'resize', cols: term.cols, rows: term.rows }))
      }
    }

    function onOrientationChange() {
      setTimeout(sendResize, 300)
    }

    const resizeObserver = new ResizeObserver(sendResize)
    resizeObserver.observe(container)
    window.addEventListener('orientationchange', onOrientationChange)

    return () => {
      resizeObserver.disconnect()
      window.removeEventListener('orientationchange', onOrientationChange)
      container.removeEventListener('touchstart', onTouchStart)
      container.removeEventListener('touchmove', onTouchMove)
      container.removeEventListener('touchend', onTouchEnd)
      ws.close()
      term.dispose()
    }
  }, [token])

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value
    if (val) {
      sendToWs(val)
      e.target.value = ''
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') { e.preventDefault(); sendToWs('\r') }
    else if (e.key === 'Backspace') { e.preventDefault(); sendToWs('\x7f') }
  }

  const toolbarProps = {
    token,
    sendToWs,
    scrollToBottom,
    termRef,
    themeMode,
    onToggleTheme: toggleTheme,
    selectionMode,
    onToggleSelectionMode: () => setSelectionMode(v => !v),
    onOpenSettings: () => setShowSettings(true),
  }

  return (
    <div style={styles.wrapper}>
      {selectionMode && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            padding: '12px 16px',
            background: '#1e3a5f',
            color: '#fff',
            fontSize: 13,
            textAlign: 'center',
            zIndex: 100,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 12,
          }}
        >
          <span>📋 复制模式：长按下方文本选择复制</span>
          <button
            onClick={() => setSelectionMode(false)}
            style={{
              background: '#3b82f6',
              border: 'none',
              borderRadius: 4,
              color: '#fff',
              padding: '4px 12px',
              fontSize: 12,
              cursor: 'pointer',
            }}
          >
            完成
          </button>
        </div>
      )}
      {selectionMode && (
        <CopyModeOverlay
          termRef={termRef}
          themeMode={themeMode}
        />
      )}
      <input
        ref={inputRef}
        style={styles.hiddenInput}
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        spellCheck={false}
        onChange={handleInputChange}
        onKeyDown={handleKeyDown}
        aria-hidden="true"
      />

      {isWidePC ? (
        <div style={{ display: 'flex', flex: 1, overflow: 'hidden', minHeight: 0 }}>
          <Sidebar
            windows={windows}
            activeIndex={activeWindowIndex}
            onSwitch={attachToWindow}
            onClose={closeWindow}
            onAdd={openNewSessionDialog}
            onOpenSettings={() => setShowSettings(true)}
          />
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
            <Toolbar {...toolbarProps} />
            <div ref={containerRef} style={styles.terminal} />
          </div>
        </div>
      ) : (
        <>
          <TabBar
            windows={windows}
            activeIndex={activeWindowIndex}
            onSwitch={attachToWindow}
            onClose={closeWindow}
            onAdd={openNewSessionDialog}
            onOpenSettings={() => setShowSettings(true)}
          />
          <div ref={containerRef} style={styles.terminal} />
          <Toolbar {...toolbarProps} />
          <BottomNav
            windows={windows}
            activeIndex={activeWindowIndex}
            onSwitch={attachToWindow}
            onClose={closeWindow}
            onAdd={openNewSessionDialog}
          />
        </>
      )}

      {showSettings && (
        <SessionManager
          token={token}
          onClose={() => setShowSettings(false)}
        />
      )}
      {showNewSession && (
        <WorkspaceSelector
          token={token}
          onClose={() => setShowNewSession(false)}
          onConfirm={handleCreateSession}
        />
      )}
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  wrapper: {
    display: 'flex',
    flexDirection: 'column',
    width: '100%',
    height: '100%',
    position: 'relative',
  },
  terminal: {
    flex: 1,
    overflow: 'hidden',
    position: 'relative',
  },
  hiddenInput: {
    position: 'fixed',
    top: 0,
    left: 0,
    width: 1,
    height: 1,
    opacity: 0.01,
    fontSize: 16,
    pointerEvents: 'none',
    zIndex: -1,
  },
}
