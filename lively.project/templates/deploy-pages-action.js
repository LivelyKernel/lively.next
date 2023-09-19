export const deployScript = `name: Deploy Project to GitHub Pages

on:
  workflow_dispatch:

permissions:
  pages: write
  id-token: write%TOKEN_PERMISSIONS%

concurrency:
  group: "build-and-deploy"
  cancel-in-progress: false

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - name: Setup \`node\`
        uses: actions/setup-node@v3
        with:
          node-version: '18.12.1'
      - name: Restore \`lively.next\` repo
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
      - name: Save \`lively\` repo in cache
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
      - name: Upload artifact
        uses: actions/upload-pages-artifact@v2
        with:
          path: local_projects/%PROJECT_NAME%/build
  deploy:
    needs: [build]
    runs-on: ubuntu-latest
    steps:
      - name: Setup Pages
        uses: actions/configure-pages@v3
      - name: Deploy to GitHub Pages
        uses: actions/deploy-pages@v2
      - name: Delete uploaded Artifact
        uses: geekyeggo/delete-artifact@v2
        with:
          name: github-pages`;
