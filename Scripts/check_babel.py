import os

import json

html_path = "c:/Users/YunusEmre/Desktop/Timer/Note/LS-DYNA/App/index.html"
with open(html_path, "r", encoding="utf-8") as f:
    html = f.read()

start_marker = '<script type="text/babel">'
end_marker = '</script>'
start_idx = html.find(start_marker)
if start_idx != -1:
    end_idx = html.find(end_marker, start_idx)
    js_code = html[start_idx + len(start_marker):end_idx]
    
    with open("c:/Users/YunusEmre/Desktop/Timer/Note/LS-DYNA/temp_babel_check.js", "w", encoding="utf-8") as f:
        f.write(js_code)
    
    print("Extracted JS to temp_babel_check.js")
else:
    print("Could not find babel script!")
