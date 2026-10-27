# lively.project

Projects, package configuration and generated build/test workflows for Lively.

## Custom workflow steps

Generated workflows contain marked sections for project-specific steps. Add
custom steps between the existing markers, for example in
`.github/workflows/build-upload-action.yml`:

```yaml
      # lively.next:custom start before-build
      - name: Prepare project assets
        run: bun run --cwd local_projects/owner--project prepare-assets
      # lively.next:custom end before-build
```

Regenerating pipelines preserves those sections while updating the generated
steps, runtime version and dependency checkouts around them. Unmarked generated
workflows migrate automatically, including changes to runtime pins, push triggers,
permissions and remote dependencies. Templates from before the Bun workspace
setup, Bun/Rust requirement and install retries also migrate automatically.
An unmarked checkout with custom repository/path/credentials, or a dependency
absent from the current configuration, is kept: it cannot safely be distinguished
from a custom step. Missing keys are added when dependencies become private.
Existing keys on dependencies configured as public are kept with a warning.
Move these workflows to marked templates before removing dependencies or keys.
Other unmarked workflows are kept verbatim so
project save and upgrades can continue, with a status warning naming each file
whose settings could not be updated. To receive template updates, move custom steps
into marked sections using the current templates before regenerating. Once a
workflow uses markers, edits outside marked sections belong to the generated
template and are replaced.

All workflows have `before-project`, before project checkout. Test workflows
also have `before-tests` and `after-tests`. Build workflows have `before-build`
and `after-build`, with the latter running before artifact upload. Pages
workflows additionally have `before-deploy` and `after-deploy` in the deploy job.
Keep both markers and each section name intact. Invalid, duplicate or removed
sections stop regeneration before any workflow file is replaced.
