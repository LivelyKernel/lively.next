# Agent instructions

## Reuse existing Lively capabilities

Before designing or implementing a feature or fix, first scan the existing Lively packages for relevant or complementary capabilities, APIs, helpers, and established patterns. Prefer reusing or extending those capabilities over introducing a separate implementation, abstraction, or dependency. Only implement something new after confirming that existing capabilities cannot reasonably be reused or extended to meet the requirement.

## Test the user's app workflow

For app workflow bugs, exercise the reported UI entry point in a freshly built packaged app. Opening a project through the dashboard must be tested through its Open control, including the transition from frozen bundles to the live module system in the same document; direct URL navigation is a separate path. For persistence changes, quit the app, relaunch it, reopen through the dashboard, and verify saved source, configuration, and evaluation. Uncaught renderer errors fail the test even if the world appears initialized.

Add a regression that fails with the original bug and passes with the fix. Report the tested artifact or commit, platform, and workflow; distinguish local source tests from packaged-app tests and local results from CI results.
