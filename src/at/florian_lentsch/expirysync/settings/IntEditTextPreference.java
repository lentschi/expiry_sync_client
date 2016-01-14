/**
 * copied from http://stackoverflow.com/questions/3721358/preferenceactivity-save-value-as-integer/3755608#3755608
 */
package at.florian_lentsch.expirysync.settings;

import at.florian_lentsch.expirysync.SettingsActivity;

import android.content.Context;
import android.preference.EditTextPreference;
import android.util.AttributeSet;

/**
 * An {@link EditTextPreference} forcing integer input
 * (used by the {@link SettingsActivity})
 * @author <broot@stackoverflow.com>
 * 
 */
public class IntEditTextPreference extends EditTextPreference {

	public IntEditTextPreference(Context context) {
		super(context);
	}

	public IntEditTextPreference(Context context, AttributeSet attrs) {
		super(context, attrs);
	}

	public IntEditTextPreference(Context context, AttributeSet attrs, int defStyle) {
		super(context, attrs, defStyle);
	}

	@Override
	protected String getPersistedString(String defaultReturnValue) {
		return String.valueOf(getPersistedInt(-1));
	}

	@Override
	protected boolean persistString(String value) {
		return persistInt(Integer.valueOf(value));
	}
}