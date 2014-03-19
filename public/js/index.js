function newRecord() {
  window.open("add","","height=500,width=750,left=50,top=50");
}

function receiveFamilyId(familyid) {
  address = "addedit?family_id="+familyid;
  window.open(address,"_self");
}