// Protractor configuration file, see link for more information
// https://github.com/angular/protractor/blob/master/lib/config.ts

const { SpecReporter } = require('jasmine-spec-reporter');

exports.config = {
  allScriptsTimeout: 11000,
  specs: [
    './src/**/*.e2e-spec.ts'
  ],
  capabilities: {
    'browserName': 'chrome',
    chromeOptions: {
      args: ['--no-sandbox']
    }
  },
  directConnect: true,
  baseUrl: 'https://expiry-sync-app.local:9002/',
  framework: 'custom',  // set to "custom" instead of cucumber.
  frameworkPath: require.resolve('protractor-cucumber-framework'),
  specs: [
    './features/users/login.feature'     // Specs here are the cucumber feature files
  ],
  cucumberOpts: {
    compiler: "ts:ts-node/register",
    require: ['./support/*.ts'],  // require step definition files before executing features
    tags: [],                      // <string[]> (expression) only execute the features or scenarios with tags matching the expression
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
