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

export default function TabBar({ windows, activeIndex, onSwitch, onClose, onAdd, onOpenSettings }: Props) {
  const [menuIndex, setMenuIndex] = useState<number | null>(null)
  const [menuPos, setMenuPos] = useState({ x: 0, y: 0 })
  const scrollRef = useRef<HTMLDivElement>(null)
  const activeTabRef = useRef<HTMLDivElement>(null)

  // 自动滚动到激活的 tab
  useEffect(() => {
    if (activeTabRef.current && scrollRef.current) {
      const scrollContainer = scrollRef.current
      const activeTab = activeTabRef.current
      const containerRect = scrollContainer.getBoundingClientRect()
      const tabRect = activeTab.getBoundingClientRect()

      const scrollLeft = tabRect.left - containerRect.left + scrollContainer.scrollLeft - containerRect.width / 2 + tabRect.width / 2
      scrollContainer.scrollTo({ left: scrollLeft, behavior: 'smooth' })
    }
  }, [activeIndex])

  function handleContextMenu(e: React.MouseEvent | React.TouchEvent, index: number) {
    e.preventDefault()
    e.stopPropagation()

    let clientX: number, clientY: number
    if ('touches' in e) {
      clientX = e.touches[0].clientX
      clientY = e.touches[0].clientY
    } else {
      clientX = (e as React.MouseEvent).clientX
      clientY = (e as React.MouseEvent).clientY
    }

    setMenuPos({ x: clientX, y: clientY })
    setMenuIndex(index)
  }

  function handleClose(index: number) {
    onClose(index)
    setMenuIndex(null)
  }

  function handleSwitch(index: number) {
    if (menuIndex === null) {
      onSwitch(index)
    }
  }

  return (
    <>
      <div style={s.container}>
        <div ref={scrollRef} style={s.tabs}>
          {windows.map(item => (
            <div
              key={item.index}
              ref={item.index === activeIndex ? activeTabRef : null}
              style={{
                ...s.tab,
                ...(item.index === activeIndex ? s.tabActive : {}),
              }}
              onClick={() => handleSwitch(item.index)}
              onContextMenu={(e) => handleContextMenu(e, item.index)}
              onTouchStart={(e) => {
                // 长按触发关闭菜单
                const timer = setTimeout(() => handleContextMenu(e, item.index), 600)
                const clear = () => {
                  clearTimeout(timer)
                  document.removeEventListener('touchend', clear)
                  document.removeEventListener('touchmove', clear)
                }
                document.addEventListener('touchend', clear)
                document.addEventListener('touchmove', clear)
              }}
            >
              <span style={{
                ...s.tabName,
                ...(item.index === activeIndex ? s.tabNameActive : {}),
              }}>{item.name}</span>
              {item.index === activeIndex && <span style={s.activeIndicator} />}
            </div>
          ))}
        </div>
        <div style={s.actions}>
          <button style={s.iconBtn} onPointerDown={(e) => { e.preventDefault(); onAdd() }} title="新建会话">+</button>
          <button style={s.iconBtn} onPointerDown={(e) => { e.preventDefault(); onOpenSettings() }} title="设置">⚙</button>
        </div>
      </div>

      {/* 右键/长按菜单 */}
      {menuIndex !== null && (
        <>
          <div style={s.menuOverlay} onPointerDown={() => setMenuIndex(null)} />
          <div style={{
            ...s.contextMenu,
            left: Math.min(menuPos.x, window.innerWidth - 180),
            top: Math.min(menuPos.y + 10, window.innerHeight - 120),
          }}>
            <div style={s.menuTitle}>{windows.find(w => w.index === menuIndex)?.name}</div>
            <button
              style={s.menuItem}
              onPointerDown={() => menuIndex !== null && handleClose(menuIndex)}
            >
              <span style={s.menuIcon}>✕</span> 关闭会话
            </button>
          </div>
        </>
      )}

    </>
  )
}

const s: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    alignItems: 'center',
    background: 'var(--nexus-bg)',
    borderBottom: '1px solid var(--nexus-border)',
    flexShrink: 0,
    height: 44,
  },
  tabs: {
    display: 'flex',
    flex: 1,
    overflowX: 'auto',
    overflowY: 'hidden',
    scrollbarWidth: 'none',
    msOverflowStyle: 'none',
    padding: '0 4px',
    gap: 4,
    WebkitOverflowScrolling: 'touch',
  },
  tab: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '0 14px',
    height: 36,
    minWidth: 60,
    maxWidth: 140,
    borderRadius: 8,
    background: 'transparent',
    cursor: 'pointer',
    position: 'relative',
    whiteSpace: 'nowrap',
    userSelect: 'none',
    touchAction: 'manipulation',
    WebkitTapHighlightColor: 'transparent',
    transition: 'background 0.15s',
    flexShrink: 0,
  },
  tabActive: {
    background: 'var(--nexus-tab-active)',
  },
  tabName: {
    color: 'var(--nexus-text2)',
    fontSize: 13,
    fontFamily: 'Menlo, Monaco, "Cascadia Code", monospace',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    maxWidth: 100,
  },
  tabNameActive: {
    color: 'var(--nexus-text)',
    fontWeight: 500,
  },
  activeIndicator: {
    position: 'absolute',
    bottom: 4,
    left: '20%',
    right: '20%',
    height: 2,
    background: '#3b82f6',
    borderRadius: 1,
  },
  actions: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    padding: '0 8px',
    borderLeft: '1px solid var(--nexus-border)',
    flexShrink: 0,
  },
  iconBtn: {
    background: 'transparent',
    border: 'none',
    color: 'var(--nexus-muted)',
    cursor: 'pointer',
    fontSize: 18,
    padding: '6px 10px',
    borderRadius: 6,
    touchAction: 'manipulation',
    WebkitTapHighlightColor: 'transparent',
    transition: 'background 0.15s, color 0.15s',
  },
  menuOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 150,
  },
  contextMenu: {
    position: 'fixed',
    background: 'var(--nexus-menu-bg)',
    borderRadius: 8,
    padding: '8px 0',
    minWidth: 140,
    boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
    border: '1px solid var(--nexus-border)',
    zIndex: 200,
  },
  menuTitle: {
    color: 'var(--nexus-muted)',
    fontSize: 11,
    padding: '4px 16px 8px',
    borderBottom: '1px solid var(--nexus-border)',
    marginBottom: 4,
    maxWidth: 200,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  menuItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    background: 'transparent',
    border: 'none',
    color: '#ef4444',
    cursor: 'pointer',
    fontSize: 14,
    padding: '8px 16px',
    width: '100%',
    textAlign: 'left',
    transition: 'background 0.15s',
  },
  menuIcon: {
    fontSize: 12,
  },
}
