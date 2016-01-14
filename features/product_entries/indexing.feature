Feature: Product entry indexing

Background:
	Given the ExpirySync API server is in its pristine state and running
		And there exists a user
		And I am logged in as that user

Scenario: Sorting by expiration date
	Given there exist several product entries with different expiration dates
	When I choose to sort by expiration date
	Then I should see the previously added product entries ordered by their expiration dates

Scenario: Sorting alphabetically
	Given there exist several product entries with different names
	When I choose to sort alphabetically
	Then I should see the previously added product entries ordered alphabetically by their names

Scenario: Sorting by date of adding
	Given there exist several product entries
	When I choose to sort by date of adding
	Then I should see the previously added product entries in the order in which they were added

Scenario: Identifying entries, that will soon expire
	Given I have configured entries to be marked as 'bad' amount of days before expiring  
		And there exist several product entries, that won't expire between that amount of days and today
		And there exist several product entries, that will expire between that amount of days and today
	Then the days, that will expire between that amount of days and today, should be visibly marked
	
Scenario: Filtering by name
	Given there exist several product entries with different names
	When I enter the name of one of these product entries in the filter field
	Then I should see that product entry in the list (alongside with other product entries that might contain that name in their names) 

Scenario: Filtering by barcode
	Given there exist several product entries
	When I enter the barcode of one of these product entries in the filter field
	Then I should see only that product entry in the list

Scenario: Entering non-existant name into the filter field
	Given there exist several product entries with different names
	When I enter a name of a product entry different from those just added in the filter field
	Then the list should be empty