const path = require('path');

module.exports = {
    testEnvironment: 'jsdom',
    testMatch: ['**/*.spec.js'],
    moduleDirectories: ['node_modules', path.join(__dirname, 'src/modules'), '/']    
};
