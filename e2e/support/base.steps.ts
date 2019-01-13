const { Given } = require('cucumber');
const chai = require('chai').use(require('chai-as-promised'));
const { exec } = require('child_process');
const chExpect = chai.expect;

Given(/^the ExpirySync API server is in its pristine state and running$/, async () => {
    await chExpect('lala').to.eventually.equal('Google');
});
