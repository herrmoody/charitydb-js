function edit_address(family_id) {
    var address = "editaddress?family_id="+family_id;
    window.open(address,"","height=500,width=750,left=50,top=50");
}

function delete_family(name, family_id) {
    var message = "Are you sure you wish to delete the "+name+" family and all of the associated records?";
    var proceed = confirm(message);
    if (proceed == true) {
	var address = "deletefamily?family_id="+family_id;
	window.open(address,"_self");
    }
}

function edit_member(person_id) {
    var address = "addeditfm?person_id="+person_id;
    window.open(address,"","height=500,width=750,left=50,top=50");
}

function delete_member(name, family_id, person_id) {
    var message = "Are you sure you wish to delete "+name+" from this family?";
    var proceed = confirm(message);
    if (proceed == true) {
	var address = "deletefm?person_id="+person_id+"&family_id="+family_id;
	window.open(address,"_self");
    }
}

function add_member(family_id) {
    var address = "addeditfm?family_id="+family_id;
    window.open(address,"","height=500,width=750,left=50,top=50");
}

function edit_phone(phone_number_id) {
    var address = "addeditphone?phone_number_id="+phone_number_id;
    window.open(address,"","height=500,width=750,left=50,top=50");
}

function delete_phone(phone_number, family_id, phone_number_id) {
    var message = "Are you sure you wish to delete "+phone_number+" from this family record?";
    var proceed = confirm(message);
    if (proceed == true) {
	var address = "deletephone?phone_number_id="+phone_number_id+"&family_id="+family_id;
	window.open(address,"_self");
    }
}

function add_phone(family_id) {
    var address = "addeditphone?family_id="+family_id;
    window.open(address,"","height=500,width=750,left=50,top=50");
}

function edit_contact(contact_id) {
    var address = "addeditcontact?contact_id="+contact_id;
    window.open(address,"","height=500,width=750,left=50,top=50");
}

function delete_contact(contact_date, family_id, contact_id) {
    var message = "Are you sure you wish to delete this contact record from "+contact_date+" from this family record?";
    var proceed = confirm(message);
    if (proceed == true) {
	var address = "deletecontact?contact_id="+contact_id+"&family_id="+family_id;
	window.open(address,"_self");
    }
}

function add_contact(family_id) {
    var address="addeditcontact?family_id="+family_id;
    window.open(address,"","height=500,width=750,left=50,top=50");
}

function edit_assistance(assistance_id) {
    var address="addeditassistance?assitance_id="+assistance_id;
    window.open(address,"","height=500,width=750,left=50,top=50");
}

function delete_assistance(assistance_date, family_id, assistance_id) {
    var message = "Are you sure you wish to delete this assistance record from "+assistance_date+" from this family record?";
    var proceed = confirm(message);
    if (proceed == true) {
	var address = "deleteassistance?assistance_id="+assistance_id+"&family_id="+family_id;
	window.open(address,"_self");
    }
}

function add_assistance(family_id) {
    var address="addeditassistance?family_id="+family_id;
    window.open(address,"","height=500,width=750,left=50,top=50");
}
