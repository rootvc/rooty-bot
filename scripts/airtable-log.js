const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY;
const AIRTABLE_BASE_KEY = process.env.AIRTABLE_BASE_KEY;
const token = process.env.token;


var Conversation = require('hubot-conversation');
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

    robot.hear(functions.thanks, msg => msg.send(msg.random(functions.response)));

    robot.respond(/help/i, function (msg){
        msg.reply("Hi - my name is rooty and I'm a bot configured to help you interface with the Deal Pipeline  \n" +
                "I can be found at https://github.com/rootvc/rooty-bot/blob/master/scripts/airtable-log.js \n" +
                "To log a company, say \"log _ \". \n" +
                  "At any point in logging a company, you can enter s to skip, or e to exit \n" +
              "To check if a company has been logged, say \"check _\" \n " +
               "These are some other things I can do:");
    });


    // Triggered when rooty check _
    //used to check if a company exists in airtable without wanting to log it
    robot.respond(/check (.*)/i, function(msg){
        company = functions.getCompanyNameFromMsg(msg);
        functions.checkCompanyInAirtable(company).then(function(response){
            if (response){
                msg.reply(company + " already exists in Airtable.");
            }
            else{
                msg.reply(company + " does not exist in Airtable.");
            }
        });
    });

    robot.respond(/search (.*)/i, function(msg){
        company = functions.getCompanyNameFromMsg(msg);
        functions.searchCompanyInAirtable(company).then(function(response){
            if (response){
                msg.reply(company + " already exists in Airtable.");
            }
            else{
                msg.reply(company + " does not exist in Airtable.");
            }
        });
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
            }

            else{
                //Create company record for the logged company
                functions.putCompany(company).then(function(record) {
                companyUID = record.getId();


                //create a Lead in Deal pipeline associated with the company
                functions.putDeal(companyUID, contact).then(function(record) {
                dealRecord = record.getId();

                //start the dialog that speaks to the user
                var dialog = switchBoard.startDialog(msg, 50000);
                dialog.dialogTimeout = function(message){
                    functions.updateAirtable(dealRecord, companyUID, company, founderRecords,
                                          contact, notes, source, link);
                    message.reply("Timed out. No need to enter any more data.");
                }


                // Responds to user and prompts them to enter founder names
                msg.reply(company + " has been logged in Deal Pipeline: https://airtable.com/tblG2NT0VOUczATZD/viwbOGAcQtroBKPX1. \n" +
                          ":person_with_blond_hair: What are the founders names? :man-girl-boy: " );

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
                        msg.reply("Skipped logging founder info.")
                        founders = "";
                    }

                    //not skipped so we enter founders
                    else {
                        //parses the input to separate by commas and " and"'s
                        founders = (founders.split(' ').map(word => word[0].toUpperCase() + word.slice(1))).join(' ');
                        founders = functions.replaceAll(founders, " And", ",");
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

                  //prompt user for notes
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
                      functions.updateAirtable(dealRecord, companyUID, company, founderRecords,
                                              contact, notes, source, link);
                      msg.reply("Done logging for " + company + "!");

                  //these brackets are technically in different levels
                  //because each dialog respond is called from within another dialog
                  //however intuitively they should follow each other mutually exclusively
                  //hence they have been indented to the same level
                  });
                  });
                  });
              });
              });
              });
          }
      });
  });
}
