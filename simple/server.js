const express = require('express');
const { UseRender, SchemeManager, Config } = require('../server');
const app = express()
const port = 3000;

const schemes = new SchemeManager();
schemes.load(__dirname + '/schemes');

const config = new Config();
config.set('views', __dirname + '/html');

app.use((req) => { req.default_scheme = 'app'; req.next(); });
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