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

import java.util.List;
import java.util.Map;

import org.apache.commons.lang.StringUtils;

import android.app.Activity;
import android.content.Context;
import android.content.SharedPreferences;
import android.os.Bundle;
import android.view.MenuItem;
import android.view.View;
import android.widget.EditText;

import at.florian_lentsch.expirysync.auth.User;
import at.florian_lentsch.expirysync.db.DatabaseManager;
import at.florian_lentsch.expirysync.net.ServerProxy;
import at.florian_lentsch.expirysync.util.Util;

public class RegistrationActivity extends Activity {
	@Override
	protected void onCreate(Bundle savedInstanceState) {
		super.onCreate(savedInstanceState);
		setContentView(R.layout.activity_registration);
	}

	@Override
	public boolean onOptionsItemSelected(MenuItem item) {
		switch (item.getItemId()) {
		case android.R.id.home:
			this.setResult(RESULT_CANCELED);
			this.finish();
			return true;
		}

		return super.onOptionsItemSelected(item);
	}

	/**
	 * Tries to register the user on the server using the form data. Currently
	 * only called by tapping {@code R.id.submit}
	 * 
	 * @param submitButton
	 *            the tapped button
	 */
	public void register(View submitButton) {
		// Retrieve form contents:
		final EditText accountNameField = ((EditText) findViewById(R.id.account_name));
		final EditText emailField = ((EditText) findViewById(R.id.email_address));
		final EditText passwordField = ((EditText) findViewById(R.id.password));

		final String username = accountNameField.getText().toString();
		final String email = emailField.getText().toString();
		final String password = passwordField.getText().toString();

		final ServerProxy serverProxy = ServerProxy.getInstanceFromConfig(this);

		final DatabaseManager dbManager = DatabaseManager.getInstance();
		ProductListActivity.currentLocation = dbManager.getDefaultLocation();

		final ServerProxy.UserCallback registerCallback = serverProxy.new UserCallback() {
			@Override
			public void onReceive(User receivedUser) {
				RegistrationActivity.this.onRegistrationSucceeded(receivedUser, password);
			}

			@Override
			public void onError(Map<String, List<String>> errors) {
				Util.showMessage(RegistrationActivity.this, getResources().getString(R.string.registration_failed));

				List<String> usernameErrors = errors.get("username");
				if (usernameErrors != null && usernameErrors.size() > 0) {
					accountNameField.setError(StringUtils.join(usernameErrors.toArray(), ", "));
				}

				List<String> emailErrors = errors.get("email");
				if (emailErrors != null && emailErrors.size() > 0) {
					emailField.setError(StringUtils.join(emailErrors.toArray(), ", "));
				}

				List<String> passwordErrors = errors.get("password");
				if (passwordErrors != null && passwordErrors.size() > 0) {
					passwordField.setError(StringUtils.join(passwordErrors.toArray(), ", "));
				}
			}
		};

		serverProxy.register(email.length() == 0 ? null : email, username.length() == 0 ? null : username, password,
				registerCallback);
	}

	/**
	 * Stores the login data in the shared preferences and exists the activity
	 * @param receivedUser user, that has just been registered
	 * @param password the user's password
	 */
	private void onRegistrationSucceeded(User receivedUser, String password) {
		Util.showMessage(this, getResources().getString(R.string.registration_succeeded));

		// store the login data in the shared preferences:
		SharedPreferences sharedPref = getApplicationContext().getSharedPreferences("main",
				Context.MODE_PRIVATE);
		String lastAccountName = sharedPref.getString(SettingsActivity.KEY_LAST_LOGIN_ACCOUNT_NAME, null);
		SharedPreferences.Editor editor = sharedPref.edit();
		editor.putString(SettingsActivity.KEY_ACCOUNT_NAME, receivedUser.toString());
		editor.putString(SettingsActivity.KEY_PASSWORD, password);
		editor.putString(SettingsActivity.KEY_LAST_LOGIN_ACCOUNT_NAME, receivedUser.toString());

		if (lastAccountName == null || !lastAccountName.equals(receivedUser.toString())) {
			if (ProductListActivity.currentLocation != null) {
				ProductListActivity.currentLocation.serverId = 0;
			}
			// as records must be re-fetched when we come back as that user,
			// delete them from the local db
			// (multiple location not yet implemented on the client):
			DatabaseManager.getInstance().deleteSynchronizedRecords();
			// Note: the unsynchronized records however will be upsynced
			// to the new user by the ProductListActivity after registration has
			// finished

			editor.remove(SettingsActivity.KEY_LAST_ENTRY_RETRIEVAL);
		}
		editor.commit();

		LoginActivity.loadDefaultLocation(this);

		if (ProductListActivity.currentLocation != null && ProductListActivity.currentLocation.serverId != 0) {
			setResult(RESULT_OK);
			this.finish();
		}
	}

	public void enterOfflineMode(View offlineModeButton) {
		this.setResult(RESULT_CANCELED);
		this.finish();
	}

	public void openLogin(View loginButton) {
		this.setResult(ProductListActivity.OPEN_LOGIN_RESULT_CODE);
		this.finish();
	}
}
