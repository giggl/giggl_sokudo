const {readFileSync, writeFileSync} = require('fs');

const [releaseVersion] = process.argv.slice(2);
const packageData = JSON.parse(readFileSync('./package.json', 'utf-8'));

writeFileSync(
	'./package.json',
	JSON.stringify({
		...packageData,
		version: releaseVersion,
	})
);