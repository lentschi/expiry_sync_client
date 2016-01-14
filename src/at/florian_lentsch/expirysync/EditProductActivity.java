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
import java.util.Calendar;
import java.util.Date;
import java.util.GregorianCalendar;

import org.joda.time.DateTime;

import android.annotation.TargetApi;
import android.app.ActionBar;
import android.app.AlertDialog;
import android.content.Context;
import android.content.DialogInterface;
import android.content.SharedPreferences;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
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
 * Activity displaying a form to edit a product entry starting the activity
 * requires {@link android.content.Intent} to have an extra with
 * {@link ProductListActivity#EXTRA_PRODUCT_ENTRY_ID} set to the ID of the entry
 * to edit
 * 
 * @author Florian Lentsch <office@florian-lentsch.at>
 * 
 */
public class EditProductActivity extends ProductCrudActivity {
	/**
	 * the product entry to edit as passed by the the calling activity
	 */
	private ProductEntry curEntry = null;

	@Override
	protected void onCreate(Bundle savedInstanceState) {
		super.onCreate(savedInstanceState);
		setContentView(R.layout.product_form);
		loadPhotoFromSaveInstanceState(savedInstanceState);
		initFormFields();
		setupActionBar();
		setupEditForm();
	}

	/**
	 * Set up the {@link android.app.ActionBar}, if the API is available.
	 */
	@TargetApi(Build.VERSION_CODES.HONEYCOMB)
	private void setupActionBar() {
		ActionBar actionBar = null;
		if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.HONEYCOMB && (actionBar = getActionBar()) != null) {
			// TODO: Find out, why this is not being done for android 4 for example:
			actionBar.setDisplayHomeAsUpEnabled(true);
		}
	}

	@Override
	public boolean onCreateOptionsMenu(Menu menu) {
		// Inflate the menu; this adds items to the action bar if it is present.
		getMenuInflater().inflate(R.menu.edit_product, menu);
		return true;
	}

	@Override
	public boolean onOptionsItemSelected(MenuItem item) {
		switch (item.getItemId()) {
		case android.R.id.home:
			NavUtils.navigateUpFromSameTask(this);
			return true;
		case R.id.action_save:
			this.editProduct();
			break;
		case R.id.action_cancel_editing:
			setResult(RESULT_CANCELED);
			finish();
			break;
		case R.id.action_delete:
			this.confirmProductDeletion();
			break;
		}

		return super.onOptionsItemSelected(item);
	}

	/**
	 * fill all the form fields with {@link #curEntry}'s data
	 */
	private void setupEditForm() {
		Bundle bundle = getIntent().getExtras();
		int id = bundle.getInt(ProductListActivity.EXTRA_PRODUCT_ENTRY_ID);
		this.curEntry = DatabaseManager.getInstance().getProductEntryById(id);

		Article article = this.curEntry.article;
		((EditText) findViewById(R.id.barcode_field)).setText(article.barcode);
		((EditText) findViewById(R.id.product_name_field)).setText(article.name);
		((EditText) findViewById(R.id.product_description_field)).setText(this.curEntry.description);
		((EditText) findViewById(R.id.amount_field)).setText(Integer.toString(this.curEntry.amount));
		if (this.photoPath == null) {
			ArticleImage image = this.curEntry.article.getBestImage();
			if (image != null) {
				if (image.imageData != null) {
					Bitmap bmp = BitmapFactory.decodeByteArray(image.imageData, 0, image.imageData.length);
					((ImageView) findViewById(R.id.product_img)).setImageBitmap(bmp);
				} else {
					// there is an image, but don't have its data in the local db
					// -> download it from the server:
					final SharedPreferences sharedPref = this.getApplicationContext().getSharedPreferences("main",
							Context.MODE_PRIVATE);
					String hostStr = sharedPref.getString(SettingsActivity.KEY_HOST, "");
					new DownloadImageTask((ImageView) findViewById(R.id.product_img), image).execute(hostStr
							+ "article_images/" + image.serverId + "/serve");
				}
			}
		}

		Date expirationDate = this.curEntry.expiration_date;
		Calendar cal = Calendar.getInstance();
		cal.setTime(expirationDate);
		int year = cal.get(Calendar.YEAR), month = cal.get(Calendar.MONTH), day = cal.get(Calendar.DAY_OF_MONTH);
		((DatePicker) findViewById(R.id.expiration_date_field)).updateDate(year, month, day);
	}

	/**
	 * Saves the edit form and then ends the activity
	 */
	public void editProduct() {
		// validation:
		if (!this.validateForm()) {
			return;
		}
		
		// show the loader: 
		Util.showProgress(this);
		
		// populate db models with form data:
		updateCurrentEntryFromFormData();
		final ArrayList<ArticleImage> imagesList = setFormImageToCurrentEntry();

		this.curEntry.inSync = false;
		ServerProxy entryProxy = ServerProxy.getInstanceFromConfig(this);
		if (entryProxy.getCurrentUser() != null && this.curEntry.serverId > 0) {
			// update the entry on the server:
			entryProxy.updateProductEntry(this.curEntry, imagesList, entryProxy.new ProductEntryCallback() {
				@Override
				public void onReceive(ProductEntry receivedEntry) {
					EditProductActivity.this.onProductEntryUpdatedOnServer(receivedEntry);
				}
			});
		} else {
			// no user to update the entry with on the server -> exit the activity straight away:
			finishEditing();
		}

		// update the entry in the local db:
		final DatabaseManager dbManager = DatabaseManager.getInstance();
		dbManager.updateProductEntry(this.curEntry);
	}
	
	/**
	 * Updates the entry that is being edited with data entered by the user
	 */
	private void updateCurrentEntryFromFormData() {
		final DatabaseManager dbManager = DatabaseManager.getInstance();
		
		EditText nameField = ((EditText) findViewById(R.id.product_name_field));
		EditText amountField = ((EditText) findViewById(R.id.amount_field));
		String amountStr = amountField.getText().toString();
		
		this.curEntry.article.barcode = ((EditText) findViewById(R.id.barcode_field)).getText().toString();
		this.curEntry.article.name = nameField.getText().toString();

		this.curEntry.article = dbManager.updateOrAddArticle(this.curEntry.article);

		if (amountStr.trim().equals("")) {
			amountStr = DEFAULT_AMOUNT; 
		}
		this.curEntry.amount = Integer.parseInt(amountStr);
		this.curEntry.description = ((EditText) findViewById(R.id.product_description_field)).getText().toString();

		DatePicker datePicker = (DatePicker) findViewById(R.id.expiration_date_field);
		this.curEntry.expiration_date = (new GregorianCalendar(datePicker.getYear(), datePicker.getMonth(),
				datePicker.getDayOfMonth())).getTime();
	}
	
	/**
	 * Adds the image from the form to {@link Article#images} (if there is one)
	 * @return list of images (currently only contains 1 or 0
	 *         {@link ArticleImage}s)
	 */
	private ArrayList<ArticleImage> setFormImageToCurrentEntry() {
		final ArrayList<ArticleImage> imagesList = new ArrayList<ArticleImage>();
		if (this.photoPath == null) {
			return imagesList;
		}
		
		ArticleImage image = new ArticleImage();
		// TODO: Make image properties configurable:
		image.imageData = getPhotoData(300, 200);
		image.article = this.curEntry.article;
		this.curEntry.article.images.add(image);
		imagesList.add(image);
		return imagesList;
	}
	
	/**
	 * sets the updated entry's serverId in the local db and exits the activity
	 * @param receivedEntry entry received from the server
	 */
	private void onProductEntryUpdatedOnServer(ProductEntry receivedEntry) {
		if (receivedEntry != null) {
			final DatabaseManager dbManager = DatabaseManager.getInstance();
			
			this.curEntry.serverId = receivedEntry.serverId;
			this.curEntry.updated_at = receivedEntry.updated_at;
			this.curEntry.inSync = true;
			dbManager.updateProductEntry(this.curEntry);
		} else {
			Util.showMessage(this, "Updating on server failed");
		}

		finishEditing();
	}
	
	/**
	 * Shows a 'really delete this entry'-dialog 
	 */
	public void confirmProductDeletion() {
		new AlertDialog.Builder(this).setIcon(android.R.drawable.ic_dialog_alert).setTitle(R.string.delete_product)
				.setMessage(R.string.really_delete_product)
				.setPositiveButton(R.string.yes, new DialogInterface.OnClickListener() {

					@Override
					public void onClick(DialogInterface dialog, int which) {
						EditProductActivity.this.deleteProduct();
					}
				}).setNegativeButton(R.string.no, null).show();
	}
	
	/**
	 * Deletes {@link #curEntry} from the local db and (if possible) from the server
	 */
	private void deleteProduct() {
		final DatabaseManager dbManager = DatabaseManager.getInstance();

		final ServerProxy entryProxy = ServerProxy.getInstanceFromConfig(this);
		if (entryProxy.getCurrentUser() != null && this.curEntry.serverId > 0) {
			entryProxy.deleteProductEntry(this.curEntry,
					entryProxy.new ProductEntryCallback() {
						@Override
						public void onReceive(ProductEntry receivedEntry) {
							if (receivedEntry == null) {
								Util.showMessage(EditProductActivity.this,
										"Deleting from server failed: ");
							}
						}
					});
			dbManager.deleteProductEntry(this.curEntry);
		} else {
			this.curEntry.deleted_at = new DateTime();
			this.curEntry.inSync = false;
			dbManager.updateProductEntry(this.curEntry);
		}

		this.curEntry = null;

		finishEditing();
	}
	
	/**
	 * hides the loader, sets the result, and finished the activity
	 */
	private void finishEditing() {
		Util.hideProgress();
		setResult(RESULT_OK);
		finish();		
	}
}
