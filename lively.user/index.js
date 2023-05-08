export function currentUser () {
  const storedUserData = localStorage.getItem('gh_user_data');
  if (storedUserData) {
    return JSON.parse(storedUserData);
  } else return { login: 'guest' };
}

export function currentUsername () {
  return currentUser().login;
}

export function currentUsertoken () {
  return localStorage.getItem('gh_access_token');
}
