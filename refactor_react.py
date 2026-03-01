import re

with open("index.html", "r", encoding="utf-8") as f:
    html = f.read()

# 1. Create AppContext outside
if "const AppContext = React.createContext();" not in html:
    html = html.replace(
        "const generateId = () => Math.random().toString(36).substr(2, 9);",
        "const AppContext = React.createContext();\n    const generateId = () => Math.random().toString(36).substr(2, 9);"
    )

# 2. Add AppContext.Provider
ret_match = re.search(r"return \(\s*<div className=\"h-screen w-screen bg-teal-800", html)
if ret_match and "<AppContext.Provider" not in html:
    provider_start = """
      const ctxValue = {
        treeData, setTreeData, parameterNotes, setParameterNotes,
        expandedNodes, setExpandedNodes, selectedNode, setSelectedNode,
        renamingNodeId, setRenamingNodeId, renameText, setRenameText,
        draggedNodeId, setDraggedNodeId, dragOverInfo, setDragOverInfo,
        clipboard, setClipboard, contextMenu, setContextMenu,
        openForms, setOpenForms, maxZIndex, setMaxZIndex,
        isEditorOpen, setIsEditorOpen, tempNote, setTempNote,
        paramContextMenu, setParamContextMenu, isSaving, setIsSaving,
        saveMessage, setSaveMessage,
        handleSelect, handleStartRename, handleDragStart, handleDragOver, handleDrop,
        toggleNode, handleRenameSubmit, handleOpenForm,
        handleAddFolder, handleAddNode, handleDeleteNode, changeNodeColor, findNodeById,
        miniQuillModules, quillModules
      };

      return (
        <AppContext.Provider value={ctxValue}>
          <div className="h-screen w-screen bg-teal-800"""
    html = html.replace(ret_match.group(0), provider_start)
    
    # Add closing tag before the final closing div of KeywordManager
    # KeywordManager ends at the bottom of the script.
    html = re.sub(
        r"(</div>\s*\);\s*};\s*const root = createRoot)",
        r"</div>\n        </AppContext.Provider>\n      );\n    };\n\n    const root = createRoot",
        html
    )

# 3. Extract InputFormView
input_form_pattern = r"// ================= INPUT FORM VIEW COMPONENT =================\s+(const InputFormView =.*?^\s*};\n)"
input_match = re.search(input_form_pattern, html, re.MULTILINE | re.DOTALL)

if input_match:
    input_code = input_match.group(1)
    # Remove it from KeywordManager
    html = html.replace(input_match.group(0), "")
    
    # Add context hook
    context_hook = """const InputFormView = ({ editingNode, onClose }) => {
        const {
            parameterNotes, setParameterNotes, setIsEditorOpen, setTempNote,
            paramContextMenu, setParamContextMenu, miniQuillModules, setTreeData
        } = React.useContext(AppContext);
"""
    input_code = input_code.replace("const InputFormView = ({ editingNode, onClose }) => {", context_hook)
    
    # Insert it before KeywordManager
    html = html.replace("const KeywordManager = () => {", "// ================= INPUT FORM VIEW COMPONENT =================\n    " + input_code + "\n\n    const KeywordManager = () => {")

# 4. Extract TreeItem
tree_item_pattern = r"// ================= RENDER TREE ITEM =================\s+(const TreeItem =.*?^\s*};\n)"
tree_match = re.search(tree_item_pattern, html, re.MULTILINE | re.DOTALL)

if tree_match:
    tree_code = tree_match.group(1)
    # Remove it from KeywordManager
    html = html.replace(tree_match.group(0), "")
    
    # Add context hook
    context_hook_tree = """const TreeItem = ({ item, level = 0 }) => {
        const {
            expandedNodes, selectedNode, renamingNodeId, contextMenu, setContextMenu,
            setSelectedNode, handleSelect, dragOverInfo, setDragOverInfo,
            handleDragStart, handleDragOver, handleDrop, toggleNode,
            renameText, setRenameText, handleRenameSubmit, findNodeById
        } = React.useContext(AppContext);
"""
    tree_code = tree_code.replace("const TreeItem = ({ item, level = 0 }) => {", context_hook_tree)
    
    # Insert it before KeywordManager (and after InputFormView)
    html = html.replace("const KeywordManager = () => {", "// ================= RENDER TREE ITEM =================\n    " + tree_code + "\n\n    const KeywordManager = () => {")

with open("index.html", "w", encoding="utf-8") as f:
    f.write(html)
print("Refactoring completed.")
