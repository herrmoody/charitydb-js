////////////////////////
//* Global Variables *//
////////////////////////

var fs = require("fs");
var sqlite3 = require("sqlite3").verbose();
var express = require("express");
var file = "charitydb.db";

/////////////////
//* Functions *//
/////////////////

//* Validation Functions *//

//This function checks to make sure a name
//looks like a valid name
function validateName(name) {
    if (name.match(/^[A-Z][A-Za-z]+([ \-][A-Za-z]+)*$/) === null) {
	return false;
    } else {
	return true;
    }
}

//This function checks to make sure that a date
//is valid with an earlies possible date
//provided as a second parameter
function validateDate(date_string, early_date) {

    if (date_string == "") {
        //If it's empty it's invalid
	return false;
    } else {
	var date_parts = date_string.split("/");
	var today = new Date();
	if (parseInt(date_parts[2]) < 100) {
	    if (parseInt(date_parts[2]) <= (parseInt(today.getFullYear() - 2000))) {
		date_parts[2] = parseInt(date_parts[2]) + 2000;
	    } else {
		date_parts[2] = parseInt(date_parts[2]) + 1900;
	    }
	} else {
	    date_parts[2] = parseInt(date_parts[2]);
	}
	var date_to_test = date(date_parts[2], parseInt(date_parts[0]), parseInt(date_parts[1]));

	if ((date_to_test < early_date) || (date_to_test > today)) {
	    return false;
	} else {
	    return date_to_test;
	}
    }
}

//This function validates a phone number
function validatedPhone(phone_string) {

    //Check to make sure the 
    if (phone_string == "") {
	return false;
    } else {
	//First check for any extension
	//We'll assume it's the only "x"
	if (phone_string.match(/x\d+/)) {
	    //If there's an extension, put the main
	    //part of the number back in phone string
	    //and the extension in its own variable
	    var phone_parts = phone_string.split("x");
	    phone_string = phone_parts[0];
	    var extension = phone_parts[1];
	}
	//Strip out all non-numeric characters from the
	//phone string
	phone_string = phone_string.replace(/\D/g,'');

	//Check to see if a leading "1" was added and strip 
	//it if it was
	if (phone_string.length == 11) {
	    if (phone_string.substring(0,1) == "1") {
		phone_string = phone_string.substring(1,);
	    }
	}

	//Check to see if no area code was provided and put
	//in 219 if none was
	if (phone_string.length == 7) {
	    phone_string = "219" + phone_string;
	}

	//At this point the phone number should be 10
	//characters long.  If it's not, it's invalid
	if (phone_string.length != 10) {
	    return false;
	}

	//Check the extension to make sure there's
	//a number there.
	if (extension) {
	    extension = extension.replace(/\D/g,'');
	    if (extension.length > 0) {
		phone_string += "x" + extension;
	    }
	}

	return phone_string;
    }
}

//* Date for Family ID *//

Date.prototype.compactDate = function() {
    var year = this.getFullYear();
    var month = this.getMonth();
    var day = this.getDate();
    var compacted = year.toString();
    if (month < 10) {
	compacted += "0";
    }
    compacted += month.toString();  
    if (day < 10) {
	compacted += "0";
    }
    compacted += day.toString();
    return compacted;
}

//* Date String for SQLite *//

Date.prototype.sqliteTimestring = function() {
    var year = this.getFullYear();
    var month = this.getMonth();
    var day = this.getDate();
    var timeString = year.toString() + "-";
    if (month < 10) {
	timeString += "0";
    }
    timeString += month.toString() + "-";

    if (day < 10) {
	timeString += "0";
    }
    timeString += day.toString();
    return timeString;
}

//* Error Processing *//

//This is a generic callback function that takes
//any error and prints it out to the console
var error = function (error, return_value) {
    if (error) {
	console.log(error);
	return;
    }
}

//* Database Check/Creation *//

function checkForDatabase() {
  
    //Check if the file already exists
    var exists = fs.existsSync(file);
  
    //If the database doesn't exist yet, we
    //Need to open a file with its name
    //which will create a new file
  
    if (!exists) {
	var db = new sqlite3.Database(file,error);
	
	//Next we open a serialized connection to the database
	//(alternative would be a parallel connection -- can run
	//multiple queries at the same time -- which will really 
	//never make sense for this particular application)
    
	db.serialize(function() {
      
	    //Next we will create the core tables
      
	    //Families Table
	    db.run("CREATE TABLE families (family_id TEXT PRIMARY KEY NOT NULL COLLATE NOCASE, address TEXT, zip TEXT, initial_contact_date INTEGER);",error);
      
	    //People Table
	    db.run("CREATE TABLE people (person_id INTEGER PRIMARY KEY AUTOINCREMENT, family_id TEXT NOT NULL COLLATE NOCASE, first_name TEXT NOT NULL COLLATE NOCASE, last_name TEXT NOT NULL COLLATE NOCASE, birth_date INTEGER, notes TEXT, head INTEGER DEFAULT 0, FOREIGN KEY(family_id) REFERENCES families (family_id));",error);
      
	    //Contact Types Table
	    db.run("CREATE TABLE contact_types (contact_type_id INTEGER PRIMARY KEY AUTOINCREMENT, contact_type_desc TEXT NOT NULL);",error);
      
	    //Contact Table
	    db.run("CREATE TABLE contact (contact_id INTEGER PRIMARY KEY AUTOINCREMENT, contact_type_id INTEGER NOT NULL, date INTEGER NOT NULL, family_id TEXT NOT NULL, person_id INTEGER, contact_note TEXT, FOREIGN KEY (contact_type_id) REFERENCES contact_types (contact_type_id), FOREIGN KEY (family_id) REFERENCES families (family_id), FOREIGN KEY (person_id) REFERENCES people (person_id));",error);
      
	    //Agencies Table
	    db.run("CREATE TABLE agencies (agency_id INTEGER PRIMARY KEY AUTOINCREMENT, agency_name TEXT NOT NULL);",error);
      
	    //Services Table
	    db.run("CREATE TABLE services (service_id INTEGER PRIMARY KEY AUTOINCREMENT, service_desc TEXT NOT NULL);",error);
      
	    //Assistance Table
	    db.run("CREATE TABLE assistance (assistance_id INTEGER PRIMARY KEY AUTOINCREMENT, assistance_date INTEGER NOT NULL, family_id TEXT NOT NULL COLLATE NOCASE, service_id INTEGER NOT NULL, agency_id INTEGER, FOREIGN KEY (family_id) REFERENCES families (family_id), FOREIGN KEY (service_id) REFERENCES services (service_id), FOREIGN KEY (agency_id) REFERENCES agencies (agency_id));",error);
       
	    //Phone Types Table
	    db.run("CREATE TABLE phone_types (phone_type_id INTEGER PRIMARY KEY AUTOINCREMENT, phone_type_desc TEXT COLLATE NOCASE);",error);
      
	    //Phone Numbers Table
	    db.run("CREATE TABLE phone_numbers (phone_number_id INTEGER PRIMARY KEY AUTOINCREMENT, phone_number TEXT NOT NULL, phone_extension TEXT, phone_type_id INTEGER NOT NULL DEFAULT 1, primary_phone INTEGER NOT NULL DEFAULT 0, family_id TEXT NOT NULL COLLATE NOCASE, phone_note TEXT, FOREIGN KEY (family_id) REFERENCES families (family_id), FOREIGN KEY (phone_type_id) REFERENCES phone_types (phone_type_id));",error);
      
	    //Zip Codes Table
	    db.run("CREATE TABLE zip_codes (zip_code INTEGER PRIMARY KEY, city TEXT NOT NULL, state TEXT NOT NULL);",error);
      
	    //Finally, put some basic values into some of the tables

	    //Values for Contact Types
	    var stmt = db.prepare("INSERT INTO contact_types (contact_type_desc) VALUES (?);");
	    stmt.run("Family called Love",error);
	    stmt.run("Love called Family",error);
	    stmt.run("Love connected with Family",error);
	    stmt.run("Love contacted Family",error);
	    stmt.finalize();
      
	    //Values for Services
	    var stmt = db.prepare("INSERT INTO services (service_desc) VALUES (?);");
	    stmt.run("Thanksgiving Help",error);
	    stmt.run("Christmas Help",error);
	    stmt.run("Easter Help",error);
	    stmt.run("Furniture Ministry Help",error);
	    stmt.run("Food Pantry Help",error);
	    stmt.run("Other Help",error);
	    stmt.finalize();
      
	    //Values for Phone Types
	    var stmt = db.prepare("INSERT INTO phone_types (phone_type_desc) VALUES (?);");
	    stmt.run("Home",error);
	    stmt.run("Work",error);
	    stmt.run("Cell",error);
	    stmt.finalize();
      
	    //Values for Zip Codes
	    var stmt = db.prepare("INSERT INTO zip_codes (zip_code, city, state) VALUES (?,?,?);");
	    stmt.run("46327","Hammond","Indiana",error);
	    stmt.run("46320","Hammond","Indiana",error);
	    stmt.run("46324","Hammond","Indiana",error);
	    stmt.run("46323","Hammond","Indiana",error);
	    stmt.run("46321","Munster","Indiana",error);
	    stmt.run("46319","Griffith","Indiana",error);
	    stmt.run("46322","Highland","Indiana",error);
	    stmt.finalize();
      
	    //Close Connection
	    db.close();
	});
    }
}

//* getResults Function - Retrieves the results of a SELECT query *//

//It takes the query it will execute, the object to which it adds an 
//object full of array rows, a function array that defines a sequence 
//of callbacks and their queries, and the next function in the chain
function getResults(query_array, function_array, object_set, callback) {

    //Establish a connection to the database
    var db = new sqlite3.Database(file,error);
  
    //Pop the variables off of the query_array and use them
    var query_stuff = query_array.pop();
    var set_name = query_stuff[0];
    var query_text = query_stuff[1]
  
    //Establish a serial database connection
    db.serialize(function() {
    
	//Prepare a SELECT SQL query
	db.all(query_text, function(error, rows) {
	    //If something is returned add it to the object
	    if (rows.length > 0) {
		object_set[set_name] = rows;
        
		//If the result is empty save the set name with an empty indicator
	    } else {
		object_set[set_name] = "empty";
	    }
	    //Check the length of the function array.  If it's 0 we are
	    //on the last item and there are no more callbacks, so we only
	    //send the object set
	    if (function_array.length == 0) {
		callback(object_set);
        
		//If the length of the function array is more than zero, pop
		//the next function off and pass the object set, the function
		//array, and an eval of the next function to the next callback
	    } else {
		next_function = function_array.pop();
		callback(query_array, function_array, object_set, eval(next_function));
	    }
	});
    });
    //Close the database connection and get out
    db.close();
    return;
}

//* Insert/Update data function - adds/changes data to/in the database *//

//Inserts and Updates both just get a query passed which gets executed
//As long as the operation is successful, there should be now follow-up
//required.  This might change if there was a situation where knowing what
//the id of a row just added was, but at this point I do not think that
//capability is needed in this application

function insertUpdate(query_array, function_array, object_set, callback) {

    //Establish a connection to the database
    var db = new sqlite3.Database(file,error);    

    //Pop the next insert query off of the query array
    //and put it in a variable
    var query_text = query_array.pop();

    //Establish a serial database connection
    db.serialize(function() {
	//Run the insert query
	db.run(query_text,error);
	
	//Check the length of the function array.  If it's 0 we are
	//on the last item and there are no more callbacks, so we only
	//send the object set
	if (function_array.length == 0) {
            callback(object_set);
        
	    //If the length of the function array is more than zero, pop
	    //the next function off and pass the object set, the function
	    //array, and an eval of the next function to the next callback
	} else {
            next_function = function_array.pop();
            callback(query_array, function_array, object_set, eval(next_function));
	}      
    });
    //Close Connection
    db.close();
    return;
}

////////////////////
//* Main Program *//
////////////////////

//Make sure that we have a database
checkForDatabase();

//Setup a global finishRequest variable.
//This variable is set by the page routine
//but it needs to be global so it can be called
//at the end of a sequence of functions
finishRequest = "";

//Setup Express
var app = express();

//Set the views directory
app.set('views', __dirname + '/views');

//Indicate we are using the jade template engine
app.set('view engine', 'jade');

//Log requests to the console
app.use(express.logger('dev'));

//This establishes the root web directory
app.use(express.static(__dirname + '/public'));

//Turn on the bodyParser middleware to handle post requests
app.use(express.urlencoded());
app.use(express.json());

//* Default Web Page *//

//This is the function called when someone asks for the
//root web page ("/")
app.get('/', function (req, res) {

    //This establishes a function that sends a the page
    //to the user.  It takes an object that establishes
    //variables that are available in the template
    finishRequest = function(object_collection) {
	res.render('index', object_collection);
    }
  
    //To make sure that SQL queries are completed before
    //the page is generated, each SQL lookup function needs to
    //call then next as a callback with the final function calling
    //the finishRequest function sending a complete object set
  
    //This is the object set.  Each query adds the array it creates to
    //this set.
    var object_set = {};
  
    //This array shows the functions being executed in reverse order.  
    //finishRequest should always be the first function listed here.  
    //Any other needed functions should, be added to the end of this list.
    //The last function is disregarded as it as the one declared further down
    //the page, but including it hear makes it easier to make sure that this
    //list matches up with the query array list
    var function_array = ["finishRequest","getResults"];
  
    //This is a two-dimensional array with the names of the sets and the 
    //queries that retrieve those values.  The count of this array should
    //always be one less than that of the function array.
    //If the query is being sent to an insert or update function an 
    //object containing update values can be a third element of the
    //second dimension of this array.
    var query_array = [
	["cities","SELECT DISTINCT city FROM zip_codes ORDER BY city ASC"],
    ];
  
    //This isn't strictly necessary at the start, but it models the way
    //things function throughout.  The last item in the array is popped
    //off an put into this variable, which is evaluated as the next
    //callback function.  In this case we are double-popping to get past
    //the function which is already declared below.
    function_array.pop();
    var next_function = function_array.pop();
    
    //This is the first SQL function and the items are sent to it
    //to start the callback chain that ends with finishRequest
    getResults(query_array, function_array, object_set, eval(next_function));
  
});

//* Add Popup Window *//

//The get page is loaded when someone
//starts the process of adding a new record
app.get('/add', function (req, res) {
    finishRequest = function(object_collection) {
	res.render('add', object_collection);
    }
    var object_set = {};
    var function_array = ["finishRequest","getResults","getResults"];
    var query_array = [
	["zip_codes","SELECT zip_code, city, state FROM zip_codes ORDER BY zip_code ASC"],
	["phone_types","SELECT phone_type_id, phone_type_desc FROM phone_types ORDER BY phone_type_id ASC"]
    ];
    function_array.pop();
    var next_function = function_array.pop();
    getResults(query_array, function_array, object_set, eval(next_function));
});

//Post page processes entered data from the get
//page and either moves the user forward or forces
//them to correct data
app.post('/add', function (req, res) {
    finishRequest = function(object_collection) {
	res.render('add', object_collection);
    }

    //Check fields for valid content

    var dataset = {};
    ['invalid_fields'] = [];

    if (validateName(req.body.first_name)) {
	dataset['first_name'] = req.body.first_name;
    } else {
	dataset['invalid_fields'].push("first_name");
    }

    if (validateName(req.body.last_name)) {
	dataset['last_name'] = req.body.last_name;
    } else {
	dataset['invalid_fields'].push("last_name");
    }

    //Check to make sure birthday is a valid date

    //It's unlikely anyone would be entered in to 
    //this database who's over 100
    var century = parseInt(today.getFullYear()) - 100; 
    var early_date = date(century, 1, 1);
    var birthday = validateDate(req.body.birthday, early_date);

    if (birthday) {
	dataset['birthday'] = birthday;
    } else {
	dataset['invalid_fields'].push("birthday");
    }

    //Check phone number

    var phone_array = validatePhone(req.body.phone);
    if (phone_array[0]) {
	dataset['phone'] = phone_array[0];
	if (phone_array[1]) {
	    dataset['phone_extension'] = phone_array[1];
	}
    } else {
	dataset['invalid_fields'] = "phone";
    }

    //Check phone number type
    //There should be no way this field is empty
    //but check it just the same
    if (req.body.phone_type) {
	dataset['phone_type'] = req.body.phone_type;
    } else {
	dataset['invalid_fields'] = "phone_type";
    }

    //Check street address - just make sure it's not empty
    if (req.body.address == "") {
	dataset['invalid_fields'].push("address");
    } else {
	dataset['address'] = req.body.address;
    }

    //Check to make sure zip code isn't empty
    if (req.body.zip == "") {
	dataset['invalid_fields'].push("zip");
    } else {
	dataset['zip'] = req.body.zip;
    }

    //Check to make sure initial contact date is valid

    //A valid initial contact date shouldn't be over
    //20 years ago
    var early_year = parseInt(today.getFullYear()) - 20; 
    var early_date = date(early_year, 1, 1);
    var initial_contact_date = validateDate(req.body.initial_contact_date, early_date);

    if (initial_contact_date) {
	dataset['initial_contact_date'] = initial_contact_date;
    } else {
	dataset['invalid_fields'].push("initial_contact_date");
    }

    //If the length of invalid fields is 0, add records to the
    //database.  Otherwise ask the user to correct problems
    if (dataset['invalid_fields'].length == 0) {
	//Create a family id
	//This is being created using the last name
	//and adding the initial contact date
	dataset['family_id'] = dataset['last_name'].toUpperCase();
	dataset['family_id'] = dataset['family_id'].replace(/[^A-Z]/g,"");
	dataset['family_id'] = dataset['initial_contact_date'].compactDate;

	var family_insert = "INSERT INTO families (family_id, address, zip, initial_contact_date) VALUES ('" + dataset['family_id'] + "', '" + dataset['address'] + "', '" + dataset['zip'] + "', julianday('" + dataset['initial_contact_date'].sqliteTimestring + "'));";

	var person_insert = "INSERT INTO people (family_id, first_name, last_name, birth_date, head) VALUES ('" + dataset['family_id'] + "', '" + dataset['first_name'] + "', '" + dataset['last_name'] + "', julianday('" + dataset['birth_date'].sqliteTimestring + "'), '1');";

	//If there is a phone extension we need to use a query
	//that adds the extension, otherwise we'll use a query
	//that doesn't add an extension
	if (dataset['phone_extension']) {
	    var phone_insert = "INSERT INTO phone_numbers (phone_number, phone_extension, phone_type_id, primary_phone, family_id) VALUES ('" + dataset['phone_number'] + "', '" + dataset['phone_extension'] + "', '" + dataset['phone_type'] + "', '1', '" + dataset['family_id'] + "');";
	} else {
	    var phone_insert = "INSERT INTO phone_numbers (phone_number, phone_type_id, primary_phone, family_id) VALUES ('" + dataset['phone_number'] + "', '" + dataset['phone_type'] + "', '1', '" + dataset['family_id'] + "');";
	}
	
	//Create an object set that just has family_id in it.  It shouldn't
	//be necessary to send too much data to all of the insert queries
	//but the family id will be needed at the end to go onto the 
	//next step
	var object_set = {};
	object_set['family_id'] = dataset['family_id'];

	var function_array = ["finishRequest","insertUpdate","insertUpdate","insertUpdate"];
	var query_array = [ phone_insert, person_insert, family_insert ];
	function_array.pop();
	var next_function = function_array.pop();
	insertData(query_array, function_array, dataset, eval(next_function));

    } else {

	//If there was a validation error, send these results back to the
	//add page to have the user correct omissions and problems
	var function_array = ["finishRequest","getResults","getResults"];
	var query_array = [
	    ["zip_codes","SELECT zip_code, city, state FROM zip_codes ORDER BY zip_code ASC"],
	    ["phone_types","SELECT phone_type_id, phone_type_desc FROM phone_types ORDER BY phone_type_id ASC"]
	];
	function_array.pop();
	var next_function = function_array.pop();
	getResults(query_array, function_array, dataset, eval(next_function));
    }
});

//* Add/Edit Page *//

//The get page is loaded when someone is redirected
//to this page, typically from an add popup
app.get('/addedit', function(req, res) {
    finishRequest = function(object_collection) {
	res.render('addedit', object_collection);
    }
    var familyid = req.query.familyid;
});

//The post page is loaded when someone submits data
//to be processed from this page
app.post('/addedit', function (req, res) {
    finishRequest = function(object_collection) {
	res.render('addedit', object_collection);
    }
    var stuff = {};
    stuff['first_name'] = req.body.first_name;
    stuff['last_name'] = "Squiddy";
    finishRequest(stuff);
});

//* View/Edit Page *//

//The get version of this page handles search queries
app.get('/viewedit', function (req, res) {
    finishRequest = function(object_collection) {
	res.render('viewedit', object_collection);
    }
    finishRequest();
});

//The post version of this page handles updates
app.post('/viewedit', function (req, res) {
    finishRequest = function(object_collection) {
	res.render('viewedit', object_collection);
    }
    finishRequest();
});

//* Port Listen Declaration *//

app.listen(3000);