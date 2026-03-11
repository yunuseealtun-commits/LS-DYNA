import re

with open('index.html', 'r', encoding='utf-8') as f:
    html = f.read()

# Extract TabbedEditor
tabbed_editor_match = re.search(r'(const TabbedEditor =.*?return \(\n      <DraggableWindow.*?</div>\n    \);\n  \};\n)', html, re.DOTALL)
if not tabbed_editor_match: 
    print('Failed to find TabbedEditor')
else:
    js_content = f'''const {{ useState, useEffect, useCallback, useRef, useContext }} = React;
const {{ Minus, Plus, Search, FileText, Folder, Settings, X, Square, Scan, Type }} = window.LucideReact || LucideReact;
const {{ AppContext, DraggableWindow, JoditReactEditor }} = window;

{tabbed_editor_match.group(1)}
window.TabbedEditor = TabbedEditor;
'''
    with open('js/TabbedEditor.js', 'w', encoding='utf-8') as f:
        f.write(js_content)

    html = html.replace(tabbed_editor_match.group(1), '')
    html = html.replace('<script type="text/babel">', '<script type="text/babel" src="js/TabbedEditor.js"></script>\n  <script type="text/babel">')

    with open('index.html', 'w', encoding='utf-8') as f:
        f.write(html)
    print('TabbedEditor extracted successfully!')
