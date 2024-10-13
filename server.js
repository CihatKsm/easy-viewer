const { readFileSync, readdirSync } = require('node:fs');
const { join } = require('node:path');
require('colors');

/**
 * @typedef {Object} Scheme
 * @property {string} name The name of the scheme.
 * @property {string} file The file path of the scheme.
 * @property {string} html The HTML content of the scheme.
 */
const schemeStore = new Map();

/**
 * @typedef {Object} ConfigStore
 * @property {string} key The key of the config.
 * @property {string} value The value of the config.
 */
const configStore = new Map();

/**
 * ConfigKeys: The keys for the configuration.
 */
const ConfigKeys = {
    /**
     * VIEWS: The views directory path.
     */
    VIEWS: 'views',
    /**
     * DEFAULT_SCHEME: The default scheme for rendering HTML files.
     */
    DEFAULT_SCHEME: 'default_scheme',
    /**
     * IGNORE_ERRORS: Ignore errors while rendering HTML files.
     */
    IGNORE_ERRORS: 'ignore_errors'
}

/**
 * UseRender: Middleware for Express.js to render HTML files.
 * 
 * @param {import('express').Request} request This is the request object.
 * @param {import('express').Response} response This is the response object.
 * @param {import('express').NextFunction} next This is the next function.
 */
function UseRender(request, response, next) {
    delete response.render;
    
    if (!request) {
        const error = new Error('Error: Request is not defined.');
        console.error('▲ easy-viewer: '.cyan + error.message.red);
        return process.exit(1);
    }

    const method = request.method;
    if (method !== 'GET') {
        request.next();
        return;
    }

    const _data = request?.data || {};
    const _scheme = _data?._scheme || configStore.get(ConfigKeys.DEFAULT_SCHEME)?.value;

    const rooter = new Rooter(request);
    const render = (file_name, data) => rooter.render(file_name, { ..._data, ...(data || {}) }, _scheme)
    response.render = render;

    next();
}

class Config {
    set(key, value) {
        if (!Object.values(ConfigKeys).includes(key)) {
            console.error('▲ easy-viewer: '.cyan + `Invalid key: ${key}`.red);
        } else {
            if (configStore.has(key)) configStore.delete(key);
            configStore.set(key, { key, value });
        }
    }

    get(key) {
        return (configStore.get(key) || {})?.value;
    }
}

class SchemeManager {
    load(schemeDirectory) {
        const schemes = readdirSync(schemeDirectory).filter(file => file.endsWith('.html'));
        for (const scheme of schemes) {
            const name = scheme.split('.')[0];
            const filePath = join(schemeDirectory, scheme);
            const html = readFileSync(filePath, 'utf8').replace(/\r\n/g, '');
            schemeStore.set(name, { name, file: filePath, html });
        }
    }

    get(name) {
        return schemeStore.get(name) || null;
    }

    get_all() {
        return Array.from(schemeStore.values());
    }
}

class Rooter {
    constructor(request) {
        if (!request) throw new Error('Error: Request is not defined.');
        this.request = request;
        this.errors = [];
    }

    async render(file_name, data = {}, scheme = configStore.get(ConfigKeys.DEFAULT_SCHEME)?.value) {
        this.request.res.setHeader('Content-Type', 'text/html');
        data = { ...data, ...(this.request?.data || {}) };

        let html = await this.getHtml(file_name, data, scheme);
        if (this.errors.length > 0 && !configStore.get(ConfigKeys.IGNORE_ERRORS)?.value) {
            console.error('▲ easy-viewer: '.cyan + 'Page not rendered because of errors, please first fix the errors.'.yellow);
            this.errors.forEach(error => console.error('▲ easy-viewer: '.cyan + (error.stack).red));
            return this.json({ status: 500, message: 'Internal Server Error.' });
        }
        return this.request.res.send(html);
    }

    async getHtml(file_name, data = {}, scheme) {
        const schemeType = typeof scheme;
        if (schemeType == 'string') scheme = new SchemeManager().get(scheme) || null;
        else if (schemeType == 'object') scheme = new SchemeManager().get(scheme?.name) || null;

        if (!data || typeof data !== 'object') data = {};

        let html = scheme?.html;
        if (!html || html.length === 0) {
            return this.json({ status: 404, message: 'Html scheme not found.' });
        }

        data.file_name = file_name;

        return this.run(data, html);
    }

    async json(data = {}) {
        const jsonData = JSON.stringify(data);
        this.request.res.setHeader('Content-Type', 'application/json');
        return this.request.res.json(jsonData);
    }

    async file(location) {
        let data;
        try { data = readFileSync(join(__dirname, location), 'utf8'); }
        catch (error) { data = error.message; }
        return data;
    }

    run(data, content) {
        const config = new Config();

        data.include = (file) => {
            let includingHtml;
            const views_dir = config.get(ConfigKeys.VIEWS);
            const dir = join(views_dir, `${file}.html`);
            try { includingHtml = readFileSync(dir, 'utf8'); }
            catch (error) { return null; }
            return this.run(data, includingHtml);
        };

        let codes = [];
        for (let i = 0; i < content?.length; i++) {
            const start = content.slice(i, i + 2) === '{{';
            const endIndex = content.slice(i + 2).indexOf('}}');
            if (!start || endIndex === -1) continue;

            const key = content.slice(i + 2, i + endIndex + 1).trim();
            const html = content.slice(i, i + endIndex + 4);
            const code = key.replace(/\n\s*/g, '');
            codes.push({ html, code });
        }

        codes = codes.map(item => {
            let code = item.code;
            code = code.replace(/(let|const|var) /g, 'global.');
            return { ...item, code };
        });

        Object.keys(data).forEach(key => global[key] = data[key]);

        codes = codes.map(item => {
            let output = null;
            try {
                output = eval(item?.code);
                if (['object', 'function', 'undefined', 'null'].includes(typeof output)) output = null;
            } catch (error) {
                this.errors.push(error);
            }
            return { ...item, output };
        });

        codes.forEach(item => content = content.replace(item.html, item.output || ''));
        return content;
    }
}

module.exports = { UseRender, Rooter, SchemeManager, Config, ConfigKeys };