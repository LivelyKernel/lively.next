/*
This script can be used to run the test in a selected package.
Just pass the package as a parameter when executing this script (only one at a time).
Example call of this script: `node test.js lively.morphic`.
The script assumes that a lively server is running locally on port 9011.
This script gets used by tests.sh.
*/

const http = require('http')

const targetPackage = process.argv[2]
let passed = 0, failed = 0, skipped = 0;

console.log(`::notice:: Tests for ${targetPackage} 📦`)
const options = {
  hostname: 'localhost',
  port: 9011,
  path: '/subserver/TestRunner/' + targetPackage,
  method: 'GET'
}

const req = http.request(options, res => {
  data = ''
  res.on('data', chunk => {
    data += chunk;
  })
  res.on('end', () => {
    try {
      data = JSON.parse(data)
      if (!Object.keys(data).length) {
        console.log(`::notice:: ${targetPackage} does not contain any tests`);
        return;
      }
      if (data.error) {
        console.log(`::error:: Running the tests produced the following error: ${JSON.stringify(data.error)}`);
        return;
      }
      data.forEach((testfile) => {
        const pathStructure = testfile.file.split("/")
        const testsFolderIndex = pathStructure.findIndex(p => p === "tests")
        const testPathStructure = pathStructure.slice(testsFolderIndex + 1)
        const testfileName = testPathStructure.join(' >> ')
        
        if (testfile.tests.some((test) => test.type === 'test' && test.state && test.state !== 'succeeded')) console.log(`::group:: ${testfileName} ❌`)
        else if (testfile.tests.every((test) => !test.state)) console.log(`::group:: ${testfileName} ⏭️`)
        else console.log(`::group:: ${testfileName} ✅`)
        testfile.tests.forEach((test) => {
          if (test.type !== 'test') return;
          if (!test.state) {
            skipped += 1;
            console.log(`${test.fullTitle} skipped ⏭️`);
            return;
          } 
          if (test.state === 'succeeded') {
            passed += 1;
            console.log(`${test.fullTitle} passed ✅`);
          } 
          else {
            failed += 1;
            console.log(`::error:: ${test.fullTitle} failed ❌`);
            process.exitCode = 1;
          }
        })
        console.log(`::endgroup::`)
      })
      console.log(`SUMMARY-passed:${passed}`);
      console.log(`SUMMARY-skipped:${skipped}`);
      console.log(`SUMMARY-failed:${failed}`);
    }
    catch (err) {
      console.log(`::error:: Running the tests produced the following error: "${err}"`);
      process.exitCode = 1;
    }
  })
}
)

req.on('error', err => {
  console.log(`::error:: Error while trying to get the results of tests for ${targetPackage}`);
  console.log(err)
  process.exitCode = 1;
  console.log("::endgroup::");
})

req.end()