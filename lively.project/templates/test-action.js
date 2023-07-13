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
          path: local_projects/%PROJECT_NAME%
      - name: Start lively.next
        run: |
          ./start-server.sh > /dev/null 2>&1 &
          # wait until server is guaranteed to be running
          sleep 30
      - name: Run CI Test Script 
        run:  ./scripts/test.sh %PROJECT_NAME%`;
