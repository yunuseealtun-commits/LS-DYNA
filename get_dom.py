from selenium import webdriver
from selenium.webdriver.chrome.options import Options
import time

opts = Options()
opts.add_argument('--headless')
driver = webdriver.Chrome(options=opts)

try:
    driver.get('http://localhost:8000/index.html')
    time.sleep(3)
    
    root_inner = driver.execute_script("return document.getElementById('root').innerHTML")
    print("ROOT INNER HTML LENGTH:", len(root_inner))
    print("ROOT BROWSER PREVIEW:", root_inner[:500])
except Exception as e:
    print("ERROR:", e)
finally:
    driver.quit()
