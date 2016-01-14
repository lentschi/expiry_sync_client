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

import com.j256.ormlite.field.DataType;
import com.j256.ormlite.field.DatabaseField;
import com.j256.ormlite.table.DatabaseTable;

/**
 * The article image model
 * @author Florian Lentsch <office@florian-lentsch.at>
 *
 */
@DatabaseTable
public class ArticleImage {	
	public ArticleImage() {
		
	}
	
	@DatabaseField(generatedId=true)
    private int id;
	
	@DatabaseField
	public int serverId;
	
	@DatabaseField(canBeNull = false, foreign = true, foreignAutoRefresh = true)
	public Article article;
	
	@DatabaseField(dataType = DataType.BYTE_ARRAY)
	public byte[] imageData;
	
	public void setId(int id) {
        this.id = id;
    }

    public int getId() {
        return id;
    }
}
