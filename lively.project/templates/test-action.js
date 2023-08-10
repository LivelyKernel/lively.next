export const workflowDefinition = `name: Run Tests

on:%ACTION_TRIGGER%
  workflow_dispatch:

concurrency:
  group: "test"
  cancel-in-progress: true

jobs:
  tests:
    runs-on: ubuntu-latest
    steps:
      - name: Setup node
        uses: actions/setup-node@v3
        with:
          node-version: '18.12.1'
      - name: Restore \`lively.next\` installation
        id: cache-lively-with-build
        uses: actions/cache/restore@v3
        env:
          cache-name: lively-repo-with-build
          ref: %LIVELY_VERSION%
        with:
          path: .            
          key: \${{ runner.os }}-\${{ env.cache-name }}-\${{ env.ref }}
      - if: \${{ steps.cache-lively-with-build.outputs.cache-hit != 'true' }}
        name: Checkout lively.next
        uses: actions/checkout@v3
        with:
          repository: LivelyKernel/lively.next
          ref: %LIVELY_VERSION%
      - if: \${{ steps.cache-lively-with-build.outputs.cache-hit != 'true' }}
        name: Install lively.next       
        run: |
          chmod a+x ./install.sh
          ./install.sh
      - if: \${{ steps.cache-lively-with-build.outputs.cache-hit != 'true' }}
        name: Save lively installation in cache
        uses: actions/cache/save@v3
        env:
          cache-name: lively-repo-with-build
          ref: %LIVELY_VERSION%
        with:
          path: .            
          key: \${{ runner.os }}-\${{ env.cache-name }}-\${{ env.ref }}     
      - name: Checkout Project Repository
        uses: actions/checkout@v3
        with:
          path: local_projects/%PROJECT_NAME%
      - name: Start lively.next
        run: |
          ./start-server.sh > /dev/null 2>&1 &
          # wait until server is guaranteed to be running
          sleep 30
      - name: Run CI Test Script 
        run:  ./scripts/test.sh %PROJECT_NAME%`;
