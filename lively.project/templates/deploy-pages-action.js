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
      - name: Checkout lively.next
        uses: actions/checkout@v3
        with:
          repository: LivelyKernel/lively.next
          use: %LIVELY_VERSION%
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
        run: npm run build-minified --prefix local_projects/%PROJECT_NAME%
      - name: Upload artifact
        uses: actions/upload-pages-artifact@v2
        with:
          path: local_projects/%PROJECT_NAME%/build
  deploy:
    needs: [build]
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: \${{ steps.deployment.outputs.page_url }}
    steps:
      - name: Setup Pages
        uses: actions/configure-pages@v3
      - name: Deploy to GitHub Pages
        id: deployment
        uses: actions/deploy-pages@v2
      - name: Delete uploaded Artifact
        uses: geekyeggo/delete-artifact@v2
        with:
          name: github-pages`;
