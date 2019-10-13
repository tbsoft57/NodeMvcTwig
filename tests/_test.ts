import fs from 'fs.promises';

(async () => {
  const folder = __dirname;
  const files = await fs.readdir(folder);
  const dirs = [];

  for (const file of files) { if (await fs.stat(folder + '/' + file).isDirectory()) dirs.push(file); }

  console.log(dirs);

})();
