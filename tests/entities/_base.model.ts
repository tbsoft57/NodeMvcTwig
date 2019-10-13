import { BaseEntity, Entity, PrimaryGeneratedColumn, Column, getConnection } from 'typeorm';

@Entity()
export class BaseModel extends BaseEntity {

  @PrimaryGeneratedColumn()
  id: number = 0;

  @Column()
  version: number = 0;

  public static async getAll() { return await this.createQueryBuilder().select().getMany(); }
  public static async getById(id: number) { return await this.createQueryBuilder().select().where('id = :value', { value: id }).getOne(); }

}
