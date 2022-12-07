module.exports = {
    'plugins': [
		'jsdoc'
	],
	'rules': {
		"jsdoc/require-jsdoc": 'error'
	},
	"parser": "@babel/eslint-parser",
	parserOptions: {
		requireConfigFile: false,
		ecmaVersion: 2018,
		sourceType: 'module'
	  }
}
