import re

with open('index.html', 'r', encoding='utf-8') as f:
    html = f.read()

# Pattern for MindMapNode
node_pattern = re.search(r'(const MindMapNode =.*?</div>\n    \};\n)', html, re.DOTALL)
if not node_pattern: print('MindMapNode not found')

# Pattern for MindMapCanvas
canvas_pattern = re.search(r'(const MindMapCanvas =.*?</div>\n    \};\n)', html, re.DOTALL)
if not canvas_pattern: print('MindMapCanvas not found')

if node_pattern and canvas_pattern:
    js_content = f'''const {{ useState, useEffect, useCallback, useRef, useContext }} = React;
const {{ Minus, Plus, Search, FileText, Folder, Settings, X, Square, Scan, Type }} = window.LucideReact || LucideReact;
const {{ AppContext, JoditReactEditor }} = window;

{node_pattern.group(1)}
window.MindMapNode = MindMapNode;

{canvas_pattern.group(1)}
window.MindMapCanvas = MindMapCanvas;
'''
    with open('js/MindMap.js', 'w', encoding='utf-8') as f:
        f.write(js_content)

    html = html.replace(node_pattern.group(1), '')
    html = html.replace(canvas_pattern.group(1), '')

    html = html.replace('<script type="text/babel" src="js/TabbedEditor.js"></script>', '<script type="text/babel" src="js/TabbedEditor.js"></script>\n  <script type="text/babel" src="js/MindMap.js"></script>')

    with open('index.html', 'w', encoding='utf-8') as f:
        f.write(html)
    print("MindMap extracted successfully!")
