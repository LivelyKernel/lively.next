import { loadObjectFromPartsbinFolder } from "../../partsbin.js";
export async function makeDOTstring(aMorph){    
   var str = "digraph g{"
   var root = aMorph  
   recurse(aMorph)
  
  
  function recurse (morph) {
    morph.submorphs.forEach(function(ea){
      var colorStr = ((morph == root) ? 'color="orange"' : 'color="lightblue"')
      
      str += '{' + morph.id + ' [label="'+ (morph.name ? morph.name : 'No Name') +'" ' + colorStr + ']} -> {' + ea.id + ' [label="'+ (ea.name ? ea.name : 'No Name') +'", color="lightblue"]};'
      recurse(ea)
    })
  }
  str += '}'
  return str
}

async function testGraph(aMorph){
  await  new Promise((resolve, reject) => {
            var count = 0;
            function testNetwork(){
              if (aMorph.network){
                resolve("Success!"); 
              } else if (count<5){
                count++
                setTimeout(testNetwork,20)
              } else {
                reject("Graph Not Loaded")
              }
            }
           testNetwork();          
       })
}

export async function hierarchyView(aMorph) {
  var container = await loadObjectFromPartsbinFolder('CategoryVisualization')
  await container.openInWorld()
  
  // sets target as inner visjs morph
  var graph = container.getSubmorphNamed('visjsMorph')

  //verify network is loaded
  await testGraph(graph);
  
  new Promise(function(resolve, reject) {
  var s = makeDOTstring(aMorph)
  if (s) { resolve(s) }
} ).then(function(dstr){  
  var opts = {
    physics: {enabled: false},
    layout: {        
    hierarchical: {
      enabled:true,
      levelSeparation: 150,
      nodeSpacing: 100,
      treeSpacing: 200,
      blockShifting: true,
      edgeMinimization: true,
      parentCentralization: true,
      direction: 'UD',        // UD, DU, LR, RL
      sortMethod: 'directed'   // hubsize, directed
    }
  }
  }
  graph.makeFromDot(dstr,opts)
});  
}