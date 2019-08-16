# Rooty
Rooty is a chatbot built with [hubot](https://hubot.github.com/) and [hubot-conversation](https://www.npmjs.com/package/hubot-conversation). rooty-bot utilizes the Slack Web API, Airtable API, and various npm packages to enter company data from Slack to Airtable. The bot also has a python script to scrape crunchbase using Selenium/Chromedriver. rooty-bot is deployed via [Heroku](https://dashboard.heroku.com/apps/rooty-bot/logs).

##Slackbot Features
[airtable-log](./scripts/airtable-log) contains the code that governs rooty's responses and actions when you message keyworkds in slack. The following are the options:

* help
	* Lists features
* log X
	* This logs X as a company in the Airtable
	* The followup questions will let you enter details about the company, founders, notes, attach a pitch deck, etc.
	* It also automatically will fill in info about the company's raises, location, website, description, etc. from Crunchbase if it can be found
	* Assigns an owner as the Airtable user who has the email as the person who sent the Slack msg (Kane by default)
	* At any point, "e" exits logging and "s" skips an option
	* Will parse multiple founders separated by "and", "," or "&"
	* Pitch deck uploads are tricky - it will download and upload to Airtable but because of Airtable's preview feature pulling from the link and not the download it will not let you preview in Airtable - you have to download the attachment from Airtable to view it (by clicking on the link after previewing).
* check X
	* Checks if a company is already in the Airtable and tell you
* whois X
	* Returns info pulled from Crunchbase about company X
* search X
	* Returns all companies that contain string X from the Airtable
* updateairtable
	* Updates info in Airtable pulling data from Crunchbase for all the companies that have the "Needs Crunchbase Scraping" box checked in Airtable (do this manually whenever you want updates)
	* Do not do more than 100 companies at a time or you run the risk of crashing the bot in Heroku
* Thank you
	* Rooty will let you know that you are welcome

##Code
In this repository, there are numerous files, dependencies, and scripts. 
###Javascript (Chatbot)
The [scripts](./scripts) folder contains the javascript that is run when the bot is deployed. In the [scripts](./scripts) folder there is [functions](./scripts/functions.js) and [airtable-log](./scripts/airtable-log). 

* [airtable-log](./scripts/airtable-log) contains all of the Slack interactions and conversation. 

* [functions](./scripts/functions.js) contains the logic that interaccts with Airtable and refactorable code used by airtable-log. It also contains the logic that interacts with the Crunchbase Scraper by spawning a Python script

To add any dependencies, use an npm install before pushing to Heroku

### Python (Selenium Crunchbase Scraper)

The [webscraper](./webscraper) folder contains the script that creates a Webcrawler and navigates to the webpage. When it is passed an argument "company", it returns a JSON with the info it found at www.crunchbase.com/company. It will manage to get past the Crunchbase basic bot detection by finding the recaptcha element and clicking it.

To add any python packages, add them to [requirements.txt](./requirements.txt)


