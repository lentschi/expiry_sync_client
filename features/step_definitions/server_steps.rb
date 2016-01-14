Given /^the ExpirySync API server is in its pristine state and running$/ do
  ExpirySyncUtility.reset_api_server_db!
  ExpirySyncUtility.start_api_server!
  
  url = 'http://' + ExpirySyncUtility.my_first_private_ipv4.ip_address +  ':3000/'
  fail("Test server instance under '#{url}' is not running") unless ExpirySyncUtility.port_is_open?('127.0.0.1',3000)
  
  set_preferences('main', {pref_key_host: url})
end