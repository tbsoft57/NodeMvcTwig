import { appError } from '../_main/errors';

export class myApp1Error extends appError { constructor() { super(200, 500, 'Erreur de test App1 !', 'myApp1Error'); } }
