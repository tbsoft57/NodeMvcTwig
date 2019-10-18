import 'reflect-metadata';                  // Necessaire pour typeOrm: permet de faire de la reflexion sur les classes, proprietes, methodes
import express from 'express';              // Serveur http
import compression from 'compression';      // Permet la compression gzip
import session from 'express-session';      // Compélement permettant de gerer les sessions
import twig from 'twig';                    // Gestionnaire de templates
import cors from 'cors';                    // Permet de positionner le header origine pour eviter ou permettre (*) le cross-site
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
import { appError } from './errors';

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
    await fsp.writeFile('pid', process.pid);
    await this.setClassProperties();
    await this.getNewRunCodeAndScript();
    await this.createConnectionPool(this.sqlServer);
    await this.importAppControlers();
    twig.cache(!this.devMode);
    this.httpListener = this.httpRequestHandler
    .use(compression())
    .use(express.static('static'))
    .use(express.urlencoded({ extended: true }))
    .use(express.json())
    .use(session({ secret: 'i-love-husky', resave: false, saveUninitialized: true, cookie: { httpOnly: true } }))
    .use(cors({ origin: (this.devMode) ? '*' : environment.origin, optionsSuccessStatus: 200 }))
    .all('*', async (req, res, next) => await this.checkIncomminRequest(req, res, next))
    .use(this.PublicRouter)
    .use('*', async (req, res, next) => await this.checkSessionConnection(req, res, next))
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

  public static async login(req, res , next) {
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
    this.debugLog('NodeMvcTwigServer:CreateSessionAndCookies()' , 'Created');
    req.session.logedIn = true; this.httpRequestHandler.set('logedIn', true);
    req.session.user = user; this.httpRequestHandler.set('user', user);
    this.createcsrfToken(req);
  }

  private static createcsrfToken(req) {
    const token = uuid(); req.session.csrfToken = token;
    this.httpRequestHandler.set('csrfHiddenInput', `<input type="hidden" name="csrfToken" value="${token}"/>`); }

  public static async logout(req, res, next) {
    this.debugLog('NodeMvcTwigServer:logout()' , 'Starts');
    await this.CloseSession(req, res);
    res.redirect('/');
  }

  private static async CloseSession(req, res) {
    this.debugLog('NodeMvcTwigServer:CloseSession()' , 'LogedOut');
    req.session.logedIn = false; this.httpRequestHandler.set('logedIn', false);
    req.session.user = null; this.httpRequestHandler.set('user', null);
  }

  private static async checkSessionConnection(req, res, next) {
    if (!req.session.logedIn) await this.checkSSLlogin(req, res);
    next((req.session.logedIn) ? null : new error.Error404());
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

  public static debugLog(scope: string, mess: string) { if (this.debugStart >= 0  && scope.includes(this.debugScope)) console.log(scope + ': ' + mess); }

  private static enableBrowserReload() {
    this.debugLog('NodeMvcTwigServer:enableBrowserReload()' , 'Starts');
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

  private static async checkIncomminRequest(req, res, next) {
    this.debugLog('NodeMvcTwigServer:checkIncomminRequest()', `${req.method} ${req.url}`);
    if (!req.session.csrfToken) this.createcsrfToken(req);
    this.httpRequestHandler
    .set('ip',          req.ip)
    .set('ips',         req.ips)
    .set('method',      req.method)
    .set('url',         req.url)
    .set('originalUrl', req.originalUrl)
    .set('path',        req.path);
    switch (req.method) {
      case 'GET' : next(); break;
      case 'POST': next((req.body.csrfToken === req.session.csrfToken) ? null : new error.NoValidXrsfTocken()); break;
      default: next(new error.NotValidRestMethod());
    }
  }

  private static async importAppControlers() {
    this.debugLog('NodeMvcTwigServer:importAppControlers()' , 'Starts');
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

  // Utile si on veut intercepter les res.render pour effetuer des traitements avant de transmettre à twig
  private static async twigEngine(file, vm, callback) {
    // Pour que cette methode soit appelée il faut compléter httpRequestHandler avec .engine('twig', await this.twigEngine) -> dans setClassProperties()
    twig.renderFile(file, vm, (err, html) => { callback(err, html); }); // twig construit le html final à partir de file
  }

  private static async setClassProperties() {
    this.env = process.env.NODE_ENV;
    this.devMode = (this.env === 'DEVELOPMENT');
    this.debugStart = (this.devMode) ? 0 : -1;
    this.debugScope = '';
    this.sqlServer = process.env.NODE_SQLSERVER || 'sqljs';
    this.httpPort = process.env.NODE_PORT || '4201';
    this.httpRequestHandler = express()
    .set('twig options', { allow_async: true, strict_variables: false })
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

  private static async errorHandler(err, res) {
    if (err.message.includes('Failed to lookup view')) err = new error.Error404();
    if (err instanceof appError) this.debugLog('NodeMvcTwigServer:errorHandler()' , `Status ${err.httpStatus} Message ${err.message}`);
    else {
        console.error('NodeMvcTwigServer:errorHandler()' , err.message); console.error(err);
        err =  new error.InternalServerError((this.devMode) ? err.message : null);
    }
    res.status(err.httpStatus); res.render('error', err);
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
