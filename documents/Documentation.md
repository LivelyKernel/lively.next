We have a semi-automated documentation-build system based on [JSDocs](https://jsdoc.app/index.html). To build and deploy the newest version of the docs, run the respective action from within the Actions tab of the repository. The new documentation will be live in a few minutes.

When working with Pull Requests, an action continously checks whether the documentation can be build successfully.

To enable documentation for modules in more folders, simply add the respective folder in the `include` array in `conf.json`.

To include additional files in the documentation (such as this file), add a `.md` file into the `/documents` folder of the repository.