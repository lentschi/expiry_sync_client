Feature: Alerting

Background:
	Given the ExpirySync API server is in its pristine state and running
		And there exists a user
		And I am logged in as that user

# difficult to implement, since we cannot leave the app...
Scenario: Alerting the user about expired products
	Given there exists a product entry in my list
	When expiration date of that product is within the 'days before bad' range
	Then an alarm should appear, reminding me to consume that product
	When I tap the alarm message
	Then the product list should appear 