import { resource } from 'lively.resources';
import { Path } from 'lively.lang';

export class PackageJSONCompleter {
  isValidPrefix (prefix) {
    return !!prefix;
  }

  async compute (textMorph, prefix) {
    textMorph.editorPlugin.parse();
    const isInDef = !!textMorph.editorPlugin.tokenAt(textMorph.cursorPosition).find(m =>
      ['dependencies', 'devDependencies'].includes(Path('key.value').get(m)));
    if (!isInDef) return [];
    const pkgs = await doNewNPMSearch(prefix);
    return pkgs.map(pkg => {
      const [completion, info] = pkg.string.split('@');
      return {
        info: `@${info}`,
        completion,
        customInsertionFn: (complString, prefix, textMorph, { start, end }) => {
          textMorph.replace(textMorph.lineRange(), `"${completion}": "${info}"`);
        }
      };
    });
  }
}

async function doNewNPMSearch (query) {
  // https://github.com/npm/registry/blob/master/docs/REGISTRY-API.md#get-v1search
  // text	String	Query	❌	full-text search to apply
  // size	integer	Query	❌	how many results should be returned (default 20, max 250)
  // from	integer	Query	❌	offset to return results from
  // quality	float	Query	❌	how much of an effect should quality have on search results
  // popularity	float	Query	❌	how much of an effect should popularity have on search results
  // maintenance	float	Query	❌	how much of an effect should maintenance have on search results

  // let fields = ['name','description','keywords','author','modified','homepage','version','license','rating', "readme"]
  const url = `https://registry.npmjs.com/-/v1/search?text=${query}&size=50`;
  const found = await resource(url).makeProxied().readJson();
  return found.objects.map(p => {
    const { searchScore, package: { name, version } } = p;
    return {
      isListItem: true,
      string: `${name}@${version}`,
      value: p
    };
  });
}
