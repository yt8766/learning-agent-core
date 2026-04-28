import { TaskStatusSchema } from '../src/index.js';

const status = TaskStatusSchema.parse('running');

console.log(JSON.stringify({ status }, null, 2));
