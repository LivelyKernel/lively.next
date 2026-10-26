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
steps, runtime version and dependency checkouts around them. Existing workflows
can use the same markers before their next regeneration. Edits outside marked
sections belong to the generated template and are replaced.

All workflows have `before-project`, before project checkout. Test workflows
also have `before-tests` and `after-tests`. Build workflows have `before-build`
and `after-build`, with the latter running before artifact upload. Pages
workflows additionally have `before-deploy` and `after-deploy` in the deploy job.
Keep both markers and each section name intact. Invalid, duplicate or removed
sections stop regeneration before any workflow file is replaced.
