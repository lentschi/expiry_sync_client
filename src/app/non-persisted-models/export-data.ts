export interface ExportData {
  exportedAt: Date;
  schemaVersion: number;
  objectStores: {[storeName: string]: ExportDataRow[]};
}

export interface ExportDataRow {
  [fieldName: string]: ExportDataColumn;
}

export interface ExportDataColumn {
  value: any;
  originalType: string;
  originalClass: string;
}

export function implementsExportData(data: any): data is ExportData {
  if (!data || typeof data.schemaVersion !== 'number'
    || data.schemaVersion % 1 !== 0 || typeof data.objectStores !== 'object'
    || !(data.exportedAt instanceof Date)) {
    return false;
  }

  for (const key of Object.keys(data.objectStores)) {
    if (!(data.objectStores[key] instanceof Array)) {
      return false;
    }
  }

  return true;
}
