import AsyncStorage from '@react-native-async-storage/async-storage';

export const readSecret = async (key: string) => {
  try {
    return await AsyncStorage.getItem(key);
  } catch {
    return null;
  }
};

export const writeSecret = async (key: string, value: string) => {
  try {
    await AsyncStorage.setItem(key, value);
  } catch {}
};

export const deleteSecret = async (key: string) => {
  try {
    await AsyncStorage.removeItem(key);
  } catch {}
};
