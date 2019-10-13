export class appError extends Error {
  errno: number;
  httpStatus: number;
  constructor(err: number, statusCode: number, message: string, name: string) {
      super();
      this.errno = err;
      this.httpStatus = statusCode;
      this.message = message;
      this.name = name;
  }
}
export function getAppError(err): Error {
  switch (err.code) {
      case 'ENOTFOUND':
      case 'ER_ACCESS_DENIED_ERROR': return new DbAccessDenied();
      case 'ER_DUP_ENTRY': return new DuplicateEntry();
      default:
        if (err.message.includes('Failed to lookup view')) return new Error404();
        return null;
  }
}

export class InternalServerError extends appError { constructor() { super(0, 500, 'Erreur sur serveur!', 'InternalServerError'); } }
export class NotFound extends appError { constructor() { super(1, 404, 'Aucune donnée trouvée!', 'NotFound'); } }
export class NotUpdated extends appError { constructor() { super(2, 409, 'Aucune mise à jour effectuée!', 'NotUpdated'); } }
export class NotInserted extends appError { constructor() { super(3, 409, 'Aucun ajout effectuée!', 'NotInserted'); } }
export class NotDeleted extends appError { constructor() { super(4, 409, 'Aucune suppression effectuée!', 'NotDeleted'); } }
export class NotValidRestMethod extends appError { constructor() { super(5, 405, 'Erreur method REST!', 'NotValidRestMethod'); } }
export class NotValidApiUrl extends appError { constructor() { super(6, 405, 'Erreur ApiUrl inexistante!', 'NotValidApiUrl'); } }
export class NotConnected extends appError { constructor() { super(7, 401, 'Vous n\'êtes pas connectée!', 'NotConnected'); } }
export class DbAccessDenied extends appError { constructor() { super(8, 403, 'Connection à la base de donnée refusée!', 'DbAccessDenied'); } }
export class NoValidXrsfTocken extends appError { constructor() { super(9, 403, 'XrsfTocken non valide!', 'NoValidXrsfTocken'); } }
export class NoValidUser extends appError { constructor() { super(10, 401, 'Utilisateur non valide!', 'NoValidUser'); } }
export class DuplicateEntry extends appError { constructor() { super(11, 409, 'Enregistrement déjà existant!', 'DuplicateEntry'); } }
export class Error404 extends appError { constructor() { super(12, 404, 'Page inexistante!', 'Error404'); } }
