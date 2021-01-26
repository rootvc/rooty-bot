const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY;
const AIRTABLE_BASE_KEY = process.env.AIRTABLE_BASE_KEY;
const token = process.env.token;


var Conversation = require('hubot-conversation');
const {
  promisify
} = require("es6-promisify");
const events = require('events');
const auth = 'Bearer ' + AIRTABLE_API_KEY;
const companiesURL = "https://api.airtable.com/v0/appOH5wwqL3JpZtSr/Companies"
const dealpipelineURL = "https://api.airtable.com/v0/appOH5wwqL3JpZtSr/Deal%20Pipeline"
const Airtable = require('airtable');
const base = new Airtable({
  apiKey: AIRTABLE_API_KEY
}).base(AIRTABLE_BASE_KEY);
const {
  WebClient
} = require('@slack/web-api');
const web = new WebClient(token);
const fetch = require("node-fetch");
const jsdom = require('jsdom');
const {
  JSDOM
} = jsdom;
const functions = require('./functions');


module.exports = function(robot) {

  //starts conversation
  var switchBoard = new Conversation(robot);

  //rooty responds when thanked
  robot.respond(/thank(s| you)/i, function(msg) {
    msg.send(msg.random(functions.response));
  });

  robot.hear(functions.thanks, msg => msg.send(msg.random(functions.response)));

  robot.respond(/help/i, function(msg) {
    msg.reply("Hi - my name is rooty and I'm a bot configured to help you interface with the Deal Pipeline  \n" +
      "I can be found at https://github.com/rootvc/rooty-bot/ \n" +
      "Here are some of my features:  \n" +
      'log X \n This logs X as a company in the Airtable' +
      '\n\t The followup questions will let you enter details about the company, founders, notes, attach a pitch deck, etc.' +
      '\n \tAssigns an owner as the Airtable user who has the email as the person who sent the Slack msg (Kane by default)' +
      '\n\tAt any point, \"e\" exits logging and \"s\" skips an option' +
      '\n\tWill parse multiple founders separated by \"and\", \",\" or \"&\"' +
      '\n\tPitch deck uploads are tricky - it will download and upload to Airtable but because of Airtable\'s preview feature pulling from the link and not the download it will not let you preview in Airtable - you have to download the attachment from Airtable to view it (by clicking on the link after previewing).' +
      '\n check X' +
      '\n\tChecks if a company is already in the Airtable and tell you' +
      '\nsearch X' +
      '\n\tReturns all companies that contain string X from the Airtable' +
      '\nThank you' +
      '\n\tRooty will let you know that you are welcome' +
      "\nThese are some other things I can do:");
  });

  // Triggered when rooty check _
  //used to check if a company exists in airtable without wanting to log it
  robot.respond(/check (.*)/i, function(msg) {
    company = functions.getCompanyNameFromMsg(msg);
    functions.checkCompanyInAirtable(company).then(function(response) {
      if (response) {
        msg.reply(company + " already exists in Airtable.");
        msg.reply('https://airtable.com/tblKyMSdDH0tXVV8Z/viwm2ez5rq5s8icSf/' + response.getId());
      } else {
        msg.reply(company + " does not exist in Airtable.");
      }
    });
  });

  robot.respond(/search (.*)/i, function(msg) {
    functions.searchCompanyInAirtable(msg);
  });

  // Triggered when rooty log _
  robot.respond(/log (.*)/i, function(msg) {
    //intialize variables for the entry
    var dealRecord = "";
    var companyUID = "";
    var founderRecords = [];
    var notes = "";
    var source = "";
    var founders = "";
    var website = "";
    var amount_raised = "";
    var location = "";

    //Figure out who sent the message to make the owner field in airtable
    //by default it is kane
    company = functions.getCompanyNameFromMsg(msg);
    ownerEmail = msg.envelope.user.email_address;
    
    var CircularJSON = require('circular-json');
  	msg.reply(CircularJSON.stringify(msg.envelope));

    // MAKE THIS LOOK UP THE CORRECT OWNER
    var owner = {
      "id": "usr1CbUdPU3ktnUa1",
      "email": "chrissy@root.vc", // ownerEmail
      "name": "Chrissy Meyer"
    };

    functions.checkCompanyInAirtable(company).then(function(response) {

      //if exists in airtable, do nothing and tell user
      if (response) {
        msg.reply(company + " already exists in Airtable.");
        msg.reply('https://airtable.com/tblKyMSdDH0tXVV8Z/viwm2ez5rq5s8icSf/' + response.getId());
      } else {
        //Create company record for the logged company
        functions.putCompany(company, owner).then(function(record) {

          // confirm
          msg.reply(company + " has been logged in Deal Pipeline: https://airtable.com/tblKyMSdDH0tXVV8Z/viwnxW4YFY9HNZeNk");
          companyUID = record.getId();

          //start the dialog that speaks to the user
          var dialog = switchBoard.startDialog(msg, 120000);
          dialog.dialogTimeout = function(message) {
            message.reply("Timed out. No need to enter any more data.");
          }

          //reads the next line of input from the user for founder emails
          msg.reply(":envelope: What are the founders' email addresses? (Clearbit will fill in the rest of their info.) :mailbox-with-mail:");

          dialog.addChoice(/.*/i, function(msg2) {

            var founders = functions.getStringFromMsg(msg2);

            //exit and skip options
            if ((founders) == ("e") || (founders) == ("x") || (founders) == ("E") || (founders) == ("X") || (founders.substring(0, 3) === 'log')) {
              msg.reply("Exited logging for " + company);
              return;
            } else if ((founders) == ("s")) {
              msg.reply("Skipped logging founder info.");
            }

            //not skipped so we enter founders
            else {
              //parses the input to separate by commas and " and"'s
              founders = functions.parseFounderEmails(founders);

              //calls function that posts the founders to Airtable and then links their records to the Deal record
              functions.postFounderstoAirtable(founders).then(function(result) {
                founderRecords = functions.getFounderRecords();
                functions.updateAirtable(companyUID, company, founderRecords,
                  owner, notes, source);
              });
            }

            // reads the next line of input from the user for notes
            msg.reply("Enter some notes on the company:");
            dialog.addChoice(/.*/i, function(msg3) {

              var notes = functions.getStringFromMsg(msg3);

              //exit and skip options
              if ((notes) == ("e") || (notes) == ("x") || (notes) == ("E") || (notes) == ("X") || (notes.substring(0, 3) === 'log')) {
                msg.reply("Exited logging for " + company);
                return;
              } else if ((notes) == ("s")) {
                msg.reply("Skipped logging notes info.");
              }

              //not skipped so we enter notes
              else {
                functions.updateAirtable(companyUID, company, founderRecords,
                    owner, notes, source);
              }

              // reads the next line of input from the user for source (not sure why this has to be nested)
              msg.reply("What's your source?");
              dialog.addChoice(/.*/i, function(msg4) {

                var source = functions.getStringFromMsg(msg4);

                //exit and skip options
                if ((source) == ("e") || (source) == ("x") || (source) == ("E") || (source) == ("X") || (source.substring(0, 3) === 'log')) {
                  msg.reply("Exited logging for " + company);
                  return;
                } else if ((source) == ("s")) {
                  msg.reply("Skipped logging source info.");
                }

                //not skipped so we enter notes
                else {
                  functions.updateAirtable(companyUID, company, founderRecords,
                      owner, notes, source);
                }

                msg.reply("Done logging for " + company + "!");
                return;            

              });  

            });

          });

        }).catch(() => {});
      } // closes the else statement that logs the company
    });
  });
}