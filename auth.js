import PocketBase from './pocketbase.es.mjs';

const pb = new PocketBase("http://127.0.0.1:8090");

// Register new user
export async function register(email, password, passwordConfirm) {
  try {
    const user = await pb.collection("users").create({
      email,
      password,
      passwordConfirm,
    });
    return user;
  } catch (err) {
    console.error("Registration failed:", err);
    throw err;
  }
}

// Login existing user
export async function login(email, password) {
  try {
    const authData = await pb.collection("users").authWithPassword(email, password);
    return authData;
  } catch (err) {
    console.error("Login failed:", err);
    throw err;
  }
}

// Logout
export function logout() {
  pb.authStore.clear();
}


export function getPb() {
  if (!pb) {
    pb = new PocketBase("http://127.0.0.1:8090"); // adjust URL if needed
  }
  return pb;
}