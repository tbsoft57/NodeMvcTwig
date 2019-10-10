import express from 'express';
import twig from 'twig';
import socketIO from 'socket.io';
import appControlers from './controlers/addControler';
import fs from 'fs';
import watchr from 'watchr';
import * as bodyparser from 'body-parser';
import * as Errors from './Error';
import { v4 as uuid } from 'uuid';
import { createConnection, Connection, ConnectionOptions } from 'typeorm';
import { environment } from './_environments/backend';
export { express, twig, fs, Errors };
export class Server {
  public static devMode = (process.env.NODE_ENV == 'DEVELOPMENT');
  private static debugStart: number = (process.env.NODE_ENV == 'DEVELOPMENT')? 0:-1;
  private static debugScope: string= environment.appName;
  private static connectionPool;
  public static async start(sqlServer = process.env.NODE_SQLSERVER || 'sqljs', port = process.env.NODE_PORT || '4201', app = express()) {
    this.debugLog('NodeMvcTwig:start', `start(${sqlServer}, ${port})`);
    await fs.writeFile('pid', process.pid, (err) => { if (err) { console.log('Erreur sur await fs.writeFile(pid, process.pid):') ; console.log(err); }});
    await this.createConnectionPool(sqlServer);
    twig.cache(!this.devMode);
    app.engine('twig', twig.__express)
       .set('view engine', 'twig')
       .set('views', __dirname + '/views')
       .use(express.static('static'))
       .use(bodyparser.urlencoded({ extended: true }))
       .use(appControlers)
       .get('*', (req, res, next) => this.staticTwigViews(req, res, next))
       .use((err, req, res, next) => this.errorHandler(err, req, res, next))
       .get('*', (req, res)       => this.error404Handler(res))
    const httpServer = app.listen(port, () => { console.log(`${environment.appName} listening on http://localhost:${port}`); })
    let IoListener;
    if (this.devMode) {
      IoListener = socketIO.listen(httpServer);
      IoListener.sockets.on('connection', (socket) => { socket.emit('browserReload', runCode); });
      watchr.open('static',    () => { getNewRunCode(); IoListener.sockets.emit('browserReload', runCode); }, () => {});
      watchr.open('src/views', () => { getNewRunCode(); IoListener.sockets.emit('browserReload', runCode); }, () => {});
    }
    process.on('SIGINT',  () => { this.closeServer(httpServer, IoListener); });
    process.on('SIGUSR1', () => { this.activateDebug(); });
    this.handleCrontab();
    if (process.send) process.send('ready');
  }
  private static staticTwigViews(req, res, next) {
    if (req.url === '/') { res.render('index', twigVm({})); }
    else {
        const file = __dirname + '/views/' + req.url + '.twig';
        fs.stat(file, function (err, stat) {
            if (err == null) { res.render(file, twigVm({})); }
            else { next(); }
        });
    };
  }
  private static errorHandler(err, req, res, next) {
    res.status(err.statusCode | 500);
    if (!err.statusCode) {
        const e = Errors.getAppError(err);
        if (e) { err = e; }
        else {
          console.error(err);
          err = (this.devMode)? new Errors.appError(500, err.message): new Errors.InternalError();
        }
    }
    res.render('error', twigVm(err));
  }
  private static error404Handler(res) { res.status(404); res.render('error', twigVm(new Errors.NotFoundError())); }
  private static closeServer(httpServer, IoListener, error = false) {
    console.log('\nSIGINT signal received');
    if (IoListener) { IoListener.close(); console.log('IoListener Stoped'); }
    httpServer.close(); console.log('httpServer Stoped');
    this.connectionPool.close()
      .then(() => { console.log('DataBase Closed'); })
      .catch((err) => { console.error(err); process.exit(1);
    });
    process.exit(0);
  }
  private static async createConnectionPool(sqlServer: string) {
    const config = environment.ormconfig;
    switch (sqlServer) {
      case 'mssql':
        config.host = process.env.MSSQL_HOST;
        config.port = process.env.MSSQL_PORT;
        config.user = process.env.MSSQL_USER;
        config.pass = process.env.MSSQL_PASS;
        break;
      case 'mysql':
        config.host = process.env.MYSQL_HOST;
        config.port = process.env.MYSQL_PORT;
        config.user = process.env.MYSQL_USER;
        config.pass = process.env.MYSQL_PASS;
        break;
      case 'pgsql':
        config.host = process.env.PGSQL_HOST;
        config.port = process.env.PGSQL_PORT;
        config.user = process.env.PGSQL_USER;
        config.pass = process.env.PGSQL_PASS;
        break;
    }
    this.connectionPool = await createConnection(config as ConnectionOptions);
  }
  private static activateDebug() {
    this.debugStart = Date.now();
    console.log('Debug Starts for 1 hour');
  }
  private static handleCrontab() {
    setInterval(() => {
      // Crontab 1: handleDebugStart
      if (this.debugStart > 0 && (Date.now() - this.debugStart) > 3600000) {
        this.debugScope = 'No Debug';
        this.debugStart = -1;
        console.log('Debug Ends');
      // Crontab 2: TODO

    }}, 10000);
  }
  public static debugLog(scope: string, mess: string) {
    if (this.debugStart >= 0) {
      scope = environment.appName + ':' + scope;
      if (scope.includes(this.debugScope)) console.log(scope + ': ' + mess);
    }
  }
}
function getNewRunCode() { runCode = Math.random().toString().slice(2); }
let runCode; getNewRunCode();
const reloadScript = (Server.devMode)? `<script type="text/javascript" src="/socket.io.js"></script><script>var socket = io.connect({transports:["websocket"]});socket.on("browserReload", function (newRunCode) { if (newRunCode!="${runCode}") document.location.reload(true); });</script>` : '';
export function twigVm(model) { return { reloadScript:reloadScript, vm: model }; }
Server.start();
