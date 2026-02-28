import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { initialTreeData } from './keywords';
import { Minus, Plus, Search, FileText, Folder, Settings, X, Square } from 'lucide-react';

const generateId = () => Math.random().toString(36).substr(2, 9);

// Deep clone for Copy/Paste functionality
const cloneNode = (node) => ({
  ...node,
  id: generateId(),
  children: node.children ? node.children.map(cloneNode) : undefined,
  rows: node.rows ? JSON.parse(JSON.stringify(node.rows)) : undefined
});

const KeywordManager = () => {
  const [activeTab, setActiveTab] = useState('Keyword Tree');
  const [selectedNode, setSelectedNode] = useState(null);
  const [filterText, setFilterText] = useState('');
  const [clipboard, setClipboard] = useState(null);

  // Right-click context menu state
  const [contextMenu, setContextMenu] = useState({ visible: false, x: 0, y: 0, nodeId: null });

  // Editing state (Opens the parameter form)
  const [editingNode, setEditingNode] = useState(null);

  // LS-DYNA Keyword Structure Data mapped perfectly to the requested input parameters
  const [treeData, setTreeData] = useState(initialTreeData);

  const [expandedNodes, setExpandedNodes] = useState({
    'control': true, 'database': false, 'boundary': false, 'contact': true,
    'part': true, 'mat': false, 'section': false, 'eos': false, 'hourglass': false, 'initial': false, 'element': false
  });

  // ================= COPY & PASTE (Ctrl+C / Ctrl+V) =================
  const findNodeById = useCallback((nodes, id) => {
    for (const node of nodes) {
      if (node.id === id) return node;
      if (node.children) {
        const found = findNodeById(node.children, id);
        if (found) return found;
      }
    }
    return null;
  }, []);

  const getTotalItemsCount = useCallback((nodes) => {
    return nodes.reduce((count, node) => {
      let current = node.type === 'item' ? 1 : 0;
      let childrenCount = node.children ? getTotalItemsCount(node.children) : 0;
      return count + current + childrenCount;
    }, 0);
  }, []);

  // Name Editing State (Rename)
  const [renamingNodeId, setRenamingNodeId] = useState(null);
  const [renameText, setRenameText] = useState('');

  const handleStartRename = useCallback((id) => {
    const node = findNodeById(treeData, id);
    if (node) {
      setRenamingNodeId(id);
      setRenameText(node.name);
      setContextMenu({ visible: false, x: 0, y: 0, nodeId: null });
    }
  }, [treeData, findNodeById]);

  // Drag and Drop State and Handlers
  const [draggedNodeId, setDraggedNodeId] = useState(null);

  const handleDragStart = useCallback((e, id) => {
    e.stopPropagation();
    setDraggedNodeId(id);
    if (e.dataTransfer) {
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', id); // required for Firefox
    }
  }, []);

  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
  }, []);

  const handleDrop = useCallback((e, targetId) => {
    e.preventDefault();
    e.stopPropagation();

    if (!draggedNodeId || draggedNodeId === targetId) return;

    setTreeData(prev => {
      let draggedNode = null;
      const removeNode = (nodes) => {
        let newNodes = [];
        for (const n of nodes) {
          if (n.id === draggedNodeId) {
            draggedNode = n;
          } else {
            let newNode = { ...n };
            if (n.children) {
              newNode.children = removeNode(n.children);
            }
            newNodes.push(newNode);
          }
        }
        return newNodes;
      };

      let treeWithoutDragged = removeNode(prev);
      if (!draggedNode) return prev;

      let inserted = false;
      const insertNode = (nodes) => {
        let newNodes = [];
        for (const n of nodes) {
          if (n.id === targetId) {
            inserted = true;
            if (n.type === 'group') {
              newNodes.push({ ...n, children: [...(n.children || []), draggedNode] });
              setExpandedNodes(eState => ({ ...eState, [n.id]: true }));
            } else {
              newNodes.push(draggedNode, n);
            }
          } else {
            let newNode = { ...n };
            if (n.children) {
              newNode.children = insertNode(n.children);
            }
            newNodes.push(newNode);
          }
        }
        return newNodes;
      };

      const finalTree = insertNode(treeWithoutDragged);
      return inserted ? finalTree : prev;
    });
    setDraggedNodeId(null);
  }, [draggedNodeId]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      // Input alanlarındayken kopyalama yapıştırma çakışmasını engelle
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

      if (e.key === 'F2' && selectedNode) {
        handleStartRename(selectedNode);
        e.preventDefault();
      } else if (e.ctrlKey && e.key === 'c' && selectedNode) {
        const nodeToCopy = findNodeById(treeData, selectedNode);
        if (nodeToCopy) setClipboard(cloneNode(nodeToCopy));
      } else if (e.ctrlKey && e.key === 'v' && clipboard) {
        pasteNode(clipboard);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [selectedNode, clipboard, treeData, findNodeById, handleStartRename]);

  // ================= ADD, DELETE, PASTE LOGIC =================
  const pasteNode = (copiedNode) => {
    const newNode = cloneNode(copiedNode);
    setTreeData(prev => {
      if (!selectedNode) return [...prev, newNode];

      const insertIntoTree = (nodes) => {
        let newNodes = [];
        for (const node of nodes) {
          if (node.id === selectedNode) {
            if (node.type === 'group') {
              newNodes.push({ ...node, children: [...(node.children || []), newNode] });
              setExpandedNodes(e => ({ ...e, [node.id]: true }));
            } else {
              newNodes.push(node, newNode);
            }
          } else if (node.children) {
            newNodes.push({ ...node, children: insertIntoTree(node.children) });
          } else {
            newNodes.push(node);
          }
        }
        return newNodes;
      };
      return insertIntoTree(prev);
    });
  };

  const handleAddFolder = (targetParentId) => {
    const newFolder = { id: generateId(), name: 'NEW_FOLDER', type: 'group', color: '#000000', children: [] };
    setTreeData(prev => {
      if (!targetParentId) return [...prev, newFolder];

      const insertIntoTree = (nodes) => {
        let newNodes = [];
        for (const node of nodes) {
          if (node.id === targetParentId) {
            if (node.type === 'group') {
              newNodes.push({ ...node, children: [...(node.children || []), newFolder] });
              setExpandedNodes(e => ({ ...e, [node.id]: true }));
            } else {
              newNodes.push(node, newFolder);
            }
          } else if (node.children) {
            newNodes.push({ ...node, children: insertIntoTree(node.children) });
          } else {
            newNodes.push(node);
          }
        }
        return newNodes;
      };
      return insertIntoTree(prev);
    });
    setRenamingNodeId(newFolder.id);
    setRenameText('NEW_FOLDER');
    setContextMenu({ visible: false, x: 0, y: 0, nodeId: null });
  };

  const handleAddNode = () => {
    let newName = 'NEW_KEYWORD';

    // Auto-prefix logic based on selected node's context
    if (selectedNode) {
      // Find the selected node to determine its parent or its own name
      const selected = findNodeById(treeData, selectedNode);
      if (selected) {
        if (selected.type === 'group') {
          newName = selected.name.replace(/^\*/, '') + '_';
        } else {
          // If it's an item, try to find its parent to get the prefix
          const findParent = (nodes, id, parent = null) => {
            for (const node of nodes) {
              if (node.id === id) return parent;
              if (node.children) {
                const p = findParent(node.children, id, node);
                if (p) return p;
              }
            }
            return null;
          };
          const parent = findParent(treeData, selectedNode);
          if (parent) {
            newName = parent.name.replace(/^\*/, '') + '_';
          }
        }
      }
    }

    const emptyRow = Array(8).fill(null).map(() => ({ label: 'NEW', val: '' }));
    const newNode = { id: generateId(), name: newName, type: 'item', color: '#000000', rows: [emptyRow] };
    pasteNode(newNode);
    setRenamingNodeId(newNode.id);
    setRenameText(newName);
  };

  const handleDeleteNode = () => {
    if (!selectedNode) return;
    const deleteFromTree = (nodes) => {
      return nodes.filter(n => n.id !== selectedNode).map(n => ({
        ...n,
        children: n.children ? deleteFromTree(n.children) : undefined
      }));
    };
    setTreeData(prev => deleteFromTree(prev));
    setSelectedNode(null);
  };

  const handleRenameSubmit = () => {
    if (!renamingNodeId) return;
    const updateName = (nodes) => {
      return nodes.map(n => {
        if (n.id === renamingNodeId) return { ...n, name: renameText };
        if (n.children) return { ...n, children: updateName(n.children) };
        return n;
      });
    };
    setTreeData(prev => updateName(prev));
    setRenamingNodeId(null);
  };

  // ================= RIGHT CLICK COLOR MENU =================
  const changeNodeColor = (color) => {
    const updateColor = (nodes) => {
      return nodes.map(n => {
        if (n.id === contextMenu.nodeId) return { ...n, color };
        if (n.children) return { ...n, children: updateColor(n.children) };
        return n;
      });
    };
    setTreeData(prev => updateColor(prev));
    setContextMenu({ visible: false, x: 0, y: 0, nodeId: null });
  };

  useEffect(() => {
    const closeMenu = () => setContextMenu(prev => ({ ...prev, visible: false }));
    document.addEventListener('click', closeMenu);
    return () => document.removeEventListener('click', closeMenu);
  }, []);

  // ================= FILTERING =================
  const filterNodes = (nodes, text) => {
    if (!text) return nodes;
    return nodes.reduce((acc, node) => {
      const matchesNode = node.name.toLowerCase().includes(text.toLowerCase());
      const filteredChildren = node.children ? filterNodes(node.children, text) : [];
      if (matchesNode || filteredChildren.length > 0) {
        acc.push({ ...node, children: filteredChildren });
      }
      return acc;
    }, []);
  };
  const filteredData = useMemo(() => filterNodes(treeData, filterText), [filterText, treeData]);

  const toggleNode = (nodeId) => {
    setExpandedNodes(prev => ({ ...prev, [nodeId]: !prev[nodeId] }));
  };

  const handleSelect = (node) => {
    setSelectedNode(node.id);
  };
  const handleDoubleClick = (node) => {
    if (node.type !== 'group') {
      setEditingNode(node);
    }
  };

  // ================= RENDER TREE ITEM =================
  const TreeItem = ({ item, level = 0 }) => {
    const isExpanded = expandedNodes[item.id];
    const isSelected = selectedNode === item.id;
    const isRenaming = renamingNodeId === item.id;

    const onContextMenu = (e) => {
      e.preventDefault();
      setContextMenu({ visible: true, x: e.pageX, y: e.pageY, nodeId: item.id });
      setSelectedNode(item.id);
    };

    return (
      <div className= "relative font-mono text-sm select-none" onContextMenu = { onContextMenu } >
        <div 
          className={ `flex items-center hover:bg-blue-50 cursor-pointer py-[2px] ${isSelected ? 'bg-blue-100 border border-dotted border-blue-400' : 'border border-transparent'}` }
    onClick = {() => { handleSelect(item); if (isRenaming) setRenamingNodeId(null); }}
onDoubleClick = {() => handleDoubleClick(item)}
style = {{ paddingLeft: `${level * 20}px` }}
draggable
onDragStart = {(e) => handleDragStart(e, item.id)}
onDragOver = { handleDragOver }
onDrop = {(e) => handleDrop(e, item.id)}
        >
  <div className="flex items-center w-full" >
  {
    item.children ? (
      <button 
        onClick= {(e) => { e.stopPropagation(); toggleNode(item.id); }}
className = "w-4 h-4 mr-1 flex items-center justify-center border border-gray-500 bg-white shadow-sm"
  >
  { isExpanded?<Minus size = { 10 } className = "text-black" /> : <Plus size={ 10 } className = "text-black" />}
</button>
            ) : <div className="w-4 h-4 mr-1" > </div>}

<span className="mr-1.5 text-yellow-600" >
  { item.type === 'group' ? <Folder size={ 14 } fill = "currentColor" className = "text-yellow-500" /> : <FileText size={ 14 } className = "text-gray-500" />}
</span>
{
  isRenaming ? (
    <input 
    type= "text" 
    value = { renameText }
  autoFocus
  onChange = {(e) => setRenameText(e.target.value)
}
onKeyDown = {(e) => {
  if (e.key === 'Enter') handleRenameSubmit();
  if (e.key === 'Escape') setRenamingNodeId(null);
}}
onBlur = { handleRenameSubmit }
className = "border border-blue-500 px-1 outline-none font-mono text-sm shadow-inner w-[200px]"
onClick = {(e) => e.stopPropagation()}
  />
) : (
  <span 
    className= {`px-1 ${isSelected && item.color === '#000000' ? 'bg-blue-600 text-white' : ''} ${isSelected && item.color !== '#000000' ? 'font-bold' : ''}`}
style = {{ color: isSelected && item.color === '#000000' ? 'white' : item.color }}
  >
  { item.name }
  </span>
)}
</div>
  </div>

{
  item.children && isExpanded && (
    <div className="relative" >
      <div className="absolute border-l border-dotted border-gray-400 h-full" style = {{ left: `${(level * 20) + 7}px`, top: 0 }
} />
{ item.children.map((child) => <TreeItem key={ child.id } item = { child } level = { level + 1} />)}
</div>
)}
</div>
    );
  };

// ================= INPUT FORM COMPONENT =================
const InputFormView = () => {
  const hasData = editingNode.rows && editingNode.rows.length > 0;

  return (
    <div className= "flex-1 bg-[#f0f0f0] flex flex-col h-full font-sans text-xs overflow-hidden" >
    {/* Form Top Bar */ }
    < div className = "flex justify-between items-start mb-2 shrink-0" >
      <div className="flex gap-4" >
        <label className="flex items-center gap-1 cursor-pointer" > <input type="checkbox" /> Use * Parameter </label>
          < label className = "flex items-center gap-1 cursor-pointer" > <input type="checkbox" /> Comment </label>
            </div>
            < div className = "flex flex-col items-center" >
              <span className="text-[10px] text-gray-700" > (Subsys: 1 C: \Users\Desktop\LS - DYNA_File.k)</span>
                < span className = "font-bold text-sm mt-1" >* { editingNode.name.replace(/^\*/, '') }(1) </span>
                  </div>
                  < div className = "flex gap-1 flex-wrap justify-end w-[400px]" >
                  {
                    ['CmpBase', 'Compare', 'Clear', 'Accept', 'Delete', 'Default', 'Save2Buf', 'Done', 'Setting'].map(btn => (
                      <button key= { btn } onClick = {() => btn === 'Done' ? setEditingNode(null) : null}
className = "px-2 py-0.5 bg-[#f0f0f0] border-2 border-white border-r-gray-600 border-b-gray-600 active:border-gray-600 active:border-r-white active:border-b-white" >
  { btn }
  </button>
            ))}
</div>
  </div>

  < hr className = "border-gray-400 mb-2 shrink-0" />

    {/* Dynamic Form Grid based on selected keyword data */ }
    < div className = "bg-[#f0f0f0] border border-gray-400 p-2 overflow-y-auto flex-1 relative min-h-0" >

    {
      hasData?(
            <div className = "grid grid-cols-[20px_repeat(8,_1fr)] gap-x-2 gap-y-3 items-center" >
        {
          editingNode.rows.map((row, rowIdx) => (
            <React.Fragment key= { rowIdx } >
            <span className="font-bold text-gray-600 text-right pr-1 self-end mb-1" > { rowIdx + 1} </span>
                  { row.map((field, colIdx) => (
              <div key= {`${rowIdx}-${colIdx}`} className = "flex flex-col gap-0.5 w-full" >
                {
                  field.label ? (
                    <>
                    <span className= "text-blue-700 underline cursor-pointer hover:text-blue-900 text-[10px] truncate" title={ field.label } > { field.label } </span>
                    < input type="text" defaultValue={ field.val } className="border border-gray-400 bg-white h-[20px] px-1 text-blue-800 outline-none shadow-inner w-full text-[11px]" />
                    </>
                      ) : (
                      <div className="h-[20px] w-full" /> /* Empty Spacer Column */
                      )}
</div>
                  ))}

{/* Inject the "Optional Cards" radio for CONTROL_CONTACT exactly like image after row 2 */ }
{
  editingNode.name === 'CONTROL_CONTACT' && rowIdx === 1 && (
    <div className="col-span-9 ml-8 my-2" >
      <fieldset className="border border-gray-300 p-2 relative flex gap-4 text-[11px] bg-[#f0f0f0] inline-flex" >
        <legend className="absolute -top-2 left-2 px-1 bg-[#f0f0f0] text-gray-700" > Active optional cards </legend>
          < label className = "flex items-center gap-1 cursor-pointer" > <input type="radio" name = "opt" /> None </label>
            < label className = "flex items-center gap-1 cursor-pointer" > <input type="radio" name = "opt" /> Opt1 </label>
              < label className = "flex items-center gap-1 cursor-pointer" > <input type="radio" name = "opt" /> Opt12 </label>
                < label className = "flex items-center gap-1 cursor-pointer" > <input type="radio" name = "opt" /> Opt123 </label>
                  < label className = "flex items-center gap-1 cursor-pointer font-bold text-blue-800" > <input type="radio" name = "opt" defaultChecked /> Opt1234 </label>
                    < label className = "flex items-center gap-1 cursor-pointer" > <input type="radio" name = "opt" /> Opt12345 </label>
                      </fieldset>
                      </div>
                  )
}
</React.Fragment>
              ))}
</div>
          ) : (
  <div className= "flex h-full items-center justify-center text-gray-500 italic" > No parameters available for this keyword.</div>
          )}
</div>

{/* Bottom Text Area */ }
<div className="mt-2 h-20 border border-gray-400 bg-white shadow-inner p-1 overflow-auto font-mono shrink-0 text-[11px]" >
  $# Parameter notes or keyword comments go here...
</div>
  </div>
    );
  };

return (
  <div className= "h-screen bg-teal-800 flex items-center justify-center p-4 font-sans text-[13px] overflow-hidden" >

  {/* Context Menu for Right Click Color Selection */ }
{
  contextMenu.visible && (
    <div 
          className="fixed bg-[#f0f0f0] border-2 border-white border-r-gray-600 border-b-gray-600 shadow-lg z-50 w-32 py-1 flex flex-col"
  style = {{ top: contextMenu.y, left: contextMenu.x }
}
onClick = {(e) => e.stopPropagation()}
        >
  <span className="px-3 py-1 text-xs font-bold border-b border-gray-300 text-gray-600" > Actions </span>
    < button className = "text-left px-3 py-1 hover:bg-[#000080] hover:text-white flex items-center gap-2"
onClick = {() => handleStartRename(contextMenu.nodeId)}
  >
  <FileText size={ 10 } /> Rename (F2)
    </button>
    < button className = "text-left px-3 py-1 hover:bg-[#000080] hover:text-white flex items-center gap-2"
onClick = {() => handleAddFolder(contextMenu.nodeId)}
  >
  <Folder size={ 10 } /> New Folder
    </button>
    < span className = "px-3 py-1 text-xs font-bold border-b border-gray-300 border-t mt-1 text-gray-600" > Renk Seç </span>
      < button className = "text-left px-3 py-1 hover:bg-[#000080] hover:text-white flex items-center gap-2" onClick = {() => changeNodeColor('#000000')}> <Square size={ 10 } fill = "#000000" /> Varsayılan </button>
        < button className = "text-left px-3 py-1 hover:bg-[#000080] hover:text-white flex items-center gap-2" onClick = {() => changeNodeColor('#ff0000')}> <Square size={ 10 } fill = "#ff0000" /> Kırmızı </button>
          < button className = "text-left px-3 py-1 hover:bg-[#000080] hover:text-white flex items-center gap-2" onClick = {() => changeNodeColor('#0000ff')}> <Square size={ 10 } fill = "#0000ff" /> Mavi </button>
            < button className = "text-left px-3 py-1 hover:bg-[#000080] hover:text-white flex items-center gap-2" onClick = {() => changeNodeColor('#008000')}> <Square size={ 10 } fill = "#008000" /> Yeşil </button>
              < button className = "text-left px-3 py-1 hover:bg-[#000080] hover:text-white flex items-center gap-2" onClick = {() => changeNodeColor('#800080')}> <Square size={ 10 } fill = "#800080" /> Mor </button>
                </div>
      )}

{/* Main Window Frame - Dynamically expands when editing */ }
<div className={ `transition-all duration-300 bg-[#f0f0f0] border-2 border-white border-r-gray-500 border-b-gray-500 shadow-xl flex flex-col h-full max-h-[800px] ${editingNode ? 'w-[1000px]' : 'w-[450px]'}` }>

  {/* Title Bar */ }
  < div className = "bg-gradient-to-r from-[#000080] to-[#1084d0] px-2 py-1 flex justify-between items-center select-none text-white cursor-default" >
    <span className="font-bold tracking-wide text-sm flex items-center gap-2" >
      <Settings size={ 14 } />
{ editingNode ? 'Keyword Input Form' : 'Keyword Manager 98' }
</span>
  < div className = "flex gap-1" >
    <button className="w-4 h-4 bg-[#c0c0c0] border border-white border-r-gray-600 border-b-gray-600 flex items-center justify-center text-black font-bold text-xs leading-none" > _ </button>
      < button className = "w-4 h-4 bg-[#c0c0c0] border border-white border-r-gray-600 border-b-gray-600 flex items-center justify-center text-black font-bold text-xs leading-none" >
        { editingNode?<Square size = { 8 } /> : 'X'}
</button>
  < button
onClick = {() => setEditingNode(null)}
className = "w-4 h-4 bg-[#c0c0c0] border border-white border-r-gray-600 border-b-gray-600 flex items-center justify-center text-black font-bold text-xs leading-none"
  >
  <X size={ 12 } />
    </button>
    </div>
    </div>

{/* Dynamic Content Switcher */ }
{
  editingNode ? (
    <div className= "p-2 flex-1 flex overflow-hidden" >
    <InputFormView />
    </div>
        ) : (
    <>
    {/* Menu Bar */ }
    < div className = "flex px-1 py-0.5 bg-[#f0f0f0] border-b border-gray-400 text-black mb-1" >
      <span className="px-2 hover:bg-[#000080] hover:text-white cursor-pointer" > File </span>
        < span className = "px-2 hover:bg-[#000080] hover:text-white cursor-pointer" > Edit </span>
          < span className = "px-2 hover:bg-[#000080] hover:text-white cursor-pointer" > View </span>
            < span className = "px-2 hover:bg-[#000080] hover:text-white cursor-pointer" > Help </span>
              </div>

  {/* Tab Bar */ }
  <div className="flex px-2 pt-2 bg-[#f0f0f0]" >
  {
    ['Keyword Tree', 'Search Results'].map(tab => (
      <button key= { tab } onClick = {() => setActiveTab(tab)}
  className = {`px-4 py-1 mr-[2px] border-t border-x border-gray-600 rounded-t-sm text-black ${activeTab === tab ? 'bg-[#f0f0f0] font-bold relative -mb-[2px] z-10 pb-1.5' : 'bg-[#d4d0c8] text-gray-600 hover:bg-[#e0e0e0] mt-1'
    }`
}>
  { tab }
  </button>
              ))}
</div>

{/* Main Tree Area */ }
<div className="flex-1 border-t-2 border-white border-l-2 border-l-white border-r-2 border-r-gray-500 border-b-2 border-b-gray-500 m-2 p-3 flex flex-col gap-3 bg-[#f0f0f0]" >

  <div className="flex flex-col gap-1" >
    <label className="text-gray-700 font-semibold text-xs" > Filter / Search Keywords: </label>
      < div className = "flex items-center gap-2" >
        <div className="relative flex-1" >
          <input type="text" className = "w-full border-2 border-gray-500 border-r-white border-b-white bg-white px-2 py-1 text-sm shadow-inner outline-none focus:border-blue-800"
value = { filterText } onChange = {(e) => setFilterText(e.target.value)} placeholder = "Type to filter..." />
  <Search size={ 14 } className = "absolute right-2 top-1.5 text-gray-400" />
    </div>
    </div>
    </div>

    < div className = "flex-1 border-2 border-gray-600 border-r-white border-b-white bg-white overflow-hidden flex flex-col shadow-inner" >
      <div className="flex-1 overflow-y-auto p-2 bg-white" style = {{ fontFamily: 'Tahoma, sans-serif' }}>
        { filteredData.length > 0 ? filteredData.map((item) => <TreeItem key={ item.id } item = { item } />) : <div className="text-gray-400 italic p-2 text-center mt-10"> No keywords found.</div> }
        </div>
        </div>

        < div className = "border border-gray-400 p-1 bg-[#e0e0e0] text-gray-600 text-xs flex justify-between" >
          <span>Total Items: { getTotalItemsCount(filteredData) } </span>
            <span>(Tip: Double click to edit, Ctrl + C / V to copy) </span>
            </div>

{/* Action Buttons */ }
<div className="flex justify-between gap-2 pt-1" >
  <div className="text-xs text-gray-500 self-center" > Right - click for colors </div>
    < div className = "flex gap-2" >
    <button onClick= {() => handleAddFolder(selectedNode)} className = "px-4 py-1 bg-[#f0f0f0] border-2 border-white border-r-gray-600 border-b-gray-600 active:border-gray-600 active:border-r-white active:border-b-white text-sm" > New Folder </button>
      < button onClick = { handleAddNode } className = "px-4 py-1 bg-[#f0f0f0] border-2 border-white border-r-gray-600 border-b-gray-600 active:border-gray-600 active:border-r-white active:border-b-white text-sm" > New Card </button>
        < button onClick = { handleDeleteNode } className = "px-4 py-1 bg-[#f0f0f0] border-2 border-white border-r-gray-600 border-b-gray-600 active:border-gray-600 active:border-r-white active:border-b-white text-sm" > Delete </button>
          </div>
          </div>

          </div>
          </>
        )}
</div>
  </div>
  );
};

export default KeywordManager;