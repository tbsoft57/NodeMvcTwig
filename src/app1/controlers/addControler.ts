import { NodeMvcTwigServer, error, User } from '../../server';
import { addViewModel } from '../viewModels/addViewModel';

NodeMvcTwigServer.PublicRouter
  .get ('/addition', (req, res) => { res.render('addForm', ); })
  .post('/addition', (req, res) => { res.render('addView', new addViewModel(Number(req.body.a), Number(req.body.b))); })
  .get ('/appError', (req, res, next) => { next(new error.DbAccessDenied()); })
  .get ('/internalError', async (req, res, next) => {
    try {
      const users = await User.createQueryBuilder().select('sdsd').getMany();
      res.render('index');
    } catch (e) { e.fileName = module.filename + ':12'; next(e); }
  });
