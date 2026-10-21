import css from 'css';

/**
 * Scope declarations to HTML content without changing selector specificity.
 * @param {string} source CSS source.
 * @param {string[]} ids HTMLMorph ids.
 * @returns {string} Scoped CSS.
 */
export function scopedCss (source, ids) {
  const parsed = css.parse(source);
  /**
   * Prefix selectors, including rules nested in media/supports blocks.
   * @param {object[]} rules Parsed CSS rules.
   */
  function scope (rules) {
    for (const rule of rules) {
      // The custom HTML node is the first child; morphic submorphs are siblings.
      if (rule.selectors) rule.selectors = ids.flatMap(id => rule.selectors.map(selector => `#${id} > :where(:first-child) ${selector}`));
      if (rule.rules) scope(rule.rules);
    }
  }
  scope(parsed.stylesheet.rules);
  return css.stringify(parsed);
}
