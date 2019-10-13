const plate = require('plate');
const express = require('express');
const Loader = require('Loader');

const dir = __dirname + '/views';
const plugin = new Loader([dir]).getPlugin();
plate.Template.Meta.registerPlugin('loader', plugin);

const app = express();
app.register('.html', plate);
app.set('views', dir);
app.set('view engine', 'html');
app.get('/', (req, res) => { res.render('index', { layout: false, title: 'Plate Example' }); });
app.listen(4200);

