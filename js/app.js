/**
 * 单据模板录入系统 — 前端应用逻辑
 * 纯客户端运行，数据通过 Storage 对象持久化到 localStorage
 */

// ===================================================================
// 登出
// ===================================================================
function logout() {
  if (confirm('确定要登出吗？未保存的更改将丢失。')) {
    Auth.logout();
    location.reload();
  }
}

// ===================================================================
// 工具函数
// ===================================================================
const Util = {
  genId() {
    return 'id_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
  },

  formatMoney(n) {
    const num = parseFloat(n);
    return isNaN(num) ? '¥0.00' : '¥' + num.toFixed(2);
  },

  formatDate(d) {
    if (!d) return '';
    const parts = d.split('-');
    return parts[0] + '年' + parts[1] + '月' + parts[2] + '日';
  },

  escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  },

  toast(msg, type) {
    const el = document.getElementById('toast');
    el.textContent = msg;
    el.className = 'toast show ' + (type || '');
    clearTimeout(el._tid);
    el._tid = setTimeout(() => { el.className = 'toast'; }, 2000);
  }
};

// ===================================================================
// 全局状态
// ===================================================================
const State = {
  currentProjectId: null,
  selectedProjectId: null,  // "我的项目"中选中的项目
  searchTerm: '',
  DEFAULT_ROWS: 16
};

// ===================================================================
// 视图导航
// ===================================================================
const Nav = {
  init() {
    document.getElementById('navTabs').addEventListener('click', (e) => {
      const li = e.target.closest('li');
      if (!li) return;
      this.switchTo(li.dataset.view);
    });
  },

  switchTo(viewName) {
    document.querySelectorAll('#navTabs li').forEach(l => l.classList.remove('active'));
    const tab = document.querySelector(`#navTabs li[data-view="${viewName}"]`);
    if (tab) tab.classList.add('active');

    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    document.getElementById('view-' + viewName).classList.add('active');

    if (viewName === 'myTemplates') TemplateList.render();
    if (viewName === 'myProjects')  ProjectList.render();
  }
};

// ===================================================================
// 模态框
// ===================================================================
function openModal(id)  { document.getElementById(id).classList.add('show'); }
function closeModal(id) { document.getElementById(id).classList.remove('show'); }

document.addEventListener('click', (e) => {
  if (e.target.classList.contains('modal-overlay')) {
    e.target.classList.remove('show');
  }
});

// ===================================================================
// 单据表单操作
// ===================================================================
const Document = {
  /** 采集当前表单全部数据 */
  collect() {
    const docTitle = document.getElementById('docTitle').textContent.trim();

    const headerFields = {};
    document.querySelectorAll('#docHeader [data-field]').forEach(el => {
      headerFields[el.dataset.field] = el.value;
    });

    const rows = [];
    document.querySelectorAll('#tableBody tr').forEach(tr => {
      const numInput = tr.querySelector('.row-num-input');
      const inputs = tr.querySelectorAll('input:not(.row-num-input)');
      rows.push({
        num:    numInput ? numInput.value : '',
        name:   inputs[0]?.value || '',
        spec:   inputs[1]?.value || '',
        unit:   inputs[2]?.value || '',
        qty:    inputs[3]?.value || '',
        price:  inputs[4]?.value || '',
        remark: inputs[5]?.value || ''
      });
    });

    const footerFields = {};
    document.querySelectorAll('#docFooter [data-field], .doc-remark-row [data-field]').forEach(el => {
      footerFields[el.dataset.field] = el.value;
    });

    return { docTitle, headerFields, rows, footerFields };
  },

  /** 用数据填充表单 */
  fill(data) {
    if (!data) return;

    document.getElementById('docTitle').textContent = data.docTitle || '送 货 单';

    if (data.headerFields) {
      Object.keys(data.headerFields).forEach(key => {
        const el = document.querySelector(`#docHeader [data-field="${key}"]`);
        if (el) el.value = data.headerFields[key] || '';
      });
    }

    const tbody = document.getElementById('tableBody');
    tbody.innerHTML = '';
    const rows = (data.rows && data.rows.length) ? data.rows : [];
    if (rows.length === 0) {
      for (let i = 0; i < State.DEFAULT_ROWS; i++) Table.addRow();
    } else {
      rows.forEach(row => Table.addRow(row));
    }

    if (data.footerFields) {
      Object.keys(data.footerFields).forEach(key => {
        const el = document.querySelector(`#docFooter [data-field="${key}"], .doc-remark-row [data-field="${key}"]`);
        if (el) el.value = data.footerFields[key] || '';
      });
    }

    Table.refresh();
  },

  /** 计算总金额（只统计有序号的行） */
  calcTotal(rows) {
    return rows.reduce((sum, r, i) => {
      const num = r.num !== undefined ? String(r.num).trim() : (i < 5 ? String(i + 1) : '');
      return num ? sum + (parseFloat(r.qty) || 0) * (parseFloat(r.price) || 0) : sum;
    }, 0);
  },

  /** 重置为空白单据 */
  reset() {
    this.fill({
      docTitle: '拥有美灯饰',
      headerFields: { docNo: '', docDate: '', customerName: '', customerPhone: '', contactPerson: '', address: '' },
      rows: [],
      footerFields: { remark: '', contactPhone: '15361164187', contactPerson2: '郑生', bankAccount: '44636501040011560', footerAddress: '吴川市黄坡车站万家灯火店' }
    });
    const d = document.querySelector('#docHeader [data-field="docDate"]');
    if (d) d.value = new Date().toISOString().split('T')[0];
    const n = document.querySelector('#docHeader [data-field="docNo"]');
    if (n) {
      const now = new Date();
      n.value = `DD-${now.getFullYear()}${String(now.getMonth()+1).padStart(2,'0')}${String(now.getDate()).padStart(2,'0')}-001`;
    }
    State.currentProjectId = null;
    document.getElementById('currentDocId').textContent = '';
    document.getElementById('projectNameInput').value = '';
  }
};

// ===================================================================
// 表格操作
// ===================================================================
const Table = {
  addRow(data) {
    const tbody = document.getElementById('tableBody');
    const tr = document.createElement('tr');
    const rowNum = data?.num !== undefined ? String(data.num) : '';
    tr.innerHTML = `
      <td class="col-no"><input type="text" class="row-num-input" placeholder="" value="${Util.escapeHtml(rowNum)}" style="text-align:center;"></td>
      <td class="col-name"><input type="text" placeholder="商品名称" value="${Util.escapeHtml(data?.name || '')}"></td>
      <td class="col-spec"><input type="text" placeholder="规格型号" value="${Util.escapeHtml(data?.spec || '')}"></td>
      <td class="col-unit"><input type="text" placeholder="单位" value="${Util.escapeHtml(data?.unit || '')}"></td>
      <td class="col-qty"><input type="number" placeholder="数量" value="${Util.escapeHtml(data?.qty || '')}" min="0" step="any"></td>
      <td class="col-price"><input type="number" placeholder="单价" value="${Util.escapeHtml(data?.price || '')}" min="0" step="0.01"></td>
      <td class="col-amount amount-cell"></td>
      <td class="col-remark"><input type="text" placeholder="备注" value="${Util.escapeHtml(data?.remark || '')}"></td>
    `;
    tbody.appendChild(tr);

    const qtyInput = tr.querySelectorAll('input:not(.row-num-input)')[3];
    const priceInput = tr.querySelectorAll('input:not(.row-num-input)')[4];
    const numInput = tr.querySelector('.row-num-input');
    const handler = () => Table.refresh();
    qtyInput.addEventListener('input', handler);
    priceInput.addEventListener('input', handler);
    if (numInput) numInput.addEventListener('input', handler);
  },

  removeLast() {
    const rows = document.querySelectorAll('#tableBody tr');
    if (rows.length <= 1) { Util.toast('至少保留一行', 'error'); return; }
    rows[rows.length - 1].remove();
    this.refresh();
  },

  refresh() {
    let total = 0;
    document.querySelectorAll('#tableBody tr').forEach((tr, i) => {
      // 序号输入框：前5行默认填序号
      const numInput = tr.querySelector('.row-num-input');
      if (numInput && !numInput.value && i < 5) numInput.value = i + 1;
      const hasNum = !!(numInput && numInput.value.trim());
      const inputs = tr.querySelectorAll('input:not(.row-num-input)');
      const qty = parseFloat(inputs[3]?.value) || 0;
      const price = parseFloat(inputs[4]?.value) || 0;
      const amount = qty * price;
      tr.querySelector('.amount-cell').textContent = hasNum ? amount.toFixed(2) : '';
      if (hasNum) total += amount;
    });
    document.getElementById('totalAmount').textContent = Util.formatMoney(total);
  },

  /** 构建预览 / 导出用的 HTML 表格片段 */
  buildHTML(rows) {
    return rows.map((r, i) => {
      const amt = (parseFloat(r.qty) || 0) * (parseFloat(r.price) || 0);
      const num = r.num || (i < 5 ? i + 1 : '');
      const hasNum = num !== '';
      return `<tr>
        <td style="border:1px solid #999;padding:10px 6px;text-align:center;height:42px;font-size:20px;font-weight:500;color:#000;width:50px;">${num}</td>
        <td style="border:1px solid #999;padding:10px 6px;text-align:center;height:42px;font-size:20px;font-weight:500;color:#000;">${Util.escapeHtml(r.name)}</td>
        <td style="border:1px solid #999;padding:10px 6px;text-align:center;height:42px;font-size:20px;font-weight:500;color:#000;width:140px;">${Util.escapeHtml(r.spec)}</td>
        <td style="border:1px solid #999;padding:10px 6px;text-align:center;height:42px;font-size:20px;font-weight:500;color:#000;width:90px;">${Util.escapeHtml(r.unit)}</td>
        <td style="border:1px solid #999;padding:10px 6px;text-align:center;height:42px;font-size:20px;font-weight:500;color:#000;width:90px;">${Util.escapeHtml(r.qty)}</td>
        <td style="border:1px solid #999;padding:10px 6px;text-align:center;height:42px;font-size:20px;font-weight:500;color:#000;width:120px;">${Util.escapeHtml(r.price)}</td>
        <td style="border:1px solid #999;padding:10px 6px;text-align:center;height:42px;font-weight:bold;color:#000;font-size:20px;width:140px;">${hasNum ? amt.toFixed(2) : ''}</td>
        <td style="border:1px solid #999;padding:10px 6px;text-align:center;height:42px;font-size:20px;font-weight:500;color:#000;width:120px;">${Util.escapeHtml(r.remark)}</td>
      </tr>`;
    }).join('');
  },

  /** 构建完整单据 HTML（预览 / PDF 导出 共用） */
  buildDocHTML(data, rows) {
    const total = Document.calcTotal(rows || data.rows || []);
    const r = rows || data.rows || [];

    const headerLabels = {
      docNo: '单据编号', docDate: '录单日期', customerName: '客户名称',
      customerPhone: '客户联系电话', contactPerson: '客户联系人', address: '客户地址'
    };
    const footerLabels = { contactPhone: '联系电话', contactPerson2: '联系人', bankAccount: '农行账号', footerAddress: '地址' };

    return `<div style="padding:28px 40px;font-family:'Microsoft YaHei','PingFang SC',sans-serif;width:100%;min-height:800px;color:#000;background:#fff;">
      <div style="text-align:center;font-size:28px;font-weight:bold;letter-spacing:6px;margin-bottom:20px;padding-bottom:12px;color:#000;">${Util.escapeHtml(data.docTitle)}</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px 40px;margin-bottom:16px;font-size:20px;font-weight:500;color:#000;">
        ${Object.keys(data.headerFields || {}).map(k => {
          const val = k === 'docDate' ? Util.formatDate(data.headerFields[k]) : data.headerFields[k];
          return `<div style="display:flex;align-items:baseline;gap:20px;"><strong style="min-width:150px;text-align:left;color:#000;font-size:20px;line-height:1.6;">${headerLabels[k] || k}：</strong><span style="flex:1;border-bottom:1px dashed #999;padding:0 12px 4px 12px;line-height:1.6;">${Util.escapeHtml(val || '')}</span></div>`;
        }).join('')}
      </div>
      <table style="width:100%;border-collapse:collapse;font-size:20px;color:#000;margin:16px 0;">
        <thead><tr style="background:#f0f0f0;">
          <th style="border:1px solid #999;padding:10px 6px;height:42px;font-size:16px;font-weight:bold;color:#000;width:50px;">序号</th>
          <th style="border:1px solid #999;padding:10px 6px;height:42px;font-size:16px;font-weight:bold;color:#000;">商品全名</th>
          <th style="border:1px solid #999;padding:10px 6px;height:42px;font-size:16px;font-weight:bold;color:#000;width:140px;">规格型号</th>
          <th style="border:1px solid #999;padding:10px 6px;height:42px;font-size:16px;font-weight:bold;color:#000;width:90px;">单位</th>
          <th style="border:1px solid #999;padding:10px 6px;height:42px;font-size:16px;font-weight:bold;color:#000;width:90px;">数量</th>
          <th style="border:1px solid #999;padding:10px 6px;height:42px;font-size:16px;font-weight:bold;color:#000;width:120px;">单价(元)</th>
          <th style="border:1px solid #999;padding:10px 6px;height:42px;font-size:16px;font-weight:bold;color:#000;width:140px;">金额(元)</th>
          <th style="border:1px solid #999;padding:10px 6px;height:42px;font-size:16px;font-weight:bold;color:#000;width:120px;">备注</th>
        </tr></thead>
        <tbody>${this.buildHTML(r)}</tbody>
      </table>
      <div style="text-align:right;font-size:20px;font-weight:bold;margin-top:12px;padding-top:8px;color:#000;">
        合计金额：<span style="color:#000;font-size:20px;">${Util.formatMoney(total)}</span></div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px 40px;margin-top:16px;font-size:20px;font-weight:500;color:#000;">
        ${Object.keys(data.footerFields || {}).filter(k => k !== 'remark').map(k =>
          `<div style="display:flex;align-items:baseline;gap:20px;"><strong style="min-width:150px;text-align:left;color:#000;font-size:20px;line-height:1.6;">${footerLabels[k] || k}：</strong><span style="flex:1;border-bottom:1px dashed #999;padding:0 12px 4px 12px;line-height:1.6;">${Util.escapeHtml(data.footerFields[k] || '')}</span></div>`
        ).join('')}
      </div>
      <div style="margin-top:16px;padding-top:12px;border-top:1px solid #ddd;font-size:20px;font-weight:500;color:#000;display:flex;align-items:baseline;gap:20px;">
        <strong style="min-width:150px;text-align:left;color:#000;font-size:20px;line-height:1.6;">注：</strong><span style="flex:1;border-bottom:1px dashed #999;padding:0 12px 4px 12px;line-height:1.6;">${Util.escapeHtml((data.footerFields && data.footerFields.remark) || '').replace(/\n/g, '<br>')}</span>
      </div></div>`;
  }
};

// ===================================================================
// 预览
// ===================================================================
const Preview = {
  async open(data, rows) {
    document.getElementById('previewContent').innerHTML =
      Table.buildDocHTML(data, rows || data.rows);
    document.getElementById('previewOverlay').classList.add('show');
  },

  close() {
    document.getElementById('previewOverlay').classList.remove('show');
  }
};

// ===================================================================
// 新建空白单据
// ===================================================================
function newDocument() {
  Draft.clear();
  Document.reset();
  Util.toast('已新建空白单据', 'success');
}

// ===================================================================
// 保存项目
// ===================================================================
async function saveProject() {
  const data = Document.collect();
  const totalAmount = Document.calcTotal(data.rows);
  const projectName = document.getElementById('projectNameInput').value.trim()
    || data.headerFields.docNo || '未命名项目';

  try {
    const project = await Storage.projects.save({
      id: State.currentProjectId,
      name: projectName,
      data: data,
      totalAmount: totalAmount
    });
    State.currentProjectId = project.id;
    document.getElementById('currentDocId').textContent =
      '编号: ' + (data.headerFields.docNo || projectName);
    Draft.clear();
    Util.toast('项目已保存', 'success');
  } catch (err) {
    Util.toast('保存失败: ' + err.message, 'error');
  }
}

// ===================================================================
// 模板列表渲染
// ===================================================================
const TemplateList = {
  async render() {
    const container = document.getElementById('templateList');
    try {
      const templates = await Storage.templates.list();
      if (templates.length === 0) {
        container.innerHTML = '<div class="empty-state"><div class="icon">📁</div><p>暂无模板，点击"新建模板"创建或从项目页面保存模板</p></div>';
        return;
      }
      container.innerHTML = templates.map(t => `
        <div class="card-item">
          <div class="card-info">
            <div class="card-title">${Util.escapeHtml(t.name)}</div>
            <div class="card-meta">创建: ${new Date(t.createdAt).toLocaleString('zh-CN')}${t.desc ? ' · ' + Util.escapeHtml(t.desc) : ''}</div>
          </div>
          <div class="card-actions">
            <button class="btn btn-primary btn-sm" data-action="use" data-id="${t.id}">使用</button>
            <button class="btn btn-outline btn-sm" data-action="rename" data-id="${t.id}">重命名</button>
            <button class="btn btn-danger btn-sm" data-action="delete" data-id="${t.id}">删除</button>
          </div>
        </div>`).join('');

      container.onclick = async (e) => {
        const btn = e.target.closest('button[data-action]');
        if (!btn) return;
        const id = btn.dataset.id;
        if (btn.dataset.action === 'use')    TemplateActions.use(id);
        if (btn.dataset.action === 'rename') TemplateActions.rename(id);
        if (btn.dataset.action === 'delete') TemplateActions.remove(id);
      };
    } catch (err) {
      container.innerHTML = '<div class="empty-state"><p>加载失败</p></div>';
    }
  },

  async renderForLoad() {
    const container = document.getElementById('loadTemplateList');
    try {
      const templates = await Storage.templates.list();
      if (templates.length === 0) {
        container.innerHTML = '<div class="empty-state"><p>暂无可用模板，请先到"我的模板"中创建</p></div>';
        return;
      }
      container.innerHTML = templates.map(t => `
        <div class="card-item" data-action="load" data-id="${t.id}">
          <div class="card-info">
            <div class="card-title">${Util.escapeHtml(t.name)}</div>
            <div class="card-meta">${new Date(t.createdAt).toLocaleString('zh-CN')}${t.desc ? ' · ' + Util.escapeHtml(t.desc) : ''}</div>
          </div>
          <button class="btn btn-primary btn-sm">引用</button>
        </div>`).join('');

      container.onclick = async (e) => {
        const card = e.target.closest('.card-item[data-action="load"]');
        if (!card) return;
        TemplateActions.use(card.dataset.id);
        closeModal('loadTemplateModal');
      };
    } catch (err) {
      container.innerHTML = '<div class="empty-state"><p>加载失败</p></div>';
    }
  }
};

// ===================================================================
// 模板操作
// ===================================================================
const TemplateActions = {
  async use(id) {
    try {
      const template = await Storage.templates.get(id);
      if (!template) { Util.toast('模板不存在', 'error'); return; }
      Document.fill(template.data);
      State.currentProjectId = null;
      document.getElementById('currentDocId').textContent = '';
      document.getElementById('projectNameInput').value = '';
      Draft.clear();
      Nav.switchTo('newProject');
      Util.toast('已加载模板: ' + template.name, 'success');
    } catch (err) {
      Util.toast('加载模板失败', 'error');
    }
  },

  async rename(id) {
    const templates = await Storage.templates.list();
    const t = templates.find(x => x.id === id);
    if (!t) return;
    document.getElementById('renameTemplateName').value = t.name;
    document.getElementById('renameTemplateModal')._tid = id;
    openModal('renameTemplateModal');
  },

  async confirmRename() {
    const id = document.getElementById('renameTemplateModal')._tid;
    const newName = document.getElementById('renameTemplateName').value.trim();
    if (!newName) { Util.toast('请输入名称', 'error'); return; }
    try {
      await Storage.templates.update(id, { name: newName });
      closeModal('renameTemplateModal');
      TemplateList.render();
      Util.toast('重命名成功', 'success');
    } catch (err) {
      Util.toast('重命名失败', 'error');
    }
  },

  async remove(id) {
    if (!confirm('确定要删除此模板吗？此操作不可恢复。')) return;
    try {
      await Storage.templates.delete(id);
      TemplateList.render();
      Util.toast('模板已删除', 'success');
    } catch (err) {
      Util.toast('删除失败', 'error');
    }
  },

  saveCurrent() {
    document.getElementById('newTemplateName').value = '';
    document.getElementById('newTemplateDesc').value = '';
    openModal('createTemplateModal');
  },

  async createFromCurrent() {
    const name = document.getElementById('newTemplateName').value.trim();
    if (!name) { Util.toast('请输入模板名称', 'error'); return; }
    const desc = document.getElementById('newTemplateDesc').value.trim();
    const data = Document.collect();
    try {
      await Storage.templates.create({ name, desc, data });
      closeModal('createTemplateModal');
      Draft.clear();  // 存为模板后清除草稿
      Util.toast('模板保存成功', 'success');
    } catch (err) {
      Util.toast('保存失败: ' + err.message, 'error');
    }
  }
};

// ===================================================================
// 项目列表渲染
// ===================================================================
const ProjectList = {
  async render(filterText) {
    const container = document.getElementById('projectList');

    try {
      const projects = await Storage.projects.list();
      if (projects.length === 0) {
        container.innerHTML = '<div class="empty-state"><div class="icon">📂</div><p>暂无项目，去"新建项目"创建并保存吧</p></div>';
        return;
      }

      container.innerHTML = '';
      State.selectedProjectId = null;

      projects.forEach(async p => {
        const detail = await Storage.projects.get(p.id);
        const docDate = (detail && detail.data && detail.data.headerFields && detail.data.headerFields.docDate) || '';

        // 搜索时检查是否匹配
        if (State.searchTerm) {
          const allRows = (detail && detail.data && detail.data.rows) ? detail.data.rows : [];
          const hasMatch = allRows.some(r => (r.name || '').toLowerCase().includes(State.searchTerm));
          if (!hasMatch) return; // 搜索模式下跳过不匹配的项目
        }

        const card = document.createElement('div');
        card.className = 'project-card';
        card.dataset.id = p.id;
        card.innerHTML = `
          <div class="card-icon">📄</div>
          <div class="card-info-area">
            <div class="card-name">${Util.escapeHtml(p.name)}</div>
            <div class="card-meta">${docDate || '未设置日期'}</div>
          </div>`;
        container.appendChild(card);
      });

      // 点击选中
      container.onclick = async (e) => {
        const card = e.target.closest('.project-card');
        if (!card) return;

        const id = card.dataset.id;
        // 切换选中
        if (State.selectedProjectId === id) {
          State.selectedProjectId = null;
        } else {
          State.selectedProjectId = id;
        }
        // 更新高亮
        container.querySelectorAll('.project-card').forEach(c => {
          c.classList.toggle('selected', c.dataset.id === State.selectedProjectId);
        });
      };

      // 双击打开
      container.ondblclick = async (e) => {
        const card = e.target.closest('.project-card');
        if (!card) return;
        ProjectActions.open(card.dataset.id);
      };
    } catch (err) {
      container.innerHTML = '<div class="empty-state"><p>加载失败</p></div>';
    }
  }
};

// ===================================================================
// 项目操作
// ===================================================================
const ProjectActions = {
  async open(id) {
    try {
      const project = await Storage.projects.get(id);
      if (!project) { Util.toast('项目不存在', 'error'); return; }
      Document.fill(project.data);
      State.currentProjectId = project.id;
      document.getElementById('projectNameInput').value = project.name || '';
      const docNo = (project.data.headerFields && project.data.headerFields.docNo) || project.name;
      document.getElementById('currentDocId').textContent = '编号: ' + docNo;
      Draft.clear();
      Nav.switchTo('newProject');
      Util.toast('已加载项目: ' + project.name, 'success');
    } catch (err) {
      Util.toast('加载失败', 'error');
    }
  },

  async remove(id) {
    if (!confirm('确定要删除此项目吗？此操作不可恢复。')) return;
    try {
      await Storage.projects.delete(id);
      ProjectList.render(document.getElementById('searchBox').value);
      Util.toast('项目已删除', 'success');
    } catch (err) {
      Util.toast('删除失败', 'error');
    }
  },

  /** 获取当前选中的项目 */
  async _getSelected() {
    if (!State.selectedProjectId) {
      Util.toast('请先在下方点击选中一个项目', 'error');
      return null;
    }
    return await Storage.projects.get(State.selectedProjectId);
  },

  /** 导出选中项目为 JPG 照片 */
  async exportJPG() {
    const project = await this._getSelected();
    if (!project) return;

    const data = project.data;
    let rows = data.rows || [];
    if (State.searchTerm) {
      rows = rows.filter(r => (r.name || '').toLowerCase().includes(State.searchTerm));
    }

    const html = Table.buildDocHTML(data, rows);
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = html;
    tempDiv.style.cssText = 'position:absolute;left:-9999px;top:0;width:1600px;';
    document.body.appendChild(tempDiv);

    try {
      const canvas = await html2canvas(tempDiv, { scale: 2, useCORS: true, backgroundColor: '#ffffff' });
      canvas.toBlob(blob => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = (project.name || '单据') + '.jpg';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        Util.toast('JPG 导出成功', 'success');
      }, 'image/jpeg', 0.95);
    } catch (err) {
      console.error('JPG 导出失败:', err);
      Util.toast('JPG 导出失败', 'error');
    } finally {
      document.body.removeChild(tempDiv);
    }
  },

  /** 编辑选中的项目 */
  async openSelected() {
    if (!State.selectedProjectId) {
      Util.toast('请先在下方点击选中一个项目', 'error');
      return;
    }
    this.open(State.selectedProjectId);
  },

  /** 删除选中的项目 */
  async removeSelected() {
    if (!State.selectedProjectId) {
      Util.toast('请先在下方点击选中一个项目', 'error');
      return;
    }
    this.remove(State.selectedProjectId);
    State.selectedProjectId = null;
  },

  // ---- 导出 PDF ----
  async exportPDF() {
    const project = await this._getSelected();
    if (!project) return;

    const data = project.data;
    let rows = data.rows || [];
    if (State.searchTerm) {
      rows = rows.filter(r => (r.name || '').toLowerCase().includes(State.searchTerm));
    }

    const html = Table.buildDocHTML(data, rows);
    const temp = document.createElement('div');
    temp.innerHTML = html;
    temp.style.cssText = 'position:absolute;left:-9999px;top:0;width:1600px;';
    document.body.appendChild(temp);

    // 使用 html2canvas + jsPDF
    if (typeof html2canvas === 'undefined' || typeof jspdf === 'undefined') {
      Util.toast('PDF 组件未加载完成，请刷新页面后重试', 'error');
      document.body.removeChild(temp);
      return;
    }

    html2canvas(temp, { scale: 2, useCORS: true, backgroundColor: '#ffffff' })
      .then(canvas => {
        const imgData = canvas.toDataURL('image/png');
        const { jsPDF } = jspdf;
        const pdf = new jsPDF('l', 'mm', 'a4');
        const pw = pdf.internal.pageSize.getWidth();
        const ph = pdf.internal.pageSize.getHeight();
        const iw = pw - 20;
        const ih = (canvas.height * iw) / canvas.width;

        let left = ih, pos = 10;
        pdf.addImage(imgData, 'PNG', 10, pos, iw, ih);
        left -= (ph - 20);

        while (left > 0) {
          pos = -(ph - 20) + 10;
          pdf.addPage();
          pdf.addImage(imgData, 'PNG', 10, pos, iw, ih);
          left -= (ph - 20);
        }

        pdf.save((project.name || data.headerFields.docNo || '单据') + '.pdf');
        Util.toast('PDF 导出成功', 'success');
      })
      .catch(err => {
        console.error('PDF 导出失败:', err);
        Util.toast('PDF 导出失败', 'error');
      })
      .finally(() => {
        document.body.removeChild(temp);
      });
  },

  // ---- 导出 Excel ----
  async exportExcel() {
    const project = await this._getSelected();
    if (!project) return;

    let rows = (project.data && project.data.rows) ? project.data.rows : [];
    if (State.searchTerm) {
      rows = rows.filter(r => (r.name || '').toLowerCase().includes(State.searchTerm));
    }
    if (rows.length === 0) { Util.toast('无数据可导出', 'error'); return; }

    if (typeof XLSX === 'undefined') {
      Util.toast('Excel 组件未加载完成，请刷新页面后重试', 'error');
      return;
    }

    const excelData = [['序号', '商品全名', '规格型号', '单位', '数量', '单价(元)', '金额(元)', '备注']];
    let totalAmount = 0;
    rows.forEach((r, i) => {
      const qty = parseFloat(r.qty) || 0;
      const price = parseFloat(r.price) || 0;
      const amt = qty * price;
      totalAmount += amt;
      excelData.push([i + 1, r.name || '', r.spec || '', r.unit || '', qty, price, amt, r.remark || '']);
    });
    excelData.push(['', '', '', '', '', '合计', totalAmount, '']);

    const ws = XLSX.utils.aoa_to_sheet(excelData);
    ws['!cols'] = [{wch:6},{wch:20},{wch:14},{wch:8},{wch:10},{wch:12},{wch:14},{wch:14}];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '单据表格');

    const docNo = (project.data.headerFields && project.data.headerFields.docNo) || '表格';
    const fileName = (project.name || docNo || '表格') + '.xlsx';
    XLSX.writeFile(wb, fileName);
    Util.toast('Excel 导出成功', 'success');
  },

  // ---- 预览项目 ----
  async preview() {
    const project = await this._getSelected();
    if (!project) return;

    let rows = (project.data && project.data.rows) ? project.data.rows : [];
    if (State.searchTerm) {
      rows = rows.filter(r => (r.name || '').toLowerCase().includes(State.searchTerm));
    }
    Preview.open(project.data, rows);
  }
};

// ===================================================================
// Excel 导入
// ===================================================================
const ExcelImport = {
  trigger() {
    document.getElementById('excelFileInput').click();
  },

  handle(file) {
    if (!file) return;
    if (typeof XLSX === 'undefined') {
      Util.toast('Excel 组件未加载完成，请刷新页面后重试', 'error');
      return;
    }

    const reader = new FileReader();
    reader.onload = function(e) {
      try {
        const data = new Uint8Array(e.target.result);
        const wb = XLSX.read(data, { type: 'array' });
        const firstSheet = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(firstSheet, { header: 1 });

        if (rows.length < 1) { Util.toast('Excel 文件为空', 'error'); return; }

        // 查找表头行
        let headerIdx = 0;
        for (let i = 0; i < Math.min(rows.length, 5); i++) {
          const r = rows[i] || [];
          const s = r.join(' ').toLowerCase();
          if (s.includes('序号') || s.includes('商品') || s.includes('名称') || s.includes('规格')) {
            headerIdx = i;
            break;
          }
        }

        // 解析数据行
        const dataRows = [];
        for (let i = headerIdx + 1; i < rows.length; i++) {
          const r = rows[i] || [];
          const s = r.join(' ').trim();
          if (!s || s.includes('合计') || s.includes('总计')) continue;
          dataRows.push({
            name:   String(r[1] || '').trim(),
            spec:   String(r[2] || '').trim(),
            unit:   String(r[3] || '').trim(),
            qty:    String(r[4] || '').trim(),
            price:  String(r[5] || '').trim(),
            remark: String(r[7] || '').trim()
          });
        }

        if (dataRows.length === 0) { Util.toast('未找到有效数据行', 'error'); return; }

        const tbody = document.getElementById('tableBody');
        tbody.innerHTML = '';
        dataRows.forEach(row => Table.addRow(row));
        Table.refresh();
        Util.toast(`成功导入 ${dataRows.length} 行数据`, 'success');
      } catch (err) {
        console.error('Excel 导入失败:', err);
        Util.toast('Excel 导入失败: ' + err.message, 'error');
      }
    };
    reader.readAsArrayBuffer(file);
    document.getElementById('excelFileInput').value = '';
  }
};

// ===================================================================
// 事件绑定
// ===================================================================
function bindEvents() {
  // Excel 文件选择
  document.getElementById('excelFileInput').addEventListener('change', function() {
    ExcelImport.handle(this.files[0]);
  });

  // 项目搜索框
  document.getElementById('searchBox').addEventListener('input', function() {
    ProjectList.render(this.value);
  });

  // 新建项目 - 表格搜索
  const tableSearchBox = document.getElementById('tableSearchBox');
  let _tableBackup = null; // 搜索前备份的表格数据

  tableSearchBox.addEventListener('input', function() {
    const term = this.value.trim().toLowerCase();

    if (!term) {
      // 搜索结束 → 恢复原表格
      if (_tableBackup) {
        const tbody = document.getElementById('tableBody');
        tbody.innerHTML = '';
        _tableBackup.forEach(row => Table.addRow(row));
        Table.refresh();
        _tableBackup = null;
      }
      return;
    }

    // 首次搜索 → 备份当前表格数据
    if (!_tableBackup) {
      _tableBackup = Document.collect().rows;
    }

    // 筛选匹配行
    const filtered = _tableBackup.filter(r =>
      (r.name || '').toLowerCase().includes(term) ||
      (r.spec || '').toLowerCase().includes(term)
    );

    const tbody = document.getElementById('tableBody');
    tbody.innerHTML = '';
    if (filtered.length > 0) {
      filtered.forEach(row => Table.addRow(row));
    } else {
      // 无匹配时显示空行提示
      const tr = document.createElement('tr');
      tr.innerHTML = '<td colspan="8" style="text-align:center;color:#999;padding:12px;">无匹配结果</td>';
      tbody.appendChild(tr);
    }
    Table.refresh();
  });

  // 关闭预览
  document.getElementById('previewOverlay').addEventListener('click', function(e) {
    if (e.target === this) Preview.close();
  });

  // 键盘快捷键
  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
      Preview.close();
      ['loadTemplateModal', 'createTemplateModal', 'renameTemplateModal'].forEach(closeModal);
    }
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
      if (document.querySelector('.view.active')?.id === 'view-newProject') {
        e.preventDefault();
        saveProject();
      }
    }
  });
}

// ===================================================================
// 草稿自动保存（刷新不丢失）
// ===================================================================
const Draft = {
  get key() {
    return 'doc_draft_' + (sessionStorage.getItem('doc_current_user') || '_guest_');
  },
  _timer: null,

  /** 保存当前表单到草稿（防抖 500ms） */
  save() {
    clearTimeout(this._timer);
    this._timer = setTimeout(() => {
      const data = Document.collect();
      const total = Document.calcTotal(data.rows);
      const draft = {
        data: data,
        totalAmount: total,
        projectId: State.currentProjectId,
        savedAt: new Date().toISOString()
      };
      localStorage.setItem(this.key, JSON.stringify(draft));
    }, 500);
  },

  /** 读取草稿 */
  load() {
    try {
      const raw = localStorage.getItem(this.key);
      return raw ? JSON.parse(raw) : null;
    } catch (e) { return null; }
  },

  /** 清除草稿 */
  clear() {
    localStorage.removeItem(this.key);
  }
};

// ===================================================================
// 启动
// ===================================================================
(async function init() {
  // 显示当前用户名
  const user = Auth.currentUser();
  if (user) {
    document.getElementById('navUsername').textContent = '👤 ' + user;
  }

  Nav.init();
  bindEvents();

  // 尝试恢复草稿
  const draft = Draft.load();
  if (draft && draft.data) {
    Document.fill(draft.data);
    State.currentProjectId = draft.projectId || null;
    if (draft.projectId) {
      const project = await Storage.projects.get(draft.projectId);
      if (project) document.getElementById('projectNameInput').value = project.name || '';
      const docNo = (draft.data.headerFields && draft.data.headerFields.docNo) || '';
      document.getElementById('currentDocId').textContent = docNo ? '编号: ' + docNo : '';
    }
  } else {
    Document.reset();
  }

  // 监听表单变化 → 自动保存草稿
  const paper = document.getElementById('documentPaper');
  paper.addEventListener('input', () => Draft.save());
  // contenteditable 标题变化
  const titleEl = document.getElementById('docTitle');
  titleEl.addEventListener('input', () => Draft.save());

  // 备注框自动撑高
  const remarkEl = document.getElementById('remarkTextarea');
  if (remarkEl) {
    remarkEl.addEventListener('input', function() {
      this.style.height = 'auto';
      this.style.height = this.scrollHeight + 'px';
    });
  }
})();
