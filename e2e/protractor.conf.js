// Protractor configuration file, see link for more information
// https://github.com/angular/protractor/blob/master/lib/config.ts

const { SpecReporter } = require('jasmine-spec-reporter');

exports.config = {
  allScriptsTimeout: 11000,
  specs: [
    './src/**/*.e2e-spec.ts'
  ],
  // multiCapabilities:[
  //   {
  //     "browserName": "chrome",
  //     "seleniumAddress": 'http://172.24.0.1:4444/wd/hub',
  //     chromeOptions: {
  //       args: [
  //               '--allow-file-access', 
  //               '--use-file-for-fake-video-capture="/srv/project/out.y4m"', 
  //               '--use-fake-device-for-media-stream',
  //               '--disable-infobars'
  //             ]
  //       }, 
  //       prefs: {
  //         intl: { accept_languages: "en-US" },
  //       },
  //   },
  // ], 
  chromeDriver: './protractor-chromedriver.sh',
  capabilities: {
    browserName: 'chrome',
    chromeOptions: {
      binary: '/usr/bin/google-chrome-stable',
      args: [
        '--no-sandbox', 
        // '--headless',
        // '--window-size=1680,1050',
        '--allow-file-access', 
        '--use-file-for-fake-video-capture=//tmp//e2e.y4m', 
        '--use-fake-device-for-media-stream',
        '--use-fake-ui-for-media-stream',
        '--disable-infobars'
      ]
    } 
  },
  // multiCapabilities:[
  //     {
  //       "browserName": "chrome",
  //       seleniumAddress: 'http://localhost:9515',
  //       chromeOptions: {
  //         binary: '/usr/bin/chromium-browser',
  //         args: [
  //                 '--no-sandbox', 
  //                 '--verbose',
  //                 '--allow-file-access', 
  //                 '--use-file-for-fake-video-capture="/srv/project/out.y4m"', 
  //                 '--use-fake-device-for-media-stream',
  //                 '--disable-infobars'
  //               ]
  //         }, 
  //         prefs: {
  //           intl: { accept_languages: "en-US" },
  //         },
  //     },
  //   ], 
  directConnect: true,
  baseUrl: 'https://localhost:9002/',
  framework: 'custom',  // set to "custom" instead of cucumber.
  frameworkPath: require.resolve('protractor-cucumber-framework'),
  specs: [
    // './features/**/*.feature',     // Specs here are the cucumber feature files
    './features/product_entries/synchronization.feature'
  ],
  cucumberOpts: {
    compiler: "ts:ts-node/register",
    require: ['./support/*.ts'],  // require step definition files before executing features
    tags: ['@fit'],                      // <string[]> (expression) only execute the features or scenarios with tags matching the expression
    strict: true,                  // <boolean> fail if there are any undefined or pending steps
    // format: ["pretty"],            // <string[]> (type[:path]) specify the output format, optionally supply PATH to redirect formatter output (repeatable)
    dryRun: false,                 // <boolean> invoke formatters without executing steps
    failFast: true
},
  jasmineNodeOpts: {
    showColors: true,
    defaultTimeoutInterval: 30000,
    print: function() {}
  },
  onPrepare() {
    browser.manage().window().maximize(); // maximize the browser before executing the feature files
    require('ts-node').register({
      project: 'e2e/tsconfig.e2e.json'
    });
  }
};
