exports.testOutput = function() {
  
  const fs = require('fs');
  const inspector = require('node:inspector');
  console.log('after import')
  const sess = new inspector.Session();
  console.log('came here')
  sess.connect();
  sess.post('Runtime.enable').then(async () => {
  console.log('entered then')
  const robin = 3
  global.test = () =>  robin + 5;
  const re = await sess.post('Runtime.evaluate',{expression: 'global.test', generatePreview: true})
  //console.log(re)
  const objId = re.result.objectId;
  const props = await sess.post('Runtime.getProperties',{objectId: objId,ownProperties: true, generatePreview: true});
  props.internalProperties.forEach(async (p) => {
    //k console.log('---')
    //console.log(p)
    if (p.value.subtype === 'internal#scopeList'){
      let r = await sess.post('Runtime.getProperties',{objectId: p.value.objectId});
      // Second item holds Array, Date, global, ...
      r = await sess.post('Runtime.getProperties',{objectId: r.result[0].value.objectId});
      r.result.forEach(async re => {
         // const res = await sess.post('Runtime.getProperties',{objectId: re.value.objectId});
          console.log(re)
      })
    } 
  })})};
    