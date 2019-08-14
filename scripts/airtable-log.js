const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY;
const AIRTABLE_BASE_KEY = process.env.AIRTABLE_BASE_KEY;
const token = process.env.token;
//

var Conversation = require('hubot-conversation');
const {promisify} = require("es6-promisify");
const events = require('events');
const auth = 'Bearer ' + AIRTABLE_API_KEY;
const companiesURL = "https://api.airtable.com/v0/appOH5wwqL3JpZtSr/Companies"
const dealpipelineURL = "https://api.airtable.com/v0/appOH5wwqL3JpZtSr/Deal%20Pipeline"
const Airtable = require('airtable');
const base = new Airtable({apiKey: AIRTABLE_API_KEY}).base(AIRTABLE_BASE_KEY);
const { WebClient } = require('@slack/web-api');
const web = new WebClient(token);
const fetch = require("node-fetch");
const jsdom = require('jsdom');
const { JSDOM } = jsdom;
const functions = require('./functions');


module.exports = function (robot) {

    //starts conversation
    var switchBoard = new Conversation(robot);

    //rooty responds when thanked
    robot.respond(/thank(s| you)/i, function (msg){
        msg.send(msg.random(functions.response));
    });

    //rooty responds when thanked
    robot.respond(/updateairtable)/i, function (msg){
        msg.send('doing that');
        base('Companies').select({
            // Selecting the first 3 records in Active Portfolio:
            view: "AdamTest"
        }).eachPage(async function page(records, fetchNextPage) {
            // This function (`page`) will get called for each page of records.
            async function asyncForEach(array, callback) {
              for (let index = 0; index < array.length; index++) {
                await callback(array[index], index, array);
              }
            }
            asyncForEach(records, async (record) => {
                var cburl = record.get('Company Name');
                var foundersfromairtable = record.get('Founders');
                var id = record.getId();
                console.log(cburl);
                function fetchCompany()  {
                  return new Promise((resolve,reject) => {
                    var pythonProcess = spawn('python',["./webscraper/webdriver.py", cburl]);
                    var crunchbaseSuccess = true;
                    var dataReceived = 0;
                    pythonProcess.stdout.on('data', async (data) => {
                        if (data.toString() === 'Error\n'){
                            crunchbaseSuccess = false;
                        }
                        var dataArr = data.toString().split(/\r?\n/);
                        if (dataArr[1] === 'Error'){
                            console.log('Didnt get anything for ' + cburl);
                        }
                          try{
                            console.log(data.toString());
                            dataArr = JSON.parse(data);
                          }
                          catch(error){
                            //console.log(error);
                            return;
                          }
                          var companyInfo = dataArr[0];
                          var rounds = [];
                          async function putAllRounds(){
                            for( let i in dataArr ){
                                if (i==0) continue;
                                let round = dataArr[i];
                                //console.log(round);
                                const date = round.date;
                                const inv = round.inv;
                                const num = parseInt(round.num);
                                const type = round.type;
                                const size = parseInt(round.size);
                                function putRound()  {
                                  return new Promise((resolve,reject) => {
                                    base('Rounds').create({
                                      "Round": type,
                                      "Company": [
                                        id
                                      ],
                                      "Round Size": size,
                                      "Number of Investors": num,
                                      "Date Round Announced": date,
                                      "Lead Investors": inv
                                    }, function(err, record) {
                                      if (err) {
                                        console.error(err);
                                        reject();
                                      }
                                      resolve(record.getId());
                                    });
                                })
                              }
                              rounds.push(await putRound());
                            }
                          }
                          await putAllRounds();
                          var founderNames = companyInfo.founders.split(",");

                          //calls function that posts the founders to Airtable and then links their records to the Deal record
                          functions.postFounderstoAirtable(founderNames).then(function (result){
                              var founderRecords = functions.getFounderRecords();
                              if (companyInfo.founders===''){
                                  founderRecords = []
                                }
                              if ((typeof foundersfromairtable !== 'undefined') && foundersfromairtable.length > 0){
                                    founderRecords = foundersfromairtable;
                              }

                              base('Companies').update(id, {
                                  'Amount Raised': parseInt(companyInfo.raised),
                                  'Crunchbase URL': companyInfo.cburl,
                                  'Description': companyInfo.description,
                                  'Location': companyInfo.location,
                                  'Company URL': companyInfo.url,
                                  'Rounds': rounds,
                                  'Founders': founderRecords
                                }, function(err, record) {
                                  if (err) {
                                    console.error(err);
                                    return;
                                  }
                                });
                          });

                    });
                    pythonProcess.on('exit', function(){
                      resolve();
                    });
                })
              }
              await fetchCompany();
              console.log("Done")
            });
            fetchNextPage();

        }, function done(err) {
            if (err) { console.error(err); return; }
        });
    });

    robot.hear(functions.thanks, msg => msg.send(msg.random(functions.response)));

    robot.respond(/help/i, function (msg){
        msg.reply("Hi - my name is rooty and I'm a bot configured to help you interface with the Deal Pipeline  \n" +
                "I can be found at https://github.com/rootvc/rooty-bot/blob/master/scripts/airtable-log.js \n" +
                "To log a company, say \"log _ \". \n" +
                  "At any point in logging a company, you can enter s to skip, or e to exit \n" +
              "To check if a company has been logged, say \"check _\" \n " +
               "These are some other things I can do:");
    });

    robot.respond(/whois (.*)/i, function(msg){
      company = functions.getCompanyNameFromMsg(msg);
      const spawn = require("child_process").spawn;
      var pythonProcess = spawn('python',["./webscraper/webdriver.py", company]);
      var crunchbaseSuccess = true;
      var crunchbaseData = '';
      pythonProcess.stdout.on('data', (data) => {
          if (data.toString() === 'Wrong\n'){
              crunchbaseSuccess = false;
              return;
          }
          crunchbaseData = data.toString();
          const dataArr = data.toString().split(/\r?\n/);
          amount_raised = dataArr[0];
          notes = dataArr[1];
          location = dataArr[2];
          founders = dataArr[3];
          website = dataArr[4];
      });
      pythonProcess.on('exit', function(err){
        msg.reply(crunchbaseData);
      });
    });


    // Triggered when rooty check _
    //used to check if a company exists in airtable without wanting to log it
    robot.respond(/check (.*)/i, function(msg){
        company = functions.getCompanyNameFromMsg(msg);
        functions.checkCompanyInAirtable(company).then(function(response){
            if (response){
                msg.reply(company + " already exists in Airtable.");
                msg.reply('https://airtable.com/tblKyMSdDH0tXVV8Z/viwm2ez5rq5s8icSf/' + response.getId());
            }
            else{
                msg.reply(company + " does not exist in Airtable.");
            }
        });
    });

    robot.respond(/search (.*)/i, function(msg){
        functions.searchCompanyInAirtable(msg);
    });


    // Triggered when rooty log _
    robot.respond(/log (.*)/i, function(msg) {
        //intialize variables for the entry
        var dealRecord = "";
        var companyUID = "";
        var founderRecords =[];
        var notes = "";
        var source = "";
        var link = "";
        var founders = "";
        var website = "";
        var amount_raised = "";
        var location = "";
        //Figure out who sent the message to make the owner field in airtable
        //by default it is kane
        company = functions.getCompanyNameFromMsg(msg);
        var owner = "kane@root.vc"
        owner = msg.envelope.user.email_address;
        var contact = [{"email": owner}];

        functions.checkCompanyInAirtable(company).then(function(response){

            //if exists in airtable, do nothing and tell user
            if (response){
                msg.reply(company + " already exists in Airtable.");
                msg.reply('https://airtable.com/tblKyMSdDH0tXVV8Z/viwm2ez5rq5s8icSf/' + response.getId());
            }

            else{
                //Create company record for the logged company
                functions.putCompany(company).then(function(record) {
                companyUID = record.getId();


                //create a Lead in Deal pipeline associated with the company
                functions.putDeal(companyUID, contact).then(function(record) {
                dealRecord = record.getId();

                //start the dialog that speaks to the user
                var dialog = switchBoard.startDialog(msg, 200000);
                dialog.dialogTimeout = function(message){
                    functions.updateAirtable(dealRecord, companyUID, company, founderRecords,
                                          contact, notes, source, link);
                    message.reply("Timed out. No need to enter any more data.");
                }

                //const spawn = require("child_process").spawn;
                // var pythonProcess = spawn('python',["./webscraper/webdriver.py", company]);
                var crunchbaseSuccess = true;
                var crunchbaseData = '';
              /*  pythonProcess.stdout.on('data', (data) => {
                    if (data.toString() === 'Wrong\n'){
                        crunchbaseSuccess = false;
                        return;
                    }
                    crunchbaseData = data.toString();
                    const dataArr = data.toString().split(/\r?\n/);
                    amount_raised = dataArr[0];
                    notes = dataArr[1];
                    location = dataArr[2];
                    founders = dataArr[3];
                    website = dataArr[4];
                });

                pythonProcess.on('exit', function(){*/

                // Responds to user and prompts them to enter founder names
                msg.reply(company + " has been logged in Deal Pipeline: https://airtable.com/tblG2NT0VOUczATZD/viwbOGAcQtroBKPX1.");

                msg.reply(":person_with_blond_hair: What are the founders names? :man-girl-boy:");


                //reads the next line of input from the user
                dialog.addChoice(/.*/i, function (msg2) {

                    var founders = functions.getStringFromMsg(msg2);

                    //exit and skip options
                    if ((founders) == ("e") || (founders.substring(0,3) === 'log')){
                        msg.reply("Exited logging for " + company);
                        founders = "";
                        functions.updateAirtable(dealRecord, companyUID, company, founderRecords,
                                                contact, notes, source, link);
                        return;
                    }
                    if ((founders) == ("s")){
                        msg.reply("Skipped logging founder info.");
                        founders = "";
                    }

                    //not skipped so we enter founders
                    else {
                        //parses the input to separate by commas and " and"'s
                        founders = (founders.split(' ').map(word => word[0].toUpperCase() + word.slice(1))).join(' ');
                        founders = functions.replaceAll(founders, " And ", ", ");
                        founders = functions.replaceAll(founders, " &", ",");
                        founders = functions.replaceAll(founders, ", ", ",");
                        founders = founders.replace(/[,]+/g, ",").trim();

                        //list of founder names
                        var founderNames = founders.split(",");

                        //calls function that posts the founders to Airtable and then links their records to the Deal record
                        functions.postFounderstoAirtable(founderNames).then(function (result){
                            founderRecords = functions.getFounderRecords();
                            functions.updateAirtable(dealRecord, companyUID, company, founderRecords,
                                                  contact, notes, source, link);
                        });
                  }

                  // prompt user for notes
                  msg.reply(":spiral_note_pad: Any notes on the company? :spiral_note_pad:");
                  //read in line of input
                  dialog.addChoice(/.*/i, function (msg3) {
                      notes = functions.getStringFromMsg(msg3);

                      //exit and skip options
                      if ((notes) == ("e") || (notes.substring(0,3) === 'log')) {
                          msg.reply("Exited logging for " + company);
                          notes = "";
                          functions.updateAirtable(dealRecord, companyUID, company, founderRecords,
                                                  contact, notes, source, link);
                          return;
                      }
                      if ((notes) == ("s")){
                          msg.reply("Skipped logging notes");
                          notes = "";
                      }

                  //prompt user to enter source
                  msg.reply("What's your source? :kissing_heart:");
                  dialog.addChoice(/.*/i, function (msg4) {
                      source = functions.getStringFromMsg(msg4);

                      //exit and skip options
                      if ((source) == ("e") || (source.substring(0,3) === 'log')){
                          msg.reply("Exited logging for " + company);
                          source  = "";
                          functions.updateAirtable(dealRecord, companyUID, company, founderRecords,
                                                  contact, notes, source, link);
                          return;
                      }
                      if ((source) == ("s")){
                          msg.reply("Skipped logging source");
                          source  = "";
                      }

                  //prompt user to enter a pitch deck
                  msg.reply("Attach a pitch deck! :books:");
                  //grabs next line of input
                  dialog.addChoice(/.*/i, function (msg5) {
                      var pitchdeck = functions.getStringFromMsg(msg5);


                      //exit and skip options
                      if ((pitchdeck) == ("e") || (pitchdeck.substring(0,3) === 'log')){
                          msg.reply("Done logging for " + company + "!");
                          functions.updateAirtable(dealRecord, companyUID, company, founderRecords,
                                                  contact, notes, source, link);
                          return;
                      }
                      if (pitchdeck == ("s")){
                          msg.reply("Done logging for " + company + "!");
                          functions.updateAirtable(dealRecord, companyUID, company, founderRecords,
                                                  contact, notes, source, link);
                          return;
                      }

                      //if attachment upload, upload to airtable
                      else if (msg5.message.rawMessage.upload){
                          pitchdeck = "";
                          //get the ID of the slack file for the API call to slack
                          var id = msg5.message.rawMessage.files[0].id;

                          //creates a publicly shareable link so that airtable can download
                          (async () => {
                              res = await(web.files.sharedPublicURL({token: token,file: id}));
                              slackLink = res.file.permalink_public;
                              //fetches the link to the direct download to feed to airtable
                              fetch(slackLink)
                                .then(function(response) {
                                  return response.text();
                                })
                                .then(function(rawHtml) {
                                  const dom = new JSDOM(rawHtml);
                                  link = dom.window.document.querySelector("a").href;

                                  functions.updateDeal(dealRecord, companyUID, contact, notes, source, link).then(function(record){
                                      (async () => {
                                          //revoke public access to the attachement url now that it has been posted to airtable
                                          makePrivate = await(web.files.revokePublicURL({token: token,file: id}));
                                      })();
                                  });
                              });
                          })();
                      }
                      //update airtable with final inputs and tell user finished
                      else {functions.updateAirtable(dealRecord, companyUID, company, founderRecords,
                                              contact, notes, source, link);}
                      msg.reply("Done logging for " + company + "!");

                  //these brackets are technically in different levels
                  //because each dialog respond is called from within another dialog
                  //however intuitively they should follow each other mutually exclusively
                  //hence they have been indented to the same level
                  });
                  });
                  });
              });
            //  });
              });
              });
          }
      });
  });
}
