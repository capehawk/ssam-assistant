// These adapters receive Google services; no GAS globals are required in unit tests.
export function createSheetRepository(sheet, flush) {
  const width = () => Math.max(2, sheet.getLastColumn());
  const rows = () => sheet.getLastRow() < 2 ? [] : sheet.getRange(2, 1, sheet.getLastRow() - 1, width()).getValues();
  const decode = row => JSON.parse(row.slice(1).filter(Boolean).map(cell => String(cell).slice(2)).join(''));
  const list = () => rows().filter(row => row[0]).map(decode);
  return {
    list,
    get: id => { const row = rows().find(row => row[0] === id); return row ? decode(row) : null; },
    findRequest: (actorId, requestId) => {
      for (const record of list()) {
        const receipt = (record.requests || []).find(x => x.actorId === actorId && x.requestId === requestId);
        if (receipt) return receipt;
      }
      return null;
    },
    save: record => {
      const json = JSON.stringify(record);
      // Bounded records and 40k-character chunks avoid Sheets' 50k cell limit.
      if (json.length > 1000000) throw Object.assign(new Error('record too large'), { code: 'VALIDATION' });
      const chunks = (json.match(/[\s\S]{1,39998}/g) || ['']).map(chunk => `j:${chunk}`);
      const existing = rows().findIndex(row => row[0] === record.submissionId);
      const rowIndex = existing < 0 ? sheet.getLastRow() + 1 : existing + 2;
      const cells = [record.submissionId, ...chunks];
      while (cells.length < width()) cells.push('');
      if (sheet.getMaxColumns && cells.length > sheet.getMaxColumns()) sheet.insertColumnsAfter(sheet.getMaxColumns(), cells.length - sheet.getMaxColumns());
      if (sheet.getMaxRows && rowIndex > sheet.getMaxRows()) sheet.insertRowsAfter(sheet.getMaxRows(), rowIndex - sheet.getMaxRows());
      // One setValues writes record + receipts together. On an uncertain flush, retry reads it first.
      sheet.getRange(rowIndex, 1, 1, cells.length).setValues([cells]);
      flush();
    }
  };
}

export function createDriveEvidenceStore(env, folder) {
  return {
    put: (key, evidence) => {
      const name = `training-${key}.pdf`;
      const matches = folder.getFilesByName(name);
      const file = matches.hasNext() ? matches.next() : folder.createFile(env.Utilities.newBlob(env.Utilities.base64Decode(evidence.base64), 'application/pdf', name));
      // Deterministic names make retry recover a file left by an uncertain sheet write.
      return { id: file.getId(), name: evidence.name, mimeType: 'application/pdf', size: evidence.size };
    },
    read: id => {
      const blob = env.DriveApp.getFileById(id).getBlob();
      return { name: 'evidence.pdf', mimeType: 'application/pdf', base64: env.Utilities.base64Encode(blob.getBytes()) };
    }
  };
}
