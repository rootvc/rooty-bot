print("surely")
import time
import sys
from selenium import webdriver
from selenium.webdriver.chrome.options import DesiredCapabilities
from selenium.webdriver.common.proxy import Proxy, ProxyType
import random
from fake_useragent import UserAgent
CHROMEDRIVER_PATH = '/app/.chromedriver/bin/chromedriver'
GOOGLE_CHROME_BIN = '/app/.apt/usr/bin/google-chrome'

co = webdriver.ChromeOptions()
co.add_argument("log-level=3")
co.add_argument("--headless")
co.binary_location = GOOGLE_CHROME_BIN
co.add_argument('--disable-gpu')
co.add_argument('--no-sandbox')
#import proxyscrape
#collector = proxyscrape.create_collector('default', 'http')

def proxy_driver(co=co):
    options = webdriver.ChromeOptions()
    ua = UserAgent()
    userAgent = ua.random
    options.add_argument('user-agent={userAgent}')
    options.add_argument("ignore-certificate-errors")
    #capabilities = webdriver.DesiredCapabilities.CHROME
    #prox.add_to_capabilities(capabilities)
    #print(pxy.__dict__)
    driver = webdriver.Chrome(chrome_options=options,
                            executable_path=CHROMEDRIVER_PATH)
    return driver

try:
    driver = proxy_driver()
    company = 'https://www.crunchbase.com/organization/' + ((sys.argv[1].replace(' ', '-' )).lower())
    driver.get(company)
    sections = driver.find_elements_by_xpath("//span[@class='component--field-formatter field-type-identifier-multi']")
    amount_raised = driver.find_elements_by_xpath("//a[@class='cb-link component--field-formatter field-type-money ng-star-inserted']")[0].text
    description = driver.find_elements_by_xpath("//span[@class='component--field-formatter field-type-text_long ng-star-inserted']")[0].text
    website = driver.find_elements_by_xpath("//a[@class='cb-link component--field-formatter field-type-link layout-row layout-align-start-end ng-star-inserted']")[0].text
    location = sections[0].text
    founders = sections[3].text
    print(amount_raised)
    print(description)
    print(location)
    print(founders)
    print(website)
    sys.stdout.flush()
    driver.quit()

except Exception as e:
    print("Wrong")
