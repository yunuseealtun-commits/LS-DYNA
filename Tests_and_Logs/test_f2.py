import time
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.common.action_chains import ActionChains
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.keys import Keys
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC

opts = Options()
opts.add_argument('--headless')
opts.add_argument('--window-size=1200,800')
driver = webdriver.Chrome(options=opts)

try:
    print('Loading page...')
    driver.get('http://127.0.0.1:8000/LS-DYNA/index.html')
    time.sleep(2)

    print('Clicking CONTROL_CONTACT...')
    el = driver.find_element(By.XPATH, "//div[contains(text(), 'CONTROL_CONTACT')]")
    el.click()
    time.sleep(1)

    print('Waiting for parameter inputs...')
    wait = WebDriverWait(driver, 10)
    input_el = wait.until(EC.presence_of_element_located((By.CSS_SELECTOR, "input[placeholder='...']")))
    
    print('Sending F2 key...')
    driver.execute_script("window.prompt = function() { return 'SLSFAC_RENAMED'; }")
    input_el.send_keys(Keys.F2)
    time.sleep(1)

    print('Saving screenshot...')
    driver.save_screenshot('C:/Users/YunusEmre/.gemini/antigravity/brain/b2017320-2163-43ac-8399-910096c13657/parameter_f2_rename.png')
    print('Done')
finally:
    driver.quit()
