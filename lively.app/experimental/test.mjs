import * as inspector from 'node:inspector/promises';
const sess = new inspector.Session();
sess.connect();
await sess.post('Runtime.enable')

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
})
// const objid = re.result.objectId
// console.log(re)
// console.log(objid)
// test()

//let result = await sess.post('Runtime.evaluate', {expression: 'global.test'});
//console.log(result)
//result = await sess.post('Debugger.getScriptSource', {scriptId: objid});
//const scriptId = re.scriptId;
//let result = await sess.post('Debugger.getScriptSource',{scriptId});

//console.log(result)
//console.log((await sess.post('Runtime.getIsolateId')))

