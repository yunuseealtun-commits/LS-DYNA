from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
from selenium.webdriver.common.action_chains import ActionChains
import time

opts = Options()
opts.add_argument('--headless=new')
opts.add_argument('--window-size=1920,1080')
driver = webdriver.Chrome(options=opts)

try:
    driver.get('file:///c:/Users/YunusEmre/Desktop/Timer/Note/LS-DYNA/index.html')
    time.sleep(2)
    
    # find Mind Map text
    mind_map = driver.find_element(By.XPATH, "//*[text()='Mind Map']")
    ActionChains(driver).double_click(mind_map).perform()
    time.sleep(2)
    
    driver.save_screenshot('test_mindmap_selenium.png')
    
    logs = driver.get_log('browser')
    errors = [log['message'] for log in logs if log['level'] == 'SEVERE' and 'favicon.ico' not in log['message']]
    
    print("REACT ERRORS FOUND:")
    for err in errors:
        print(err)
except Exception as e:
    print("Python Selenium Error:", e)
finally:
    driver.quit()
