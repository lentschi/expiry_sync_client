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

import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Iterator;
import java.util.List;
import java.util.Locale;

import org.joda.time.DateTime;

import android.annotation.SuppressLint;
import android.content.Context;
import android.content.SharedPreferences;
import android.content.res.Resources;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.ArrayAdapter;
import android.widget.CheckBox;
import android.widget.CompoundButton;
import android.widget.CompoundButton.OnCheckedChangeListener;
import android.widget.Filter;
import android.widget.Filterable;
import android.widget.TextView;

import at.florian_lentsch.expirysync.model.ProductEntry;

/**
 * List adapter for product entry lists
 * 
 * @author Florian Lentsch <office@florian-lentsch.at>
 * 
 */
public class ProductAdapter extends ArrayAdapter<ProductEntry> implements Filterable {
	/**
	 * entries that are in the list (and thus can be filtered or sorted)
	 */
	private ArrayList<ProductEntry> allEntries;
	
	/**
	 * listener for changes to an item's checked state
	 */
	private ProductListActivity.ListItemCheckedChange checkedChangeListener;

	/**
	 * 
	 * @param context
	 * @param itemTemplateId
	 *            id of a list item's template
	 * @param productEntries
	 *            the product entries to be displayed in the list
	 * @param checkedChange
	 *            listener for changes to an item's checked state
	 */
	public ProductAdapter(Context context, int itemTemplateId, List<ProductEntry> productEntries,
			ProductListActivity.ListItemCheckedChange checkedChange) {
		super(context, itemTemplateId, productEntries);
		this.checkedChangeListener = checkedChange;

		this.setAllEntries(productEntries);
	}

	/**
	 * sets the list entries
	 * 
	 * @param productEntries
	 */
	protected void setAllEntries(List<ProductEntry> productEntries) {
		// Need to clone this list, since filtering will kick entries out of
		// this.objects:
		this.allEntries = new ArrayList<ProductEntry>(productEntries);
	}

	@Override
	@SuppressLint("InflateParams")
	public View getView(final int position, View convertView, ViewGroup parent) {
		View view = convertView;
		if (view == null) {
			LayoutInflater vi = (LayoutInflater) getContext().getSystemService(Context.LAYOUT_INFLATER_SERVICE);
			view = vi.inflate(R.layout.product_list_item, null);
		}

		final ProductEntry productEntry = getItem(position);
		if (productEntry == null) {
			return view;
		}

		// set the product entry's contents:
		TextView nameTxt = (TextView) view.findViewById(R.id.product_list_item_name);
		nameTxt.setText(productEntry.amount + "x " + productEntry.article.name);

		if (productEntry.expiration_date != null) {
			displayExpirationDate(productEntry, view);
		}

		// set the checkbox listener:
		CheckBox chkbx = (CheckBox) view.findViewById(R.id.product_list_item_checkbox);
		chkbx.setOnCheckedChangeListener(new OnCheckedChangeListener() {

			@Override
			public void onCheckedChanged(CompoundButton buttonView, boolean isChecked) {
				ProductAdapter.this.checkedChangeListener.checkedChange(productEntry, position, isChecked);
			}
		});

		return view;
	}

	/**
	 * Displays the expiration date according to the thresholds found in the
	 * shared preferences
	 * 
	 * @param productEntry
	 *            product entry to display the expiration date for
	 * @param view
	 *            list item view
	 */
	private void displayExpirationDate(ProductEntry productEntry, View view) {
		TextView expirationDateTxt = (TextView) view.findViewById(R.id.product_list_item_expiration_date);
		final Resources res = getContext().getResources();

		// coloring:
		final SharedPreferences sharedPref = getContext().getSharedPreferences("main", Context.MODE_PRIVATE);
		int daysBeforeMedium = sharedPref.getInt(SettingsActivity.KEY_DAYS_BEFORE_MEDIUM, 0);
		int daysBeforeBad = sharedPref.getInt(SettingsActivity.KEY_DAYS_BEFORE_BAD, 0);
		
		expirationDateTxt.setTextColor(res.getColor(R.color.expiration_date_good));

		if ((new DateTime(productEntry.expiration_date)).minusDays(daysBeforeMedium).isBeforeNow()) {
			expirationDateTxt.setTextColor(res.getColor(R.color.expiration_date_medium));
		}

		if ((new DateTime(productEntry.expiration_date)).minusDays(daysBeforeBad).isBeforeNow()) {
			expirationDateTxt.setTextColor(res.getColor(R.color.expiration_date_bad));
		}

		// set the date (formatted for the current locale):
		java.text.DateFormat formatter = java.text.DateFormat.getDateInstance(java.text.DateFormat.SHORT,
				Locale.getDefault());
		String localPattern = ((SimpleDateFormat) formatter).toLocalizedPattern();
		SimpleDateFormat df = new SimpleDateFormat(localPattern);
		expirationDateTxt.setText(res.getText(R.string.expiration_date) + ": "
				+ df.format(productEntry.expiration_date));
	}

	/**
	 * (non-Javadoc) 
	 * filters by name and barcode
	 */
	@Override
	public Filter getFilter() {

		Filter filter = new Filter() {
			@Override
			protected FilterResults performFiltering(CharSequence constraint) {
				final String searchStr = constraint.toString().toLowerCase();

				FilterResults results = new FilterResults();
				ArrayList<ProductEntry> filteredEntries = new ArrayList<ProductEntry>();

				for (int i = 0; i < ProductAdapter.this.allEntries.size(); i++) {
					ProductEntry entry = ProductAdapter.this.allEntries.get(i);

					// add entries to filter result, where name or barcode
					// matches the search text (case-insensitive):
					if (entry.article.name.toLowerCase().contains(searchStr)
							|| (entry.article.barcode != null && entry.article.barcode.toLowerCase()
									.contains(searchStr))) {
						filteredEntries.add(entry);
					}
				}

				results.count = filteredEntries.size();
				results.values = filteredEntries;

				return results;
			}

			@SuppressWarnings("unchecked")
			@Override
			protected void publishResults(CharSequence constraint, FilterResults results) {
				notifyDataSetChanged();

				// Clear the list of items...:
				clear();

				// ... then add the items matching the filter back in:
				for (Iterator<ProductEntry> iterator = ((ArrayList<ProductEntry>) results.values).iterator(); iterator
						.hasNext();) {
					ProductEntry entry = (ProductEntry) iterator.next();
					add(entry);
				}
			}
		};

		return filter;
	}
}
