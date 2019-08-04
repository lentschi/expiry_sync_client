Feature: Login ExpirySync users

Background:
	Given the ExpirySync API server is in its pristine state and running

Scenario: Login a user
	Given there exists a user
		But the app has just been freshly installed
	When I try to login as that user
	Then I should be logged in as that user