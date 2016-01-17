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

import java.net.URISyntaxException;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

import android.annotation.TargetApi;
import android.app.Activity;
import android.app.AlertDialog;
import android.app.Dialog;
import android.content.Context;
import android.content.DialogInterface;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.SharedPreferences.Editor;
import android.os.Build;
import android.os.Bundle;
import android.view.Menu;
import android.view.MenuItem;
import android.view.View;
import android.widget.EditText;
import android.widget.ListAdapter;
import android.widget.ListView;

import at.florian_lentsch.expirysync.auth.User;
import at.florian_lentsch.expirysync.db.DatabaseManager;
import at.florian_lentsch.expirysync.model.Location;
import at.florian_lentsch.expirysync.net.AlternateServer;
import at.florian_lentsch.expirysync.net.ServerProxy;
import at.florian_lentsch.expirysync.util.Util;

/**
 * Activity containing a login form
 * 
 * @author Florian Lentsch <office@florian-lentsch.at>
 * 
 */
public class LoginActivity extends Activity {
	@Override
	protected void onCreate(Bundle savedInstanceState) {
		super.onCreate(savedInstanceState);

		// Retrieve login data from the shared preferences (stored at previous
		// logins), if there is any:
		final SharedPreferences sharedPref = this.getApplicationContext().getSharedPreferences("main",
				Context.MODE_PRIVATE);
		String accountName = sharedPref.getString(SettingsActivity.KEY_ACCOUNT_NAME, "");
		String password = sharedPref.getString(SettingsActivity.KEY_PASSWORD, "");
		Boolean serverChosen = sharedPref.getBoolean(SettingsActivity.KEY_SERVER_CHOSEN, false);

		if (!serverChosen) {
			ServerProxy serverProxy = ServerProxy.getInstanceFromConfig(this);
			Util.showProgress(this);
			ServerProxy.AlternateServerListCallback serverListCallback = serverProxy.new AlternateServerListCallback() {

				@Override
				public void onReceive(List<AlternateServer> receivedServers) {
					final Dialog dialog = new Dialog(LoginActivity.this);

					//setting custom layout to dialog
					dialog.setContentView(R.layout.server_choice_dialog);
					dialog.setTitle("Choose a server");
					final ListView serverListView = (ListView) dialog.findViewById(R.id.server_list);
					try {
						receivedServers.add(0, new AlternateServer(sharedPref.getString(SettingsActivity.KEY_HOST, ""), "Default Server", "No remotes"));
					}
					catch(URISyntaxException e) {
						// just don't add it
					}
					AlternateServerAdapter.ServerTapListener tapListener = new AlternateServerAdapter.ServerTapListener() {
						
						@Override
						public void tapped(AlternateServer alternateServer) {
							Editor editor = sharedPref.edit();
							editor.putString(SettingsActivity.KEY_HOST, alternateServer.url.toString());
							editor.putBoolean(SettingsActivity.KEY_SERVER_CHOSEN, true);
							editor.commit();
							dialog.dismiss();
							Util.hideProgress();				
						}
					};
					ListAdapter adapter = new AlternateServerAdapter(LoginActivity.this, R.layout.server_list_item, receivedServers, tapListener);
					serverListView.setAdapter(adapter);
					dialog.show();
				}
			};
			serverProxy.getAlternateServers(serverListCallback);
		} else if (accountName.length() > 0) {
			// log in immediately, if the calling activity asked for it:
			Bundle bundle = getIntent().getExtras();
			boolean loginImmediately = (bundle == null) ? false : bundle
					.getBoolean(ProductListActivity.EXTRA_LOGIN_IMMEDIATELY);
			if (loginImmediately) {
				loginWithSettingsData();
				return;
			}
		}

		setContentView(R.layout.activity_login);

		// fill form fields with the retrieved data:
		EditText accountNameField = ((EditText) findViewById(R.id.account_name));
		EditText passwordField = ((EditText) findViewById(R.id.password));
		accountNameField.setText(accountName);
		passwordField.setText(password);
	}

	@TargetApi(Build.VERSION_CODES.HONEYCOMB)
	private void setupActionBar() {
		if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.HONEYCOMB) {
			getActionBar().setDisplayHomeAsUpEnabled(true);
		}
	}

	@Override
	public boolean onCreateOptionsMenu(Menu menu) {
		return super.onCreateOptionsMenu(menu);
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
	 * Tries to login with data from shared preferences
	 */
	private void loginWithSettingsData() {
		final SharedPreferences sharedPref = this.getApplicationContext().getSharedPreferences("main",
				Context.MODE_PRIVATE);
		final String accountName = sharedPref.getString(SettingsActivity.KEY_ACCOUNT_NAME, "");
		final String password = sharedPref.getString(SettingsActivity.KEY_PASSWORD, "");

		final ServerProxy serverProxy = ServerProxy.getInstanceFromConfig(this);
		final DatabaseManager dbManager = DatabaseManager.getInstance();
		ProductListActivity.currentLocation = dbManager.getDefaultLocation();

		final ServerProxy.UserCallback loginCallback = serverProxy.new UserCallback() {

			@Override
			public void onReceive(User receivedUser) {
				final String lastLoginAccountName = sharedPref.getString(SettingsActivity.KEY_LAST_LOGIN_ACCOUNT_NAME,
						null);
				SharedPreferences.Editor editor = sharedPref.edit();
				if (lastLoginAccountName == null || !lastLoginAccountName.equals(accountName)) {
					if (ProductListActivity.currentLocation != null) {
						ProductListActivity.currentLocation.serverId = 0;
					}
					dbManager.deleteSynchronizedRecords();
					// -> must be re-fetched when we come back as that user
					// the unsynchronized records however will be upsynced
					// to the new user by the
					// ProductListActivity after login has finished

					editor.remove(SettingsActivity.KEY_LAST_ENTRY_RETRIEVAL);
				}
				editor.putString(SettingsActivity.KEY_LAST_LOGIN_ACCOUNT_NAME, accountName);
				editor.commit();

				Util.showMessage(LoginActivity.this, getResources().getString(R.string.login_succeeded) + ": "
						+ receivedUser.toString());
				LoginActivity.loadDefaultLocation(LoginActivity.this);
				if (ProductListActivity.currentLocation != null && ProductListActivity.currentLocation.serverId != 0) {
					LoginActivity.this.setResult(RESULT_OK);
					LoginActivity.this.finish();
				}
			}

			@Override
			public void onError(Map<String, List<String>> errors) {
				Util.showMessage(LoginActivity.this, getResources().getString(R.string.login_failed));

				LoginActivity.this.setContentView(R.layout.activity_login);
				EditText accountNameField = ((EditText) findViewById(R.id.account_name));
				EditText passwordField = ((EditText) findViewById(R.id.password));
				accountNameField.setText(accountName);
				passwordField.setText(password);
			}
		};

		serverProxy.login(accountName, password, loginCallback);
	}

	/**
	 * Sets the default location for further server calls (Note: Currently there
	 * only ever is one location, this is done for future compatibility)
	 * 
	 * @param activity
	 *            activity to display messages in
	 */
	protected static void loadDefaultLocation(final Activity activity) {
		final ServerProxy serverProxy = ServerProxy.getInstanceFromConfig(activity);
		final DatabaseManager dbManager = DatabaseManager.getInstance();

		final ServerProxy.LocationCallback locationCallback = serverProxy.new LocationCallback() {

			@Override
			public void onReceive(Location receivedLocation) {
				if (receivedLocation != null) {
					if (ProductListActivity.currentLocation == null) {
						receivedLocation.isDefault = true;
						dbManager.addLocation(receivedLocation);
						ProductListActivity.currentLocation = receivedLocation;
					} else {
						ProductListActivity.currentLocation.serverId = receivedLocation.serverId;
						dbManager.updateLocation(ProductListActivity.currentLocation);
					}
					// Util.showMessage(activity,
					// "Location successfully created: " +
					// receivedLocation.name);
					activity.setResult(RESULT_OK);
					activity.finish();
				} else {
					Util.showMessage(activity, "Creating new location failed");
					activity.setResult(RESULT_CANCELED);
					activity.finish();
				}
			}
		};

		final ServerProxy.LocationListCallback locationListCallback = serverProxy.new LocationListCallback() {

			@Override
			public void onReceive(List<Location> receivedLocations) {
				for (Location curLocation : receivedLocations) {
					if (curLocation.name.equals("Default")) {
						// Util.showMessage(activity,
						// "Recycling default location: " + curLocation.name);
						if (ProductListActivity.currentLocation == null) {
							// locally create location existing on the server:
							curLocation.isDefault = true;
							dbManager.addLocation(curLocation);
							ProductListActivity.currentLocation = curLocation;
						} else {
							// Set the server id for our temporary location:
							ProductListActivity.currentLocation.serverId = curLocation.serverId;
							dbManager.updateLocation(ProductListActivity.currentLocation);
						}
						activity.setResult(RESULT_OK);
						activity.finish();

						return;
					}
				}

				// No default location (neither on the server nor on the client)
				// create it anew:
				Location newLoc = new Location();
				newLoc.name = "Default";

				serverProxy.createLocation(newLoc, locationCallback);
			}
		};

		if (ProductListActivity.currentLocation == null || ProductListActivity.currentLocation.serverId == 0) {
			serverProxy.getMyLocations(locationListCallback);
		}
	}

	public void openRegistration(View registerButton) {
		this.setResult(ProductListActivity.OPEN_REGISTRATION_RESULT_CODE);
		this.finish();
	}

	public void enterOfflineMode(View offlineModeButton) {
		this.setResult(RESULT_CANCELED);
		this.finish();
	}

	public void performLogin(View loginButton) {
		EditText accountNameField = ((EditText) findViewById(R.id.account_name));
		EditText passwordField = ((EditText) findViewById(R.id.password));
		SharedPreferences sharedPref = this.getApplicationContext().getSharedPreferences("main", Context.MODE_PRIVATE);
		SharedPreferences.Editor editor = sharedPref.edit();

		editor.putString(SettingsActivity.KEY_ACCOUNT_NAME, accountNameField.getText().toString());
		editor.putString(SettingsActivity.KEY_PASSWORD, passwordField.getText().toString());
		editor.commit();

		loginWithSettingsData();
	}

	/**
	 * (non-Javadoc) Finishes the activity when the child registration activity
	 * has finished successfully
	 */
	@Override
	protected void onActivityResult(int requestCode, int resultCode, Intent data) {
		switch (requestCode) {
		case ProductListActivity.REGISTER_RESULT:
			if (resultCode == RESULT_OK) {
				setResult(RESULT_OK);
				finish();
			}
			break;
		}
	}
}
