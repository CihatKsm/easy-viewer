const express = require('express');
const { Rooter, Config, Schemes } = require('../server');
const app = express()
const port = 3000;

const html_dir = __dirname + '/html';
Config.set.dir('views', html_dir);

const schemes_dir = __dirname + '/schemes';
Schemes.set('app', schemes_dir + '/app.html');

app.get('/', (req, res) => {
    const rooter = new Rooter(req, res);
    rooter.render('index', {}, Schemes.get('app'));
})

app.listen(port, () => {
    console.log(`Express: http://localhost:${port}`)
})