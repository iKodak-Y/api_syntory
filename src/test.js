import bcrypt from 'bcrypt';

const password = 'password123';
bcrypt.hash(password, 10).then(hash => console.log(hash));