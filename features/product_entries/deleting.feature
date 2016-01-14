Feature: Product entry deletion
    The user should be able to delete existing product entries for a location.
    The referenced articles should never be deleted alongside.
    
Background:
	Given the ExpirySync API server is in its pristine state and running
		And there exists a user
		And I am logged in as that user

Scenario: Deleting a single product entry (from the edit screen)
	Given there exists a product entry
	When I open the edit product screen for that product entry
		And I press the delete button
	Then I should be asked, if I really want to delete the entry
	When I answer yes
	Then I should see that deleting succeeded
		And the product entry should no longer be in the list

Scenario: Deleting multiple product entries (from the list screen)
	Given there exist several product entries
	When I check a subset of these product entries
		And I choose to delete the selected items
	Then I should be asked, if I really want to delete the entries
	When I answer yes
	Then I should see that deleting succeeded
		And the selected product entries should no longer be in the list