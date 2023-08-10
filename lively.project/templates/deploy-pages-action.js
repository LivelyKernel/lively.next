export const deployScript = `name: Deploy static content to Pages

on:
  workflow_dispatch:

# Sets permissions of the GITHUB_TOKEN to allow deployment to GitHub Pages
permissions:
  contents: read
  pages: write
  id-token: write

# Allow only one concurrent deployment, skipping runs queued between the run in-progress and latest queued.
# However, do NOT cancel in-progress runs as we want to allow these production deployments to complete.
concurrency:
  group: "build-and-deploy"
  cancel-in-progress: false

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - name: Setup node
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
      - if: \${{ steps.cache-lively.outputs.cache-hit != 'true' }}
        name: Checkout lively.next
        uses: actions/checkout@v3
        with:
          repository: LivelyKernel/lively.next
          ref: %LIVELY_VERSION%
      - if: \${{ steps.cache-lively.outputs.cache-hit != 'true' }}
        name: Install lively.next       
        run: |
          chmod a+x ./install.sh
          ./install.sh --freezer-only
      - if: \${{ steps.cache-lively.outputs.cache-hit != 'true' }}
        name: Save lively repo in cache
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
