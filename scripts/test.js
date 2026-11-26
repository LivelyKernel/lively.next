/*
This script can be used to run the test in a selected package.
The HTTP server defaults to localhost:9011. Set LIVELY_TEST_SERVER_READY_URL
to use the same server URL as scripts/test.sh.
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
// A package's report in the CI step summary lists at most MAX_LISTED_FAILURES failed tests with the
// details of the first MAX_DETAILED_FAILURES in at most MAX_FAILURE_LIST_LENGTH characters, followed by
// at most MAX_BROWSER_ERRORS_LENGTH characters of browser errors. Including the emoji markup that
// scripts/test.sh adds, an ASCII report stays below 30 KB, so that many packages fit GitHub's 1 MiB
// step summary limit. The job log keeps every failure with its full stack.
const MAX_DETAIL_LENGTH = 1000;
const MAX_DETAILED_FAILURES = 5;
const MAX_LISTED_FAILURES = 30;
const MAX_FAILURE_LIST_LENGTH = 10000;
const MAX_BROWSER_ERRORS_LENGTH = 10000;

/**
 * Keeps the most recent browser console errors within MAX_BROWSER_ERRORS_LENGTH characters
 * and shortens each entry to MAX_DETAIL_LENGTH characters.
 */
function boundBrowserErrors (summary) {
  // lively.headless starts every entry with its ISO timestamp in brackets.
  const entries = summary.split(/\n(?=\[\d{4}-\d\d-\d\dT[^\]\n]*\] )/).map(entry => entry.slice(0, MAX_DETAIL_LENGTH));
  const kept = [];
  let length = 0;
  while (entries.length && length + entries[entries.length - 1].length <= MAX_BROWSER_ERRORS_LENGTH) {
    const entry = entries.pop();
    kept.unshift(entry);
    length += entry.length + 1;
  }
  if (entries.length) kept.unshift(`(${entries.length} earlier entries omitted)`);
  return kept.join('\n');
}

/**
 * Lists failed tests for the CI step summary within MAX_FAILURE_LIST_LENGTH characters,
 * with the details of the first MAX_DETAILED_FAILURES and at most MAX_LISTED_FAILURES names.
 */
function failureList (failures) {
  let list = '';
  let listed = 0;
  for (const { title, details } of failures) {
    if (listed === MAX_LISTED_FAILURES) break;
    const name = `- ${title} failed ❌\n`;
    let entry = details && listed < MAX_DETAILED_FAILURES ? `${name}\n\`\`\`text\n${details}\n\`\`\`\n` : name;
    if (list.length + entry.length > MAX_FAILURE_LIST_LENGTH) entry = name;
    if (list.length + entry.length > MAX_FAILURE_LIST_LENGTH) break;
    list += entry;
    listed++;
  }
  if (listed < failures.length) list += `- ${failures.length - listed} more failed test(s) are listed in the job log\n`;
  return list;
}

/** Encodes a message for a GitHub Actions workflow command, which ends at the first line break. */
function workflowCommandMessage (text) {
  return text.replace(/%/g, '%25').replace(/\r/g, '%0D').replace(/\n/g, '%0A');
}

const targetPackage = process.argv[2];
const testServerURL = new URL(process.env.LIVELY_TEST_SERVER_READY_URL || 'http://localhost:9011/');
let passed = 0; let failed = 0; let skipped = 0;
const failures = [];

if (CI) {
  console.log(`Running Tests for ${targetPackage} 📦`);
} else {
  console.log(`ℹ️ Tests for ${targetPackage} 📦`);
  console.log('');
}
const options = {
  hostname: testServerURL.hostname,
  port: testServerURL.port,
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
      if (data.error) {
        console.log('SUMMARY-INDICATE-FAILURE');
        const error = typeof data.error === 'string' ? data.error : JSON.stringify(data.error);
        const browserErrors = data.browserErrors && `Recent browser console errors:\n${boundBrowserErrors(data.browserErrors)}`;
        const report = [error, browserErrors].filter(Boolean).join('\n');
        if (CI) {
          console.log(`::error:: Running the tests produced the following error:%0A${workflowCommandMessage(error)}`);
          if (browserErrors) console.log(browserErrors);
          fs.appendFileSync('summary.txt', `❌ Running the tests produced the following error:\n${report}\n`);
        }
        else console.log(`❌ Running the tests produced the following error:\n${report}`);
        return;
      }
      // A reused local server can run another lively.next version, which reports the files as a plain array.
      const files = Array.isArray(data) ? data : data.files;
      if (!files.length) {
        if (CI) {
          console.log(`ℹ️ ${targetPackage} does not contain any tests\n`);
        } else {
          console.log(`ℹ️ ${targetPackage} does not contain any tests`);
        }

        return;
      }
      files.forEach((testfile) => {
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
            console.log(`${test.fullTitle} failed ❌`);
            let details;
            if (test.error) {
              const stack = test.error.stack || test.error.message || String(test.error);
              const values = [];
              if (test.error.expected !== undefined) values.push(`EXPECTED: ${JSON.stringify(test.error.expected).slice(0, MAX_DETAIL_LENGTH)}`);
              if (test.error.actual !== undefined) values.push(`ACTUAL: ${JSON.stringify(test.error.actual).slice(0, MAX_DETAIL_LENGTH)}`);
              console.log([stack, ...values].join('\n'));
              details = [stack.slice(0, MAX_DETAIL_LENGTH), ...values].join('\n');
            }
            failures.push({ title: test.fullTitle, details });
          }
        });
        if (CI) console.log('::endgroup::');
        else console.log('');
      });
      let markdownListOfFailingTests = failureList(failures);
      if (data.browserErrors) {
        const details = boundBrowserErrors(data.browserErrors);
        if (CI) {
          console.log('::group:: Recent browser console errors');
          console.log(details);
          console.log('::endgroup::');
          markdownListOfFailingTests += `\n\`\`\`text\nRecent browser console errors:\n${details}\n\`\`\`\n`;
        } else console.log(`Recent browser console errors:\n${details}\n`);
      }
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
