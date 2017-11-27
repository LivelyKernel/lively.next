(function() {
  !function(t,e){"object"==typeof exports&&"object"==typeof module?module.exports=e():"function"==typeof define&&define.amd?define([],e):"object"==typeof exports?exports.io=e():t.io=e()}(this,function(){return function(t){function e(n){if(r[n])return r[n].exports;var o=r[n]={exports:{},id:n,loaded:!1};return t[n].call(o.exports,o,o.exports,e),o.loaded=!0,o.exports}var r={};return e.m=t,e.c=r,e.p="",e(0)}([function(t,e,r){"use strict";function n(t,e){"object"===("undefined"==typeof t?"undefined":o(t))&&(e=t,t=void 0),e=e||{};var r,n=i(t),s=n.source,h=n.id,p=n.path,u=c[h]&&p in c[h].nsps,f=e.forceNew||e["force new connection"]||!1===e.multiplex||u;return f?r=a(s,e):(c[h]||(c[h]=a(s,e)),r=c[h]),n.query&&!e.query&&(e.query=n.query),r.socket(n.path,e)}var o="function"==typeof Symbol&&"symbol"==typeof Symbol.iterator?function(t){return typeof t}:function(t){return t&&"function"==typeof Symbol&&t.constructor===Symbol&&t!==Symbol.prototype?"symbol":typeof t},i=r(1),s=r(4),a=r(10);r(3)("socket.io-client");t.exports=e=n;var c=e.managers={};e.protocol=s.protocol,e.connect=n,e.Manager=r(10),e.Socket=r(36)},function(t,e,r){(function(e){"use strict";function n(t,r){var n=t;r=r||e.location,null==t&&(t=r.protocol+"//"+r.host),"string"==typeof t&&("/"===t.charAt(0)&&(t="/"===t.charAt(1)?r.protocol+t:r.host+t),/^(https?|wss?):\/\//.test(t)||(t="undefined"!=typeof r?r.protocol+"//"+t:"https://"+t),n=o(t)),n.port||(/^(http|ws)$/.test(n.protocol)?n.port="80":/^(http|ws)s$/.test(n.protocol)&&(n.port="443")),n.path=n.path||"/";var i=n.host.indexOf(":")!==-1,s=i?"["+n.host+"]":n.host;return n.id=n.protocol+"://"+s+":"+n.port,n.href=n.protocol+"://"+s+(r&&r.port===n.port?"":":"+n.port),n}var o=r(2);r(3)("socket.io-client:url");t.exports=n}).call(e,function(){return this}())},function(t,e){var r=/^(?:(?![^:@]+:[^:@\/]*@)(http|https|ws|wss):\/\/)?((?:(([^:@]*)(?::([^:@]*))?)?@)?((?:[a-f0-9]{0,4}:){2,7}[a-f0-9]{0,4}|[^:\/?#]*)(?::(\d*))?)(((\/(?:[^?#](?![^?#\/]*\.[^?#\/.]+(?:[?#]|$)))*\/?)?([^?#\/]*))(?:\?([^#]*))?(?:#(.*))?)/,n=["source","protocol","authority","userInfo","user","password","host","port","relative","path","directory","file","query","anchor"];t.exports=function(t){var e=t,o=t.indexOf("["),i=t.indexOf("]");o!=-1&&i!=-1&&(t=t.substring(0,o)+t.substring(o,i).replace(/:/g,";")+t.substring(i,t.length));for(var s=r.exec(t||""),a={},c=14;c--;)a[n[c]]=s[c]||"";return o!=-1&&i!=-1&&(a.source=e,a.host=a.host.substring(1,a.host.length-1).replace(/;/g,":"),a.authority=a.authority.replace("[","").replace("]","").replace(/;/g,":"),a.ipv6uri=!0),a}},function(t,e){"use strict";t.exports=function(){return function(){}}},function(t,e,r){function n(){}function o(t){var r=""+t.type;return e.BINARY_EVENT!==t.type&&e.BINARY_ACK!==t.type||(r+=t.attachments+"-"),t.nsp&&"/"!==t.nsp&&(r+=t.nsp+","),null!=t.id&&(r+=t.id),null!=t.data&&(r+=JSON.stringify(t.data)),r}function i(t,e){function r(t){var r=l.deconstructPacket(t),n=o(r.packet),i=r.buffers;i.unshift(n),e(i)}l.removeBlobs(t,r)}function s(){this.reconstructor=null}function a(t){var r=0,n={type:Number(t.charAt(0))};if(null==e.types[n.type])return p();if(e.BINARY_EVENT===n.type||e.BINARY_ACK===n.type){for(var o="";"-"!==t.charAt(++r)&&(o+=t.charAt(r),r!=t.length););if(o!=Number(o)||"-"!==t.charAt(r))throw new Error("Illegal attachments");n.attachments=Number(o)}if("/"===t.charAt(r+1))for(n.nsp="";++r;){var i=t.charAt(r);if(","===i)break;if(n.nsp+=i,r===t.length)break}else n.nsp="/";var s=t.charAt(r+1);if(""!==s&&Number(s)==s){for(n.id="";++r;){var i=t.charAt(r);if(null==i||Number(i)!=i){--r;break}if(n.id+=t.charAt(r),r===t.length)break}n.id=Number(n.id)}return t.charAt(++r)&&(n=c(n,t.substr(r))),n}function c(t,e){try{t.data=JSON.parse(e)}catch(t){return p()}return t}function h(t){this.reconPack=t,this.buffers=[]}function p(){return{type:e.ERROR,data:"parser error"}}var u=(r(3)("socket.io-parser"),r(5)),f=r(6),l=r(8),d=r(9);e.protocol=4,e.types=["CONNECT","DISCONNECT","EVENT","ACK","ERROR","BINARY_EVENT","BINARY_ACK"],e.CONNECT=0,e.DISCONNECT=1,e.EVENT=2,e.ACK=3,e.ERROR=4,e.BINARY_EVENT=5,e.BINARY_ACK=6,e.Encoder=n,e.Decoder=s,n.prototype.encode=function(t,r){if(t.type!==e.EVENT&&t.type!==e.ACK||!f(t.data)||(t.type=t.type===e.EVENT?e.BINARY_EVENT:e.BINARY_ACK),e.BINARY_EVENT===t.type||e.BINARY_ACK===t.type)i(t,r);else{var n=o(t);r([n])}},u(s.prototype),s.prototype.add=function(t){var r;if("string"==typeof t)r=a(t),e.BINARY_EVENT===r.type||e.BINARY_ACK===r.type?(this.reconstructor=new h(r),0===this.reconstructor.reconPack.attachments&&this.emit("decoded",r)):this.emit("decoded",r);else{if(!d(t)&&!t.base64)throw new Error("Unknown type: "+t);if(!this.reconstructor)throw new Error("got binary data when not reconstructing a packet");r=this.reconstructor.takeBinaryData(t),r&&(this.reconstructor=null,this.emit("decoded",r))}},s.prototype.destroy=function(){this.reconstructor&&this.reconstructor.finishedReconstruction()},h.prototype.takeBinaryData=function(t){if(this.buffers.push(t),this.buffers.length===this.reconPack.attachments){var e=l.reconstructPacket(this.reconPack,this.buffers);return this.finishedReconstruction(),e}return null},h.prototype.finishedReconstruction=function(){this.reconPack=null,this.buffers=[]}},function(t,e,r){function n(t){if(t)return o(t)}function o(t){for(var e in n.prototype)t[e]=n.prototype[e];return t}t.exports=n,n.prototype.on=n.prototype.addEventListener=function(t,e){return this._callbacks=this._callbacks||{},(this._callbacks["$"+t]=this._callbacks["$"+t]||[]).push(e),this},n.prototype.once=function(t,e){function r(){this.off(t,r),e.apply(this,arguments)}return r.fn=e,this.on(t,r),this},n.prototype.off=n.prototype.removeListener=n.prototype.removeAllListeners=n.prototype.removeEventListener=function(t,e){if(this._callbacks=this._callbacks||{},0==arguments.length)return this._callbacks={},this;var r=this._callbacks["$"+t];if(!r)return this;if(1==arguments.length)return delete this._callbacks["$"+t],this;for(var n,o=0;o<r.length;o++)if(n=r[o],n===e||n.fn===e){r.splice(o,1);break}return this},n.prototype.emit=function(t){this._callbacks=this._callbacks||{};var e=[].slice.call(arguments,1),r=this._callbacks["$"+t];if(r){r=r.slice(0);for(var n=0,o=r.length;n<o;++n)r[n].apply(this,e)}return this},n.prototype.listeners=function(t){return this._callbacks=this._callbacks||{},this._callbacks["$"+t]||[]},n.prototype.hasListeners=function(t){return!!this.listeners(t).length}},function(t,e,r){(function(e){function n(t){if(!t||"object"!=typeof t)return!1;if(o(t)){for(var r=0,i=t.length;r<i;r++)if(n(t[r]))return!0;return!1}if("function"==typeof e.Buffer&&e.Buffer.isBuffer&&e.Buffer.isBuffer(t)||"function"==typeof e.ArrayBuffer&&t instanceof ArrayBuffer||s&&t instanceof Blob||a&&t instanceof File)return!0;if(t.toJSON&&"function"==typeof t.toJSON&&1===arguments.length)return n(t.toJSON(),!0);for(var c in t)if(Object.prototype.hasOwnProperty.call(t,c)&&n(t[c]))return!0;return!1}var o=r(7),i=Object.prototype.toString,s="function"==typeof e.Blob||"[object BlobConstructor]"===i.call(e.Blob),a="function"==typeof e.File||"[object FileConstructor]"===i.call(e.File);t.exports=n}).call(e,function(){return this}())},function(t,e){var r={}.toString;t.exports=Array.isArray||function(t){return"[object Array]"==r.call(t)}},function(t,e,r){(function(t){function n(t,e){if(!t)return t;if(s(t)){var r={_placeholder:!0,num:e.length};return e.push(t),r}if(i(t)){for(var o=new Array(t.length),a=0;a<t.length;a++)o[a]=n(t[a],e);return o}if("object"==typeof t&&!(t instanceof Date)){var o={};for(var c in t)o[c]=n(t[c],e);return o}return t}function o(t,e){if(!t)return t;if(t&&t._placeholder)return e[t.num];if(i(t))for(var r=0;r<t.length;r++)t[r]=o(t[r],e);else if("object"==typeof t)for(var n in t)t[n]=o(t[n],e);return t}var i=r(7),s=r(9),a=Object.prototype.toString,c="function"==typeof t.Blob||"[object BlobConstructor]"===a.call(t.Blob),h="function"==typeof t.File||"[object FileConstructor]"===a.call(t.File);e.deconstructPacket=function(t){var e=[],r=t.data,o=t;return o.data=n(r,e),o.attachments=e.length,{packet:o,buffers:e}},e.reconstructPacket=function(t,e){return t.data=o(t.data,e),t.attachments=void 0,t},e.removeBlobs=function(t,e){function r(t,a,p){if(!t)return t;if(c&&t instanceof Blob||h&&t instanceof File){n++;var u=new FileReader;u.onload=function(){p?p[a]=this.result:o=this.result,--n||e(o)},u.readAsArrayBuffer(t)}else if(i(t))for(var f=0;f<t.length;f++)r(t[f],f,t);else if("object"==typeof t&&!s(t))for(var l in t)r(t[l],l,t)}var n=0,o=t;r(o),n||e(o)}}).call(e,function(){return this}())},function(t,e){(function(e){function r(t){return e.Buffer&&e.Buffer.isBuffer(t)||e.ArrayBuffer&&t instanceof ArrayBuffer}t.exports=r}).call(e,function(){return this}())},function(t,e,r){"use strict";function n(t,e){if(!(this instanceof n))return new n(t,e);t&&"object"===("undefined"==typeof t?"undefined":o(t))&&(e=t,t=void 0),e=e||{},e.path=e.path||"/socket.io",this.nsps={},this.subs=[],this.opts=e,this.reconnection(e.reconnection!==!1),this.reconnectionAttempts(e.reconnectionAttempts||1/0),this.reconnectionDelay(e.reconnectionDelay||1e3),this.reconnectionDelayMax(e.reconnectionDelayMax||5e3),this.randomizationFactor(e.randomizationFactor||.5),this.backoff=new f({min:this.reconnectionDelay(),max:this.reconnectionDelayMax(),jitter:this.randomizationFactor()}),this.timeout(null==e.timeout?2e4:e.timeout),this.readyState="closed",this.uri=t,this.connecting=[],this.lastPing=null,this.encoding=!1,this.packetBuffer=[];var r=e.parser||c;this.encoder=new r.Encoder,this.decoder=new r.Decoder,this.autoConnect=e.autoConnect!==!1,this.autoConnect&&this.open()}var o="function"==typeof Symbol&&"symbol"==typeof Symbol.iterator?function(t){return typeof t}:function(t){return t&&"function"==typeof Symbol&&t.constructor===Symbol&&t!==Symbol.prototype?"symbol":typeof t},i=r(11),s=r(36),a=r(5),c=r(4),h=r(38),p=r(39),u=(r(3)("socket.io-client:manager"),r(34)),f=r(40),l=Object.prototype.hasOwnProperty;t.exports=n,n.prototype.emitAll=function(){this.emit.apply(this,arguments);for(var t in this.nsps)l.call(this.nsps,t)&&this.nsps[t].emit.apply(this.nsps[t],arguments)},n.prototype.updateSocketIds=function(){for(var t in this.nsps)l.call(this.nsps,t)&&(this.nsps[t].id=this.generateId(t))},n.prototype.generateId=function(t){return("/"===t?"":t+"#")+this.engine.id},a(n.prototype),n.prototype.reconnection=function(t){return arguments.length?(this._reconnection=!!t,this):this._reconnection},n.prototype.reconnectionAttempts=function(t){return arguments.length?(this._reconnectionAttempts=t,this):this._reconnectionAttempts},n.prototype.reconnectionDelay=function(t){return arguments.length?(this._reconnectionDelay=t,this.backoff&&this.backoff.setMin(t),this):this._reconnectionDelay},n.prototype.randomizationFactor=function(t){return arguments.length?(this._randomizationFactor=t,this.backoff&&this.backoff.setJitter(t),this):this._randomizationFactor},n.prototype.reconnectionDelayMax=function(t){return arguments.length?(this._reconnectionDelayMax=t,this.backoff&&this.backoff.setMax(t),this):this._reconnectionDelayMax},n.prototype.timeout=function(t){return arguments.length?(this._timeout=t,this):this._timeout},n.prototype.maybeReconnectOnOpen=function(){!this.reconnecting&&this._reconnection&&0===this.backoff.attempts&&this.reconnect()},n.prototype.open=n.prototype.connect=function(t,e){if(~this.readyState.indexOf("open"))return this;this.engine=i(this.uri,this.opts);var r=this.engine,n=this;this.readyState="opening",this.skipReconnect=!1;var o=h(r,"open",function(){n.onopen(),t&&t()}),s=h(r,"error",function(e){if(n.cleanup(),n.readyState="closed",n.emitAll("connect_error",e),t){var r=new Error("Connection error");r.data=e,t(r)}else n.maybeReconnectOnOpen()});if(!1!==this._timeout){var a=this._timeout,c=setTimeout(function(){o.destroy(),r.close(),r.emit("error","timeout"),n.emitAll("connect_timeout",a)},a);this.subs.push({destroy:function(){clearTimeout(c)}})}return this.subs.push(o),this.subs.push(s),this},n.prototype.onopen=function(){this.cleanup(),this.readyState="open",this.emit("open");var t=this.engine;this.subs.push(h(t,"data",p(this,"ondata"))),this.subs.push(h(t,"ping",p(this,"onping"))),this.subs.push(h(t,"pong",p(this,"onpong"))),this.subs.push(h(t,"error",p(this,"onerror"))),this.subs.push(h(t,"close",p(this,"onclose"))),this.subs.push(h(this.decoder,"decoded",p(this,"ondecoded")))},n.prototype.onping=function(){this.lastPing=new Date,this.emitAll("ping")},n.prototype.onpong=function(){this.emitAll("pong",new Date-this.lastPing)},n.prototype.ondata=function(t){this.decoder.add(t)},n.prototype.ondecoded=function(t){this.emit("packet",t)},n.prototype.onerror=function(t){this.emitAll("error",t)},n.prototype.socket=function(t,e){function r(){~u(o.connecting,n)||o.connecting.push(n)}var n=this.nsps[t];if(!n){n=new s(this,t,e),this.nsps[t]=n;var o=this;n.on("connecting",r),n.on("connect",function(){n.id=o.generateId(t)}),this.autoConnect&&r()}return n},n.prototype.destroy=function(t){var e=u(this.connecting,t);~e&&this.connecting.splice(e,1),this.connecting.length||this.close()},n.prototype.packet=function(t){var e=this;t.query&&0===t.type&&(t.nsp+="?"+t.query),e.encoding?e.packetBuffer.push(t):(e.encoding=!0,this.encoder.encode(t,function(r){for(var n=0;n<r.length;n++)e.engine.write(r[n],t.options);e.encoding=!1,e.processPacketQueue()}))},n.prototype.processPacketQueue=function(){if(this.packetBuffer.length>0&&!this.encoding){var t=this.packetBuffer.shift();this.packet(t)}},n.prototype.cleanup=function(){for(var t=this.subs.length,e=0;e<t;e++){var r=this.subs.shift();r.destroy()}this.packetBuffer=[],this.encoding=!1,this.lastPing=null,this.decoder.destroy()},n.prototype.close=n.prototype.disconnect=function(){this.skipReconnect=!0,this.reconnecting=!1,"opening"===this.readyState&&this.cleanup(),this.backoff.reset(),this.readyState="closed",this.engine&&this.engine.close()},n.prototype.onclose=function(t){this.cleanup(),this.backoff.reset(),this.readyState="closed",this.emit("close",t),this._reconnection&&!this.skipReconnect&&this.reconnect()},n.prototype.reconnect=function(){if(this.reconnecting||this.skipReconnect)return this;var t=this;if(this.backoff.attempts>=this._reconnectionAttempts)this.backoff.reset(),this.emitAll("reconnect_failed"),this.reconnecting=!1;else{var e=this.backoff.duration();this.reconnecting=!0;var r=setTimeout(function(){t.skipReconnect||(t.emitAll("reconnect_attempt",t.backoff.attempts),t.emitAll("reconnecting",t.backoff.attempts),t.skipReconnect||t.open(function(e){e?(t.reconnecting=!1,t.reconnect(),t.emitAll("reconnect_error",e.data)):t.onreconnect()}))},e);this.subs.push({destroy:function(){clearTimeout(r)}})}},n.prototype.onreconnect=function(){var t=this.backoff.attempts;this.reconnecting=!1,this.backoff.reset(),this.updateSocketIds(),this.emitAll("reconnect",t)}},function(t,e,r){t.exports=r(12)},function(t,e,r){t.exports=r(13),t.exports.parser=r(20)},function(t,e,r){(function(e){function n(t,r){if(!(this instanceof n))return new n(t,r);r=r||{},t&&"object"==typeof t&&(r=t,t=null),t?(t=h(t),r.hostname=t.host,r.secure="https"===t.protocol||"wss"===t.protocol,r.port=t.port,t.query&&(r.query=t.query)):r.host&&(r.hostname=h(r.host).host),this.secure=null!=r.secure?r.secure:e.location&&"https:"===location.protocol,r.hostname&&!r.port&&(r.port=this.secure?"443":"80"),this.agent=r.agent||!1,this.hostname=r.hostname||(e.location?location.hostname:"localhost"),this.port=r.port||(e.location&&location.port?location.port:this.secure?443:80),this.query=r.query||{},"string"==typeof this.query&&(this.query=u.decode(this.query)),this.upgrade=!1!==r.upgrade,this.path=(r.path||"/engine.io").replace(/\/$/,"")+"/",this.forceJSONP=!!r.forceJSONP,this.jsonp=!1!==r.jsonp,this.forceBase64=!!r.forceBase64,this.enablesXDR=!!r.enablesXDR,this.timestampParam=r.timestampParam||"t",this.timestampRequests=r.timestampRequests,this.transports=r.transports||["polling","websocket"],this.transportOptions=r.transportOptions||{},this.readyState="",this.writeBuffer=[],this.prevBufferLen=0,this.policyPort=r.policyPort||843,this.rememberUpgrade=r.rememberUpgrade||!1,this.binaryType=null,this.onlyBinaryUpgrades=r.onlyBinaryUpgrades,this.perMessageDeflate=!1!==r.perMessageDeflate&&(r.perMessageDeflate||{}),!0===this.perMessageDeflate&&(this.perMessageDeflate={}),this.perMessageDeflate&&null==this.perMessageDeflate.threshold&&(this.perMessageDeflate.threshold=1024),this.pfx=r.pfx||null,this.key=r.key||null,this.passphrase=r.passphrase||null,this.cert=r.cert||null,this.ca=r.ca||null,this.ciphers=r.ciphers||null,this.rejectUnauthorized=void 0===r.rejectUnauthorized||r.rejectUnauthorized,this.forceNode=!!r.forceNode;var o="object"==typeof e&&e;o.global===o&&(r.extraHeaders&&Object.keys(r.extraHeaders).length>0&&(this.extraHeaders=r.extraHeaders),r.localAddress&&(this.localAddress=r.localAddress)),this.id=null,this.upgrades=null,this.pingInterval=null,this.pingTimeout=null,this.pingIntervalTimer=null,this.pingTimeoutTimer=null,this.open()}function o(t){var e={};for(var r in t)t.hasOwnProperty(r)&&(e[r]=t[r]);return e}var i=r(14),s=r(5),a=(r(3)("engine.io-client:socket"),r(34)),c=r(20),h=r(2),p=r(35),u=r(28);t.exports=n,n.priorWebsocketSuccess=!1,s(n.prototype),n.protocol=c.protocol,n.Socket=n,n.Transport=r(19),n.transports=r(14),n.parser=r(20),n.prototype.createTransport=function(t){var e=o(this.query);e.EIO=c.protocol,e.transport=t;var r=this.transportOptions[t]||{};this.id&&(e.sid=this.id);var n=new i[t]({query:e,socket:this,agent:r.agent||this.agent,hostname:r.hostname||this.hostname,port:r.port||this.port,secure:r.secure||this.secure,path:r.path||this.path,forceJSONP:r.forceJSONP||this.forceJSONP,jsonp:r.jsonp||this.jsonp,forceBase64:r.forceBase64||this.forceBase64,enablesXDR:r.enablesXDR||this.enablesXDR,timestampRequests:r.timestampRequests||this.timestampRequests,timestampParam:r.timestampParam||this.timestampParam,policyPort:r.policyPort||this.policyPort,pfx:r.pfx||this.pfx,key:r.key||this.key,passphrase:r.passphrase||this.passphrase,cert:r.cert||this.cert,ca:r.ca||this.ca,ciphers:r.ciphers||this.ciphers,rejectUnauthorized:r.rejectUnauthorized||this.rejectUnauthorized,perMessageDeflate:r.perMessageDeflate||this.perMessageDeflate,extraHeaders:r.extraHeaders||this.extraHeaders,forceNode:r.forceNode||this.forceNode,localAddress:r.localAddress||this.localAddress,requestTimeout:r.requestTimeout||this.requestTimeout,protocols:r.protocols||void 0});return n},n.prototype.open=function(){var t;if(this.rememberUpgrade&&n.priorWebsocketSuccess&&this.transports.indexOf("websocket")!==-1)t="websocket";else{if(0===this.transports.length){var e=this;return void setTimeout(function(){e.emit("error","No transports available")},0)}t=this.transports[0]}this.readyState="opening";try{t=this.createTransport(t)}catch(t){return this.transports.shift(),void this.open()}t.open(),this.setTransport(t)},n.prototype.setTransport=function(t){var e=this;this.transport&&this.transport.removeAllListeners(),this.transport=t,t.on("drain",function(){e.onDrain()}).on("packet",function(t){e.onPacket(t)}).on("error",function(t){e.onError(t)}).on("close",function(){e.onClose("transport close")})},n.prototype.probe=function(t){function e(){if(u.onlyBinaryUpgrades){var t=!this.supportsBinary&&u.transport.supportsBinary;p=p||t}p||(h.send([{type:"ping",data:"probe"}]),h.once("packet",function(t){if(!p)if("pong"===t.type&&"probe"===t.data){if(u.upgrading=!0,u.emit("upgrading",h),!h)return;n.priorWebsocketSuccess="websocket"===h.name,u.transport.pause(function(){p||"closed"!==u.readyState&&(c(),u.setTransport(h),h.send([{type:"upgrade"}]),u.emit("upgrade",h),h=null,u.upgrading=!1,u.flush())})}else{var e=new Error("probe error");e.transport=h.name,u.emit("upgradeError",e)}}))}function r(){p||(p=!0,c(),h.close(),h=null)}function o(t){var e=new Error("probe error: "+t);e.transport=h.name,r(),u.emit("upgradeError",e)}function i(){o("transport closed")}function s(){o("socket closed")}function a(t){h&&t.name!==h.name&&r()}function c(){h.removeListener("open",e),h.removeListener("error",o),h.removeListener("close",i),u.removeListener("close",s),u.removeListener("upgrading",a)}var h=this.createTransport(t,{probe:1}),p=!1,u=this;n.priorWebsocketSuccess=!1,h.once("open",e),h.once("error",o),h.once("close",i),this.once("close",s),this.once("upgrading",a),h.open()},n.prototype.onOpen=function(){if(this.readyState="open",n.priorWebsocketSuccess="websocket"===this.transport.name,this.emit("open"),this.flush(),"open"===this.readyState&&this.upgrade&&this.transport.pause)for(var t=0,e=this.upgrades.length;t<e;t++)this.probe(this.upgrades[t])},n.prototype.onPacket=function(t){if("opening"===this.readyState||"open"===this.readyState||"closing"===this.readyState)switch(this.emit("packet",t),this.emit("heartbeat"),t.type){case"open":this.onHandshake(p(t.data));break;case"pong":this.setPing(),this.emit("pong");break;case"error":var e=new Error("server error");e.code=t.data,this.onError(e);break;case"message":this.emit("data",t.data),this.emit("message",t.data)}},n.prototype.onHandshake=function(t){this.emit("handshake",t),this.id=t.sid,this.transport.query.sid=t.sid,this.upgrades=this.filterUpgrades(t.upgrades),this.pingInterval=t.pingInterval,this.pingTimeout=t.pingTimeout,this.onOpen(),"closed"!==this.readyState&&(this.setPing(),this.removeListener("heartbeat",this.onHeartbeat),this.on("heartbeat",this.onHeartbeat))},n.prototype.onHeartbeat=function(t){clearTimeout(this.pingTimeoutTimer);var e=this;e.pingTimeoutTimer=setTimeout(function(){"closed"!==e.readyState&&e.onClose("ping timeout")},t||e.pingInterval+e.pingTimeout)},n.prototype.setPing=function(){var t=this;clearTimeout(t.pingIntervalTimer),t.pingIntervalTimer=setTimeout(function(){t.ping(),t.onHeartbeat(t.pingTimeout)},t.pingInterval)},n.prototype.ping=function(){var t=this;this.sendPacket("ping",function(){t.emit("ping")})},n.prototype.onDrain=function(){this.writeBuffer.splice(0,this.prevBufferLen),this.prevBufferLen=0,0===this.writeBuffer.length?this.emit("drain"):this.flush()},n.prototype.flush=function(){"closed"!==this.readyState&&this.transport.writable&&!this.upgrading&&this.writeBuffer.length&&(this.transport.send(this.writeBuffer),this.prevBufferLen=this.writeBuffer.length,this.emit("flush"))},n.prototype.write=n.prototype.send=function(t,e,r){return this.sendPacket("message",t,e,r),this},n.prototype.sendPacket=function(t,e,r,n){if("function"==typeof e&&(n=e,e=void 0),"function"==typeof r&&(n=r,r=null),"closing"!==this.readyState&&"closed"!==this.readyState){r=r||{},r.compress=!1!==r.compress;var o={type:t,data:e,options:r};this.emit("packetCreate",o),this.writeBuffer.push(o),n&&this.once("flush",n),this.flush()}},n.prototype.close=function(){function t(){n.onClose("forced close"),n.transport.close()}function e(){n.removeListener("upgrade",e),n.removeListener("upgradeError",e),t()}function r(){n.once("upgrade",e),n.once("upgradeError",e)}if("opening"===this.readyState||"open"===this.readyState){this.readyState="closing";var n=this;this.writeBuffer.length?this.once("drain",function(){this.upgrading?r():t()}):this.upgrading?r():t()}return this},n.prototype.onError=function(t){n.priorWebsocketSuccess=!1,this.emit("error",t),this.onClose("transport error",t)},n.prototype.onClose=function(t,e){if("opening"===this.readyState||"open"===this.readyState||"closing"===this.readyState){var r=this;clearTimeout(this.pingIntervalTimer),clearTimeout(this.pingTimeoutTimer),this.transport.removeAllListeners("close"),this.transport.close(),this.transport.removeAllListeners(),this.readyState="closed",this.id=null,this.emit("close",t,e),r.writeBuffer=[],r.prevBufferLen=0}},n.prototype.filterUpgrades=function(t){for(var e=[],r=0,n=t.length;r<n;r++)~a(this.transports,t[r])&&e.push(t[r]);return e}}).call(e,function(){return this}())},function(t,e,r){(function(t){function n(e){var r,n=!1,a=!1,c=!1!==e.jsonp;if(t.location){var h="https:"===location.protocol,p=location.port;p||(p=h?443:80),n=e.hostname!==location.hostname||p!==e.port,a=e.secure!==h}if(e.xdomain=n,e.xscheme=a,r=new o(e),"open"in r&&!e.forceJSONP)return new i(e);if(!c)throw new Error("JSONP disabled");return new s(e)}var o=r(15),i=r(17),s=r(31),a=r(32);e.polling=n,e.websocket=a}).call(e,function(){return this}())},function(t,e,r){(function(e){var n=r(16);t.exports=function(t){var r=t.xdomain,o=t.xscheme,i=t.enablesXDR;try{if("undefined"!=typeof XMLHttpRequest&&(!r||n))return new XMLHttpRequest}catch(t){}try{if("undefined"!=typeof XDomainRequest&&!o&&i)return new XDomainRequest}catch(t){}if(!r)try{return new(e[["Active"].concat("Object").join("X")])("Microsoft.XMLHTTP")}catch(t){}}}).call(e,function(){return this}())},function(t,e){try{t.exports="undefined"!=typeof XMLHttpRequest&&"withCredentials"in new XMLHttpRequest}catch(e){t.exports=!1}},function(t,e,r){(function(e){function n(){}function o(t){if(c.call(this,t),this.requestTimeout=t.requestTimeout,this.extraHeaders=t.extraHeaders,e.location){var r="https:"===location.protocol,n=location.port;n||(n=r?443:80),this.xd=t.hostname!==e.location.hostname||n!==t.port,this.xs=t.secure!==r}}function i(t){this.method=t.method||"GET",this.uri=t.uri,this.xd=!!t.xd,this.xs=!!t.xs,this.async=!1!==t.async,this.data=void 0!==t.data?t.data:null,this.agent=t.agent,this.isBinary=t.isBinary,this.supportsBinary=t.supportsBinary,this.enablesXDR=t.enablesXDR,this.requestTimeout=t.requestTimeout,this.pfx=t.pfx,this.key=t.key,this.passphrase=t.passphrase,this.cert=t.cert,this.ca=t.ca,this.ciphers=t.ciphers,this.rejectUnauthorized=t.rejectUnauthorized,this.extraHeaders=t.extraHeaders,this.create()}function s(){for(var t in i.requests)i.requests.hasOwnProperty(t)&&i.requests[t].abort()}var a=r(15),c=r(18),h=r(5),p=r(29);r(3)("engine.io-client:polling-xhr");t.exports=o,t.exports.Request=i,p(o,c),o.prototype.supportsBinary=!0,o.prototype.request=function(t){return t=t||{},t.uri=this.uri(),t.xd=this.xd,t.xs=this.xs,t.agent=this.agent||!1,t.supportsBinary=this.supportsBinary,t.enablesXDR=this.enablesXDR,t.pfx=this.pfx,t.key=this.key,t.passphrase=this.passphrase,t.cert=this.cert,t.ca=this.ca,t.ciphers=this.ciphers,t.rejectUnauthorized=this.rejectUnauthorized,t.requestTimeout=this.requestTimeout,t.extraHeaders=this.extraHeaders,new i(t)},o.prototype.doWrite=function(t,e){var r="string"!=typeof t&&void 0!==t,n=this.request({method:"POST",data:t,isBinary:r}),o=this;n.on("success",e),n.on("error",function(t){o.onError("xhr post error",t)}),this.sendXhr=n},o.prototype.doPoll=function(){var t=this.request(),e=this;t.on("data",function(t){e.onData(t)}),t.on("error",function(t){e.onError("xhr poll error",t)}),this.pollXhr=t},h(i.prototype),i.prototype.create=function(){var t={agent:this.agent,xdomain:this.xd,xscheme:this.xs,enablesXDR:this.enablesXDR};t.pfx=this.pfx,t.key=this.key,t.passphrase=this.passphrase,t.cert=this.cert,t.ca=this.ca,t.ciphers=this.ciphers,t.rejectUnauthorized=this.rejectUnauthorized;var r=this.xhr=new a(t),n=this;try{r.open(this.method,this.uri,this.async);try{if(this.extraHeaders){r.setDisableHeaderCheck&&r.setDisableHeaderCheck(!0);for(var o in this.extraHeaders)this.extraHeaders.hasOwnProperty(o)&&r.setRequestHeader(o,this.extraHeaders[o])}}catch(t){}if("POST"===this.method)try{this.isBinary?r.setRequestHeader("Content-type","application/octet-stream"):r.setRequestHeader("Content-type","text/plain;charset=UTF-8")}catch(t){}try{r.setRequestHeader("Accept","*/*")}catch(t){}"withCredentials"in r&&(r.withCredentials=!0),this.requestTimeout&&(r.timeout=this.requestTimeout),this.hasXDR()?(r.onload=function(){n.onLoad()},r.onerror=function(){n.onError(r.responseText)}):r.onreadystatechange=function(){if(2===r.readyState){var t;try{t=r.getResponseHeader("Content-Type")}catch(t){}"application/octet-stream"===t&&(r.responseType="arraybuffer")}4===r.readyState&&(200===r.status||1223===r.status?n.onLoad():setTimeout(function(){n.onError(r.status)},0))},r.send(this.data)}catch(t){return void setTimeout(function(){n.onError(t)},0)}e.document&&(this.index=i.requestsCount++,i.requests[this.index]=this)},i.prototype.onSuccess=function(){this.emit("success"),this.cleanup()},i.prototype.onData=function(t){this.emit("data",t),this.onSuccess()},i.prototype.onError=function(t){this.emit("error",t),this.cleanup(!0)},i.prototype.cleanup=function(t){if("undefined"!=typeof this.xhr&&null!==this.xhr){if(this.hasXDR()?this.xhr.onload=this.xhr.onerror=n:this.xhr.onreadystatechange=n,t)try{this.xhr.abort()}catch(t){}e.document&&delete i.requests[this.index],this.xhr=null}},i.prototype.onLoad=function(){var t;try{var e;try{e=this.xhr.getResponseHeader("Content-Type")}catch(t){}t="application/octet-stream"===e?this.xhr.response||this.xhr.responseText:this.xhr.responseText}catch(t){this.onError(t)}null!=t&&this.onData(t)},i.prototype.hasXDR=function(){return"undefined"!=typeof e.XDomainRequest&&!this.xs&&this.enablesXDR},i.prototype.abort=function(){this.cleanup()},i.requestsCount=0,i.requests={},e.document&&(e.attachEvent?e.attachEvent("onunload",s):e.addEventListener&&e.addEventListener("beforeunload",s,!1))}).call(e,function(){return this}())},function(t,e,r){function n(t){var e=t&&t.forceBase64;h&&!e||(this.supportsBinary=!1),o.call(this,t)}var o=r(19),i=r(28),s=r(20),a=r(29),c=r(30);r(3)("engine.io-client:polling");t.exports=n;var h=function(){var t=r(15),e=new t({xdomain:!1});return null!=e.responseType}();a(n,o),n.prototype.name="polling",n.prototype.doOpen=function(){this.poll()},n.prototype.pause=function(t){function e(){r.readyState="paused",t()}var r=this;if(this.readyState="pausing",this.polling||!this.writable){var n=0;this.polling&&(n++,this.once("pollComplete",function(){--n||e()})),this.writable||(n++,this.once("drain",function(){--n||e()}))}else e()},n.prototype.poll=function(){this.polling=!0,this.doPoll(),this.emit("poll")},n.prototype.onData=function(t){var e=this,r=function(t,r,n){return"opening"===e.readyState&&e.onOpen(),"close"===t.type?(e.onClose(),!1):void e.onPacket(t)};s.decodePayload(t,this.socket.binaryType,r),"closed"!==this.readyState&&(this.polling=!1,this.emit("pollComplete"),"open"===this.readyState&&this.poll())},n.prototype.doClose=function(){function t(){e.write([{type:"close"}])}var e=this;"open"===this.readyState?t():this.once("open",t)},n.prototype.write=function(t){var e=this;this.writable=!1;var r=function(){e.writable=!0,e.emit("drain")};s.encodePayload(t,this.supportsBinary,function(t){e.doWrite(t,r)})},n.prototype.uri=function(){var t=this.query||{},e=this.secure?"https":"http",r="";!1!==this.timestampRequests&&(t[this.timestampParam]=c()),this.supportsBinary||t.sid||(t.b64=1),t=i.encode(t),this.port&&("https"===e&&443!==Number(this.port)||"http"===e&&80!==Number(this.port))&&(r=":"+this.port),t.length&&(t="?"+t);var n=this.hostname.indexOf(":")!==-1;return e+"://"+(n?"["+this.hostname+"]":this.hostname)+r+this.path+t}},function(t,e,r){function n(t){this.path=t.path,this.hostname=t.hostname,this.port=t.port,this.secure=t.secure,this.query=t.query,this.timestampParam=t.timestampParam,this.timestampRequests=t.timestampRequests,this.readyState="",this.agent=t.agent||!1,this.socket=t.socket,this.enablesXDR=t.enablesXDR,this.pfx=t.pfx,this.key=t.key,this.passphrase=t.passphrase,this.cert=t.cert,this.ca=t.ca,this.ciphers=t.ciphers,this.rejectUnauthorized=t.rejectUnauthorized,this.forceNode=t.forceNode,this.extraHeaders=t.extraHeaders,this.localAddress=t.localAddress}var o=r(20),i=r(5);t.exports=n,i(n.prototype),n.prototype.onError=function(t,e){var r=new Error(t);return r.type="TransportError",r.description=e,this.emit("error",r),this},n.prototype.open=function(){return"closed"!==this.readyState&&""!==this.readyState||(this.readyState="opening",this.doOpen()),this},n.prototype.close=function(){return"opening"!==this.readyState&&"open"!==this.readyState||(this.doClose(),this.onClose()),this},n.prototype.send=function(t){if("open"!==this.readyState)throw new Error("Transport not open");this.write(t)},n.prototype.onOpen=function(){this.readyState="open",
this.writable=!0,this.emit("open")},n.prototype.onData=function(t){var e=o.decodePacket(t,this.socket.binaryType);this.onPacket(e)},n.prototype.onPacket=function(t){this.emit("packet",t)},n.prototype.onClose=function(){this.readyState="closed",this.emit("close")}},function(t,e,r){(function(t){function n(t,r){var n="b"+e.packets[t.type]+t.data.data;return r(n)}function o(t,r,n){if(!r)return e.encodeBase64Packet(t,n);var o=t.data,i=new Uint8Array(o),s=new Uint8Array(1+o.byteLength);s[0]=v[t.type];for(var a=0;a<i.length;a++)s[a+1]=i[a];return n(s.buffer)}function i(t,r,n){if(!r)return e.encodeBase64Packet(t,n);var o=new FileReader;return o.onload=function(){t.data=o.result,e.encodePacket(t,r,!0,n)},o.readAsArrayBuffer(t.data)}function s(t,r,n){if(!r)return e.encodeBase64Packet(t,n);if(g)return i(t,r,n);var o=new Uint8Array(1);o[0]=v[t.type];var s=new w([o.buffer,t.data]);return n(s)}function a(t){try{t=d.decode(t,{strict:!1})}catch(t){return!1}return t}function c(t,e,r){for(var n=new Array(t.length),o=l(t.length,r),i=function(t,r,o){e(r,function(e,r){n[t]=r,o(e,n)})},s=0;s<t.length;s++)i(s,t[s],o)}var h,p=r(21),u=r(6),f=r(22),l=r(23),d=r(24);t&&t.ArrayBuffer&&(h=r(26));var y="undefined"!=typeof navigator&&/Android/i.test(navigator.userAgent),m="undefined"!=typeof navigator&&/PhantomJS/i.test(navigator.userAgent),g=y||m;e.protocol=3;var v=e.packets={open:0,close:1,ping:2,pong:3,message:4,upgrade:5,noop:6},b=p(v),k={type:"error",data:"parser error"},w=r(27);e.encodePacket=function(e,r,i,a){"function"==typeof r&&(a=r,r=!1),"function"==typeof i&&(a=i,i=null);var c=void 0===e.data?void 0:e.data.buffer||e.data;if(t.ArrayBuffer&&c instanceof ArrayBuffer)return o(e,r,a);if(w&&c instanceof t.Blob)return s(e,r,a);if(c&&c.base64)return n(e,a);var h=v[e.type];return void 0!==e.data&&(h+=i?d.encode(String(e.data),{strict:!1}):String(e.data)),a(""+h)},e.encodeBase64Packet=function(r,n){var o="b"+e.packets[r.type];if(w&&r.data instanceof t.Blob){var i=new FileReader;return i.onload=function(){var t=i.result.split(",")[1];n(o+t)},i.readAsDataURL(r.data)}var s;try{s=String.fromCharCode.apply(null,new Uint8Array(r.data))}catch(t){for(var a=new Uint8Array(r.data),c=new Array(a.length),h=0;h<a.length;h++)c[h]=a[h];s=String.fromCharCode.apply(null,c)}return o+=t.btoa(s),n(o)},e.decodePacket=function(t,r,n){if(void 0===t)return k;if("string"==typeof t){if("b"===t.charAt(0))return e.decodeBase64Packet(t.substr(1),r);if(n&&(t=a(t),t===!1))return k;var o=t.charAt(0);return Number(o)==o&&b[o]?t.length>1?{type:b[o],data:t.substring(1)}:{type:b[o]}:k}var i=new Uint8Array(t),o=i[0],s=f(t,1);return w&&"blob"===r&&(s=new w([s])),{type:b[o],data:s}},e.decodeBase64Packet=function(t,e){var r=b[t.charAt(0)];if(!h)return{type:r,data:{base64:!0,data:t.substr(1)}};var n=h.decode(t.substr(1));return"blob"===e&&w&&(n=new w([n])),{type:r,data:n}},e.encodePayload=function(t,r,n){function o(t){return t.length+":"+t}function i(t,n){e.encodePacket(t,!!s&&r,!1,function(t){n(null,o(t))})}"function"==typeof r&&(n=r,r=null);var s=u(t);return r&&s?w&&!g?e.encodePayloadAsBlob(t,n):e.encodePayloadAsArrayBuffer(t,n):t.length?void c(t,i,function(t,e){return n(e.join(""))}):n("0:")},e.decodePayload=function(t,r,n){if("string"!=typeof t)return e.decodePayloadAsBinary(t,r,n);"function"==typeof r&&(n=r,r=null);var o;if(""===t)return n(k,0,1);for(var i,s,a="",c=0,h=t.length;c<h;c++){var p=t.charAt(c);if(":"===p){if(""===a||a!=(i=Number(a)))return n(k,0,1);if(s=t.substr(c+1,i),a!=s.length)return n(k,0,1);if(s.length){if(o=e.decodePacket(s,r,!1),k.type===o.type&&k.data===o.data)return n(k,0,1);var u=n(o,c+i,h);if(!1===u)return}c+=i,a=""}else a+=p}return""!==a?n(k,0,1):void 0},e.encodePayloadAsArrayBuffer=function(t,r){function n(t,r){e.encodePacket(t,!0,!0,function(t){return r(null,t)})}return t.length?void c(t,n,function(t,e){var n=e.reduce(function(t,e){var r;return r="string"==typeof e?e.length:e.byteLength,t+r.toString().length+r+2},0),o=new Uint8Array(n),i=0;return e.forEach(function(t){var e="string"==typeof t,r=t;if(e){for(var n=new Uint8Array(t.length),s=0;s<t.length;s++)n[s]=t.charCodeAt(s);r=n.buffer}e?o[i++]=0:o[i++]=1;for(var a=r.byteLength.toString(),s=0;s<a.length;s++)o[i++]=parseInt(a[s]);o[i++]=255;for(var n=new Uint8Array(r),s=0;s<n.length;s++)o[i++]=n[s]}),r(o.buffer)}):r(new ArrayBuffer(0))},e.encodePayloadAsBlob=function(t,r){function n(t,r){e.encodePacket(t,!0,!0,function(t){var e=new Uint8Array(1);if(e[0]=1,"string"==typeof t){for(var n=new Uint8Array(t.length),o=0;o<t.length;o++)n[o]=t.charCodeAt(o);t=n.buffer,e[0]=0}for(var i=t instanceof ArrayBuffer?t.byteLength:t.size,s=i.toString(),a=new Uint8Array(s.length+1),o=0;o<s.length;o++)a[o]=parseInt(s[o]);if(a[s.length]=255,w){var c=new w([e.buffer,a.buffer,t]);r(null,c)}})}c(t,n,function(t,e){return r(new w(e))})},e.decodePayloadAsBinary=function(t,r,n){"function"==typeof r&&(n=r,r=null);for(var o=t,i=[];o.byteLength>0;){for(var s=new Uint8Array(o),a=0===s[0],c="",h=1;255!==s[h];h++){if(c.length>310)return n(k,0,1);c+=s[h]}o=f(o,2+c.length),c=parseInt(c);var p=f(o,0,c);if(a)try{p=String.fromCharCode.apply(null,new Uint8Array(p))}catch(t){var u=new Uint8Array(p);p="";for(var h=0;h<u.length;h++)p+=String.fromCharCode(u[h])}i.push(p),o=f(o,c)}var l=i.length;i.forEach(function(t,o){n(e.decodePacket(t,r,!0),o,l)})}}).call(e,function(){return this}())},function(t,e){t.exports=Object.keys||function(t){var e=[],r=Object.prototype.hasOwnProperty;for(var n in t)r.call(t,n)&&e.push(n);return e}},function(t,e){t.exports=function(t,e,r){var n=t.byteLength;if(e=e||0,r=r||n,t.slice)return t.slice(e,r);if(e<0&&(e+=n),r<0&&(r+=n),r>n&&(r=n),e>=n||e>=r||0===n)return new ArrayBuffer(0);for(var o=new Uint8Array(t),i=new Uint8Array(r-e),s=e,a=0;s<r;s++,a++)i[a]=o[s];return i.buffer}},function(t,e){function r(t,e,r){function o(t,n){if(o.count<=0)throw new Error("after called too many times");--o.count,t?(i=!0,e(t),e=r):0!==o.count||i||e(null,n)}var i=!1;return r=r||n,o.count=t,0===t?e():o}function n(){}t.exports=r},function(t,e,r){var n;(function(t,o){!function(i){function s(t){for(var e,r,n=[],o=0,i=t.length;o<i;)e=t.charCodeAt(o++),e>=55296&&e<=56319&&o<i?(r=t.charCodeAt(o++),56320==(64512&r)?n.push(((1023&e)<<10)+(1023&r)+65536):(n.push(e),o--)):n.push(e);return n}function a(t){for(var e,r=t.length,n=-1,o="";++n<r;)e=t[n],e>65535&&(e-=65536,o+=k(e>>>10&1023|55296),e=56320|1023&e),o+=k(e);return o}function c(t,e){if(t>=55296&&t<=57343){if(e)throw Error("Lone surrogate U+"+t.toString(16).toUpperCase()+" is not a scalar value");return!1}return!0}function h(t,e){return k(t>>e&63|128)}function p(t,e){if(0==(4294967168&t))return k(t);var r="";return 0==(4294965248&t)?r=k(t>>6&31|192):0==(4294901760&t)?(c(t,e)||(t=65533),r=k(t>>12&15|224),r+=h(t,6)):0==(4292870144&t)&&(r=k(t>>18&7|240),r+=h(t,12),r+=h(t,6)),r+=k(63&t|128)}function u(t,e){e=e||{};for(var r,n=!1!==e.strict,o=s(t),i=o.length,a=-1,c="";++a<i;)r=o[a],c+=p(r,n);return c}function f(){if(b>=v)throw Error("Invalid byte index");var t=255&g[b];if(b++,128==(192&t))return 63&t;throw Error("Invalid continuation byte")}function l(t){var e,r,n,o,i;if(b>v)throw Error("Invalid byte index");if(b==v)return!1;if(e=255&g[b],b++,0==(128&e))return e;if(192==(224&e)){if(r=f(),i=(31&e)<<6|r,i>=128)return i;throw Error("Invalid continuation byte")}if(224==(240&e)){if(r=f(),n=f(),i=(15&e)<<12|r<<6|n,i>=2048)return c(i,t)?i:65533;throw Error("Invalid continuation byte")}if(240==(248&e)&&(r=f(),n=f(),o=f(),i=(7&e)<<18|r<<12|n<<6|o,i>=65536&&i<=1114111))return i;throw Error("Invalid UTF-8 detected")}function d(t,e){e=e||{};var r=!1!==e.strict;g=s(t),v=g.length,b=0;for(var n,o=[];(n=l(r))!==!1;)o.push(n);return a(o)}var y="object"==typeof e&&e,m=("object"==typeof t&&t&&t.exports==y&&t,"object"==typeof o&&o);m.global!==m&&m.window!==m||(i=m);var g,v,b,k=String.fromCharCode,w={version:"2.1.2",encode:u,decode:d};n=function(){return w}.call(e,r,e,t),!(void 0!==n&&(t.exports=n))}(this)}).call(e,r(25)(t),function(){return this}())},function(t,e){t.exports=function(t){return t.webpackPolyfill||(t.deprecate=function(){},t.paths=[],t.children=[],t.webpackPolyfill=1),t}},function(t,e){!function(){"use strict";for(var t="ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/",r=new Uint8Array(256),n=0;n<t.length;n++)r[t.charCodeAt(n)]=n;e.encode=function(e){var r,n=new Uint8Array(e),o=n.length,i="";for(r=0;r<o;r+=3)i+=t[n[r]>>2],i+=t[(3&n[r])<<4|n[r+1]>>4],i+=t[(15&n[r+1])<<2|n[r+2]>>6],i+=t[63&n[r+2]];return o%3===2?i=i.substring(0,i.length-1)+"=":o%3===1&&(i=i.substring(0,i.length-2)+"=="),i},e.decode=function(t){var e,n,o,i,s,a=.75*t.length,c=t.length,h=0;"="===t[t.length-1]&&(a--,"="===t[t.length-2]&&a--);var p=new ArrayBuffer(a),u=new Uint8Array(p);for(e=0;e<c;e+=4)n=r[t.charCodeAt(e)],o=r[t.charCodeAt(e+1)],i=r[t.charCodeAt(e+2)],s=r[t.charCodeAt(e+3)],u[h++]=n<<2|o>>4,u[h++]=(15&o)<<4|i>>2,u[h++]=(3&i)<<6|63&s;return p}}()},function(t,e){(function(e){function r(t){for(var e=0;e<t.length;e++){var r=t[e];if(r.buffer instanceof ArrayBuffer){var n=r.buffer;if(r.byteLength!==n.byteLength){var o=new Uint8Array(r.byteLength);o.set(new Uint8Array(n,r.byteOffset,r.byteLength)),n=o.buffer}t[e]=n}}}function n(t,e){e=e||{};var n=new i;r(t);for(var o=0;o<t.length;o++)n.append(t[o]);return e.type?n.getBlob(e.type):n.getBlob()}function o(t,e){return r(t),new Blob(t,e||{})}var i=e.BlobBuilder||e.WebKitBlobBuilder||e.MSBlobBuilder||e.MozBlobBuilder,s=function(){try{var t=new Blob(["hi"]);return 2===t.size}catch(t){return!1}}(),a=s&&function(){try{var t=new Blob([new Uint8Array([1,2])]);return 2===t.size}catch(t){return!1}}(),c=i&&i.prototype.append&&i.prototype.getBlob;t.exports=function(){return s?a?e.Blob:o:c?n:void 0}()}).call(e,function(){return this}())},function(t,e){e.encode=function(t){var e="";for(var r in t)t.hasOwnProperty(r)&&(e.length&&(e+="&"),e+=encodeURIComponent(r)+"="+encodeURIComponent(t[r]));return e},e.decode=function(t){for(var e={},r=t.split("&"),n=0,o=r.length;n<o;n++){var i=r[n].split("=");e[decodeURIComponent(i[0])]=decodeURIComponent(i[1])}return e}},function(t,e){t.exports=function(t,e){var r=function(){};r.prototype=e.prototype,t.prototype=new r,t.prototype.constructor=t}},function(t,e){"use strict";function r(t){var e="";do e=s[t%a]+e,t=Math.floor(t/a);while(t>0);return e}function n(t){var e=0;for(p=0;p<t.length;p++)e=e*a+c[t.charAt(p)];return e}function o(){var t=r(+new Date);return t!==i?(h=0,i=t):t+"."+r(h++)}for(var i,s="0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz-_".split(""),a=64,c={},h=0,p=0;p<a;p++)c[s[p]]=p;o.encode=r,o.decode=n,t.exports=o},function(t,e,r){(function(e){function n(){}function o(t){i.call(this,t),this.query=this.query||{},a||(e.___eio||(e.___eio=[]),a=e.___eio),this.index=a.length;var r=this;a.push(function(t){r.onData(t)}),this.query.j=this.index,e.document&&e.addEventListener&&e.addEventListener("beforeunload",function(){r.script&&(r.script.onerror=n)},!1)}var i=r(18),s=r(29);t.exports=o;var a,c=/\n/g,h=/\\n/g;s(o,i),o.prototype.supportsBinary=!1,o.prototype.doClose=function(){this.script&&(this.script.parentNode.removeChild(this.script),this.script=null),this.form&&(this.form.parentNode.removeChild(this.form),this.form=null,this.iframe=null),i.prototype.doClose.call(this)},o.prototype.doPoll=function(){var t=this,e=document.createElement("script");this.script&&(this.script.parentNode.removeChild(this.script),this.script=null),e.async=!0,e.src=this.uri(),e.onerror=function(e){t.onError("jsonp poll error",e)};var r=document.getElementsByTagName("script")[0];r?r.parentNode.insertBefore(e,r):(document.head||document.body).appendChild(e),this.script=e;var n="undefined"!=typeof navigator&&/gecko/i.test(navigator.userAgent);n&&setTimeout(function(){var t=document.createElement("iframe");document.body.appendChild(t),document.body.removeChild(t)},100)},o.prototype.doWrite=function(t,e){function r(){n(),e()}function n(){if(o.iframe)try{o.form.removeChild(o.iframe)}catch(t){o.onError("jsonp polling iframe removal error",t)}try{var t='<iframe src="javascript:0" name="'+o.iframeId+'">';i=document.createElement(t)}catch(t){i=document.createElement("iframe"),i.name=o.iframeId,i.src="javascript:0"}i.id=o.iframeId,o.form.appendChild(i),o.iframe=i}var o=this;if(!this.form){var i,s=document.createElement("form"),a=document.createElement("textarea"),p=this.iframeId="eio_iframe_"+this.index;s.className="socketio",s.style.position="absolute",s.style.top="-1000px",s.style.left="-1000px",s.target=p,s.method="POST",s.setAttribute("accept-charset","utf-8"),a.name="d",s.appendChild(a),document.body.appendChild(s),this.form=s,this.area=a}this.form.action=this.uri(),n(),t=t.replace(h,"\\\n"),this.area.value=t.replace(c,"\\n");try{this.form.submit()}catch(t){}this.iframe.attachEvent?this.iframe.onreadystatechange=function(){"complete"===o.iframe.readyState&&r()}:this.iframe.onload=r}}).call(e,function(){return this}())},function(t,e,r){(function(e){function n(t){var e=t&&t.forceBase64;e&&(this.supportsBinary=!1),this.perMessageDeflate=t.perMessageDeflate,this.usingBrowserWebSocket=p&&!t.forceNode,this.protocols=t.protocols,this.usingBrowserWebSocket||(u=o),i.call(this,t)}var o,i=r(19),s=r(20),a=r(28),c=r(29),h=r(30),p=(r(3)("engine.io-client:websocket"),e.WebSocket||e.MozWebSocket);if("undefined"==typeof window)try{o=r(33)}catch(t){}var u=p;u||"undefined"!=typeof window||(u=o),t.exports=n,c(n,i),n.prototype.name="websocket",n.prototype.supportsBinary=!0,n.prototype.doOpen=function(){if(this.check()){var t=this.uri(),e=this.protocols,r={agent:this.agent,perMessageDeflate:this.perMessageDeflate};r.pfx=this.pfx,r.key=this.key,r.passphrase=this.passphrase,r.cert=this.cert,r.ca=this.ca,r.ciphers=this.ciphers,r.rejectUnauthorized=this.rejectUnauthorized,this.extraHeaders&&(r.headers=this.extraHeaders),this.localAddress&&(r.localAddress=this.localAddress);try{this.ws=this.usingBrowserWebSocket?e?new u(t,e):new u(t):new u(t,e,r)}catch(t){return this.emit("error",t)}void 0===this.ws.binaryType&&(this.supportsBinary=!1),this.ws.supports&&this.ws.supports.binary?(this.supportsBinary=!0,this.ws.binaryType="nodebuffer"):this.ws.binaryType="arraybuffer",this.addEventListeners()}},n.prototype.addEventListeners=function(){var t=this;this.ws.onopen=function(){t.onOpen()},this.ws.onclose=function(){t.onClose()},this.ws.onmessage=function(e){t.onData(e.data)},this.ws.onerror=function(e){t.onError("websocket error",e)}},n.prototype.write=function(t){function r(){n.emit("flush"),setTimeout(function(){n.writable=!0,n.emit("drain")},0)}var n=this;this.writable=!1;for(var o=t.length,i=0,a=o;i<a;i++)!function(t){s.encodePacket(t,n.supportsBinary,function(i){if(!n.usingBrowserWebSocket){var s={};if(t.options&&(s.compress=t.options.compress),n.perMessageDeflate){var a="string"==typeof i?e.Buffer.byteLength(i):i.length;a<n.perMessageDeflate.threshold&&(s.compress=!1)}}try{n.usingBrowserWebSocket?n.ws.send(i):n.ws.send(i,s)}catch(t){}--o||r()})}(t[i])},n.prototype.onClose=function(){i.prototype.onClose.call(this)},n.prototype.doClose=function(){"undefined"!=typeof this.ws&&this.ws.close()},n.prototype.uri=function(){var t=this.query||{},e=this.secure?"wss":"ws",r="";this.port&&("wss"===e&&443!==Number(this.port)||"ws"===e&&80!==Number(this.port))&&(r=":"+this.port),this.timestampRequests&&(t[this.timestampParam]=h()),this.supportsBinary||(t.b64=1),t=a.encode(t),t.length&&(t="?"+t);var n=this.hostname.indexOf(":")!==-1;return e+"://"+(n?"["+this.hostname+"]":this.hostname)+r+this.path+t},n.prototype.check=function(){return!(!u||"__initialize"in u&&this.name===n.prototype.name)}}).call(e,function(){return this}())},function(t,e){},function(t,e){var r=[].indexOf;t.exports=function(t,e){if(r)return t.indexOf(e);for(var n=0;n<t.length;++n)if(t[n]===e)return n;return-1}},function(t,e){(function(e){var r=/^[\],:{}\s]*$/,n=/\\(?:["\\\/bfnrt]|u[0-9a-fA-F]{4})/g,o=/"[^"\\\n\r]*"|true|false|null|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?/g,i=/(?:^|:|,)(?:\s*\[)+/g,s=/^\s+/,a=/\s+$/;t.exports=function(t){return"string"==typeof t&&t?(t=t.replace(s,"").replace(a,""),e.JSON&&JSON.parse?JSON.parse(t):r.test(t.replace(n,"@").replace(o,"]").replace(i,""))?new Function("return "+t)():void 0):null}}).call(e,function(){return this}())},function(t,e,r){"use strict";function n(t,e,r){this.io=t,this.nsp=e,this.json=this,this.ids=0,this.acks={},this.receiveBuffer=[],this.sendBuffer=[],this.connected=!1,this.disconnected=!0,r&&r.query&&(this.query=r.query),this.io.autoConnect&&this.open()}var o="function"==typeof Symbol&&"symbol"==typeof Symbol.iterator?function(t){return typeof t}:function(t){return t&&"function"==typeof Symbol&&t.constructor===Symbol&&t!==Symbol.prototype?"symbol":typeof t},i=r(4),s=r(5),a=r(37),c=r(38),h=r(39),p=(r(3)("socket.io-client:socket"),r(28));t.exports=e=n;var u={connect:1,connect_error:1,connect_timeout:1,connecting:1,disconnect:1,error:1,reconnect:1,reconnect_attempt:1,reconnect_failed:1,reconnect_error:1,reconnecting:1,ping:1,pong:1},f=s.prototype.emit;s(n.prototype),n.prototype.subEvents=function(){if(!this.subs){var t=this.io;this.subs=[c(t,"open",h(this,"onopen")),c(t,"packet",h(this,"onpacket")),c(t,"close",h(this,"onclose"))]}},n.prototype.open=n.prototype.connect=function(){return this.connected?this:(this.subEvents(),this.io.open(),"open"===this.io.readyState&&this.onopen(),this.emit("connecting"),this)},n.prototype.send=function(){var t=a(arguments);return t.unshift("message"),this.emit.apply(this,t),this},n.prototype.emit=function(t){if(u.hasOwnProperty(t))return f.apply(this,arguments),this;var e=a(arguments),r={type:i.EVENT,data:e};return r.options={},r.options.compress=!this.flags||!1!==this.flags.compress,"function"==typeof e[e.length-1]&&(this.acks[this.ids]=e.pop(),r.id=this.ids++),this.connected?this.packet(r):this.sendBuffer.push(r),delete this.flags,this},n.prototype.packet=function(t){t.nsp=this.nsp,this.io.packet(t)},n.prototype.onopen=function(){if("/"!==this.nsp)if(this.query){var t="object"===o(this.query)?p.encode(this.query):this.query;this.packet({type:i.CONNECT,query:t})}else this.packet({type:i.CONNECT})},n.prototype.onclose=function(t){this.connected=!1,this.disconnected=!0,delete this.id,this.emit("disconnect",t)},n.prototype.onpacket=function(t){if(t.nsp===this.nsp)switch(t.type){case i.CONNECT:this.onconnect();break;case i.EVENT:this.onevent(t);break;case i.BINARY_EVENT:this.onevent(t);break;case i.ACK:this.onack(t);break;case i.BINARY_ACK:this.onack(t);break;case i.DISCONNECT:this.ondisconnect();break;case i.ERROR:this.emit("error",t.data)}},n.prototype.onevent=function(t){var e=t.data||[];null!=t.id&&e.push(this.ack(t.id)),this.connected?f.apply(this,e):this.receiveBuffer.push(e)},n.prototype.ack=function(t){var e=this,r=!1;return function(){if(!r){r=!0;var n=a(arguments);e.packet({type:i.ACK,id:t,data:n})}}},n.prototype.onack=function(t){var e=this.acks[t.id];"function"==typeof e&&(e.apply(this,t.data),delete this.acks[t.id])},n.prototype.onconnect=function(){this.connected=!0,this.disconnected=!1,this.emit("connect"),this.emitBuffered()},n.prototype.emitBuffered=function(){var t;for(t=0;t<this.receiveBuffer.length;t++)f.apply(this,this.receiveBuffer[t]);for(this.receiveBuffer=[],t=0;t<this.sendBuffer.length;t++)this.packet(this.sendBuffer[t]);this.sendBuffer=[]},n.prototype.ondisconnect=function(){this.destroy(),this.onclose("io server disconnect")},n.prototype.destroy=function(){if(this.subs){for(var t=0;t<this.subs.length;t++)this.subs[t].destroy();this.subs=null}this.io.destroy(this)},n.prototype.close=n.prototype.disconnect=function(){return this.connected&&this.packet({type:i.DISCONNECT}),this.destroy(),this.connected&&this.onclose("io client disconnect"),this},n.prototype.compress=function(t){return this.flags=this.flags||{},this.flags.compress=t,this}},function(t,e){function r(t,e){var r=[];e=e||0;for(var n=e||0;n<t.length;n++)r[n-e]=t[n];return r}t.exports=r},function(t,e){"use strict";function r(t,e,r){return t.on(e,r),{destroy:function(){t.removeListener(e,r)}}}t.exports=r},function(t,e){var r=[].slice;t.exports=function(t,e){if("string"==typeof e&&(e=t[e]),"function"!=typeof e)throw new Error("bind() requires a function");var n=r.call(arguments,2);return function(){return e.apply(t,n.concat(r.call(arguments)))}}},function(t,e){function r(t){t=t||{},this.ms=t.min||100,this.max=t.max||1e4,this.factor=t.factor||2,this.jitter=t.jitter>0&&t.jitter<=1?t.jitter:0,this.attempts=0}t.exports=r,r.prototype.duration=function(){var t=this.ms*Math.pow(this.factor,this.attempts++);if(this.jitter){var e=Math.random(),r=Math.floor(e*this.jitter*t);t=0==(1&Math.floor(10*e))?t-r:t+r}return 0|Math.min(t,this.max)},r.prototype.reset=function(){this.attempts=0},r.prototype.setMin=function(t){this.ms=t},r.prototype.setMax=function(t){this.max=t},r.prototype.setJitter=function(t){this.jitter=t}}])});
//# sourceMappingURL=socket.io.slim.js.map
  var GLOBAL = typeof window !== "undefined" ? window :
      typeof global!=="undefined" ? global :
        typeof self!=="undefined" ? self : this;
  this.lively = this.lively || {};
this.lively.l2l = this.lively.l2l || {};
this.lively.l2l.L2LClient = (function (lively_lang,_ioClient) {
'use strict';

_ioClient = 'default' in _ioClient ? _ioClient['default'] : _ioClient;

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj$$1) {
  return typeof obj$$1;
} : function (obj$$1) {
  return obj$$1 && typeof Symbol === "function" && obj$$1.constructor === Symbol && obj$$1 !== Symbol.prototype ? "symbol" : typeof obj$$1;
};









var asyncToGenerator = function (fn) {
  return function () {
    var gen = fn.apply(this, arguments);
    return new Promise(function (resolve, reject) {
      function step(key, arg) {
        try {
          var info = gen[key](arg);
          var value = info.value;
        } catch (error) {
          reject(error);
          return;
        }

        if (info.done) {
          resolve(value);
        } else {
          return Promise.resolve(value).then(function (value) {
            step("next", value);
          }, function (err) {
            step("throw", err);
          });
        }
      }

      return step("next");
    });
  };
};

var classCallCheck = function (instance, Constructor) {
  if (!(instance instanceof Constructor)) {
    throw new TypeError("Cannot call a class as a function");
  }
};

var createClass = function () {
  function defineProperties(target, props) {
    for (var i = 0; i < props.length; i++) {
      var descriptor = props[i];
      descriptor.enumerable = descriptor.enumerable || false;
      descriptor.configurable = true;
      if ("value" in descriptor) descriptor.writable = true;
      Object.defineProperty(target, descriptor.key, descriptor);
    }
  }

  return function (Constructor, protoProps, staticProps) {
    if (protoProps) defineProperties(Constructor.prototype, protoProps);
    if (staticProps) defineProperties(Constructor, staticProps);
    return Constructor;
  };
}();







var _extends = Object.assign || function (target) {
  for (var i = 1; i < arguments.length; i++) {
    var source = arguments[i];

    for (var key in source) {
      if (Object.prototype.hasOwnProperty.call(source, key)) {
        target[key] = source[key];
      }
    }
  }

  return target;
};



var inherits = function (subClass, superClass) {
  if (typeof superClass !== "function" && superClass !== null) {
    throw new TypeError("Super expression must either be null or a function, not " + typeof superClass);
  }

  subClass.prototype = Object.create(superClass && superClass.prototype, {
    constructor: {
      value: subClass,
      enumerable: false,
      writable: true,
      configurable: true
    }
  });
  if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass;
};











var possibleConstructorReturn = function (self, call) {
  if (!self) {
    throw new ReferenceError("this hasn't been initialised - super() hasn't been called");
  }

  return call && (typeof call === "object" || typeof call === "function") ? call : self;
};





var slicedToArray = function () {
  function sliceIterator(arr, i) {
    var _arr = [];
    var _n = true;
    var _d = false;
    var _e = undefined;

    try {
      for (var _i = arr[Symbol.iterator](), _s; !(_n = (_s = _i.next()).done); _n = true) {
        _arr.push(_s.value);

        if (i && _arr.length === i) break;
      }
    } catch (err) {
      _d = true;
      _e = err;
    } finally {
      try {
        if (!_n && _i["return"]) _i["return"]();
      } finally {
        if (_d) throw _e;
      }
    }

    return _arr;
  }

  return function (arr, i) {
    if (Array.isArray(arr)) {
      return arr;
    } else if (Symbol.iterator in Object(arr)) {
      return sliceIterator(arr, i);
    } else {
      throw new TypeError("Invalid attempt to destructure non-iterable instance");
    }
  };
}();

function nyi(msg) {
  throw new Error("Not yet implemented: " + msg);
}

var debugMessageOrder = false;

var L2LConnection = function () {
  function L2LConnection(ns) {
    classCallCheck(this, L2LConnection);

    this.id = lively_lang.string.newUUID();
    this.actions = {};
    this.options = { ackTimeout: 3500, debug: false };
    this._incomingOrderNumberingBySenders = new Map();
    this._outgoingOrderNumberingByTargets = new Map();
    this._outOfOrderCacheBySenders = new Map();
  }

  createClass(L2LConnection, [{
    key: "isOnline",
    value: function isOnline() {
      nyi("isOnline");
    }
  }, {
    key: "open",
    value: function open() {
      nyi("isOnline");
    }
  }, {
    key: "close",
    value: function close() {
      nyi("close");
    }
  }, {
    key: "remove",
    value: function remove() {
      nyi("remove");
    }
  }, {
    key: "whenOnline",
    value: function whenOnline(timeout) {
      var _this = this;

      return lively_lang.promise.waitFor(timeout, function () {
        return _this.isOnline();
      }).then(function () {
        return _this;
      }).catch(function (err) {
        return Promise.reject(/timeout/i.test(String(err)) ? new Error("Timeout in " + _this + ".whenOnline") : err);
      });
    }
  }, {
    key: "onError",
    value: function onError(err) {
      if (this.debug) console.log("[" + this + "] error: " + err);
    }
  }, {
    key: "removeService",
    value: function removeService(selector) {
      delete this.actions[selector];
    }
  }, {
    key: "removeServices",
    value: function removeServices(selectors) {
      var _this2 = this;

      selectors.forEach(function (ea) {
        return _this2.removeService(ea);
      });
    }
  }, {
    key: "addService",
    value: function addService(selector, handlerFn) {
      this.actions[selector] = handlerFn;
    }
  }, {
    key: "addServices",
    value: function addServices(services) {
      var _this3 = this;

      Object.keys(services).forEach(function (selector) {
        return _this3.addService(selector, services[selector]);
      });
    }
  }, {
    key: "ping",
    value: function () {
      var _ref = asyncToGenerator(regeneratorRuntime.mark(function _callee(target) {
        var t, _ref2, t2, t3;

        return regeneratorRuntime.wrap(function _callee$(_context) {
          while (1) {
            switch (_context.prev = _context.next) {
              case 0:
                t = Date.now();
                _context.next = 3;
                return this.sendToAndWait(target, "l2l-ping", { timestamp: t });

              case 3:
                _ref2 = _context.sent;
                t2 = _ref2.data.timestamp;
                t3 = Date.now();
                return _context.abrupt("return", {
                  to: t2 - t,
                  from: t3 - t2,
                  roundtrip: t3 - t
                });

              case 7:
              case "end":
                return _context.stop();
            }
          }
        }, _callee, this);
      }));

      function ping(_x) {
        return _ref.apply(this, arguments);
      }

      return ping;
    }()

    // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
    // sending stuff

  }, {
    key: "send",
    value: function send(msg, ackFn) {
      nyi("send");
    }
  }, {
    key: "sendAndWait",
    value: function () {
      var _ref3 = asyncToGenerator(regeneratorRuntime.mark(function _callee2(msg) {
        var _this4 = this;

        var sendP, timeout, timeoutMs, answer;
        return regeneratorRuntime.wrap(function _callee2$(_context2) {
          while (1) {
            switch (_context2.prev = _context2.next) {
              case 0:
                // timeout actually dealt with on receiver side, see
                // installEventToMessageTranslator, this here is just to notice of things
                // really go wrong
                // FIXME: set timeoutMs to receiver timeout time!

                sendP = new Promise(function (resolve, reject) {
                  return _this4.send(msg, resolve);
                }), timeout = {}, timeoutMs = this.options.ackTimeout + 400;


                if ("ackTimeout" in msg) {
                  if (!msg.ackTimeout || msg.ackTimeout < 0) timeoutMs = null;else timeoutMs = msg.ackTimeout + 400;
                }

                if (!timeoutMs) {
                  _context2.next = 8;
                  break;
                }

                _context2.next = 5;
                return Promise.race([lively_lang.promise.delay(timeoutMs, timeout), sendP]);

              case 5:
                answer = _context2.sent;
                _context2.next = 11;
                break;

              case 8:
                _context2.next = 10;
                return sendP;

              case 10:
                answer = _context2.sent;

              case 11:
                if (!(answer === timeout)) {
                  _context2.next = 13;
                  break;
                }

                throw new Error("Timeout sending " + msg.action);

              case 13:
                return _context2.abrupt("return", answer);

              case 14:
              case "end":
                return _context2.stop();
            }
          }
        }, _callee2, this);
      }));

      function sendAndWait(_x2) {
        return _ref3.apply(this, arguments);
      }

      return sendAndWait;
    }()
  }, {
    key: "sendTo",
    value: function sendTo(target, action, data, ackFn) {
      return this.send({ target: target, action: action, data: data }, ackFn);
    }
  }, {
    key: "sendToAndWait",
    value: function sendToAndWait(target, action, data, opts) {
      return this.sendAndWait(_extends({ target: target, action: action, data: data }, opts));
    }
  }, {
    key: "prepareSend",
    value: function prepareSend(msg, ackFn) {
      var target = msg.target,
          action = msg.action,
          messageId = msg.messageId,
          data = msg.data,
          sender = msg.sender;

      if (!action) throw new Error("Trying to send a message without specifying action!");
      if (!target) throw new Error("Trying to send message " + action + " without specifying target!");
      if (!messageId) msg.messageId = lively_lang.string.newUUID();
      if (!sender) msg.sender = this.id;
      var n = msg.n = this._outgoingOrderNumberingByTargets.get(target) || 0;
      this._outgoingOrderNumberingByTargets.set(target, n + 1);

      if (typeof ackFn === "function") {
        var sender = this,
            originalAckFn = ackFn;
        ackFn = function ackFn(msg) {
          // here we receive an ack, we count sender as one more received message
          // as it matters in the message ordering
          var incomingN = sender._incomingOrderNumberingBySenders.get(msg.sender) || 0;

          sender.debug && debugMessageOrder && console.log("[MSG ORDER] " + sender + " received ack for " + msg.action + " as msg " + incomingN);

          try {
            originalAckFn.apply(null, arguments);
          } catch (err) {
            console.error("Error in ack fn of " + sender + ": " + err.stack);
          }
          sender._incomingOrderNumberingBySenders.set(msg.sender, incomingN + 1);
          setTimeout(function () {
            return sender.invokeOutOfOrderMessages(msg.sender);
          }, 0);
        };
      }

      this.debug && debugMessageOrder && console.log("[MSG ORDER] " + this + " sending " + n + " (" + msg.action + ") to " + target);

      return [msg, ackFn];
    }
  }, {
    key: "prepareAnswerMessage",
    value: function prepareAnswerMessage(forMsg, answerData) {
      return {
        action: forMsg.action + "-response",
        inResponseTo: forMsg.messageId,
        target: forMsg.sender,
        data: answerData,
        sender: this.id
      };
    }
  }, {
    key: "installEventToMessageTranslator",
    value: function installEventToMessageTranslator(socket) {
      var self = this;

      var onevent = socket.onevent;
      socket.onevent = function (packet) {
        var args = packet.data || [];
        onevent.call(this, packet); // original invocation
        packet.data = ["*"].concat(args);
        onevent.call(this, packet); // also invoke with *
      };

      socket.on("*", function (eventName, msg) {
        if (eventName && (typeof eventName === "undefined" ? "undefined" : _typeof(eventName)) === "object" && eventName.action) {
          msg = eventName;
          eventName = msg.action;
        }
        var lastArg = arguments[arguments.length - 1],
            ackFn = typeof lastArg === "function" ? lastArg : null;
        msg = msg === ackFn ? null : msg;

        if (!msg || !msg.data || typeof msg.n !== "number" && !msg.broadcast || !msg.sender) {
          console.warn(self + " received non-conformant message " + eventName + ":", arguments);
          typeof ackFn === "function" && ackFn({ data: { error: "invalid l2l message" } });
          return;
        }

        self.receive(msg, socket, ackFn);
      });
    }
  }, {
    key: "receive",
    value: function receive(msg, socket, ackFn) {
      this.dispatchL2LMessageToSelf(msg, socket, ackFn);
    }
  }, {
    key: "dispatchL2LMessageToSelf",
    value: function dispatchL2LMessageToSelf(msg, socket, ackFn) {
      var _this5 = this;

      var selector = msg.action;

      // for broadcasted messages order isn't enforced...
      if (msg.broadcast) {
        this.safeInvokeServiceHandler(selector, msg, ackFn, socket);
        return;
      }

      // do he message ordering dance....
      try {
        var expectedN = this._incomingOrderNumberingBySenders.get(msg.sender) || 0,
            ignoreN = selector === "register" || "unregister";

        if (!ignoreN && msg.n < expectedN) {
          console.error("[MSG ORDER] [" + this + "] received message no. " + msg.n + " but expected >= " + expectedN + ", dropping " + selector);
          return;
        }

        if (!ignoreN && msg.n > expectedN) {
          if (this.debug && debugMessageOrder) console.log("[MSG ORDER] [" + this + "] storing out of order message " + selector + " (" + msg.n + ") for later invocation");
          var cache = this._outOfOrderCacheBySenders.get(msg.sender);
          if (!cache) {
            cache = [];this._outOfOrderCacheBySenders.set(msg.sender, cache);
          }
          cache.push([selector, msg, ackFn, socket]);
          return;
        }

        this.safeInvokeServiceHandler(selector, msg, ackFn, socket);

        setTimeout(function () {
          return _this5.invokeOutOfOrderMessages(msg.sender);
        }, 0);
      } catch (e) {
        console.error("Error message ordering when handling " + selector + ": " + (e.stack || e));
        if (typeof ackFn === "function") ackFn(this.prepareAnswerMessage(msg, { isError: true, error: String(e.stack || e) }));
      }
    }
  }, {
    key: "invokeOutOfOrderMessages",
    value: function invokeOutOfOrderMessages(sender) {
      var outOfOrderMessages = this._outOfOrderCacheBySenders.get(sender);
      if (!outOfOrderMessages || !outOfOrderMessages.length) return;
      var expectedN = this._incomingOrderNumberingBySenders.get(sender) || 0,
          invocationArgsI = outOfOrderMessages.findIndex(function (_ref4) {
        var _ref5 = slicedToArray(_ref4, 2),
            _ = _ref5[0],
            n = _ref5[1].n;

        return n === expectedN;
      });
      if (invocationArgsI === -1) return;
      outOfOrderMessages.splice(invocationArgsI, 1);
      var invocationArgs = outOfOrderMessages[invocationArgsI];
      this.invokeServiceHandler.apply(this, invocationArgs);
    }
  }, {
    key: "renameTarget",
    value: function renameTarget(oldId, newId) {
      if (oldId === newId) return;
      var msgN = this._outgoingOrderNumberingByTargets.get(oldId);
      this._outgoingOrderNumberingByTargets.delete(oldId);
      this._outgoingOrderNumberingByTargets.set(newId, msgN);
    }
  }, {
    key: "safeInvokeServiceHandler",
    value: function safeInvokeServiceHandler(selector, msg, ackFn, socket) {
      try {
        if (typeof this.actions[selector] === "function") {
          this.invokeServiceHandler(selector, msg, ackFn, socket);
        } else {
          if (!socket._events || !Object.keys(socket._events).includes(selector)) {
            console.warn("WARNING [" + this + "] Unhandled message: " + selector);
            if (typeof ackFn === "function") ackFn(this.prepareAnswerMessage(msg, { isError: true, error: "message not understood: " + selector }));
          }
        }
      } catch (e) {
        console.error("Error when handling " + selector + ": " + (e.stack || e));
        if (typeof ackFn === "function") ackFn(this.prepareAnswerMessage(msg, { isError: true, error: String(e.stack || e) }));
      }
    }
  }, {
    key: "invokeServiceHandler",
    value: function invokeServiceHandler(selector, msg, ackFn, socket) {
      var _this6 = this;

      if (this.debug && debugMessageOrder) console.log("[MSG ORDER] " + this + " received " + msg.n + " (" + msg.action + ") from " + msg.sender);

      this._incomingOrderNumberingBySenders.set(msg.sender, msg.n + 1);

      if (typeof ackFn === "function") {
        // in case we send back an ack, other messages send between now and ackFn
        // invocation should be received "later" then the ack
        var ackCalled = false,
            ackTimedout = false,
            timeoutMs = "ackTimeout" in msg ? msg.ackTimeout : this.options.ackTimeout,
            ackN = this._outgoingOrderNumberingByTargets.get(msg.sender) || 0;

        this._outgoingOrderNumberingByTargets.set(msg.sender, ackN + 1);

        var answerFn = function answerFn(answerData) {
          if (ackTimedout) {
            console.warn("[" + _this6 + "] ackFn for " + msg.action + " called after it timed out, dropping answer!");
            return;
          }

          if (ackCalled) {
            console.warn("[" + _this6 + "] ack function called repeatedly when handling " + msg.action);
            return;
          }
          ackCalled = true;

          ackFn(_this6.prepareAnswerMessage(msg, answerData));

          if (_this6.debug && debugMessageOrder) console.log("[MSG ORDER] " + _this6 + " sending " + ackN + " (ack for " + msg.action + ")");
        };

        timeoutMs && setTimeout(function () {
          if (ackCalled) return;
          answerFn({
            isError: true,
            error: "Timeout error: " + _this6 + " did not send answer for " + msg.action + " after " + timeoutMs + "ms"
          });
          ackTimedout = true;
        }, timeoutMs);
      }

      try {
        this.actions[selector].call(this, this, msg, answerFn, socket);
      } catch (e) {
        console.error("[" + this + "] Error handling " + selector + ": " + (e.stack || e));
        answerFn && answerFn({ error: e.stack });
      }
    }
  }, {
    key: "debug",
    get: function get$$1() {
      return this.options.debug;
    },
    set: function set$$1(bool) {
      this.options.debug = bool;
    }
  }]);
  return L2LConnection;
}();

var _this = undefined;

var defaultActions = {

  "l2l-ping": function l2lPing(tracker, _ref, ackFn, socket) {
    var sender = _ref.sender,
        timestamp = _ref.data.timestamp;

    var t = Date.now();
    typeof ackFn === "function" && ackFn({ timestamp: t });
    tracker.debug && console.log("[" + _this + "] got ping from " + sender + ", time: " + (t - timestamp) + "ms");
  },

  "remote-eval": function remoteEval(tracker, _ref2, ackFn, socket) {
    var sender = _ref2.sender,
        source = _ref2.data.source;

    Promise.resolve().then(function () {
      return eval(source);
    }).then(function (result) {
      return ackFn({ value: result });
    }).catch(function (err) {
      // in case SystemJS wraps the error:
      if (err.originalErr) err = err.originalErr;
      console.error("eval error: " + err);
      typeof ackFn === "function" && ackFn({ isError: true, value: String(err.stack || err) });
    });
  },

  "remote-eval-2": function remoteEval2(tracker, _ref3, ackFn, socket) {
    var sender = _ref3.sender,
        source = _ref3.data.source;

    Promise.resolve().then(function () {
      var result = eval(source);
      if (!(result instanceof Promise)) {
        console.error("unexpected eval result:" + result);
        throw new Error("unexpected eval result:" + result);
      }
      return result;
    }).then(function (evalResult) {
      return ackFn(evalResult);
    }).catch(function (err) {
      console.error("eval error: " + err);
      if (err.originalErr) err = err.originalErr;
      typeof ackFn === "function" && ackFn({ isError: true, value: String(err.stack || err) });
    });
  }

};



var defaultClientActions = {
  "getRoomList": function getRoomList(_ref11) {
    var _this5 = this;

    var client = _ref11.client,
        ackFn = _ref11.ackFn;
    return asyncToGenerator(regeneratorRuntime.mark(function _callee4() {
      var result;
      return regeneratorRuntime.wrap(function _callee4$(_context4) {
        while (1) {
          switch (_context4.prev = _context4.next) {
            case 0:
              result = client._socketioClient.rooms;

              ackFn(result);

            case 2:
            case "end":
              return _context4.stop();
          }
        }
      }, _callee4, _this5);
    }))();
  },
  "ask for": function askFor(tracker, _ref12, ackFn, socket) {
    var sender = _ref12.sender,
        query = _ref12.data.query;

    var _this6 = this;

    return asyncToGenerator(regeneratorRuntime.mark(function _callee5() {
      var promptMethod, answer;
      return regeneratorRuntime.wrap(function _callee5$(_context5) {
        while (1) {
          switch (_context5.prev = _context5.next) {
            case 0:
              promptMethod = query.match(/password|sudo/i) ? 'passwordPrompt' : 'prompt';
              _context5.next = 3;
              return $world[promptMethod](query);

            case 3:
              answer = _context5.sent;

              typeof ackFn === "function" && ackFn({ answer: answer });
              tracker.debug && console.log("[" + _this6 + "] message 'ask for' from " + sender + ", query: " + query);

            case 6:
            case "end":
              return _context5.stop();
          }
        }
      }, _callee5, _this6);
    }))();
  },
  "open editor": function openEditor(tracker, _ref13, ackFn, socket) {
    var sender = _ref13.sender,
        args = _ref13.data.args;

    var _this7 = this;

    return asyncToGenerator(regeneratorRuntime.mark(function _callee6() {
      var status;
      return regeneratorRuntime.wrap(function _callee6$(_context6) {
        while (1) {
          switch (_context6.prev = _context6.next) {
            case 0:
              if (args.length) {
                _context6.next = 3;
                break;
              }

              ackFn({ error: 'no file specified' });
              return _context6.abrupt("return");

            case 3:
              _context6.next = 5;
              return $world.execCommand("open file for EDITOR", { url: args[0] });

            case 5:
              status = _context6.sent;

              typeof ackFn === "function" && ackFn(status === "aborted" ? { error: String(status) } : { status: status });

            case 7:
            case "end":
              return _context6.stop();
          }
        }
      }, _callee6, _this7);
    }))();
  },
  "changeWorkingDirectory": function changeWorkingDirectory(tracker, _ref14, ackFn, socket) {
    var sender = _ref14.sender,
        args = _ref14.data.args;

    var _this8 = this;

    return asyncToGenerator(regeneratorRuntime.mark(function _callee7() {
      var _ref15, _ref16, dir, commandMorphId, status, morph, shellPlugin;

      return regeneratorRuntime.wrap(function _callee7$(_context7) {
        while (1) {
          switch (_context7.prev = _context7.next) {
            case 0:
              _ref15 = args || [], _ref16 = slicedToArray(_ref15, 2), dir = _ref16[0], commandMorphId = _ref16[1];
              status = "OK";


              try {
                if (!dir) status = "[changeWorkingDirectory] No directory received";else if (!commandMorphId) status = "[changeWorkingDirectory] No command morph";else {
                  morph = $world.getMorphWithId(commandMorphId);

                  if (morph) {
                    if (morph.__lookupSetter__("cwd")) morph.cwd = dir;else if (typeof morph.changeWorkingDirectory === "function") morph.changeWorkingDirectory(dir);else if (typeof morph.pluginFind === "function") {
                      shellPlugin = morph.pluginFind(function (ea) {
                        return ea.isShellEditorPlugin;
                      });

                      if (shellPlugin) shellPlugin.cwd = dir;
                    } else {
                      status = "[changeWorkingDirectory] cannot figure pout how to set dir";
                    }
                  }
                }
              } catch (e) {
                status = String(e);
              }

              if (status !== "OK") console.warn(status);
              typeof ackFn === "function" && ackFn(status);

            case 5:
            case "end":
              return _context7.stop();
          }
        }
      }, _callee7, _this8);
    }))();
  }
};

/*global Map,System,process*/
var isNode = typeof System !== "undefined" ? System.get("@system-env").node : typeof process !== "undefined" && process.env;

// FIXME!!
// import ioClient from "socket.io-client";
var ioClient;
if (typeof _ioClient === "undefined" && isNode) {
  var require = System._nodeRequire("module")._load;
  ioClient = require("socket.io-client");
} else {
  ioClient = _ioClient;
}

var urlHelper = {
  isRoot: function isRoot(url) {
    return urlHelper.path(url) === "/";
  },

  root: function root(url) {
    return urlHelper.isRoot(url) ? url : url.slice(0, -urlHelper.path(url).length) + "/";
  },

  path: function () {
    var protocolRe = /^[a-z0-9-_\.]+:/,
        slashslashRe = /^\/\/[^\/]+/;
    return function (url) {
      var path = url.replace(protocolRe, "").replace(slashslashRe, "");
      return path === "" ? "/" : path;
    };
  }(),

  join: function join(url, path) {
    if (url.endsWith("/")) url = url.slice(0, -1);
    if (path.startsWith("/")) path = path.slice(1);
    return url + "/" + path;
  }
};

function determineLocation() {
  if (typeof document !== "undefined" && document.location) return document.location.origin;

  if (isNode) return System._nodeRequire("os").hostname();

  return System.baseURL;
}

var L2LClient = function (_L2LConnection) {
  inherits(L2LClient, _L2LConnection);
  createClass(L2LClient, null, [{
    key: "clientKey",
    value: function clientKey(origin, path, namespace) {
      origin = origin.replace(/\/$/, "");
      path = path.replace(/^\//, "");
      namespace = namespace.replace(/^\//, "");
      return origin + "-" + path + "-" + namespace;
    }
  }, {
    key: "forLivelyInBrowser",
    value: function forLivelyInBrowser(info) {
      var hasInfo = !!info;
      info = _extends({ type: "lively.morphic browser" }, info);

      var def = this.default();

      if (!def) {
        return L2LClient.ensure({
          url: document.location.origin + "/lively-socket.io",
          namespace: "l2l", info: info
        });
      }

      if (hasInfo && !lively_lang.obj.equals(def.info, info) && def.isRegistered()) {
        def.info = info;
        def.unregister().then(function () {
          return def.register();
        }).catch(function (err) {
          return console.error("l2l re-register on info change errored: " + err);
        });
      }

      return def;
    }
  }, {
    key: "default",
    value: function _default() {
      // FIXME
      var key = L2LClient.clients.keys().next().value;
      return L2LClient.clients.get(key);
    }
  }, {
    key: "create",
    value: function create() {
      var options = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};
      var _options$debug = options.debug,
          debug = _options$debug === undefined ? false : _options$debug,
          url = options.url,
          namespace = options.namespace,
          _options$autoOpen = options.autoOpen,
          autoOpen = _options$autoOpen === undefined ? true : _options$autoOpen,
          _options$info = options.info,
          info = _options$info === undefined ? {} : _options$info;


      if (!url) throw new Error("L2LClient needs server url!");

      var origin = urlHelper.root(url).replace(/\/+$/, ""),
          path = urlHelper.path(url),
          client = new this(origin, path, namespace || "", info);

      if (autoOpen) client.register();
      client.debug = debug;
      return client;
    }
  }, {
    key: "ensure",
    value: function ensure() {
      var options = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};

      // url specifies hostname + port + io path
      // namespace is io namespace
      var url = options.url,
          namespace = options.namespace;


      if (!url) throw new Error("L2LClient needs server url!");

      var origin = urlHelper.root(url).replace(/\/+$/, ""),
          path = urlHelper.path(url),
          key = this.clientKey(origin, path, namespace || ""),
          client = this.clients.get(key);

      if (!client) this.clients.set(key, client = this.create(_extends({}, options, { url: url, namespace: namespace })));

      return client;
    }
  }, {
    key: "clients",
    get: function get$$1() {
      return this._clients || (this._clients = new Map());
    }
  }]);

  function L2LClient(origin, path, namespace, info) {
    classCallCheck(this, L2LClient);

    var _this = possibleConstructorReturn(this, (L2LClient.__proto__ || Object.getPrototypeOf(L2LClient)).call(this));

    lively_lang.events.makeEmitter(_this);
    _this.info = info;
    _this.origin = origin;
    _this.path = path;
    _this.namespace = namespace.replace(/^\/?/, "/");
    _this.trackerId = null;
    _this._socketioClient = null;

    // not socket.io already does auto reconnect when network fails but if the
    // socket.io server disconnects a socket, it won't retry by itself. We want
    // that behavior for l2l, however
    _this._reconnectState = {
      closed: false,
      autoReconnect: true,
      isReconnecting: false,
      isReconnectingViaSocketio: false,
      registerAttempt: 0,
      registerProcess: null,
      isOpening: false
    };

    Object.keys(defaultActions).forEach(function (name) {
      return _this.addService(name, defaultActions[name]);
    });

    Object.keys(defaultClientActions).forEach(function (name) {
      return _this.addService(name, defaultClientActions[name]);
    });
    return _this;
  }

  createClass(L2LClient, [{
    key: "isOnline",
    value: function isOnline() {
      return this.socket && this.socket.connected;
    }
  }, {
    key: "isRegistered",
    value: function isRegistered() {
      return this.isOnline() && !!this.trackerId;
    }
  }, {
    key: "open",
    value: function () {
      var _ref = asyncToGenerator(regeneratorRuntime.mark(function _callee() {
        var _this2 = this;

        var url, opts, socket;
        return regeneratorRuntime.wrap(function _callee$(_context) {
          while (1) {
            switch (_context.prev = _context.next) {
              case 0:
                if (!this.isOnline()) {
                  _context.next = 2;
                  break;
                }

                return _context.abrupt("return", this);

              case 2:
                if (!this._reconnectState.isOpening) {
                  _context.next = 4;
                  break;
                }

                return _context.abrupt("return", this);

              case 4:
                _context.next = 6;
                return this.close();

              case 6:

                this._reconnectState.closed = false;

                url = urlHelper.join(this.origin, this.namespace), opts = { path: this.path, transports: ['websocket', 'polling'] }, socket = this._socketioClient = ioClient(url, opts);


                if (this.debug) console.log("[" + this + "] connecting");

                socket.on("error", function (err) {
                  _this2._reconnectState.isOpening = false;
                  _this2.debug && console.log("[" + _this2 + "] errored: " + err);
                });
                socket.on("close", function (reason) {
                  return _this2.debug && console.log("[" + _this2 + "] closed: " + reason);
                });
                socket.on("reconnect_failed", function () {
                  return _this2.debug && console.log("[" + _this2 + "] could not reconnect");
                });
                socket.on("reconnect_error", function (err) {
                  return _this2.debug && console.log("[" + _this2 + "] reconnect error " + err);
                });

                socket.on("connect", function () {
                  _this2.debug && console.log("[" + _this2 + "] connected");
                  _this2.emit("connected", _this2);
                  _this2._reconnectState.isOpening = false;
                  _this2._reconnectState.isReconnecting = false;
                  _this2._reconnectState.isReconnectingViaSocketio = false;
                });

                socket.on("disconnect", function () {
                  _this2._reconnectState.isOpening = false;

                  _this2.debug && console.log("[" + _this2 + "] disconnected");
                  _this2.emit("disconnected", _this2);

                  if (!_this2.trackerId) {
                    _this2.debug && console.log("[" + _this2 + "] disconnect: don't have a tracker id, won't try reconnect");
                    _this2.trackerId = "tracker";
                    return;
                  }

                  if (_this2.trackerId !== "tracker") {
                    // for maintaining seq nos.
                    _this2.renameTarget(_this2.trackerId, "tracker");
                    _this2.trackerId = null;
                  }

                  if (_this2._reconnectState.closed) {
                    _this2.debug && console.log("[" + _this2 + "] won't reconnect b/c client is marked as closed");
                    return;
                  }

                  if (!_this2._reconnectState.autoReconnect) {
                    _this2.debug && console.log("[" + _this2 + "] won't reconnect b/c client has reconnection disabled");
                    return;
                  }

                  _this2._reconnectState.isReconnecting = true;

                  setTimeout(function () {
                    // if socket.io isn't auto reconnecting we are doing it manually

                    if (_this2._reconnectState.closed) {
                      _this2.debug && console.log("[" + _this2 + "] won't reconnect b/c client is marked as closed 2");
                      return;
                    }
                    if (_this2._reconnectState.isReconnectingViaSocketio) {
                      _this2.debug && console.log("[" + _this2 + "] won't reconnect again, client already reconnecting");
                      return;
                    }

                    _this2.debug && console.log("[" + _this2 + "] initiating reconnection to tracker");
                    _this2.register();
                  }, 20);
                });

                socket.on("reconnecting", function () {
                  _this2.debug && console.log("[" + _this2 + "] reconnecting", _this2._reconnectState);
                  _this2.emit("reconnecting", _this2);
                  if (_this2._reconnectState.closed) {
                    _this2._reconnectState.isReconnecting = false;
                    _this2._reconnectState.isReconnectingViaSocketio = false;
                    socket.close();
                    _this2.close();
                  } else {
                    _this2._reconnectState.isReconnecting = true;
                    _this2._reconnectState.isReconnectingViaSocketio = true;
                  }
                });

                socket.on("reconnect", function () {
                  _this2.debug && console.log("[" + _this2 + "] reconnected");
                  _this2._reconnectState.isReconnecting = false;
                  _this2._reconnectState.isReconnectingViaSocketio = false;
                  _this2.register();
                });

                this.installEventToMessageTranslator(socket);

                this._reconnectState.isOpening = true;

                return _context.abrupt("return", new Promise(function (resolve, reject) {
                  socket.once("error", reject);
                  socket.once("connect", resolve);
                }).then(function () {
                  return _this2;
                }));

              case 20:
              case "end":
                return _context.stop();
            }
          }
        }, _callee, this);
      }));

      function open() {
        return _ref.apply(this, arguments);
      }

      return open;
    }()
  }, {
    key: "close",
    value: function () {
      var _ref2 = asyncToGenerator(regeneratorRuntime.mark(function _callee2() {
        var _this3 = this;

        var socket, reason;
        return regeneratorRuntime.wrap(function _callee2$(_context2) {
          while (1) {
            switch (_context2.prev = _context2.next) {
              case 0:
                this._reconnectState.closed = true;

                socket = this.socket;
                // this._socketioClient = null;

                if (socket) {
                  socket.removeAllListeners("reconnect");
                  socket.removeAllListeners("reconnecting");
                  socket.removeAllListeners("disconnect");
                  socket.removeAllListeners("connect");
                  socket.removeAllListeners("reconnect_error");
                  socket.removeAllListeners("reconnect_failed");
                  socket.removeAllListeners("close");
                  socket.removeAllListeners("error");
                  socket.close();
                }

                this.debug && console.log("[" + this + "] closing...");

                if (!this.isRegistered()) {
                  _context2.next = 7;
                  break;
                }

                _context2.next = 7;
                return this.unregister();

              case 7:
                if (!(!this.isOnline() && !this.socket)) {
                  _context2.next = 10;
                  break;
                }

                if (this.debug) {
                  reason = !this.isOnline() ? "not online" : "no socket";

                  this.debug && console.log("[" + this + "] cannot close: " + reason);
                }
                return _context2.abrupt("return", this);

              case 10:
                if (!(socket && !socket.connected)) {
                  _context2.next = 13;
                  break;
                }

                this.debug && console.log("[" + this + "] socket not connected, considering client closed");
                return _context2.abrupt("return", this);

              case 13:
                return _context2.abrupt("return", Promise.race([lively_lang.promise.delay(2000).then(function () {
                  return socket.removeAllListeners("disconnect");
                }), new Promise(function (resolve) {
                  return socket.once("disconnect", resolve);
                })]).then(function () {
                  _this3.debug && console.log("[" + _this3 + "] closed");
                  return _this3;
                }));

              case 14:
              case "end":
                return _context2.stop();
            }
          }
        }, _callee2, this);
      }));

      function close() {
        return _ref2.apply(this, arguments);
      }

      return close;
    }()
  }, {
    key: "remove",
    value: function remove() {
      var origin = this.origin,
          path = this.path,
          namespace = this.namespace,
          key = this.constructor.clientKey(origin, path, namespace);

      this.constructor.clients.delete(key);
      return this.close();
    }
  }, {
    key: "register",
    value: function () {
      var _ref3 = asyncToGenerator(regeneratorRuntime.mark(function _callee3() {
        var _this4 = this;

        var answer, err, _err, _answer$data, trackerId, messageNumber, attempt, timeout;

        return regeneratorRuntime.wrap(function _callee3$(_context3) {
          while (1) {
            switch (_context3.prev = _context3.next) {
              case 0:
                if (!this.isRegistered()) {
                  _context3.next = 2;
                  break;
                }

                return _context3.abrupt("return");

              case 2:
                if (!this._reconnectState.closed) {
                  _context3.next = 6;
                  break;
                }

                this.debug && console.log("[" + this + "] not registering this b/c closed");
                this._reconnectState.registerAttempt = 0;
                return _context3.abrupt("return");

              case 6:
                if (!this._reconnectState.registerProcess) {
                  _context3.next = 9;
                  break;
                }

                this.debug && console.log("[" + this + "] not registering this b/c register process exists");
                return _context3.abrupt("return");

              case 9:
                _context3.prev = 9;

                if (this.isOnline()) {
                  _context3.next = 13;
                  break;
                }

                _context3.next = 13;
                return this.open();

              case 13:

                this.debug && console.log("[" + this + "] register");

                _context3.next = 16;
                return this.sendToAndWait("tracker", "register", _extends({
                  userName: "unknown",
                  type: "l2l " + (isNode ? "node" : "browser"),
                  location: determineLocation()
                }, this.info));

              case 16:
                answer = _context3.sent;

                if (answer.data) {
                  _context3.next = 21;
                  break;
                }

                err = new Error("Register answer is empty!");

                this.emit("error", err);
                throw err;

              case 21:
                if (!answer.data.isError) {
                  _context3.next = 25;
                  break;
                }

                _err = new Error(answer.data.error);

                this.emit("error", _err);
                throw _err;

              case 25:

                this._reconnectState.registerAttempt = 0;
                _answer$data = answer.data, trackerId = _answer$data.trackerId, messageNumber = _answer$data.messageNumber;

                this.trackerId = trackerId;
                this._incomingOrderNumberingBySenders.set(trackerId, messageNumber || 0);
                this.emit("registered", { trackerId: trackerId });

                _context3.next = 37;
                break;

              case 32:
                _context3.prev = 32;
                _context3.t0 = _context3["catch"](9);

                console.error("Error in register request of " + this + ": " + _context3.t0);
                attempt = this._reconnectState.registerAttempt++, timeout = lively_lang.num.backoff(attempt, 4 /*base*/, 5 * 60 * 1000 /*max*/);

                this._reconnectState.registerProcess = setTimeout(function () {
                  _this4._reconnectState.registerProcess = null;
                  _this4.register();
                }, timeout);

              case 37:
              case "end":
                return _context3.stop();
            }
          }
        }, _callee3, this, [[9, 32]]);
      }));

      function register() {
        return _ref3.apply(this, arguments);
      }

      return register;
    }()
  }, {
    key: "unregister",
    value: function () {
      var _ref4 = asyncToGenerator(regeneratorRuntime.mark(function _callee4() {
        var trackerId;
        return regeneratorRuntime.wrap(function _callee4$(_context4) {
          while (1) {
            switch (_context4.prev = _context4.next) {
              case 0:
                if (this.isRegistered()) {
                  _context4.next = 2;
                  break;
                }

                return _context4.abrupt("return");

              case 2:
                this.debug && console.log("[" + this + "] unregister");
                trackerId = this.trackerId;
                _context4.prev = 4;
                _context4.next = 7;
                return this.sendToAndWait(this.trackerId, "unregister", {});

              case 7:
                _context4.next = 11;
                break;

              case 9:
                _context4.prev = 9;
                _context4.t0 = _context4["catch"](4);

              case 11:
                this.renameTarget(trackerId, "tracker");
                this.trackerId = null;
                this.emit("unregistered", this);

              case 14:
              case "end":
                return _context4.stop();
            }
          }
        }, _callee4, this, [[4, 9]]);
      }));

      function unregister() {
        return _ref4.apply(this, arguments);
      }

      return unregister;
    }()
  }, {
    key: "whenRegistered",
    value: function whenRegistered(timeout) {
      var _this5 = this;

      return lively_lang.promise.waitFor(timeout, function () {
        return _this5.isRegistered();
      }).catch(function (err) {
        return Promise.reject(/timeout/i.test(String(err)) ? new Error("Timeout in " + _this5 + ".whenRegistered") : err);
      });
    }
  }, {
    key: "send",
    value: function send(msg, ackFn) {
      var _this6 = this;

      var _prepareSend = this.prepareSend(msg, ackFn);

      var _prepareSend2 = slicedToArray(_prepareSend, 2);

      msg = _prepareSend2[0];
      ackFn = _prepareSend2[1];

      this.whenOnline().then(function () {
        var socket = _this6.socket,
            _msg = msg,
            action = _msg.action,
            target = _msg.target;

        if (!socket) throw new Error("Trying to send message " + action + " to " + target + " but cannot find a connection to it!");
        typeof ackFn === "function" ? socket.emit(action, msg, ackFn) : socket.emit(action, msg);
      });
    }

    // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
    // broadcasting

  }, {
    key: "joinRoom",
    value: function joinRoom(room) {
      var _this7 = this;

      return this.whenOnline().then(function () {
        return _this7.sendToAndWait(_this7.trackerId, "[broadcast] join room", { room: room });
      });
    }
  }, {
    key: "leaveRoom",
    value: function leaveRoom(room) {
      var _this8 = this;

      return this.whenOnline().then(function () {
        return _this8.sendToAndWait(_this8.trackerId, "[broadcast] leave room", { room: room });
      });
    }
  }, {
    key: "broadcast",
    value: function broadcast(room, action, data) {
      var _this9 = this;

      var isSystemBroadcast = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : false;
      var isMultiServerBroadcast = arguments.length > 4 && arguments[4] !== undefined ? arguments[4] : false;

      var broadcast = { action: action, room: room, broadcast: data };
      if (isSystemBroadcast) broadcast.isSystemBroadcast = true;
      if (isMultiServerBroadcast) broadcast.isMultiServerBroadcast = true;
      return this.whenOnline().then(function () {
        return _this9.sendToAndWait(_this9.trackerId, "[broadcast] send", broadcast);
      });
    }
  }, {
    key: "listRoomMembers",
    value: function () {
      var _ref5 = asyncToGenerator(regeneratorRuntime.mark(function _callee5(room) {
        var _ref6, data;

        return regeneratorRuntime.wrap(function _callee5$(_context5) {
          while (1) {
            switch (_context5.prev = _context5.next) {
              case 0:
                _context5.next = 2;
                return this.sendToAndWait(this.trackerId, "[broadcast] list room members", { room: room });

              case 2:
                _ref6 = _context5.sent;
                data = _ref6.data;
                return _context5.abrupt("return", data);

              case 5:
              case "end":
                return _context5.stop();
            }
          }
        }, _callee5, this);
      }));

      function listRoomMembers(_x5) {
        return _ref5.apply(this, arguments);
      }

      return listRoomMembers;
    }()
  }, {
    key: "joinedRooms",
    value: function () {
      var _ref7 = asyncToGenerator(regeneratorRuntime.mark(function _callee6() {
        var _ref8, data;

        return regeneratorRuntime.wrap(function _callee6$(_context6) {
          while (1) {
            switch (_context6.prev = _context6.next) {
              case 0:
                _context6.next = 2;
                return this.sendToAndWait(this.trackerId, "[broadcast] my rooms", {});

              case 2:
                _ref8 = _context6.sent;
                data = _ref8.data;
                return _context6.abrupt("return", data);

              case 5:
              case "end":
                return _context6.stop();
            }
          }
        }, _callee6, this);
      }));

      function joinedRooms() {
        return _ref7.apply(this, arguments);
      }

      return joinedRooms;
    }()
  }, {
    key: "listRooms",
    value: function () {
      var _ref9 = asyncToGenerator(regeneratorRuntime.mark(function _callee7() {
        var _ref10, data;

        return regeneratorRuntime.wrap(function _callee7$(_context7) {
          while (1) {
            switch (_context7.prev = _context7.next) {
              case 0:
                _context7.next = 2;
                return this.sendToAndWait(this.trackerId, "[broadcast] all rooms", {});

              case 2:
                _ref10 = _context7.sent;
                data = _ref10.data;
                return _context7.abrupt("return", data);

              case 5:
              case "end":
                return _context7.stop();
            }
          }
        }, _callee7, this);
      }));

      function listRooms() {
        return _ref9.apply(this, arguments);
      }

      return listRooms;
    }()

    // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
    // user network related

  }, {
    key: "listPeers",
    value: function () {
      var _ref11 = asyncToGenerator(regeneratorRuntime.mark(function _callee8() {
        var force = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : false;

        var _peersCached, t, timeout, _ref12, data, sessions;

        return regeneratorRuntime.wrap(function _callee8$(_context8) {
          while (1) {
            switch (_context8.prev = _context8.next) {
              case 0:
                _peersCached = this._peersCached, t = Date.now(), timeout = 1000;

                if (!(!force && _peersCached && t - _peersCached.timestamp < timeout)) {
                  _context8.next = 3;
                  break;
                }

                return _context8.abrupt("return", this._peersCached.sessions);

              case 3:
                if (this.isOnline()) {
                  _context8.next = 5;
                  break;
                }

                return _context8.abrupt("return", []);

              case 5:
                _context8.next = 7;
                return this.sendToAndWait(this.trackerId, "getClients", {});

              case 7:
                _ref12 = _context8.sent;
                data = _ref12.data;
                sessions = data.map(function (_ref13) {
                  var _ref14 = slicedToArray(_ref13, 2),
                      id = _ref14[0],
                      record = _ref14[1];

                  var _ref15 = record.info || {},
                      userRealm = _ref15.userRealm,
                      userToken = _ref15.userToken,
                      l2lUserToken = _ref15.l2lUserToken,
                      location = _ref15.location,
                      type = _ref15.type,
                      world = _ref15.world,
                      peer = _extends({}, lively_lang.obj.dissoc(record, ["info"]), { id: id, world: world, location: location, type: type });

                  userToken = userToken || l2lUserToken;
                  if (userToken && userToken !== "null") {
                    if (lively.user) {
                      peer.user = lively.user.ClientUser.fromToken(userToken, userRealm);
                    } else {
                      peer.userToken = userToken;
                      peer.userRealm = userRealm;
                    }
                  }
                  return peer;
                });


                this._peersCached = { timestamp: t, sessions: sessions };
                return _context8.abrupt("return", sessions);

              case 12:
              case "end":
                return _context8.stop();
            }
          }
        }, _callee8, this);
      }));

      function listPeers() {
        return _ref11.apply(this, arguments);
      }

      return listPeers;
    }()

    // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
    // debugging

  }, {
    key: "toString",
    value: function toString() {
      var origin = this.origin,
          path = this.path,
          namespace = this.namespace,
          id = this.id,
          state = !this.isOnline() ? "disconnected" : !this.isRegistered() ? "unregistered" : "registered",
          shortId = (id || "").slice(0, 5);

      return "L2LClient(" + shortId + " " + origin + path + " - " + namespace + " " + state + ")";
    }
  }, {
    key: "socket",
    get: function get$$1() {
      return this._socketioClient;
    }
  }, {
    key: "socketId",
    get: function get$$1() {
      return this.socket ? this.namespace + "#" + this.socket.id : null;
    }
  }]);
  return L2LClient;
}(L2LConnection);

return L2LClient;

}(lively.lang,io));

  if (typeof module !== "undefined" && module.exports) module.exports = GLOBAL.lively.l2l.client;
})();