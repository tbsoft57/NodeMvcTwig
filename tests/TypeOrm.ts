import { environment } from '../src/environments/backend';
import { createConnection, ConnectionOptions } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { User } from './entities/user';
import { Client } from './entities/client';
import { Person } from './entities/person';

(async () => {
  console.log('begin');
  try { await createConnection(environment.ormconfig as ConnectionOptions);

    // console.log(
    //   await User.createQueryBuilder()
    //     .update()
    //     .set({ pass: await bcrypt.hash('TB04011966', 10)})
    //     .where('login = :login', { login: 'admin' } )
    //     .execute()
    // );

    // console.log(
    //   await User.createQueryBuilder()
    //     .update()
    //     .set({ login: 'thierry@tbsoft.fr'})
    //     .where('login = :login', { login: 'admin' } )
    //     .execute()
    // );

    // console.log(
    //   await User.createQueryBuilder()
    //     .update()
    //     .set({ name: 'BRUNNER Thierry'})
    //     .where('login = :login', { login: 'thierry@tbsoft.fr' } )
    //     .execute()
    // );

    console.log(
      await User.createQueryBuilder()
        .select()
        .getMany()
    );

    console.log(
      await Client.createQueryBuilder()
        .select()
        .getMany()
    );

    console.log(
      await Person.createQueryBuilder()
        .select()
        .getMany()
    );

  } catch (e) { console.log(e); }

  console.log('end');
})();
