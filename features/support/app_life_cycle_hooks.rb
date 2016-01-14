require 'calabash-android/management/adb'
require 'calabash-android/operations'
require './features/support/expiry_sync_utility.rb'

Before do |scenario|
  start_test_server_in_background
end

After do |scenario|
  if scenario.failed?
    screenshot_embed
  end
  shutdown_test_server
  
  ExpirySyncUtility.stop_api_server!
end
