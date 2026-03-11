const { useState, useEffect, useCallback, useRef, useContext } = React;
const { Minus, Plus, Search, FileText, Folder, Settings, X, Square, Scan, Type } = window.LucideReact || LucideReact;
const { AppContext, JoditReactEditor } = window;

// ================= MIND MAP COMPONENT =================
const MindMapNode = ({ node, updateNode, deleteNode, startDrawEdge, completeEdge, setActiveNodeId, activeNodeId, snapToGrid, transform = { scale: 1 } }) => {
  const { treeData } = React.useContext(AppContext);
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  const findKeywordByName = (nodes, name) => {
    for (const n of nodes) {
      if (n.type !== 'group' && n.name.toUpperCase() === name.toUpperCase()) return n;
      if (n.children) {
        const found = findKeywordByName(n.children, name);
        if (found) return found;
      }
    }
    return null;
  };

  const handlePointerDown = (e) => {
    if (e.target.closest('.node-content') || e.target.closest('.edge-handle') || e.target.closest('.resize-handle') || e.target.tagName === 'BUTTON') return;
    if (e.button !== 0) return; // ONLY allow left click for dragging

    // Prevent multiple simultaneous node drags
    if (window.__lsdyna_mindmap_node_dragging) return;
    window.__lsdyna_mindmap_node_dragging = true;

    e.stopPropagation();
    e.preventDefault(); // Prevent native drag or text selection

    const startX = e.clientX;
    const startY = e.clientY;
    const initialNodeX = node.x;
    const initialNodeY = node.y;

    if (setActiveNodeId) setActiveNodeId(node.id);

    // Ensure pointer events are captured so release works even outside node bounds
    e.currentTarget.setPointerCapture(e.pointerId);

    const doDrag = (dragEvent) => {
      updateNode(node.id, {
        x: initialNodeX + (dragEvent.clientX - startX) / transform.scale,
        y: initialNodeY + (dragEvent.clientY - startY) / transform.scale
      });
    };

    const stopDrag = (stopEvent) => {
      window.__lsdyna_mindmap_node_dragging = false;
      if (setActiveNodeId) setActiveNodeId(null);
      window.removeEventListener('pointermove', doDrag);
      window.removeEventListener('pointerup', stopDrag, true);
      if (stopEvent.target.releasePointerCapture) {
        stopEvent.target.releasePointerCapture(stopEvent.pointerId);
      }
    };

    window.addEventListener('pointermove', doDrag);
    window.addEventListener('pointerup', stopDrag, true);
  };

  const isKeyword = node.type === 'keyword';
  const nodeW = node.width || (isKeyword ? 180 : 150);
  const nodeH = node.height || (isKeyword ? 'auto' : 80);

  // Handle custom resizing from bottom-right to support snap-to-grid
  const startResize = (e) => {
    if (e.button !== 0) return; // ONLY allow left click for resizing
    e.stopPropagation();
    e.preventDefault();

    const startX = e.clientX;
    const startY = e.clientY;
    const startW = nodeW;
    const startH = nodeH === 'auto' ? e.currentTarget.parentElement.offsetHeight : nodeH;

    const doDrag = (dragEvent) => {
      let newW = startW + (dragEvent.clientX - startX) / transform.scale;
      let newH = startH + (dragEvent.clientY - startY) / transform.scale;
      if (snapToGrid) {
        newW = Math.round(newW / 20) * 20;
        newH = Math.round(newH / 20) * 20;
      }
      updateNode(node.id, { width: Math.max(100, newW), height: Math.max(40, newH) });
    };
    const stopDrag = (stopEvent) => {
      window.removeEventListener('pointermove', doDrag);
      window.removeEventListener('pointerup', stopDrag, true);
      if (stopEvent.target.releasePointerCapture) {
        stopEvent.target.releasePointerCapture(stopEvent.pointerId);
      }
    };
    e.currentTarget.setPointerCapture(e.pointerId);
    window.addEventListener('pointermove', doDrag);
    window.addEventListener('pointerup', stopDrag, true);
  };

  return (
    <div
      className={`mindmap-node-wrapper absolute flex flex-col group ${isKeyword ? 'mindmap-keyword-node' : ''}`}
      style={{ left: node.x, top: node.y, zIndex: 10, width: nodeW, minHeight: nodeH }}
      onPointerDown={handlePointerDown}
      onPointerUpCapture={(e) => {
        e.stopPropagation();
        const container = e.currentTarget.closest('.mindmap-scroll-container');
        if (container) {
          const rect = container.getBoundingClientRect();
          completeEdge(node.id, (e.clientX - rect.left - transform.x) / transform.scale, (e.clientY - rect.top - transform.y) / transform.scale);
        } else {
          completeEdge(node.id);
        }
      }} // Allows dropping any edge here
    >
      {/* Inner content wrapper handles borders, bg safely without clipping the outer hover handles or quill dropdowns */}
      <div className="flex-1 w-full relative flex flex-col transition-shadow group-hover:shadow-lg bg-white border border-gray-300 rounded-xl shadow-md z-20">
        {isKeyword ? (
          <div className="flex flex-col h-full w-full">
            <div className={`bg-gradient-to-r from-blue-700 to-blue-900 border-b border-blue-950 flex justify-between items-center px-2 py-1.5 cursor-grab active:cursor-grabbing w-full ${node.globalNote ? 'rounded-t-xl' : 'rounded-xl'}`}>
              <div className="flex items-center gap-1.5 overflow-hidden text-white">
                <FileText size={12} className="shrink-0" />
                <span className="text-[11px] font-bold truncate" title={node.name}>{node.name}</span>
              </div>
              <button onPointerDown={(e) => e.stopPropagation()} onClick={() => deleteNode(node.id)} className="text-gray-300 hover:text-red-400 shrink-0"><X size={12} /></button>
            </div>
            {node.globalNote && (
              <div className="p-2 text-[10px] text-gray-600 border-t border-gray-100 bg-[#f8fafc] max-h-[100px] overflow-y-auto" dangerouslySetInnerHTML={{ __html: node.globalNote }} />
            )}
            <div className="flex-1 node-content cursor-text flex flex-col min-h-[40px] w-full box-border bg-white pointer-events-auto rounded-b-xl" onPointerDown={e => { e.stopPropagation(); if (setActiveNodeId) setActiveNodeId(node.id); }}>
              <JoditReactEditor
                value={node.text || ''}
                onChange={(val) => updateNode(node.id, { text: val })}
                placeholder="Type your notes..."
                className="flex-1 border-0"
              />
            </div>
          </div>
        ) : (
          <div className="flex flex-col h-full w-full bg-white rounded-xl">
            <div className="bg-gray-100 border-b border-gray-200 h-6 flex items-center px-1 group-hover:bg-gray-200 transition-colors shrink-0 rounded-t-xl">
              <div className="cursor-grab active:cursor-grabbing px-1 text-gray-400" onPointerDown={handlePointerDown}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="12" r="1" /><circle cx="9" cy="5" r="1" /><circle cx="9" cy="19" r="1" /><circle cx="15" cy="12" r="1" /><circle cx="15" cy="5" r="1" /><circle cx="15" cy="19" r="1" /></svg>
              </div>
              <div className="flex items-center flex-1 overflow-hidden pointer-events-auto" onPointerDown={e => e.stopPropagation()}>
                <input
                  className="bg-transparent border-none outline-none text-[10px] text-gray-700 w-full font-bold px-1"
                  placeholder="Node Name or Keyword ID..."
                  value={node.name || ''}
                  onChange={(e) => updateNode(node.id, { name: e.target.value })}
                  onBlur={(e) => {
                    const val = e.target.value.trim().toUpperCase();
                    if (val) {
                      const kwNode = findKeywordByName(treeData, val);
                      if (kwNode) {
                        updateNode(node.id, {
                          type: 'keyword',
                          keywordId: kwNode.id,
                          name: kwNode.name,
                          globalNote: kwNode.globalNote
                        });
                      }
                    }
                  }}
                  onKeyDown={(e) => { if (e.key === 'Enter') e.target.blur(); }}
                />
              </div>
              <button onPointerDown={(e) => e.stopPropagation()} onClick={() => deleteNode(node.id)} className="text-gray-400 hover:text-red-500 shrink-0 ml-1 opacity-0 group-hover:opacity-100 transition-opacity"><X size={12} /></button>
            </div>
            <div className="flex-1 node-content cursor-text flex flex-col min-h-[40px] w-full box-border bg-white pointer-events-auto rounded-b-xl" onPointerDown={e => { e.stopPropagation(); if (setActiveNodeId) setActiveNodeId(node.id); }}>
              <JoditReactEditor
                value={node.text || ''}
                onChange={(val) => updateNode(node.id, { text: val })}
                placeholder="Type your notes..."
                className="flex-1 border-0"
              />
            </div>
          </div>
        )}
      </div>

      {/* 4 directional edge handles that appear on hover */}
      <div className="opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none absolute inset-x-0 inset-y-0 w-full h-full">
        <div className="pointer-events-auto absolute top-[-6px] left-1/2 transform -translate-x-1/2 w-4 h-4 bg-white border-2 border-blue-500 rounded-full cursor-crosshair edge-handle hover:bg-blue-100 hover:scale-125 transition-transform" onPointerDown={(e) => { e.stopPropagation(); startDrawEdge(e, node.id, 'top'); }} />
        <div className="pointer-events-auto absolute bottom-[-6px] left-1/2 transform -translate-x-1/2 w-4 h-4 bg-white border-2 border-blue-500 rounded-full cursor-crosshair edge-handle hover:bg-blue-100 hover:scale-125 transition-transform" onPointerDown={(e) => { e.stopPropagation(); startDrawEdge(e, node.id, 'bottom'); }} />
        <div className="pointer-events-auto absolute left-[-6px] top-1/2 transform -translate-y-1/2 w-4 h-4 bg-white border-2 border-blue-500 rounded-full cursor-crosshair edge-handle hover:bg-blue-100 hover:scale-125 transition-transform" onPointerDown={(e) => { e.stopPropagation(); startDrawEdge(e, node.id, 'left'); }} />
        <div className="pointer-events-auto absolute right-[-6px] top-1/2 transform -translate-y-1/2 w-4 h-4 bg-white border-2 border-blue-500 rounded-full cursor-crosshair edge-handle hover:bg-blue-100 hover:scale-125 transition-transform" onPointerDown={(e) => { e.stopPropagation(); startDrawEdge(e, node.id, 'right'); }} />
      </div>

      <div className="absolute bottom-0 right-0 w-3 h-3 cursor-nwse-resize resize-handle opacity-0 group-hover:opacity-100" onPointerDown={startResize}>
        <svg viewBox="0 0 10 10" className="w-full h-full text-gray-400"><path d="M 8 10 L 10 8 L 10 10 Z M 5 10 L 10 5 L 10 7 L 7 10 Z M 2 10 L 10 2 L 10 4 L 4 10 Z" fill="currentColor" /></svg>
      </div>
    </div>
  );
};

const MindMapCanvas = () => {
  const { treeData, findNodeById, draggedNodeId, setDraggedNodeId } = React.useContext(AppContext);
  const [nodes, setNodes] = useState(() => {
    try { return JSON.parse(localStorage.getItem('lsdyna_mindmap_nodes') || '[]'); } catch { return []; }
  });
  const [edges, setEdges] = useState(() => {
    try { return JSON.parse(localStorage.getItem('lsdyna_mindmap_edges') || '[]'); } catch { return []; }
  });

  const [drawingEdge, setDrawingEdge] = useState(null);

  const [transform, setTransform] = useState(() => {
    try { return JSON.parse(localStorage.getItem('lsdyna_mindmap_transform') || '{"x":0,"y":0,"scale":1}'); } catch { return { x: 0, y: 0, scale: 1 }; }
  });
  const [isPanning, setIsPanning] = useState(false);
  const lastPanPos = useRef({ x: 0, y: 0 });
  const [snapToGrid, setSnapToGrid] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [activeNodeId, setActiveNodeId] = useState(null);

  useEffect(() => {
    if (initialLoad.current) {
      initialLoad.current = false;
      return;
    }
    const t = setTimeout(() => {
      const payload = { nodes, edges, transform };
      fetch('/api/data?file=mindmap', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      }).catch(err => console.log('Mindmap save failed: ', err));

      localStorage.setItem('lsdyna_mindmap_nodes', JSON.stringify(nodes));
      localStorage.setItem('lsdyna_mindmap_edges', JSON.stringify(edges));
      localStorage.setItem('lsdyna_mindmap_transform', JSON.stringify(transform));
    }, 1500);
    return () => clearTimeout(t);
  }, [nodes, edges, transform]);

  // Focus / Fit to screen logic
  const fitToScreen = () => {
    if (nodes.length === 0) {
      setTransform({ x: 0, y: 0, scale: 1 });
      return;
    }
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    nodes.forEach(n => {
      if (n.x < minX) minX = n.x;
      if (n.y < minY) minY = n.y;
      if (n.x > maxX) maxX = n.x;
      if (n.y > maxY) maxY = n.y;
    });

    // Add padding
    minX -= 100; minY -= 100;
    maxX += 200; maxY += 200;

    const contentWidth = maxX - minX;
    const contentHeight = maxY - minY;

    const container = document.querySelector('.mindmap-scroll-container');
    if (!container) return;

    const vw = container.clientWidth;
    const vh = container.clientHeight;

    const scaleX = vw / contentWidth;
    const scaleY = vh / contentHeight;
    let newScale = Math.min(scaleX, scaleY, 2); // Cap zoom in at 200%

    const offsetX = (vw - contentWidth * newScale) / 2 - minX * newScale;
    const offsetY = (vh - contentHeight * newScale) / 2 - minY * newScale;

    setTransform({ x: offsetX, y: offsetY, scale: newScale });
  };

  // Auto fit on first open if empty transform
  useEffect(() => {
    if (transform.x === 0 && transform.y === 0 && transform.scale === 1 && nodes.length > 0) {
      fitToScreen();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const updateNode = (id, updates) => setNodes(ns => ns.map(n => n.id === id ? { ...n, ...updates } : n));
  const deleteNode = (id) => {
    setNodes(ns => ns.filter(n => n.id !== id));
    setEdges(es => es.filter(e => e.from !== id && e.to !== id));
  };

  const [edgeCtx, setEdgeCtx] = useState({ visible: false, x: 0, y: 0, edgeId: null });
  const [edgeDragging, setEdgeDragging] = useState(null); // { edgeId: id, currentX, currentY }

  const startDrawEdge = (e, nodeId, handle) => {
    const rect = e.currentTarget.closest('.mindmap-scroll-container').getBoundingClientRect();
    const startX = (e.clientX - rect.left - transform.x) / transform.scale;
    const startY = (e.clientY - rect.top - transform.y) / transform.scale;
    setDrawingEdge({ from: nodeId, fromHandle: handle, startX, startY, currentX: startX, currentY: startY });
  };

  const completeEdge = (nodeId, x, y) => {
    let toHandle = 'left';
    // Auto-calculate closest handle if coords provided
    if (x !== undefined && y !== undefined) {
      const toNode = nodes.find(n => n.id === nodeId);
      if (toNode) {
        const w = toNode.width || (toNode.type === 'keyword' ? 180 : 150);
        const h = typeof toNode.height === 'number' ? toNode.height : (toNode.type === 'keyword' ? 34 : 80);
        const topD = Math.abs(y - toNode.y);
        const bottomD = Math.abs(y - (toNode.y + h));
        const leftD = Math.abs(x - toNode.x);
        const rightD = Math.abs(x - (toNode.x + w));
        const minD = Math.min(topD, bottomD, leftD, rightD);
        if (minD === topD) toHandle = 'top';
        else if (minD === bottomD) toHandle = 'bottom';
        else if (minD === rightD) toHandle = 'right';
      }
    }

    if (drawingEdge && drawingEdge.from !== nodeId) {
      setEdges(es => [...es, { id: Date.now().toString(), from: drawingEdge.from, fromHandle: drawingEdge.fromHandle, to: nodeId, toHandle, color: '#000080', direction: 'forward', label: '' }]);
    } else if (edgeDragging && edgeDragging.edgeId) {
      setEdges(es => es.map(e => e.id === edgeDragging.edgeId ? { ...e, to: nodeId, toHandle } : e));
    }
    setDrawingEdge(null);
    setEdgeDragging(null);
  };

  const getHandlePos = (n, handle) => {
    const w = n.width || (n.type === 'keyword' ? 180 : 150);
    const h = typeof n.height === 'number' ? n.height : (n.type === 'keyword' ? 34 : 80);
    if (handle === 'top') return { x: n.x + w / 2, y: n.y, dx: 0, dy: -60 };
    if (handle === 'bottom') return { x: n.x + w / 2, y: n.y + h, dx: 0, dy: 60 };
    if (handle === 'left') return { x: n.x, y: n.y + h / 2, dx: -60, dy: 0 };
    if (handle === 'right') return { x: n.x + w, y: n.y + h / 2, dx: 60, dy: 0 };
    return { x: n.x + w / 2, y: n.y + h / 2, dx: 0, dy: 0 }; // fallback center
  };

  const handleWheel = (e) => {
    const delta = e.deltaY < 0 ? 0.05 : -0.05;
    const rect = e.currentTarget.getBoundingClientRect();
    const clientX = e.clientX;
    const clientY = e.clientY;

    setTransform(prev => {
      const currentScale = prev?.scale || 1;
      const currentX = prev?.x || 0;
      const currentY = prev?.y || 0;
      let newScale = Math.min(Math.max(0.1, currentScale + delta), 3);
      const mouseX = clientX - rect.left;
      const mouseY = clientY - rect.top;
      const ratio = newScale / currentScale;
      return {
        x: mouseX - (mouseX - currentX) * ratio,
        y: mouseY - (mouseY - currentY) * ratio,
        scale: newScale
      };
    });
  };

  const [canvasCtx, setCanvasCtx] = useState({ visible: false, x: 0, y: 0 });

  // Automatically close context menus when clicking outside
  useEffect(() => {
    const handleGlobalClick = (e) => {
      if (e.button !== 2) {
        if (canvasCtx.visible) setCanvasCtx({ visible: false, x: 0, y: 0 });
        if (edgeCtx.visible) setEdgeCtx({ visible: false, x: 0, y: 0, edgeId: null });
      }
    };
    window.addEventListener('pointerdown', handleGlobalClick);
    return () => window.removeEventListener('pointerdown', handleGlobalClick);
  }, [canvasCtx.visible, edgeCtx.visible]);

  return (
    <div className="relative w-full h-full bg-[#f8fafc] overflow-hidden mindmap-scroll-container shadow-inner touch-none"
      style={{
        backgroundImage: 'radial-gradient(circle, #cbd5e1 1.5px, transparent 1.5px)',
        backgroundSize: `${20 * transform.scale}px ${20 * transform.scale}px`,
        backgroundPosition: `${transform.x}px ${transform.y}px`
      }}
      onWheel={handleWheel}
      onDragOver={(e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy';
      }}
      onDrop={(e) => {
        e.preventDefault();
        // Try both dataTransfer and context state for maximum reliability
        const id = e.dataTransfer.getData('text/plain') || draggedNodeId;
        if (id) {
          const treeNode = findNodeById(treeData, id);
          if (treeNode && treeNode.type !== 'group') {
            const rect = e.currentTarget.getBoundingClientRect();
            let nx = (e.clientX - rect.left - transform.x) / transform.scale;
            let ny = (e.clientY - rect.top - transform.y) / transform.scale;
            if (snapToGrid) {
              nx = Math.round(nx / 20) * 20;
              ny = Math.round(ny / 20) * 20;
            }
            setNodes(ns => [...ns, {
              id: Date.now().toString(),
              type: 'keyword',
              keywordId: treeNode.id,
              name: treeNode.name,
              globalNote: treeNode.globalNote, // Transfer global note if exists
              x: nx, y: ny, text: ''
            }]);
          }
        }
        if (setDraggedNodeId) setDraggedNodeId(null);
      }}
      onPointerDown={(e) => {
        if (e.target.closest('.node-content') || e.target.closest('.edge-handle') || e.target.closest('.bg-\\[\\#000080\\]') || e.target.closest('.mindmap-toolbar') || e.target.closest('button') || e.target.closest('.mindmap-keyword-node')) return;
        if (e.button === 2) return; // ignore right clicks for panning
        setCanvasCtx({ visible: false, x: 0, y: 0 });
        setIsPanning(true);
        lastPanPos.current = { x: e.clientX, y: e.clientY };
        if (e.currentTarget.setPointerCapture) e.currentTarget.setPointerCapture(e.pointerId);
      }}
      onContextMenu={(e) => {
        if (e.target.tagName !== 'INPUT' && e.target.tagName !== 'TEXTAREA' && e.target.tagName !== 'BUTTON' && !e.target.closest('.node-content') && !e.target.closest('.mindmap-node-wrapper')) {
          e.preventDefault();
          setCanvasCtx({ visible: true, x: e.clientX, y: e.clientY });
        }
      }}
      onPointerMove={(e) => {
        if (isPanning) {
          const dx = e.clientX - lastPanPos.current.x;
          const dy = e.clientY - lastPanPos.current.y;
          setTransform(prev => ({ ...prev, x: prev.x + dx, y: prev.y + dy }));
          lastPanPos.current = { x: e.clientX, y: e.clientY };
        } else if (drawingEdge) {
          const rect = e.currentTarget.getBoundingClientRect();
          setDrawingEdge(prev => ({
            ...prev,
            currentX: (e.clientX - rect.left - transform.x) / transform.scale,
            currentY: (e.clientY - rect.top - transform.y) / transform.scale
          }));
        } else if (edgeDragging) {
          const rect = e.currentTarget.getBoundingClientRect();
          setEdgeDragging(prev => ({
            ...prev,
            currentX: (e.clientX - rect.left - transform.x) / transform.scale,
            currentY: (e.clientY - rect.top - transform.y) / transform.scale
          }));
        }
      }}
      onPointerUp={(e) => {
        if (isPanning) {
          setIsPanning(false);
          if (e.currentTarget.releasePointerCapture) e.currentTarget.releasePointerCapture(e.pointerId);
        }
        if (drawingEdge) setDrawingEdge(null);
        if (edgeDragging) {
          // If released in empty space, delete the edge since it didn't trigger completeEdge on a node
          setEdges(es => es.filter(ed => ed.id !== edgeDragging.edgeId));
          setEdgeDragging(null);
        }
      }}
    // Double click note creation disabled via user request. See canvasCtx Right Click menu for Add Note.
    >
      <div style={{ transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})`, transformOrigin: '0 0', width: '100%', height: '100%', position: 'absolute' }}>
        <svg className="absolute inset-0 pointer-events-none" style={{ width: 10000, height: 10000, overflow: 'visible' }}>
          <defs>
            <marker id="arrow-forward" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
              <path d="M 0 0 L 10 5 L 0 10 z" fill="context-stroke" />
            </marker>
            <marker id="arrow-reverse" viewBox="0 0 10 10" refX="2" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
              <path d="M 10 0 L 0 5 L 10 10 z" fill="context-stroke" />
            </marker>
          </defs>
          {edges.map(edge => {
            if (edgeDragging && edgeDragging.edgeId === edge.id) return null; // hide while dragging detach
            const fromNode = nodes.find(n => n.id === edge.from);
            const toNode = nodes.find(n => n.id === edge.to);
            if (!fromNode || !toNode) return null;

            const p1 = getHandlePos(fromNode, edge.fromHandle || 'right');
            const p2 = getHandlePos(toNode, edge.toHandle || 'left');
            const pathStr = `M ${p1.x} ${p1.y} C ${p1.x + p1.dx} ${p1.y + p1.dy}, ${p2.x + p2.dx} ${p2.y + p2.dy}, ${p2.x} ${p2.y}`;

            const midX = (p1.x + p2.x) / 2;
            const midY = (p1.y + p2.y) / 2;

            return (
              <g key={edge.id} className="pointer-events-auto"
                onContextMenu={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  const c = e.target.closest('.mindmap-scroll-container');
                  const r = c ? c.getBoundingClientRect() : { left: 0, top: 0 };
                  setEdgeCtx({ visible: true, x: e.clientX - r.left, y: e.clientY - r.top, edgeId: edge.id });
                }}
              >
                <path d={pathStr} stroke="transparent" strokeWidth="20" fill="none" className="cursor-pointer hover:stroke-gray-300/30" />
                <path d={pathStr} stroke={edge.color || '#000080'} strokeWidth="2" fill="none"
                  markerEnd={edge.direction === 'none' || edge.direction === 'reverse' ? '' : 'url(#arrow-forward)'}
                  markerStart={edge.direction === 'bidirectional' || edge.direction === 'reverse' ? 'url(#arrow-reverse)' : ''}
                  style={{ stroke: edge.color || '#000080' }}
                />
                {edge.label && (
                  <text x={midX} y={midY - 5} fill={edge.color || '#000080'} fontSize="10" textAnchor="middle" className="font-bold bg-white">{edge.label}</text>
                )}
                {/* Detach handle on the arrow head */}
                <circle cx={p2.x} cy={p2.y} r="8" fill="transparent" className="cursor-grab hover:fill-red-500/20"
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    const rect = e.currentTarget.closest('.mindmap-scroll-container').getBoundingClientRect();
                    setEdgeDragging({ edgeId: edge.id, currentX: (e.clientX - rect.left - transform.x) / transform.scale, currentY: (e.clientY - rect.top - transform.y) / transform.scale });
                  }}
                />
              </g>
            );
          })}
          {drawingEdge && (
            <path d={`M ${drawingEdge.startX} ${drawingEdge.startY} C ${drawingEdge.startX + getHandlePos(nodes.find(n => n.id === drawingEdge.from), drawingEdge.fromHandle).dx} ${drawingEdge.startY + getHandlePos(nodes.find(n => n.id === drawingEdge.from), drawingEdge.fromHandle).dy}, ${drawingEdge.currentX - 50} ${drawingEdge.currentY}, ${drawingEdge.currentX} ${drawingEdge.currentY}`} stroke="#0000ff" strokeWidth="2" strokeDasharray="5,5" fill="none" />
          )}
          {edgeDragging && (() => {
            const edge = edges.find(e => e.id === edgeDragging.edgeId);
            const fromNode = nodes.find(n => n.id === edge.from);
            const p1 = getHandlePos(fromNode, edge.fromHandle || 'right');
            return <path d={`M ${p1.x} ${p1.y} C ${p1.x + p1.dx} ${p1.y + p1.dy}, ${edgeDragging.currentX - 50} ${edgeDragging.currentY}, ${edgeDragging.currentX} ${edgeDragging.currentY}`} stroke={edge.color || '#000080'} strokeWidth="2" fill="none" markerEnd="url(#arrow-forward)" />
          })()}
          {/* Alignment Guides */}
          {activeNodeId && (() => {
            const activeNode = nodes.find(n => n.id === activeNodeId);
            if (!activeNode) return null;
            const guides = [];
            nodes.forEach(n => {
              if (n.id === activeNode.id) return;
              if (Math.abs(n.x - activeNode.x) < 2) guides.push(<line x1={n.x} y1={-10000} x2={n.x} y2={10000} stroke="#f87171" strokeWidth="1" strokeDasharray="4,4" />);
              if (Math.abs(n.y - activeNode.y) < 2) guides.push(<line x1={-10000} y1={n.y} x2={10000} y2={n.y} stroke="#f87171" strokeWidth="1" strokeDasharray="4,4" />);
            });
            return guides.map((g, i) => React.cloneElement(g, { key: `guide-${i}` }));
          })()}
        </svg>

        {nodes.map(node => (
          <MindMapNode key={node.id} node={node} updateNode={(id, updates) => {
            if (snapToGrid && updates.x !== undefined && updates.y !== undefined) {
              updates.x = Math.round(updates.x / 20) * 20;
              updates.y = Math.round(updates.y / 20) * 20;
            }
            updateNode(id, updates);
          }} deleteNode={deleteNode} startDrawEdge={startDrawEdge} completeEdge={completeEdge} setActiveNodeId={setActiveNodeId} activeNodeId={activeNodeId} snapToGrid={snapToGrid} transform={transform} />
        ))}
      </div>

      <div className="absolute top-2 left-2 bg-yellow-100 p-2 text-[10px] border border-gray-400 pointer-events-none w-max z-30 opacity-80 shadow rounded text-gray-700">
        <b>Right-click</b>: Canvas/Edge Menu<br />
        <b>Drag Grid</b>: Pan Canvas<br />
        <b>MouseWheel</b>: Zoom
      </div>

      {/* Floating Toolbar */}
      <div className="absolute top-4 right-4 flex flex-col gap-2 z-40 mindmap-toolbar">
        <div className="bg-white border border-gray-300 shadow-md rounded flex flex-col items-center">
          <button className="p-2 hover:bg-gray-100 hover:text-blue-600 transition-colors border-b border-gray-200 w-full flex justify-center" onClick={() => setTransform(prev => ({ ...prev, scale: Math.min(prev.scale + 0.1, 3) }))} title="Zoom In">
            <Plus size={16} />
          </button>
          <button className="p-2 hover:bg-gray-100 hover:text-blue-600 transition-colors border-b border-gray-200 w-full flex justify-center" onClick={fitToScreen} title="Fit to Nodes">
            <Scan size={16} />
          </button>
          <button className="p-2 hover:bg-gray-100 hover:text-blue-600 transition-colors w-full flex justify-center" onClick={() => setTransform(prev => ({ ...prev, scale: Math.max(prev.scale - 0.1, 0.1) }))} title="Zoom Out">
            <Minus size={16} />
          </button>
        </div>
        <div className="bg-white border border-gray-300 shadow-md rounded relative">
          <button className="p-2 hover:bg-gray-100 hover:text-blue-600 transition-colors w-full flex justify-center" onClick={() => setShowSettings(!showSettings)} title="Settings">
            <Settings size={16} />
          </button>
          {showSettings && (
            <div className="absolute right-full top-0 mr-2 bg-white border shadow-lg rounded w-36 py-1 text-[11px] text-gray-700 flex flex-col border-gray-300">
              <label className="flex items-center gap-2 px-3 py-1.5 hover:bg-gray-100 cursor-pointer">
                <input type="checkbox" checked={snapToGrid} onChange={e => setSnapToGrid(e.target.checked)} />
                Snap to grid
              </label>
            </div>
          )}
        </div>
      </div>

      {/* Edge Context Menu */}
      {edgeCtx.visible && (
        <div
          className="fixed w-36 bg-white border shadow-lg z-[9999] py-1 flex flex-col text-xs rounded"
          style={{ top: edgeCtx.y, left: edgeCtx.x }}
          onClick={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
        >
          <div className="px-3 py-1 text-[10px] font-bold text-gray-400 border-b mb-1 uppercase tracking-wider">Edge Setup</div>
          <button className="text-left px-3 py-1.5 hover:bg-red-50 text-red-600 font-medium flex items-center gap-2"
            onClick={() => { setEdges(es => es.filter(e => e.id !== edgeCtx.edgeId)); setEdgeCtx({ visible: false, x: 0, y: 0, edgeId: null }); }}
          >
            <X size={12} /> Delete Edge
          </button>
          <button className="text-left px-3 py-1.5 hover:bg-blue-50 text-gray-700 flex items-center gap-2"
            onClick={() => {
              const lbl = window.prompt("Edge label:");
              if (lbl !== null) setEdges(es => es.map(e => e.id === edgeCtx.edgeId ? { ...e, label: lbl } : e));
              setEdgeCtx({ visible: false, x: 0, y: 0, edgeId: null });
            }}
          >
            <Type size={12} /> Set Label
          </button>
          <div className="px-3 py-1 mt-1 text-[10px] font-bold text-gray-400 border-b border-t uppercase tracking-wider">Direction</div>
          <button className="text-left px-3 py-1 hover:bg-blue-50 text-gray-700 flex items-center gap-2" onClick={() => { setEdges(es => es.map(e => e.id === edgeCtx.edgeId ? { ...e, direction: 'forward' } : e)); setEdgeCtx({ visible: false, x: 0, y: 0, edgeId: null }); }}> → Forward </button>
          <button className="text-left px-3 py-1 hover:bg-blue-50 text-gray-700 flex items-center gap-2" onClick={() => { setEdges(es => es.map(e => e.id === edgeCtx.edgeId ? { ...e, direction: 'bidirectional' } : e)); setEdgeCtx({ visible: false, x: 0, y: 0, edgeId: null }); }}> ↔ Bidirectional </button>
          <button className="text-left px-3 py-1 hover:bg-blue-50 text-gray-700 flex items-center gap-2" onClick={() => { setEdges(es => es.map(e => e.id === edgeCtx.edgeId ? { ...e, direction: 'none' } : e)); setEdgeCtx({ visible: false, x: 0, y: 0, edgeId: null }); }}> ― None </button>
          <div className="px-3 py-1 mt-1 text-[10px] font-bold text-gray-400 border-b border-t uppercase tracking-wider">Color Picker</div>
          <div className="flex gap-1 px-3 py-2 flex-wrap">
            {['#000080', '#dc2626', '#16a34a', '#d97706', '#9333ea', '#64748b'].map(c => (
              <button key={c} className="w-4 h-4 rounded-full border border-gray-300" style={{ backgroundColor: c }} onClick={() => { setEdges(es => es.map(e => e.id === edgeCtx.edgeId ? { ...e, color: c } : e)); setEdgeCtx({ visible: false, x: 0, y: 0, edgeId: null }); }} />
            ))}
          </div>
        </div>
      )}

      {/* Canvas Context Menu */}
      {canvasCtx.visible && (
        <div
          className="fixed w-32 bg-white border border-gray-300 shadow-lg z-[9999] py-1 flex flex-col text-xs rounded"
          style={{ top: canvasCtx.y, left: canvasCtx.x }}
          onClick={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
        >
          <button className="text-left px-3 py-1.5 hover:bg-blue-50 text-gray-700 font-medium flex items-center gap-2"
            onClick={() => {
              const scrollContainer = document.querySelector('.mindmap-scroll-container');
              if (!scrollContainer) return;
              const rect = scrollContainer.getBoundingClientRect();
              let nx = (canvasCtx.x - rect.left - transform.x) / transform.scale;
              let ny = (canvasCtx.y - rect.top - transform.y) / transform.scale;
              if (snapToGrid) {
                nx = Math.round(nx / 20) * 20;
                ny = Math.round(ny / 20) * 20;
              }
              setNodes(ns => [...ns, { id: Date.now().toString(), x: nx, y: ny, text: '' }]);
              setCanvasCtx({ visible: false, x: 0, y: 0 });
            }}
          >
            <Plus size={12} /> Add Note
          </button>
        </div>
      )}
    </div>
  )
};

// ================= TASKBAR COMPONENT =================
const TaskBar = ({ windows, onWindowClick }) => {
  const [time, setTime] = useState(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })), 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="absolute bottom-0 left-0 right-0 h-[30px] bg-[#c0c0c0] border-t-2 border-white flex justify-between items-center px-1 z-[99999]">
      <div className="flex gap-1 overflow-x-auto h-full items-center py-1">
        <button className="flex items-center gap-1 px-2 h-full bg-[#c0c0c0] border-2 border-white border-r-gray-600 border-b-gray-600 active:border-gray-600 active:border-r-white active:border-b-white font-bold mr-2">
          <span className="text-blue-800 italic pr-1">Start</span>
        </button>
        <div className="w-[2px] h-full border-l border-gray-500 border-r border-white mx-1"></div>
        {windows.map(win => (
          <button
            key={win.id}
            onClick={() => onWindowClick(win.id)}
            className={`flex items-center gap-1 px-2 h-full min-w-[120px] max-w-[150px] truncate text-xs ${!win.isMinimized && win.isFocused
              ? 'bg-[#d0d0d0] border-2 border-gray-600 border-r-white border-b-white shadow-inner font-bold'
              : 'bg-[#c0c0c0] border-2 border-white border-r-gray-600 border-b-gray-600 hover:bg-[#d0d0d0]'
              }`}
          >
            {win.icon}
            <span className="truncate">{win.title}</span>
          </button>
        ))}
      </div>
      <div className="flex items-center h-full py-1">
        <div className="h-full px-2 flex items-center border-2 border-gray-600 border-r-white border-b-white shadow-inner text-xs bg-[#c0c0c0]">
          {time}
        </div>
      </div>
    </div>
  );
};

// ================= RENDER TREE ITEM =================
const TreeItem = ({ item, level = 0 }) => {
  const {
    expandedNodes, selectedNode, renamingNodeId, contextMenu, setContextMenu,
    setSelectedNode, handleSelect, dragOverInfo, setDragOverInfo,
    handleDragStart, handleDragOver, handleDrop, toggleNode,
    renameText, setRenameText, handleRenameSubmit, findNodeById
  } = React.useContext(AppContext);

  const isExpanded = expandedNodes[item.id];
  const isSelected = selectedNode === item.id;
  const isRenaming = renamingNodeId === item.id;

  const onContextMenu = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ visible: true, x: e.clientX, y: e.clientY, nodeId: item.id });
    setSelectedNode(item.id);
  };

  const longPressTimer = React.useRef(null);
  const touchStartPos = React.useRef({ x: 0, y: 0 });

  const handleTouchStart = (e) => {
    if (longPressTimer.current) clearTimeout(longPressTimer.current);
    if (e.touches && e.touches.length === 1) {
      const touch = e.touches[0];
      const px = touch.clientX;
      const py = touch.clientY;
      touchStartPos.current = { x: px, y: py };
      longPressTimer.current = setTimeout(() => {
        setContextMenu({ visible: true, x: px, y: py, nodeId: item.id });
        setSelectedNode(item.id);
        longPressTimer.current = null;
      }, 500);
    }
  };

  const handleTouchMove = (e) => {
    if (!longPressTimer.current) return;
    if (e.touches && e.touches.length === 1) {
      const touch = e.touches[0];
      const dx = Math.abs(touch.clientX - touchStartPos.current.x);
      const dy = Math.abs(touch.clientY - touchStartPos.current.y);
      if (dx > 10 || dy > 10) {
        cancelLongPress();
      }
    }
  };

  const cancelLongPress = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  const handleRowClick = (e) => {
    if (e.target.closest('button')) return; // Ignore expand clicks
    if (e.target.closest('input')) return; // Ignore inputs

    // Let Right-Click (button 2) pass through to onContextMenu
    if (e.button === 2) return;

    if (isRenaming) setRenamingNodeId(null);

    // Sadece seçme işlemi yap, açma işlemi tıkla değil
    handleSelect(item);
  };

  return (
    <div
      className="relative font-mono text-sm select-none"
      onContextMenu={onContextMenu}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={cancelLongPress}
      onTouchCancel={cancelLongPress}
      style={{ WebkitTouchCallout: 'none' }}
    >
      {dragOverInfo?.id === item.id && dragOverInfo.position === 'before' && <div className="absolute top-0 left-0 right-0 h-0.5 bg-blue-500 z-10" />}
      {dragOverInfo?.id === item.id && dragOverInfo.position === 'after' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500 z-10" />}
      <div
        className={`flex items-center hover:bg-blue-50 cursor-pointer py-[2px] ${isSelected ? 'bg-blue-100 border border-dotted border-blue-400' : 'border border-transparent'} ${dragOverInfo?.id === item.id && dragOverInfo.position === 'inside' ? 'bg-blue-200' : ''}`}
        onClick={handleRowClick}
        style={{ paddingLeft: `${level * 20}px` }}
        draggable
        onDragStart={(e) => handleDragStart(e, item.id)}
        onDragOver={(e) => {
          e.preventDefault();
          e.stopPropagation();
          const rect = e.currentTarget.getBoundingClientRect();
          const y = e.clientY - rect.top;
          let position = 'inside';
          if (item.type === 'group') {
            if (y < rect.height * 0.25) position = 'before';
            else if (y > rect.height * 0.75) position = 'after';
          } else {
            if (y < rect.height / 2) position = 'before';
            else position = 'after';
          }
          setDragOverInfo({ id: item.id, position });
          handleDragOver(e);
        }}
        onDragLeave={() => setDragOverInfo(null)}
        onDrop={(e) => handleDrop(e, item.id, dragOverInfo?.position)}
      >
        <div className="flex items-center w-full" >
          {
            item.type === 'group' ? (
              <button
                className="w-4 h-4 mr-1 flex items-center justify-center border border-gray-500 bg-white shadow-sm"
                onPointerDown={(e) => {
                  e.stopPropagation();
                  toggleNode(item.id);
                }}
              >
                {isExpanded ? <Minus size={10} className="text-black" /> : <Plus size={10} className="text-black" />}
              </button>
            ) : <div className="w-4 h-4 mr-1" > </div>}

          <span className="mr-1.5 text-yellow-600" >
            {item.type === 'group' ? <Folder size={14} fill="currentColor" className="text-yellow-500" /> : <FileText size={14} className="text-gray-500" />}
          </span>
          {
            isRenaming ? (
              <input
                type="text"
                value={renameText}
                autoFocus
                onChange={(e) => setRenameText(e.target.value)
                }
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleRenameSubmit();
                  if (e.key === 'Escape') setRenamingNodeId(null);
                }}
                onBlur={handleRenameSubmit}
                className="border border-blue-500 px-1 outline-none font-mono text-sm shadow-inner w-[200px]"
                onClick={(e) => e.stopPropagation()}
              />
            ) : (
              <span
                className={`px-1 ${isSelected && item.color === '#000000' ? 'bg-blue-600 text-white' : ''} ${isSelected && item.color !== '#000000' ? 'font-bold' : ''}`}
                style={{ color: isSelected && item.color === '#000000' ? 'white' : item.color }}
              >
                {item.name}
              </span>
            )}
          {item.applied && <span className="ml-2 text-[9px] bg-green-100 text-green-700 px-1 py-0.5 rounded border border-green-300 font-bold shadow-sm whitespace-nowrap">✅ Applied</span>}
        </div>
      </div>

      {
        item.children && isExpanded && (
          <div className="relative" >
            <div className="absolute border-l border-dotted border-gray-400 h-full" style={{ left: `${(level * 20) + 7}px`, top: 0 }
            } />
            {item.children.map((child) => <TreeItem key={child.id} item={child} level={level + 1} />)}
          </div>
        )}
    </div>
  );
};

window.MindMapNode = MindMapNode;
window.MindMapCanvas = MindMapCanvas;
window.TreeItem = TreeItem;
window.TaskBar = TaskBar;
