export class appError extends Error {
    statusCode: number;
    message: string;
    constructor(statusCode: number, message: string) {
        super();
        this.statusCode = statusCode;
        this.message = message;
    }

}
export function getAppError(err: any) {
    switch (err.code) {
        case 'ENOTFOUND':
        case 'ER_ACCESS_DENIED_ERROR': return new MySqlAccessDenied();
        case 'ER_DUP_ENTRY': return new DuplicateEntry();
        // case 'ER_NO_SUCH_TABLE': return new DuplicateEntry();
        default: return null;
    }
}
export class InternalError extends appError { constructor() { super(500, 'Internal Error!!!'); } }
export class NotFoundError extends appError { constructor() { super(404, 'Page inexistante!!!'); } }
export class DuplicateEntry extends appError { constructor() { super(409, 'Enregistrement déjà existant!'); } }
export class MySqlAccessDenied extends appError { constructor() { super(403, 'Connection à la base de donnée refusée!'); } }
