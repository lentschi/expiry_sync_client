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

import java.net.URI;
import java.net.URISyntaxException;


public class AlternateServer {
	public URI url;
	public String name, description;
	
	public AlternateServer(String url, String name, String description) throws URISyntaxException {
		this.url = (url != null) ? new URI(url) : null;
		this.name = name;
		this.description = description;
	}
}