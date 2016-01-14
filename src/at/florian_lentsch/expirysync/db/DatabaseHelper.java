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

import java.util.ArrayList;
import java.util.List;

import android.content.Context;
import android.database.SQLException;
import android.database.sqlite.SQLiteDatabase;
import android.util.Log;

import at.florian_lentsch.expirysync.model.Article;
import at.florian_lentsch.expirysync.model.ArticleImage;
import at.florian_lentsch.expirysync.model.Location;
import at.florian_lentsch.expirysync.model.ProductEntry;
import com.j256.ormlite.android.apptools.OrmLiteSqliteOpenHelper;
import com.j256.ormlite.dao.Dao;
import com.j256.ormlite.support.ConnectionSource;
import com.j256.ormlite.table.TableUtils;

/**
 * Database helper for OrmLite
 * @author Florian Lentsch <office@florian-lentsch.at>
 *
 */
public class DatabaseHelper extends OrmLiteSqliteOpenHelper {
	private static final String DATABASE_NAME = "ExpirySync.sqlite";
	private static final int DATABASE_VERSION = 1;

	// the DAO object we use to access the SimpleData table
	private Dao<ProductEntry, Integer> productEntryDao = null;
	private Dao<Article, Integer> articleDao = null;
	private Dao<ArticleImage, Integer> articleImageDao = null;
	private Dao<Location, Integer> locationDao = null;

	public DatabaseHelper(Context context) {
		super(context, DATABASE_NAME, null, DATABASE_VERSION);
	}

	@Override
	public void onCreate(SQLiteDatabase database, ConnectionSource connectionSource) {
		try {
			TableUtils.createTable(connectionSource, Location.class);
			TableUtils.createTable(connectionSource, Article.class);
			TableUtils.createTable(connectionSource, ProductEntry.class);
			TableUtils.createTable(connectionSource, ArticleImage.class);
		} catch (SQLException e) {
			Log.e(DatabaseHelper.class.getName(), "Can't create the database", e);
			throw new RuntimeException(e);
		} catch (java.sql.SQLException e) {
			e.printStackTrace();
		}

	}

	@Override
	public void onUpgrade(SQLiteDatabase db, ConnectionSource connectionSource, int oldVersion, int newVersion) {
		if (newVersion <= oldVersion) {
			throw new RuntimeException("migrating db down not implemented");
		}

		try {
			List<String> allSql = new ArrayList<String>();

			switch (newVersion) {
				// version upgrades go here 
			}
			for (String sql : allSql) {
				db.execSQL(sql);
			}
		} catch (SQLException e) {
			Log.e(DatabaseHelper.class.getName(), "exception during onUpgrade", e);
			throw new RuntimeException(e);
		}

	}

	public Dao<ProductEntry, Integer> getProductEntryDao() {
		if (null == this.productEntryDao) {
			try {
				this.productEntryDao = getDao(ProductEntry.class);
			} catch (java.sql.SQLException e) {
				e.printStackTrace();
			}
		}
		return this.productEntryDao;
	}

	public Dao<Article, Integer> getArticleDao() {
		if (null == this.articleDao) {
			try {
				this.articleDao = getDao(Article.class);
			} catch (java.sql.SQLException e) {
				e.printStackTrace();
			}
		}
		return this.articleDao;
	}

	public Dao<ArticleImage, Integer> getArticleImageDao() {
		if (null == this.articleImageDao) {
			try {
				this.articleImageDao = getDao(ArticleImage.class);
			} catch (java.sql.SQLException e) {
				e.printStackTrace();
			}
		}
		return this.articleImageDao;
	}

	public Dao<Location, Integer> getLocationDao() {
		if (null == this.locationDao) {
			try {
				this.locationDao = getDao(Location.class);
			} catch (java.sql.SQLException e) {
				e.printStackTrace();
			}
		}
		return this.locationDao;
	}

}