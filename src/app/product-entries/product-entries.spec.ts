import { TestBed, async } from '@angular/core/testing';
import { ProductEntriesPage } from './product-entries';

//  declare var featureSteps: any;

// featureSteps(/.+/)
//     .given('the ExpirySync API server is in its pristine state and running', function() {
//   console.log('-------Hi!');
// });
describe('ProductEntriesPage', () => {
  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [
        ProductEntriesPage
      ],
    }).compileComponents();
  }));

  it('should create the page', async(() => {

  }));

});
