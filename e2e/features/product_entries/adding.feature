Feature: Product entry adding
    The user should be able to create new product entries for a location.
    The referenced articles should be created/reused automatically.
    
Background:
	Given the ExpirySync API server is in its pristine state and running
		And there exists a user
		And I am logged in as that user

Scenario: Add a product entry with valid data by scanning a barcode existing on one of the remotes
    When I open the add product screen
    Then barcode scanning should start automatically
    When I hold a valid barcode in front of the camera
    Then barcode scanning should stop
    	And this barcode should appear in the barcode field
    	And the matching article's name should appear in the name field
    When I complement the form with valid product entry data
    	And I try to save the product entry form
    Then I should see the product entry's data in the product entry list
    When I open the edit product screen for that product entry
    Then I should see that product entry's data in the form fields

Scenario Outline: Add a product entry with valid data by entering it manually
	When I open the add product screen
	Then barcode scanning should start automatically
	When I choose to enter the product entry manually
	Then barcode scanning should stop
		And the barcode field should still be empty
	When I supply valid product entry data <containing_what>
		And I try to save the product entry form
    Then I should see the product entry's data in the product entry list
    When I open the edit product screen for that product entry
    Then I should see that product entry's data in the form fields
    
Examples:
   	|containing_what|
   	|including a barcode|
   	|without a barcode|
   	|with a photo|
   	

Scenario Outline: Add a product with invalid data
	When I open the add product screen
	Then barcode scanning should start automatically
	When I choose to enter the product entry manually
	Then barcode scanning should stop
		And the barcode field should still be empty
	When I supply valid product entry data <containing_what>
		And I try to save the product entry form
    Then I should see that adding failed

Examples:
	|containing_what|
	|without a name|
	|with an invalid amount|
	
Scenario: Adding a product, that has earlier been deleted, back to the list
	Given I have deleted a product entry
	When I open the add product screen
	Then barcode scanning should start automatically
	When I choose to enter the product entry manually
	Then barcode scanning should stop
		And the barcode field should still be empty
	When I enter the deleted product entry's barcode
		And I conlude my entry by tapping another field
	Then the other fields should be automatically filled with the deleted entry's data
	
Scenario: Adding several product entries in a row (without returning to the home screen in between)
	