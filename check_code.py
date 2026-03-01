import traceback
import ast

try:
    with open('c:/Users/YunusEmre/Desktop/Timer/Note/LS-DYNA/index.html', encoding='utf-8') as f:
        code = f.read()
    
    start_tag = '<script type="text/babel" data-type="module">'
    end_tag = '</script>'
    
    start_idx = code.find(start_tag)
    if start_idx == -1:
        print("Could not find babel script tag")
        exit(1)
        
    start_idx += len(start_tag)
    end_idx = code.find(end_tag, start_idx)
    
    babel_code = code[start_idx:end_idx].strip()
    
    print("Extracting React code... Length:", len(babel_code))
    
    # Just checking for basic syntax errors that would silently break babel
    try:
        ast.parse(babel_code)
        print("AST Parse OK (Warning: This checks Python syntax, not JS, but catches basic unclosed quotes/brackets if lucky)")
    except SyntaxError as e:
        print(f"Syntax Error caught: {e}")
except Exception as e:
    print(f"Error: {e}")
    traceback.print_exc()

import re
missing_brackets = babel_code.count('{') - babel_code.count('}')
missing_parens = babel_code.count('(') - babel_code.count(')')
print(f"Missing Brackets: {missing_brackets}, Missing Parens: {missing_parens}")
