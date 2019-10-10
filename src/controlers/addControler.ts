import { express, Errors, twigVm } from '../server'
import { addViewModel } from '../models/addViewModel'

export default express.Router()
    .post('/addition', (req, res) => { res.render('addView', twigVm(new addViewModel(Number(req.body.a), Number(req.body.b)))); })
    .get('/appError', (req, res, next) => { next(new Errors.appError(403, 'Interdit !!!')); })
    .get('/internalError', (req, res, next) => {
        // const con = sqljs.createConnection({ host: 'localhost', database: 'thierry', user: 'root', password: 'TB04011966' });
        // con.query('SELECT * FROM xxxx', (err, result, fields) => {
        //     if (err) { next(err); }
        //     else res.end();
        // });
    })
