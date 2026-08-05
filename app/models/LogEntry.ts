// app/models/LogEntry.ts
import { Model, Column } from '@forge/database';

export class LogEntry extends Model {
  static override table = 'log_entries';
  static override connection = 'mongodb';
  static override fillable = ['level', 'message', 'context', 'created_at', 'updated_at'];

  @Column() declare id: string;
  @Column() declare level: string;
  @Column() declare message: string;
  @Column() declare context: Record<string, any>;
}
