/*
* This file is part of ExpirySync.
*
* ExpirySync is free software: you can redistribute it and/or modify
* it under the terms of the GNU General Public License as published by
* the Free Software Foundation, either version 3 of the License, or
* (at your option) any later version.

* ExpirySync is distributed in the hope that it will be useful,
* but WITHOUT ANY WARRANTY; without even the implied warranty of
* MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
* GNU General Public License for more details.

* You should have received a copy of the GNU General Public License
* along with ExpirySync.  If not, see <http://www.gnu.org/licenses/>
*/

package at.florian_lentsch.expirysync;

import java.util.ArrayList;
import java.util.GregorianCalendar;

import org.joda.time.DateTime;

import android.annotation.TargetApi;
import android.app.ActionBar;
import android.content.Intent;
import android.content.res.Resources;
import android.graphics.Bitmap;
import android.graphics.drawable.BitmapDrawable;
import android.os.Build;
import android.os.Bundle;
import android.support.v4.app.NavUtils;
import android.view.Menu;
import android.view.MenuItem;
import android.widget.DatePicker;
import android.widget.EditText;
import android.widget.ImageView;

import at.florian_lentsch.expirysync.db.DatabaseManager;
import at.florian_lentsch.expirysync.model.Article;
import at.florian_lentsch.expirysync.model.ArticleImage;
import at.florian_lentsch.expirysync.model.ProductEntry;
import at.florian_lentsch.expirysync.net.ServerProxy;
import at.florian_lentsch.expirysync.util.Util;

/**
 * Activity displaying a form to add new product entries
 * 
 * @author Florian Lentsch <office@florian-lentsch.at>
 * 
 */
public class AddProductActivity extends ProductCrudActivity {
	// activities result codes:
	public static final int RESULT_OK_ADD_ANOTHER = 1;

	@Override
	protected void onCreate(Bundle savedInstanceState) {
		super.onCreate(savedInstanceState);
		setContentView(R.layout.product_form);
		loadPhotoFromSaveInstanceState(savedInstanceState);

		initFormFields();

		// Default values etc:
		EditText amountField = (EditText) findViewById(R.id.amount_field);
		String hint = amountField.getHint().toString();
		hint += " (" + getResources().getText(R.string.default_value) + ": " + DEFAULT_AMOUNT + ")";
		amountField.setHint(hint);

		// Show the Up button in the action bar.
		setupActionBar();

		boolean scanBarcodeOnStart = savedInstanceState != null ? savedInstanceState.getBoolean("scanBarcodeOnStart",
				true) : true;
		if (scanBarcodeOnStart) {
			Intent intent = new Intent(this, ScanBarcodeActivity.class);
			startActivityForResult(intent, SCAN_BARCODE_RESULT);
		}
	}

	@Override
	protected void onSaveInstanceState(Bundle outState) {
		super.onSaveInstanceState(outState);
		outState.putBoolean("scanBarcodeOnStart", false);
	}

	/**
	 * Set up the {@link android.app.ActionBar}, if the API is available.
	 */
	@TargetApi(Build.VERSION_CODES.HONEYCOMB)
	private void setupActionBar() {
		ActionBar actionBar = null;
		if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.HONEYCOMB && (actionBar = getActionBar()) != null) {
			actionBar.setDisplayHomeAsUpEnabled(true); // TODO: Find out, why
														// this is not being
														// done for android 4
														// for example
		}
	}

	@Override
	public boolean onCreateOptionsMenu(Menu menu) {
		// Inflate the menu; this adds items to the action bar if it is present.
		getMenuInflater().inflate(R.menu.add_product, menu);
		return super.onCreateOptionsMenu(menu);
	}

	@Override
	public boolean onOptionsItemSelected(MenuItem item) {
		switch (item.getItemId()) {
		case android.R.id.home:
			NavUtils.navigateUpFromSameTask(this);
			break;
		case R.id.action_save:
			this.addProduct(false);
			break;
		case R.id.action_save_and_add_product:
			this.addProduct(true);
			break;
		case R.id.action_cancel_adding:
			setResult(RESULT_CANCELED);
			finish();
			break;
		}
		return super.onOptionsItemSelected(item);
	}

	/**
	 * Saves the form data and then ends the activity
	 * 
	 * @param addAnotherAfterwards
	 *            if true, the calling activity is asked to open another add
	 *            activity directly after finishing this one
	 */
	public void addProduct(final boolean addAnotherAfterwards) {
		// validation:
		if (!validateForm()) {
			return;
		}

		// show the loader:
		Util.showProgress(this);

		// populate db models with form data:
		final Article article = createArticleFromFormData();
		final ArrayList<ArticleImage> imagesList = addFormImageToArticle(article);
		final ProductEntry productEntry = createProductEntryFromFormData(article);

		ServerProxy entryProxy = ServerProxy.getInstanceFromConfig(this);
		if (entryProxy.getCurrentUser() != null) {
			// add the entry on the server:
			entryProxy.createProductEntry(productEntry, imagesList, entryProxy.new ProductEntryCallback() {
				@Override
				public void onReceive(ProductEntry receivedEntry) {
					AddProductActivity.this.onProductEntryAddedOnServer(receivedEntry, productEntry,
							addAnotherAfterwards);
				}
			});
		} else {
			// no user to add the entry with on the server -> exit the activity
			// straight away:
			finishAdding(addAnotherAfterwards);
		}

		// save the entry in the local database:
		final DatabaseManager dbManager = DatabaseManager.getInstance();
		dbManager.addProductEntry(productEntry);
	}

	/**
	 * Creates an {@link Article} from the data entered by the user
	 * 
	 * @return the requested {@link Article}
	 */
	private Article createArticleFromFormData() {
		EditText nameField = ((EditText) findViewById(R.id.product_name_field));

		Article article = new Article();

		article.barcode = ((EditText) findViewById(R.id.barcode_field)).getText().toString();
		article.name = nameField.getText().toString();

		return article;
	}

	/**
	 * Adds the image from the form to {@link Article#images} (if there is one)
	 * 
	 * @param article
	 *            the article to add the image to
	 * @return list of images (currently only contains 1 or 0
	 *         {@link ArticleImage}s)
	 */
	private ArrayList<ArticleImage> addFormImageToArticle(Article article) {
		final DatabaseManager dbManager = DatabaseManager.getInstance();
		final ArrayList<ArticleImage> imagesList = new ArrayList<ArticleImage>();
		final ImageView productImageView = (ImageView) findViewById(R.id.product_img);
		final BitmapDrawable drawable = ((BitmapDrawable) productImageView.getDrawable());
		final Bitmap productBitmap = drawable != null ? drawable.getBitmap() : null;

		article = dbManager.updateOrAddArticle(article);
		if (this.photoPath != null || productBitmap != null) {
			final Resources res = getResources();
			ArticleImage image = new ArticleImage();
			// TODO: Make hardcoded dimensions configurable:
			image.imageData = (this.photoPath != null) ? getPhotoData(300, 200) : getBitmapData(productBitmap,
					res.getDimensionPixelSize(R.dimen.product_img_width),
					res.getDimensionPixelSize(R.dimen.product_img_height));
			image.article = article;
			article.images = dbManager.initializeArticleImagesCollection();
			article.images.add(image);
			imagesList.add(image);
		}

		return imagesList;
	}

	/**
	 * Creates a {@link ProductEntry} from the form data
	 * 
	 * @param article
	 *            the article associated with the entry
	 * @return the requested {@link ProductEntry}
	 */
	private ProductEntry createProductEntryFromFormData(Article article) {
		final ProductEntry productEntry = new ProductEntry();
		productEntry.article = article;

		EditText amountField = ((EditText) findViewById(R.id.amount_field));
		String amountStr = amountField.getText().toString();
		if (amountStr.trim().equals("")) {
			amountStr = DEFAULT_AMOUNT;
		}
		productEntry.amount = Integer.parseInt(amountStr);
		productEntry.created_at = new DateTime();
		productEntry.updated_at = new DateTime();
		productEntry.description = ((EditText) findViewById(R.id.product_description_field)).getText().toString();

		DatePicker datePicker = (DatePicker) findViewById(R.id.expiration_date_field);
		productEntry.expiration_date = (new GregorianCalendar(datePicker.getYear(), datePicker.getMonth(),
				datePicker.getDayOfMonth())).getTime();
		productEntry.location = ProductListActivity.currentLocation;

		productEntry.inSync = false;

		return productEntry;
	}

	/**
	 * Sets the newly added entry's serverId in the local database and ends the
	 * activity
	 * 
	 * @param receivedEntry
	 *            entry received from the server
	 * @param productEntry
	 *            entry as in the local db
	 * @param addAnotherAfterwards
	 *            if true, the calling activity is asked to open another add
	 *            activity directly after finishing this one
	 */
	private void onProductEntryAddedOnServer(ProductEntry receivedEntry, ProductEntry productEntry,
			boolean addAnotherAfterwards) {
		if (receivedEntry != null) {
			final DatabaseManager dbManager = DatabaseManager.getInstance();

			productEntry.serverId = receivedEntry.serverId;
			productEntry.inSync = true;
			productEntry.created_at = receivedEntry.created_at;
			productEntry.updated_at = receivedEntry.updated_at;
			dbManager.updateProductEntry(productEntry);
		} else {
			Util.showMessage(this, "Adding to server failed");
		}

		finishAdding(addAnotherAfterwards);
	}

	/**
	 * hides the loader, sets the result, and finished the activity
	 * 
	 * @param addAnotherAfterwards
	 *            if true, the calling activity is asked to open another add
	 *            activity directly after finishing this one
	 */
	private void finishAdding(boolean addAnotherAfterwards) {
		Util.hideProgress();
		if (addAnotherAfterwards) {
			setResult(RESULT_OK_ADD_ANOTHER);
		} else {
			setResult(RESULT_OK);
		}
		finish();
	}
}
