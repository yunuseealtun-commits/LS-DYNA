with open('index.html', 'r', encoding='utf-8') as f:
    lines = f.readlines()

# Extract lines 479 to 1312 (index 478 to 1312)
mindmap_lines = lines[478:1312]

# Keep the rest
new_lines = lines[:478] + lines[1312:]

js_content = f'''const {{ useState, useEffect, useCallback, useRef, useContext }} = React;
const {{ Minus, Plus, Search, FileText, Folder, Settings, X, Square, Scan, Type }} = window.LucideReact || LucideReact;
const {{ AppContext, JoditReactEditor }} = window;

''' + "".join(mindmap_lines) + '''
window.MindMapNode = MindMapNode;
window.MindMapCanvas = MindMapCanvas;
'''

with open('js/MindMap.js', 'w', encoding='utf-8') as f:
    f.write(js_content)

# add script tag
html_str = "".join(new_lines)
html_str = html_str.replace('<script type="text/babel" src="js/TabbedEditor.js"></script>', '<script type="text/babel" src="js/TabbedEditor.js"></script>\n  <script type="text/babel" src="js/MindMap.js"></script>')

with open('index.html', 'w', encoding='utf-8') as f:
    f.write(html_str)

print("MindMap extracted perfectly using line numbers!")
