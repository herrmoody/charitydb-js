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

//* djb2 Hash Function *//

//This hash isn't being used for any cryptographic purposes
//and isn't intended to be particularly secure.  It's merely
//used as a safeguard on record deletion so that (for instance)
//.../deletething?id=15 won't accidentally be invoked and instead
//.../deletething?id=15&hash=429342124 needs to be invoked (with
//the hash matching on the other side, obviously) for a deletion
//to be successful.

function djb2Code(str) {
    var hash = 5381;
    for (i = 0; i < str.length; i++) {
        char = str.charCodeAt(i);
        hash = ((hash << 5) + hash) + char; /* hash * 33 + c */
    }
    return hash;
}

//* Universal Completion Function *//

//This establishes a function that sends a the page
//to the user.  It takes an object that establishes
//variables that are available in the template
function finishRequest(action, res, object_collection) {
    res.render(action, object_collection);
}

//* Date for Family ID *//

Date.prototype.compactDate = function() {
    var year = this.getFullYear();
    var month = this.getMonth()+1;
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
    var month = this.getMonth()+1;
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


//Strip unusual characters from a string
function sanitizeString(input) {
    input = input.replace(/[^A-Za-z0-9.,+\-_*!#&@:$?()' ]/gi, '');
    return input.replace(/[']/gi, '\'\''); 
}

//Calculate current age
function ageLastBirthday(birthday_string) {
    var birth_date = new Date(birthday_string);
    var current_year = today.getFullYear();
    var birth_year = birth_date.getFullYear();
    birth_date.setFullYear(current_year);
    var adjustment = (today - birth_date < 0) ? 1 : 0;
    return current_year - birth_year - adjustment;
}

//* Validation Functions *//

//A simple validation function to check that 
//a family id looks right
function validateFamilyId(family_id) {
    return family_id.match(/[A-Z]+\d{8}-\d{2}/);
}

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
        var date_to_test = new Date(date_parts[2], parseInt(date_parts[0])-1, parseInt(date_parts[1]));

        if ((date_to_test < early_date) || (date_to_test > today)) {
            return false;
        } else {
            return date_to_test;
        }
    }
}

//This function validates a phone number
function validatePhone(phone_string) {

    //Check to make sure the 
    if (phone_string == "") {
        return false;
    } else {
        //Setup an array for phone parts
        var phone_parts = [];
        
        //Strip any non-numeric or "x"
        //out of the phone number
        phone_string = phone_string.replace(/[^0-9x]/gi, '');

        //First check for any extension
        //We'll assume it's the only "x"
        if (phone_string.match(/x\d+/)) {
            //If there's an extension, put the main
            //part of the number back in phone string
            //and the extension in its own variable
            phone_parts = phone_string.split("x");
        } else {
            //Otherwise we'll just put the phone number
            //in the first element of the array
            phone_parts[0] = phone_string;
        }

        //Strip out all non-numeric characters from the
        //phone string
        phone_parts[0] = phone_parts[0].replace(/\D/g,'');

        //Check to see if a leading "1" was added and strip 
        //it if it was
        if (phone_parts[0].substring(0,1) == "1") {
            phone_parts[0] = phone_parts[0].substring(1,0);
        }

        //Check to see if no area code was provided and put
        //in 219 if none was
        if (phone_parts[0].length == 7) {
            phone_parts[0] = "219" + phone_parts[0];
        }

        //At this point the phone number should be 10
        //characters long.  If it's not, it's invalid
        if (phone_parts[0].length != 10) {
            return false;
        }

        //Check the extension to make sure there's
        //a number there.
        if (phone_parts[1]) {
            phone_parts[1] = phone_parts[1].replace(/\D/g,'');
        }

        return phone_parts;
    }
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
            db.run("CREATE TABLE people (person_id INTEGER PRIMARY KEY AUTOINCREMENT, family_id TEXT NOT NULL COLLATE NOCASE, first_name TEXT NOT NULL COLLATE NOCASE, last_name TEXT NOT NULL COLLATE NOCASE, birth_date INTEGER, gender INTEGER DEFAULT 0, notes TEXT, head INTEGER DEFAULT 0, FOREIGN KEY(family_id) REFERENCES families (family_id));",error);

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

//* checkResults Function - Takes a query and makes sure that
//the results of the query are not empty.  If the results
//are empty then it breaks the chain of events following */
function checkResults(action, res, query_array, function_array, object_set, callback) {
    //Establish a new connection to the database
    var db = new sqlite3.Database(file,error);

    //Pop the query off of the query array
    var query_text = query_array.pop();

    //Establish a serial database connection
    db.serialize(function() {

        //Prepare a SELECT SQL query
        db.all(query_text, function(error, rows) {

            //If something is returned set found = 1
            if (rows.length > 0) {
                var found = 1;

            //Else set found = 0;
            } else {
                var found = 0;
            }

            //If found is 1 move on to the next step
            if (found == 1) {
                if (function_array.length == 0) {
                    callback(action, res, object_set);

                    //If the length of the function array is more
                    //than zero, pop the next function off and pass
                    //the object set, the function array, and an eval
                    //of the next function to the next callback

                } else {
                    next_function = function_array.pop();
                    callback(action, res, query_array, function_array, object_set, eval(next_function));
                }
                //If not found, shortcircuit the entire process
            } else {
                while (function_array.length > 0) {
                    next_function = function_array.pop();
                    callback = eval(next_function);
                }
                object_set = {family_id:"invalid"};
                callback(action, res, object_set);
            }
        });
    });

    //Close the database connection and get out
    db.close();
    return;
}




//* getResults Function - Retrieves the results of a SELECT query *//

//It takes the query it will execute, the object to which it adds an 
//object full of array rows, a function array that defines a sequence 
//of callbacks and their queries, and the next function in the chain
function getResults(action, res, query_array, function_array, object_set, callback) {

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
            //send the objects that have content.  There are cases where query
            //array might still be needed so test that to see if it needs to be sent
            if (function_array.length == 0) {
                if (query_array.length > 0) {
                    callback(action, res, query_array, object_set);
                } else {
                    callback(action, res, object_set);
                }
                //If the length of the function array is more than zero, pop
                //the next function off and pass the object set, the function
                //array, and an eval of the next function to the next callback
            } else {
                next_function = function_array.pop();
                callback(action, res, query_array, function_array, object_set, eval(next_function));
            }
        });
    });
    //Close the database connection and get out
    db.close();
    return;
}

//* Insert/Update data function - adds/changes data to/in the database *//

//Insert and update operations both just accept a query which gets executed
//As long as the operation is successful, there should be no follow-up
//required.  This might change if there was a situation where knowing what
//the id of a row just added was, but at this point I do not think that
//capability is needed in this application

//This function has been designed to cycle through a series of
//insert update functions sent to it within a single serialized
//database connection to make sure that each function completes
//before the next is attempted

function insertUpdate(action, res, query_array, function_array, object_set, callback) {
    //Establish a connection to the database
    var db = new sqlite3.Database(file,error);

    //Establish a serial database connection
    db.serialize(function() {
        //We want to cycle at least once through this
        //so the current function name is set to the name
        //of this function
        var current_function_name = "insertUpdate";

        //The callback that is passed is a function, but
        //for this sequence of events we need the name
        //so we are extracting the callback name out
        var callback_name = callback.name;

        //Loop as long as the current function is called
        //insertUpdate
        while (current_function_name == "insertUpdate") {
            //Get the next query
            var query_text = query_array.pop();

            //Run the query
            db.run(query_text,error);

            //Rename the current_function_name variable
            //to the name of the callback that was sent
            //If this winds up not being insertUpdate
            //the loop is exited
            current_function_name = callback_name;

            //Put the next value in the function array
            //into the callback name variable
            callback_name = function_array.pop();
        }
        //Now that we left the loop we know that the "current_function_name"
        //is no longer the current function, so evaluate it to 
        //be the next function to be executed
        next_function = eval(current_function_name);

        //If the function array is spent and there is no value in
        //the callback_name variable, then we are finished
        //going through functions and the next function is the 
        //final callback.  Run it returning the object set
        if ((function_array.length == 0) && (callback_name == undefined)) {
            next_function(action, res, object_set);
        } else {
            //Otherwise run the next function

            //Note that the syntax used here is the opposite used elsewhere
            //(e.g. "callback(x,y,z,eval(next_function))"
            //This is pretty much because of the way the callback function
            //has to be evaluated and tested here
            next_function(action, res, query_array, function_array, object_set, eval(callback));
        }
    });
    //Close the database connection
    db.close();
    return;
}

//* Basic Delete *//
//This is a basic delete function that will run through
//all queries sent to it
function simpleDelete(action, res, query_array, object_set) {
    var newhash = djb2Code(object_set['check_result'][0]['test_field']);
    if (newhash == object_set['hash']) {
        //If the hash passed to the delete query matches the
        //newly generated hash from the check query,
        //proceed with a delete

        //Establish a connection to the database
        var db = new sqlite3.Database(file,error);

        //Establish a serial database connection
        db.serialize(function() {
            while(query_array.length > 0) {
                var query_text = query_array.pop();
                db.run(query_text[0],error);
            }
        });
        db.close();
    }
    if (action == "deletefamily") {
        res.writeHead(303, {
            'Location': '/'
        });
    } else {
        
        res.writeHead(303, {
            'Location': '/addedit?family_id=' + object_set['family_id']
        });
        res.end();
    }
}

////////////////////
//* Main Program *//
////////////////////

//Make sure that we have a database
checkForDatabase();

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
    getResults("index", res, query_array, function_array, object_set, eval(next_function));

});

//* Add Popup Window *//

//The get page is loaded when someone
//starts the process of adding a new record
app.get('/add', function (req, res) {
    var object_set = {};
    var function_array = ["finishRequest","getResults","getResults"];
    var query_array = [
        ["zip_codes","SELECT zip_code, city, state FROM zip_codes ORDER BY zip_code ASC"],
        ["phone_types","SELECT phone_type_id, phone_type_desc FROM phone_types ORDER BY phone_type_id ASC"]
    ];
    function_array.pop();
    var next_function = function_array.pop();
    getResults("add", res, query_array, function_array, object_set, eval(next_function));
});

//Post page processes entered data from the get
//page and either moves the user forward or forces
//them to correct data
app.post('/add', function (req, res) {

    //Check fields for valid content

    var dataset = {};
    dataset['invalid_fields'] = [];

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

    //Check to make sure that a gender is assigned
    if ((parseInt(req.body.gender) == 0) || (parseInt(req.body.gender) == 1)) {
        dataset['gender'] = parseInt(req.body.gender);
    } else {
        dataset['invalid_fields'].push("gender");
    }

    //Check to make sure birthday is a valid date

    //It's unlikely anyone would be entered in to 
    //this database who's over 100
    var today = new Date();
    var century = parseInt(today.getFullYear()) - 100; 
    var early_date = new Date(century, 0, 1);
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
        dataset['invalid_fields'].push("phone");
    }

    //Check phone number type
    //There should be no way this field is empty
    //but check it just the same
    if (req.body.phone_type) {
        dataset['phone_type'] = req.body.phone_type;
    } else {
        dataset['invalid_fields'].push("phone_type");
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
    var early_date = new Date(early_year, 0, 1);
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
        dataset['family_id'] += dataset['initial_contact_date'].compactDate();

        //Check to make sure that this family id combination is not already
        //taken.  If it is (a relatively remote, but possible eventuality --
        //two families named Smith sign up on the same day) a counter gets
        //incremented.  Otherwise the code ends in "-01"

        //Create a new connection
        var db = new sqlite3.Database(file, error);

        //Build a query to find similar family ids
        var query = "SELECT family_id FROM families WHERE family_id LIKE '" + dataset['family_id'] + "%';";

        db.serialize(function() {
            //Run the query
            db.all(query, function(error, rows) {

                //If there are any responses add 1 to the number
                //of results returned and append that to the family id
                if (rows.length > 0) {
                    var count = rows.length + 1;
                    if (count > 9) {
                        dataset['family_id'] += "-" + count;
                    } else {
                        dataset['family_id'] += "-0" + count;
                    }
                    //Otherwise the family id ends with "01"
                } else {
                    dataset['family_id'] += "-01";
                }
                //All of the remaining functions are placed here
                //so they do not execute until we have a family id
                //The family id creation could be a separate function that is
                //chained, but that brought its own complexity and in this
                //case this structure seems more readable and efficient

                //Create insert queries
                var family_insert = "INSERT INTO families (family_id, address, zip, initial_contact_date) VALUES ('" + dataset['family_id'] + "', '" + dataset['address'] + "', '" + dataset['zip'] + "', julianday('" + dataset['initial_contact_date'].sqliteTimestring() + "'));";

                var person_insert = "INSERT INTO people (family_id, first_name, last_name, birth_date, gender, head) VALUES ('" + dataset['family_id'] + "', '" + dataset['first_name'] + "', '" + dataset['last_name'] + "', julianday('" + dataset['birthday'].sqliteTimestring() + "'), '" + dataset['gender'] + "', '1');";

                //If there is a phone extension we need to use a query
                //that adds the extension, otherwise we'll use a query
                //that doesn't add an extension
                if (dataset['phone_extension']) {
                    var phone_insert = "INSERT INTO phone_numbers (phone_number, phone_extension, phone_type_id, primary_phone, family_id) VALUES ('" + dataset['phone'] + "', '" + dataset['phone_extension'] + "', '" + dataset['phone_type'] + "', '1', '" + dataset['family_id'] + "');";
                } else {
                    var phone_insert = "INSERT INTO phone_numbers (phone_number, phone_type_id, primary_phone, family_id) VALUES ('" + dataset['phone'] + "', '" + dataset['phone_type'] + "', '1', '" + dataset['family_id'] + "');";
                }

                //Create an object set that just has family_id  and an empty zip code
                //list in it.  The zip code list needs to be there to prevent
                //errors when the family id is sent back to the add popup window.
                //It shouldn't be necessary to send too much data to all of the 
                //insert queries but the family id will be needed at the end to go 
                //onto the next step
                var object_set = {};
                object_set['zip_codes'] = [];
                object_set['zip_codes'].push(["empty","empty","empty"]);
                object_set['phone_types'] = [];
                object_set['family_id'] = dataset['family_id'];

                var function_array = ["finishRequest","insertUpdate","insertUpdate","insertUpdate"];
                var query_array = [ phone_insert, person_insert, family_insert ];
                function_array.pop();
                var next_function = function_array.pop();
                insertUpdate("add", res, query_array, function_array, object_set, eval(next_function));
            });
        });    
        //Close database connection
        db.close();
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
        getResults("add", res, query_array, function_array, dataset, eval(next_function));
    }
});

//* Add/Edit Page *//

//The get page is loaded when someone is redirected
//to this page, typically from an add or edit popup
app.get('/addedit', function(req, res) {
    var family_id = validateFamilyId(req.query.family_id);

    //Use the family id to build queries for
    //filling out page information
    var query_array = [
        ["family_info","SELECT f.family_id, f.address, f.zip, strftime('%m/%d/%Y', f.initial_contact_date) as initial_contact_date, z.city, z.state FROM families f INNER JOIN zip_codes z ON f.zip = z.zip_code WHERE f.family_id = '"+family_id+"';"], 
        ["family_members","SELECT person_id, first_name, last_name, strftime('%m/%d/%Y', birth_date) AS birthday, notes, gender, head FROM people WHERE family_id = '"+family_id+"' ORDER BY head DESC, birth_date ASC;"],
        ["phone_numbers","SELECT pn.phone_number_id, pn.phone_number, pn.phone_extension, pt.phone_type_desc, pn.primary_phone, pn.phone_note FROM phone_numbers pn INNER JOIN phone_types pt ON pn.phone_type_id = pt.phone_type_id WHERE pn.family_id = '"+family_id+"' ORDER BY pn.primary_phone DESC, pn.phone_type_id ASC, phone_number ASC;"],
        ["family_assistance","SELECT a.assistance_id, strftime('%m/%d/%Y', a.assistance_date) AS assistance_date, s.service_desc, ag.agency_name FROM assistance a INNER JOIN services s ON a.service_id = s.service_id INNER JOIN agencies ag ON a.agency_id = ag.agency_id WHERE a.family_id = '"+family_id+"' ORDER BY  assistance_date DESC, s.service_desc ASC LIMIT 10;"],
        ["family_contact","SELECT c.contact_id, ct.contact_type_desc, strftime('%m/%d/%Y', c.date) AS contact_date, c.contact_note, p.first_name FROM contact c INNER JOIN contact_types ct ON c.contact_type_id = ct.contact_type_id INNER JOIN people p ON c.person_id = p.person_id WHERE c.family_id = '"+family_id+"' ORDER BY c.date DESC, p.first_name ASC LIMIT 10;"]
    ];

    var function_array = ["finishRequest","getResults","getResults","getResults","getResults","getResults"];

    function_array.pop();
    var next_function = function_array.pop();

    var dataset = {};

    getResults("addedit", res, query_array, function_array, dataset, eval(next_function));

});

//* View/Edit Page *//

//The get version of this page handles search queries
app.get('/viewedit', function (req, res) {
    finishRequest("viewedit", res, object_collection);
});

//* Edit Family Address *//

//Address is only added in the initial
//family setup, but it needs a mechanism
//to be changed
app.get('/editaddress', function(req, res) {
    var family_id = validateFamilyId(req.query.family_id);

    //Use the family id to build queries to get the address
    //information
    var object_set = {};
    var function_array = ["finishRequest","getResults","getResults"];

    var query_array = [
        ["address","SELECT address, zip, family_id FROM families WHERE family_id = '"+family_id+"';"],
        ["zip_codes","SELECT zip_code, city, state FROM zip_codes;"]
    ];

    function_array.pop();
    var next_function = function_array.pop();
    getResults("editaddress", res, query_array, function_array, object_set, eval(next_function));
});

//Process changes to an address or force user
//to correct invalid information for an address
app.post('/editaddress', function(req,res) {
    //Check fields for valid content
    var dataset = {};
    dataset['invalid_fields'] = [];

    //Check to make sure address isn't empty
    if (req.body.address == "") {
        dataset['invalid_fields'].push("address");
    } else {
        dataset['address'] = sanitizeString(req.body.address);
    }

    //Check to make sure zip code isn't empty
    if (req.body.zip == "") {
        dataset['invalid_fields'].push("zip");
    } else {
        dataset['zip'] = req.body.zip;
    }

    //Check the provided family id
    dataset['family_id'] = req.body.family_id;
    dataset['family_id'] = dataset['family_id'].match(/[A-Z]+\d{8}-\d{2}/);

    //Open a database connection and check the id to make sure that it's
    //a valid id
    var db = new sqlite3.Database(file, error);

    //If the length of invalid fields is 0, update the address
    if (dataset['invalid_fields'].length == 0) {

        //Create a query to check family id
        var familyid_check = "SELECT family_id FROM families WHERE family_id = '" + dataset['family_id'] + "';";

        //Create update query   
        var address_update = "UPDATE families SET address = '" + dataset['address'] + "', zip = '" + dataset['zip'] + "' WHERE family_id = '" + dataset['family_id'] + "';";
        var object_set = {};

        //Set family_id to indicate a successful address update
        object_set['family_id'] = dataset['family_id'];

        //Prepare connections for completion.  An object set with
        //zip codes needs to be sent back to this page on completion
        //to avoid problems in rendering the javascript on that page
        object_set['zip_codes'] = [];
        object_set['zip_codes'].push(["empty","empty","empty"]);
        object_set['address'] = [];
        object_set['address'].push(["empty","empty","empty"]);

        //It's not strictly necessary to put these function names in
        //an array here, but it makes this code consistent with other
        //code blocks that have a larger number of routines.
        var function_array = ["finishRequest","insertUpdate", "checkResults"];
        var query_array = [ address_update, familyid_check ];
        function_array.pop();
        var next_function = function_array.pop();
        checkResults("editaddress", res, query_array, function_array, object_set, eval(next_function));
    } else {
        //If there was a validation error, send these results back to the
        //address update page to have the user correct omissions and problems
        var function_array = ["finishRequest","getResults"];
        var query_array = [
            ["zip_codes","SELECT zip_code, city, state FROM zip_codes ORDER BY zip_code ASC"],
        ];
        function_array.pop();
        var next_function = function_array.pop();
        getResults("editaddress", res, query_array, function_array, dataset, eval(next_function));
    }
});


//* Delete Family *//

app.get('/deletefamily', function(req, res) {
    var dataset = {};
    dataset['family_id'] = validateFamilyId(req.query_family_id);
    dataset['hash'] = parseInt(req.query.hash);
    
    var query_array = [
        ["DELETE FROM families WHERE family_id = '" + dataset['family_id'] + "';"],
        ["DELETE FROM people WHERE family_id = '" + dataset['family_id'] + "';"],
        ["DELETE FROM phone_numbers WHERE family_id = '" + dataset['family_id'] + "';"],
        ["DELETE FROM contact WHERE family_id = '" + dataset['family_id'] + "';"],
        ["DELETE FROM assistance WHERE family_id = '" + dataset['family_id'] + "';"],
        ["check_result", "SELECT last_name AS test_field FROM people WHERE family_id = '" + dataset['family_id'] + "' AND head = '1';"]
    ];
    
    var function_array = ["simpleDelete", "getResults"];
    
    function_array.pop();
    var next_function = function_array.pop();
    
    getResults("deletefamily", res, query_array, function_array, dataset, eval(next_function));
});

//* Add/Edit Family Member *//

//Get is used to build the form
app.get('/addeditfm', function(req, res) {

    //If we are adding the process needs to be built
    //on the family id
    if (typeof req.query.family_id !== "undefined") {
        var family_id = validateFamilyId(req.query.family_id);

        //Use the family id to build queries to get the address
        //information
        var object_set = {};
        var function_array = ["finishRequest","getResults"];

        var query_array = [
            ["family_head","SELECT person_id, first_name, last_name, family_id FROM people WHERE family_id = '" + family_id + "' AND head = 1;"]
        ];

        function_array.pop();
        var next_function = function_array.pop();
        getResults("addeditfm", res, query_array, function_array, object_set, eval(next_function));    

        //If we are updating a record that should be done
        //using the person id
        } else if (req.query.person_id !== "undefined") {
            var person_id = req.query.person_id;

            //Make sure that person_id is a numeric value
            person_id = parseInt(person_id);

            var object_set = {};
            var function_array = ["finishRequest", "getResults", "getResults"];

            var query_array = [
                ["family_member","SELECT person_id, first_name, last_name, strftime('%m/%d/%Y', birth_date) AS birthday, notes, gender, head FROM people WHERE person_id = '" + person_id + "';"],
                ["family_head","SELECT person_id, first_name, last_name, family_id FROM people WHERE family_id IN (SELECT family_id FROM people WHERE person_id = '" + person_id + "') AND head = 1;"]
            ];
            function_array.pop();
            var next_function = function_array.pop();
            getResults("addeditfm", res, query_array, function_array, object_set, eval(next_function));        
    } else {

    }
});

//Post is used to process the form
app.post('/addeditfm', function(req, res) {
    //Check fields for valid content

    var dataset = {};
    dataset['invalid_fields'] = [];

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

    //Check to make sure that gender is set
    if ((parseInt(req.body.gender) == 0) || (parseInt(req.body.gender) == 1)) {
        dataset['gender'] = parseInt(req.body.gender);
    } else {
        dataset['invalid_fields'].push("gender");
    }

    //Check to make sure birthday is a valid date

    //It's unlikely anyone would be entered in to 
    //this database who's over 100
    var today = new Date();
    var century = parseInt(today.getFullYear()) - 100; 
    var early_date = new Date(century, 0, 1);
    var birthday = validateDate(req.body.birthday, early_date);

    if (birthday) {
        dataset['birthday'] = birthday;
    } else {
        dataset['invalid_fields'].push("birthday");
    }

    //Sanitize any notes
    if (req.body.notes != "") {
       dataset['notes'] = sanitizeString(req.body.notes);
    }

    //Make sure that the person id of the family head
    //that is passed is valid
    if(req.body.head_id == parseInt(req.body.head_id)) {
        dataset['head_id'] = req.body.head_id;
    } else {
        dataset['invalid_fields'].push("head_id");
    }


    //Check if a person id for update was passed
    //and if so check it for validity
    if (typeof(req.body.person_id) != "undefined") {
        if (req.body.person_id == parseInt(req.body.person_id)) {
            dataset['person_id'] = req.body.person_id;
        } else {
            dataset['invalid_fields'].push("person_id");
        }
    }

    //If head is checked count that as a 1, otherwise
    //it's a 0
    if ((dataset['head_id'] == dataset['person_id']) || (req.body.head == "on")) {
        dataset['headstatus'] = 1;
    } else {
        dataset['headstatus'] = 0;
    }

     //If the length of invalid fields is 0, proceed with operations
    if (dataset['invalid_fields'].length == 0) {

        //Because it's possible the head is being changed (although quite possible it's not too)
        //and that should be the last operation it needs to be optionally very early in the function
        //and query array lists.  Here we won't build them both all at once, but assemble them as
        //we proceed through the procedure
        var function_array = ["finishRequest"];
        var query_array = [];

        //Setup the object set to return the family id to indicate success
        var object_set = {};
        object_set['family_id'] = req.body.family_id;

    //Check if the person being added/updated has been
    //set as head of household if they were not previously
    //head of household
    if (dataset['headstatus'] == 1) {
        if ((typeof(dataset['person_id']) == "undefined") || ((typeof(dataset['person_id']) != "undefined") && (dataset['head_id'] != dataset['person_id']))) {
            //Create a query to update the old family head to make them no longer the head
            function_array.push("insertUpdate");
            query_array.push("UPDATE people SET head = 0 WHERE person_id = '" + dataset['head_id'] + "';");
        }
    }

    //Next add in the insertUpdate query.  The query itself will vary depending on whether the person id
    //already exists or not
    function_array.push("insertUpdate");

    //If person id is defined, this is an update query
    if (typeof(dataset['person_id']) != "undefined") {
        var query_string = "UPDATE people SET family_id = '" + req.body.family_id + "', first_name = '" + dataset['first_name'] + "', last_name = '" + dataset['last_name'] + "', birth_date = julianday('" + dataset['birthday'].sqliteTimestring() + "'), gender = '" + dataset['gender'] + "'";
        if ((typeof(dataset['notes']) == "undefined") || (dataset['notes'] == "")) {
            query_string += ", notes = null";
        } else {
            query_string += ", notes = '" + dataset['notes'] + "'";
        }
        query_string += ", head = '" + dataset['headstatus'] + "' WHERE person_id = '" + dataset['person_id'] + "';"
        query_array.push(query_string);
    } else {
        var query_string = "INSERT INTO people (family_id, first_name, last_name, birth_date, gender";
        if ((typeof(dataset['notes']) != "undefined") && (dataset['notes'] != "")) {
            query_string += ", notes";
        }
        query_string += ", head) VALUES ('" + req.body.family_id + "', '" + dataset['first_name'] + "', '" + dataset['last_name'] + "', julianday('" + dataset['birthday'].sqliteTimestring() + "'), '" + dataset['gender'] + "'";
        if ((typeof(dataset['notes']) != "undefined") && (dataset['notes'] != "")) {
            query_string += ", '" + dataset['notes'] + "'";
        }
        query_string += ", '" + dataset['headstatus'] + "')";
        query_array.push(query_string);
    }

    //Finally, before anything else, add a  query to check family id
    query_array.push("SELECT family_id FROM families WHERE family_id = '" + req.body.family_id + "';");
    function_array.push("checkResults");

    function_array.pop();
    var next_function = function_array.pop()
    checkResults("addeditfm", res, query_array, function_array, object_set, eval(next_function));

    } else {
            //Otherwise, pass the dataset back to the form
            if (dataset['invalid_fields'].indexOf("birthday") > -1) {
                    dataset['birthday'] = "";
            } else {
                    dataset['birthday'] = req.body.birthday;
            }
            dataset['head_family_id'] = req.body.family_id;
            finishRequest("addeditfm", res, dataset);
    }

});

//* Delete Family Member *//

app.get('/deletefm', function(req, res) {
    var dataset = {};
    dataset['person_id'] = parseInt(req.query.person_id);
    dataset['family_id'] = validateFamilyId(req.query.family_id);
    dataset['hash'] = parseInt(req.query.hash);
    
    var query_array = [
        ["DELETE FROM people WHERE person_id ='" + dataset['person_id'] + "';"],
        ["DELETE FROM contact WHERE person_id = '" + dataset['person_id'] + "';"],
        ["check_result", "SELECT first_name || ' ' || last_name AS test_field FROM people WHERE person_id = '" + dataset['person_id'] + "' AND family_id = '" + dataset['family_id'] + "';"]
    ];
    
    var function_array = ["simpleDelete","getResults"];
    
    function_array.pop();
    var next_function = function_array.pop();
    getResults("deletefm", res, query_array, function_array, dataset, eval(next_function));

});

//* Add/Edit Phone Number *//

app.get('/addeditpn', function(req, res) {

    if (req.query.phone_number_id) {
        //Run a passed phone id value through parseInt
        //to sanitize it
        var phone_number_id = parseInt(req.query.phone_number_id);

        //Use the family id to build queries to get the address
        //information

        var query_array = [
            ["phone_types","SELECT phone_type_id, phone_type_desc FROM phone_types;"],
            ["phone_info","SELECT family_id, phone_number_id, phone_number, phone_extension, phone_note, phone_numbers.phone_type_id, phone_type_desc, primary_phone FROM phone_numbers INNER JOIN phone_types on phone_numbers.phone_type_id = phone_types.phone_type_id WHERE phone_number_id = '" + phone_number_id + "';"],
            ["primary_phone_info","SELECT family_id, phone_number_id FROM phone_numbers WHERE family_id IN (SELECT family_id FROM phone_numbers WHERE phone_number_id = '" + phone_number_id + "') AND primary_phone = '1'"],
            "SELECT family_id FROM phone_numbers WHERE phone_number_id = '" + phone_number_id + "';"
        ];

        var object_set = {};
        var function_array = ["finishRequest", "getResults", "getResults", "getResults", "checkResults"];
    } else {
        //We will be adding a new phone number on a family id
        //Run the passed value through parseInt to make sure
        //it's a number and then check it.  If there is no valid
        //family id, the checkResults function will close the window
        //and kick this back to the calling page
        var family_id = validateFamilyId(req.query.family_id);

        var query_array = [
            ["phone_types","SELECT phone_type_id, phone_type_desc FROM phone_types;"],
            ["primary_phone_info","SELECT family_id, phone_number_id FROM phone_numbers WHERE family_id = '" + family_id + "' AND primary_phone = '1';"],
            "SELECT family_id FROM families WHERE family_id = '" + family_id + "';"
        ];

        var object_set = {};
        var function_array = ["finishRequest","getResults","getResults","checkResults"];
    }

    function_array.pop();
    var next_function = function_array.pop();
    checkResults("addeditpn", res, query_array, function_array, object_set, eval(next_function));    
});

app.post('/addeditpn', function(req, res) {
    //Check fields for valid content
    var dataset = {};
    dataset['invalid_fields'] = [];

    //Run the returned phone number through the Validate
    //Phone function and collect the pieces in an array
    var phone_array = validatePhone(req.body.phone_number);
    if (phone_array[0]) {
        dataset['phone_number'] = phone_array[0];
        if (phone_array[1]) {
            dataset['phone_extension'] = phone_array[1];
        }
    } else {
        dataset['invalid_fields'].push("phone_number");
    }
    
    //Sanitize anything that was submitted in the phone
    //note blank and determine if there is anything there
    if (req.body.phone_note != "") {
        dataset['phone_note'] = sanitizeString(req.body.phone_note);
    }
    
    //Check the primary phone number checkbox value
    //If the phone number already is the primary
    //or if the check box is on, this is primary
    if ((req.body.primary_phone_id == req.body.phone_number_id) || (req.body.primary_phone == "on")) {
        dataset['primary_phone'] = 1;
    } else {
        dataset['primary_phone'] = 0;
    }
    
    //Set the phone type
    dataset['phone_type_id'] = parseInt(req.body.phone_type_id);
    
    //Put the family_id in a "primary_phone_family_id" value until
    //such point as we've verified that there are no problems
    dataset['primary_phone_family_id'] = validateFamilyId(req.body.family_id);
    
    //Get the primary phone id
    dataset['primary_phone_id'] = parseInt(req.body.primary_phone_id);

    //If there is a phone number id, pass that along
    if (parseInt(req.body.phone_number_id) > 0) {
        dataset['phone_number_id'] = parseInt(req.body.phone_number_id);
    }
    
    //If there is nothing in the invalid fields array (pretty much
    //can only be the phone number itself), proceed
    if (dataset['invalid_fields'].length == 0) {
        //Copy the family id into a family_id variable for completion
        dataset['family_id'] = dataset['primary_phone_family_id'];
        
        //Start the arrays to be passed
        var query_array = [];
        var function_array = ['finishRequest'];
        
        //If this is a new primary phone, setup that handover
        if ((dataset['primary_phone']) && ((typeof(dataset['phone_number_id']) == "undefined") || (dataset['primary_phone_id'] != dataset['phone_number_id']))) {
            query_array.push("UPDATE phone_numbers SET primary_phone = 0 WHERE phone_number_id = '" + dataset['primary_phone_id'] + "';");
            function_array.push("insertUpdate");
        }
        
        //Determine if we are doing an update or an add, and setup that query
        if (typeof(dataset['phone_number_id']) == "undefined") {
            var fields = "phone_number, phone_type_id, primary_phone, family_id, phone_extension, phone_note";
            var values = "'" + dataset['phone_number'] + "', '" + dataset['phone_type_id'] + "', '" + dataset['primary_phone'] + "', '" + dataset['family_id'] + "'";
            if (typeof(dataset['phone_extension']) != "undefined") {
                values += ", '" + dataset['phone_extension'] + "'";
            } else {
                values += ", null";
            }
            if (typeof(dataset['phone_note']) != "undefined") {
                values += ", '" + dataset['phone_note'];
            } else {
                values += ", null";
            }
            query_array.push("INSERT INTO phone_numbers (" + fields + ") VALUES (" + values + ");");
            function_array.push("insertUpdate");
        } else {
            var datapairs = "phone_number = '" + dataset['phone_number'] + "', phone_type_id = '" + dataset['phone_type_id'] + "', primary_phone = '" + dataset['primary_phone'] + "', family_id = '" + dataset['family_id'] + "'";
            if (typeof(dataset['phone_extension']) != "undefined") {
                datapairs += ", phone_extension = '" + dataset['phone_extension'] + "'";
            } else {
                datapairs += ", phone_extension = null";
            }
            if (typeof(dataset['phone_note']) != "undefined") {
                datapairs += ", phone_note = '" + dataset['phone_note'] + "'";
            } else {
                datapairs += ", phone_note = null";
            }
            query_array.push("UPDATE phone_numbers SET " + datapairs + " WHERE phone_number_id = '" + dataset['phone_number_id'] + "';");
            function_array.push("insertUpdate");
        }
        
        //Add on a check to make sure the family id is valid
        query_array.push("SELECT family_id FROM phone_numbers WHERE family_id = '" + dataset['family_id'] + "';");
        function_array.push("checkResults");
        
        //Send everything on its way
        function_array.pop();
        var next_function = function_array.pop();
        checkResults("addeditpn", res, query_array, function_array, dataset, eval(next_function));
    } else {
        //Just send the dataset back
        finishRequest("addeditpn", res, dataset)
    }
});

//* Delete Phone Number *//

app.get('/deletepn', function(req, res) {
        var dataset = {};
        dataset['phone_number_id'] = parseInt(req.query.phone_number_id);
        dataset['family_id'] = validateFamilyId(req.query.family_id);
        dataset['hash'] = parseInt(req.query.hash);
        
        query_array = [
            ["DELETE FROM phone_numbers WHERE phone_number_id = '" + dataset['phone_number_id'] + "';"],
            ["check_result","SELECT phone_number AS test_field FROM phone_numbers WHERE phone_number_id = '" + dataset['phone_number_id'] + "' AND family_id = '" + dataset['family_id'] + "' AND primary_phone = 0;"]
        ];
        
        function_array = ["simpleDelete", "getResults"];
        
        function_array.pop();
        var next_function = function_array.pop();
        
        getResults("deletepn", res, query_array, function_array, dataset, eval(next_function));
});

//* Add/Edit Assitance Event *//

app.get('/addeditassist', function(req, res) {

});

app.post('/addeditassist', function(req, res) {

});

//* Delete Assistance Event *//

app.get('/deleteassist', function(req, res) {

});

//* Add/Edit Contact Event *//

app.get('/addeditcontact', function(req, res) {

});

app.post('/addeditcontact', function(req, res) {

});

//* Delete Contact Event *//

app.get('/deletecontact', function(req, res) {

});

//* Port Listen Declaration *//

app.listen(3000);
