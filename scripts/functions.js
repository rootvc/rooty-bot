require('dotenv').config();

const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY;
const AIRTABLE_BASE_KEY = process.env.AIRTABLE_BASE_KEY;
const token = process.env.token;

var Conversation = require('hubot-conversation');
const auth = 'Bearer ' + AIRTABLE_API_KEY;
const companiesURL = "https://api.airtable.com/v0/appOH5wwqL3JpZtSr/Companies"
const dealpipelineURL = "https://api.airtable.com/v0/appOH5wwqL3JpZtSr/Deal%20Pipeline"
var Airtable = require('airtable');
var base = new Airtable({
  apiKey: AIRTABLE_API_KEY
}).base(AIRTABLE_BASE_KEY);
var founderRecords = [];

// for rootys thank you function
const response = [
  "you're welcome",
  "no problem",
  "not a problem",
  "no problem at all",
  "don’t mention it",
  "it’s no bother",
  "it’s my pleasure",
  "my pleasure",
  "it’s nothing",
  "think nothing of it",
  "no, no. thank you!",
  "sure thing"
];
const thanks = new RegExp("thank(s| you) rooty", "i");

const defaultContact = [{
  "email": "kane@root.vc"
}];

//replaceAll function for strings
function replaceAll(str, find, replace) {
  return str.replace(new RegExp(find, 'g'), replace);
}

//posts a list of strings to airtable as people objects and adds their record ID's to the array
function postFounderstoAirtable(founderEmails) {
  founderRecords = [];
  return founderEmails.reduce(function(promise, founder) {
    return promise.then(function() {
      return postFoundertoAirtable(founder).then(function(result) {
        founderRecords.push(result);
      });
    });
  }, Promise.resolve());
}

//returns array containing founder records
function getFounderRecords() {
  return founderRecords;
}

// Creates founder object in airtable
//returns the record ID
let postFoundertoAirtable = (email) => {
  return new Promise(
    (resolve, reject) => {

      base('People').create({
        "Email": email,
      }, function(err, record) {
        if (err) {
          console.error(err);
          return;
        }
        resolve(record.getId());
      });
    });
};

//checks if a company name has been seen in Airtable and returns true/false accordingly
function checkCompanyInAirtable(company) {
  var companySeenBefore = false;
  const filterform = "\{Company Name\}= \'" + company + '\'';
  return new Promise(function(resolve, reject) {
    return base('Companies').select({
      maxRecords: 1,
      view: "Everything",
      filterByFormula: filterform
    }).firstPage(function(err, records) {
      if (err) {
        reject(err);
      }
      records.forEach(function(record) {
        resolve(record);
      });
      resolve(false);
    });
  });

}

function searchCompanyInAirtable(msg) {
  //const filterform = "OR(FIND(\'" + company + "\',\{Company Name\}))," +"(FIND(LOWER(\'" + company + "\'),\{Company Name\})))";
  var company = getCompanyNameFromMsg(msg);
  const filterform = "(FIND(\'" + company + "\',\{Company Name\}))";
  return new Promise(function(resolve, reject) {
    return base('Companies').select({
      view: "Everything",
      fields: ['Company Name'],
      filterByFormula: filterform
    }).firstPage(function(err, records) {
      if (err) {
        reject(err);
      }
      records.forEach(function(record) {
        msg.reply(record.get('Company Name'));
        resolve(record);
      });
    });
  });
}

//parses input from hubot for company name
function getCompanyNameFromMsg(msg) {
  let company = msg.match[1].replace(/^\s+|\s+$/g, "");

  // remove http:// in front in case slack autorenders a URL
  company = company.replace(/.*?:\/\//g, "");
  company = replaceAll(company, '\'', '');
  // capitalize company name - yea, Coffeescript is stoopid
  company = (company.split(' ').map(word => word[0].toUpperCase() + word.slice(1))).join(' ');
  return company;
}

//parses input from hubot
function getStringFromMsg(msg) {
  var string = msg.match[0];
  //deal with private message to rooty which automatically prepends "rooty" to string
  if ((string.length > 5) && (string.substring(0, 6) === 'rooty ')) {
    string = string.substring(6);
  }
  return string;
}

//enters a Company record into airtable
//returns a Promise containing the record
function putCompany(company = "", owner) {
  return base('Companies').create({
    "Company Name": company,
    "Owner": owner,
    "Status": "Lead",
    "Tags": [
      "Pipeline"
    ]
  });
}

//parses founder emails and returns a list of them
function parseFounderEmails(founders){
  founders = founders.split(' ').map(word => word[0].toUpperCase() + word.slice(1)).join(' ');
  founders = replaceAll(founders, " And ", ", ");
  founders = replaceAll(founders, " &", ",");
  founders = replaceAll(founders, ", ", ",");
  founders = founders.replace(/[,]+/g, ",").trim();
  founders = founders.split(",");
  return founders;
}

//Updates both the Company record and the Deal record in airtable
function updateAirtable(companyUID, company, founderRecords,
  owner, notes, source) {
  base('Companies').update(companyUID, {
      "Company Name": company,
      "Tags": [
        "Pipeline"
      ],
      "Notes": notes,
      "Source": source,
      "Founders": founderRecords
    },
    function(err, record) {
      if (err) {
        console.error(err);
        return;
      }
    });
}

module.exports.getStringFromMsg = getStringFromMsg;
module.exports.updateAirtable = updateAirtable;
module.exports.getFounderRecords = getFounderRecords;
module.exports.putCompany = putCompany;
module.exports.parseFounderEmails = parseFounderEmails;
module.exports.getCompanyNameFromMsg = getCompanyNameFromMsg;
module.exports.searchCompanyInAirtable = searchCompanyInAirtable;
module.exports.checkCompanyInAirtable = checkCompanyInAirtable;
module.exports.response = response;
module.exports.thanks = thanks;
module.exports.postFoundertoAirtable = postFoundertoAirtable;
module.exports.postFounderstoAirtable = postFounderstoAirtable;
module.exports.replaceAll = replaceAll;