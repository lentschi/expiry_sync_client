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

import android.support.v7.app.ActionBarActivity;

/**
 * Just a wrapper for {@link ActionBarActivity} to hide deprecation warnings
 * without hiding them for the whole extending class
 * 
 * @author Florian Lentsch <office@florian-lentsch.at>
 * 
 */
@SuppressWarnings("deprecation")
public class UndeprecatedActionBarActivity extends ActionBarActivity {

}