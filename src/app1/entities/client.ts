import { Entity, Column } from 'typeorm';
import { BaseModel } from './_base.model';

@Entity()
export class Client  extends BaseModel {

  @Column()
  nom: string = '';

  @Column()
  prenom: string = '';

  @Column()
  rue: string = '';

  @Column()
  cp: string = '';

  @Column()
  ville: string = '';

  @Column()
  prix: number = 0;

  @Column()
  email: string = '';

  @Column()
  actif: boolean = true;

}
