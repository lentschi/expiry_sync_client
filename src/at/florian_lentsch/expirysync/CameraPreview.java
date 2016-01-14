/*
 * This file has been copied from the ZBar Bar Code Reader (https://github.com/ZBar), 
 * which has been release under LGPL and then modified by me (Florian Lentsch).
 * Since I am publishing under the GPL, that should be okay.
 */

package at.florian_lentsch.expirysync;

import java.io.IOException;

import android.content.Context;
import android.hardware.Camera;
import android.hardware.Camera.AutoFocusCallback;
import android.hardware.Camera.PreviewCallback;
import android.util.Log;
import android.view.SurfaceHolder;
import android.view.SurfaceView;

/**
 * 
 * Camera preview class
 * 
 */
@SuppressWarnings("deprecation")
// Deprecation warnings are ignored, since we want to support cameras
// for API >= 8
public class CameraPreview extends SurfaceView implements SurfaceHolder.Callback {
	private SurfaceHolder holder;
	private Camera camera;
	private PreviewCallback previewCallback;
	private AutoFocusCallback autoFocusCallback;

	public CameraPreview(Context context, Camera camera, PreviewCallback previewCb, AutoFocusCallback autoFocusCb) {
		super(context);
		this.camera = camera;
		this.previewCallback = previewCb;
		this.autoFocusCallback = autoFocusCb;

		// Install a SurfaceHolder.Callback so we get notified when the
		// underlying surface is created and destroyed:
		this.holder = getHolder();
		this.holder.addCallback(this);

		// deprecated setting, but required on Android versions prior to 3.0
		this.holder.setType(SurfaceHolder.SURFACE_TYPE_PUSH_BUFFERS);
	}

	@Override
	public void surfaceCreated(SurfaceHolder holder) {
		// The Surface has been created, now tell the camera where to draw the
		// preview.
		try {
			Log.d("DBG", "Camera is null: " + (this.camera == null));
			this.camera.setPreviewDisplay(holder);
		} catch (IOException e) {
			Log.d("DBG", "Error setting camera preview: " + e.getMessage());
		}
	}

	@Override
	public void surfaceDestroyed(SurfaceHolder holder) {
		// Camera preview released in activity
	}

	@Override
	public void surfaceChanged(SurfaceHolder holder, int format, int width, int height) {
		/*
		 * If your preview can change or rotate, take care of those events here.
		 * Make sure to stop the preview before resizing or reformatting it.
		 */
		if (this.holder.getSurface() == null) {
			// preview surface does not exist
			return;
		}

		// stop preview before making changes
		try {
			this.camera.stopPreview();
		} catch (Exception e) {
			// ignore: tried to stop a non-existent preview
		}

		try {
			// Hard code camera surface rotation 90 degs to match Activity view
			// in portrait
			this.camera.setDisplayOrientation(90);

			this.camera.setPreviewDisplay(this.holder);
			this.camera.setPreviewCallback(previewCallback);
			this.camera.startPreview();
			this.camera.autoFocus(autoFocusCallback);
		} catch (Exception e) {
			Log.d("DBG", "Error starting camera preview: " + e.getMessage());
		}
	}
}
