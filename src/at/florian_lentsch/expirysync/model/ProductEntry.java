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

package at.florian_lentsch.expirysync.model;

import java.util.Date;

import org.joda.time.DateTime;

import com.j256.ormlite.field.DatabaseField;
import com.j256.ormlite.field.types.DateTimeType;
import com.j256.ormlite.table.DatabaseTable;

/**
 * The product entry model
 * 
 * @author Florian Lentsch <office@florian-lentsch.at>
 * 
 */
@DatabaseTable
public class ProductEntry {
	public ProductEntry() {
		this.expiration_date = new Date();
		this.description = "empty";
		this.inSync = false;
		this.deleted_at = null;
	}

	@DatabaseField(generatedId = true)
	private int id;

	@DatabaseField(foreign = true, foreignAutoRefresh = true)
	public Article article;

	@DatabaseField(canBeNull = false, foreign = true, foreignAutoRefresh = true)
	public Location location;

	@DatabaseField
	public int amount, serverId;

	@DatabaseField
	public boolean inSync;

	@DatabaseField
	public String description;

	@DatabaseField
	public Date expiration_date;

	// NOTE: this is _not_ a default type that is stored by ORMLite so we are
	// going to define a custom persister for org.joda.time.DateTime and
	// register it using
	// com.j256.ormlite.field.DataPersisterManager.registerDataPersisters(com.j256.ormlite.field.DataPersister[]).
	// s.
	// http://grepcode.com/file/repo1.maven.org/maven2/com.j256.ormlite/ormlite-jdbc/4.39/com/j256/ormlite/examples/datapersister
	@DatabaseField(persisterClass = DateTimeType.class)
	public DateTime created_at, updated_at, deleted_at;

	public void setId(int id) {
		this.id = id;
	}

	public int getId() {
		return id;
	}
}
