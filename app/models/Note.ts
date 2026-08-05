import { Model } from '@forge/database';

export class Note extends Model {
  static override table = 'notes';
  static override timestamps = false;
  static override fillable = ['title', 'content', 'created_at'];
}
