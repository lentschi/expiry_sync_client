ExpirySync - Client
===

## Project

This is just the client;
There's a wrapper project including the __API docs__, an easy-to-setup __docker-compose config__, as well as submodules of both server and client at [https://github.com/lentschi/expiry_sync](https://github.com/lentschi/expiry_sync).

The client is written in [ionic](http://ionicframework.com/), which is designed to be an OS independent app development framework (currently supports Android, iOS and Windows Universal App). __However__: For now only exporting the Android version has been tested.

The client is licensed under the [GPLv3](LICENSE.md).


## Preparing for the build

_(__Note:__ The following instruction don't enforce specifc versions of nodjs, npm, cordova and ionic. Future build could fail due to upgrades of those packages. See docker-compose config of the `app` container in the [wrapper project](https://github.com/lentschi/expiry_sync) to get a working version for sure.)_

At first - if you haven't done this yet - [install npm](https://www.npmjs.com/get-npm).

Then in the repository folder run the following:

```bash
npm install -g ionic cordova
npm install

# Fix babili minification (s. https://github.com/ionic-team/ionic-app-scripts/pull/897#issuecomment-297580410 ):
find ./node_modules/@ionic/app-scripts/dist/babili.js -type f -exec sed -i 's/IONIC_USE_EXPERIMENTAL_BABILI/IONIC_BABILI/;s/ionic_use_experimental_babili/ionic_babili/' {} \;

ionic cordova platform add android
# this will cause unwanted changes to config.xml -> 
git checkout config.xml

```

## Building Android version & run it

First make sure an android device or emulator is connected and configured for USB debugging, then run:

```bash
ionic cordova run android --prod
```

## Running the development web server

```bash
ionic serve
```
Then open [http://localhost:8100](http://localhost:8100). 

__Note:__ This will currently only work with Google Chrome!

## Other build options

There are zounds - s. the [ionic docs](http://ionicframework.com/docs/cli/) ;-)

## Testing

Unfortunately there currently aren't any tests for the client.  

However, there used to be [calabash](http://calaba.sh/) tests [in the old version](https://github.com/lentschi/expiry_sync_client/tree/v0.7#testing). Since the ionic version is just a rewrite of the original Java version plus some extensions, those tests could be easily be refactored to work with the current version.