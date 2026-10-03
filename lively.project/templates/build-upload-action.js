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
          node-version: '24.20.0'
      - name: Setup bun
        uses: oven-sh/setup-bun@v2
        with:
          bun-version: 1.4.2
      - name: Setup Rust toolchain
        uses: dtolnay/rust-toolchain@1.95.0
        with:
          targets: wasm32-wasip1
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
        uses: actions/checkout@v4
        with:
          repository: LivelyKernel/lively.next
          ref: %LIVELY_VERSION%
      - name: Prepare to install \`lively.next\`
        run: chmod a+x ./install.sh
      - name: Install \`lively.next\`
        uses: nick-fields/retry@v3
        with:
          timeout_minutes: 15
          max_attempts: 5
          retry_on: error
          command: ./install.sh --freezer-only
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
        uses: actions/checkout@v4
        with:
          ref: \${{ github.ref }}
          path: local_projects/%PROJECT_NAME%%PROJECT_DEPENDENCIES%
      - name: Install Project Dependencies
        run: node lively.project/package-install.mjs local_projects/%PROJECT_NAME%
      - name: Build Project
        run: bun run --cwd local_projects/%PROJECT_NAME% build-minified
      - name: Upload Build Artifacts
        uses: actions/upload-artifact@v4
        with:
          name: build
          path: local_projects/%PROJECT_NAME%/build`;
