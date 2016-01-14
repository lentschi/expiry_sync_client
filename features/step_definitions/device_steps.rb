require 'calabash-android/wait_helpers'
require 'open3'
require 'fileutils'
require 'nokogiri'

APP_BACKUPS_PATH = 'features/support/tmp/app_backups'

Given /^the app has just been freshly installed$/ do
  reinstall_apps
  start_test_server_in_background
  url = 'http://' + ExpirySyncUtility.my_first_private_ipv4.ip_address +  ':3000/'
  set_preferences('main', {pref_key_host: url})
end

When /^loading has finished$/ do
  begin
    wait_for_text("Loading", timeout: 5)
  rescue Calabash::Android::WaitHelpers::WaitError => e
    #do nothing (We can only assume it has already finished before starting the step)
  end
  
  wait_for_text_to_disappear("Loading")
end

When /^I switch to a different device, on which the app has been freshly installed$/ do
  # change associations in our memory:
  @authHelper.memorize(@authHelper.recall('that user'), 'user on the first device')
  @authHelper.forget 'that user'
  
  step('I exit the app')
  
  # first backup the current device:
  # Note: for now we're explicitly backing up the database and the settings
  Open3.popen3("#{default_device.adb_command} pull /data/data/at.florian_lentsch.expirysync/databases/. #{APP_BACKUPS_PATH}/databases") do |stdin, stdout, stderr, wait_thr|
    expect(wait_thr.value.success?).to be(true), "pulling the current database failed"
  end
    
  Open3.popen3("#{default_device.adb_command} pull /data/data/at.florian_lentsch.expirysync/shared_prefs/. #{APP_BACKUPS_PATH}/shared_prefs") do |stdin, stdout, stderr, wait_thr|
    expect(wait_thr.value.success?).to be(true), "pulling shared preferences failed"
  end
    
  step('the app has just been freshly installed')
end

When /^I switch back to the first device restarting the app( in offline mode)?$/ do |offline_mode|
  step('I exit the app')
  
  shutdown_test_server
  
  # first backup the second device:
  # Note: for now we're explicitly backing up the database and the settings
  Open3.popen3("#{default_device.adb_command} pull /data/data/at.florian_lentsch.expirysync/databases/. features/support/tmp/app_backups/databases_device2") do |stdin, stdout, stderr, wait_thr|
    expect(wait_thr.value.success?).to be(true), "pulling the current database failed"
  end
    
  Open3.popen3("#{default_device.adb_command} pull /data/data/at.florian_lentsch.expirysync/shared_prefs/. features/support/tmp/app_backups/shared_prefs_device2") do |stdin, stdout, stderr, wait_thr|
    expect(wait_thr.value.success?).to be(true), "pulling shared preferences failed"
  end
  
  # then restore the first device:
  Open3.popen3("#{default_device.adb_command} push #{APP_BACKUPS_PATH}/databases/ /data/data/at.florian_lentsch.expirysync/databases") do |stdin, stdout, stderr, wait_thr|
    expect(wait_thr.value.success?).to be(true), "pushing the first device's database failed"
  end
  
  unless offline_mode.nil?
    # alternatively we could somehow deactivate networking...
    FileUtils.cp_r("#{APP_BACKUPS_PATH}/shared_prefs", "#{APP_BACKUPS_PATH}/shared_prefs_offline_mode", remove_destination: true)
    
    file_path = "#{APP_BACKUPS_PATH}/shared_prefs_offline_mode/main.xml"
    doc = Nokogiri::XML(File.read(file_path))
    offline_mode_node = doc.at_xpath("//map/boolean[@name='pref_key_offline_mode']")
    offline_mode_node['value'] = true
    File.open(file_path, 'w') { |file| file.write(doc.to_xml) }
  end
  
  Open3.popen3("#{default_device.adb_command} push #{APP_BACKUPS_PATH}/shared_prefs" + (offline_mode.nil? ? '' : '_offline_mode') + "/ /data/data/at.florian_lentsch.expirysync/shared_prefs") do |stdin, stdout, stderr, wait_thr|
    expect(wait_thr.value.success?).to be(true), "pushing the first device's shared preferences failed"
  end
    
  start_test_server_in_background
  
  step('loading has finished')
end

When /^I switch back to the second device restarting the app$/ do
  step('I exit the app')
    
  shutdown_test_server
  
  Open3.popen3("#{default_device.adb_command} push #{APP_BACKUPS_PATH}/databases_device2/ /data/data/at.florian_lentsch.expirysync/databases") do |stdin, stdout, stderr, wait_thr|
    expect(wait_thr.value.success?).to be(true), "pushing the second device's database failed"
  end
  
  Open3.popen3("#{default_device.adb_command} push #{APP_BACKUPS_PATH}/shared_prefs_device2/ /data/data/at.florian_lentsch.expirysync/shared_prefs") do |stdin, stdout, stderr, wait_thr|
    expect(wait_thr.value.success?).to be(true), "pushing the second device's shared preferences failed"
  end
    
  start_test_server_in_background
  
  step('loading has finished')
end