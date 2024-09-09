const { readFileSync, readdirSync } = require('node:fs');
const { join } = require("path");

/**
 * @typedef {Object} Scheme
 * @property {String} name The name of the scheme.
 * @property {String} file The file path of the scheme
 */
const schemeStore = new Map();

const Schemes = {
    /**
     * This operation is used to get a scheme.
     * 
     * @param {String} name Name of the scheme.
     * @param {String} file File path of the scheme.
     * @param {Document} html HTML content of the scheme.
     * @returns 
     */
    set: (name, file, html) => schemeStore.set(name, { name, file: file?.replace(/\\/g, '/') }),
    /**
     * This operation is used to get a scheme.
     * 
     * @param {Array} schemes Schemes is an array of schemes.
     * @returns 
     */
    setAll: (schemes) => schemes.forEach(scheme => this.Schemes.set(scheme?.name, scheme?.file)),
    /**
     * This operation is used to get a scheme.
     * 
     * @param {String} name Name of the scheme.
     * @returns 
     */
    get: (name) => schemeStore.get(name),
    /**
     * This operation is used to get all schemes.
     * 
     * @returns 
     */
    getAll: () => schemeStore,
}

const configStore = new Map();

const Config = {
    set: {
        dir: (name, dir) => configStore.set(name, dir.replace(/\\/g, '/')),
    },
    get: (key) => configStore.get(key),
}

/**
 * This is the main file of the application.
 * @param {import('express').Request} request This is the request object.
 * @param {import('express').Response} response This is the response object.
 */
class Rooter {
    constructor(request, response) {
        this.request = request;
        this.response = response;
    }

    /**
     * This operation is used to render HTML content.
     * 
     * @param {String} file_name File name. Example: index, login, register, etc.
     * @param {Object} data Data. Example: { title: 'Rooter', description: 'Rooter is a web application.' }
     * @param {Scheme} scheme Scheme. Example: schemes.webpage, schemes.customBody, schemes.none
     * @returns 
     */
    render(file_name, data, scheme) {
        if (!this.request || !this.response) return null;
        this.response.setHeader('Content-Type', 'text/html');
        const html = this.get_html(file_name, data, scheme);
        return this.response.send(html);
    }

    /**
     * This operation is used to output JSON content.
     * 
     * @param {Object|Array} data Data. Example: { status: 200, message: 'OK' }
     * @returns
     */
    json(data) {
        const json = JSON.stringify(data)
        this.response.setHeader('Content-Type', 'application/json');
        return this.response.json(json);
    }

    /**
     * This operation is used to output file content.
     * 
     * @param {String} location File location.
     * @returns 
     */
    file(location) {
        let data;
        try { data = readFileSync(join(join(__dirname), location), 'utf8'); }
        catch (error) { data = 'File not found.'; }

        this.response.setHeader('Content-Type', `text/${location.split('.').pop()}`);
        return this.response.send(data);
    }

    /**
     * This operation is used to get HTML content.
     * 
     * @param {String} file_name File name. Example: index, login, register, etc.
     * @param {Object} data Data. Example: { title: 'Rooter', description: 'Rooter is a web application.' }
     * @param {Scheme} scheme Scheme. Example: schemes.webpage, schemes.customBody, schemes.none
     * @returns 
     */
    get_html(file_name, data, scheme) {
        if (!scheme) scheme = null;
        if (typeof scheme !== 'object') scheme = null;
        if (!scheme?.name || !scheme?.file) scheme = null;

        scheme.html = readFileSync(scheme.file, 'utf8');

        data.app = {};
        const scripts_dir = Config.get('scripts') ? join(Config.get('scripts')) : null;
        if (scripts_dir) {
            const scriptsFiles = readdirSync(scripts_dir).sort((a, b) => a.localeCompare(b)).map(file => `/javascript/${file}`).filter(f => f.endsWith('.js'));
            data.app.scripts = scriptsFiles.map(path => `<script src="${path}"></script>`).join('');
        }

        const include = (file_dir) => this.get_html(readFileSync(join(views_dir, file_dir + '.html'), 'utf8'), { ...data, include });

        const views_dir = Config.get('views') ? join(Config.get('views')) : null;
        if (views_dir) {
            data.app.content = readFileSync(join(views_dir, file_name + '.html'), 'utf8');
            data.app.include = include;
        }

        return this.output_html(scheme?.html, data);
    }

    /**
     * This operation is used to output HTML content.
     * 
     * @param {Document} html This is HTML content.
     * @param {Object} data This is data. Example: { title: 'Rooter', description: 'Rooter is a web application.' }
     * @returns 
     */
    output_html(html, data) {
        if (!html) return null;

        const host_url = 'http://' + this.request.headers["host"];
        let codes = this.codes_finder(html, data);

        // Replace all definitions.
        codes = codes.map(item => ({ ...item, code: this.definitions_fixer(item.code) }));

        // Replace all data keys.
        codes = codes.map(item => ({ ...item, code: this.data_keys_replacer(data, item.code) }));

        // Sort codes.
        codes = [...codes.filter(item => item.code.startsWith('data.app.')), ...codes.filter(item => !item.code.startsWith('data.app.'))];

        // Replace all codes.
        codes.forEach(item => {
            const output = this.code_output(data, item?.code);
            html = html.replace(item.html, output ? output : '');
            codes = codes.filter(code => code.code !== item.code);
        });

        const codes_control = this.codes_finder(html, data);
        if (codes_control.length > 0) html = this.output_html(html, data);

        // Replace all scripts includes.
        const scriptsInclues = html?.match(/<script src=".*"><\/script>/g) || [];
        for (let { script, src } of scriptsInclues) html = html.replaceAll(script, `<script src="${host_url}/${src}"></script>`);

        return html.replace(/\n\s*/g, '');
    }

    /**
     * This operation is used to find all codes in the HTML content.
     * 
     * @param {Document} html This is HTML content.
     * @returns
     */
    codes_finder(html, data) {
        const codes = [];;

        for (var i = 0; i < html.length; i++) {
            const startIndex = html[i] + html[i + 1] == '{{';
            const endIndex = html.slice(i + 1).indexOf('}}');
            if (!startIndex || endIndex == -1) continue;

            const key = html.slice(i + 2, i + endIndex + 1).trim();
            const value = html.slice(i, i + endIndex + 3);

            let code = key.replaceAll('\r\n', '').replace(/\n\s*/g, '');
            code = this.data_keys_replacer(data, code);
            code = this.definitions_fixer(code);

            codes.push({ html: value, code });
        }

        return codes;
    }

    /**
     * This operation is used to fix definitions.
     * 
     * @param {String} code This is code. Example: 'let title = data.title;'
     * @returns 
     */
    definitions_fixer(code) {
        const definitions = ['let', 'const', 'var'];
        for (let definition of definitions) code = code.replaceAll(definition + ' ', 'data.');
        return code;
    }

    /**
     * This operation is used to replace all data keys.
     * 
     * @param {Object} data This is data. Example: { title: 'Rooter', description: 'Rooter is a web application.' }
     * @param {String} code This is code. Example: 'data.title'
     * @returns
     */
    data_keys_replacer(data, code) {
        const dataKeys = Object.keys(data);
        for (let key of dataKeys) {
            if (!code.includes(key)) continue;
            code = code.replaceAll(key, 'data.' + key);
        }
        
        return code;
    }

    /**
     * This operation is used to output code.
     * 
     * @param {Object} data This is data. Example: { title: 'Rooter', description: 'Rooter is a web application.' }
     * @param {String} code This is code. Example: 'data.title'
     * @returns
     */
    code_output(data, code) {
        let value = null;
        try {
            value = eval(code);
            const isPromise = value instanceof Promise;
            if (isPromise) {
                console.log('▲ easy-viewer: '.cyan + 'Warning: '.yellow + 'The code is a promise. Please use async/await.');
            } else {
                const valueType = typeof value;
                if (!valueType) value = null;

                const problemTypes = ['object', 'undefined', 'null'];
                if (problemTypes.includes(valueType)) value = null;
            }
        } catch (error) {
            value = null;
            console.log('▲ easy-viewer: '.cyan + 'Error: '.red + error);
        }

        return value;
    }
}

module.exports = { Rooter, Schemes, Config };