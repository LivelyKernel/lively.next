## date.js


* Util functions to print and work with JS date objects.


- [dateFormat](#dateFormat)

### <a name="dateFormat"></a>dateFormat


 * Util functions to print and work with JS date objects.
 

#### <a name="format"></a>format(date, mask, utc)

 Custom date / time stringifier. Provides default masks:

 Mask           | Pattern
 ---------------|--------------------------------
 default        | `"ddd mmm dd yyyy HH:MM:ss"`
 shortDate      | `"m/d/yy"`
 mediumDate     | `"mmm d, yyyy"`
 longDate       | `"mmmm d, yyyy"`
 fullDate       | `"dddd, mmmm d, yyyy"`
 shortTime      | `"h:MM TT"`
 mediumTime     | `"h:MM:ss TT"`
 longTime       | `"h:MM:ss TT Z"`
 isoDate        | `"yyyy-mm-dd"`
 isoTime        | `"HH:MM:ss"`
 isoDateTime    | `"yyyy-mm-dd'T'HH:MM:ss"`
 isoUtcDateTime | `"UTC:yyyy-mm-dd'T'HH:MM:ss'Z'"`

 and internationalized strings via `date.format.i18n.dayNames`
 and `date.format.i18n.dayNames`
 

```js
date.format(new Date(), date.format.masks.longTime) // => "7:13:31 PM PDT"
  date.format(new Date(), "yyyy/mm/dd") // => "2014/10/09"
```

#### <a name="equals"></a>equals(date, otherDate)



#### <a name="relativeTo"></a>relativeTo(date, otherDate)

 Prints a human readable difference of two Date objects. The older date
 goes first.
 

```js
var now = new Date();
  date.relativeTo(new Date(now-2000), now) // => "2 secs"
  date.relativeTo(new Date("10/11/2014"), new Date("10/12/2014")) // => "1 day"
```