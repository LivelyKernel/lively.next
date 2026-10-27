# lively.classes

[EcmaScript 6 class implementation](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Classes) that supports live development. In particular, Redefinition of classes and their methods as well as superclass changes are possible. lively.classes also provides the foundation to deserialize instances of classes with [lively.serializer](https://github.com/LivelyKernel/lively.serializer2).

Managed property descriptors use `min`, `max` and `isFloat` as advisory editor
metadata. Existing assignments, defaults and serialized values keep their values.
Set `enforceNumericConstraints: true` on a descriptor to clamp primitive numbers
to its bounds before passing them to its setter or the default setter. Numeric
defaults then follow the same constraints, and `isFloat: false` rounds to the
nearest allowed integer. Non-numeric values, including folded objects, retain
the setter's validation and behavior. Native class accessors remain under the
class's control. Subclasses can disable inherited enforcement by setting
`enforceNumericConstraints: false`.

## License

[MIT](LICENSE)
