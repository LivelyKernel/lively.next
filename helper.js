const undefinedPlaceHolder = "<__UNDeFINED__>"

export function replaceUndefinedWithPlaceholder(jso) {
  // values in jso that have type "undefined" are needed by the vdom patch but
  // won't get JSON serialized. Replace them with a placeholder string
  if (Array.isArray(jso)) {
    for (var i = 0; i < jso.length; i++) {
      var t = typeof jso[i];
      switch (t) {
        case 'undefined': jso[i] = undefinedPlaceHolder; break;
        case 'object': replaceUndefinedWithPlaceholder(jso[i]); break;
      }
    }
    return;
  }
  if (typeof jso === "object") {
    for (var key in jso) {
      if (!jso.hasOwnProperty(key)) continue;
      var t = typeof jso[key];
      switch (t) {
        case 'undefined': jso[key] = undefinedPlaceHolder; break;
        case 'object': replaceUndefinedWithPlaceholder(jso[key]); break;
      }
    }
  }
}

export function replaceUndefinedPlaceholderWithUndefined(jso) {
  // values in jso that have type "undefined" are needed by the vdom patch but
  // won't get JSON serialized. Replace them with a placeholder string
  if (Array.isArray(jso)) {
    for (var i = 0; i < jso.length; i++) {
      var t = typeof jso[i];
      switch (t) {
        case 'string': if (jso[i] === undefinedPlaceHolder) jso[i] = undefined; break;
        case 'object': replaceUndefinedPlaceholderWithUndefined(jso[i]); break;
      }
    }
    return;
  }
  if (typeof jso === "object") {
    for (var key in jso) {
      if (!jso.hasOwnProperty(key)) continue;
      var t = typeof jso[key];
      switch (t) {
        case 'string': if (jso[key] === undefinedPlaceHolder) jso[key] = undefined; break;
        case 'object': replaceUndefinedPlaceholderWithUndefined(jso[key]); break;
      }
    }
  }
}
