import React, { useRef, useState, useCallback } from 'react'

export default function Window({ id, title, onClose, children, simTime, simWeekday }){
  // Drag state
  const [pos, setPos] = useState({
    x: 80 + Math.min(300, (id.charCodeAt(1) % 7) * 30),
    y: 80 + Math.min(200, (id.charCodeAt(0) % 5) * 30)
  });
  const [size, setSize] = useState({ width: 1100, height: 520 });
  const [dragging, setDragging] = useState(false);
  const dragOffset = useRef({ x: 0, y: 0 });

  const style = {
    position: 'fixed',
    top: pos.y,
    left: pos.x,
    width: size.width,
    height: size.height,
    background: '#fff',
    border: '1px solid #ccc',
    boxShadow: '0 6px 18px rgba(0,0,0,0.12)',
    zIndex: 10000,
    display: 'flex',
    flexDirection: 'column',
    userSelect: dragging ? 'none' : 'auto',
    transition: dragging ? 'none' : 'box-shadow 0.2s',
    cursor: dragging ? 'grabbing' : 'default',
    minWidth: 400,
    minHeight: 200
  };
  // Resize state
  const [resizing, setResizing] = useState(false);
  const resizeStart = useRef({ x: 0, y: 0, width: 0, height: 0 });

  const onResizeMouseMove = useCallback((e) => {
    if (!resizeStart.current.active) return;
    const dx = e.clientX - resizeStart.current.x;
    const dy = e.clientY - resizeStart.current.y;
    setSize({
      width: Math.max(400, resizeStart.current.width + dx),
      height: Math.max(200, resizeStart.current.height + dy)
    });
  }, []);

  const onResizeMouseUp = useCallback(() => {
    resizeStart.current.active = false;
    window.removeEventListener('mousemove', onResizeMouseMove);
    window.removeEventListener('mouseup', onResizeMouseUp);
  }, [onResizeMouseMove]);

  const onResizeMouseDown = useCallback((e) => {
    e.stopPropagation();
    resizeStart.current = {
      x: e.clientX,
      y: e.clientY,
      width: size.width,
      height: size.height,
      active: true
    };
    window.addEventListener('mousemove', onResizeMouseMove);
    window.addEventListener('mouseup', onResizeMouseUp);
  }, [size.width, size.height, onResizeMouseMove, onResizeMouseUp]);

  const headerStyle = {
    padding: '8px 12px',
    background: '#0b4a7a',
    color: '#fff',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    cursor: 'grab',
    userSelect: 'none'
  };

  // Visa simulerad tid (HH:MM, 24-timmarsformat) om prop finns
  const clock = simTime || '';
  const weekday = simWeekday || '';

  // Drag handlers
  // Gör handlers stabila med useCallback
  const onMouseMove = useCallback((e) => {
    setPos(pos => ({
      x: e.clientX - dragOffset.current.x,
      y: e.clientY - dragOffset.current.y
    }));
  }, []);

  const onMouseUp = useCallback(() => {
    setDragging(false);
    window.removeEventListener('mousemove', onMouseMove);
    window.removeEventListener('mouseup', onMouseUp);
  }, [onMouseMove]);

  const onHeaderMouseDown = useCallback((e) => {
    setDragging(true);
    dragOffset.current = {
      x: e.clientX - pos.x,
      y: e.clientY - pos.y
    };
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  }, [onMouseMove, onMouseUp, pos.x, pos.y]);

  return (
    <div style={{...style, position:'relative'}} role="dialog" aria-label={title}>
      <div style={headerStyle} onMouseDown={onHeaderMouseDown}>
        <div>{title}</div>
        <div style={{display:'flex',alignItems:'center',gap:16}}>
          <span style={{fontFamily:'monospace',fontSize:18}}>
            {weekday && <span style={{marginRight:8}}>{weekday}</span>}
            {clock}
          </span>
          <button onClick={onClose} style={{ background:'#fff', border:'none', padding:'6px 10px', borderRadius:4, cursor:'pointer' }}>Stäng</button>
        </div>
      </div>
      <div style={{ padding:12, overflow:'auto', flex:1 }}>
        {children}
      </div>
      {/* Resize handle */}
      <div
        onMouseDown={onResizeMouseDown}
        style={{
          position: 'absolute',
          right: 0,
          bottom: 0,
          width: 18,
          height: 18,
          cursor: 'nwse-resize',
          background: 'transparent',
          zIndex: 10001
        }}
        title="Ändra storlek"
      >
        <svg width="18" height="18" style={{display:'block'}}>
          <polyline points="4,18 18,4" stroke="#888" strokeWidth="2" fill="none" />
        </svg>
      </div>
    </div>
  )
}
