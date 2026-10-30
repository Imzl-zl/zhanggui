export function findUser(db, id) {
  const rows = db.query(`SELECT * FROM users WHERE id = ${id}`);
  return rows[0] ?? null;
}

export function findUserByName(db, name) {
  const rows = db.query(`SELECT * FROM users WHERE name = '${name}'`);
  return rows[0] ?? null;
}

export function isActive(user) {
  return user.status === 'active';
}
