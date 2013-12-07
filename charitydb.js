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
      db.run("CREATE TABLE families (family_code TEXT PRIMARY KEY NOT NULL COLLATE NOCASE, address TEXT, zip TEXT, initial_contact_date INTEGER);",error);
      
      //People Table
      db.run("CREATE TABLE people (person_id INTEGER PRIMARY KEY AUTOINCREMENT, family_code TEXT NOT NULL COLLATE NOCASE, first_name TEXT NOT NULL COLLATE NOCASE, last_name TEXT NOT NULL COLLATE NOCASE, birth_date INTEGER, notes TEXT, head INTEGER DEFAULT 0, FOREIGN KEY(family_code) REFERENCES families (family_code));",error);
      
      //Contact Types Table
      db.run("CREATE TABLE contact_types (contact_type_id INTEGER PRIMARY KEY AUTOINCREMENT, contact_type_desc TEXT NOT NULL);",error);
      
      //Contact Table
      db.run("CREATE TABLE contact (contact_id INTEGER PRIMARY KEY AUTOINCREMENT, contact_type_id INTEGER NOT NULL, date INTEGER NOT NULL, family_code TEXT NOT NULL, person_id INTEGER, contact_note TEXT, FOREIGN KEY (contact_type_id) REFERENCES contact_types (contact_type_id), FOREIGN KEY (family_code) REFERENCES families (family_code), FOREIGN KEY (person_id) REFERENCES people (person_id));",error);
      
      //Agencies Table
      db.run("CREATE TABLE agencies (agency_id INTEGER PRIMARY KEY AUTOINCREMENT, agency_name TEXT NOT NULL);",error);
      
      //Services Table
      db.run("CREATE TABLE services (service_id INTEGER PRIMARY KEY AUTOINCREMENT, service_desc TEXT NOT NULL);",error);
      
      //Assistance Table
      db.run("CREATE TABLE assistance (assistance_id INTEGER PRIMARY KEY AUTOINCREMENT, assistance_date INTEGER NOT NULL, family_code TEXT NOT NULL COLLATE NOCASE, service_id INTEGER NOT NULL, agency_id INTEGER, FOREIGN KEY (family_code) REFERENCES families (family_code), FOREIGN KEY (service_id) REFERENCES services (service_id), FOREIGN KEY (agency_id) REFERENCES agencies (agency_id));",error);
       
      //Phone Types Table
      db.run("CREATE TABLE phone_types (phone_type_id INTEGER PRIMARY KEY AUTOINCREMENT, phone_type_desc TEXT COLLATE NOCASE);",error);
      
      //Phone Numbers Table
      db.run("CREATE TABLE phone_numbers (phone_number INTEGER PRIMARY KEY, phone_type_id INTEGER NOT NULL DEFAULT 1, family_code TEXT NOT NULL COLLATE NOCASE, phone_note TEXT, FOREIGN KEY (family_code) REFERENCES families (family_code), FOREIGN KEY (phone_type_id) REFERENCES phone_types (phone_type_id));",error);
      
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
  var function_array = ["finishRequest","getResults"];
  var query_array = [
    ["zip_codes","SELECT zip_code, city, state FROM zip_codes ORDER BY zip_code ASC"]
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
  var dataset = {};
  ['invalid_fields'] = [];
  if (req.body.first_name == "") {
    dataset['invalid_fields'].push("first_name");
  } else {
    dataset['first_name'] = req.body.first_name;
	dataset['family_id'] = 1;
	dataset['zip_codes'] = getZipCodes();
  }
  finishRequest(dataset);
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