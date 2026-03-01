import re

with open("index.html", "r", encoding="utf-8") as f:
    html = f.read()

# 1. Clean up the broken TreeItem above KeywordManager
broken_top = """    // ================= RENDER TREE ITEM =================
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
          e.stopPropagation(); // Stop propagation so parent folders don't also fire
          setContextMenu({ visible: true, x: e.pageX, y: e.pageY, nodeId: item.id });
          setSelectedNode(item.id);
        };


    const KeywordManager = () => {"""

html = html.replace(broken_top, "    const KeywordManager = () => {")

# 2. Extract the actual TreeItem from inside KeywordManager
# The original TreeItem (the remaining part) starts with `const handleRowPointerDown = (e) => {` and ends at `      };` right before `// ================= INPUT FORM COMPONENT =================`
# Let's find exactly that block.

tree_bottom_pattern = r"(      \s+const handleRowPointerDown = \(e\) => \{.*?      \};\n)\n      // ================= INPUT FORM COMPONENT ================="
tree_bottom_match = re.search(tree_bottom_pattern, html, re.DOTALL)

if tree_bottom_match:
    tree_body = tree_bottom_match.group(1)
    # Remove from KeywordManager
    html = html.replace(tree_body, "")
    
    # Reconstruct the FULL TreeItem!
    full_tree_item = """
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
          setContextMenu({ visible: true, x: e.pageX, y: e.pageY, nodeId: item.id });
          setSelectedNode(item.id);
        };

""" + tree_body
    
    # Inject before KeywordManager
    html = html.replace("    const KeywordManager = () => {", full_tree_item + "\n\n    const KeywordManager = () => {")


# 3. Extract InputFormView
# It starts at `// ================= INPUT FORM COMPONENT =================` inside KeywordManager.
# It ends right before `return (` inside KeywordManager. 
input_form_pattern = r"(      // ================= INPUT FORM COMPONENT =================\n      const InputFormView =.*?      \};\n)\n      return \("
input_match = re.search(input_form_pattern, html, re.DOTALL)

if input_match:
    input_code = input_match.group(1)
    # Remove from KeywordManager
    html = html.replace(input_code, "")
    
    # Replace its signature to use Context
    new_input_sig = """      // ================= INPUT FORM COMPONENT =================
      const InputFormView = ({ editingNode, onClose }) => {
        const {
            parameterNotes, setParameterNotes, setIsEditorOpen, setTempNote,
            paramContextMenu, setParamContextMenu, miniQuillModules, setTreeData,
            selectedParameter, setSelectedParameter
        } = React.useContext(AppContext);
"""
    input_code = input_code.replace("""      // ================= INPUT FORM COMPONENT =================\n      const InputFormView = ({ editingNode, onClose }) => {""", new_input_sig)
    
    # Inject before KeywordManager
    html = html.replace("    const KeywordManager = () => {", input_code + "\n\n    const KeywordManager = () => {")

with open("index.html", "w", encoding="utf-8") as f:
    f.write(html)
print("Fix completed.")
