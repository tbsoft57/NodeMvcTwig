import { Entity, Column } from 'typeorm';
import { BaseModel } from './_base.model';

@Entity()
export class Person extends BaseModel {

  @Column() firstName: string = '';

  @Column() lastName: string = '';

  @Column() age: number = 0;

  public static async getByName(name: string) {
    return await Person.createQueryBuilder()
      .select('*')
      .where('lastname = :lastname', { lastname: name } )
      .execute();
  }

}
