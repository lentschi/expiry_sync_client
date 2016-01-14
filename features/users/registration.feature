Feature: Registration of new ExpirySync users
    
Background:
	Given the ExpirySync API server is in its pristine state and running
	
Scenario: Register a new user
	Given the registration form is open
	When I enter valid registration data
	Then I should see "Registration succeeded"