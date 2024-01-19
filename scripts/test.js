/*
This script can be used to run the test in a selected package.
The script assumes that a lively server is running locally on port 9011.
This script gets used by `test.sh`. To invoke tests, run `test.sh`.
You should rarely (never) want to invoke this script here directly.

This script supports two "modes" of running tests, running them locally or inside of a GitHub Action.
In the latter case, we use some special formatting hints for actions in our output and provide a markdown summary of failing tests
to be rendered by GitHub in a file called `test_output.md`. Otherwise, information is logged only to the console.
Since this script gets called by another shell script, that we need to run further, even if a test fails in here, we communicate some
summary statistics and other information in the form of text files, that then get used in the outer shell script.
*/

const http = require('http');
const fs = require('fs');

const CI = !!process.env.CI;

const targetPackage = process.argv[2];
let passed = 0; let failed = 0; let skipped = 0;
let markdownListOfFailingTests = '';

if (CI) {
  console.log(`Running Tests for ${targetPackage} 📦`);
} else {
  console.log(`ℹ️ Tests for ${targetPackage} 📦`);
  console.log('');
}
const options = {
  hostname: 'localhost',
  port: 9011,
  path: '/subserver/TestRunner/' + targetPackage,
  method: 'GET'
};

const req = http.request(options, res => {
  data = '';
  res.on('data', chunk => {
    data += chunk;
  });
  res.on('end', () => {
    try {
      data = JSON.parse(data);
      if (!Object.keys(data).length) {
        if (CI) {
          console.log(`ℹ️ ${targetPackage} does not contain any tests\n`);
        } else {
          console.log(`ℹ️ ${targetPackage} does not contain any tests`);
        }

        return;
      }
      if (data.error) {
        console.log('SUMMARY-INDICATE-FAILURE');
        if (CI) {
          console.log(`::error:: Running the tests produced the following error:\n${JSON.stringify(data.error)}`);
          fs.appendFileSync('summary.txt', `❌ Running the tests produced the following error:\n${JSON.stringify(data.error)}\n`);
        }
        else console.log(`❌ Running the tests produced the following error:\n${JSON.stringify(data.error)}`);
        return;
      }
      data.forEach((testfile) => {
        const pathStructure = testfile.file.split('/');
        const testsFolderIndex = pathStructure.findIndex(p => p === 'tests');
        const testPathStructure = pathStructure.slice(testsFolderIndex + 1);
        const testfileName = testPathStructure.join(' >> ');

        if (testfile.tests.some((test) => test.type === 'test' && test.state && test.state !== 'succeeded')) {
          if (CI) {
            console.log(`::group:: ${testfileName} ❌`);
          } else {
            console.log(`${testfileName} ❌`);
            console.log('---');
          }
        } else if (testfile.tests.every((test) => !test.state)) {
          if (CI) {
            console.log(`::group:: ${testfileName} ⏩`);
          } else {
            console.log(`${testfileName} ⏩`);
            console.log('---');
          }
        } else {
          if (CI) {
            console.log(`::group:: ${testfileName} ✅`);
          } else {
            console.log(`${testfileName} ✅`);
            console.log('---');
          }
        }
        testfile.tests.forEach((test) => {
          if (test.type !== 'test') return;
          if (!test.state) {
            skipped += 1;
            console.log(`${test.fullTitle} skipped ⏩`);
            return;
          }
          if (test.state === 'succeeded') {
            passed += 1;
            console.log(`${test.fullTitle} passed ✅`);
          } else {
            failed += 1;
            if (CI) {
              console.log(`${test.fullTitle} failed ❌`);
              markdownListOfFailingTests = markdownListOfFailingTests + `- ${test.fullTitle} failed ❌\n`;
            } else {
              console.log(`${test.fullTitle} failed ❌`);
            }
          }
        });
        if (CI) console.log('::endgroup::');
        else console.log('');
      });
        console.log(`SUMMARY-passed:${passed}`);
        console.log(`SUMMARY-skipped:${skipped}`);
        console.log(`SUMMARY-failed:${failed}`);
        if (CI && markdownListOfFailingTests !== '') {
          const firstLineOfSummary = `\n---\nWhile running the tests for **${targetPackage}**, the following ${failed} test(s) failed:\n`;
          fs.appendFileSync('failing.txt', firstLineOfSummary);
          fs.appendFileSync('failing.txt', markdownListOfFailingTests);
        }
    } catch (err) {
      console.log('SUMMARY-INDICATE-FAILURE');
      if (CI) {
        console.log(`::error:: Running the tests produced the following error:\n"${err}"`);
        fs.appendFileSync('test_output.md', `\n---\n❌ Running the tests for **${targetPackage}** produced the following error:\n"${err}"\n`);
      } else {
        console.log(`❌ Running the tests produced the following error:\n"${err}"`);
      }
    }
  });
}
);

req.on('error', err => {
  console.log('SUMMARY-INDICATE-FAILURE');
  if (CI) {
    console.log(`::error:: Error while trying to get the results of tests for ${targetPackage}`);
    fs.appendFileSync('test_output.md', `❌ Error while trying to get the results of tests for ${targetPackage}\n`);
  }
  else console.log(`❌ Error while trying to get the results of tests for ${targetPackage}`);
  console.log(err);
  if (CI) {
    console.log('::endgroup::');
  }
});

req.end();
