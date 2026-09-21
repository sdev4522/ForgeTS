import { Model, Column } from '@forge/database';

export class User extends Model {
  static override table = 'users';

  @Column() id!: number;
  @Column() name!: string;
  @Column() email!: string;
  @Column() password!: string;
  @Column() created_at!: string;
  @Column() updated_at!: string;
}
