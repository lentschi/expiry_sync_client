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

package at.florian_lentsch.expirysync.util;

import at.florian_lentsch.expirysync.R;

import android.app.Activity;
import android.app.ProgressDialog;
import android.text.TextUtils;
import android.util.Log;
import android.widget.Toast;

/**
 * General utility methods
 * 
 * @author Florian Lentsch <office@florian-lentsch.at>
 * 
 */
public class Util {
	private static ProgressDialog progressDialog;

	/**
	 * Shows a message using {@link Toast}
	 * 
	 * @param activity
	 *            the activity to get the context from
	 * @param msg
	 *            the message to display
	 */
	public static void showMessage(final Activity activity, final String msg) {
		Log.d("DBG", "Message: " + msg);
		if (TextUtils.isEmpty(msg))
			return;

		activity.runOnUiThread(new Runnable() {
			@Override
			public void run() {
				Toast.makeText(activity.getBaseContext(), msg, Toast.LENGTH_SHORT).show();
			}
		});
	}

	/**
	 * Displays 'Loading' (or the locale dependent equivalent) in a
	 * {@link ProgressDialog}
	 * 
	 * @param activity
	 */
	public static void showProgress(final Activity activity) {
		Util.progressDialog = ProgressDialog
				.show(activity, "", activity.getResources().getText(R.string.loading), true);
	}

	/**
	 * Hides the 'Loading' dialog or does nothing if there is none open
	 */
	public static void hideProgress() {
		if (Util.progressDialog == null) {
			return; // just ignore the fact, that it's not open in the first
					// place
		}

		Util.progressDialog.dismiss();
	}
}
