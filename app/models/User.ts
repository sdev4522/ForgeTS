import { Model, Column } from '@forge/database';

export class User extends Model {
  static override table = 'users';

  /** Attributes that may be mass-assigned from request input. */
  static override fillable = ['name', 'email', 'password'];

  /** Never serialized to JSON / API responses. */
  static override hidden = ['password'];

  @Column() id!: number;
  @Column() name!: string;
  @Column() email!: string;
  @Column() password!: string;
  @Column() created_at!: string;
  @Column() updated_at!: string;
}
