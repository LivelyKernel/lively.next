import { arr } from "lively.lang";

export async function loadMochaTestFile(file, testsByFile = []) {
  var tester = await System.import("mocha-es6/index.js");
  return tester.loadTestModuleAndExtractTestState(file, testsByFile)
}

export async function runMochaTests(grep, testsByFile, onChange, onError) {
  for (let {file} of testsByFile) {
    var {mocha} = await loadMochaTestFile(file, testsByFile);
    if (grep) mocha = mocha.grep(grep);
    await mochaRun(mocha);
  }
  return {mocha, testsByFile};

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

  function mochaRun(mocha) {
    return new Promise((resolve, reject) => {
      var files = arr.compact(mocha.suite.suites).map(({file}) => file),
        tests = lively.lang.chain(testsByFile)
          .filter(ea => files.includes(ea.file))
          .pluck("tests").flatten().value();

      if (!tests || !tests.length)
        return reject(new Error(`Trying to run tests of ${files.join(", ")} but cannot find them in loaded tests!`));
      mocha.reporter(function Reporter(runner) {
        runner.on("test", test => {
          try {
            var t = tests.find(ea => ea.fullTitle === test.fullTitle());
            t.state = "running";
            typeof onChange === "function" && onChange(t, "test")
          } catch (e) { typeof onError === "function" && onError(e, "test"); }
        });

        runner.on("pass", test => {
          try {
            var t = tests.find(ea => ea.fullTitle === test.fullTitle());
            t.state = "succeeded";
            t.duration = test.duration;
            typeof onChange === "function" && onChange(t, "pass");
          } catch (e) { typeof onError === "function" && onError(e, "pass"); }
        });

        runner.on("fail", (test, error) => {
          try {
            var t = tests.find(ea => ea.fullTitle === test.fullTitle());
            if (t) attachErrorToTest(t, error, test.duration);
            else { // "test" is a hook...
              var parentTests = arr.invoke(test.parent.tests, "fullTitle")
              tests
                .filter(ea => parentTests.includes(ea.fullTitle))
                .forEach(ea => attachErrorToTest(ea, error, test.duration))
            }

            typeof onChange === "function" && onChange(t, "fail");

            function attachErrorToTest(test, error, duration) {
              test.state = "failed";
              test.duration = test.duration;
              test.error = error;
            }

          } catch (e) { typeof onError === "function" && onError(e, "fail"); }
        });

      });

      mocha.run(failures => resolve({testsByFile, mocha}));
    });
  }
}
