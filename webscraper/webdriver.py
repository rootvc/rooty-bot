# coding: utf-8

import time
import sys
import json
from textwrap import wrap
from selenium import webdriver
from selenium.webdriver.chrome.options import DesiredCapabilities
from selenium.webdriver.common.proxy import Proxy, ProxyType
import random
from fake_useragent import UserAgent
co = webdriver.ChromeOptions()
co.add_argument("log-level=3")
co.add_argument("--headless")
co.add_argument('--disable-gpu')
co.add_argument('--no-sandbox')

#import proxyscrape
#collector = proxyscrape.create_collector('default', 'http')
CHROMEDRIVER_PATH = '/app/.chromedriver/bin/chromedriver'

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
    company = sys.argv[1].replace(' ', '-' ).lower()
    url = 'https://www.crunchbase.com/organization/' +company
    #url = 'https://www.crunchbase.com/organization/ntopology'


    driver.get(url)
    time.sleep(2)
    try:
        el = driver.find_element_by_id('px-captcha')
        action = webdriver.common.action_chains.ActionChains(driver)
        action.move_to_element_with_offset(el, 30, 30)
        action.click_and_hold()
        action.perform()
    except Exception as e:
        # no bot detection
        woo = 'woo'
    time.sleep(3)

    try:
        notfound = driver.find_elements_by_xpath("//mat-toolbar[@class='mat-elevation-z5 layout-row mat-toolbar has-accent mat-toolbar-single-row']")
        pageheader = notfound[0].text
    except Exception as e:
        pageheader = ''

    if (pageheader== 'Page not found'):
        raise Exception('No crunchbase page')

    try:
        sections = driver.find_elements_by_xpath("//span[@class='component--field-formatter field-type-identifier-multi']")
    except Exception as e:
        sections = []
    try:
        amount_raised_el = driver.find_elements_by_xpath("//a[@class='cb-link component--field-formatter field-type-money ng-star-inserted']")[0]
        if ( ((amount_raised_el.get_attribute("href")).split("funding_total/",1)[1]) == company):
            amount_raised = amount_raised_el.text.replace('CA', 'C')
            amount_raised = amount_raised[1:]
        else:
            raise Exception('No funding data')

    except Exception as e:
        amount_raised = ''
    try:
        description = driver.find_elements_by_xpath("//span[@class='component--field-formatter field-type-text_long ng-star-inserted']")[0].text
    except Exception as e:
        description = ''
    try:
        website = driver.find_elements_by_xpath("//a[@class='cb-link component--field-formatter field-type-link layout-row layout-align-start-end ng-star-inserted']")[0].text
    except Exception as e:
        website = ''
    try:
        table = driver.find_elements_by_xpath("//div[@class='cb-overflow-x-only table-wrapper ng-star-inserted']")
    except Exception as e:
        table = []
    n = 5

    try:
        location = sections[0].text
    except Exception as e:
        location = ''
    try:
        founders = sections[3].text
    except Exception as e:
        founders = ''


    if "." in amount_raised:
        amount_raised = amount_raised.replace('.','').replace('M','00000').replace('B', '00000000').replace('K','00')
    else:
        amount_raised = amount_raised.replace('M','000000').replace('B', '000000000').replace('K','000')
    list1 = {"raised": amount_raised, "location": location, "founders": founders, "description": description, "url": website, "cburl": url}
    jsonlist = []
    jsonlist.append(list1)

    try:
        groups = table[0].text.replace('Sign up for free to unlock and follow the latest funding activities\n','').split('\n')
        rounds = ["\n".join(groups[i:i+n]) for i in range(5, len(groups), n)]
    except Exception as e:
        rounds = []

    for round in rounds:
        try:
            round = round.replace('\xe2', '').replace('\x80', '').replace('\x94', '').replace('\xac', '').replace('\xa3', '')
            roundlist = round.split('\n')
            date = roundlist[0]
            roundtype = roundlist[1][:roundlist[1].index(" -")]
            numinvestors = roundlist[2]
            roundsize = roundlist[3][1:]
            if "." in roundsize:
                roundsize = roundsize.replace('.','').replace('M','00000').replace('B', '00000000').replace('K','00')
            else:
                roundsize = roundsize.replace('M','000000').replace('B', '000000000').replace('K','000')
            investors = roundlist[4].replace('-', '').replace('\xe2', '')
            list = {"date":date, "type": roundtype, "num": numinvestors, "size": roundsize, "inv": investors}
            jsonlist.append(list)
        except Exception as e:
            print(e)
            str = 'problem patsing round data'


    print(json.dumps(jsonlist,ensure_ascii=False))
    sys.stdout.flush()
    driver.quit()

except Exception as e:
    print(e)
    driver.quit()
