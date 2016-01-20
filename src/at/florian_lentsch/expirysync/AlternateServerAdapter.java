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

import android.annotation.SuppressLint;
import android.content.Context;
import android.view.LayoutInflater;
import android.view.View;
import android.view.View.OnClickListener;
import android.view.ViewGroup;
import android.widget.ArrayAdapter;
import android.widget.Filterable;
import android.widget.TextView;
import at.florian_lentsch.expirysync.net.AlternateServer;

public class AlternateServerAdapter extends ArrayAdapter<AlternateServer> implements Filterable {
	private ServerTapListener tappedCallback;

	public AlternateServerAdapter(Context context, int itemTemplateId, List<AlternateServer> alternateServer,
			ServerTapListener tappedCallback) {
		super(context, itemTemplateId, alternateServer);
		this.tappedCallback = tappedCallback;
	}

	@Override
	@SuppressLint("InflateParams")
	public View getView(final int position, View convertView, ViewGroup parent) {
		View view = convertView;
		if (view == null) {
			LayoutInflater vi = (LayoutInflater) getContext().getSystemService(Context.LAYOUT_INFLATER_SERVICE);
			view = vi.inflate(R.layout.server_list_item, null);
		}

		final AlternateServer alternateServer = getItem(position);
		if (alternateServer == null) {
			return view;
		}

		// set the server's contents:
		TextView urlTxt = (TextView) view.findViewById(R.id.server_url);
		urlTxt.setText((alternateServer.url == null) ? "-" : alternateServer.url.toString());

		TextView nameTxt = (TextView) view.findViewById(R.id.server_name);
		nameTxt.setText(alternateServer.name);

		TextView descriptionTxt = (TextView) view.findViewById(R.id.server_description);
		descriptionTxt.setText(alternateServer.description);

		OnClickListener listener = new OnClickListener() {

			@Override
			public void onClick(View v) {
				v.setBackgroundColor(0xffcccccc);
				AlternateServerAdapter.this.tappedCallback.tapped(alternateServer);
			}
		};
		view.setOnClickListener(listener);
		return view;
	}

	protected static abstract class ServerTapListener {
		public abstract void tapped(AlternateServer alternateServer);
	}
}