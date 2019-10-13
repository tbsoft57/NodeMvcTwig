import express from 'express';

const app = express();

app.engine('twig', (filePath, options, callback) => {
  const rendered = 'testRender';
  return callback(null, rendered);
});

app.set('views', [__dirname + '/views1', __dirname + '/views']);
app.set('view engine', 'twig');

app.get('/', (req, res) => {
  console.log('get /');
  res.render('test', { test1: 'Value' });
});

app.listen(4200);
