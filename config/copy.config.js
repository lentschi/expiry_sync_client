// this is a custom dictionary to make it easy to extend/override
// provide a name for an entry, it can be anything such as 'copyAssets' or 'copyFonts'
// then provide an object with a `src` array of globs and a `dest` string
module.exports = {
  copyAssets: {
    src: ['{{SRC}}/assets/**/*'],
    dest: '{{WWW}}/assets'
  },
  copyIndexContent: {
    src: ['{{SRC}}/index.html', '{{SRC}}/manifest.json', '{{SRC}}/service-worker.js'],
    dest: '{{WWW}}'
  },
  copyFonts: {
    src: ['{{ROOT}}/node_modules/ionicons/dist/fonts/**/*', '{{ROOT}}/node_modules/ionic-angular/fonts/**/*'],
    dest: '{{WWW}}/assets/fonts'
  },
  copyPolyfills: {
    src: ['{{ROOT}}/node_modules/ionic-angular/polyfills/polyfills.js'],
    dest: '{{BUILD}}'
  },
  copySwToolbox: {
    src: ['{{ROOT}}/node_modules/sw-toolbox/sw-toolbox.js'],
    dest: '{{BUILD}}'
  },

  // Note: The only reason why persistencejs needs to be copied and included
  // through index.html, is that the persistencejs migrations abort inclusion, if
  // window.persistence is undefined, which it would be using an import statement:
  copyPersistenceJs: {
    src: ['{{ROOT}}/node_modules/persistencejs/lib/**/*'],
    dest: '{{WWW}}/assets/js/persistencejs'
  },

  // Ionic only copies icons to mipmap-mdpi etc., but cordova-plugin-local-notifications seems to
  // require the old (?) location:
  copyAndroidIconsMdpi: {
    src: ['{{SRC}}/assets/android_icons/drawable-mdpi/icon.png'],
    dest: '{{ROOT}}/platforms/android/res/drawable-mdpi'
  },
  copyAndroidIconsXhdpi: {
    src: ['{{SRC}}/assets/android_icons/drawable-xhdpi/icon.png'],
    dest: '{{ROOT}}/platforms/android/res/drawable-xhdpi'
  },
  copyAndroidIconsXxhdpi: {
    src: ['{{SRC}}/assets/android_icons/drawable-xxhdpi/icon.png'],
    dest: '{{ROOT}}/platforms/android/res/drawable-xxhdpi'
  },
  copyAndroidIconsXxxhdpi: {
    src: ['{{SRC}}/assets/android_icons/drawable-xxxhdpi/icon.png'],
    dest: '{{ROOT}}/platforms/android/res/drawable-xxxhdpi'
  },
}
