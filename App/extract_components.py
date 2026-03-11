import re

with open('index.html', 'r', encoding='utf-8') as f:
    html = f.read()

# Extract JoditReactEditor
jodit_match = re.search(r'(const JoditReactEditor =.*?return <div className={`flex flex-col \$\{className\}`} ref=\{containerRef\} />;\n    \};\n)', html, re.DOTALL)
if not jodit_match: print('Failed to find JoditReactEditor')

# Extract DraggableWindow
drag_match = re.search(r'(const DraggableWindow =.*?</div>\n      \);\n    \};\n)', html, re.DOTALL)
if not drag_match: print('Failed to find DraggableWindow')

# Extract StickyNote
sticky_match = re.search(r'(const stickyColors = \[.*?\];\n\n    const StickyNote =.*?</div>\n      \);\n    };\n)', html, re.DOTALL)
if not sticky_match: print('Failed to find StickyNote')

if jodit_match and drag_match and sticky_match:
    components_js = f'''const {{ useState, useEffect, useCallback, useRef, useMemo, useContext }} = React;
const {{ Minus, Plus, Search, FileText, Folder, Settings, X, Square, Scan, Type }} = window.LucideReact || LucideReact;

window.AppContext = React.createContext();

{jodit_match.group(1)}
window.JoditReactEditor = JoditReactEditor;

{drag_match.group(1)}
window.DraggableWindow = DraggableWindow;

{sticky_match.group(1)}
window.StickyNote = StickyNote;
window.stickyColors = stickyColors;
'''
    with open('js/components.js', 'w', encoding='utf-8') as f:
        f.write(components_js)

    html = html.replace(jodit_match.group(1), '')
    html = html.replace(drag_match.group(1), '')
    html = html.replace(sticky_match.group(1), '')
    html = html.replace('const AppContext = React.createContext();', '')

    html = html.replace('<script type="text/babel">', '<script type="text/babel" src="js/components.js"></script>\n  <script type="text/babel">')

    with open('index.html', 'w', encoding='utf-8') as f:
        f.write(html)
    print('Extracted components successfully!')
else:
    print('Regex match failed. Check index.html structure.')
