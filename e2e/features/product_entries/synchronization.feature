Feature: Product entry synchronization

Background:
	Given the ExpirySync API server is in its pristine state and running
		And there exists a user
		And I am logged in as that user

Scenario: Synchronize new product entries between different devices with the same user
	When I successfully add a product entry
		And I switch to a different device, on which the app has been freshly installed
		And I try to login with the same user as on the first device
	Then I should be logged in as that user
		And I should see the product entry's data in the product entry list
	When I successfully add another product entry
		And I switch back to the first device restarting the app
	Then I should see that product entry's data in the product entry list

@fit
Scenario: Synchronize deleted product entries between different devices with the same user
	Given there exists a product entry
		And I switch to a different device, on which the app has been freshly installed
		And I try to login with the same user as on the first device
	Then I should be logged in as that user
		And I should see the product entry's data in the product entry list
	When I try to delete that entry
	When I switch back to the first device restarting the app
	Then I should no longer see that product entry's data in the product entry list

Scenario: Synchronize updated product entries between different devices with the same user
	Given there exists a product entry
		And I switch to a different device, on which the app has been freshly installed
		And I try to login with the same user as on the first device
	Then I should be logged in as that user
		And I should see the product entry's data in the product entry list
	When I try to change the product entry's data
		And I switch back to the first device restarting the app
	Then I should see the updated product entry's data in the product entry list

Scenario: Synchronize product entries between different devices with the same user when logging back in after offline mode
	Given there exists a product entry
		And I switch to a different device, on which the app has been freshly installed
		And I go back to the main screen without logging in
	When I successfully add another product entry
		And I try to login with the same user as on the first device
	Then I should be logged in as that user
		And I should see both product entries' data in the product entry list
	When I switch back to the first device restarting the app
	Then I should still see both product entries' data in the product entry list

Scenario: Synchronize product entries between different devices with the same user, where an entry has been deleted on the first device but updated on the second
	Given there exists a product entry
		And I switch to a different device, on which the app has been freshly installed
		And I try to login with the same user as on the first device
	Then I should be logged in as that user
		And I should see the product entry's data in the product entry list
	When I switch back to the first device restarting the app
		And I enter offline mode
		And I switch back to the second device restarting the app
	When I try to delete that entry
	Then I should see that deleting succeeded
	When I switch back to the first device restarting the app
		And I try to change the product entry's data
		And I try to login with the same user as previously
	Then I should see the updated product entry's data in the product entry list
	When I switch back to the second device restarting the app
		Then I should still see the updated product entry's data in the product entry list

Scenario: Synchronize article data between different devices with different users
	Given there exists a product entry
		And I switch to a different device, on which the app has been freshly installed
		And I register a user with different data than on the first device
	When I open the add product screen
    	Then barcode scanning should start automatically
    When I hold the barcode of the article, that had been added on the first device, in front of the camera
    Then barcode scanning should stop
    When I overwrite the form fields contents with valid but changed product entry data
    	And I try to save the product entry form
    Then I should see the updated article's data in the product entry list
    When I switch back to the first device restarting the app
   	Then I should still see the updated article's data in the product entry list


