import 'reflect-metadata';                  // Necessaire pour typeOrm: permet de faire de la reflexion sur les classes, proprietes, methodes
import express from 'express';              // Serveur http
import session from 'express-session';      // Complement permettant de gerer les sessions
import cookieParser from 'cookie-parser';   // Permet de mettre en place des cookies
import bodyParser from 'body-parser';       // Permet d'injecter dans req les parametres en provenance de l'Url (GET) ou du body (post)
import cors from 'cors';                    // Permet de positionner le header origine pour eviter ou permettre (*) le cross-site
import twig from 'twig';                    // Injecte la methode render dans res pour rendre les vues twig avec les données du viewModel
import socketIO from 'socket.io';           // Permet de faire du push over http (ici pour gerer le rafraichissement du browser pour le dev debbug)
import fsp from 'fs.promises';              // Permet d'acceder au file system avec async await
import fs from 'fs';                        // Permet d'acceder au file system
import path from 'path';                    // Donne acces à des fonctionnalités sur les chemins (dossiers)
import uuid from 'uuid/v4';                 // Permet de générer des Universally Unique IDentifier pour les X-XSFR-TOKEN de session
import * as bcrypt from 'bcryptjs';         // Permet de hacher les mot de passe
import { createConnection, Connection, ConnectionOptions } from 'typeorm'; // Object Relational Mapper

import { environment } from '../_environments/backend';
import { User } from './entities/user';
import * as error from '../errors';

export { express, fs, fsp, path, error, Connection, environment, User };
export class NodeMvcTwigServer {

  private static env: string;
  private static devMode: boolean;
  private static debugStart: number;
  private static debugScope: string;
  private static connectionPool: Connection;
  private static appDirs: Array<string> = [];
  private static viewDirs: Array<string> = [];
  private static sqlServer: string;
  private static httpPort: string;
  private static httpRequestHandler;
  private static httpListener;
  private static IoListener;

  public static PrivateRouter = express.Router();
  public static PublicRouter = express.Router();

  public static async start() {
    await this.setClassProperties();
    await this.getNewRunCodeAndScript();
    await fsp.writeFile('pid', process.pid);
    await this.createConnectionPool(this.sqlServer);
    await this.importAppControlers();
    twig.cache(!this.devMode);
    this.httpListener = this.httpRequestHandler
    .use(express.static('static'))
    .use(bodyParser.urlencoded({ extended: true }))
    .use(bodyParser.json())
    .use(cookieParser())
    .use(session({ secret: 'i-love-husky', resave: false, saveUninitialized: true, cookie: { httpOnly: false } }))
    .use(cors({ origin: (this.devMode) ? '*' : environment.origin, optionsSuccessStatus: 200 }))
    .all('*', async (req, res, next) => await this.reportIncomminRequest(req, res, next))
    .use(this.PublicRouter)
    .use(this.connectionTest)
    .use(this.PrivateRouter)
    .all('*', (req, res, next) => next(new error.Error404()))
    .use(async (err, req, res, next) => await this.errorHandler(err, res))
    .listen(this.httpPort, () => { console.log(`${environment.appName} listening on http://localhost:${this.httpPort}`); });
    if (this.devMode) this.enableBrowserReload();
    process.on('SIGINT',  async () => { await this.handleSIGINT(); });
    process.on('SIGUSR1', async () => { await this.handleSIGUSR1(); });
    await this.handleCrontab(); if (process.send) process.send('ready');
  }

  public static async stop() { this.handleSIGINT(); }

  public static debugLog(scope: string, mess: string) { if (this.debugStart >= 0  && scope.includes(this.debugScope)) console.log(scope + ': ' + mess); }

  private static enableBrowserReload() {
    this.IoListener = socketIO.listen(this.httpListener);
    this.IoListener.sockets.on('connection', (socket) => { socket.emit('browserReload', this.httpRequestHandler.get('runCode')); });
    let fsTimeout; const dirs = this.viewDirs.slice(); dirs.push('static'); dirs.push('src');
    for (const dir of dirs) {
      fs.watch(dir, () => {
        this.getNewRunCodeAndScript(); this.IoListener.sockets.emit('browserReload', this.httpRequestHandler.get('runCode'));
        fsTimeout = setTimeout(() => { fsTimeout = null; }, 1000); // give 1 seconds for multiple events
      });
    }
  }

  private static async reportIncomminRequest(req, res, next) {
    if (req.url === '/socket.io.js.map') res.status(404).end();
    else {
      this.debugLog('NodeMvcTwigServer:reportIncomminRequest()', `${req.method} ${req.url}`);
      this.httpRequestHandler.set('ip', req.ip);
      this.httpRequestHandler.set('ips', req.ips);
      this.httpRequestHandler.set('method', req.method);
      this.httpRequestHandler.set('url', req.url);
      this.httpRequestHandler.set('originalUrl', req.originalUrl);
      this.httpRequestHandler.set('path', req.path);
      if (!req.session.login) await this.checkSSLlogin(req, res);
      next();
    }
  }

  private static connectionTest(req, res, next) {
    if (!req.session.login) next(new error.Error404());
    else if (req.method !== 'GET' && req.headers['X-XSFR-TOKEN'] !== req.session['X-XSFR-TOKEN']) next(new error.NoValidXrsfTocken());
    else next();
  }

  private static async importAppControlers() {
    this.PublicRouter
    .get('/', (req, res) => { res.render('index'); })
    .get('/index', (req, res) => { res.render('index'); })
    .get('/home', (req, res) => { res.render('index'); })
    .get('/error', (req, res) => { res.render('error'); })
    .get ('/settings', (req, res) => { res.render('settings', ); })
    .get ('/login', (req, res) => { res.render('login', ); })
    .post('/login', (req, res, next) => { this.login(req, res , next); })
    .get ('/logout', (req, res) => { res.render('logout', ); })
    .post('/logout', (req, res, next) => { this.logout(req, res, next); });
    try {
      for (const entry of this.appDirs) {
        const routers = await fsp.readdir(entry + '/controlers');
        routers.forEach(router => require(entry + '/controlers/' + router));
      }
    } catch (e) { console.error('NodeMvcTwigServer.importAppRouters() error on importing routers'); console.error(e); }
  }

  private static async getNewRunCodeAndScript() {
    this.debugLog('NodeMvcTwigServer:getNewRunCodeAndScript()' , 'Starts');
    const runCode = Math.random().toString().slice(2);
    this.httpRequestHandler.set('runCode', runCode);
    this.httpRequestHandler.set('reloadScript', (this.devMode) ? `<script type="text/javascript" src="/socket.io.js"></script><script>var socket = io.connect({transports:["websocket"]});socket.on("browserReload", function (newRunCode) { if (newRunCode!="${runCode}") document.location.reload(true); });</script>` : '');
    this.debugLog('NodeMvcTwigServer:getNewRunCodeAndScript()' , 'runCode and reloadScript created');
  }

  private static async setClassProperties() {
    this.env = process.env.NODE_ENV;
    this.devMode = (this.env === 'DEVELOPMENT');
    this.debugStart = (this.devMode) ? 0 : -1;
    this.debugScope = '';
    this.sqlServer = process.env.NODE_SQLSERVER || 'sqljs';
    this.httpPort = process.env.NODE_PORT || '4201';
    this.httpRequestHandler = express()
    .engine('twig', await this.twigEngine)
    .set('view engine', 'twig')
    .set('views', this.viewDirs)
    .set('trust proxy', environment.proxyIp) // on fait confiance au proxy apache (127.0.0.1) qui renvoi l'ip initiale du client, sinon si trust proxy = false, l'ip client est celle du proxy
    .set('appName', environment.appName)
    .set('origin', environment.origin)
    .set('devMode', this.devMode)
    .set('sqlServer', this.sqlServer)
    .set('httpPort', this.httpPort)
    .set('appPid',  process.pid)
    .set('processCwd', process.cwd());
    const folder = path.dirname(module.parent.filename);
    const entries = fs.readdirSync(folder);
    for (const entrie of entries) {
      const stat = fs.statSync(folder + '/' + entrie);
      if (stat.isDirectory() && entrie !== '_environments') {
        this.appDirs.push(folder + '/' + entrie);
        this.viewDirs.push(folder + '/' + entrie + '/views/');
      }
    }
    console.log(`\n${environment.appName} starts Pid=${process.pid} Env=${this.env} Debug=${this.devMode} SqlServer=${this.sqlServer} NodeHttpPort=${this.httpPort} Cwd=${process.cwd()}`);
  }

  private static async twigEngine(file, vm, callback) {
    vm.settingsJson = JSON.stringify(vm.settings, null, 4); // TODO Enlever
    twig.renderFile(file, vm, (err, html) => { callback(err, html); });
  }

  private static async errorHandler(err, res) {
    if (!err) err = new error.Error404(); // Si il n'y a pas d'erreur, c'est qu'aucune route n'a matchée
    // Sinon on teste si c'est une appError => il y a un httpStatus
    if (err.httpStatus) this.debugLog('NodeMvcTwigServer:errorHandler()' , `Status ${err.httpStatus} Message ${err.message}`);
    else {
      const e = this.getAppError(err); // Dernière chance de trouver une appError
      if (e) { err = e; this.debugLog('NodeMvcTwigServer:errorHandler()' , `Status ${err.httpStatus} Message ${err.message}`);
      } else {
        console.error(err);
        err = (this.devMode) ? new error.appError(500, err.message, 'InternalServerError') : new error.InternalServerError();
      }
    }
    res.status(err.httpStatus); res.render('error', err);
  }

  private static getAppError(err): Error {
    switch (err.code) {
        case 'ENOTFOUND':
        case 'ER_ACCESS_DENIED_ERROR': return new error.DbAccessDenied();
        case 'ER_DUP_ENTRY': return new error.DuplicateEntry();
        default:
          if (err.message.includes('Failed to lookup view')) return new error.Error404();
          return null;
    }
  }

  private static async checkSSLlogin(req, res) {
    const SSLlogin = req.get('SSL_CLIENT_S_DN_Email');
    if (SSLlogin) {
      this.debugLog('NodeMvcTwigServer:checkSSLlogin()' , 'SSLlogin: ' + SSLlogin);
      const user = await User.getByLogin(SSLlogin);
      if (user) {
        this.debugLog('NodeMvcTwigServer:checkSSLlogin()' , `User ${user.name} is loged In`);
        await this.CreateSessionAndCookies(req, res, user);
      } else this.debugLog('NodeMvcTwigServer:checkSSLlogin()' , `Authentication rejected for User ${SSLlogin}`);
    }
  }

  private static async login(req, res , next) {
    this.debugLog('NodeMvcTwigServer:login()' , 'Starts');
    try {
      this.debugLog('NodeMvcTwigServer:login()' , `Check User ${req.body.login}`);
      const user = await User.getByLogin(req.body.login);
      if (user && await bcrypt.compare(req.body.pass, user.pass)) {
        this.debugLog('NodeMvcTwigServer:login()' , `User ${user.name} is loged In`);
        await this.CreateSessionAndCookies(req, res, user);
        res.redirect('/');
      } else {
        this.debugLog('NodeMvcTwigServer:login()' , `Authentication rejected for User ${req.body.login}`);
        next(new error.NoValidUser());
      }
    } catch (err) { next(err); }
  }

  private static async CreateSessionAndCookies(req, res, user) {
    this.debugLog('NodeMvcTwigServer:CreateSessionAndCookies()' , 'Starts');
    const token = uuid();
    req.session.login = true;
    req.session.user = user;
    req.session['X-XSFR-TOKEN'] = token;
    res.cookie('XSRF-COOKIE', token);
    this.httpRequestHandler.set('user', user);
    this.httpRequestHandler.set('logedIn', true);
    this.httpRequestHandler.set('X-XSFR-TOKEN', token);
    this.debugLog('NodeMvcTwigServer:CreateSessionAndCookies()' , `Created with Token ${token}`);
  }

  private static async logout(req, res, next) {
    this.debugLog('NodeMvcTwigServer:logout()' , 'Starts');
    await this.CloseSession(req, res);
    res.redirect('/');
  }

  private static async CloseSession(req, res) {
    this.debugLog('NodeMvcTwigServer:CloseSession()' , 'Starts');
    req.session.login = false;
    req.session.user = null;
    req.session['X-XSFR-TOKEN'] = null;
    res.clearCookie('XSRF-COOKIE');
    this.httpRequestHandler.set('user', null);
    this.httpRequestHandler.set('logedIn', false);
    this.httpRequestHandler.set('X-XSFR-TOKEN', null);
    this.debugLog('NodeMvcTwigServer:CloseSession()' , 'LogedOut');
  }

  private static async createConnectionPool(sqlServer: string) {
    this.debugLog('NodeMvcTwigServer:createConnectionPool()' , 'Starts');
    const config = environment.ormconfig;
    switch (sqlServer) {
      case 'mssql':
        config.host = process.env.MSSQL_HOST;
        config.port = process.env.MSSQL_PORT;
        config.user = process.env.MSSQL_USEREntity;
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
    config.entities = []; config.migrations = []; config.subscribers = [];
    for (const appDir of this.appDirs) {
      config.entities     .push(appDir + '/entities/**/*.ts');
      config.migrations   .push(appDir + '/migrations/**/*.ts');
      config.subscribers  .push(appDir + '/subscribers/**/*.ts');
    }
    this.connectionPool = await createConnection(config as ConnectionOptions);
    this.debugLog('NodeMvcTwigServer:createConnectionPool()' , 'Pool created');
  }

  private static async handleSIGINT() {
    this.debugLog('NodeMvcTwigServer:handleSIGINT()' , 'Starts');
    console.log('\nSIGINT signal received');
    if (this.IoListener) { this.IoListener.close(); console.log('IoListener Stoped'); }
    this.httpListener.close(); console.log('httpServer Stoped');
    this.connectionPool.close()
      .then(() => { console.log('DataBase Closed'); })
      .catch((err) => { console.error(err); process.exit(1);
    });
    process.exit(0);
  }

  private static async handleSIGUSR1() {
    this.debugLog('NodeMvcTwigServer:handleSIGUSR1()' , 'Starts');
    this.debugStart = Date.now();
    this.debugScope = await fsp.readFile('debugScope');
    console.log('Debug Starts for 1 hour');
  }

  private static async handleCrontab() {
    setInterval(() => { // Crontab 1: handleDebugStart
      if (this.debugStart > 0 && (Date.now() - this.debugStart) > 3600000) {
        this.debugScope = 'No Debug';
        this.debugStart = -1;
        console.log('Debug Ends');
    }}, 10000);
  }
}
