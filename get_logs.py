from selenium import webdriver
from selenium.webdriver.chrome.options import Options
import time
import json

opts = Options()
opts.add_argument('--headless')
driver = webdriver.Chrome(options=opts)

try:
    driver.get('http://localhost:8000/index.html')
    time.sleep(3)
    
    logs = driver.get_log('browser')
    errors = [log['message'] for log in logs if log['level'] == 'SEVERE']
    
    if errors:
        print("REACT ERRORS FOUND:")
        for err in errors:
            print(err)
    else:
        print("No severe errors found in browser console.")
finally:
    driver.quit()
