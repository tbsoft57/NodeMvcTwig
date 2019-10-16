import { NodeMvcTwigServer } from '../../server';
import { addViewModel } from '../../app1/viewModels/addViewModel';

NodeMvcTwigServer.PublicRouter
  .get ('/',         (req, res)       => { res.render('index'); })
  .get ('/index',    (req, res)       => { res.render('index'); })
  .get ('/home',     (req, res)       => { res.render('index'); })
  .get ('/error',    (req, res)       => { res.render('error'); })
  .get ('/settings', (req, res)       => { res.render('settings', ); })
  .get ('/login',    (req, res)       => { res.render('login', ); })
  .get ('/logout',   (req, res)       => { res.render('logout', ); })

  .post('/login',    (req, res, next) => { NodeMvcTwigServer.login(req, res , next); })
  .post('/logout',   (req, res, next) => { NodeMvcTwigServer.logout(req, res, next); });
