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

package at.florian_lentsch.expirysync.db;

import java.sql.SQLException;
import java.util.List;

import android.content.Context;

import at.florian_lentsch.expirysync.model.Article;
import at.florian_lentsch.expirysync.model.ArticleImage;
import at.florian_lentsch.expirysync.model.Location;
import at.florian_lentsch.expirysync.model.ProductEntry;
import com.j256.ormlite.dao.Dao;
import com.j256.ormlite.dao.ForeignCollection;
import com.j256.ormlite.stmt.DeleteBuilder;
import com.j256.ormlite.stmt.QueryBuilder;
import com.j256.ormlite.stmt.UpdateBuilder;

/**
 * Provides abstraction for the OrmLite database layer
 * @author Florian Lentsch <office@florian-lentsch.at>
 *
 */
public class DatabaseManager {

	static private DatabaseManager instance;

	static public void init(Context ctx) {
		if (null == DatabaseManager.instance) {
			/*
			 * 
			 * We register our own persister for DateTime objects. ORMLite actually
			 * has a built in one but it has to use reflection.
			 */
			//DataPersisterManager.registerDataPersisters(DateTimePersister.getSingleton());
			
			DatabaseManager.instance = new DatabaseManager(ctx);
		}
	}

	static public DatabaseManager getInstance() {
		return DatabaseManager.instance;
	}

	private DatabaseHelper helper;

	private DatabaseManager(Context ctx) {
		helper = new DatabaseHelper(ctx);
	}

	private DatabaseHelper getHelper() {
		return helper;
	}

	public List<ProductEntry> getAllProductEntries() {
		return this.getAllProductEntries(false);
	}
	
	public List<ProductEntry> getAllProductEntries(boolean deletedToo) {
		Dao<ProductEntry, Integer> dao = getHelper().getProductEntryDao();
		QueryBuilder<ProductEntry, Integer> qb = dao.queryBuilder();
		List<ProductEntry> foundEntries;

		try {
			if (!deletedToo) {
				qb.where().isNull("deleted_at");
			}
			foundEntries = dao.query(qb.prepare());

			return foundEntries;
		} catch (SQLException e) {
			e.printStackTrace();
		}

		return null;
	}

	/**
	 * retrieve product entry - take care: will also return deleted entries!
	 * @param id  local db id
	 * @return ProductEntry the entry you were looking for
	 */
	public ProductEntry getProductEntryById(int id) {
		ProductEntry productEntry = null;
		try {
			productEntry = getHelper().getProductEntryDao().queryForId(id);
		} catch (SQLException e) {
			e.printStackTrace();
		}
		return productEntry;
	}

	public List<Article> getAllArticles() {
		List<Article> articles = null;
		try {
			articles = getHelper().getArticleDao().queryForAll();
		} catch (SQLException e) {
			e.printStackTrace();
		}
		return articles;
	}

	public Article findArticleByBarcode(String barcode) {
		Dao<Article, Integer> dao = getHelper().getArticleDao();
		QueryBuilder<Article, Integer> qb = dao.queryBuilder();
		List<Article> foundArticles;

		try {
			qb.where().eq("barcode", barcode);
			foundArticles = dao.query(qb.prepare());

			if (foundArticles.size() > 1) {
				throw new SQLException("search for barcode returned more than one article");
			}

			if (foundArticles.size() == 1) {
				return foundArticles.get(0);
			}
		} catch (SQLException e) {
			e.printStackTrace();
		}

		return null;
	}
	
	public Article updateOrAddArticle(Article article) {
		Dao<Article, Integer> dao = getHelper().getArticleDao();

		try {
			Article foundArticle = (article.barcode == null || article.barcode.length() == 0) ? null : this.findArticleByBarcode(article.barcode);

			if (foundArticle != null) { // exists -> needs to be updated
				foundArticle.name = article.name;
				foundArticle.temporaryImages = article.temporaryImages;
				dao.update(foundArticle);

				return foundArticle;
			}

			// does not exist -> create it:
			dao.create(article);
		} catch (SQLException e) {
			e.printStackTrace();
		}

		return article;
	}
	
	public ProductEntry findProductEntryByServerId(int serverId) {
		return findProductEntryByServerId(serverId, true);
	}
	
	public ProductEntry findProductEntryByServerId(int serverId, boolean deletedToo) {
		Dao<ProductEntry, Integer> dao = getHelper().getProductEntryDao();
		QueryBuilder<ProductEntry, Integer> qb = dao.queryBuilder();
		List<ProductEntry> foundEntries;

		try {
			qb.where().eq("serverId", serverId);
			if (!deletedToo) {
				qb.where().isNull("deleted_at");
			}
			foundEntries = dao.query(qb.prepare());

			if (foundEntries.size() > 1) {
				throw new SQLException("search for serverId returned more than one product entry");
			}

			if (foundEntries.size() == 1) {
				return foundEntries.get(0);
			}
		} catch (SQLException e) {
			e.printStackTrace();
		}

		return null;
	}
		
	public List<ProductEntry> getProductEntriesOutOfSync() {
		Dao<ProductEntry, Integer> dao = getHelper().getProductEntryDao();
		QueryBuilder<ProductEntry, Integer> qb = dao.queryBuilder();
		List<ProductEntry> foundEntries;

		try {
			qb.where().eq("inSync", false);
			foundEntries = dao.query(qb.prepare());
			return foundEntries;
		} catch (SQLException e) {
			e.printStackTrace();
		}

		return null;
	}

	public void addProductEntry(ProductEntry p) {
		try {
			getHelper().getProductEntryDao().create(p);
		} catch (SQLException e) {
			e.printStackTrace();
		}
	}
	
	public ProductEntry updateOrAddProductEntry(ProductEntry productEntry) {
		Dao<ProductEntry, Integer> dao = getHelper().getProductEntryDao();

		try {
			productEntry.article = this.updateOrAddArticle(productEntry.article);
			if (productEntry.article == null || productEntry.article.getId() == 0) {
				throw new Exception("Error updating/creating article");
			}
			ProductEntry foundEntry = this.findProductEntryByServerId(productEntry.serverId);

			if (foundEntry != null) { // exists -> needs to be updated
				foundEntry.amount = productEntry.amount;
				foundEntry.description = productEntry.description;
				foundEntry.expiration_date = productEntry.expiration_date;
				foundEntry.updated_at = productEntry.updated_at;
				foundEntry.article = productEntry.article;
				foundEntry.inSync = productEntry.inSync;
				
				dao.update(foundEntry);

				return foundEntry;
			}

			// does not exist -> create it:
			dao.create(productEntry);
		} catch (Exception e) {
			e.printStackTrace();
		}

		return productEntry;
	}
	
	public void addLocation(Location l) {
		try {
			getHelper().getLocationDao().create(l);
		} catch (SQLException e) {
			e.printStackTrace();
		}
	}
	
	public void updateLocation(Location p) {
		try {
			getHelper().getLocationDao().update(p);
		} catch (SQLException e) {
			e.printStackTrace();
		}
	}
	
	public void addArticleImage(ArticleImage i) {
		try {
			getHelper().getArticleImageDao().create(i);
		} catch (SQLException e) {
			e.printStackTrace();
		}
	}
	
	public void updateArticleImage(ArticleImage image) {
		try {
			getHelper().getArticleImageDao().update(image);
		} catch (SQLException e) {
			e.printStackTrace();
		}
	}

	public void updateProductEntry(ProductEntry p) {
		try {
			getHelper().getProductEntryDao().update(p);
		} catch (SQLException e) {
			e.printStackTrace();
		}
	}

	// Actually unused as articles are always kept for now:
	public Boolean removeArticleIfOrphan(Article a) {
		Dao<ProductEntry, Integer> dao = getHelper().getProductEntryDao();
		QueryBuilder<ProductEntry, Integer> qb = dao.queryBuilder();

		try {
			qb.where().eq("article_id", a.getId());
			long entriesCount = dao.countOf(qb.prepare());

			if (entriesCount == 0) {
				deleteArticle(a);
				return true;
			}
		} catch (SQLException e) {
			e.printStackTrace();
		}

		return false;
	}

	public void deleteProductEntry(ProductEntry p) {
		try {
			getHelper().getProductEntryDao().delete(p);
		} catch (SQLException e) {
			e.printStackTrace();
		}
	}

	public void deleteArticle(Article a) {
		try {
			getHelper().getArticleDao().delete(a);
		} catch (SQLException e) {
			e.printStackTrace();
		}
	}
	
	public void deleteSynchronizedRecords() {
		Dao<ProductEntry, Integer> entryDao = getHelper().getProductEntryDao();
		DeleteBuilder<ProductEntry, Integer> entryDeleteBuilder = entryDao.deleteBuilder();
		
		Dao<Location, Integer> locationDao = getHelper().getLocationDao();
		UpdateBuilder<Location, Integer> locationUpdateBuilder = locationDao.updateBuilder();

		try {
			entryDeleteBuilder.where().eq("inSync", true);
			entryDeleteBuilder.delete();
			
			locationUpdateBuilder.updateColumnValue("serverId", null);
			locationUpdateBuilder.where().isNotNull("serverId");
			locationUpdateBuilder.update();
			
		} catch (SQLException e) {
			e.printStackTrace();
		}
	}
	
	public ForeignCollection<ArticleImage> initializeArticleImagesCollection() {
		try {
			return getHelper().getArticleDao().getEmptyForeignCollection("images");
		} catch (SQLException e) {
			e.printStackTrace();
			return null;
		}
	}
	
	public Location getDefaultLocation() {
		Dao<Location, Integer> dao = getHelper().getLocationDao();
		QueryBuilder<Location, Integer> qb = dao.queryBuilder();
		List<Location> foundLocations;
		
		try {
			qb.where().eq("isDefault", true);
			foundLocations = dao.query(qb.prepare());

			if (foundLocations.size() > 1) {
				throw new SQLException("search for default location returned more than one location");
			}

			if (foundLocations.size() == 1) {
				return foundLocations.get(0);
			}
		} catch (SQLException e) {
			e.printStackTrace();
		}

		return null;
	}

	public Article getArticleById(int id) {
		Article article = null;
		try {
			article = getHelper().getArticleDao().queryForId(id);
		} catch (SQLException e) {
			e.printStackTrace();
		}
		return article;
	}
}