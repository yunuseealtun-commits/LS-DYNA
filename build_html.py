import os
import re

react_file = r"c:\Users\YunusEmre\Desktop\Timer\Note\import React, { useState, useEffect, use.ts"
keywords_file = r"c:\Users\YunusEmre\Desktop\Timer\Note\keywords.ts"

with open(react_file, 'r', encoding='utf-8') as f:
    app_code = f.read()

with open(keywords_file, 'r', encoding='utf-8') as f:
    keywords_code = f.read()

# Remove the import of initialTreeData from app_code
import_regex = re.compile(r"import\s+\{.*initialTreeData.*\}\s+from\s+['\"]./keywords['\"];?\n")
app_code = import_regex.sub("", app_code)

# Remove the React imports (we'll rely on global imports via importmap)
react_import_regex = re.compile(r"import\s+React\s*,?\s*\{.*\}\s+from\s+['\"]react['\"];?\n")
app_code = react_import_regex.sub("", app_code)

lucide_import_regex = re.compile(r"import\s+\{.*\}\s+from\s+['\"]lucide-react['\"];?\n")
app_code = lucide_import_regex.sub("", app_code)

# Strip the "export const initialTreeData" export keyword to just make it a local const block,
keywords_code = keywords_code.replace("export const initialTreeData", "const initialTreeData")

# Also app_code exports KeywordManager at the end: "export default KeywordManager;" -> Remove it
app_code = app_code.replace("export default KeywordManager;", "")


html_content = f"""<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Keyword Manager</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
    <style>
        body, html {{ margin: 0; padding: 0; height: 100%; }}
        #root {{ height: 100%; }}
    </style>
    <script type="importmap">
      {{
        "imports": {{
          "react": "https://esm.sh/react@18",
          "react-dom/client": "https://esm.sh/react-dom@18/client",
          "lucide-react": "https://esm.sh/lucide-react@0.292.0"
        }}
      }}
    </script>
</head>
<body>
    <div id="root"></div>
    <script type="text/babel" data-type="module">
        import React, {{ useState, useEffect, useMemo, useCallback }} from 'react';
        import {{ createRoot }} from 'react-dom/client';
        import {{ Minus, Plus, Search, FileText, Folder, Settings, X, Square }} from 'lucide-react';

        {keywords_code}

        {app_code}

        const root = createRoot(document.getElementById('root'));
        root.render(<KeywordManager />);
    </script>
</body>
</html>
"""

with open('index.html', 'w', encoding='utf-8') as f:
    f.write(html_content)

print("Generated index.html successfully.")
