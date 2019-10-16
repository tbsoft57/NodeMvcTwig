import { appError } from '../errors';
export class myApp1Error extends appError { constructor() { super(500, 'Erreur de test App1 !', 'myApp1Error'); } }
