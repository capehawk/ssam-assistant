const copy = value => value == null ? value : JSON.parse(JSON.stringify(value));
export function createMemoryRepository() {
  const records = new Map();
  return {
    list: () => [...records.values()].map(copy),
    get: id => copy(records.get(id)) || null,
    save: record => { records.set(record.submissionId, copy(record)); },
    findRequest: (actorId, requestId) => {
      for (const record of records.values()) {
        const receipt = record.requests.find(r => r.actorId === actorId && r.requestId === requestId);
        if (receipt) return copy(receipt);
      }
      return null;
    }
  };
}
export function createMemoryEvidenceStore() {
  const files = new Map();
  return {
    get size() { return files.size; },
    put: (key, evidence) => {
      if (!files.has(key)) files.set(key, copy(evidence));
      const file = files.get(key);
      return { id: key, name: file.name, mimeType: file.mimeType, size: file.size };
    },
    read: id => { const f = files.get(id); if (!f) throw new Error('Missing evidence'); return { name: f.name, mimeType: f.mimeType, base64: f.base64 }; }
  };
}
