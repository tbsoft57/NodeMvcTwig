export class appError extends Error {
  httpStatus: number;
  constructor(statusCode: number, message: string, name: string) {
      super();
      this.httpStatus = statusCode;
      this.message = message;
      this.name = name;
  }
}
export class InternalServerError extends appError { constructor(mess: string = 'Erreur sur serveur!') { super(500, mess, 'InternalServerError'); } }
export class Error404 extends appError { constructor() { super(404, 'Page inexistante!', 'NotFound'); } }
export class NotFound extends appError { constructor() { super(404, 'Aucune donnée trouvée!', 'NotFound'); } }
export class NotUpdated extends appError { constructor() { super(409, 'Aucune mise à jour effectuée!', 'NotUpdated'); } }
export class NotInserted extends appError { constructor() { super(409, 'Aucun ajout effectuée!', 'NotInserted'); } }
export class NotDeleted extends appError { constructor() { super(409, 'Aucune suppression effectuée!', 'NotDeleted'); } }
export class NotValidRestMethod extends appError { constructor() { super(405, 'Erreur method REST!', 'NotValidRestMethod'); } }
export class NotValidApiUrl extends appError { constructor() { super(405, 'Erreur ApiUrl inexistante!', 'NotValidApiUrl'); } }
export class NotConnected extends appError { constructor() { super(401, 'Vous n\'êtes pas connectée!', 'NotConnected'); } }
export class DbAccessDenied extends appError { constructor() { super(403, 'Connection à la base de donnée refusée!', 'DbAccessDenied'); } }
export class NoValidXrsfTocken extends appError { constructor() { super(403, 'XrsfTocken non valide!', 'NoValidXrsfTocken'); } }
export class NoValidUser extends appError { constructor() { super(401, 'Utilisateur non valide!', 'NoValidUser'); } }
export class DuplicateEntry extends appError { constructor() { super(409, 'Enregistrement déjà existant!', 'DuplicateEntry'); } }
