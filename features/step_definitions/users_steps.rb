VALID_USERS = [
  {
    account_name: 'test1',
    email_address: 'test@demo.com',
    password: 'test321'
  },
  {
    account_name: 'test2',
    email_address: 'test@example.com',
    password: 'test123'
  }
]

Before do |scenario|
  @authHelper = CucumberExpirySyncHelpers::AuthHelper.new(self)
end

Given /^the registration form is open$/ do
  unless element_exists("* id:'email_address'") \
      and element_exists("* id:'account_name'") \
      and element_exists("* id:'password'")
    step('I open the registration form')
  end
end

When /^I open the registration form$/ do
  if @authHelper.logged_in?
    step('I try to log out')
    step('logout should be successful')
  end
  step('the login form is open')
  tap_when_element_exists("* marked:'Sign up'")
  wait_for_element_exists("* id:'email_address'")
end

Given /^the login form is open$/ do
  unless element_does_not_exist("* id:'email_address'") \
      and element_exists("* id:'account_name'") \
      and element_exists("* id:'password'")
    step('I open the login form')
  end 
end

When /^I open the login form$/ do
  step('I press "Login" in the main menu')
  wait_for_element_exists("* id:'account_name'")
end

When /^I enter valid registration data(, that is different from the one I entered before)?$/ do |different|
  user = VALID_USERS.find do |user|
    unless different.nil?
      next @authHelper.remember('registered user')[:account_name] != user[:account_name]
    end
      
    true
  end
    
  
  enter_text("* id:'account_name'", user[:account_name])
  enter_text("* id:'email_address'", user[:email_address])
  enter_text("* id:'password'", user[:password])
  tap_when_element_exists("* id:'submit'")
  @authHelper.memorize user, ['that user', 'registered user']
end

Given /^there exists a user$/ do
  step('the registration form is open')
  step('I enter valid registration data')
  step('I should see "registration succeeded"')
end

Given(/^I register a user with different data than on the first device$/) do
  step('the registration form is open')
  step('I enter valid registration data, that is different from the one I entered before')
  step('I should see "registration succeeded"')
end

When /^I try to login (as that user|with the same user as on the first device|with the same user as previously)$/ do |what_user_str|
  step("the login form is open")
  
  clear_text_in("* id:'account_name'")
  clear_text_in("* id:'password'")
  
  that_user = @authHelper.recall(what_user_str == 'as that user' ? 'that user' : 'user on the first device')
  enter_text("* id:'account_name'", that_user[:email_address])
  enter_text("* id:'password'", that_user[:password])
  tap_when_element_exists("* id:'submit'")
  
  #re-memorize:
  @authHelper.memorize that_user, 'that user'
end

Then(/^I should be logged in as that user$/) do
  that_user = @authHelper.recall 'that user'

  @authHelper.logged_in?(that_user).should be(true)
end

When /^I try to log out$/ do
  step("I open the main menu")
  tap_when_element_exists("DropDownListView * {text LIKE 'Logout *'}")
end

Then /^logout should be successful$/ do
  @authHelper.logged_in?.should be(false)
end

Given(/^I am logged in as that user$/) do
  if @authHelper.logged_in?
    step('I try to log out')
    step('logout should be successful')
  end
  
  step('I try to login as that user')
  step('I should be logged in as that user')
end
