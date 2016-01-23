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

import java.util.Date;

import android.content.Context;
import android.content.SharedPreferences;
import android.content.SharedPreferences.OnSharedPreferenceChangeListener;
import android.os.Bundle;
import android.preference.EditTextPreference;
import android.preference.PreferenceActivity;
import android.preference.PreferenceManager;
import android.preference.PreferenceScreen;
import android.text.format.DateFormat;

import at.florian_lentsch.expirysync.settings.TimePreference;

/**
 * Activity to change preferences
 * @author Florian Lentsch <office@florian-lentsch.at>
 *
 */
public class SettingsActivity extends PreferenceActivity implements OnSharedPreferenceChangeListener {
	// keys used to identify specific settings:
	public static final String KEY_HOST = "pref_key_host";
	public static final String KEY_SEARCH_URL = "pref_key_search_url";
	public static final String KEY_ACCOUNT_NAME = "pref_key_email";
	public static final String KEY_PASSWORD = "pref_key_password";
	public static final String KEY_LAST_LOGIN_ACCOUNT_NAME = "pref_key_last_login_email";
	public static final String KEY_DAYS_BEFORE_MEDIUM = "pref_key_days_before_medium";
	public static final String KEY_DAYS_BEFORE_BAD = "pref_key_days_before_bad";
	public static final String KEY_ALERT_TIME = "pref_key_alert_time";
	public static final String KEY_LAST_ENTRY_RETRIEVAL = "pref_key_last_entry_retrieval";
	public static final String KEY_OFFLINE_MODE = "pref_key_offline_mode";
	public static final String KEY_SERVER_CHOSEN = "pref_key_server_chosen";

	private EditTextPreference hostPreference = null, searchUrlPreference = null, daysBeforeMediumPreference = null,
			daysBeforeBadPreference = null;
	private TimePreference alertTimePreference = null;
	
	private SharedPreferences sharedPreferences = null;

	@SuppressWarnings("deprecation")
	@Override
	public void onCreate(Bundle savedInstanceState) {
		super.onCreate(savedInstanceState);

		PreferenceManager prefMgr = getPreferenceManager();
		prefMgr.setSharedPreferencesName("main");
		prefMgr.setSharedPreferencesMode(Context.MODE_PRIVATE);
         
		addPreferencesFromResource(R.xml.main_preferences);

		PreferenceScreen preferenceScreen = getPreferenceScreen();
		this.sharedPreferences = preferenceScreen.getSharedPreferences();
		this.hostPreference = (EditTextPreference) preferenceScreen.findPreference(KEY_HOST);
		this.searchUrlPreference = (EditTextPreference) preferenceScreen.findPreference(KEY_SEARCH_URL);
		this.alertTimePreference = (TimePreference) preferenceScreen.findPreference(KEY_ALERT_TIME);
		this.daysBeforeMediumPreference = (EditTextPreference) preferenceScreen.findPreference(KEY_DAYS_BEFORE_MEDIUM);
		this.daysBeforeBadPreference = (EditTextPreference) preferenceScreen.findPreference(KEY_DAYS_BEFORE_BAD);
	}

	/**
	 * (non-Javadoc)
	 * Displays all the current preferences and registers a change listener
	 */
	@Override
	protected void onResume() {
		super.onResume();

		// initial values:
		this.hostPreference.setSummary(getResources().getString(R.string.setting_change_at_your_own_risk));
		this.searchUrlPreference.setSummary(this.sharedPreferences.getString(KEY_SEARCH_URL, ""));
		this.daysBeforeMediumPreference.setSummary(String.valueOf(this.sharedPreferences.getInt(KEY_DAYS_BEFORE_MEDIUM,
				0)));
		this.daysBeforeBadPreference.setSummary(String.valueOf(this.sharedPreferences.getInt(KEY_DAYS_BEFORE_BAD, 0)));
		
		long alertTime = this.sharedPreferences.getLong(KEY_ALERT_TIME, -1);
		String alertTimeStr = DateFormat.getTimeFormat(this.alertTimePreference.getContext()).format(new Date(alertTime));
		this.alertTimePreference.setSummary(alertTimeStr);
		
		// Set up a listener whenever a key changes
		this.sharedPreferences.registerOnSharedPreferenceChangeListener(this);
	}

	@Override
	protected void onPause() {
		super.onPause();
		// Unregister the listener whenever a key changes
		this.sharedPreferences.unregisterOnSharedPreferenceChangeListener(this);
	}

	/**
	 * (non-Javadoc)
	 * Displays the changes, that a user made on a specific preference
	 */
	@Override
	public void onSharedPreferenceChanged(SharedPreferences sharedPreferences, String key) {
		// Let's do something a preference value changes
		if (key.equals(KEY_SEARCH_URL)) {
			this.searchUrlPreference.setSummary(this.sharedPreferences.getString(KEY_SEARCH_URL, ""));
		} else if (key.equals(KEY_DAYS_BEFORE_MEDIUM)) {
			this.daysBeforeMediumPreference.setSummary(String.valueOf(this.sharedPreferences.getInt(
					KEY_DAYS_BEFORE_MEDIUM, 0)));
		} else if (key.equals(KEY_DAYS_BEFORE_BAD)) {
			this.daysBeforeBadPreference.setSummary(String.valueOf(this.sharedPreferences
					.getInt(KEY_DAYS_BEFORE_BAD, 0)));
		} else if (key.equals(KEY_ALERT_TIME)) {
			long alertTime = this.sharedPreferences.getLong(KEY_ALERT_TIME, -1);
			String alertTimeStr = DateFormat.getTimeFormat(this.alertTimePreference.getContext()).format(new Date(alertTime));
			this.alertTimePreference.setSummary(alertTimeStr);
		}
	}

}
