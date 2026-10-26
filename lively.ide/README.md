# lively.ide

Programming tools for [lively.next](lively-next.org)

## Running package tests on the server

A package can select the existing HTTP evaluation backend for its tests in its
own `package.json`, including packages outside the default installation:

```json
{
  "lively": {
    "wantsServerInterface": true
  }
}
```

The package must be available to the Lively server. This applies to both the
interactive test runner and `scripts/test.sh <package-name>`. An explicit `false`
selects browser evaluation. Without this setting, the runner keeps the default
from `lively.installer/packages-config.json`, or uses the browser for packages
with no default.

# License

[MIT](LICENSE)
