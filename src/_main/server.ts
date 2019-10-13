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
import * as bcrypt from 'bcryptjs';         // Permet de hacher les mot de passe
import { v4 as uuid } from 'uuid/v1';       // Permet de générer des Universally Unique IDentifier pour les x-xsrf-token de session
import { createConnection, Connection, ConnectionOptions } from 'typeorm'; // Object Relational Mapper
export { express, fs, fsp, path, error, Connection, environment };

import { environment } from '../_environments/backend';
import { User } from './entities/user';
import appControlers from '../app1/controlers/addControler';
import * as error from '../errors';

export default class NodeMvcTwigServer {

  private static env: string;
  private static devMode: boolean;
  private static debugStart: number;
  private static debugScope: string;
  private static connectionPool: Connection;
  private static viewDirs: Array<string>;
  private static runCode: string;
  private static reloadScript: string;
  private static httpListener;
  private static IoListener;

  public static async start(sqlServer = process.env.NODE_SQLSERVER || 'sqljs', port = process.env.NODE_PORT || '4201') {
    this.viewDirs = this.getViewDirs(); this.env = process.env.NODE_ENV; this.devMode = (this.env === 'DEVELOPMENT'); this.debugStart = (this.devMode) ? 0 : -1; this.debugScope = '';
    console.log(`\n${environment.appName} starts Pid=${process.pid} Env=${this.env} Debug=${this.devMode} SqlServer=${sqlServer} NodeHttpPort=${port} Cwd=${process.cwd()}`);
    this.getNewRunCodeAndScript();
    await fsp.writeFile('pid', process.pid);
    await this.createConnectionPool(sqlServer);
    twig.cache(!this.devMode);
    this.httpListener = express()
    .engine('twig', this.twigEngine)
    .set('view engine', 'twig')
    .set('views', this.viewDirs)
    .use(express.static('static'))
    .use(bodyParser.urlencoded({ extended: true }))
    .use(bodyParser.json())
    .use(cookieParser())
    .use(session({ secret: 'i-love-husky', resave: false, saveUninitialized: true, cookie: { httpOnly: false } }))
    .use(cors({ origin: (this.devMode) ? '*' : environment.origin, optionsSuccessStatus: 200 }))
    .get('*', async (req, res, next) => { this.debugLog('NodeMvcTwigServer:start()', `Incomming request ${req.url}`); next(); })
    .use(appControlers)
    .get('*', (req, res, next) => this.staticViews(req, res, next))
    .use((err, req, res, next) => this.errorHandler(err, req, res, next))
    .get('*', (req, res)       => this.error404Handler(res))
    .listen(port, () => { console.log(`${environment.appName} listening on http://localhost:${port}`); });
    if (this.devMode) {
      this.IoListener = socketIO.listen(this.httpListener);
      this.IoListener.sockets.on('connection', (socket) => { socket.emit('browserReload', this.runCode); });
      let fsTimeout; const dirs = this.viewDirs.slice(); dirs.push('static');
      for (const dir of dirs) {
        fs.watch(dir, () => {
          this.getNewRunCodeAndScript(); this.IoListener.sockets.emit('browserReload', this.runCode);
          fsTimeout = setTimeout(() => { fsTimeout = null; }, 1000); // give 1 seconds for multiple events
        });
      }
    }
    process.on('SIGINT',  async () => { await this.handleSIGINT(); });
    process.on('SIGUSR1', async () => { await this.handleSIGUSR1(); });
    this.handleCrontab(); if (process.send) process.send('ready');
  }

  public static async stop() { this.handleSIGINT(); }

  public static debugLog(scope: string, mess: string) { if (this.debugStart >= 0  && scope.includes(this.debugScope)) console.log(scope + ': ' + mess); }

  private static getNewRunCodeAndScript() {
    this.debugLog('NodeMvcTwigServer:getNewRunCodeAndScript()' , 'Enter');
    this.runCode = Math.random().toString().slice(2);
    this.reloadScript = (this.devMode) ? `<script type="text/javascript" src="/socket.io.js"></script><script>var socket = io.connect({transports:["websocket"]});socket.on("browserReload", function (newRunCode) { if (newRunCode!="${this.runCode}") document.location.reload(true); });</script>` : '';
    this.debugLog('NodeMvcTwigServer:getNewRunCodeAndScript()' , 'runCode and reloadScript created');
  }

  private  static getViewDirs() {
    const folder = path.dirname(module.parent.filename);
    const files = fs.readdirSync(folder);
    const dirs = [];
    for (const file of files) {
      const stat = fs.statSync(folder + '/' + file);
      if (stat.isDirectory() && file !== '_environments') dirs.push(folder + '/' + file + '/views/');
    }
    return dirs;
  }

  private static twigEngine(file, vm, callback) {
    if (!vm) vm = {};
    vm.app = {
      reloadScript: this.reloadScript,
      appName: environment.appName,
      origin: environment.origin,
      devMode: NodeMvcTwigServer.devMode, // on ne peut pas utiliser this car this n'est pas NodeMvcTwigServer
      env: NodeMvcTwigServer.env,         // idem
    };
    twig.renderFile(file, vm, (err, html) => { callback(err, html); });
  }

  private static staticViews(req, res, next) {
    this.debugLog('NodeMvcTwigServer:staticViews()' , `Enter -> Check ${req.url}`);
    res.render((req.url === '/') ? 'index' : req.url.slice(1));
  }

  private static errorHandler(err, req, res, next) {
    this.debugLog('NodeMvcTwigServer:errorHandler()' , 'Enter');
    if (err.httpStatus) this.debugLog('NodeMvcTwigServer:errorHandler()' , `Status ${err.httpStatus} Message ${err.message}`);
    else {
      const e = error.getAppError(err);
      if (e) { err = e; this.debugLog('NodeMvcTwigServer:errorHandler()' , `Status ${err.httpStatus} Message ${err.message}`);
      } else {
        console.error(err);
        err = (this.devMode) ? new error.appError(0, 500, err.message, 'InternalServerError') : new error.InternalServerError();
      }
    }
    res.status(err.httpStatus); res.render('error', err);
  }

  private static error404Handler(res) {
    this.debugLog('NodeMvcTwigServer:error404Handler()' , 'Enter');
    res.status(404); res.render('error', new error.Error404());
  }

  private static async checkSSLlogin(req, res, next) {
    this.debugLog('NodeMvcTwigServer:checkSSLlogin()' , 'Enter');
    const SSLlogin = req.get('SSL_CLIENT_S_DN_Email');
    if (SSLlogin) {
      this.debugLog('NodeMvcTwigServer:checkSSLlogin()' , 'SSLlogin: ' + SSLlogin);
      const user = await User.getByLogin(SSLlogin);
      if (user) {
        this.debugLog('NodeMvcTwigServer:checkSSLlogin()' , `User ${user.name} is loged In`);
        this.CreateSessionAndCookies(req, res, user);
        res.json(user);
      } else this.debugLog('NodeMvcTwigServer:checkSSLlogin()' , `Authentication rejected for User ${SSLlogin}`);
    } else {
      this.debugLog('NodeMvcTwigServer:checkSSLlogin()' , 'No SSL Certificate');
      next();
    }
  }

  private static async login(req, res , next) {
    this.debugLog('NodeMvcTwigServer:login()' , 'Enter');
    try {
      this.debugLog('NodeMvcTwigServer:login()' , `Check User ${req.body.login}`);
      const user = await User.getByLogin(req.body.login);
      if (user && await bcrypt.compare(req.body.pass, user.pass)) {
        this.debugLog('NodeMvcTwigServer:login()' , `User ${user.name} is loged In`);
        this.CreateSessionAndCookies(req, res, user);
        res.json(user);
      } else {
        this.debugLog('NodeMvcTwigServer:login()' , `Authentication rejected for User ${req.body.login} ${user.name}`);
        next(new error.NoValidUser());
      }
    } catch (err) { next(err); }
  }

  private static CreateSessionAndCookies(req, res, user) {
    this.debugLog('NodeMvcTwigServer:CreateSessionAndCookies()' , 'Enter');
    const token = uuid();
    req.session.login = true;
    req.session.user = user;
    req.session['X-XSFR-TOKEN'] = token;
    res.cookie('XSRF-COOKIE', token);
    this.debugLog('NodeMvcTwigServer:CreateSessionAndCookies()' , `Created with Token ${token}`);
  }

  private static async logout(req, res) {
    this.debugLog('NodeMvcTwigServer:logout()' , 'Enter');
    this.CloseSession(req, res);
  }

  private static CloseSession(req, res) {
    this.debugLog('NodeMvcTwigServer:CloseSession()' , 'Enter');
    req.session.login = false;
    req.session.user = null;
    req.session['x-xsrf-token'] = null;
    res.clearCookie('XSRF-COOKIE');
    res.json({ text: 'Loged Off' });
    this.debugLog('NodeMvcTwigServer:CloseSession()' , 'LogedOut');
  }

  private static async createConnectionPool(sqlServer: string) {
    this.debugLog('NodeMvcTwigServer:createConnectionPool()' , 'Enter');
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
    // entities: ['./src/entities/**/*.ts'],
    // migrations: ['./src/api/migration/**/*.ts'],
    // subscribers: ['./src/api/subscriber/**/*.ts'],
    // cli: { entitiesDir: './src/api/entities', migrationsDir: './src/api/migration', subscribersDir: './src/api/subscriber' },
    this.connectionPool = await createConnection(config as ConnectionOptions);
    this.debugLog('NodeMvcTwigServer:createConnectionPool()' , 'Pool created');
  }

  private static async handleSIGINT() {
    this.debugLog('NodeMvcTwigServer:handleSIGINT()' , 'Enter');
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
    this.debugLog('NodeMvcTwigServer:handleSIGUSR1()' , 'Enter');
    this.debugStart = Date.now();
    this.debugScope = await fsp.readFile('debugScope');
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
}
