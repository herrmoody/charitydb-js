function returnValue(family_id) {
  if (family_id === parseInt(family_id)) {
    try {
      window.opener.receiveFamilyId(family_id);
    }
    catch (err) {};
    close();
  }
}

function getZipInfo(zip_codes) {
  var index_code = document.getElementById('zip').value;
  for (var key in zip_codes) {
    if (index_code == key) {
      document.getElementById('city').innerHTML = zip_codes[key][0];
      document.getElementById('state').innerHTML = zip_codes[key][1];
    }
  }
}

function validateDate(element) {
    var input_date = document.getElementById(element).value;
    var date_parts = input_date.split("/");
    if (date_parts.length != 3) {
	alert("Please use date format mm/dd/yyyy");
	document.getElementById(element).focus();
    } else {
	var input_year = parseInt(date_parts[2]);
	var input_day = parseInt(date_parts[1]);
	var input_month = parseInt(date_parts[0])-1;
	if (isFinite(input_year) && isFinite(input_day) && isFinite(input_month)) {
	    if (element == "birthday") {
		var early_date = new Date(1910, 0, 1);
	    } else {
		var early_date = new Date(2000, 0, 1);
	    }
	    var late_date = new Date();
	    var test_date = new Date(input_year, input_month, input_day);
	    if ((test_date < early_date) || (test_date > late_date)) {
		if (element == "birthday") {
		    alert("Please enter a birthdate in the past 100 years");
		} else {
		    alert("Please enter a recent past date");
		}
		document.getElementById(element).focus();
	    }
	} else {
	    if (element == "birthday") {
		alert("Please enter a birthday using the form mm/dd/yyyy");
	    } else {
		alert("Please use date format mm/dd/yyyy");
	    }
	    document.getElementById(element).focus();
	}
    }
}