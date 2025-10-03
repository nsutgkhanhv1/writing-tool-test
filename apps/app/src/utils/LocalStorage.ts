type KEY = "@writing-tool/userToken" | "language" | "userInfo";

export const setLocalItem = (key: KEY, value: string) => {
  localStorage.setItem(key, value);
};
export const getLocalItem = (key: KEY) => {
  return localStorage.getItem(key);
};

export const removeLocalItem = (key: KEY) => {
  localStorage.removeItem(key);
};
