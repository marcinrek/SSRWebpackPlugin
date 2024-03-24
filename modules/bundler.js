const path = require('path');
const chalk = require('chalk');
const esbuild = require('esbuild');

/**
 * Bundle SSR build
 * @description Build SSR bundle if it is required, if not just return the bundle file path
 * @param {string} filePath entry file to bundle
 * @param {boolean} buildRequired flag is the build required
 * @returns {string} bundle file path
 */
const evaluateModule = async (filePath, buildRequired) => {
    const bundleFileName = filePath.split('/')[filePath.split('/').length - 1].replace(/\.(js|jsx)$/, '.bundle.js');
    const outfilePath = filePath.split('/').slice(0, -1).join('/');

    if (buildRequired) {
        await esbuild.build({
            entryPoints: [filePath],
            platform: 'node',
            target: 'node18',
            bundle: true,
            minify: true,
            outfile: `${outfilePath}/${bundleFileName}`,
        });
    }

    if (buildRequired) {
        console.log(chalk.magenta(`[SSRWebpackPlugin] ESBUILD Rebuild file: ${chalk.cyanBright(filePath)} => ${chalk.cyan(path.join(path.dirname(filePath), bundleFileName))}`));
    } else {
        console.log(
            chalk.magenta(`[SSRWebpackPlugin] ESBUILD Rebuild not required for: ${chalk.cyanBright(filePath)} => ${chalk.cyan(path.join(path.dirname(filePath), bundleFileName))}`),
        );
    }
    return path.join(path.dirname(filePath), bundleFileName);
};

module.exports = {
    evaluateModule,
};
