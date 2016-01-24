require 'calabash-android/wait_helpers'

Given /^the main screen is active$/ do
  while true
    begin
      #wait_for_activity("ProductListActivity", timeout: 2) # <- activity always open?
      wait_for_element_exists("* id:'action_add_product'", timeout: 2)
      break
    rescue Calabash::Android::WaitHelpers::WaitError => e
      #puts "Waiting for main screen..."
      press_back_button
    end    
  end
end

When /^I go back to the main screen without logging in$/ do
  step('the main screen is active')
end

When /^I open the main menu$/ do
  step('the main screen is active')
  press_menu_button
  
  wait_for_element_exists("DropDownListView * marked:'Login'", timeout: 2)
end

When /^I press "(.+)" in the main menu$/ do |marked_str|
  step('I open the main menu')
  ExpirySyncUtility.scroll_to("DropDownListView * marked:'#{marked_str}'")
  tap_when_element_exists("DropDownListView * marked:'#{marked_str}'")
end

When /^I exit the app$/ do
  begin
    step('I press "Exit" in the main menu')
  rescue HTTPClient::KeepAliveDisconnected => e
    # that's expected to happen
  end
end