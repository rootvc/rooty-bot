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
                  resolve(record);
              });
              resolve(false);
            });
    });

}

function searchCompanyInAirtable (msg){
  //const filterform = "OR(FIND(\'" + company + "\',\{Company Name\}))," +"(FIND(LOWER(\'" + company + "\'),\{Company Name\})))";
  var company = getCompanyNameFromMsg(msg);
  const filterform = "(FIND(\'" + company + "\',\{Company Name\}))";
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
                msg.reply(record.get('Company Name'));
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


// get info from one company from crunchbase and return it in neat string format
function whoisCrunchbaseOneCompany(cburl){

    const spawn = require("child_process").spawn;

              var pythonProcess = spawn('python',["./webscraper/webdriver.py", cburl]);

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
                      console.log(error);
                      return;
                    }

                    var companyInfo = dataArr[0];
                    var rounds = [];
                    for( let i in dataArr ){
                        if (i==0) continue;
                        let round = dataArr[i];
                        //console.log(round);
                        const date = round.date;
                        const inv = round.inv;
                        const num = parseInt(round.num);
                        const type = round.type;
                        const size = parseInt(round.size);
                        rounds.push({
                              "Round": type,
                              "Round Size": size,
                              "Number of Investors": num,
                              "Date Round Announced": date,
                              "Lead Investors": inv
                            });
                      }


                    var founderNames = companyInfo.founders.split(",");

                    theData = {
                    'Amount Raised': parseInt(companyInfo.raised),
                    'Crunchbase URL': companyInfo.cburl,
                    'Description': companyInfo.description,
                    'Location': companyInfo.location,
                    'Company URL': companyInfo.url,
                    'Rounds': rounds,
                    'Founders': founderNames,
                  };



              });

              pythonProcess.on('exit', function(){
                resolve(thedata);
              });
}




// get info from one company from crunchbase and update the airtable
function updateCrunchbaseOneCompany(recordID){

    const spawn = require("child_process").spawn;
    base('Companies').find(recordID, function (err, record) {
          if (err) { console.error(err); return; }

          var cburl = record.get('Company Name');
          var foundersfromairtable = record.get('Founders');
          var roundsfromairtable = record.get('Rounds');
          if ((typeof roundsfromairtable !== 'undefined')){
            for (let index = 0; index < roundsfromairtable.length; index++) {
              base('Rounds').destroy(roundsfromairtable[index], function(err, deletedRecord) {
                  if (err) {
                    console.error(err);
                    return;
                  }
                });
            }
          }

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
                      console.log(error);
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
                    postFounderstoAirtable(founderNames).then(function (result){
                        var founderRecords = getFounderRecords();
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
        fetchCompany();
        console.log("Done")
      });
}

//update all the companies in airtable
function updateCrunchbase(){
    const spawn = require("child_process").spawn;
    base('Companies').select({
        // Selecting the first 3 records in Active Portfolio:
        view: "Crunchbase"
    }).eachPage(async function page(records, fetchNextPage) {
        // This function (`page`) will get called for each page of records.
        async function asyncForEach(array, callback) {
          for (let index = 0; index < array.length; index++) {
            callback(array[index], index, array);
          }
        }
        asyncForEach(records, async (record) => {
            var cburl = record.get('Company Name');
            var foundersfromairtable = record.get('Founders');
            var roundsfromairtable = record.get('Rounds');
            if ((typeof roundsfromairtable !== 'undefined')){
              for (let index = 0; index < roundsfromairtable.length; index++) {
                base('Rounds').destroy(roundsfromairtable[index], function(err, deletedRecord) {
                    if (err) {
                      console.error(err);
                      return;
                    }
                  });
              }
            }

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
                        console.log(error);
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
                      postFounderstoAirtable(founderNames).then(function (result){
                          var founderRecords = getFounderRecords();
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
}


module.exports.whoisCrunchbaseOneCompany = whoisCrunchbaseOneCompany;
module.exports.updateCrunchbaseOneCompany = updateCrunchbaseOneCompany;
module.exports.updateCrunchbase = updateCrunchbase;
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
