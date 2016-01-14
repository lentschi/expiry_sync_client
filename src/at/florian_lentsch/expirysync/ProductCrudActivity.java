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

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.IOException;
import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Date;

import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.res.Resources;
import android.graphics.Bitmap;
import android.graphics.Bitmap.CompressFormat;
import android.graphics.BitmapFactory;
import android.net.Uri;
import android.os.Bundle;
import android.os.Environment;
import android.provider.MediaStore;
import android.util.Log;
import android.view.View;
import android.view.View.OnFocusChangeListener;
import android.widget.EditText;
import android.widget.ImageView;

import at.florian_lentsch.expirysync.db.DatabaseManager;
import at.florian_lentsch.expirysync.model.Article;
import at.florian_lentsch.expirysync.model.ArticleImage;
import at.florian_lentsch.expirysync.net.ServerProxy;
import at.florian_lentsch.expirysync.util.Util;

/**
 * Base class for any product entry form activities handles validation, barcode
 * scanning, and taking product photos
 * 
 * @author Florian Lentsch <office@florian-lentsch.at>
 * 
 */
public class ProductCrudActivity extends UndeprecatedActionBarActivity {
	/**
	 * default amount that should be saved for a new product entry (if nothing
	 * is entered by the user)
	 */
	public static final String DEFAULT_AMOUNT = "1";

	// activity result codes:
	public final static int SCAN_BARCODE_RESULT = 0, TAKE_PHOTO_RESULT = 1;

	protected String photoPath = null;
	protected String barcodeBefore = "";

	@Override
	protected void onCreate(Bundle savedInstanceState) {
		super.onCreate(savedInstanceState);
	}

	protected void loadPhotoFromSaveInstanceState(Bundle savedInstanceState) {
		if (savedInstanceState != null) {
			this.photoPath = savedInstanceState.getString("photoPath");
			if (this.photoPath != null) {
				ImageView photoThumbView = ((ImageView) findViewById(R.id.product_img));
				Resources res = getResources();
				Bitmap productPhoto = this.getPhotoAsBitmap(res.getDimensionPixelSize(R.dimen.product_img_width),
						res.getDimensionPixelSize(R.dimen.product_img_height));

				photoThumbView.setImageBitmap(productPhoto);
			}
		}
	}

	@Override
	protected void onSaveInstanceState(Bundle outState) {
		super.onSaveInstanceState(outState);

		outState.putString("photoPath", this.photoPath);
	}

	/**
	 * Initializes form fields Currently this just adds a listener to the
	 * barcode field.
	 */
	protected void initFormFields() {
		EditText barcodeTxt = ((EditText) findViewById(R.id.barcode_field));
		barcodeTxt.setOnFocusChangeListener(new OnFocusChangeListener() {
			@Override
			public void onFocusChange(View v, boolean hasFocus) {
				if (!hasFocus) {
					ProductCrudActivity.this.setFieldsByBarcode();
				}
			}
		});
	}

	/**
	 * Starts the barcode scan
	 * 
	 * @param view
	 *            the button that was tapped
	 */
	public void scanBarcode(View view) {
		Intent intent = new Intent(this, ScanBarcodeActivity.class);
		startActivityForResult(intent, SCAN_BARCODE_RESULT);
	}

	/**
	 * Launches the camera activity to take a picture
	 * 
	 * @param view
	 *            the button that was tapped
	 */
	public void takePhoto(View view) {
		Intent takePictureIntent = new Intent(MediaStore.ACTION_IMAGE_CAPTURE);
		Uri fileUri = getOutputMediaFileUri();
		takePictureIntent.putExtra(MediaStore.EXTRA_OUTPUT, fileUri);
		Log.d("DBG", "Going to save photo in: " + fileUri);
		startActivityForResult(takePictureIntent, TAKE_PHOTO_RESULT);
	}

	private Uri getOutputMediaFileUri() {
		File outputDir = new File(Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_PICTURES),
				"ProductPhotos");
		if (!outputDir.exists()) {
			if (!outputDir.mkdirs()) {
				Log.d("DBG", "failed to create photo directory");
				return null;
			}
		}

		File outputFile = null;
		String timeStamp = new SimpleDateFormat("yyyyMMdd_HHmmss").format(new Date());
		try {
			outputFile = File.createTempFile("productPhoto_" + timeStamp, ".jpg", outputDir);
		} catch (IOException e) {
			e.printStackTrace();
			return null;
		}
		this.photoPath = outputFile.getAbsolutePath();
		return Uri.fromFile(outputFile);
	}

	protected void onActivityResult(int requestCode, int resultCode, Intent data) {
		switch (requestCode) {
		case SCAN_BARCODE_RESULT:
			if (resultCode == RESULT_OK) {
				String barcode = data.getStringExtra(ScanBarcodeActivity.SCANNED_BARCODE);
				((EditText) findViewById(R.id.barcode_field)).setText(barcode);
				((EditText) findViewById(R.id.product_name_field)).requestFocus();
				setFieldsByBarcode();
			}
			break;
		case TAKE_PHOTO_RESULT:
			if (resultCode == RESULT_OK) {
				ImageView photoThumbView = ((ImageView) findViewById(R.id.product_img));
				Resources res = getResources();
				Bitmap productPhoto = this.getPhotoAsBitmap(res.getDimensionPixelSize(R.dimen.product_img_width),
						res.getDimensionPixelSize(R.dimen.product_img_height));

				photoThumbView.setImageBitmap(productPhoto);
			}
			break;
		}
	}

	protected Bitmap getPhotoAsBitmap(int targetW, int targetH) {
		BitmapFactory.Options bmOptions = new BitmapFactory.Options();
		bmOptions.inJustDecodeBounds = true;
		BitmapFactory.decodeFile(this.photoPath, bmOptions);
		int photoW = bmOptions.outWidth;
		int photoH = bmOptions.outHeight;

		// Determine how much to scale down the image
		int scaleFactor = Math.min(photoW / targetW, photoH / targetH);

		// Decode the image file into a Bitmap sized to fill the View
		bmOptions.inJustDecodeBounds = false;
		bmOptions.inSampleSize = scaleFactor;

		Bitmap bitmap = BitmapFactory.decodeFile(this.photoPath, bmOptions);

		return bitmap;
	}

	protected byte[] getBitmapData(Bitmap bitmap, int targetW, int targetH) {
		ByteArrayOutputStream stream = new ByteArrayOutputStream();
		bitmap.compress(CompressFormat.JPEG, 70, stream);
		byte[] result = stream.toByteArray();

		return result;
	}

	protected byte[] getPhotoData(int targetW, int targetH) {
		Bitmap bitmap = this.getPhotoAsBitmap(targetW, targetH);

		return this.getBitmapData(bitmap, targetW, targetH);
	}

	/**
	 * Retrieves article data using the barcode in the
	 * {@code R.id.barcode_field} field. The retrieved data (if any) is used to
	 * set the other fields' values. If no data can be retrieved from the local
	 * db, the server is queried. If the article cannot be found there either,
	 * the fields are reset.
	 */
	protected void setFieldsByBarcode() {
		String barcode = ((EditText) findViewById(R.id.barcode_field)).getText().toString();
		if (barcode.equals(this.barcodeBefore)) {
			return;
		}
		this.barcodeBefore = barcode;

		Util.showProgress(this);
		Article article = DatabaseManager.getInstance().findArticleByBarcode(barcode);
		if (article != null) {
			((EditText) findViewById(R.id.product_name_field)).setText(article.name);
			Util.hideProgress();
		} else {
			// First empty the fields...:
			((EditText) findViewById(R.id.product_name_field)).setText("");

			// ...then try to fetch them from the server:
			ServerProxy articleProxy = ServerProxy.getInstanceFromConfig(this);
			articleProxy.getArticleByBarcode(barcode, articleProxy.new ArticleCallback() {
				@Override
				public void onReceive(Article receivedArticle, ArrayList<ArticleImage> receivedImages) {
					ProductCrudActivity.this.setFormFieldByReceivedArticle(receivedArticle, receivedImages);
					Util.hideProgress();
				}

				@Override
				public void onConnectionError() {
					Util.showMessage(ProductCrudActivity.this, "Server down - not found in local db");
					Util.hideProgress();
				}
			});
		}
	}
	
	private void setFormFieldByReceivedArticle(Article receivedArticle, ArrayList<ArticleImage> receivedImages) {
		if (receivedArticle != null) {
			EditText nameField = (EditText) findViewById(R.id.product_name_field);
			nameField.setText(receivedArticle.name);

			if (receivedImages.size() > 0) {
				ArticleImage receivedImage = receivedImages.get(0);
				final SharedPreferences sharedPref = ProductCrudActivity.this.getApplicationContext()
						.getSharedPreferences("main", Context.MODE_PRIVATE);
				String hostStr = sharedPref.getString(SettingsActivity.KEY_HOST, "");
				new DownloadImageTask((ImageView) findViewById(R.id.product_img)).execute(hostStr
						+ "article_images/" + receivedImage.serverId + "/serve");
			}
		} else {
			Util.showMessage(this, getResources().getString(R.string.not_found));
		}
	}

	/**
	 * validates the form's fields and displays any validation errors (this is
	 * local validation only - no server involved)
	 * 
	 * @return true, if not validation errors occurred
	 */
	protected boolean validateForm() {
		final Resources res = getResources();
		EditText nameField = ((EditText) findViewById(R.id.product_name_field));
		EditText amountField = ((EditText) findViewById(R.id.amount_field));
		String amountStr = amountField.getText().toString();

		boolean validationFailed = false;
		if (nameField.getText().toString().trim().equals("")) {
			validationFailed = true;
			nameField.setError(res.getString(R.string.name_may_not_be_empty));
		}

		if (!amountStr.trim().equals("") && (!amountStr.trim().matches("^-?\\d+$") || Integer.parseInt(amountStr) < 1)) {
			validationFailed = true;
			amountField.setError(res.getString(R.string.amount_invalid));
		}

		if (validationFailed) {
			Util.showMessage(ProductCrudActivity.this, res.getString(R.string.saving_entry_failed));
			return false;
		}

		return true;
	}
}
