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
import java.io.InputStream;

import android.graphics.Bitmap;
import android.graphics.Bitmap.CompressFormat;
import android.graphics.BitmapFactory;
import android.os.AsyncTask;
import android.util.Log;
import android.widget.ImageView;

import at.florian_lentsch.expirysync.db.DatabaseManager;
import at.florian_lentsch.expirysync.model.ArticleImage;

/**
 * Asynchronous task to download a product image from the server
 * 
 * @author Florian Lentsch <office@florian-lentsch.at>
 * 
 */
public class DownloadImageTask extends AsyncTask<String, Void, Bitmap> {
	ImageView thumbnailView;
	ArticleImage image;

	/**
	 * @param thumbnailView the thumbnail view to display the image in
	 */
	public DownloadImageTask(ImageView thumbnailView) {
		this(thumbnailView, null);
	}

	/**
	 * @param thumbnailView the thumbnail view to display the image in
	 * @param image image currently being displayed
	 */
	public DownloadImageTask(ImageView thumbnailView, ArticleImage image) {
		this.thumbnailView = thumbnailView;
		this.image = image;
	}

	/**
	 * (non-Javadoc)
	 * download product image from the server
	 */
	@Override
	protected Bitmap doInBackground(String... urls) {
		String urldisplay = urls[0];
		Bitmap thumb = null;
		try {
			InputStream in = new java.net.URL(urldisplay).openStream();
			thumb = BitmapFactory.decodeStream(in);
		} catch (Exception e) {
			Log.e("Error", e.getMessage());
			e.printStackTrace();
		}
		return thumb;
	}

	/**
	 * (non-Javadoc) 
	 * Saves the image data retrieved from the server in the local
	 * db (as a jpeg with a quality of 70)
	 */
	@Override
	protected void onPostExecute(Bitmap result) {
		thumbnailView.setImageBitmap(result);
		if (this.image != null) {
			ByteArrayOutputStream stream = new ByteArrayOutputStream();
			result.compress(CompressFormat.JPEG, 70, stream);
			image.imageData = stream.toByteArray();
			DatabaseManager.getInstance().updateArticleImage(image);
		}
	}
}
