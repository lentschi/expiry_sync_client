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

import java.util.ArrayList;

import com.j256.ormlite.dao.ForeignCollection;
import com.j256.ormlite.field.DatabaseField;
import com.j256.ormlite.field.ForeignCollectionField;
import com.j256.ormlite.table.DatabaseTable;

/**
 * The article model
 * @author Florian Lentsch <office@florian-lentsch.at>
 *
 */
@DatabaseTable
public class Article {
	public Article(String name) {
		this.name=name;
		this.barcode = "unknown";
		this.temporaryImages = new ArrayList<ArticleImage>();
	}
	
	public Article() {
		this(null);
	}
	
	@DatabaseField(generatedId=true)
    private int id;
	
	@DatabaseField(canBeNull = false)
    public String name; 
    
	@DatabaseField
    public String barcode;
	
	@ForeignCollectionField(eager = false)
    public ForeignCollection<ArticleImage> images;
	
	// This attribute is used to save images in the object without saving them in the db (yet)
	public ArrayList<ArticleImage> temporaryImages;
	
	public void setId(int id) {
        this.id = id;
    }

    public int getId() {
        return id;
    }
    
    public ArticleImage getBestImage() {
    	if(this.images.size() == 0) {
    		return null;
    	}
    	
    	ArticleImage bestImage = null;
    	// TODO:
    	for(ArticleImage curImage : this.images) {
    		bestImage = curImage;
    		break;
    	}
    	
    	return bestImage;
    }
}
