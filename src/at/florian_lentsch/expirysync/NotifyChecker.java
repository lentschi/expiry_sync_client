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
import java.util.List;
import java.util.TimeZone;

import org.apache.commons.lang.StringUtils;
import org.joda.time.DateTime;

import android.app.AlarmManager;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.res.Resources;
import android.provider.Settings;
import android.support.v4.app.NotificationCompat;
import android.support.v4.app.TaskStackBuilder;
import android.util.Log;

import at.florian_lentsch.expirysync.db.DatabaseManager;
import at.florian_lentsch.expirysync.model.ProductEntry;

/**
 * Handles daily checking for expired products (or products that going to expire
 * soon)
 * 
 * @author Florian Lentsch <office@florian-lentsch.at>
 * 
 */
public class NotifyChecker extends BroadcastReceiver {
	static final int WASTE_NOTIFICATION = 1;

	/**
	 * Sets the alarm that checks for products soon to expire (or already have
	 * expired)
	 * 
	 * @param context
	 */
	protected static void setAlarm(Context context) {
		Context appContext = context.getApplicationContext();
		Intent receiverIntent = new Intent(appContext, NotifyChecker.class);

		// Fetch info about when the alarm is to sound each day from the shared
		// preferences:
		long firstStartMillis = getFirstStartMillis(appContext);
		if (firstStartMillis < 0) {
			Log.i("Alarm", "Alert time not configured - not setting alarm");
			return;
		}

		Calendar calendar = Calendar.getInstance();
		calendar.setTimeInMillis(firstStartMillis);
		// Log.i("Alarm", "Setting alarm: " + firstStartMillis + ", " + (new
		// SimpleDateFormat("EEE, dd MMM yyyy HH:mm:ss z",
		// Locale.US)).format(firstStartMillis));

		// Set the alarm:
		PendingIntent alarmIntent = PendingIntent.getBroadcast(appContext, 0, receiverIntent,
				PendingIntent.FLAG_UPDATE_CURRENT);
		AlarmManager alarmMgr = (AlarmManager) appContext.getSystemService(Context.ALARM_SERVICE);
		alarmMgr.setRepeating(AlarmManager.RTC_WAKEUP, firstStartMillis, AlarmManager.INTERVAL_DAY, alarmIntent);
	}

	private static long getFirstStartMillis(Context appContext) {
		final SharedPreferences sharedPref = appContext.getSharedPreferences("main", Context.MODE_PRIVATE);
		long firstStartMillis = sharedPref.getLong(SettingsActivity.KEY_ALERT_TIME, -1);
		if (firstStartMillis == -1) {
			return -1;
		}

		Calendar midnight = Calendar.getInstance(TimeZone.getTimeZone("UTC"));
		midnight.set(Calendar.HOUR_OF_DAY, 0);
		midnight.set(Calendar.MINUTE, 0);
		midnight.set(Calendar.SECOND, 0);
		midnight.set(Calendar.MILLISECOND, 0);

		// add "today at 0:00" to the ms value for the alarm (else the alarm
		// would be scheduled for 1970-01-01):
		firstStartMillis += midnight.getTimeInMillis();

		// if we're already past the alarm time today, we need to add another
		// day:
		if (firstStartMillis <= Calendar.getInstance().getTimeInMillis()) {
			firstStartMillis += AlarmManager.INTERVAL_DAY;
		}

		return firstStartMillis;
	}

	/**
	 * (non-Javadoc) The alarm has been triggered -> create a notification, if
	 * there are any expired products (or any that will soon expire)
	 */
	@Override
	public void onReceive(Context context, Intent intent) {
		Context appContext = context.getApplicationContext();
		final SharedPreferences sharedPref = appContext.getSharedPreferences("main", Context.MODE_PRIVATE);

		int daysBeforeMedium = sharedPref.getInt(SettingsActivity.KEY_DAYS_BEFORE_MEDIUM, 0);

		DatabaseManager.init(appContext);
		List<ProductEntry> products = DatabaseManager.getInstance().getAllProductEntries();
		List<String> expiringProducts = new ArrayList<String>();
		for (ProductEntry productEntry : products) {
			if ((new DateTime(productEntry.expiration_date)).minusDays(daysBeforeMedium).isBeforeNow()) {
				expiringProducts.add(productEntry.amount + "x " + productEntry.article.name);
			}
		}

		if (expiringProducts.size() > 0) {
			this.createExpiryNotification(appContext, expiringProducts);
		}
	}

	private void createExpiryNotification(Context appContext, List<String> expiringProducts) {
		Resources res = appContext.getResources();
		NotificationCompat.Builder builder = new NotificationCompat.Builder(appContext)
				.setSmallIcon(R.drawable.ic_launcher)
				.setContentTitle(
						res.getQuantityString(R.plurals.numberOfItemsToBeEaten, expiringProducts.size(),
								expiringProducts.size()))
				.setContentText(StringUtils.join(expiringProducts, System.getProperty("line.separator")))
				.setSound(Settings.System.DEFAULT_NOTIFICATION_URI).setAutoCancel(true);
		// Creates an explicit intent for an Activity in your app
		Intent resultIntent = new Intent(appContext, ProductListActivity.class);

		// set stack (for the back button to work correctly):
		TaskStackBuilder stackBuilder = TaskStackBuilder.create(appContext);
		stackBuilder.addParentStack(ProductListActivity.class);
		stackBuilder.addNextIntent(resultIntent);
		
		PendingIntent resultPendingIntent = stackBuilder.getPendingIntent(0, PendingIntent.FLAG_UPDATE_CURRENT);
		builder.setContentIntent(resultPendingIntent);
		NotificationManager notificationManager = (NotificationManager) appContext
				.getSystemService(Context.NOTIFICATION_SERVICE);

		// display the notification:
		notificationManager.notify(WASTE_NOTIFICATION, builder.build());
	}
}
