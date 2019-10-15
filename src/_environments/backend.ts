export const environment = {
  appName: 'NodeMvcTwig',
  origin: 'app2.tbsoft.fr',
  proxyIp: '127.0.0.1',
  ormconfig: {
    type: 'sqljs',
    location: './sqlite/database.sqlite',
    host: '',
    port: '',
    user: '',
    pass: '',
    synchronize: true,
    autoSave: true,
    logging: false,
    entities: ['./src/entities/**/*.ts'],
    migrations: ['./src/api/migration/**/*.ts'],
    subscribers: ['./src/api/subscriber/**/*.ts'],
    cli: { entitiesDir: './src/api/entities', migrationsDir: './src/api/migration', subscribersDir: './src/api/subscriber' },
    extra: { connectionLimit: 5 }
  }
};
