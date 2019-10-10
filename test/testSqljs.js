var fs = require('fs');
var initSqlJs = require('sql.js');
var filebuffer = fs.readFileSync('./sqlite/database.sqlite');

initSqlJs().then((sqlite) => {
  var db = new sqlite.Database(filebuffer);
  var res = db.exec("SELECT * FROM user");
  console.log(res[0].values);
}).catch((e) => { console.log('Erreur TBSOFT:'); console.log(e); });
