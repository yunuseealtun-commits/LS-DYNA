import os

target_file = r"c:\Users\YunusEmre\Desktop\Timer\Note\import React, { useState, useEffect, use.ts"
keywords_file = r"c:\Users\YunusEmre\Desktop\Timer\Note\keywords.ts"

with open(target_file, 'r', encoding='utf-8') as f:
    content = f.read()

start_sig = "const [treeData, setTreeData] = useState(["
end_sig = "  ]);\n\n  const [expandedNodes"

start_idx = content.find(start_sig)
end_idx = content.find(end_sig)

if start_idx != -1 and end_idx != -1:
    extracted_obj = content[start_idx + len("const [treeData, setTreeData] = useState("):end_idx + 4]
    
    # write keywords.ts
    with open(keywords_file, 'w', encoding='utf-8') as f:
        f.write("export const initialTreeData = " + extracted_obj + ";\n")
        
    # replace in main file
    new_content = content[:start_idx] + "const [treeData, setTreeData] = useState(initialTreeData);" + content[end_idx + 5:]
    
    # add import
    import_stmt = "import { initialTreeData } from './keywords';\n"
    import_idx = new_content.find("import React")
    if import_idx != -1:
        line_end = new_content.find("\n", import_idx)
        new_content = new_content[:line_end+1] + import_stmt + new_content[line_end+1:]
        
    with open(target_file, 'w', encoding='utf-8') as f:
        f.write(new_content)
        
    print("Migration successful.")
else:
    print("Could not find boundaries.", start_idx, end_idx)
