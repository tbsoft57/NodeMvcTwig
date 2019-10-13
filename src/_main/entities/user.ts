import { Entity, Column } from 'typeorm';
import { BaseModel } from './_base.model';

@Entity()
export class User extends BaseModel {

  @Column()
  login: string = '';

  @Column()
  pass: string = '';

  @Column()
  name: string = '';

  public static async CreateAdmin() { return await this.create({ version: 1, login: 'admin', pass: 'admin' }).save(); }
  public static async getAdmin() {
    return await this.createQueryBuilder()
      .select()
      .where('login = "admin"')
      .getOne();
  }
  public static async getByLogin(user) {
    return await this.createQueryBuilder()
      .select()
      .where('login = :login', { login: user } )
      .getOne();
  }

}
