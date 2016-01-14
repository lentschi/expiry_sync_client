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

package at.florian_lentsch.expirysync.net;

import java.net.URISyntaxException;
import java.text.ParseException;
import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Date;
import java.util.HashMap;
import java.util.Iterator;
import java.util.List;
import java.util.Locale;
import java.util.Map;

import org.joda.time.DateTime;
import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import android.content.Context;
import android.content.SharedPreferences;
import android.os.AsyncTask;
import android.util.Base64;
import android.util.Log;

import at.florian_lentsch.expirysync.SettingsActivity;
import at.florian_lentsch.expirysync.auth.User;
import at.florian_lentsch.expirysync.model.Article;
import at.florian_lentsch.expirysync.model.ArticleImage;
import at.florian_lentsch.expirysync.model.Location;
import at.florian_lentsch.expirysync.model.ProductEntry;

/**
 * Abstraction layer for talking with the ExpirySync server
 * Uses JSON to do so 
 * @see JsonCaller
 * @author Florian Lentsch <office@florian-lentsch.at>
 *
 */
public class ServerProxy {
	private JsonCaller caller = null;
	private User currentUser = null;
	private static ServerProxy instance = null;

	private ServerProxy(String hostStr) throws URISyntaxException {
		this.setHostStr(hostStr);
	}

	private ServerProxy() {
	}
	
	/**
	 * Creates an instance retrieving the host name from the shared preferences
	 * @param context the context containing the shared preferences
	 * @return the requested instance
	 */
	public static ServerProxy getInstanceFromConfig(Context context) {
		SharedPreferences sharedPref = context.getApplicationContext().getSharedPreferences("main", Context.MODE_PRIVATE);
		String hostStr = sharedPref.getString(SettingsActivity.KEY_HOST, "");

		ServerProxy articleProxy = ServerProxy.getInstance(hostStr);
		if (!articleProxy.caller.getHost().equals(hostStr)) {
			try {
				articleProxy.caller.setHost(hostStr);
			} catch (URISyntaxException e) {
				Log.d("ERR", "Could not set host from config - keeping the old one");
			}
		}

		return articleProxy;
	}
	
	public static ServerProxy getInstance(String hostStr) {
		if (ServerProxy.instance == null) {
			try {
				ServerProxy.instance = new ServerProxy(hostStr);
			} catch (URISyntaxException e) {
				Log.d("ERR", "Invalid host name: " + hostStr);
				ServerProxy.instance = new ServerProxy();
			}
		}

		return ServerProxy.instance;
	}
	
	public User getCurrentUser() {
		return this.currentUser;
	}

	public void setHostStr(String hostStr) throws URISyntaxException {
		this.caller = new JsonCaller(hostStr);
	}

	public void login(String accountName, String password, final UserCallback callback) {
		// clear cookies to make the client forget it, if it was already logged
		// in:
		this.caller.clearCookies();

		JSONObject paramObj = new JSONObject();

		try {
			JSONObject userObj = new JSONObject();
			userObj.put("login", accountName);
			userObj.put("password", password);

			paramObj.put("user", userObj);
		} catch (JSONException e) {
			// just leave param obj empty - the request will then fail anyway
		}

		final JsonCallOptions jsonCallParam = new JsonCallOptions();
		jsonCallParam.method = JsonCaller.METHOD_POST;
		jsonCallParam.path = "users/sign_in";
		jsonCallParam.params = paramObj;

		jsonCallParam.callback = new JsonCallback() {
			@Override
			public void onReceive(JSONObject receivedObj) {
				User receivedUser = null;
				try {
					JSONObject userObj = receivedObj.getJSONObject("user");
					receivedUser = new User(userObj.isNull("email") ? null : userObj.getString("email"), userObj.isNull("username") ? null : userObj.getString("username"));
					ServerProxy.this.currentUser = receivedUser;
					callback.onReceive(receivedUser);
				} catch (Exception e) {
					ServerProxy.this.currentUser = null;
					e.printStackTrace();
					callback.onError(null);
				}
			}
		};

		new JsonCallTask().execute(jsonCallParam);
	}
	
	public void register(String email, String username, String password, final UserCallback callback) {
		// clear cookies to make the client forget it, if it was already logged
		// in:
		this.caller.clearCookies();

		JSONObject paramObj = new JSONObject();

		try {
			JSONObject userObj = new JSONObject();
			if (username != null) {
				userObj.put("username", username);
			}
			if (email != null) {
				userObj.put("email", email);
			}
			userObj.put("password", password);

			paramObj.put("user", userObj);
		} catch (JSONException e) {
			// just leave param obj empty - the request will then fail anyway
		}

		final JsonCallOptions jsonCallParam = new JsonCallOptions();
		jsonCallParam.method = JsonCaller.METHOD_POST;
		jsonCallParam.path = "users";
		jsonCallParam.params = paramObj;

		jsonCallParam.callback = new JsonCallback() {
			@Override
			public void onReceive(JSONObject receivedObj) {
				User receivedUser = null;
				try {
					JSONObject userObj = receivedObj.getJSONObject("user");
					// isNull is required here - s. https://code.google.com/p/android/issues/detail?id=13830:
					receivedUser = new User(userObj.isNull("email") ? null : userObj.getString("email"), userObj.isNull("username") ? null : userObj.getString("username"));
					ServerProxy.this.currentUser = receivedUser;
				} catch (Exception e) {
					ServerProxy.this.currentUser = null;
					e.printStackTrace();
				}

				if (receivedUser != null) {
					callback.onReceive(receivedUser);
				}
				else {
					Map<String, List<String>> errors = new HashMap<String,List<String>>();
					try {
						JSONObject errorsObj = receivedObj.getJSONObject("errors");
						Iterator<?> keys = errorsObj.keys();
	
				        while( keys.hasNext() ){
				            String key = (String)keys.next();
				            List<String> errorsList = new ArrayList<String>();
				            JSONArray values = errorsObj.getJSONArray(key);
				            for (int i = 0; i < values.length(); i++ ) {
				            	errorsList.add(values.getString(i));
				            }
				            
				            errors.put(key, errorsList);
				        }
					}
					catch (Exception e) {
						e.printStackTrace();
					}
					
					callback.onError(errors);
				}
			}
		};

		new JsonCallTask().execute(jsonCallParam);
	}

	public void logout(final CompletedCallback callback) {
		final JsonCallOptions jsonCallParam = new JsonCallOptions();
		jsonCallParam.method = JsonCaller.METHOD_DELETE;
		jsonCallParam.path = "users/sign_out";
		
		this.currentUser = null;

		jsonCallParam.callback = new JsonCallback() {
			@Override
			public void onReceive(JSONObject receivedObj) {
				boolean success = false;
				try {
					success = receivedObj.getString("status").equals("success");
				} catch (JSONException e) {
					e.printStackTrace();
				}

				callback.onReceive(success);
			}
		};

		new JsonCallTask().execute(jsonCallParam);
	}

	public void getArticleByBarcode(String barcode, final ArticleCallback callback) {
		final JsonCallOptions jsonCallParam = new JsonCallOptions();
		jsonCallParam.method = JsonCaller.METHOD_GET;
		jsonCallParam.path = "articles/by_barcode/" + barcode;
		jsonCallParam.callback = new JsonCallback() {
			@Override
			public void onReceive(JSONObject receivedObj) {
				if (receivedObj == null) {
					//means connection error
					callback.onConnectionError();
					return;
				}
				
				Article receivedArticle = null;
				ArrayList<ArticleImage> receivedImages = null;
				JSONObject articleObj;
				try {
					articleObj = receivedObj.getJSONObject("article");
				} catch (JSONException e) {
					//means not found
					callback.onReceive(null, null);
					return;
				}
				try {
					receivedArticle = new Article(articleObj.getString("name"));

					receivedImages = new ArrayList<ArticleImage>();
					JSONArray jsonImages = articleObj.getJSONArray("images");
					for(int i = 0; i < jsonImages.length(); i++) {
						JSONObject imageObj = jsonImages.getJSONObject(i);
						ArticleImage image = new ArticleImage();
						image.serverId = imageObj.getInt("id");
						image.article = receivedArticle;
						receivedImages.add(image);				
					}
				} catch (JSONException e) {
					e.printStackTrace();
				} catch (NullPointerException e) {
					e.printStackTrace();
				}

				callback.onReceive(receivedArticle, receivedImages);
			}
		};

		new JsonCallTask().execute(jsonCallParam);
	}
	
	public void getMyLocations(final LocationListCallback callback) {
		final JsonCallOptions jsonCallParam = new JsonCallOptions();
		jsonCallParam.method = JsonCaller.METHOD_GET;
		jsonCallParam.path = "locations/index_mine_changed";

		jsonCallParam.callback = new JsonCallback() {
			@Override
			public void onReceive(JSONObject receivedObj) {
				List<Location> receivedList = new ArrayList<Location>();
				try {
					JSONArray jsonLocations = receivedObj.getJSONArray("locations");
					for (int i = 0; i < jsonLocations.length(); i++) {
						JSONObject locationObj = jsonLocations.getJSONObject(i);
						Location receivedLocation = new Location();
						receivedLocation.serverId = locationObj.getInt("id");
						receivedLocation.name = locationObj.getString("name");
						
						receivedList.add(receivedLocation);
					}
				} catch (JSONException e) {
					receivedList = null;
					e.printStackTrace();
				}

				callback.onReceive(receivedList);
			}
		};

		new JsonCallTask().execute(jsonCallParam);
	}

	public void createLocation(Location location, final LocationCallback callback) {
		JSONObject paramObj = new JSONObject();
		try {
			JSONObject locationObj = new JSONObject();
			locationObj.put("name", location.name);
			paramObj.put("location", locationObj);
		} catch (JSONException e) {
			// just leave param obj empty - the request will then fail anyway
		}

		final JsonCallOptions jsonCallParam = new JsonCallOptions();
		jsonCallParam.method = JsonCaller.METHOD_POST;
		jsonCallParam.path = "locations";
		jsonCallParam.params = paramObj;
		jsonCallParam.callback = new JsonCallback() {
			@Override
			public void onReceive(JSONObject receivedObj) {
				Location receivedLocation = null;
				try {
					JSONObject locationObj = receivedObj.getJSONObject("location");
					receivedLocation = new Location();
					receivedLocation.serverId = locationObj.getInt("id");
					receivedLocation.name = locationObj.getString("name");
				} catch (Exception e) {
					e.printStackTrace();
				}
				callback.onReceive(receivedLocation);
			}
		};
		
		(new JsonCallTask()).execute(jsonCallParam);
	}

	public void createProductEntry(final ProductEntry entry, ArrayList<ArticleImage> imageList, final ProductEntryCallback callback) {
		JSONObject paramObj = this.entryToJson(entry, imageList);

		final JsonCallOptions jsonCallParam = new JsonCallOptions();
		jsonCallParam.method = JsonCaller.METHOD_POST;
		jsonCallParam.path = "product_entries";
		jsonCallParam.params = paramObj;
		jsonCallParam.callback = new JsonCallback() {
			@Override
			public void onReceive(JSONObject receivedObj) {
				try {
					SimpleDateFormat sdfToDate = new SimpleDateFormat("yyyy-MM-dd", Locale.US);
					SimpleDateFormat sdfToDateTime = new SimpleDateFormat("EEE, dd MMM yyyy HH:mm:ss z", Locale.US);

					JSONObject entryObj = receivedObj.getJSONObject("product_entry");
					entry.serverId = entryObj.getInt("id");
					entry.description = entryObj.getString("description");
					entry.amount = entryObj.getInt("amount");
					entry.expiration_date = sdfToDate.parse(entryObj.getString("expiration_date"));
					entry.created_at = new DateTime(sdfToDateTime.parse(entryObj.getString("created_at")));
					entry.updated_at = new DateTime(sdfToDateTime.parse(entryObj.getString("updated_at")));
					JSONObject articleObj = entryObj.getJSONObject("article");
					entry.article.name = articleObj.isNull("name") ? null : articleObj.getString("name");
					entry.article.barcode = articleObj.isNull("barcode") ? null : articleObj.getString("barcode");
				} catch (Exception e) {
					e.printStackTrace();
					callback.onReceive(null);
					return;
				}
				callback.onReceive(entry);
			}
		};

		(new JsonCallTask()).execute(jsonCallParam);
	}
	
	public void updateProductEntry(final ProductEntry entry, ArrayList<ArticleImage> imageList, final ProductEntryCallback callback) {
		JSONObject paramObj = this.entryToJson(entry, imageList);

		final JsonCallOptions jsonCallParam = new JsonCallOptions();
		jsonCallParam.method = JsonCaller.METHOD_PUT;
		jsonCallParam.path = "product_entries/" + entry.serverId;
		jsonCallParam.params = paramObj;
		jsonCallParam.callback = new JsonCallback() {
			@Override
			public void onReceive(JSONObject receivedObj) {
				try {
					SimpleDateFormat sdfToDate = new SimpleDateFormat("yyyy-MM-dd", Locale.US);
					SimpleDateFormat sdfToDateTime = new SimpleDateFormat("EEE, dd MMM yyyy HH:mm:ss z", Locale.US);

					JSONObject entryObj = receivedObj.getJSONObject("product_entry");
					entry.serverId = entryObj.getInt("id");
					entry.description = entryObj.getString("description");
					entry.amount = entryObj.getInt("amount");
					entry.expiration_date = sdfToDate.parse(entryObj.getString("expiration_date"));
					entry.created_at = new DateTime(sdfToDateTime.parse(entryObj.getString("created_at")));
					entry.updated_at = new DateTime(sdfToDateTime.parse(entryObj.getString("updated_at")));
					
					JSONObject articleObj = entryObj.getJSONObject("article");
					entry.article.name = articleObj.isNull("name") ? null : articleObj.getString("name");
					entry.article.barcode = articleObj.isNull("barcode") ? null : articleObj.getString("barcode");
				} catch (Exception e) {
					e.printStackTrace();
					callback.onReceive(null);
					return;
				}
				callback.onReceive(entry);
			}
		};

		(new JsonCallTask()).execute(jsonCallParam);
	}
	
	public void getProductEntries(final Location location, final Date modifiedAfter, final ProductEntryListCallback callback) {
		JSONObject paramObj = new JSONObject();
		if (modifiedAfter != null) {
			try {
				paramObj.put("from_timestamp", modifiedAfter);
			}
			catch(JSONException e) {
				e.printStackTrace();
				callback.onReceive(null, null);
				return;
			}
		}
		
		final JsonCallOptions jsonCallParam = new JsonCallOptions();
		jsonCallParam.method = JsonCaller.METHOD_GET;
		jsonCallParam.path = "locations/" + location.serverId + "/product_entries/index_changed";
		jsonCallParam.params = paramObj;

		jsonCallParam.callback = new JsonCallback() {
			@Override
			public void onReceive(JSONObject receivedObj) {
				List<ProductEntry> receivedList = new ArrayList<ProductEntry>();
				List<ProductEntry> receivedDeletedList = new ArrayList<ProductEntry>();
				try {
					JSONArray jsonEntries = receivedObj.getJSONArray("product_entries");
					for (int i = 0; i < jsonEntries.length(); i++) {
						JSONObject entryObj = jsonEntries.getJSONObject(i);
						ProductEntry receivedEntry = ServerProxy.jsonToEntry(entryObj);
						receivedList.add(receivedEntry);
					}
					
					jsonEntries = receivedObj.getJSONArray("deleted_product_entries");
					for (int i = 0; i < jsonEntries.length(); i++) {
						JSONObject entryObj = jsonEntries.getJSONObject(i);
						ProductEntry receivedEntry = ServerProxy.jsonToEntry(entryObj);
						receivedDeletedList.add(receivedEntry);
					}
				} catch (Exception e) {
					receivedList = receivedDeletedList = null;
					e.printStackTrace();
				}

				callback.onReceive(receivedList, receivedDeletedList);
			}
		};

		new JsonCallTask().execute(jsonCallParam);
	}
	
	public void deleteProductEntry(final ProductEntry entry, final ProductEntryCallback callback) {
		final JsonCallOptions jsonCallParam = new JsonCallOptions();
		jsonCallParam.method = JsonCaller.METHOD_DELETE;
		jsonCallParam.path = "product_entries/" + entry.serverId;
		jsonCallParam.callback = new JsonCallback() {
			@Override
			public void onReceive(JSONObject receivedObj) {
				try {
					JSONObject entryObj = receivedObj.getJSONObject("product_entry");
					SimpleDateFormat sdfToDateTime = new SimpleDateFormat("EEE, dd MMM yyyy HH:mm:ss z", Locale.US);
					entry.serverId = entryObj.getInt("id");
					entry.deleted_at = new DateTime(sdfToDateTime.parse(entryObj.getString("deleted_at")));
				} catch (Exception e) {
					e.printStackTrace();
				}
				callback.onReceive(entry);
			}
		};

		(new JsonCallTask()).execute(jsonCallParam);
	}
	
	private JSONObject entryToJson(ProductEntry entry, ArrayList<ArticleImage> imageList) {
		JSONObject paramObj = new JSONObject();

		try {
			Article article = entry.article;
			
			JSONArray imagesArr = new JSONArray();
			for (ArticleImage image: imageList) {
				if (image.serverId != 0) { // for now only post new images
					continue;
				}
				
				JSONObject imageObj = new JSONObject();
				imageObj.put("image_data", Base64.encodeToString(image.imageData, Base64.NO_WRAP)); //TODO: fix this warning!
				imageObj.put("mime_type", "image/jpeg");
				imageObj.put("original_extname", ".jpg");
				
				imagesArr.put(imageObj);
			}
			
			
			JSONObject articleObj = new JSONObject();
			articleObj.put("barcode", article.barcode);
			articleObj.put("name", article.name);
			articleObj.put("images", imagesArr);
			

			JSONObject entryObj = new JSONObject();
			if (entry.serverId > 0) {
				entryObj.put("id", entry.serverId);
			}
			entryObj.put("description", entry.description);
			entryObj.put("expiration_date", entry.expiration_date);
			entryObj.put("amount", entry.amount);
			entryObj.put("location_id", entry.location.serverId);
			entryObj.put("article", articleObj);
			paramObj.put("product_entry", entryObj);
		} catch (JSONException e) {
			// just leave param obj empty - the request will then fail anyway
		}
		
		return paramObj;
	}
	
	private static ProductEntry jsonToEntry(JSONObject entryObj) throws JSONException, ParseException {
		SimpleDateFormat sdfToDate = new SimpleDateFormat("yyyy-MM-dd", Locale.US);
		SimpleDateFormat sdfToDateTime = new SimpleDateFormat("EEE, dd MMM yyyy HH:mm:ss z", Locale.US);

		ProductEntry receivedEntry = new ProductEntry();
		receivedEntry.serverId = entryObj.getInt("id");
		receivedEntry.description = entryObj.getString("description");
		receivedEntry.amount = entryObj.getInt("amount");
		receivedEntry.expiration_date = sdfToDate.parse(entryObj.getString("expiration_date"));
		receivedEntry.created_at = new DateTime(sdfToDateTime.parse(entryObj.getString("created_at")));
		receivedEntry.updated_at = new DateTime(sdfToDateTime.parse(entryObj.getString("updated_at")));
		
		JSONObject articleObj = entryObj.getJSONObject("article");
		receivedEntry.article = new Article(articleObj.isNull("name") ? null : articleObj.getString("name"));
		receivedEntry.article.barcode = articleObj.isNull("barcode") ? null : articleObj.getString("barcode");
		
		if (articleObj.has("images")) {
			JSONArray jsonEntries = articleObj.getJSONArray("images");
			for (int i = 0; i < jsonEntries.length(); i++) {
				JSONObject imageObj = jsonEntries.getJSONObject(i);
				ArticleImage image = new ArticleImage();
				image.serverId = imageObj.getInt("id");
				image.article = receivedEntry.article;
				receivedEntry.article.temporaryImages.add(image);
			}
		}

		return receivedEntry;
	}

	public abstract class LocationCallback {
		public abstract void onReceive(Location receivedLocation);
	}
	
	public abstract class LocationListCallback {
		public abstract void onReceive(List<Location> receivedLocations);
	}

	public abstract class ArticleCallback {
		public abstract void onReceive(Article receivedArticle, ArrayList<ArticleImage> receivedImages);
		public abstract void onConnectionError();
	}

	public abstract class ProductEntryCallback {
		public abstract void onReceive(ProductEntry receivedEntry);
	}
	
	public abstract class ProductEntryListCallback {
		public abstract void onReceive(List<ProductEntry> productEntries, List<ProductEntry> deletedProductEntries);
	}

	public abstract class UserCallback {
		public abstract void onReceive(User receivedUser);
		
		public abstract void onError(Map<String,List<String>> errors);
	}

	public abstract class CompletedCallback {
		public abstract void onReceive(boolean success);
	}

	public abstract class JsonCallback {
		public abstract void onReceive(JSONObject receivedObj);
	}

	private class JsonCallOptions {
		public JsonCallback callback;
		public JSONObject params = null;
		public String method;
		public String path;
	}

	private class JsonCallTask extends AsyncTask<JsonCallOptions, Void, JSONObject> {
		private JsonCallback callback;

		@Override
		protected JSONObject doInBackground(JsonCallOptions... paramArgs) {
			try {
				JsonCallOptions callOptions = paramArgs[0];
				this.callback = callOptions.callback;
				JSONObject obj = null;
				if (ServerProxy.this.caller != null) {
					obj = ServerProxy.this.caller.performJsonCall(callOptions.path, callOptions.method,
							callOptions.params);
				} else {
					Log.d("ERR", "JsonCallTask: caller could not be found - returning empty json return");
				}
				return obj;
			} catch (Exception e) {
				Log.d("ERR", "Json error on: " + paramArgs[0].path);
				e.printStackTrace();
				return null;
			}
		}

		@Override
		protected void onPostExecute(JSONObject result) {
			this.callback.onReceive(result);
		}

	}
}
