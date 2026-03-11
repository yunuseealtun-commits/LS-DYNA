const { useState, useEffect, useCallback, useRef, useMemo, useContext } = React;
const { Minus, Plus, Search, FileText, Folder, Settings, X, Square, Scan, Type } = window.LucideReact || LucideReact;

window.AppContext = React.createContext();

const JoditReactEditor = ({ value, onChange, placeholder, className, autoFocus }) => {
  const containerRef = useRef(null);
  const joditInstance = useRef(null);
  const isInternalChange = useRef(false);
  const lastEmittedValue = useRef(value || '');

  useEffect(() => {
    if (!containerRef.current) return;

    let isMounted = true;

    // Clean up any existing content
    containerRef.current.innerHTML = '';
    const editorDiv = document.createElement('div');
    containerRef.current.appendChild(editorDiv);

    const config = {
      theme: 'default',
      placeholder: placeholder || 'Type your notes here...',
      readonly: false,
      toolbarButtonSize: 'middle',
      autofocus: autoFocus || false,
      toolbarSticky: true,
      showCharsCounter: false,
      showWordsCounter: false,
      showXPathInStatusbar: false,
      disablePlugins: "about,video",
      buttons: [
        'source', '|',
        'bold', 'strikethrough', 'underline', 'italic', '|',
        'superscript', 'subscript', '|',
        'ul', 'ol', '|',
        'outdent', 'indent', '|',
        'font', 'fontsize', 'brush', 'paragraph', '|',
        'image', 'table', 'link', '|',
        'align', 'undo', 'redo', '|',
        'hr', 'eraser', 'copyformat', '|',
        'fullsize', 'print'
      ],
      events: {
        change: (newHtml) => {
          if (isInternalChange.current) return;
          lastEmittedValue.current = newHtml;
          if (onChange) onChange(newHtml);
        }
      }
    };

    let retries = 0;
    const initEditor = () => {
      if (!isMounted) return;
      let JoditClass = null;
      if (typeof window.Jodit !== 'undefined') {
        JoditClass = window.Jodit.Jodit || window.Jodit;
      } else if (typeof Jodit !== 'undefined') {
        JoditClass = Jodit;
      }

      if (!JoditClass) {
        retries++;
        if (retries > 50) {
          console.error("Jodit Editor failed to load from CDN after 5 seconds.");
          if (containerRef.current) {
            containerRef.current.innerHTML = '<div class="p-4 text-red-500 text-sm font-bold border border-red-200 bg-red-50 rounded">Error: Text Editor failed to load from CDN. Please check your internet connection or AdBlocker and refresh the page.</div>';
          }
          return;
        }
        console.warn("Jodit is not loaded yet, retrying in 100ms...");
        setTimeout(initEditor, 100);
        return;
      }

      joditInstance.current = new JoditClass(editorDiv, config);

      // Initial value
      isInternalChange.current = true;
      joditInstance.current.value = value || '';
      isInternalChange.current = false;
    };

    initEditor();

    return () => {
      isMounted = false;
      if (joditInstance.current) {
        clearTimeout(joditInstance.current._changeTimeout);
        joditInstance.current.destruct();
      }
    };
  }, []); // Empty dependency array means this initializes once

  // Handle value changes from parent (e.g. loading a different note)
  useEffect(() => {
    if (joditInstance.current && value !== undefined) {
      if (value !== lastEmittedValue.current) {
        isInternalChange.current = true;
        joditInstance.current.value = value || '';
        lastEmittedValue.current = value;
        isInternalChange.current = false;
      }
    }
  }, [value]);

  return <div className={`flex flex-col ${className}`} ref={containerRef} />;
};

window.JoditReactEditor = JoditReactEditor;

const DraggableWindow = ({
  id, title, children, onClose, initialPos, zIndex, onFocus,
  width = 450, height = 300, minHeight = 150, maxHeight = 1080,
  isMinimized, onMinimize, isMaximized, onMaximize, allowOverflow = false
}) => {
  const [pos, setPos] = useState(initialPos || { x: 50, y: 50 });
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [customDims, setCustomDims] = useState({ w: width, h: height });

  const handlePointerDown = (e) => {
    if (e.target.closest('.no-drag')) return;
    setDragOffset({ x: e.clientX - pos.x, y: e.clientY - pos.y });
    setIsDragging(true);
    e.target.setPointerCapture(e.pointerId);
    if (onFocus) onFocus();
  };

  const handleResizeDown = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsResizing(true);
    setDragOffset({ x: e.clientX, y: e.clientY });
    e.target.setPointerCapture(e.pointerId);
    if (onFocus) onFocus();
  };

  const handlePointerMove = (e) => {
    if (isDragging) {
      const newX = e.clientX - dragOffset.x;
      const newY = e.clientY - dragOffset.y;
      setPos({ x: newX, y: newY });
    } else if (isResizing) {
      const deltaX = e.clientX - dragOffset.x;
      const deltaY = e.clientY - dragOffset.y;
      setCustomDims(prev => ({
        w: Math.max(300, prev.w + deltaX),
        h: Math.max(minHeight, prev.h + deltaY)
      }));
      setDragOffset({ x: e.clientX, y: e.clientY });
    }
  };

  const handlePointerUp = (e) => {
    setIsDragging(false);
    setIsResizing(false);
    e.target.releasePointerCapture(e.pointerId);
  };

  const [maxDims, setMaxDims] = useState({ w: window.innerWidth, h: window.innerHeight - 30 });
  useEffect(() => {
    const handleResize = () => setMaxDims({ w: window.innerWidth, h: window.innerHeight - 30 });
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  if (isMinimized) return null;

  const windowStyle = isMaximized
    ? { left: 0, top: 0, width: `${maxDims.w}px`, height: `${maxDims.h}px`, zIndex, minWidth: 300 }
    : {
      left: pos.x,
      top: pos.y,
      width: `${customDims.w}px`,
      height: `${customDims.h}px`,
      zIndex,
      minWidth: 300,
      minHeight,
      maxHeight
    };

  return (
    <div
      className={`absolute flex flex-col bg-[#f0f0f0] border-2 border-white border-r-gray-500 border-b-gray-500 shadow-xl ${allowOverflow ? 'overflow-visible' : 'overflow-hidden'}`}
      style={windowStyle}
      onMouseDown={onFocus}
    >
      <div
        className="bg-gradient-to-r from-[#000080] to-[#1084d0] px-2 py-1 flex justify-between items-center select-none text-white cursor-pointer shrink-0"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
      >
        <span className="font-bold tracking-wide text-xs flex items-center gap-2 truncate pr-4" >
          {title}
        </span>
        < div className="flex gap-1 no-drag" onPointerDown={e => e.stopPropagation()} >
          {onMinimize && (
            <button onClick={onMinimize} className="w-4 h-4 bg-[#c0c0c0] border border-white border-r-gray-600 border-b-gray-600 flex items-center justify-center text-black font-bold leading-none active:border-gray-600 active:border-r-white active:border-b-white" > <Minus size={12} strokeWidth={3} /> </button>
          )}
          {onMaximize && (
            <button onClick={onMaximize} className="w-4 h-4 bg-[#c0c0c0] border border-white border-r-gray-600 border-b-gray-600 flex items-center justify-center text-black font-bold text-xs leading-none active:border-gray-600 active:border-r-white active:border-b-white" > <Square size={8} /></button >
          )}
          {onClose && (
            <button onClick={onClose} className="w-4 h-4 bg-[#c0c0c0] border border-white border-r-gray-600 border-b-gray-600 flex items-center justify-center text-black font-bold text-xs leading-none active:border-gray-600 active:border-r-white active:border-b-white" >
              <X size={12} />
            </button>
          )}
        </div>
      </div>
      < div className={`flex-1 flex flex-col ${allowOverflow ? 'overflow-visible' : 'overflow-hidden'} min-h-0 relative`} >
        {children}
        {!isMaximized && (
          <div
            className="absolute bottom-0 right-0 w-4 h-4 cursor-nwse-resize z-[100] flex items-end justify-end p-0.5 group"
            onPointerDown={handleResizeDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
          >
            <div className="w-0 h-0 border-l-[8px] border-l-transparent border-b-[8px] border-b-gray-400 group-hover:border-b-blue-600"></div>
          </div>
        )}
      </div>
    </div>
  );
};

window.DraggableWindow = DraggableWindow;

const stickyColors = ['#fdfd96', '#ffb3ba', '#ffdfba', '#baffc9', '#bae1ff', '#e0baff'];

const StickyNote = ({ note, updateNote, deleteNote, bringToFront }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [pos, setPos] = useState({ x: note.x, y: note.y });
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  const handlePointerDown = (e) => {
    if (e.target.closest('.note-content')) return;
    if (e.target.closest('.resize-handle')) return;
    e.preventDefault();
    setDragOffset({ x: e.clientX - pos.x, y: e.clientY - pos.y });
    setIsDragging(true);
    e.target.setPointerCapture(e.pointerId);
    bringToFront(note.id);
  };

  const handlePointerMove = (e) => {
    if (isDragging) {
      setPos({ x: e.clientX - dragOffset.x, y: e.clientY - dragOffset.y });
    }
  };

  const handlePointerUp = (e) => {
    if (isDragging) {
      setIsDragging(false);
      e.target.releasePointerCapture(e.pointerId);
      updateNote(note.id, { x: pos.x, y: pos.y });
    }
  };

  return (
    <div
      className="absolute shadow-lg flex flex-col group border border-black/10"
      style={{ left: pos.x, top: pos.y, width: note.w, height: note.h, backgroundColor: note.color, zIndex: note.zIndex }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onMouseDown={() => bringToFront(note.id)}
    >
      <div className="h-6 w-full cursor-grab opacity-0 group-hover:opacity-100 flex items-center justify-between px-1 bg-black/10 transition-opacity">
        <div className="flex gap-1" onPointerDown={e => e.stopPropagation()}>
          {stickyColors.map(c => <button key={c} className="w-3 h-3 rounded-full border border-black/20" style={{ backgroundColor: c }} onClick={() => updateNote(note.id, { color: c })} />)}
        </div>
        <button onClick={(e) => { e.stopPropagation(); deleteNote(note.id); }} className="text-black/50 hover:text-black">
          <X size={12} />
        </button>
      </div>
      <div className="flex-1 p-2 note-content cursor-text" onPointerDown={e => e.stopPropagation()}>
        <textarea
          className="w-full h-full bg-transparent resize-none outline-none font-sans text-sm text-gray-800"
          value={note.text}
          onChange={(e) => updateNote(note.id, { text: e.target.value })}
          placeholder="Take a sticky note..."
        />
      </div>
      <div
        className="absolute bottom-0 right-0 w-4 h-4 cursor-se-resize resize-handle flex items-center justify-center opacity-0 group-hover:opacity-100"
        onPointerDown={(e) => {
          e.stopPropagation();
          e.target.setPointerCapture(e.pointerId);
          let startX = e.clientX;
          let startY = e.clientY;
          let startW = note.w;
          let startH = note.h;
          const onMove = (ev) => {
            updateNote(note.id, { w: Math.max(150, startW + (ev.clientX - startX)), h: Math.max(150, startH + (ev.clientY - startY)) });
          };
          const onUp = (ev) => {
            ev.target.releasePointerCapture(ev.pointerId);
            ev.target.removeEventListener('pointermove', onMove);
            ev.target.removeEventListener('pointerup', onUp);
          };
          e.target.addEventListener('pointermove', onMove);
          e.target.addEventListener('pointerup', onUp);
        }}
      >
        <div className="w-2 h-2 border-r-2 border-b-2 border-black/30" />
      </div>
    </div>
  );
};

window.StickyNote = StickyNote;
window.stickyColors = stickyColors;
