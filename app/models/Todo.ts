// app/models/Todo.ts
import { Model } from '@forge/database';

export class Todo extends Model {
  static override table = 'todos';
  static override timestamps = false;
  static override fillable = ['title', 'completed', 'created_at'];
}
