// One editable draft, stored only in this browser's IndexedDB.
(() => {
  let database;
  function open() {
    if (!database) database = new Promise((resolve,reject) => {
      const request = indexedDB.open('yongyong-poster',1);
      request.onupgradeneeded = () => request.result.createObjectStore('draft');
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
      request.onblocked = () => reject(new Error('草稿存储被其他窗口占用。'));
    }).catch(error => { database = null; throw error; });
    return database;
  }
  async function load() {
    const db = await open();
    return new Promise((resolve,reject) => {
      const transaction = db.transaction('draft','readonly');
      const request = transaction.objectStore('draft').get('current');
      transaction.oncomplete = () => resolve(request.result);
      transaction.onabort = () => reject(transaction.error || new Error('草稿读取失败。'));
    });
  }
  async function save(record) {
    const db = await open();
    return new Promise((resolve,reject) => {
      const transaction = db.transaction('draft','readwrite');
      transaction.objectStore('draft').put(record,'current');
      transaction.oncomplete = () => resolve();
      transaction.onabort = () => reject(transaction.error || new Error('草稿保存失败。'));
    });
  }
  window.PosterDraft = { load,save };
})();
