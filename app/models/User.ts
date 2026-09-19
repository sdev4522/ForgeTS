import { Model, Column } from '@forge/database';

export class User extends Model {
  static override table = 'users';

  @Column() declare id: number;
  @Column() declare name: string;
  @Column() declare email: string;
  @Column() declare password: string;
  @Column() declare created_at: string;
  @Column() declare updated_at: string;
}
