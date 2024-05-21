const helpers = require('../modules/helpers');

describe('getTagAttributes', () => {
    test('should return an empty object for a tag with no attributes', () => {
        const tagString = '<div />';
        const result = helpers.getTagAttributes(tagString);
        expect(result).toEqual({});
    });

    test('should return an object with a single attribute', () => {
        const tagString = '<div class="container" />';
        const result = helpers.getTagAttributes(tagString);
        expect(result).toEqual({ class: 'container' });
    });

    test('should return an object with multiple attributes', () => {
        const tagString = '<input type="text" id="username" name="user" />';
        const result = helpers.getTagAttributes(tagString);
        expect(result).toEqual({
            type: 'text',
            id: 'username',
            name: 'user'
        });
    });

    test('should handle attributes with spaces correctly', () => {
        const tagString = '<img src="https://example.com/image.jpg" alt="An example image" />';
        const result = helpers.getTagAttributes(tagString);
        expect(result).toEqual({
            src: 'https://example.com/image.jpg',
            alt: 'An example image'
        });
    });

    test('should handle tags with new lines and extra spaces', () => {
        const tagString = `
            <a
                href="https://example.com"
                title="Example Link"
            />
        `;
        const result = helpers.getTagAttributes(tagString);
        expect(result).toEqual({
            href: 'https://example.com',
            title: 'Example Link'
        });
    });
});

describe('wrapOutput', () => {
    test('should wrap markup with specified tag and class without args', () => {
        const result = helpers.wrapOutput('div', 'test-class', 'Hello, World!', null);
        expect(result).toEqual('<div class="test-class">Hello, World!</div>');
    });

    test('should wrap markup with specified tag, class, and args', () => {
        const args = { id: 123, name: 'John Doe' };
        const result = helpers.wrapOutput('span', 'info', 'User Info', args);
        expect(result).toEqual('<span class="info" data-props=\'{"id":123,"name":"John Doe"}\'>User Info</span>');
    });

    test('should handle empty className and args', () => {
        const result = helpers.wrapOutput('p', '', 'No class or args', null);
        expect(result).toEqual('<p class="">No class or args</p>');
    });

    test('should correctly escape quotes in args', () => {
        const args = { text: 'He said, "Hello, World!"' };
        const result = helpers.wrapOutput('div', 'quote', 'Quote', args);
        expect(result).toEqual('<div class="quote" data-props=\'{"text":"He said, \\"Hello, World!\\""}\'>Quote</div>');
    });
});