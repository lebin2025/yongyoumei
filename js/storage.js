/**
 * 数据持久化层（"后端"）
 * 基于 localStorage 实现，无需服务器
 * 提供与之前 REST API 完全一致的调用接口
 */

const Storage = (() => {
  // ========= 用户隔离 =========
  function _user() {
    return sessionStorage.getItem('doc_current_user') || '_guest_';
  }

  function _key(name) {
    return 'doc_' + name + '_' + _user();
  }

  // ========= 底层读写 =========
  function _read(name) {
    try {
      const raw = localStorage.getItem(_key(name));
      return raw ? JSON.parse(raw) : [];
    } catch (e) { return []; }
  }

  function _write(name, data) {
    localStorage.setItem(_key(name), JSON.stringify(data));
  }

  // ========= 工具 =========
  function _genId(prefix) {
    return (prefix || 'id') + '_' + Date.now().toString(36) + '_' +
      Math.random().toString(36).slice(2, 8);
  }

  // ========= 模板 CRUD =========
  const templates = {
    list() {
      return _read('templates').map(t => ({
        id: t.id, name: t.name, desc: t.desc, createdAt: t.createdAt
      }));
    },
    get(id) {
      return _read('templates').find(t => t.id === id) || null;
    },
    create({ name, desc, data }) {
      if (!name || !name.trim()) throw new Error('模板名称不能为空');
      const template = {
        id: _genId('tpl'), name: name.trim(), desc: (desc || '').trim(),
        createdAt: new Date().toISOString(), data: data || {}
      };
      const all = _read('templates');
      all.unshift(template);
      _write('templates', all);
      return template;
    },
    update(id, { name, desc, data } = {}) {
      const all = _read('templates');
      const idx = all.findIndex(t => t.id === id);
      if (idx === -1) throw new Error('模板不存在');
      if (name !== undefined) all[idx].name = name.trim();
      if (desc !== undefined) all[idx].desc = (desc || '').trim();
      if (data !== undefined) all[idx].data = data;
      all[idx].updatedAt = new Date().toISOString();
      _write('templates', all);
      return all[idx];
    },
    delete(id) {
      let all = _read('templates');
      const before = all.length;
      all = all.filter(t => t.id !== id);
      if (all.length === before) throw new Error('模板不存在');
      _write('templates', all);
    }
  };

  // ========= 项目 CRUD =========
  const projects = {
    list() {
      return _read('projects').map(p => ({
        id: p.id, name: p.name, createdAt: p.createdAt, totalAmount: p.totalAmount
      }));
    },
    get(id) {
      return _read('projects').find(p => p.id === id) || null;
    },
    save({ id, name, data, totalAmount } = {}) {
      const all = _read('projects');
      if (id) {
        const idx = all.findIndex(p => p.id === id);
        if (idx >= 0) {
          if (name !== undefined) all[idx].name = name;
          if (data !== undefined) all[idx].data = data;
          if (totalAmount !== undefined) all[idx].totalAmount = totalAmount;
          all[idx].updatedAt = new Date().toISOString();
          _write('projects', all);
          return all[idx];
        }
      }
      const project = {
        id: id || _genId('proj'), name: name || '未命名项目',
        createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
        totalAmount: totalAmount || 0, data: data || {}
      };
      all.unshift(project);
      _write('projects', all);
      return project;
    },
    delete(id) {
      let all = _read('projects');
      const before = all.length;
      all = all.filter(p => p.id !== id);
      if (all.length === before) throw new Error('项目不存在');
      _write('projects', all);
    }
  };

  return { templates, projects };
})();
