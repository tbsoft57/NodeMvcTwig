import { createConnection, ConnectionOptions } from 'typeorm';
import { User } from '../src/api/entities/user';

const ormconfig = {
  type: 'sqljs',
  location: './sqlite/database.sqlite',
  synchronize: true,
  autoSave: true,
  logging: true,
  entities: [User],
  migrations: [],
  subscribers: []
};

(async () => {
  try {
    await createConnection(ormconfig as ConnectionOptions);
    const users = await User.createQueryBuilder().select().getMany();
    console.log(users);
  } catch (e) { console.log(e); }
})();
