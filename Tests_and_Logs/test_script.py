import time
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.common.action_chains import ActionChains
from selenium.webdriver.chrome.options import Options

opts = Options()
opts.add_argument('--headless')
opts.add_argument('--window-size=1200,800')
driver = webdriver.Chrome(options=opts)

try:
    print("Loading page...")
    driver.get('http://127.0.0.1:8000/LS-DYNA/index.html')
    time.sleep(2)
    
    print("Clicking CONTROL_CONTACT...")
    el = driver.find_element(By.XPATH, "//div[contains(text(), 'CONTROL_CONTACT')]")
    el.click()
    time.sleep(1)
    
    driver.save_screenshot('C:/Users/YunusEmre/.gemini/antigravity/brain/b2017320-2163-43ac-8399-910096c13657/parameter_before.png')
    
    print("Right-clicking SLSFAC...")
    slsfac = driver.find_element(By.XPATH, "//span[contains(text(), 'SLSFAC')]")
    actions = ActionChains(driver)
    actions.context_click(slsfac).perform()
    time.sleep(1)
    
    print("Changing background color...")
    pink_btn = driver.find_element(By.CSS_SELECTOR, "button[title='#ffb3ba']")
    pink_btn.click()
    time.sleep(1)
    
    print("Right-clicking again to add tag...")
    actions.context_click(slsfac).perform()
    time.sleep(1)
    
    print("Selecting Text Color...")
    blue_btn = driver.find_element(By.CSS_SELECTOR, "button[title='#0000ff']")
    blue_btn.click()
    time.sleep(1)
    
    print("Saving result...")
    driver.save_screenshot('C:/Users/YunusEmre/.gemini/antigravity/brain/b2017320-2163-43ac-8399-910096c13657/parameter_styled_v2.png')
    print("Done")
    
finally:
    driver.quit()
