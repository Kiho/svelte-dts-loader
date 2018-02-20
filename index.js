const { basename, extname, dirname } = require('path');
const { writeFileSync, existsSync, mkdirSync, unlinkSync } = require('fs');
const { getOptions } = require('loader-utils');
const svelte = require('svelte');
const mkdirp = require('mkdirp');
const printInferredTypes = require('./lib/inferred-types').default;

function writeFile(filepath, contents) {
  mkdirp(dirname(filepath), function (err) {
    writeFileSync(filepath, contents);
  });
}

function sanitize(input) {
	return basename(input).
			replace(extname(input), '').
			replace(/[^a-zA-Z_$0-9]+/g, '_').
			replace(/^_/, '').
			replace(/_$/, '').
			replace(/^(\d)/, '_$1');
}

function capitalize(str) {
	return str[0].toUpperCase() + str.slice(1);
}

const defaultOptions = { extensions: ['.html'] };

module.exports = function (source, map, meta) {
	this.cacheable();  
	const callback = this.async();
	const options = Object.assign({}, defaultOptions, this.options, getOptions(this));
	const id = this.resourcePath;
	const extension = options.extensions.find(x => id.endsWith(x))
	const baseId = id.slice(0, -extension.length)
	let paths = id.split('/');
	if (paths.length === 1) paths = id.split('\\'); // take care windows path 
	const filename = paths[paths.length - 1];

	const preOptions = {
		filename: filename, // this is passed to each preprocessor

		markup: ({ content, filename }) => {
			return {
				code: content,
				map: ''
			};
		},

		script: ({ content, attributes, filename }) => {
			targetPath = id.replace('/src/', '/preprocessed/');			
			targetPath = id.replace('\\src\\', '\\preprocessed\\');
			const tsFilePath = baseId + '.ts';
			const name = sanitize(filename)
			// console.log('filename, filePath', filename, name, tsFilePath);
			writeFileSync(tsFilePath, content.replace('export default ', `let ${name} = `));
			const dts = printInferredTypes(tsFilePath, name);
			const dtsFilePath = `${targetPath}.d.ts`;
			if (dts) {
				writeFile(dtsFilePath, dts);
				unlinkSync(tsFilePath);	
			} else {
				if (existsSync(dtsFilePath)) {
					unlinkSync(dtsFilePath);
				}				
			}	
			return {
				code: content,
				map: ''
			};
		}
	};

	svelte.preprocess(source, preOptions).then(processed => {
		callback(null, source, map, meta);
	}, err => callback(err)).catch(err => callback(err));
};