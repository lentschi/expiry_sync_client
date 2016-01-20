ExpirySync - Android Client
===

## Project

This is just the client;
There's a wrapper project including the __API docs__ as well as both server and client as submodules at [https://github.com/lentschi/expiry_sync](https://github.com/lentschi/expiry_sync).

## Building & Running


### appcompat

This project requires Google's v7 appcompat to be included. Here you should learn how to do that in Android Studio:
[http://developer.android.com/tools/support-library/setup.html](http://developer.android.com/tools/support-library/setup.html)

.. or, if you're still using the Eclipse plugin (which is unfortunately no longer supported by Google): 
s. [AppCompatUnderEclipse.md](pm/docs/AppCompatUnderEclipse.md)


### Default preferences

Set the default preferences for the app by copying the sample at `res/xml/.main_preferences.xml.example` to `res/xml/main_preferences.xml` and adept the default values to your needs. (You will have to at least change the default value for `pref_key_host` to match your API server.)

---

That's it, you're set - just choose whichever IDE / build tool you prefer to install the Android SDK, build the app with it, and run it.




## Testing


### Requirements

- Ensure that building the client (s. above) worked out and you have generated the file `bin/expiry_sync_client.apk`.
- We're going to use calabash a ruby based testing lib, so [install ruby](https://www.ruby-lang.org/en/documentation/installation/) (v2.1 +)
- Install calabash: 
  `gem install bundler && bundle install`

You will also need some kind of camera emulation. On Linux you could use __v4l2loopback__ by doing something like this:

```bash
# to insert the kernel module
# Note: you might need to install v4l2loopback first:
sudo modprobe v4l2loopback video_nr=0 

# To check if it works:
gst-launch-0.10 -v multifilesrc location= /path-to-android-project/features/support/img/blank.png loop=1 caps="image/png,framerate=30/1" ! pngdec ! ffmpegcolorspace ! "video/x-raw-yuv,format=(fourcc)YUY2" ! videorate ! v4l2sink device=/dev/video0
vlc v4l2:///dev/video0
#-> You should see a blue screen (not a bluescreen - it's just that blank.png is completely blue ;-) )
```

#### Configure environment specific test scripts:

The following files need to exist and have to be executable, for the tests to be able to run (__Examples__ can be found in the respective `*.example` files in the same directory):

- `test_server_scripts/reset_initial_server_db` - reset the API server db (so it's empty, but all the tables are present)
- `test_server_scripts/start_server` - start the API server (if it is already running, restart instead)
- `test_server_scripts/stop_server` - stop the API server
- `features/support/device_dependent_scripts/start_showing_image` - receives image name as first param. The image with that name supplemented with .png should be displayed using the camera emulation. Images reside in `features/support/webcam_images`.
- `features/support/device/stop_showing_image` - stops showing any image using webcam emulation.

### Running the tests

- Ensure that camera emulation is running. (On my machine I need to run `gst-launch-0.10` before launching the emulator as explained above)
- Start an android emulator of your choice with the first camera set to the emulated camera and the system language to US English (i18n is not yet part of the tests).
- Ensure that you have the environment variable `ANDROID_HOME` set to you SDK directory.
- run `calabash-android run bin/expiry_sync_client.apk`.
