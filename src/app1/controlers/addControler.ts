import { express, error } from '../../_main/server';
import { addViewModel } from '../viewModels/addViewModel';
import { User } from '../../_main/entities/user';

export default express.Router()
    .get ('/addition', (req, res) => { res.render('addForm', ); }) // A supprimer ?
    .post('/addition', (req, res) => { res.render('addView', new addViewModel(Number(req.body.a), Number(req.body.b))); })
    .get ('/appError', (req, res, next) => { next(new error.DbAccessDenied()); })
    .get ('/internalError', async (req, res, next) => {
      try {
        const users = await User.createQueryBuilder().select('sdsd').getMany();
        res.render('index');
      } catch (e) { next(e); }
    });
