var HTTPS = require('https');
//var cool = require('cool-ascii-faces');
const { Client } = require('pg');
var moment = require('moment-timezone');

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
  var botRegex = /^\d+$/;

  // If matches format number 1
  if(request.text && botRegex.test(request.text)) {
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

	response = request.sender_id + ' said ' + request.text;
	// Actually send the message back to groupme
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


exports.respond = respond;