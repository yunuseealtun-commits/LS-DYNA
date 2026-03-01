from selenium import webdriver
from selenium.webdriver.chrome.options import Options
import time

opts = Options()
opts.add_argument('--headless')
driver = webdriver.Chrome(options=opts)

try:
    driver.get('http://localhost:8000/index.html')
    time.sleep(5)
    
    logs = driver.get_log('browser')
    for log in logs:
        print(log['level'], "-", log['message'])
    
    root_inner = driver.execute_script("return document.body.innerHTML")
    print("BODY HTML LENGTH:", len(root_inner))
except Exception as e:
    print("ERROR:", e)
finally:
    driver.quit()
