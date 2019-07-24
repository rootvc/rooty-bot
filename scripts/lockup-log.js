const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY;
const AIRTABLE_BASE_KEY = process.env.AIRTABLE_BASE_KEY;
const base = new Airtable({apiKey: AIRTABLE_API_KEY}).base('appkd4LqDq6LvI5zM');

const token = process.env.token;
//

var Conversation = require('hubot-conversation');
const {promisify} = require("es6-promisify");
const events = require('events');
const auth = 'Bearer ' + AIRTABLE_API_KEY;
const Airtable = require('airtable');
const { WebClient } = require('@slack/web-api');
const web = new WebClient(token);
const fetch = require("node-fetch");
const jsdom = require('jsdom');
const { JSDOM } = jsdom;
const functions = require('./functions');


module.exports = function (robot) {

    //starts conversation
    var switchBoard = new Conversation(robot);

    robot.respond(/lockup (.*)/i, function(msg){

          var company = functions.getCompanyNameFromMsg(msg);
          var date = '';
          var acquirer = '';
          var source = '';
          //start the dialog that speaks to the user
          var dialog = switchBoard.startDialog(msg, 200000);
          dialog.dialogTimeout = function(message){
              exited();
              message.reply("Timed out. No need to enter any more data.");
          }


          msg.reply("What is the lockup period end date? (MM/DD/YYYY)");

          //reads the next line of input from the user
          dialog.addChoice(/.*/i, function (msg2) {
              date = functions.getStringFromMsg(msg2);
              if ((date) == ("e")) {
                  msg.reply("Exited logging for " + company);
                  date = "";
                  enterData();
                  return;
              }

          msg.reply("What is the acquirer's name?");

          //reads the next line of input from the user
          dialog.addChoice(/.*/i, function (msg3) {
              acquirer = functions.getStringFromMsg(msg3);
              if ((acquirer) == ("e")) {
                  msg.reply("Exited logging for " + company);
                  acquirer = "";
                  enterData();
                  return;
              }
          msg.reply("What is the source's name?");
          //reads the next line of input from the user
          dialog.addChoice(/.*/i, function (msg4) {
              source = functions.getStringFromMsg(msg4);
              if ((source) == ("e")) {
                  msg.reply("Exited logging for " + company);
                  source = "";
                  enterData();
                  return;
              }
              enterData();
          });
          });
          });


          function enterData(){
              base('Lockup Periods').create({
                    "Company": company,
                    "Acquirer": acquirer,
                    "Date": date,
                    "Source": source
                });
              msg.reply('Lockup period for ' + company+ ' has been logged:' +
              'https://airtable.com/tblpwX00S9Z3Td54C/viwe0fCRvS5rh2FTA?blocks=hide.\n'+
              'You will be notified 4 weeks before ' + date + ' via email.');
          }
    });

}
