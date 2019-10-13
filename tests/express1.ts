import express from 'express';
import Twig from 'twig';

const app = express();

app.use((req, res, next) => {
  res['render'] = (view, vm) => {
    vm.test2 = 'test2';
    Twig.renderFile(`./views/${view}.twig`, vm, (err, html) => {
      if (err) next(err);
      else res.end(html);
    });
  };
  next();
});

app.get('/', (req, res) => {
  console.log('get /');
  res.render('test', { test: 'Value' });
});

app.listen(4200);
