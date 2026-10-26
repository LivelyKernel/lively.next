# lively.classes

[EcmaScript 6 class implementation](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Classes) that supports live development. In particular, Redefinition of classes and their methods as well as superclass changes are possible. lively.classes also provides the foundation to deserialize instances of classes with [lively.serializer](https://github.com/LivelyKernel/lively.serializer2).

Managed property descriptors can set numeric `min` and `max` bounds. Generated
setters clamp primitive numbers before passing them to the descriptor's setter
or the default setter; numeric defaults follow the same constraints.
`isFloat: false` rounds to the nearest integer within the bounds. Omitting
`isFloat` preserves fractional values. Non-numeric values, including folded
objects, retain the existing setter's validation and behavior. Native class
accessors remain under the class's control.

## License

[MIT](LICENSE)
