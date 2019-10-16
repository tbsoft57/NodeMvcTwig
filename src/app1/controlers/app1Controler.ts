import { NodeMvcTwigServer, error, User } from '../../server';
import { addViewModel } from '../viewModels/addViewModel';

NodeMvcTwigServer.PublicRouter
  .get ('/addition', (req, res) => { res.render('addForm'); })

  .post('/addition', (req, res) => {
    res.locals.vm = new addViewModel(req.body);
    res.render('addView');
  })

  .get ('/appError', (req, res, next) => { next(new error.DbAccessDenied()); })

  .get ('/internalError', async (req, res, next) => {
    try {
      const users = await User.createQueryBuilder().select('sdsd').getMany();
      res.render('index');
    } catch (err) {
      // tester les cas connus
      if      (err.message.includes('cas connu1')) next(new error.Error404());
      else if (err.message.includes('cas connu2')) next(new error.Error404());
      // Sinon on renvoi l'erreur inconnue en indiquant la source et la ligne
      else { err.fileName = module.filename + ':12'; next(err); }
    }
  });

NodeMvcTwigServer.PrivateRouter
  .get ('/private', (req, res) => { res.render('private', ); });
