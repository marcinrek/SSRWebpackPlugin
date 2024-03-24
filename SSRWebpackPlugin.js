const {ConcatSource} = require('webpack-sources');
const path = require('path');
const chalk = require('chalk');
const helpers = require('./modules/helpers');
const bundler = require('./modules/bundler');

class SSRWebpackPlugin {
    /**
     * Process plugin options
     * @param {object} options plugin options
     */
    constructor(options) {
        this.data = {};
        this.data.initialRun = true;
        this.options = options || {};

        // Default options
        !this.options?.ssrTagRegex ? (this.options.ssrTagRegex = /<SSR (.+?) \/>/g) : this.options.ssrTagRegex;
        this.options.createDataProps = this.options?.createDataProps ? this.options.createDataProps : false;

        // Print options
        console.log(chalk.magenta(`[SSRWebpackPlugin] Initiated with following options: `));
        Object.keys(this.options).forEach((key) => {
            console.log(chalk.magenta('|-'), chalk.magenta(key), ':', chalk.cyan(this.options[key]));
        });
        console.log(chalk.magenta('\\-----'));
    }

    /**
     * Plugin contents
     */
    apply(compiler) {
        // Get the file that triggered the bundle and look for dependencies
        this.modifiedFile = undefined;
        this.moduleDependencies = undefined;
        compiler.hooks.watchRun.tap('SSRWebpackPlugin', async (comp) => {
            if (comp.modifiedFiles) {
                this.modifiedFile = [...comp.modifiedFiles][0];
                console.log(chalk.magenta(`[SSRWebpackPlugin] Updated file: ${chalk.cyan(this.modifiedFile)}`));
            }
            this.moduleDependencies = await helpers.getModuleDependencies('src/components/', this.modifiedFile);
        });

        // All compilations done
        compiler.hooks.done.tap('SSRWebpackPlugin', () => {
            this.data.initialRun && console.log(chalk.magenta(`[SSRWebpackPlugin] Initial complilation run finished`));
            this.data.initialRun = false;
        });

        // Replace tag on html page compile
        compiler.hooks.compilation.tap('SSRWebpackPlugin', (compilation) => {
            compilation.hooks.processAssets.tapAsync(
                {
                    name: 'SSRWebpackPlugin',
                    stage: compilation.PROCESS_ASSETS_STAGE_OPTIMIZE_TRANSFER,
                },
                async (assets, callback) => {
                    for await (const assetName of Object.keys(assets)) {
                        if (assetName.endsWith('.html')) {
                            const assetSource = assets[assetName];
                            const assetPath = path.dirname(assetName);

                            let modifiedSource = assetSource.source();

                            /**
                             * Modify the page source by replacing the ssrTagRegex with the default function call result
                             */
                            modifiedSource = await helpers.replaceAsync(modifiedSource, this.options.ssrTagRegex, async (_) => {
                                try {
                                    const ssrNodeArgs = helpers.getTagAttributes(_);

                                    console.log(chalk.magenta(`[SSRWebpackPlugin] Using the folowing attributes in ${chalk.cyan(assetName)}:`));
                                    console.log(ssrNodeArgs);

                                    // Get absolute entry file path
                                    const filePath = path.resolve(assetPath, ssrNodeArgs['src']);

                                    // Get args to be passed to the default export
                                    const args = helpers.requireUncached(path.resolve(assetPath, ssrNodeArgs['args'])).default;

                                    console.log(chalk.magenta(`[SSRWebpackPlugin] Using the folowing arguments in ${chalk.cyan(assetName)}:`));
                                    console.log(args());

                                    // Wait for the bundle to finish and get the bundle path
                                    const bundleFilePath = await bundler.evaluateModule(
                                        helpers.pathToPosix(filePath),
                                        helpers.checkIsRebuldRequired(this.moduleDependencies, filePath, this.data.initialRun),
                                    );

                                    // Require the bundle
                                    const serverBundle = helpers.requireUncached(bundleFilePath);
                                    const serverFunction = serverBundle.default;

                                    // Wait for the default to execute as it is async
                                    const serverCallResult = await (async () => {
                                        try {
                                            const result = await serverFunction(args());
                                            return result;
                                        } catch (error) {
                                            console.error('Error executing server function:', error);
                                        }
                                    })();

                                    // Return the default function output
                                    return helpers.wrapOutput(
                                        ssrNodeArgs['wrapperTag'],
                                        ssrNodeArgs['wrapperClass'],
                                        serverCallResult,
                                        this.options.createDataProps ? args() : null,
                                    );
                                } catch (error) {
                                    console.error(`Error requiring file: ${error}`);
                                    return '';
                                }
                            });

                            // Replace the original html file contents with the modified contens
                            assets[assetName] = await new ConcatSource(await modifiedSource);
                        }
                    }

                    callback();
                },
            );
        });
    }
}

module.exports = SSRWebpackPlugin;
