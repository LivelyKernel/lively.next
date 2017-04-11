export function applyObjectMigrations(snapshotJson) {
  for (let {name, snapshotConverter} of migrations) {
    if (typeof snapshotConverter !== "function") continue;
    try {
      snapshotJson = snapshotConverter(snapshotJson);
    } catch (err) {
      console.error(`Object migration ${name} failed: ${err.stack}`);
    }
  }
  return snapshotJson;
}


export var migrations = [

  {
    date: "2017-04-08",
    name: "Text and Label textAndAttributes format change",
    description: `
Changing the format from
  [[string1, attr1_1, attr1_2], [string2, attr2_1, attr2_2], ...]
to
  [string1, attr1, string2, attr2, ...].
    `,
    snapshotConverter: snap => {
      let {snapshot} = snap;
      for (let key in snapshot) {
        let serialized = snapshot[key],
            textAndAttributes = serialized.props && serialized.props.textAndAttributes;
        if (!textAndAttributes) continue;
        let {value} = textAndAttributes;
        if (!Array.isArray(value)) {
          console.warn(`object migrator found textAndAttributes field but it is not an Array!`);
          continue;
        }
        if (!value.length || typeof value[0] === "string") continue; // OK
        // flatten values
        value = [].concat.apply([], value);
        for (let i = 0; i < value.length; i += 2) {
          let text = value[i], attr = value[i+1];
          if (attr && Array.isArray(attr)) // merge multi-attributes
            value[i+1] = Object.assign({}, ...attr);
        }
        serialized.props.textAndAttributes = {...textAndAttributes, value};
      }
      return snap;
    }
  }

];
