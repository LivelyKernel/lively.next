export const workflowDefinition = `name: Run Tests

on:
  push:
    branches:
      - main
  workflow_dispatch:

jobs:
  Tests:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout lively.next
        uses: actions/checkout@v3
        with:
          repository: LivelyKernel/lively.next
          ref: %LIVELY_VERSION%
      - run: pwd
      - name: Setup node
        uses: actions/setup-node@v2
        with:
          node-version: '18.12.1'
      - name: Install lively.next
        run: |
          chmod a+x ./install.sh
          ./install.sh
      - name: Checkout Project Repository
        uses: actions/checkout@v3
        with:
          path: projects/%PROJECT_NAME%
      - name: Start lively.next
        run: |
          chmod a+x ./start.sh
          ./start.sh > /dev/null 2>&1 &
          # wait until server is guaranteed to be running
          sleep 30
      - name: Run CI Test Script 
        run:  ./scripts/test.sh %PROJECT_NAME%`;
