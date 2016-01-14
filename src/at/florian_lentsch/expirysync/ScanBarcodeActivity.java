/*
 * This file has been copied from the ZBar Bar Code Reader (https://github.com/ZBar), 
 * which has been release under LGPL and then modified by me (Florian Lentsch).
 * Since I am publishing under the GPL, that should be okay.
 */

package at.florian_lentsch.expirysync;

import net.sourceforge.zbar.Config;
import net.sourceforge.zbar.Image;
import net.sourceforge.zbar.ImageScanner;
import net.sourceforge.zbar.Symbol;
import net.sourceforge.zbar.SymbolSet;
import android.app.Activity;
import android.content.Intent;
import android.content.pm.ActivityInfo;
import android.hardware.Camera;
import android.hardware.Camera.AutoFocusCallback;
import android.hardware.Camera.PreviewCallback;
import android.hardware.Camera.Size;
import android.os.Bundle;
import android.os.Handler;
import android.util.Log;
import android.view.View;
import android.widget.FrameLayout;
import android.widget.TextView;

/**
 * Activity using {@link CameraPreview} to read a barcode from the primary
 * camera
 * 
 */
@SuppressWarnings("deprecation")
// Deprecation warnings are ignored, since we want to support cameras
// for API >= 8
public class ScanBarcodeActivity extends Activity {
	public static final String SCANNED_BARCODE = "at.florian_lentsch.expirysync.SCANNED_BARCODE";

	/**
	 * The camera used for scanning (currently only the first camera of any
	 * device is used)
	 */
	private Camera camera;

	/**
	 * The camera preview surface view
	 */
	private CameraPreview preview;

	private Handler autoFocusHandler;

	/**
	 * The text view informing the user of what they should do or what barcode
	 * has been scanned
	 */
	private TextView scanText;

	/**
	 * The ZBar barcode scanner
	 */
	private ImageScanner scanner;

	/**
	 * Previewing is being done
	 */
	private boolean previewing = true;

	static {
		// Required by ZBar:
		System.loadLibrary("iconv");
	}

	public void onCreate(Bundle savedInstanceState) {
		super.onCreate(savedInstanceState);

		setContentView(R.layout.activity_scan_barcode);

		setRequestedOrientation(ActivityInfo.SCREEN_ORIENTATION_PORTRAIT);

		this.autoFocusHandler = new Handler();
		this.camera = getCameraInstance();
		if (this.camera == null) {
			setResult(RESULT_CANCELED);
			finish();
			return;
		}

		// Configure the ZBar barcode this.scanner:
		this.scanner = new ImageScanner();
		this.scanner.setConfig(0, Config.X_DENSITY, 3);
		this.scanner.setConfig(0, Config.Y_DENSITY, 3);

		this.preview = new CameraPreview(this, this.camera, previewCb, autoFocusCB);
		FrameLayout previewFrame = (FrameLayout) findViewById(R.id.cameraPreview);
		previewFrame.addView(this.preview);

		ScanBarcodeActivity.this.scanText = (TextView) findViewById(R.id.scanText);
	}

	public void onPause() {
		super.onPause();
		releaseCamera();
	}

	/** A safe way to get an instance of the Camera object. */
	public static Camera getCameraInstance() {
		Camera c = null;
		try {
			c = Camera.open(0);
		} catch (Exception e) {
			Log.d("DBG", "Could not open camera");
		}
		Log.d("DBG", "Getting camera - is null: " + (c == null));
		return c;
	}

	private void releaseCamera() {
		if (this.camera != null) {
			this.previewing = false;
			this.camera.setPreviewCallback(null);
			this.camera.release();
			this.camera = null;
		}
	}

	private Runnable doAutoFocus = new Runnable() {
		public void run() {
			if (ScanBarcodeActivity.this.previewing) {
				ScanBarcodeActivity.this.camera.autoFocus(autoFocusCB);
			}
		}
	};

	PreviewCallback previewCb = new PreviewCallback() {
		public void onPreviewFrame(byte[] data, Camera camera) {
			Camera.Parameters parameters = camera.getParameters();
			Size size = parameters.getPreviewSize();

			Image barcode = new Image(size.width, size.height, "Y800");
			barcode.setData(data);

			int result = ScanBarcodeActivity.this.scanner.scanImage(barcode);

			if (result != 0) {
				ScanBarcodeActivity.this.previewing = false;
				ScanBarcodeActivity.this.camera.setPreviewCallback(null);
				ScanBarcodeActivity.this.camera.stopPreview();

				SymbolSet syms = ScanBarcodeActivity.this.scanner.getResults();
				if (syms.size() > 0) {
					Symbol sym = (Symbol) syms.toArray()[0];
					String barcodeStr = sym.getData();
					ScanBarcodeActivity.this.scanText.setText("barcode result " + barcodeStr);

					Intent resultIntent = new Intent();
					resultIntent.putExtra(SCANNED_BARCODE, barcodeStr);
					setResult(RESULT_OK, resultIntent);
					finish();
				}

			}

		}
	};

	public void abortForManualEntry(View view) {
		setResult(RESULT_CANCELED);
		finish();
	}

	// Mimic continuous auto-focusing
	AutoFocusCallback autoFocusCB = new AutoFocusCallback() {
		public void onAutoFocus(boolean success, Camera camera) {
			ScanBarcodeActivity.this.autoFocusHandler.postDelayed(doAutoFocus, 1000);
		}
	};
}
