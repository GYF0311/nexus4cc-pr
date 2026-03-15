import { useState, useRef, useEffect } from 'react'

interface TmuxWindow {
  index: number
  name: string
  active: boolean
}

interface Props {
  windows: TmuxWindow[]
  activeIndex: number
  onSwitch: (index: number) => void
  onClose: (index: number) => void
  onAdd: () => void
  onOpenSettings: () => void
}

const LONG_PRESS_MS = 600

export default function TabBar({ windows, activeIndex, onSwitch, onClose, onAdd, onOpenSettings }: Props) {
  const [closingIndex, setClosingIndex] = useState<number | null>(null)
  const longPressTimer = useRef<number | null>(null)
  const isLongPress = useRef(false)

  useEffect(() => {
    return () => {
      if (longPressTimer.current) {
        window.clearTimeout(longPressTimer.current)
      }
    }
  }, [])

  function handleTouchStart(index: number) {
    isLongPress.current = false
    longPressTimer.current = window.setTimeout(() => {
      isLongPress.current = true
      setClosingIndex(index)
    }, LONG_PRESS_MS)
  }

  function handleTouchEnd(index: number) {
    if (longPressTimer.current) {
      window.clearTimeout(longPressTimer.current)
      longPressTimer.current = null
    }
    if (!isLongPress.current) {
      onSwitch(index)
    }
  }

  function handleMouseDown(index: number) {
    isLongPress.current = false
    longPressTimer.current = window.setTimeout(() => {
      isLongPress.current = true
      setClosingIndex(index)
    }, LONG_PRESS_MS)
  }

  function handleMouseUp(index: number) {
    if (longPressTimer.current) {
      window.clearTimeout(longPressTimer.current)
      longPressTimer.current = null
    }
    if (!isLongPress.current) {
      onSwitch(index)
    }
  }

  function handleConfirmClose() {
    if (closingIndex !== null) {
      onClose(closingIndex)
      setClosingIndex(null)
    }
  }

  const windowName = closingIndex !== null
    ? windows.find(w => w.index === closingIndex)?.name || `窗口 ${closingIndex}`
    : ''

  return (
    <>
      <div style={s.container}>
        <div style={s.tabs}>
          {windows.map(item => (
            <div
              key={item.index}
              style={{
                ...s.tab,
                ...(item.index === activeIndex ? s.tabActive : {}),
              }}
              onTouchStart={() => handleTouchStart(item.index)}
              onTouchEnd={() => handleTouchEnd(item.index)}
              onMouseDown={() => handleMouseDown(item.index)}
              onMouseUp={() => handleMouseUp(item.index)}
              onMouseLeave={() => {
                if (longPressTimer.current) {
                  window.clearTimeout(longPressTimer.current)
                  longPressTimer.current = null
                }
              }}
            >
              <span style={s.tabName}>{item.name}</span>
              {item.index === activeIndex && <span style={s.activeIndicator} />}
            </div>
          ))}
        </div>
        <div style={s.actions}>
          <button style={s.iconBtn} onPointerDown={(e) => { e.preventDefault(); onAdd() }}>+</button>
          <button style={s.iconBtn} onPointerDown={(e) => { e.preventDefault(); onOpenSettings() }}>⚙</button>
        </div>
      </div>

      {/* 关闭确认对话框 */}
      {closingIndex !== null && (
        <div style={s.overlay} onPointerDown={() => setClosingIndex(null)}>
          <div style={s.dialog} onPointerDown={(e) => e.stopPropagation()}>
            <div style={s.dialogTitle}>关闭会话</div>
            <div style={s.dialogText}>确定要关闭 "{windowName}" 吗？</div>
            <div style={s.dialogButtons}>
              <button style={s.cancelBtn} onPointerDown={() => setClosingIndex(null)}>取消</button>
              <button style={s.confirmBtn} onPointerDown={handleConfirmClose}>关闭</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

const s: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    alignItems: 'center',
    background: '#16213e',
    borderBottom: '1px solid #334155',
    flexShrink: 0,
    height: 40,
  },
  tabs: {
    display: 'flex',
    flex: 1,
    overflowX: 'auto',
    overflowY: 'hidden',
    scrollbarWidth: 'none',
    msOverflowStyle: 'none',
    padding: '0 4px',
    gap: 2,
  },
  tab: {
    display: 'flex',
    alignItems: 'center',
    padding: '0 12px',
    height: 32,
    borderRadius: 6,
    background: 'transparent',
    cursor: 'pointer',
    position: 'relative',
    whiteSpace: 'nowrap',
    userSelect: 'none',
    touchAction: 'manipulation',
    WebkitTapHighlightColor: 'transparent',
  },
  tabActive: {
    background: '#0f3460',
  },
  tabName: {
    color: '#94a3b8',
    fontSize: 13,
    fontFamily: 'monospace',
  },
  activeIndicator: {
    position: 'absolute',
    bottom: 0,
    left: 6,
    right: 6,
    height: 2,
    background: '#3b82f6',
    borderRadius: '1px 1px 0 0',
  },
  actions: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    padding: '0 8px',
    borderLeft: '1px solid #334155',
  },
  iconBtn: {
    background: 'transparent',
    border: 'none',
    color: '#64748b',
    cursor: 'pointer',
    fontSize: 16,
    padding: '4px 8px',
    borderRadius: 4,
    touchAction: 'manipulation',
    WebkitTapHighlightColor: 'transparent',
  },
  overlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'rgba(0,0,0,0.6)',
    zIndex: 200,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dialog: {
    background: '#16213e',
    borderRadius: 12,
    padding: '20px 24px',
    minWidth: 260,
    maxWidth: '80vw',
    boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
  },
  dialogTitle: {
    color: '#e2e8f0',
    fontSize: 16,
    fontWeight: 600,
    marginBottom: 12,
  },
  dialogText: {
    color: '#94a3b8',
    fontSize: 14,
    marginBottom: 20,
  },
  dialogButtons: {
    display: 'flex',
    gap: 12,
    justifyContent: 'flex-end',
  },
  cancelBtn: {
    background: 'transparent',
    border: '1px solid #334155',
    borderRadius: 6,
    color: '#94a3b8',
    cursor: 'pointer',
    fontSize: 14,
    padding: '8px 16px',
  },
  confirmBtn: {
    background: '#ef4444',
    border: 'none',
    borderRadius: 6,
    color: '#fff',
    cursor: 'pointer',
    fontSize: 14,
    padding: '8px 16px',
  },
}
