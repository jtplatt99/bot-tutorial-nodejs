var HTTPS = require('https');
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
  var CaseOne = /^\d+$/i;			// Case 1: Just a number from a user
  var CaseTwo = /^\/tb max$/i;		// Case 2: Request maximum prices
  var CaseThree = /^\/tb link$/i;	// Case 3: Request links for prices
  var CaseFour = /^\d+ \w{2}$/i;	// Case 4: Enter for other users
  var CaseFive = /^\/tb reset$/i;	// Case 5: Reset
  var CaseSix = /^\/tb reset all$/i;// Case 6: Reset all
  var CaseHelp = /^\/tb help$/i;	// Case Help: Show help message

  // If we input a new value
  if(request.text && CaseOne.test(request.text)) {
	// This is where we add our additional logic
	var time = moment(request.created_at*1000).tz("UTC").tz("America/New_York");
	var dayOfWeek = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
	var day = dayOfWeek[time.day()];
	if(day != 'Sunday') {
	  if(time.hour() < 12) {
		day += 'AM';
	  } else {
		day += 'PM';
	  }
	}

	console.log("Update " + day + " price to " + request.text + " requested from " + request.name);

	pool.query('SELECT UserName FROM TurnipPrices WHERE UserName=\'' + request.name + '\';', (err, sqlres) => {
	  if(!!sqlres.rows.length) { // Execute if this user exists
	    pool.query('UPDATE TurnipPrices SET ' + day + '=' + request.text + 'WHERE UserName=\'' + request.name + '\';', (err, sqlres2) => {});
	  } else {				// Create new row if user doesn't exist
	    pool.query('INSERT INTO TurnipPrices (UserName, ' + day + ') \
	      VALUES (\'' + request.name + '\', ' + request.text + ');', (err, sqlres2) => {});
	  }
	});

	this.res.writeHead(200);
    this.res.end();
  
    // If we request the town with the max
  } else if(request.text && CaseTwo.test(request.text)) {
	var time = moment(request.created_at*1000).tz("UTC").tz("America/New_York");
	var day = time.day()*2;
	if(time.hour() >= 12) {day += 1};
	var dayString = ['Sunday','Sunday','MondayAM','MondayPM','TuesdayAM','TuesdayPM','WednesdayAM','WednesdayPM','ThursdayAM','ThursdayPM','FridayAM','FridayPM','SaturdayAM','SaturdayPM']
	
	var highestGuaranteedMinimum = ['',0,''];
	var highestMaximum = ['',0,''];
	
	pool.query('SELECT * FROM TurnipPrices;', (err, sqlres) => {

	  for(let row of sqlres.rows) {
	    var prices = deSQL(row);
		var prediction = new Predictor(prices,false);
		var possibilities = (prediction.analyze_possibilities())[0];
		if(possibilities.weekGuaranteedMinimum > highestGuaranteedMinimum[1]) {
		  highestGuaranteedMinimum = [row.username,possibilities.weekGuaranteedMinimum];
		}
		if(possibilities.weekMax > highestMaximum[1]) {
		  var minDay = possibilities.prices.findIndex((element,index) => element.max == possibilities.weekMax && index >= day);
		  highestMaximum = [row.username,possibilities.weekMax,dayString[minDay]];
		}
	  }
  
  	  var response = highestGuaranteedMinimum[0] + ' has the highest guaranteed minimum of ' + highestGuaranteedMinimum[1] + '.\n' +
			         highestMaximum[0] + ' has the highest overall maximum of ' + highestMaximum[1] + ' as soon as ' + highestMaximum[2] + '.';
	  // Actually send the message back to groupme
	  this.res.writeHead(200);
      postMessage(response);
      this.res.end();
	});
	
	// If we request the link
  } else if(request.text && CaseThree.test(request.text)) {
	  this.res.writeHead(200);
      postMessage("http://turnip.jonathantplatt.com/");
      this.res.end();

	// If we enter a price for a user
  } else if(request.text && CaseFour.test(request.text)) {
	// This is where we add our additional logic
	var price = (request.text.split(' '))[0];
	var user = (request.text.split(' '))[1];
	switch(user) {
		case 'JP': user = 'Jonathan Platt'; break;
		case 'CP': user = 'Chris Platt'; break;
		case 'SP': user = 'Stephen Platt'; break;
		case 'KP': user = 'Kim Platt'; break;
		case 'KK': user = 'Kim Kendra'; break;
		case 'DS': user = 'Danielle Stice'; break;
		default: this.res.writeHead(200); postMessage('Unknown initials: ' + user); this.res.end(); return;
	}
	
	var time = moment(request.created_at*1000).tz("UTC").tz("America/New_York");
	var dayOfWeek = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
	var day = dayOfWeek[time.day()];
	if(day != 'Sunday') {
	  if(time.hour() < 12) {
		day += 'AM';
	  } else {
		day += 'PM';
	  }
	}

	console.log("Update " + day + " price to " + request.text + " for " + user + " requested from " + request.name);

	pool.query('SELECT UserName FROM TurnipPrices WHERE UserName=\'' + user + '\';', (err, sqlres) => {
	  console.log(sqlres.rows);
	  if(!!sqlres.rows.length) { // Execute if this user exists
	    pool.query('UPDATE TurnipPrices SET ' + day + '=' + request.text + 'WHERE UserName=\'' + user + '\';', (err, sqlres2) => {});
	  } else {				// Create new row if user doesn't exist
	    pool.query('INSERT INTO TurnipPrices (UserName, ' + day + ') \
	      VALUES (\'' + user + '\', ' + request.text.match(/\d+/)[0] + ');', (err, sqlres2) => {});
	  }
	});

	this.res.writeHead(200);
    this.res.end();

	// Reset records excluding sunday
  } else if(request.text && CaseFive.test(request.text)) {
	pool.query('UPDATE TurnipPrices SET MondayAM=null, MondayPM=null, TuesdayAM=null, TuesdayPM=null, \
		WednesdayAM=null, WednesdayPM=null, ThursdayAM=null, ThursdayPM=null, \
		FridayAM=null, FridayPM=null, SaturdayAM=null, SaturdayPM=null;', (err, sqlres) => {});

	this.res.writeHead(200);
	postMessage('All records, except for Sunday, reset');
    this.res.end();

	// Reset all records
  } else if(request.text && CaseSix.test(request.text)) {
	pool.query('DELETE FROM TurnipPrices', (err, sqlres) => {});

	this.res.writeHead(200);
	postMessage('All records reset');
    this.res.end();

	// Display help
  } else if(request.text && CaseHelp.test(request.text)) {
	response = 'Turnip Bot records turnip prices you send into GroupMe! Simply enter your current price as an integer and it will be stored. Options include:\n\
XX - save turnip price XX for current time\n\
XX II - save turnip price XX for user with initials II\n\
/tb help - show this help dialog\n\
/tb max - show user with highest prices\n\
/tb link - show link to current prices';

	this.res.writeHead(200);
	postMessage(response);
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

function tabulator() {
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
	  
	  response += '<th><a href="https://turnipprophet.io/?prices=' + prices.slice(1).join('.');
	  if(row.pattern != null) {
	    response += '&pattern=' + row.pattern;
	  }
	  response += '">' + row.username + '</a></th>';
	  
	  for(i = 1; i < 14; i++) {
		if(prices[i] != null) {
		  response += '<th>' + prices[i] + '</th>';
		}
		else {
		  response += '<th>' + possibilities.prices[i].min + '..' + possibilities.prices[i].max + '</th>';
		}
	  }
	  response += '<th>' + possibilities.weekGuaranteedMinimum + '</th><th>' + possibilities.weekMax + '</th>';
	  response += '</tr>';
  }
  response += '</tbody></table></body></html>';
  
  this.res.writeHead(200);
  this.res.end(response);
  });
}

exports.respond = respond;
exports.tabulator = tabulator;