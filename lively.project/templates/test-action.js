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
      - name: Setup \`node\`
        uses: actions/setup-node@v3
        with:
          node-version: '20.10'
      - name: Restore \`lively.next\` installation
        id: cache-lively-with-build
        uses: actions/cache/restore@v3
        env:
          cache-name: lively-repo-with-build
          ref: %LIVELY_VERSION%
        with:
          path: .            
          key: \${{ runner.os }}-\${{ env.cache-name }}-\${{ env.ref }}
      - name: Checkout \`lively.next\`
        if: \${{ steps.cache-lively-with-build.outputs.cache-hit != 'true' }}
        uses: actions/checkout@v4
        with:
          repository: LivelyKernel/lively.next
          ref: %LIVELY_VERSION%
      - name: Prepare to install \`lively.next\`
        run: chmod a+x ./install.sh
      - name: Install \`lively.next\`
        if: \${{ steps.cache-lively-with-build.outputs.cache-hit != 'true' }}
        uses: nick-fields/retry@v3
        with:
          timeout_minutes: 15
          max_attempts: 5
          retry_on: error
          command: ./install.sh
      - name: Save \`lively\` installation in cache
        if: \${{ steps.cache-lively-with-build.outputs.cache-hit != 'true' }}
        uses: actions/cache/save@v3
        env:
          cache-name: lively-repo-with-build
          ref: %LIVELY_VERSION%
        with:
          path: .            
          key: \${{ runner.os }}-\${{ env.cache-name }}-\${{ env.ref }}     
      - name: Checkout Project Repository
        uses: actions/checkout@v4
        with:
          ref: \${{ github.ref }}
          path: local_projects/%PROJECT_NAME%%PROJECT_DEPENDENCIES%
      - name: Start \`lively.next\`
        run: |
          ./start-server.sh > /dev/null 2>&1 &
          # wait until server is guaranteed to be running
          sleep 30
      - name: Run CI Test Script 
        run:  ./scripts/test.sh %PROJECT_NAME%`;
