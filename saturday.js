var time = new Date(Date.now())
if(time.getDay() != 0) {
	return;
}

const { Pool } = require('pg');
var Predictor = require('./predictions.js');

var botID = process.env.BOT_ID;

// Add database connection logic
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {rejectUnauthorized: false},
});

pool.query('SELECT * FROM TurnipPrices;', (err, sqlres) => {

  pool.query('UPDATE TurnipPrices SET Sunday=null, MondayAM=null, MondayPM=null, TuesdayAM=null, TuesdayPM=null, \
	WednesdayAM=null, WednesdayPM=null, ThursdayAM=null, ThursdayPM=null, FridayAM=null, \
	FridayPM=null, SaturdayAM=null, SaturdayPM=null, Pattern=null;', (err, sqlres) => {});

  for(let row of sqlres.rows) {
	var prices = deSQL(row);
	var prediction = new Predictor(prices,false);
	var possibilities = (prediction.analyze_possibilities())[1];
	
	if(possibilities.category_total_probability == 1) {
		pool.query('UPDATE TurnipPrices SET Pattern=' + possibilities.pattern_number + 'WHERE UserName=\'' + row.name + '\';', (err, sqlres2) => {});
	}
  }
});

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