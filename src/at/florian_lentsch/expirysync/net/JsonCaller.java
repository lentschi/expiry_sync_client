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

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.io.OutputStreamWriter;
import java.io.UnsupportedEncodingException;
import java.net.CookieHandler;
import java.net.CookieManager;
import java.net.HttpCookie;
import java.net.HttpURLConnection;
import java.net.MalformedURLException;
import java.net.ProtocolException;
import java.net.URI;
import java.net.URISyntaxException;
import java.net.URL;
import java.net.URLEncoder;
import java.text.ParseException;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Iterator;
import java.util.List;
import java.util.Locale;
import java.util.Map;

import org.json.JSONException;
import org.json.JSONObject;

import android.content.ContentValues;
import android.text.TextUtils;

/**
 * Utility class to send queries to a server and receive & interpret the resulting JSON responses
 * @author Florian Lentsch <office@florian-lentsch.at>
 *
 */
public class JsonCaller {
	private URI host = null;
	private CookieManager cookieManager;
	
	public final static String METHOD_GET = "GET";
	public final static String METHOD_PUT = "PUT";
	public final static String METHOD_POST = "POST";
	public final static String METHOD_DELETE = "DELETE";
	
	/**
	 * amount of milliseconds the client's clock is behind the server's 
	 * (or - if this is a negative value - the other way 'round)
	 */
	public static long timeSkew = 0;

	public JsonCaller(String hostStr) throws URISyntaxException {
		setHost(hostStr);
		this.cookieManager = (CookieManager) CookieHandler.getDefault();

		if (this.cookieManager == null) {
			this.cookieManager = new CookieManager();
			CookieHandler.setDefault(this.cookieManager);
		}
	}
	
	public void clearCookies() {
		this.cookieManager.getCookieStore().removeAll();
	}

	/**
	 * set the host to use for subsequent calls
	 * @param hostStr the host to use
	 * @throws URISyntaxException if the url is malformed
	 */
	public void setHost(String hostStr) throws URISyntaxException {
		this.host = new URI(hostStr);
	}

	/**
	 * gets the host, that is used by JsonCaller
	 * @return the current host
	 */
	public String getHost() {
		return this.host.toString();
	}

	/**
	 * Calls a server path and returns a json object with the server's response
	 * @param path the url to call
	 * @param method either {@code "GET"} or {@code "POST"}
	 * @param params parameters to send to the server
	 * @return the server's response
	 * @throws MalformedURLException if the url is invalid
	 * @throws IOException something went wrong while talking to the server
	 * @throws ProtocolException if an invalid {@code method} has been passed
	 * @throws JSONException invalid response received from the server
	 */
	public JSONObject performJsonCall(String path, String method, JSONObject params)
			throws MalformedURLException, IOException, ProtocolException,
			JSONException {
		
		String getParams = "";
		if (params != null && method == METHOD_GET) {
			getParams = jsonToGetParams(params);
		}
		
		URL url = new URL(this.host.toString() + path + getParams);
		boolean outputAvailable = (params != null && method != METHOD_GET);

		//connect to the server:
		HttpURLConnection connection = (HttpURLConnection) url.openConnection();
		prepareConnection(connection, method, outputAvailable);
		connection.connect();

		// write out:
		if (outputAvailable) { // in case there are params and this is a POST request:
			writeParams(connection, params);
		}

		// read:
		determineTimeSkew(connection);
		storeCookies(connection);
		JSONObject obj = readJSON(connection);

		return obj;
	}

	/**
	 * same as {@code performJsonCall(path, JsonCaller.METHOD_GET, params)}
	 * @see #performJsonCall(String, String, JSONObject)
	 */
	public JSONObject get(String path, JSONObject params)
			throws MalformedURLException, IOException, ProtocolException,
			JSONException {
		return this.performJsonCall(path, METHOD_GET, params);
	}

	/**
	 * same as {@code performJsonCall(path, JsonCaller.METHOD_POST, params)}
	 * @see #performJsonCall(String, String, JSONObject)
	 */
	public JSONObject post(String path, JSONObject params)
			throws MalformedURLException, IOException, ProtocolException,
			JSONException {
		return this.performJsonCall(path, METHOD_POST, params);
	}

	private void prepareConnection(HttpURLConnection connection, String method,
			boolean outputAvailable) throws ProtocolException {
		connection.setDoInput(true);
		connection.setDoOutput(outputAvailable);
		connection.setRequestMethod(method);
		connection.setRequestProperty("Content-Type", "application/json");
		connection.setRequestProperty("Accept", "application/json");

		// send cookies if previously set:
		if (this.cookieManager.getCookieStore().getCookies().size() > 0) {
			connection.setRequestProperty("Cookie", TextUtils.join(",",
					this.cookieManager.getCookieStore().getCookies()));
		}
	}

	private void writeParams(HttpURLConnection connection, JSONObject params)
			throws IOException, JSONException, UnsupportedEncodingException {
		OutputStream os = connection.getOutputStream();

		final OutputStreamWriter osw = new OutputStreamWriter(os);
		final String toWriteOut = params.toString();
		
		osw.write(toWriteOut);
		osw.close();
	}
	
	private String jsonToGetParams(JSONObject params) throws UnsupportedEncodingException, JSONException {
		ContentValues getParams = new ContentValues();
		
		Iterator<?> keys = params.keys();
        while( keys.hasNext() ){
            Object key = keys.next();
            if (!(key instanceof String)) {
            	throw new UnsupportedOperationException("Encountered non-string key when parsing http get");
            }
            Object value = params.get((String) key);
            if(value instanceof String ){
            	getParams.put((String) key, (String) value);
            }
            else if(value instanceof Date) {
            	SimpleDateFormat format = new SimpleDateFormat("EEE, dd MMM yyyy HH:mm:ss z", Locale.US);
            	getParams.put((String) key, format.format((Date) value));
            }
            else {
            	throw new UnsupportedOperationException("Encountered unsupported value-type when parsing http get");
            }
        }
		
        return getQuery(getParams);
	}
	
	private String getQuery(ContentValues getParams) throws UnsupportedEncodingException
	{
	    StringBuilder result = new StringBuilder();
	    boolean first = true;

	    for (Map.Entry<String, Object> pair : getParams.valueSet()) {
	        result.append(first ? "?" : "&");        
	        first = false;

	        result.append(URLEncoder.encode(pair.getKey(), "UTF-8"));
	        result.append("=");
	        result.append(URLEncoder.encode(pair.getValue().toString(), "UTF-8"));
	    }

	    return result.toString();
	}

	private void storeCookies(HttpURLConnection connection) {
		Map<String,List<String>> headerFields = connection.getHeaderFields();
		if (headerFields==null) //for example happends when the server returns <forbidden>
			return;
		
		List<String> cookiesHeader = headerFields.get(
				"Set-Cookie");

		if (cookiesHeader != null) {
			for (String cookie : cookiesHeader) {
				this.cookieManager.getCookieStore().add(this.host,
						HttpCookie.parse(cookie).get(0));
			}
		}
	}
	
	private void determineTimeSkew(HttpURLConnection connection) {
		Map<String,List<String>> headerFields = connection.getHeaderFields();
		if (headerFields==null) //for example happends when the server returns <forbidden>
			return;
		
		List<String> dateHeader = headerFields.get(
				"Date");
		
		if (dateHeader != null && dateHeader.size() > 0) {
			SimpleDateFormat format = new SimpleDateFormat("EEE, dd MMM yyyy HH:mm:ss z", Locale.US);
			Date date;
			try {
				date = format.parse(dateHeader.get(0));
			}
			catch(ParseException e) {
				return; // ignore invalid http return header
			}
			JsonCaller.timeSkew = date.getTime() - System.currentTimeMillis();
		}
	}

	private JSONObject readJSON(HttpURLConnection connection)
			throws IOException, JSONException {
		String jsonStr = readStream(connection.getInputStream());
		
		JSONObject obj = new JSONObject(jsonStr);

		return obj;
	}

	private String readStream(InputStream stream) throws IOException {
		BufferedReader bfr = new BufferedReader(new InputStreamReader(stream));
		StringBuffer strBfr = new StringBuffer("");
		String line;
		while ((line = bfr.readLine()) != null) {
			strBfr.append(line + "\n");
		}

		return strBfr.toString();
	}
}
