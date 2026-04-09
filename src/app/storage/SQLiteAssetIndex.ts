import SQLite from 'react-native-sqlite-storage';

export class SQLiteAssetIndex {
    public open(name: string) {
        return SQLite.openDatabase({ name, location: 'default' });
    }
}