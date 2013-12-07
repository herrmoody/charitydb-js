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