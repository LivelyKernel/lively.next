export const buildRemoteScript = `name: Build Project

on:%ACTION_TRIGGER%
  workflow_dispatch:

concurrency:
  group: "build-and-upload"
  cancel-in-progress: true

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - name: Setup \`node\`
        uses: actions/setup-node@v3
        with:
          node-version: '20.10'
      - name: Restore \`lively.next\` installation
        id: cache-lively
        uses: actions/cache/restore@v3
        env:
          cache-name: lively-repo
          ref: %LIVELY_VERSION%
        with:
          path: .            
          key: \${{ runner.os }}-\${{ env.cache-name }}-\${{ env.ref }}
      - name: Checkout \`lively.next\`
        if: \${{ steps.cache-lively.outputs.cache-hit != 'true' }}
        uses: actions/checkout@v3
        with:
          repository: LivelyKernel/lively.next
          ref: %LIVELY_VERSION%
      - name: Install \`lively.next\`
        if: \${{ steps.cache-lively.outputs.cache-hit != 'true' }}
        run: |
          chmod a+x ./install.sh
          ./install.sh --freezer-only
      - name: Save \`lively\` installation in cache
        if: \${{ steps.cache-lively.outputs.cache-hit != 'true' }}
        uses: actions/cache/save@v3
        env:
          cache-name: lively-repo
          ref: %LIVELY_VERSION%
        with:
          path: .            
          key: \${{ runner.os }}-\${{ env.cache-name }}-\${{ env.ref }}     
      - name: Checkout Project Repository
        uses: actions/checkout@v3
        with:
          path: local_projects/%PROJECT_NAME%
      - name: Build Project
        run: npm run build-minified --prefix local_projects/%PROJECT_NAME%
      - name: Upload Build Artifacts
        uses: actions/upload-artifact@v3
        with:
          name: build
          path: local_projects/%PROJECT_NAME%/build`;
