export const buildRemoteScript = `name: Build Project

on:%ACTION_TRIGGER%
  workflow_dispatch:

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout lively.next
        uses: actions/checkout@v3
        with:
          repository: LivelyKernel/lively.next
          ref: %LIVELY_VERSION%
      - name: Setup node
        uses: actions/setup-node@v3
        with:
          node-version: '18.12.1'
      - name: Install lively.next
        run: |
          chmod a+x ./install.sh
          ./install.sh --freezer-only
      - name: Checkout Project Repository
        uses: actions/checkout@v3
        with:
          path: local_projects/%PROJECT_NAME%
      - name: Build Project
        run: npm run build --prefix local_projects/%PROJECT_NAME%
      - name: Upload Build Artifacts
        uses: actions/upload-artifact@v3
        with:
          name: build
          path: local_projects/%PROJECT_NAME%/build`;
