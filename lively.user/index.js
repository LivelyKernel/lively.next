export function currentUser () {
  const storedUserData = localStorage.getItem('gh_user_data');
  if (storedUserData) {
    return JSON.parse(storedUserData);
  } else return { login: 'guest' };
}

export function storeCurrentUser (userData) {
  localStorage.setItem('gh_user_data', userData);
}
export function currentUsersOrganizations () {
  return JSON.parse(localStorage.getItem('gh_user_organizations'));
}

export function storeCurrentUsersOrganizations (orgs) {
  localStorage.setItem('gh_user_organizations', JSON.stringify(orgs));
}

export function currentUsername () {
  return currentUser().login;
}

export function currentUsertoken () {
  return localStorage.getItem('gh_access_token');
}

export function storeCurrentUsertoken (token) {
  localStorage.setItem('gh_access_token', token);
}
export function clearUserData () {
  localStorage.removeItem('gh_user_data');
  localStorage.removeItem('gh_user_organizations');
}

export function clearAllUserData (){
  clearUserData();
  localStorage.removeItem('gh_access_token');
}
