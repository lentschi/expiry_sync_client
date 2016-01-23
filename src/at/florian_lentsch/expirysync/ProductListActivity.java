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

import java.io.UnsupportedEncodingException;
import java.net.URLEncoder;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.Date;
import java.util.List;

import org.joda.time.DateTime;

import android.app.AlertDialog;
import android.content.Context;
import android.content.DialogInterface;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.res.Resources;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.preference.PreferenceManager;
import android.text.Editable;
import android.text.TextWatcher;
import android.util.SparseArray;
import android.view.Menu;
import android.view.MenuItem;
import android.view.View;
import android.widget.AdapterView;
import android.widget.AdapterView.OnItemClickListener;
import android.widget.CheckBox;
import android.widget.EditText;
import android.widget.ListView;

import at.florian_lentsch.expirysync.auth.User;
import at.florian_lentsch.expirysync.db.DatabaseManager;
import at.florian_lentsch.expirysync.model.Article;
import at.florian_lentsch.expirysync.model.ArticleImage;
import at.florian_lentsch.expirysync.model.Location;
import at.florian_lentsch.expirysync.model.ProductEntry;
import at.florian_lentsch.expirysync.net.JsonCaller;
import at.florian_lentsch.expirysync.net.ServerProxy;
import at.florian_lentsch.expirysync.net.ServerProxy.ProductEntryCallback;
import at.florian_lentsch.expirysync.util.Util;

/**
 * Main activity - a list of product entries
 * 
 * @author Florian Lentsch <office@florian-lentsch.at>
 * 
 */
public class ProductListActivity extends UndeprecatedActionBarActivity {
	// Some activity result codes:
	public final static String EXTRA_PRODUCT_ENTRY_ID = "at.florian_lentsch.expirysync.EXTRA_PRODUCT_ENTRY_ID",
			EXTRA_LOGIN_IMMEDIATELY = "at.florian_lentsch.expirysync.EXTRA_LOGIN_IMMEDIATELY";
	static final int ADD_PRODUCT_RESULT = 0, EDIT_PRODUCT_RESULT = 1, SCAN_BARCODE_RESULT = 2, LOGIN_RESULT = 3,
			REGISTER_RESULT = 4;
	static final int OPEN_LOGIN_RESULT_CODE = RESULT_FIRST_USER, OPEN_REGISTRATION_RESULT_CODE = RESULT_FIRST_USER + 1;

	/**
	 * The product list's adapter
	 */
	private ProductAdapter productListAdapter;

	/**
	 * The currently selected location for now this is either the default
	 * location or null (location switching not yet implemented)
	 */
	public static Location currentLocation = null;

	/**
	 * Currently selected product entries "selected" means that their checkbox
	 * has been checked by the user
	 */
	private SparseArray<ProductEntry> selectedEntries = new SparseArray<ProductEntry>();

	/**
	 * What to sort the list by
	 * 
	 * @see #sortList(String)
	 */
	private String sortBy = null;

	@Override
	protected void onCreate(Bundle savedInstanceState) {
		super.onCreate(savedInstanceState);
		setContentView(R.layout.product_list_activity);

		// set default values for preferences that haven't been customized:
		PreferenceManager.setDefaultValues(this.getApplicationContext(), "main", Context.MODE_PRIVATE,
				R.xml.main_preferences, false);

		// set alarm for notifications (if not already set):
		NotifyChecker.setAlarm(this);

		// initialize the list and its adapter:
		iniList(savedInstanceState);

		// auto login:
		final SharedPreferences sharedPref = ProductListActivity.this.getApplicationContext().getSharedPreferences(
				"main", Context.MODE_PRIVATE);
		boolean offlineMode = sharedPref.getBoolean(SettingsActivity.KEY_OFFLINE_MODE, false);

		if (!offlineMode) {
			this.autoLogin(sharedPref);
		}
	}

	/**
	 * Initializes the product list
	 * <ul compact>
	 * 
	 * <li>adds the list's adapter
	 * <li>initializes item sorting
	 * <li>handles tapping items
	 * <li>initializes item filtering
	 * 
	 * </ul>
	 * 
	 * @param savedInstanceState
	 *            the activity's saved instance state
	 */
	private void iniList(Bundle savedInstanceState) {
		// add the list adapter:
		DatabaseManager.init(this.getApplicationContext());
		List<ProductEntry> products = DatabaseManager.getInstance().getAllProductEntries();
		this.productListAdapter = new ProductAdapter(this, R.layout.product_list_item, products,
				new ListItemCheckedChange() {
					@Override
					public void checkedChange(ProductEntry entry, int position, boolean isChecked) {
						// add/remove checked/unchecked entries from our array:
						if (isChecked) {
							ProductListActivity.this.selectedEntries.put(entry.getId(), entry);
						} else {
							ProductListActivity.this.selectedEntries.remove(entry.getId());
						}

						// TODO: This was something to do with backwards
						// compatibility, but I'm not quite sure why exactly I
						// put that in here:
						ProductListActivity.this.supportInvalidateOptionsMenu();
					}
				});

		final ListView productListView = (ListView) findViewById(R.id.product_list);
		productListView.setAdapter(this.productListAdapter);

		iniListItemSorting(savedInstanceState);
		iniListItemTapping();
		iniListItemFiltering();
	}

	/**
	 * Initializes item sorting
	 * 
	 * @param savedInstanceState
	 *            the activity's saved instance state
	 */
	private void iniListItemSorting(Bundle savedInstanceState) {
		if (savedInstanceState != null) {
			this.sortBy = savedInstanceState.getString("sortBy");
		}
		if (this.sortBy == null) {
			this.sortBy = getResources().getString(R.string.sorting_expiration_date_option);
		}

		this.sortList();
	}

	/**
	 * Hooks up tapping a product entry to open the edit dialog
	 */
	private void iniListItemTapping() {
		final ListView productListView = (ListView) findViewById(R.id.product_list);
		productListView.setOnItemClickListener(new OnItemClickListener() {
			public void onItemClick(AdapterView<?> parent, View view, int position, long id) {
				editEntry(position);
			}
		});
	}

	/**
	 * Hooks up the input {@code R.id.search_field} to act as a filter field
	 * 
	 * @see ProductAdapter#getFilter()
	 */
	private void iniListItemFiltering() {
		EditText search_edit = (EditText) findViewById(R.id.search_field);
		TextWatcher watcher = new TextWatcher() {
			@Override
			public void onTextChanged(CharSequence constraint, int start, int before, int count) {
				// apply changes in the filter field on the list adapter:
				ProductListActivity.this.productListAdapter.getFilter().filter(constraint);
			}

			@Override
			public void beforeTextChanged(CharSequence s, int start, int count, int after) {
			}

			@Override
			public void afterTextChanged(Editable s) {
			}
		};
		search_edit.addTextChangedListener(watcher);
	}

	/**
	 * Tries to log in the user that has been logged in the last time. If there
	 * is no such user, the registration form is shown.
	 * 
	 * @param sharedPref
	 */
	private void autoLogin(SharedPreferences sharedPref) {
		final ServerProxy serverProxy = ServerProxy.getInstanceFromConfig(this);
		if (serverProxy.getCurrentUser() == null) {
			if (sharedPref.getString(SettingsActivity.KEY_ACCOUNT_NAME, null) != null) {
				Intent intent = new Intent(this, LoginActivity.class);
				intent.putExtra(EXTRA_LOGIN_IMMEDIATELY, true);
				startActivityForResult(intent, LOGIN_RESULT);
			} else {
				Intent intent = new Intent(this, RegistrationActivity.class);
				startActivityForResult(intent, REGISTER_RESULT);
			}
		}
	}

	@Override
	protected void onSaveInstanceState(Bundle outState) {
		super.onSaveInstanceState(outState);

		// save the current sorting mode for the next time:
		if (this.sortBy != null) {
			outState.putString("sortBy", this.sortBy);
		}
	}

	/**
	 * checks/unchecks all list items
	 * 
	 * @param checked
	 *            checked if true, else unchecked
	 */
	private void setAllEntriesChecked(boolean checked) {
		final ListView productListView = (ListView) findViewById(R.id.product_list);
		for (int i = 0; i < productListView.getChildCount(); i++) {
			View listElem = productListView.getChildAt(i);
			CheckBox checkbox = (CheckBox) listElem.findViewById(R.id.product_list_item_checkbox);
			checkbox.setChecked(checked);
		}
	}

	/**
	 * opens the edit form for an item
	 * 
	 * @param position
	 *            the item's position in the list
	 */
	private void editEntry(int position) {
		ProductEntry productEntry = this.productListAdapter.getItem(position);

		Intent intent = new Intent(this, EditProductActivity.class);
		intent.putExtra(EXTRA_PRODUCT_ENTRY_ID, productEntry.getId());
		startActivityForResult(intent, EDIT_PRODUCT_RESULT);
	}

	@Override
	public boolean onCreateOptionsMenu(Menu menu) {
		// Inflate the menu; this adds items to the action bar if it is present.
		getMenuInflater().inflate(R.menu.main, menu);

		return super.onCreateOptionsMenu(menu);
	}

	/**
	 * (non-Javadoc)
	 * 
	 * builds the main option menu's items item states depending on wether a
	 * user is logged in or not and if there are any checked items or not
	 */
	@Override
	public boolean onPrepareOptionsMenu(Menu menu) {
		// enable/disable the login/logout menu items depending on wether a user
		// is logged in:
		MenuItem loginItem = menu.findItem(R.id.action_login);
		MenuItem logoutItem = menu.findItem(R.id.action_logout);
		MenuItem synchronizeItem = menu.findItem(R.id.action_synchronize);
		final ServerProxy serverProxy = ServerProxy.getInstanceFromConfig(this);
		User currentUser = serverProxy.getCurrentUser();
		String logoutTitle = getResources().getString(R.string.logout_title);
		if (currentUser != null) {
			loginItem.setEnabled(false);
			loginItem.getIcon().setAlpha(64);
			logoutItem.setEnabled(true);
			logoutItem.getIcon().setAlpha(255);
			logoutItem.setTitle(logoutTitle + " " + currentUser.toString());
			synchronizeItem.setEnabled(true);
		} else {
			loginItem.setEnabled(true);
			loginItem.getIcon().setAlpha(255);
			logoutItem.setEnabled(false);
			logoutItem.getIcon().setAlpha(64);
			logoutItem.setTitle(logoutTitle);
			synchronizeItem.setEnabled(false);
		}

		// enable/disable the "delete selected" menu item depending on wether
		// any list item has been checked:
		MenuItem deleteSelectedItem = menu.findItem(R.id.action_delete_selected);
		MenuItem recipeSearchItem = menu.findItem(R.id.action_recipe_search);
		if (this.selectedEntries.size() != 0) {
			deleteSelectedItem.setEnabled(true);
			deleteSelectedItem.getIcon().setAlpha(255);
			recipeSearchItem.setEnabled(true);
			recipeSearchItem.getIcon().setAlpha(255);
		} else {
			deleteSelectedItem.setEnabled(false);
			deleteSelectedItem.getIcon().setAlpha(64);
			recipeSearchItem.setEnabled(false);
			recipeSearchItem.getIcon().setAlpha(64);
		}

		return super.onPrepareOptionsMenu(menu);
	}

	/**
	 * sorts the list of product entries by the value of {@link #sortBy}
	 */
	private void sortList() {
		this.sortList(this.sortBy);
	}

	/**
	 * sorts the list of product entries
	 * 
	 * @param sortBy
	 *            what to use as order
	 */
	private void sortList(String sortBy) {
		// TODO: Make sortBy something other than a string (especially one that
		// is locale dependent)
		Resources res = getResources();
		if (sortBy.equals(res.getString(R.string.sorting_last_added_option))) {
			this.productListAdapter.sort(new Comparator<ProductEntry>() {
				@Override
				public int compare(ProductEntry entry1, ProductEntry entry2) {
					int ret = entry2.created_at.compareTo(entry1.created_at);
					return ret;
				}
			});
		} else if (sortBy.equals(res.getString(R.string.sorting_expiration_date_option))) {
			this.productListAdapter.sort(new Comparator<ProductEntry>() {
				@Override
				public int compare(ProductEntry entry1, ProductEntry entry2) {
					return entry1.expiration_date.compareTo(entry2.expiration_date);
				}
			});
		} else if (sortBy.equals(res.getString(R.string.sorting_name_option))) {
			this.productListAdapter.sort(new Comparator<ProductEntry>() {
				@Override
				public int compare(ProductEntry entry1, ProductEntry entry2) {
					return entry1.article.name.compareTo(entry2.article.name);
				}
			});
		}

		this.sortBy = sortBy;
	}

	/**
	 * (non-Javadoc) reacts to tapping a menu entry
	 */
	@Override
	public boolean onOptionsItemSelected(MenuItem item) {
		switch (item.getItemId()) {
		case R.id.action_add_product:
			// open add product form:
			Intent addIntent = new Intent(this, AddProductActivity.class);
			startActivityForResult(addIntent, ADD_PRODUCT_RESULT);

			break;
		case R.id.action_sorting:
			showSortingDialog();

			break;
		case R.id.action_delete_selected:
			deleteSelectedProducts();
			break;
		case R.id.action_recipe_search:
			searchRecipesForSelectedProducts();
			break;
		case R.id.action_settings:
			// start settings activity:
			Intent settingsIntent = new Intent(this, SettingsActivity.class);
			startActivity(settingsIntent);

			break;
		case R.id.action_login:
			// open login form:
			Intent intent = new Intent(this, LoginActivity.class);
			startActivityForResult(intent, LOGIN_RESULT);
			break;
		case R.id.action_logout:
			logout();
			break;
		case R.id.action_synchronize:
			synchronizeEntries();
			break;
		case R.id.action_exit:
			// exit the app:
			finish();
			System.exit(0);
		}

		return true;
	}

	/**
	 * lets the user choose by what list entries should be sorted
	 */
	private void showSortingDialog() {
		AlertDialog.Builder builder = new AlertDialog.Builder(this);
		builder.setTitle(R.string.choose_sorting_title).setItems(R.array.sorting_options,
				new DialogInterface.OnClickListener() {
					public void onClick(DialogInterface dialog, int which) {
						String[] strings = ProductListActivity.this.getResources().getStringArray(
								R.array.sorting_options);
						ProductListActivity.this.sortList(strings[which]);
					}
				});
		builder.show();
	}

	/**
	 * logs the current user out
	 */
	private void logout() {
		ServerProxy logoutProxy = ServerProxy.getInstanceFromConfig(this);
		logoutProxy.logout(logoutProxy.new CompletedCallback() {

			@Override
			public void onReceive(boolean success) {
				Resources res = getResources();
				Util.showMessage(ProductListActivity.this,
						success ? res.getString(R.string.logout_succeeded) : res.getString(R.string.logout_failed));
			}
		});
	}

	/**
	 * clears the product list and reloads it from the database
	 */
	private void loadProductEntriesToList() {
		this.productListAdapter.clear();
		List<ProductEntry> products = DatabaseManager.getInstance().getAllProductEntries();

		if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.HONEYCOMB) {
			this.productListAdapter.addAll(products);
		} else {
			for (int i = 0; i < products.size(); i++) {
				this.productListAdapter.add(products.get(i));
			}
		}

		this.productListAdapter.setAllEntries(products);
		this.productListAdapter.notifyDataSetChanged();
		this.sortList();
	}

	/**
	 * (non-Javadoc) handles results of child activities that have exited
	 */
	@Override
	protected void onActivityResult(int requestCode, int resultCode, Intent data) {
		switch (requestCode) {
		case SCAN_BARCODE_RESULT:
			// a barcode has been scanned for filtering -> put it in the filter
			// field:
			if (resultCode == RESULT_OK) {
				String barcode = data.getStringExtra(ScanBarcodeActivity.SCANNED_BARCODE);
				((EditText) findViewById(R.id.search_field)).setText(barcode);
			}
			break;
		case ADD_PRODUCT_RESULT:
			if (resultCode == AddProductActivity.RESULT_OK_ADD_ANOTHER) {
				// user chose to add another product straight away -> open a new
				// add product form immediately:
				Intent addIntent = new Intent(this, AddProductActivity.class);
				startActivityForResult(addIntent, ADD_PRODUCT_RESULT);

				break; // <- intentionally within the block
			}
		case EDIT_PRODUCT_RESULT:
			if (resultCode == RESULT_OK) {
				// Successfully added
				this.loadProductEntriesToList();
			}
			break;
		case LOGIN_RESULT:
		case REGISTER_RESULT:
			Util.hideProgress();
			// open login/registration straight after the user choose to do so
			// in the
			// other form respectively:
			if (resultCode == ProductListActivity.OPEN_LOGIN_RESULT_CODE) {
				Intent addIntent = new Intent(this, LoginActivity.class);
				startActivityForResult(addIntent, LOGIN_RESULT);
				break;
			}

			if (resultCode == ProductListActivity.OPEN_REGISTRATION_RESULT_CODE) {
				Intent addIntent = new Intent(this, RegistrationActivity.class);
				startActivityForResult(addIntent, REGISTER_RESULT);
				break;
			}

			if (resultCode == RESULT_CANCELED) {
				enterOfflineMode();
				break;
			}

			// logging in succeeded -> try to synchronize our entries:
			synchronizeEntries();
			break;
		}
	}

	/**
	 * enters offline mode and lets the user decide if offline mode should be
	 * the default when launching the app (If they choose 'yes', store the
	 * respective key in the shared preferences)
	 */
	protected void enterOfflineMode() {
		final SharedPreferences sharedPref = ProductListActivity.this.getApplicationContext().getSharedPreferences(
				"main", Context.MODE_PRIVATE);
		boolean offlineMode = sharedPref.getBoolean(SettingsActivity.KEY_OFFLINE_MODE, false);

		if (!offlineMode) {
			// if we come from online mode, ask if offline mode should be the
			// default from now on:
			new AlertDialog.Builder(this).setIcon(android.R.drawable.ic_dialog_info)
					.setTitle(R.string.set_offline_mode_title).setMessage(R.string.set_offline_mode_question)
					.setPositiveButton(R.string.yes, new DialogInterface.OnClickListener() {

						@Override
						public void onClick(DialogInterface dialog, int which) {
							// store the decision int the shared preferences:
							SharedPreferences.Editor editor = sharedPref.edit();
							editor.putBoolean(SettingsActivity.KEY_OFFLINE_MODE, true);
							editor.commit();
						}

					}).setNegativeButton(R.string.no, null).show();
		}

		// add default location, if there is none:
		if (ProductListActivity.currentLocation == null) {
			final DatabaseManager dbManager = DatabaseManager.getInstance();

			ProductListActivity.currentLocation = new Location();
			ProductListActivity.currentLocation.isDefault = true;
			ProductListActivity.currentLocation.name = "Default";
			dbManager.addLocation(ProductListActivity.currentLocation);
		}

		Util.showMessage(this, getResources().getString(R.string.offline_mode));
	}

	/**
	 * synchronizes entries with the server
	 */
	protected void synchronizeEntries() {
		final SharedPreferences sharedPref = this.getApplicationContext().getSharedPreferences("main",
				Context.MODE_PRIVATE);

		final ServerProxy serverProxy = ServerProxy.getInstanceFromConfig(this);
		final DatabaseManager dbManager = DatabaseManager.getInstance();
		final ServerProxy.ProductEntryListCallback modifiedEntriesCallback = serverProxy.new ProductEntryListCallback() {

			@Override
			public void onReceive(List<ProductEntry> productEntries, List<ProductEntry> deletedProductEntries) {
				// Add/update/delete entries changed/deleted on the server in
				// the local db:
				for (ProductEntry entry : productEntries) {
					entry.location = ProductListActivity.currentLocation;
					entry.inSync = true;
					dbManager.updateOrAddProductEntry(entry);

					Article dbArticle = dbManager.getArticleById(entry.article.getId());
					if (dbArticle.images.isEmpty() && !entry.article.temporaryImages.isEmpty()) {
						// For now only add the last image returned by the
						// server:
						ArticleImage image = entry.article.temporaryImages
								.get(entry.article.temporaryImages.size() - 1);
						image.article = dbArticle;
						dbArticle.images.add(image);
					}
				}

				for (ProductEntry deletedEntry : deletedProductEntries) {
					ProductEntry dbEntry = dbManager.findProductEntryByServerId(deletedEntry.serverId);
					if (dbEntry != null) {
						if (dbEntry.inSync || dbEntry.deleted_at != null) {
							dbManager.deleteProductEntry(dbEntry);
						}
					} else {
						// TODO
					}
				}

				// add/update/delete entries added/updated/deleted on the client
				// while not connected to the server:
				synchronizeLocallyChangedEntries();
			}

		};

		// show the loader (don't let the user do anything while sync is
		// running):
		Util.showProgress(this);

		long lastRetrievalMillis = sharedPref.getLong(SettingsActivity.KEY_LAST_ENTRY_RETRIEVAL, -1);
		Date lastRetrieval = (lastRetrievalMillis != -1) ? new Date(lastRetrievalMillis) : null;
		
		// add/update/delete entries, that have been changed on the server but not on the client:
		serverProxy.getProductEntries(ProductListActivity.currentLocation, lastRetrieval, modifiedEntriesCallback);
	}

	/**
	 * deletes/updates entries, that have been changed locally, while we were in
	 * offline mode
	 */
	private void synchronizeLocallyChangedEntries() {
		final ServerProxy serverProxy = ServerProxy.getInstanceFromConfig(this);
		final DatabaseManager dbManager = DatabaseManager.getInstance();

		// get the list of entries changed in offline mode:
		final List<ProductEntry> modifiedEntries = dbManager.getProductEntriesOutOfSync();

		if (modifiedEntries.isEmpty()) {
			// nothing changed in offline mode -> sync completed:
			onSyncComplete();
			return;
		}

		final ServerProxy.ProductEntryCallback entryCallback = serverProxy.new ProductEntryCallback() {
			@Override
			public void onReceive(ProductEntry receivedEntry) {
				if (receivedEntry != null) {
					// entry has been added/updated/deleted on the server ->
					// update
					// local db correspondingly:
					if (receivedEntry.deleted_at != null) {
						dbManager.deleteProductEntry(receivedEntry);
					} else {
						receivedEntry.inSync = true;
						dbManager.updateProductEntry(receivedEntry);
					}
				} else {
					Util.showMessage(ProductListActivity.this, "Updating/Adding/Deleting on server failed");
					ProductListActivity.this.onSyncComplete();
					return;
				}

				if (modifiedEntries.isEmpty()) {
					// last entry has been processed -> sync completed:
					ProductListActivity.this.onSyncComplete();
				} else {
					// -> process the next modified entry:
					ProductListActivity.this.addUpdateOrDeleteProductEntryOnServer(modifiedEntries.remove(0), this);
				}
			}
		};

		// add/delete/update modified entries on the server - one at a time
		ProductListActivity.this.addUpdateOrDeleteProductEntryOnServer(modifiedEntries.remove(0), entryCallback);
	}

	/**
	 * deletes (if {@link ProductEntry#deleted_at} is set), updates (if
	 * {@link ProductEntry#serverId} is set, or else adds a product entry on the
	 * server
	 * 
	 * @param entry
	 *            the entry that shall be updated/deleted
	 * @param callback
	 *            called as soon as the server responds
	 */
	private void addUpdateOrDeleteProductEntryOnServer(final ProductEntry entry, final ProductEntryCallback callback) {
		final ServerProxy serverProxy = ServerProxy.getInstanceFromConfig(this);
		final DatabaseManager dbManager = DatabaseManager.getInstance();

		if (entry.deleted_at != null) {
			if (entry.serverId != 0) {
				serverProxy.deleteProductEntry(entry, callback);
				return;
			}

			dbManager.deleteProductEntry(entry);
		}

		if (entry.serverId == 0) {
			serverProxy.createProductEntry(entry, new ArrayList<ArticleImage>(entry.article.images), callback);
			return;
		}

		serverProxy.updateProductEntry(entry, new ArrayList<ArticleImage>(entry.article.images), callback);
	}

	/**
	 * called when synchronization with the server has finished
	 * 
	 * <ul compact>
	 * 
	 * <li> saves the time when sync has finished
	 * <li> updates the list view with the changed items
	 * <li> hides the loader
	 * 
	 * </ul>
	 */
	private void onSyncComplete() {
		final SharedPreferences sharedPref = this.getApplicationContext().getSharedPreferences("main",
				Context.MODE_PRIVATE);

		SharedPreferences.Editor editor = sharedPref.edit();
		editor.putLong(SettingsActivity.KEY_LAST_ENTRY_RETRIEVAL, System.currentTimeMillis() + JsonCaller.timeSkew);
		editor.commit();

		loadProductEntriesToList();

		Util.hideProgress();
	}
	
	private void searchRecipesForSelectedProducts() {
		Resources res = getResources();
		final SharedPreferences sharedPref = this.getApplicationContext().getSharedPreferences("main",
				Context.MODE_PRIVATE);
		
		String search = res.getString(R.string.recipe) + " ";
		for (int i = 0; i < ProductListActivity.this.selectedEntries.size(); i++) {
			int entryId = ProductListActivity.this.selectedEntries.keyAt(i);
			ProductEntry entry = ProductListActivity.this.selectedEntries.get(entryId);
			search += entry.article.name;
			if (i + 1 < ProductListActivity.this.selectedEntries.size()) {
				search += " ";
			}
		}
		
		try {
			search = URLEncoder.encode(search, "UTF-8");
		} catch (UnsupportedEncodingException e) {
			e.printStackTrace();
		}
		Uri uri = Uri.parse(sharedPref.getString(SettingsActivity.KEY_SEARCH_URL, "") + search);
		Intent intent = new Intent(Intent.ACTION_VIEW, uri);
		startActivity(intent);
	}

	/**
	 * Deletes all products that have been selected by checking their checkboxes.
	 * The user has to answer 'yes' to a confirm dialog, else the operation is aborted.
	 */
	private void deleteSelectedProducts() {
		new AlertDialog.Builder(this).setIcon(android.R.drawable.ic_dialog_alert)
				.setTitle(R.string.delete_selected_products).setMessage(R.string.really_delete_selected_products)
				.setPositiveButton(R.string.yes, new DialogInterface.OnClickListener() {

					@Override
					public void onClick(DialogInterface dialog, int which) {
						final DatabaseManager dbManager = DatabaseManager.getInstance();

						final ServerProxy entryProxy = ServerProxy.getInstanceFromConfig(ProductListActivity.this);
						for (int i = 0; i < ProductListActivity.this.selectedEntries.size(); i++) {
							int entryId = ProductListActivity.this.selectedEntries.keyAt(i);
							ProductEntry entry = ProductListActivity.this.selectedEntries.get(entryId);

							if (entryProxy.getCurrentUser() != null) {
								entryProxy.deleteProductEntry(entry, entryProxy.new ProductEntryCallback() {
									@Override
									public void onReceive(ProductEntry receivedEntry) {
										if (receivedEntry == null) {
											Util.showMessage(ProductListActivity.this, "Deleting from server failed: ");
										}
									}
								});
								dbManager.deleteProductEntry(entry);
							} else {
								entry.deleted_at = new DateTime();
								entry.inSync = false;
								dbManager.updateProductEntry(entry);
							}
						}

						ProductListActivity.this.selectedEntries.clear();
						ProductListActivity.this.setResult(RESULT_OK);
						ProductListActivity.this.loadProductEntriesToList();
						ProductListActivity.this.setAllEntriesChecked(false);
					}

				}).setNegativeButton(R.string.no, null).show();
	}

	/**
	 * Start scanning a barcode for the filter field
	 * Called by tapping {@code R.id.filter_scan_barcode_btn}
	 * @param view the button, that was pressed
	 */
	public void scanBarcode(View view) {
		Intent intent = new Intent(this, ScanBarcodeActivity.class);
		startActivityForResult(intent, SCAN_BARCODE_RESULT);
	}

	/**
	 * Listener class to register checking/unchecking of list items 
	 */
	protected abstract class ListItemCheckedChange {
		public abstract void checkedChange(ProductEntry entry, int position, boolean isChecked);
	}
}
