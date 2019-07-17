const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY;
const AIRTABLE_BASE_KEY = process.env.AIRTABLE_BASE_KEY;
const token = process.env.token;


var Conversation = require('hubot-conversation');
const auth = 'Bearer ' + AIRTABLE_API_KEY;
const companiesURL = "https://api.airtable.com/v0/appOH5wwqL3JpZtSr/Companies"
const dealpipelineURL = "https://api.airtable.com/v0/appOH5wwqL3JpZtSr/Deal%20Pipeline"
var Airtable = require('airtable');
var base = new Airtable({apiKey: AIRTABLE_API_KEY}).base(AIRTABLE_BASE_KEY);
var request = require('request');
const {promisify} = require("es6-promisify");
const { WebClient } = require('@slack/web-api');
const web = new WebClient(token);
const fetch = require("node-fetch");
var jsdom = require('jsdom');
const { JSDOM } = jsdom;
import functions from './functions';


module.exports = function (robot) {

  //starts conversation
  var switchBoard = new Conversation(robot);

  //rooty responds when thanked
  robot.respond(/thank(s| you)/i, function (msg){
     msg.send(msg.random(functions.response));
  });

  robot.hear(thanks, msg => msg.send(msg.random(functions.response)));

  robot.respond(/help/i, function (msg){
    msg.reply("Hi - my name is rooty and I'm a bot configured to help you interface with the Deal Pipeline  \n" +
              "I can be found at https://github.com/rootvc/rooty-bot/blob/master/scripts/airtable-log.js \n" +
              "To log a company, say \"log _ \". \n" +
                "At any point in logging a company, you can enter s to skip, or e to exit \n" +
            "To check if a company has been logged, say \"check _\" \n +"
             "These are some other things I can do:");
  });


  // Triggered when rooty check _
  //used to check if a company exists in airtable without wanting to log it
    robot.respond(/check (.*)/i, function(msg){
    let company = msg.match[1].replace(/^\s+|\s+$/g, "");
    // remove http:// in front in case slack autorenders a URL
    company = company.replace(/.*?:\/\//g, "");
    company = replaceAll(company, '\'', '');
    // capitalize company name - yea, Coffeescript is stoopid
    company = (company.split(' ').map(word => word[0].toUpperCase() + word.slice(1))).join(' ');
    var companySeenBefore = false;
    const filterform = "\{Company Name\}= \'"+company +'\'';
    base('Companies').select({
            maxRecords: 1,
            view: "Everything",
            filterByFormula: filterform
        }).eachPage(function page(records, fetchNextPage) {

            records.forEach(function(record) {
                companySeenBefore = true;
            });
            if (companySeenBefore){
              msg.reply(company + " already exists in Airtable.");
            }
            else{
              msg.reply(company + " does not exist in Airtable.");
            }
          }, function done(err) {
              if (err) { console.error(err); return; }
          });
  });


  // Triggered when rooty log _
  robot.respond(/log (.*)/i, function(msg) {


        //Figure out who sent the message to make the owner field in airtable
        //by default it is kane
        var owner = "kane@root.vc"
        owner = msg.envelope.user.email_address;
        var contact = [{"email": owner}];
        let company = msg.match[1].replace(/^\s+|\s+$/g, "");
        var companyUID;

        // remove http:// in front in case slack autorenders a URL
        company = company.replace(/.*?:\/\//g, "");
        company = replaceAll(company, '\'', '');
        // capitalize company name - yea, Coffeescript is stoopid
        company = (company.split(' ').map(word => word[0].toUpperCase() + word.slice(1))).join(' ');
        var companySeenBefore = false;

        //filter formula for airtable search
        const filterform = "\{Company Name\}= \'"+company +'\'';

        //searches Airtable to see if company being logged alreay exists
        base('Companies').select({
                maxRecords: 1,
                view: "Everything",
                filterByFormula: filterform
            }).eachPage(function page(records, fetchNextPage) {

                records.forEach(function(record) {
                    msg.reply(company + " already exists in Airtable.");
                    companySeenBefore = true;
                });

                //if company exists in airtable we stop here
                if (companySeenBefore){
                }
                else{

                  //Create company record for the logged company
                  base('Companies').create({
                    "Company Name": company,
                    "Tags": [
                      "Pipeline"
                    ]
                    //,"Founders": [""]
                  }, function(err, record) {
                    if (err) {
                      console.error(err);
                      console.log('Failed here: ' + company);
                    }
                    companyUID = record.getId();
                    var dealRecord;

                    //create a Lead in Deal pipeline associated with the company
                    base('Deal Pipeline').create({
                        "Status": "Lead",
                        "Company": [
                           companyUID
                        ],
                        "Owner": contact
                      }, function(err, record) {
                        if (err) {
                          console.error(err);
                          console.log('Failed here: ' + company);
                          return;
                        }
                        dealRecord = record.getId();

                        //start the dialog that speaks to the user
                        var dialog = switchBoard.startDialog(msg, 50000);
                        dialog.dialogTimeout = function(message){
                          message.reply("Timed out. No need to enter any more data.");
                        }


                        // Responds to user and prompts them to enter founder names
                        msg.reply(company + " has been logged in Deal Pipeline: https://airtable.com/tblG2NT0VOUczATZD/viwbOGAcQtroBKPX1. \n:person_with_blond_hair: What are the founders names? :man-girl-boy: " );

                        //reads the next line of input from the user
                        dialog.addChoice(/.*/i, function (msg2) {

                          //grabs the text
                          var founders = msg2.match[0];
                          //deals with private message to rooty which automatically prepends "rooty" to string
                          if ((founders.length > 5) && (founders.substring(0,6) === 'rooty ')){
                            founders = msg2.match[0].substring(6);
                          }

                            //exit and skip options
                            if ((founders) == ("e")){
                              msg.reply("Exited - sounds good!")
                              founders = "";
                              return;
                            }
                            if ((founders) == ("s")){
                              founders = "";
                            }

                            //not skipped so we enter founders
                            else {
                              //create a list of founder "record ID"'s in Airtable so that we can link Deal records to these founders
                              var founderRecords =[];

                              //posts a list of strings to airtable as people objects and adds their record ID's to the array
                              function postFounderstoAirtable (founderNames){
                                return founderNames.reduce(function(promise, founder){
                                  return promise.then(function(){
                                    return postFoundertoAirtable(founder).then(function(result){
                                      founderRecords.push(result);
                                    });
                                  });
                                }, Promise.resolve());
                              }

                              //parses the input to separate by commas and " and"'s
                              founders = (founders.split(' ').map(word => word[0].toUpperCase() + word.slice(1))).join(' ');
                              founders = replaceAll(founders, " And", ",");
                              founders = replaceAll(founders, ", ", ",");
                              founders = founders.replace(/[,]+/g, ",").trim();

                              //list of founder names
                              var founderNames = founders.split(",");

                              //calls function that posts the founders to Airtable and then links their records to the Deal record
                              postFounderstoAirtable(founderNames).then(function (){
                                    base('Companies').replace(companyUID, {
                                      "Company Name": company,
                                      "Tags": [
                                        "Pipeline"
                                      ],
                                      "Founders": founderRecords
                                    },
                                      function(err, record) {
                                        if (err) {
                                          console.error(err);
                                          return;
                                          console.log('Failed here: ' + company);
                                        }

                                        //update the deal to link the company again now that we have called replace function on the company in airtable
                                        // else it will unlink
                                        base('Deal Pipeline').replace(dealRecord, {
                                        "Status": "Lead",
                                            "Company": [
                                               companyUID
                                            ],
                                            "Owner": contact
                                          },
                                            function(err, record) {
                                              if (err) {
                                                console.error(err);
                                                return;
                                                console.log('Failed here: ' + company);
                                              }
                                        });
                                  });
                                });
                              }

                              //prompt user for notes
                              msg.reply(":spiral_note_pad: Any notes on the company? :spiral_note_pad:");

                              //read in line of input
                              dialog.addChoice(/.*/i, function (msg3) {
                                var notes = msg3.match[0];

                                //deal with private message to rooty which automatically prepends "rooty" to string
                                if ((msg3.match[0].length > 5) && (msg3.match[0].substring(0,6) === 'rooty ')){
                                  notes = msg3.match[0].substring(6);
                                }

                                //exit and skip options
                                if ((notes) == ("e")){
                                  msg.reply("Exited - sounds good!");
                                  notes = "";
                                  return;
                                }
                                if ((notes) == ("s")){
                                  notes = "";
                                }

                                //not exit or skip so we update airtable with the notes
                                else{
                                  base('Deal Pipeline').replace(dealRecord, {
                                  "Status": "Lead",
                                  "Company": [
                                     companyUID
                                  ],
                                  "Notes": notes,
                                  "Owner": contact
                                },
                                  function(err, record) {
                                    if (err) {
                                      console.error(err);
                                      return;
                                      console.log('Failed here: ' + company);
                                    }
                              });
                            }

                                  //prompt user to enter source
                                  msg.reply("What's your source? :kissing_heart:");
                                  dialog.addChoice(/.*/i, function (msg4) {
                                    var source = msg4.match[0];

                                    //deal with private message to rooty which automatically prepends "rooty" to string
                                    if ((source.length > 5) && (source.substring(0,6) === 'rooty ')){
                                      source = source.substring(6);
                                    }

                                    //exit and skip options
                                    if ((source) == ("e")){
                                      msg.reply("Exited - sounds good!");
                                      source  = "";
                                      return;
                                    }
                                    if ((source) == ("s")){
                                      source  = "";
                                    }

                                    //not exit or skip so we enter the source into airtable
                                    else{
                                      base('Deal Pipeline').replace(dealRecord, {
                                      "Status": "Lead",
                                      "Company": [
                                         companyUID
                                      ],
                                      "Notes": notes,
                                      "Owner": contact,
                                      "Source": source
                                    },
                                      function(err, record) {
                                        if (err) {
                                          console.error(err);
                                          return;
                                          console.log('Failed here: ' + company);
                                        }
                                  });
                                }
                                    //prompt user to enter a pitch deck
                                    msg.reply("Attach a pitch deck! :books:");

                                    //grabs next line of input
                                    dialog.addChoice(/.*/i, function (msg5) {
                                      var pitchdeck = msg5.match[0];

                                      //deal with private message to rooty which automatically prepends "rooty" to string
                                      if ((pitchdeck.length > 5) && (pitchdeck.substring(0,6) === 'rooty ')){
                                        pitchdeck = pitchdeck.substring(6);
                                      }

                                      //exit and skip options
                                      if ((pitchdeck) == ("e")){
                                        msg.reply("Exited - sounds good!");
                                        return;
                                      }
                                      if (pitchdeck == ("s")){
                                        msg.reply("Sounds good!");
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
                                              var link = dom.window.document.querySelector("a").href;
                                              //update airtable record with the pitch deck
                                              base('Deal Pipeline').replace(dealRecord, {
                                              "Status": "Lead",
                                              "Company": [
                                                 companyUID
                                              ],
                                              "Notes": notes,
                                              "Owner": contact,
                                              "Source": source,
                                              "Pitch Deck": [{"url": link}]
                                              },
                                                function(err, record) {
                                                  if (err) {
                                                    console.error(err);
                                                    return;
                                                    console.log('Failed here: ' + company);
                                                  }
                                                  (async () => {
                                                    //revoke public access to the attachement url now that it has been posted to airtable
                                                    makePrivate = await(web.files.revokePublicURL({token: token,file: id}));
                                                  })();
                                            });
                                          });
                                      })();
                                  }
                                  msg.reply("Sounds good!")
                                });

                                });

                              });
                            });
                        });

                      });
                  }

            },

            function done(err) {
                if (err) { console.error(err); return; }
            });

  });
}
