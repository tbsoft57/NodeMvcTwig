{% extends "./_master.twig" %}

ormconfig:
    entities: ['./src/entities/**/*.ts'],
    migrations: ['./src/api/migration/**/*.ts'],
    subscribers: ['./src/api/subscriber/**/*.ts'],
    cli: { entitiesDir: './src/api/entities', migrationsDir: './src/api/migration', subscribersDir: './src/api/subscriber' },

dynamiser le chargement de tous les errors.ts

tester trust proxy false en prod

chargement automatique de tout les controleurs

Login à implémenter controler view 

Tester Materials
  