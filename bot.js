var HTTPS = require('https');
//var cool = require('cool-ascii-faces');
const { Client } = require('pg');
var moment = require('moment-timezone');
var Predictor = require('./predictions.js');

var botID = process.env.BOT_ID;

// Add database connection logic
const client = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: {rejectUnauthorized: false},
});

function respond() {
  // Process our recieved message
  var request = JSON.parse(this.req.chunks[0]);
  
  // Regular expressions matching
  var CaseOne = /^\d+$/;		// Case 1: Just a number from a user
  var CaseTwo = /^\/TB max$/;
  var CaseThree = /^\/TB links$/;

  // If we input a new value
  if(request.text && CaseOne.test(request.text)) {
	// This is where we add our additional logic
	//console.log(JSON.stringify(request));	
	var time = moment(request.created_at).tz("UTC").tz("America/New_York");
	var dayOfWeek = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
	var day = dayOfWeek[time.day()];
	if(day != 'Sunday') {
	  if(time.hours() < 12) {
		day += 'AM';
	  } else {
		day += 'PM';
	  }
	}

	client.connect();
	client.query('SELECT UserName FROM TurnipPrices WHERE UserID=' + request.sender_id + ';', (err, sqlres) => {
	  console.log(sqlres.rows);
	  if(!!sqlres.rows.length) { // Execute if this user exists
	    client.query('UPDATE TurnipPrices SET ' + day + '=' + request.text + 'WHERE UserID=' + request.sender_id + ';', (err, sqlres2) => {});
	  } else {				// Create new row if user doesn't exist
	    client.query('INSERT INTO TurnipPrices (UserID, UserName, ' + day + ') \
	      VALUES (' + request.sender_id + ', \'' + request.name + '\', ' + request.text + ');', (err, sqlres2) => {});
	  }
	  //console.log(sqlres);
	  client.end();
	});

	this.res.writeHead(200);
    this.res.end();
  
    // If we request the town with the max
  } else if(request.text && CaseTwo.test(request.text)) {
	var highestGuaranteedMinimum = ['',0];
	var highestMaximum = ['',0];
	
	client.connect();
	client.query('SELECT * FROM TurnipPrices;', (err, sqlres) => {

	  for(let row of sqlres.rows) {
	    var prices = deSQL(row);
		var prediction = new predictor(prices,false);
		var possibilities = prediction.analyze_possibilities();
		possibilities = possibilities[0];
		if(possibilities.weekGuaranteedMinimum > highestGuaranteedMinimum[1]) {
		  highestGuaranteedMinimum = [row.UserName,possibilities.weekGuaranteedMinimum];
		}
		if(possibilities.weekMax > highestMaximum[1]) {
		  highestMaximum = [row.UserName,possibilities.weekMax];
		}
	  }
	  client.end();
  
  	var response = highestGuaranteedMinimum[0] + ' has the highest guaranteed minimum of ' + highestGuaranteedMinimum[1] + '\n' +
			       highestMaximum[0] + ' has the highest overall maximum of ' + highestMaximum[1];
	// Actually send the message back to groupme
	this.res.writeHead(200);
    postMessage(response);
    this.res.end();
	});
	
	// If we request links
  } else if(request.text && CaseThree.test(request.text)) {
	
	var response = '';
	
	client.connect();
	client.query('SELECT * FROM TurnipPrices;', (err, sqlres) => {
	  if(err) {
		console.log(err);
		console.log(sqlres);
	  }
	  for(let row of sqlres.rows) {
	    var prices = deSQL(row);
		response += row.UserName + ': https://turnipprophet.io/?prices=' + prices.join('.') + '\n';
	  }
	  client.end();
	
	// Actually send the message back to groupme
	this.res.writeHead(200);
    postMessage(response);
    this.res.end();
	});

  // Otherwise we don't need to respond
  } else {
    //console.log("don't care");
    this.res.writeHead(200);
    this.res.end();
  }
}

function postMessage(response) {
  var botResponse, options, body, botReq;

  botResponse = response;

  options = {
    hostname: 'api.groupme.com',
    path: '/v3/bots/post',
    method: 'POST'
  };

  body = {
    "bot_id" : botID,
    "text" : botResponse
  };

  console.log('sending ' + botResponse + ' to ' + botID);

  botReq = HTTPS.request(options, function(res) {
      if(res.statusCode == 202) {
        //neat
      } else {
        console.log('rejecting bad status code ' + res.statusCode);
      }
  });

  botReq.on('error', function(err) {
    console.log('error posting message '  + JSON.stringify(err));
  });
  botReq.on('timeout', function(err) {
    console.log('timeout posting message '  + JSON.stringify(err));
  });
  botReq.end(JSON.stringify(body));
}

function deSQL(row) {
  var prices = [];
  for(var key of Object.keys(row)) {
	switch(key) {
	  case 'sunday':
        prices[0] = row[key];
		prices[1] = row[key];
		break;
	  case 'mondayam':
	    prices[2] = row[key];
		break;
	  case 'mondaypm':
	    prices[3] = row[key];
		break;
	  case 'tuesdayam':
	    prices[4] = row[key];
		break;
	  case 'tuesdaypm':
	    prices[5] = row[key];
		break;
	  case 'wednesdayam':
	    prices[6] = row[key];
		break;
	  case 'wednesdaypm':
	    prices[7] = row[key];
		break;
	  case 'thursdayam':
	    prices[8] = row[key];
		break;
	  case 'thursdaypm':
	    prices[9] = row[key];
		break;
	  case 'fridayam':
	    prices[10] = row[key];
		break;
	  case 'fridaypm':
	    prices[11] = row[key];
		break;
	  case 'saturdayam':
	    prices[12] = row[key];
		break;
	  case 'saturdaypm':
	    prices[13] = row[key];
		break;
	  default:
	    break;
	}
  }
  return prices;
}

exports.respond = respond;