const path = require('path');
const madge = require('madge');

/**
 * Require an uncached version of the module
 * @description Clear module from cache and then return a require of that module
 * @param {string} module module path to require
 * @returns {any} required module
 */
const requireUncached = (module) => {
    delete require.cache[require.resolve(module)];
    return require(module);
};

/**
 * Convert path to posix format
 * @param {string} pathToConvert path to unify to posix format
 * @returns {string} posix formated path
 */
const pathToPosix = (pathToConvert) => {
    return pathToConvert ? pathToConvert.split(path.sep).join(path.posix.sep) : pathToConvert;
};

/**
 * Get module dependencies
 * @param {string} searchPatch path to search in
 * @param {string} modulePath path to the module to find deps for
 * @returns {resolve} module dependencies array
 */
const getModuleDependencies = async (searchPatch, modulePath) => {
    const dependenciesList = new Set();

    const moduleDependencies = await madge(searchPatch, {
        fileExtensions: ['js', 'jsx'],
    });

    // Unify path
    modulePath = pathToPosix(modulePath);

    // Add source module to include the main entry as a rebuild requirement
    dependenciesList.add(modulePath);

    // Helper function
    const weNeedToGoDeeper = (depArray) => {
        if (depArray.length) {
            depArray.forEach((dep) => {
                dependenciesList.add(dep);
                weNeedToGoDeeper(moduleDependencies.depends(dep));
            });
        }
    };

    if (modulePath) {
        const processedModulePath = modulePath.split(searchPatch)[1];
        weNeedToGoDeeper(moduleDependencies.depends(processedModulePath));
        return [...dependenciesList];
    } else {
        return [];
    }
};

/**
 * Replace where the replacement function is async
 * @param {string} str string to replace in
 * @param {regex} regex regex to use
 * @param {function} asyncFn replacement function
 * @returns {string} replaced string
 */
const replaceAsync = async (str, regex, asyncFn) => {
    const promises = [];
    str.replace(regex, (full, ...args) => {
        promises.push(asyncFn(full, ...args));
        return full;
    });
    const data = await Promise.all(promises);
    return str.replace(regex, () => data.shift());
};

/**
 * Check is rebuild required for given SSR entry
 * @param {Array} needRebuild list of modules that require rebuild
 * @param {string} ssrReplace current ssrModule to check agains
 * @param {boolean} initialRun initial run flag
 * @returns {boolean}
 */
const checkIsRebuldRequired = (needRebuild, ssrReplace, initialRun) => {
    if (initialRun) {
        return true;
    } else {
        ssrReplace = pathToPosix(ssrReplace);

        return needRebuild
            .map((modPath) => {
                return ssrReplace.indexOf(modPath) !== -1 ? true : false;
            })
            .filter((f) => f).length;
    }
};

/**
 * Get attributes and values from a xhtml tag string
 * @param {string} tagString tag to get the attributes from
 * @returns {object} an object where the key is the attribute and the value is the attribute value
 */
const getTagAttributes = (tagString) => {
    // Make the tag single line by
    const sanitizedTag = tagString
        .replace(/<[a-zA-Z]+/, '') // remove tag opening
        .replace('/>', '') // remove tag closing
        .replace(/\n/g, '') // remove new lines
        .replace(/\s+/g, ' ') // replace multiple white spaces with a single space
        .trim(); // trim

    // Strip all attributes
    const attrObj = {};
    sanitizedTag.match(/[a-zA-Z]+="(.+?)"/g).forEach((attr) => {
        attrObj[attr.split('=')[0].replace(/"|\n/g, '')] = attr.split('=')[1].replace(/"|\n/g, '');
    });

    // Return attributes object
    return attrObj;
};

/**
 *
 * @param {string} tag
 * @param {string} markup
 * @param {object} args
 * @returns {string}
 */
const wrapOutput = (tag, className, markup, args) => {
    return `<${tag} class="${className}" ${args ? `data-props='${JSON.stringify(args)}'` : ''}>${markup}</${tag}>`;
};

// Export helpers
module.exports = {
    requireUncached,
    pathToPosix,
    getModuleDependencies,
    replaceAsync,
    checkIsRebuldRequired,
    getTagAttributes,
    wrapOutput,
};
