const {ConcatSource} = require('webpack-sources');
const path = require('path');
const chalk = require('chalk');
const helpers = require('./modules/helpers');
const bundler = require('./modules/bundler');

class WebpackSSRPlugin {
    /**
     * Process plugin options
     * @param {object} options plugin options
     */
    constructor(options) {
        this.data = {};
        this.data.initialRun = true;
        this.options = options || {}; 

        // Default options
        this.options.ssrTagRegex = !this.options?.ssrTagRegex ? /<SSR (.+?) \/>/g : this.options.ssrTagRegex;
        this.options.createDataProps = !this.options?.createDataProps ? false : this.options.createDataProps;
        this.options.verbose = !this.options?.verbose ? false : true;
        this.options.metaDisplay = !this.options?.metaDisplay ? false : true;
        this.options.metaFile = !this.options?.metaFile ? false : true;
        this.options.envFile = !this.options?.envFile ? '.env' : this.options.envFile;

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

                                    // Handle data-props print override
                                    let printDataProps = this.options.createDataProps;
                                    if (ssrNodeArgs?.["printdataprops"]) {
                                        printDataProps = ssrNodeArgs["printdataprops"] === "true" ? true : false;
                                    } 

                                    this.options.verbose && console.log(chalk.magenta(`[SSRWebpackPlugin] Using the folowing attributes in ${chalk.cyan(assetName)}:`));
                                    this.options.verbose && console.log(ssrNodeArgs);

                                    // Get absolute entry file path
                                    const filePath = path.resolve(assetPath, ssrNodeArgs['src']);

                                    // Get args to be passed to the default export
                                    const args = helpers.requireUncached(path.resolve(assetPath, ssrNodeArgs['args'])).default;
                                    const argsExec = args(this.options.envFile);

                                    this.options.verbose && console.log(chalk.magenta(`[SSRWebpackPlugin] Using the folowing arguments in ${chalk.cyan(assetName)}:`));
                                    
                                    // Append args
                                    argsExec['_'] = {
                                        fileName: assetName,
                                    };
                                    
                                    // Display the args
                                    this.options.verbose && console.log(argsExec);

                                    // Wait for the bundle to finish and get the bundle path
                                    const bundleFilePath = await bundler.evaluateModule(
                                        helpers.pathToPosix(filePath),
                                        helpers.checkIsRebuldRequired(this.moduleDependencies, filePath, this.data.initialRun),
                                        this.options.metaDisplay,
                                        this.options.metaFile,
                                        ssrNodeArgs?.esmFunction ? 'esm' : 'cjs'
                                    );

                                    // Require the bundle - important to keep it uncached
                                    const serverBundle = ssrNodeArgs?.esmFunction ? await import(`file://${bundleFilePath}?t=${Date.now()}`) : helpers.requireUncached(bundleFilePath);
                                    const serverFunction = serverBundle.default?.[ssrNodeArgs.esmFunction] || serverBundle.default;

                                    // Wait for the default to execute as it is async
                                    const serverCallResult = await (async () => {
                                        try {
                                            // Spread the object to attributes OR pass as a single attribute
                                            const result = ssrNodeArgs?.spreadArgs ? await serverFunction(...Object.values(argsExec)) : await serverFunction(argsExec);
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
                                        printDataProps ? argsExec : null,
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

module.exports = WebpackSSRPlugin;
