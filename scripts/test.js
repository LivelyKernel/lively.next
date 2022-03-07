const http = require('http')

const targetPackage = process.argv[2]

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
        else console.log(`::group:: ${testfileName} ✅`)
        testfile.tests.forEach((test) => {
          if (test.type !== 'test') return;
          if (!test.state) {
            console.log(`${test.fullTitle} skipped ⏭️`);
            return;
          } 
          if (test.state === 'succeeded') console.log(`${test.fullTitle} passed ✅`)
          else {
            console.log(`::error:: ${test.fullTitle} failed ❌`);
            process.exitCode = 1;
          }
        })
        console.log(`::endgroup::`)
      })
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