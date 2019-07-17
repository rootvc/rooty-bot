const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY;
const AIRTABLE_BASE_KEY = process.env.AIRTABLE_BASE_KEY;
const token = process.env.token;


var Conversation = require('hubot-conversation');
const auth = 'Bearer ' + AIRTABLE_API_KEY;
const companiesURL = "https://api.airtable.com/v0/appOH5wwqL3JpZtSr/Companies"
const dealpipelineURL = "https://api.airtable.com/v0/appOH5wwqL3JpZtSr/Deal%20Pipeline"
var Airtable = require('airtable');
var base = new Airtable({apiKey: AIRTABLE_API_KEY}).base(AIRTABLE_BASE_KEY);
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

//replaceAll function for strings
function replaceAll(str, find, replace) {
    return str.replace(new RegExp(find, 'g'), replace);
}

//posts a list of strings to airtable as people objects and adds their record ID's to the array
function postFounderstoAirtable (founderNames){
    founderRecords =[];
        return founderNames.reduce(function(promise, founder){
          return promise.then(function(){
              return postFoundertoAirtable(founder).then(function(result){
                  founderRecords.push(result);
              });
          });
    }, Promise.resolve());
}

//returns array containing founder records
function getFounderRecords(){
    return founderRecords;
}

// Creates founder object in airtable
//returns the record ID
let postFoundertoAirtable  = (founder) => {
    return new Promise (
      (resolve,reject) => {

        base('People').create(
        {
              "Name": founder,
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
function checkCompanyInAirtable (company){
    var companySeenBefore = false;
    const filterform = "\{Company Name\}= \'"+company +'\'';
    return new Promise(function(resolve, reject) {
        return base('Companies').select({
                maxRecords: 1,
                view: "Everything",
                filterByFormula: filterform
            }).firstPage(function (err, records) {
              if (err){
                  reject(err);
              }
              records.forEach(function(record) {
                  resolve(true);
              });
              resolve(false);
            });
    });

}

function searchCompanyInAirtable (company){
  //const filterform = "OR(FIND(\'" + company + "\',\{Company Name\}))," +"(FIND(LOWER(\'" + company + "\'),\{Company Name\})))";
  const filterform = "FIND(\'" + company + "\'\{Company Name\}))";

    return new Promise(function(resolve, reject) {
        return base('Companies').select({
                view: "Everything",
                fields: ['Company Name'],
                filterByFormula: filterform
            }).firstPage(function (err, records) {
              if (err){
                  reject(err);
              }
              records.forEach(function(record) {
                  console.log(record);
                  resolve(record);
              });
            });
    });

}

//parses input from hubot for company name
function getCompanyNameFromMsg(msg){
    let company = msg.match[1].replace(/^\s+|\s+$/g, "");

    // remove http:// in front in case slack autorenders a URL
    company = company.replace(/.*?:\/\//g, "");
    company = replaceAll(company, '\'', '');
    // capitalize company name - yea, Coffeescript is stoopid
    company = (company.split(' ').map(word => word[0].toUpperCase() + word.slice(1))).join(' ');
    return company;
}

//parses input from hubot
function getStringFromMsg(msg){
    var string = msg.match[0];
    //deal with private message to rooty which automatically prepends "rooty" to string
    if ((string.length > 5) && (string.substring(0,6) === 'rooty ')){
        string = string.substring(6);
    }
    return string;
}

//enters a Deal record into airtable
//returns a Promise containing the record
function putDeal(companyUID = "", contact = "kane@root.vc",status = "Lead"){
    return base('Deal Pipeline').create({
        "Status": status,
        "Company": [
           companyUID
        ],
        "Owner": contact
      });
  }

//updates a Deal record into airtable
//returns a Promise containing the record
function updateDeal(dealRecord = "", companyUID = "", contact = "kane@root.vc",
                    notes = "", source = "", pitchdeck = "", status = "Lead"){
  return base('Deal Pipeline').replace(dealRecord, {
      "Status": "Lead",
      "Company": [
         companyUID
      ],
      "Notes": notes,
      "Owner": contact,
      "Source": source,
      "Pitch Deck": [{"url": pitchdeck}]
  });

}


//enters a Company record into airtable
//returns a Promise containing the record
function putCompany(company = ""){
    return base('Companies').create({
        "Company Name": company,
        "Tags": [
          "Pipeline"
          ]
        });
}

//Updates both the Company record and the Deal record in airtable
function updateAirtable(dealRecord, companyUID, company, founderRecords,
                          contact, notes, source, link){
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
        }

        //update the deal to link the company again now that we have called replace function on the company in airtable
        // else it will unlink
        base('Deal Pipeline').replace(dealRecord, {
            "Status": "Lead",
            "Company": [
               companyUID
            ],
            "Notes": notes,
            "Owner": contact,
            "Source": source,
            "Pitch Deck": [{"url": link}]
          });
        });
}

module.exports.getStringFromMsg = getStringFromMsg;
module.exports.updateAirtable = updateAirtable;
module.exports.getFounderRecords = getFounderRecords;
module.exports.putCompany = putCompany;
module.exports.updateDeal = updateDeal;
module.exports.putDeal = putDeal;
module.exports.getCompanyNameFromMsg = getCompanyNameFromMsg;
module.exports.searchCompanyInAirtable = searchCompanyInAirtable;
module.exports.checkCompanyInAirtable = checkCompanyInAirtable;
module.exports.response = response;
module.exports.thanks = thanks;
module.exports.postFoundertoAirtable = postFoundertoAirtable;
module.exports.postFounderstoAirtable = postFounderstoAirtable;
module.exports.replaceAll = replaceAll;
