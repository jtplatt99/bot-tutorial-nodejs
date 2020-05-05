var HTTPS = require('https');
//var cool = require('cool-ascii-faces');
const { Pool } = require('pg');
var moment = require('moment-timezone');
var Predictor = require('./predictions.js');

var botID = process.env.BOT_ID;

// Add database connection logic
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {rejectUnauthorized: false},
});

function respond() {
  // Process our recieved message
  var request = JSON.parse(this.req.chunks[0]);
  
  // Regular expressions matching
  var CaseOne = /^\d+$/;			// Case 1: Just a number from a user
  var CaseTwo = /^\/tb max$/;		// Case 2: Request maximum prices
  var CaseThree = /^\/tb links$/;	// Case 3: Request links for prices
  var CaseFour = /^d+ K$/;			// Case 4: Enter for Kim Kendra

  // If we input a new value
  if(request.text && CaseOne.test(request.text)) {
	// This is where we add our additional logic
	//console.log(JSON.stringify(request));	
	var time = moment(request.created_at).tz("UTC").tz("America/New_York");
	var dayOfWeek = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
	var day = dayOfWeek[time.day()];
	if(day != 'Sunday') {
	  if(time.hour() < 12) {
		day += 'AM';
	  } else {
		day += 'PM';
	  }
	}

	pool.query('SELECT UserName FROM TurnipPrices WHERE UserID=' + request.sender_id + ';', (err, sqlres) => {
	  console.log(sqlres.rows);
	  if(!!sqlres.rows.length) { // Execute if this user exists
	    pool.query('UPDATE TurnipPrices SET ' + day + '=' + request.text + 'WHERE UserID=' + request.sender_id + ';', (err, sqlres2) => {});
	  } else {				// Create new row if user doesn't exist
	    pool.query('INSERT INTO TurnipPrices (UserID, UserName, ' + day + ') \
	      VALUES (' + request.sender_id + ', \'' + request.name + '\', ' + request.text + ');', (err, sqlres2) => {});
	  }
	  //console.log(sqlres);
	});

	this.res.writeHead(200);
    this.res.end();
  
    // If we request the town with the max
  } else if(request.text && CaseTwo.test(request.text)) {
	var highestGuaranteedMinimum = ['',0];
	var highestMaximum = ['',0];
	
	pool.query('SELECT * FROM TurnipPrices;', (err, sqlres) => {

	  for(let row of sqlres.rows) {
	    var prices = deSQL(row);
		var prediction = new Predictor(prices,false);
		var possibilities = (prediction.analyze_possibilities())[0];
		if(possibilities.weekGuaranteedMinimum > highestGuaranteedMinimum[1]) {
		  highestGuaranteedMinimum = [row.username,possibilities.weekGuaranteedMinimum];
		}
		if(possibilities.weekMax > highestMaximum[1]) {
		  highestMaximum = [row.username,possibilities.weekMax];
		}
	  }
  
  	  var response = highestGuaranteedMinimum[0] + ' has the highest guaranteed minimum of ' + highestGuaranteedMinimum[1] + '.\n' +
			         highestMaximum[0] + ' has the highest overall maximum of ' + highestMaximum[1] + '.';
	  // Actually send the message back to groupme
	  this.res.writeHead(200);
      postMessage(response);
      this.res.end();
	});
	
	// If we request links
  } else if(request.text && CaseThree.test(request.text)) {
	
	var response = '';
	
	pool.query('SELECT * FROM TurnipPrices;', (err, sqlres) => {
	  if(err) {
		console.log(err);
		console.log(sqlres);
		console.log(process.env.DATABASE_URL);
	  }
	  for(let row of sqlres.rows) {
	    var prices = deSQL(row);
		response += row.username + ': https://turnipprophet.io/?prices=' + prices.slice(1).join('.') + '\n';
	  }
	
	  // Actually send the message back to groupme
	  this.res.writeHead(200);
      postMessage(response);
      this.res.end();
	});

	// If we enter a price for Kim Kendra
  } else if(request.text && CaseFour.test(request.text)) {
	// This is where we add our additional logic
	//console.log(JSON.stringify(request));	
	var time = moment(request.created_at).tz("UTC").tz("America/New_York");
	var dayOfWeek = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
	var day = dayOfWeek[time.day()];
	if(day != 'Sunday') {
	  if(time.hour() < 12) {
		day += 'AM';
	  } else {
		day += 'PM';
	  }
	}

	pool.query('SELECT UserName FROM TurnipPrices WHERE UserName=\'Kim Kendra\';', (err, sqlres) => {
	  console.log(sqlres.rows);
	  if(!!sqlres.rows.length) { // Execute if this user exists
	    pool.query('UPDATE TurnipPrices SET ' + day + '=' + request.text + 'WHERE UserName=\'Kim Kendra\';', (err, sqlres2) => {});
	  } else {				// Create new row if user doesn't exist
	    pool.query('INSERT INTO TurnipPrices (UserID, UserName, ' + day + ') \
	      VALUES (934, \'Kim Kendra\', ' + request.text + ');', (err, sqlres2) => {});
	  }
	});

	this.res.writeHead(200);
    this.res.end();

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
	if(row[key] == null) {
		continue;
	}
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

function tabulater() {
  var response = '<!doctype html><html><body><table border="1"><thead><tr><th rowspan="2">User</th><th rowspan="2">Sunday</th><th colspan="2">Monday</th><th colspan="2">Tuesday</th><th colspan="2">Wednesday</th><th colspan="2">Thursday</th><th colspan="2">Friday</th><th colspan="2">Saturday</th><th rowspan="2">Guaranteed Min</th><th rowspan="2">Week Max</th></tr><tr><th>AM</th><th>PM</th><th>AM</th><th>PM</th><th>AM</th><th>PM</th><th>AM</th><th>PM</th><th>AM</th><th>PM</th><th>AM</th><th>PM</th></tr></thead><tbody>';

  pool.query('SELECT * FROM TurnipPrices;', (err, sqlres) => {
    if(err) {
	  console.log(err);
	  console.log(sqlres);
	  console.log(process.env.DATABASE_URL);
    }
    for(let row of sqlres.rows) {
	  response += '<tr>';
	  
	  var prices = deSQL(row);
	  var prediction = new Predictor(prices,false);
	  var possibilities = (prediction.analyze_possibilities())[0];
	  
	  response += '<th><a href="https://turnipprophet.io/?prices=' + prices.slice(1).join('.') + '">' +
	              row.username + '</a></th>';
	  for(i = 1; i < 14; i++) {
		if(prices[i] != null) {
		  response += '<th>' + prices[i] + '</th>';
		}
		else {
		  response += '<th>' + possibilities.prices[i].min + '..' + possibilities.prices[i].max + '</th>';
		}
	    response += '<th>' + possibilities.weekGuaranteedMinimum + '</th><th>' + possibilities.weekMax + '</th>';
	  }
	  response += '</tr>';
  }
  response += '</tbody></table></body></html>';
  return response;
  });
}

exports.respond = respond;
exports.tabulator = tabulator;