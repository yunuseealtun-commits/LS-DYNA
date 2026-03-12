const { useState, useEffect, useCallback, useRef, useContext } = React;
const { Minus, Plus, Search, FileText, Folder, Settings, X, Square, Scan, Type } = window.LucideReact || LucideReact;
const { JoditReactEditor, DraggableWindow } = window;

const TabbedEditor = ({
  editorWindow,
  setEditorWindow,
  editorTabs,
  setEditorTabs,
  activeTabId,
  setActiveTabId,
  maxZIndex,
  setMaxZIndex,
  isDirty,
  lastSaved,
  editorZoom,
  setEditorZoom,
  parameterNotes,
  postProcessingTasks,
  handleEditorChange,
  treeData,
  findNodeById,
  googleUser,
  loginWithGoogle,
  logoutGoogle
}) => {
  const [syncStatus, setSyncStatus] = useState('idle'); // idle, syncing, success, error
  const [syncError, setSyncError] = useState(null);
  const [syncedDocUrl, setSyncedDocUrl] = useState(null);

  if (!editorWindow.isVisible) return null;

  const activeTab = editorTabs.find(t => t.id === activeTabId);

  const getPathSteps = (nodeId) => {
    const steps = ["LS-DYNA Research"];
    
    // Helper to find path in tree
    const findPath = (nodes, targetId, currentPath = []) => {
      for (const n of nodes) {
        if (n.id === targetId) return currentPath;
        if (n.children) {
          const res = findPath(n.children, targetId, [...currentPath, n.name]);
          if (res) return res;
        }
      }
      return null;
    };

    const tab = editorTabs.find(t => t.id === nodeId);
    const effectiveOwnerId = tab?.ownerId || (nodeId.startsWith('General_') ? nodeId.replace('General_', '') : null);

    if (effectiveOwnerId) {
      const node = findNodeById(treeData, effectiveOwnerId);
      if (node) {
        const parentPath = findPath(treeData, effectiveOwnerId) || [];
        const isGeneral = nodeId.startsWith('General_');
        return [...steps, ...parentPath, node.name, isGeneral ? "General Notes" : tab?.title || nodeId];
      }
    } else if (nodeId.startsWith('mm-')) {
      return [...steps, "Mind Map", activeTab?.title || nodeId];
    } else {
      // Parameter note - find the node by checking which one has this parameter in parameterNotes
      // Since activeTabId for params is typically just the param name or a specific ID
      // Let's assume for now the user had a node selected when opening it.
      // A better way would be data-attribute or passing ownerNodeId in the tab object.
      // For now, we'll try to find any node that logically contains this "tab title" if it's a param name.
      return [...steps, "Parameters", activeTab?.title || nodeId];
    }
    return [...steps, activeTab?.title || nodeId];
  };

  const syncToDrive = async () => {
    if (!activeTab) return;
    if (!googleUser) return;

    setSyncStatus('syncing');
    setSyncError(null);

    const path = getPathSteps(activeTab.id);
    const content = activeTab.type === 'parameter'
      ? (parameterNotes[activeTab.id] || '')
      : (postProcessingTasks.find(t => t.id === activeTab.id)?.details || '');

    try {
      const response = await fetch('/api/drive/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          path,
          content,
          email: googleUser.email
        })
      });

      const data = await response.json();
      if (response.ok) {
        setSyncStatus('success');
        setSyncedDocUrl(data.url);
        setTimeout(() => setSyncStatus('idle'), 3000);
      } else {
        throw new Error(data.error || 'Sync failed');
      }
    } catch (err) {
      setSyncStatus('error');
      setSyncError(err.message);
      console.error("Drive Sync Error:", err);
    }
  };

  // Auto-Sync Logic (Phase 18)
  useEffect(() => {
    if (!googleUser || !activeTabId || !isDirty) return;
    
    const timer = setTimeout(() => {
        syncToDrive();
    }, 2000); // 2 second debounce for cloud sync
    
    return () => clearTimeout(timer);
  }, [activeTabId, isDirty, googleUser]);

  return (
    <DraggableWindow
      id="editor"
      title={(
        <div className="flex justify-between items-center w-full pr-8">
          <div className="flex items-center gap-1">
            <FileText size={14} className="text-blue-500" /> Tabbed Notes
          </div>
          <div className="flex items-center gap-2">
            {lastSaved && (
              <div className="hidden md:flex text-[10px] font-normal bg-blue-900/30 px-2 py-0.5 rounded items-center gap-1">
                <span className="opacity-70">Oto-kayıt:</span> {lastSaved}
              </div>
            )}
            {/* Google Drive Status (Passive) */}
            {googleUser && (
              <div className={`flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded border ${syncStatus === 'syncing' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-500'}`}>
                <div className={`w-1.5 h-1.5 rounded-full ${syncStatus === 'syncing' ? 'bg-blue-500 animate-pulse' : 'bg-green-500'}`} />
                {syncStatus === 'syncing' ? 'Syncing...' : 'Cloud Connected'}
              </div>
            )}
          </div>
        </div>
      )}
      zIndex={editorWindow.zIndex}
      onFocus={() => {
        const newZ = maxZIndex + 1;
        setMaxZIndex(newZ);
        setEditorWindow(prev => ({ ...prev, zIndex: newZ }));
      }}
      onClose={() => {
        if (isDirty) {
          if (!window.confirm("Kaydedilmemiş değişiklikleriniz olabilir. Yine de kapatmak istiyor musunuz?")) return;
        }
        setEditorTabs([]);
        setActiveTabId(null);
        setEditorWindow(prev => ({ ...prev, isVisible: false }));
      }}
      isMinimized={editorWindow.isMinimized}
      onMinimize={() => setEditorWindow(prev => ({ ...prev, isMinimized: true }))}
      isMaximized={editorWindow.isMaximized}
      onMaximize={() => setEditorWindow(prev => ({ ...prev, isMaximized: !prev.isMaximized }))}
      initialPos={{ x: 50, y: 50 }}
      width={1400}
      height={700}
      maxHeight={2000}
      allowOverflow={true}
    >
      <div className="w-full h-full flex flex-col bg-[#eef0f4] font-sans rounded-b-lg overflow-hidden">
        {/* Chrome-like Tabs Header */}
        <div className="flex px-2 pt-2 bg-gray-300 border-b border-gray-400 gap-1 overflow-x-auto shrink-0 mt-1">
          {editorTabs.map(tab => (
            <div
              key={tab.id}
              onClick={() => setActiveTabId(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-t-lg cursor-pointer text-sm font-medium transition-colors ${activeTabId === tab.id ? 'bg-white text-blue-800 border-t-2 border-t-blue-500 shadow-sm z-10' : 'bg-gray-200 text-gray-600 hover:bg-gray-100 border border-transparent border-b-gray-400'}`}
            >
              <FileText size={14} className={activeTabId === tab.id ? 'text-blue-600' : 'text-gray-500'} />
              {tab.title}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  const newTabs = editorTabs.filter(t => t.id !== tab.id);
                  setEditorTabs(newTabs);
                  if (activeTabId === tab.id && newTabs.length > 0) {
                    setActiveTabId(newTabs[newTabs.length - 1].id);
                  } else if (newTabs.length === 0) {
                    setActiveTabId(null);
                    setEditorWindow(prev => ({ ...prev, isVisible: false }));
                  }
                }}
                className={`ml-2 rounded-full p-0.5 ${activeTabId === tab.id ? 'hover:bg-blue-100 text-gray-500 hover:text-red-500' : 'hover:bg-gray-400 text-gray-500 hover:text-white'}`}
              >
                <X size={12} />
              </button>
            </div>
          ))}
        </div>

        {/* Editor Tools Header */}
        <div className="flex items-center px-4 py-2 bg-white border-b shadow-sm gap-4 shrink-0 z-20">
          <div className="ml-auto flex items-center gap-3">
            <span className="text-xs text-gray-500 font-bold bg-green-100 text-green-700 px-2 py-1 rounded">✔ Auto-Saved to LocalStorage</span>
            <span className="text-xs text-gray-400 ml-2">Zoom: {editorZoom}%</span>
          </div>
        </div>

        {/* Editor Canvas Area */}
        <div className="flex-1 bg-[#eef0f4] relative flex flex-col min-h-0 p-6 overflow-auto"
          onWheel={(e) => {
            if (e.ctrlKey) {
              e.preventDefault();
              if (e.deltaY < 0) setEditorZoom(z => Math.min(z + 10, 300));
              else setEditorZoom(z => Math.max(z - 10, 50));
            }
          }}
        >
          <div className="bg-white rounded-lg shadow-md mx-auto min-h-full transition-transform origin-top-center onenote-editor border border-gray-200 flex flex-col"
            style={{ width: '850px', maxWidth: '95%', zoom: `${editorZoom}%` }}>
            {activeTabId ? (
              <JoditReactEditor
                key={activeTabId}
                value={
                  editorTabs.find(t => t.id === activeTabId)?.type === 'parameter'
                    ? (parameterNotes[activeTabId] || '')
                    : (postProcessingTasks.find(t => t.id === activeTabId)?.details || '')
                }
                onChange={handleEditorChange}
                className="flex-1 border-0 text-[14px] flex flex-col min-h-0"
                autoFocus={true}
              />
            ) : (
              <div className="flex-1 flex items-center justify-center text-gray-400 italic font-medium p-10 text-center">
                No notes open.<br />Open a parameter note from the Keyword Tree.
              </div>
            )}
          </div>
        </div>
      </div>
    </DraggableWindow>
  );
};

window.TabbedEditor = TabbedEditor;
