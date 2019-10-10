import { express, Errors, twigVm } from '../server'
import { addViewModel } from '../viewModels/addViewModel'
import { User } from '../entities/user';

export default express.Router()
    .post('/addition', (req, res, next) => {
      res.render('addView', twigVm(new addViewModel(Number(req.body.a), Number(req.body.b))));
    })
    .get('/appError', (req, res, next) => { next(new Errors.appError(403, 'Interdit !!!')); })
    .get('/internalError', async (req, res, next) => {
      try {
        const users = await User.createQueryBuilder().select('sdsd').getMany();
        res.render('index', twigVm({}));
      } catch (e) { next(e); }
    })
