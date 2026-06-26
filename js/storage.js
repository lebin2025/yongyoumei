/**
 * 数据持久化层 — Supabase 云端数据库
 * 所有数据按用户名隔离，跨设备同步
 */

const Storage = (() => {
  function _user() {
    return sessionStorage.getItem('doc_current_user') || '';
  }

  function _genId(prefix) {
    return (prefix || 'id') + '_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
  }

  // ========= 模板 CRUD =========
  const templates = {
    async list() {
      const u = _user(); if (!u) return [];
      const { data } = await supabase.from('templates').select('id,name,description,created_at').eq('username', u).order('created_at', { ascending: false });
      return (data || []).map(t => ({ id: t.id, name: t.name, desc: t.description, createdAt: t.created_at }));
    },

    async get(id) {
      const { data } = await supabase.from('templates').select('*').eq('id', id).maybeSingle();
      if (!data) return null;
      return { id: data.id, name: data.name, desc: data.description, createdAt: data.created_at, data: data.data };
    },

    async create({ name, desc, data }) {
      const u = _user(); if (!u) throw new Error('未登录');
      if (!name || !name.trim()) throw new Error('模板名称不能为空');
      const id = _genId('tpl');
      await supabase.from('templates').insert({ id, username: u, name: name.trim(), description: (desc || '').trim(), data: data || {} });
      return { id, name: name.trim(), desc: (desc || '').trim(), createdAt: new Date().toISOString(), data: data || {} };
    },

    async update(id, { name, desc, data } = {}) {
      const u = _user(); if (!u) throw new Error('未登录');
      const update = {};
      if (name !== undefined) update.name = name.trim();
      if (desc !== undefined) update.description = (desc || '').trim();
      if (data !== undefined) update.data = data;
      update.updated_at = new Date().toISOString();
      await supabase.from('templates').update(update).eq('id', id).eq('username', u);
      return this.get(id);
    },

    async delete(id) {
      const u = _user(); if (!u) throw new Error('未登录');
      await supabase.from('templates').delete().eq('id', id).eq('username', u);
    }
  };

  // ========= 项目 CRUD =========
  const projects = {
    async list() {
      const u = _user(); if (!u) return [];
      const { data } = await supabase.from('projects').select('id,name,created_at,total_amount').eq('username', u).order('created_at', { ascending: false });
      return (data || []).map(p => ({ id: p.id, name: p.name, createdAt: p.created_at, totalAmount: p.total_amount }));
    },

    async get(id) {
      const { data } = await supabase.from('projects').select('*').eq('id', id).maybeSingle();
      if (!data) return null;
      return { id: data.id, name: data.name, createdAt: data.created_at, totalAmount: data.total_amount, data: data.data };
    },

    async save({ id, name, data, totalAmount } = {}) {
      const u = _user(); if (!u) throw new Error('未登录');
      if (id) {
        const { data: existing } = await supabase.from('projects').select('id').eq('id', id).eq('username', u).maybeSingle();
        if (existing) {
          const update = { updated_at: new Date().toISOString() };
          if (name !== undefined) update.name = name;
          if (data !== undefined) update.data = data;
          if (totalAmount !== undefined) update.total_amount = totalAmount;
          await supabase.from('projects').update(update).eq('id', id).eq('username', u);
          return this.get(id);
        }
      }
      const pid = id || _genId('proj');
      await supabase.from('projects').insert({ id: pid, username: u, name: name || '未命名项目', data: data || {}, total_amount: totalAmount || 0 });
      return { id: pid, name: name || '未命名项目', createdAt: new Date().toISOString(), totalAmount: totalAmount || 0, data: data || {} };
    },

    async delete(id) {
      const u = _user(); if (!u) throw new Error('未登录');
      await supabase.from('projects').delete().eq('id', id).eq('username', u);
    }
  };

  return { templates, projects };
})();
