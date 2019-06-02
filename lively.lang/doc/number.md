## number.js


* Utility functions for JS Numbers.


<!--*no toc!*-->

#### <a name="random"></a>random(min, max)

 random number between (and including) `min` and `max`

#### <a name="humanReadableByteSize"></a>humanReadableByteSize(n)

 interpret `n` as byte size and print a more readable version
 

```js
num.humanReadableByteSize(Math.pow(2,32)) // => "4096MB"
```

#### <a name="average"></a>average(numbers)



#### <a name="median"></a>median(numbers)



#### <a name="between"></a>between(x, a, b, eps)

 is `a` <= `x` <= `y`?

#### <a name="sort"></a>sort(arr)

 numerical sort, JavaScript native `sort` function is lexical by default.

#### <a name="parseLength"></a>parseLength(string, toUnit)

 This converts the length value to pixels or the specified `toUnit`.
 length converstion, supported units are: mm, cm, in, px, pt, pc
 

```js
num.parseLength('3cm') // => 113.38582677165354
num.parseLength('3cm', "in") // => 1.1811023622047243
```

#### <a name="toCm"></a>toCm(n, unit)

 as defined in http://www.w3.org/TR/css3-values/#absolute-lengths

#### <a name="roundTo"></a>roundTo(n, quantum)

 `quantum` is something like 0.01,

#### <a name="roundTo"></a>roundTo(n, quantum)

 for JS rounding to work we need the reciprocal

#### <a name="detent"></a>detent(n, detent, grid, snap)

 This function is useful to implement smooth transitions and snapping.
 Map all values that are within detent/2 of any multiple of grid to
 that multiple. Otherwise, if snap is true, return self, meaning that
 the values in the dead zone will never be returned. If snap is
 false, then expand the range between dead zone so that it covers the
 range between multiples of the grid, and scale the value by that
 factor.
 

```js
// With snapping:
num.detent(0.11, 0.2, 0.5, true) // => 0.11
num.detent(0.39, 0.2, 0.5, true) // => 0.39
num.detent(0.55, 0.2, 0.5, true)  // => 0.5
num.detent(0.61, 0.2, 0.5, true)   // => 0.61
// Smooth transitions without snapping:
num.detent(0.1,  0.2, 0.5) // => 0
num.detent(0.11,  0.2, 0.5) // => 0.0166666
num.detent(0.34,  0.2, 0.5)  // => 0.4
num.detent(0.39,  0.2, 0.5) // => 0.4833334
num.detent(0.4,  0.2, 0.5) // => 0.5
num.detent(0.6,  0.2, 0.5) // => 0.5
```

#### <a name="detent"></a>detent(n, detent, grid, snap)

 Nearest multiple of grid

#### <a name="detent"></a>detent(n, detent, grid, snap)

 Snap to that multiple...

#### <a name="detent"></a>detent(n, detent, grid, snap)

 ...and return n
 or compute nearest end of dead zone

#### <a name="detent"></a>detent(n, detent, grid, snap)

 and scale values between dead zones to fill range between multiples

#### <a name="toDegrees"></a>toDegrees(n)

 

```js
num.toDegrees(Math.PI/2) // => 90
```

#### <a name="toRadians"></a>toRadians(n)

 

```js
num.toRadians(180) // => 3.141592653589793
```