const express = require('express');
const { UseRender, SchemeManager, Config, ConfigKeys } = require('../server');
const app = express()
const port = 3000;

const schemes = new SchemeManager();
schemes.load(__dirname + '/schemes');

const config = new Config();

// If you want to use the default scheme, you can set the scheme name to the DEFAULT_SCHEME key. 
config.set(ConfigKeys.VIEWS, __dirname + '/html');

// If you want to use the default scheme, you can set the scheme name to the DEFAULT_SCHEME key.
config.set(ConfigKeys.DEFAULT_SCHEME, 'app');

// If you want to ignore errors while rendering HTML files, you can set the value to true.
config.set(ConfigKeys.IGNORE_ERRORS, true);

app.use(UseRender);

app.get('/', (req, res) => {
    res.renderer('index', { title: 'Express' });
})

app.post('/', (req, res) => {
    console.log('Posted');
})

app.listen(port, () => {
    console.log(`Express: http://localhost:${port}`)
})