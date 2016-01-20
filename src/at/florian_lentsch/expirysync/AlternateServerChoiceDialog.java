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

import android.app.Activity;
import android.app.AlertDialog;
import android.app.Dialog;
import android.content.Context;
import android.content.DialogInterface;
import android.content.SharedPreferences;
import android.content.SharedPreferences.Editor;
import android.content.res.Resources;
import android.widget.ListAdapter;
import android.widget.ListView;
import at.florian_lentsch.expirysync.net.AlternateServer;
import at.florian_lentsch.expirysync.net.ServerProxy;
import at.florian_lentsch.expirysync.util.Util;

public class AlternateServerChoiceDialog extends Dialog {
	public AlternateServerChoiceDialog(final Activity activity, final List<AlternateServer> receivedServers,
			final SharedPreferences sharedPref) {
		super(activity);

		final Resources res = activity.getResources();

		// setting custom layout to dialog
		this.setContentView(R.layout.server_choice_dialog);
		this.setTitle(res.getString(R.string.choose_server_title));
		final ListView serverListView = (ListView) this.findViewById(R.id.server_list);

		AlternateServerAdapter.ServerTapListener tapListener = new AlternateServerAdapter.ServerTapListener() {
			@Override
			public void tapped(final AlternateServer alternateServer) {
				new AlertDialog.Builder(activity).setIcon(android.R.drawable.ic_dialog_alert)
						.setTitle(R.string.server_chosen).setMessage(R.string.confirm_server_choice)
						.setPositiveButton(R.string.yes, new DialogInterface.OnClickListener() {
							@Override
							public void onClick(DialogInterface dialog, int which) {
								if (alternateServer.url == null) {
									AlternateServerChoiceDialog.this.cancelChoosing(activity);
									return;
								}

								AlternateServerChoiceDialog.selectServer(alternateServer, sharedPref);
								Util.showMessage(activity, res.getString(R.string.server_chosen));
								AlternateServerChoiceDialog.this.dismiss();
							}
						}).setNegativeButton(R.string.no, new DialogInterface.OnClickListener() {
							@Override
							public void onClick(DialogInterface dialog, int which) {
								// re-initialize:
								AlternateServerChoiceDialog.this.dismiss();
								(new AlternateServerChoiceDialog(activity, receivedServers, sharedPref)).show();
							}
						}).show();
			}
		};
		ListAdapter adapter = new AlternateServerAdapter(activity, R.layout.server_list_item, receivedServers,
				tapListener);
		serverListView.setAdapter(adapter);

		this.setOnCancelListener(new OnCancelListener() {

			@Override
			public void onCancel(DialogInterface dialog) {
				AlternateServerChoiceDialog.this.cancelChoosing(activity);
			}
		});
	}

	private void cancelChoosing(Activity activity) {
		// cancel the parent activity (login/registration) as well:
		activity.setResult(Activity.RESULT_CANCELED);
		activity.finish();
		Util.hideProgress();
	}

	protected static void selectServer(AlternateServer alternateServer, SharedPreferences sharedPref) {
		Editor editor = sharedPref.edit();
		if (alternateServer != null) {
			editor.putString(SettingsActivity.KEY_HOST, alternateServer.url.toString());
		}
		editor.putBoolean(SettingsActivity.KEY_SERVER_CHOSEN, true);
		editor.commit();
		Util.hideProgress();
	}

	public static void showChoice(final Activity activity) {
		ServerProxy serverProxy = ServerProxy.getInstanceFromConfig(activity);
		Util.showProgress(activity);
		ServerProxy.AlternateServerListCallback serverListCallback = serverProxy.new AlternateServerListCallback() {

			@Override
			public void onReceive(List<AlternateServer> receivedServers) {
				SharedPreferences sharedPref = activity.getApplicationContext().getSharedPreferences("main",
						Context.MODE_PRIVATE);

				Resources res = activity.getResources();

				if (receivedServers == null) {
					receivedServers = new ArrayList<AlternateServer>();
				}

				try {
					receivedServers.add(
							0,
							new AlternateServer(sharedPref.getString(SettingsActivity.KEY_HOST, ""), res
									.getString(R.string.default_server_name), res
									.getString(R.string.default_server_description)));
					receivedServers.add(new AlternateServer(null, res.getString(R.string.offline_mode_server_name), res
							.getString(R.string.offline_mode_server_description)));
				} catch (URISyntaxException e) {
					// just don't add it
				}

				if (receivedServers.size() > 2) {
					(new AlternateServerChoiceDialog(activity, receivedServers, sharedPref)).show();
				} else {
					AlternateServerChoiceDialog.selectServer(
							receivedServers.size() > 0 ? receivedServers.get(0) : null, sharedPref);
				}
			}
		};
		serverProxy.getAlternateServers(serverListCallback);
	}
}