const fs = require('fs');
const path = require('path');

const file = path.resolve(process.cwd(), 'tasks.json');
if (!fs.existsSync(file)) {
  console.error('tasks.json not found in current directory');
  process.exit(1);
}

let raw = fs.readFileSync(file, 'utf8');
let arr = [];
try {
  arr = raw.trim() ? JSON.parse(raw) : [];
} catch (err) {
  console.error('Error parsing tasks.json:', err.message);
  process.exit(1);
}

const out = [];
function ensureTaskShape(t, defaults = {}) {
  const task = Object.assign({}, t);
  if (!task.id) task.id = `TASK-${Date.now()}-${Math.floor(Math.random()*1000)}`;
  if (!task.title && task.description) task.title = String(task.description).split(/[\.\n]/)[0].slice(0,60);
  if (!task.status) task.status = 'todo';
  if (!('effort' in task)) task.effort = null;
  if (!task.created_at) task.created_at = new Date().toISOString();
  if (!task.tag && defaults.tag) task.tag = defaults.tag;
  if (!task.phase && defaults.phase) task.phase = defaults.phase;
  return task;
}

arr.forEach(item => {
  if (!item) return;
  // If item looks like a phase with tasks
  if (Array.isArray(item.tasks)) {
    const phase = item.phase || null;
    item.tasks.forEach(t => {
      const nt = ensureTaskShape(t, { tag: item.tag || null, phase });
      out.push(nt);
    });
    return;
  }

  // If item is an array of tasks nested (rare)
  if (Array.isArray(item)) {
    item.forEach(t => out.push(ensureTaskShape(t)));
    return;
  }

  // If item is already a single task object
  if (item.id || item.title || item.description) {
    out.push(ensureTaskShape(item));
    return;
  }

  // Unknown element, ignore
});

// Also deduplicate by id
const seen = new Map();
out.forEach(t => { seen.set(t.id, t); });
const finalArr = Array.from(seen.values());

fs.writeFileSync(file, JSON.stringify(finalArr, null, 2), 'utf8');
console.log(`✅ Cleaned tasks.json -> ${finalArr.length} tasks`);