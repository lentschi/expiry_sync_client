Feature: Product entry updating

Background:
	Given the ExpirySync API server is in its pristine state and running
		And there exists a user
		And I am logged in as that user

Scenario: Updating a product with valid data
	Given there exists a product entry in my list
	When I open the edit product screen for that product entry
	When I overwrite the form fields contents with valid but changed product entry data
		And I try to save the product entry form
	Then I should see the updated product entry's data in the product entry list

Scenario Outline: Updating a product with invalid data
	Given there exists a product entry in my list
	When I open the edit product screen for that product entry
	When I overwrite the form fields contents with changed product entry data <containing_what?>
		And I try to save the product entry form
	Then I should see that updating failed
	
Examples:
	|containing_what?|
	|without a name|
	|with an invalid amount|

Scenario: Updating a product with valid data by scanning a barcode existing on one of the remotes
	Given there exists a product entry in my list
	When I open the edit product screen for that product entry
		And I choose to scan another barcode
	Then barcode scanning should start
    When I hold a valid barcode, that is different from the original product entry's article, in front of the camera
    Then barcode scanning should stop
    	And this barcode should appear in the barcode field
    	And the matching article's name should appear in the name field
    When I try to save the product entry form
    Then I should see the updated product entry's article name in the product entry list