/**
 * 单据模板录入系统 — 用户登录 / 注册模块
 * 使用 Supabase 云端数据库，跨设备共享账号
 */

const Auth = {
  SESSION_KEY: 'doc_current_user',

  /** SHA-256 哈希 */
  _hash(str) {
    function sha256(msg) {
      function rotr(x, n) { return (x >>> n) | (x << (32 - n)); }
      const K = [0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2];
      let bytes = [];
      for (let i = 0; i < msg.length; i++) {
        let c = msg.charCodeAt(i);
        if (c < 0x80) bytes.push(c);
        else if (c < 0x800) { bytes.push(0xc0 | (c >>> 6)); bytes.push(0x80 | (c & 0x3f)); }
        else { bytes.push(0xe0 | (c >>> 12)); bytes.push(0x80 | ((c >>> 6) & 0x3f)); bytes.push(0x80 | (c & 0x3f)); }
      }
      let bitLen = bytes.length * 8;
      bytes.push(0x80);
      while ((bytes.length + 8) % 64 !== 0) bytes.push(0);
      let hi = Math.floor(bitLen / Math.pow(2, 32)), lo = bitLen >>> 0;
      for (let i = 3; i >= 0; i--) bytes.push((hi >>> (i * 8)) & 0xff);
      for (let i = 3; i >= 0; i--) bytes.push((lo >>> (i * 8)) & 0xff);
      let H = [0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19];
      for (let i = 0; i < bytes.length; i += 64) {
        let W = new Array(64);
        for (let t = 0; t < 16; t++) W[t] = (bytes[i+t*4]<<24)|(bytes[i+t*4+1]<<16)|(bytes[i+t*4+2]<<8)|bytes[i+t*4+3];
        for (let t = 16; t < 64; t++) {
          let s0 = rotr(W[t-15],7)^rotr(W[t-15],18)^(W[t-15]>>>3);
          let s1 = rotr(W[t-2],17)^rotr(W[t-2],19)^(W[t-2]>>>10);
          W[t] = (W[t-16]+s0+W[t-7]+s1)>>>0;
        }
        let [a,b,c,d,e,f,g,h] = H;
        for (let t = 0; t < 64; t++) {
          let S1 = rotr(e,6)^rotr(e,11)^rotr(e,25), ch = (e&f)^((~e)&g), T1 = (h+S1+ch+K[t]+W[t])>>>0;
          let S0 = rotr(a,2)^rotr(a,13)^rotr(a,22), maj = (a&b)^(a&c)^(b&c), T2 = (S0+maj)>>>0;
          h=g; g=f; f=e; e=(d+T1)>>>0; d=c; c=b; b=a; a=(T1+T2)>>>0;
        }
        H = [H[0]+a,H[1]+b,H[2]+c,H[3]+d,H[4]+e,H[5]+f,H[6]+g,H[7]+h].map(x=>x>>>0);
      }
      return H.map(x=>x.toString(16).padStart(8,'0')).join('');
    }
    return sha256(str);
  },

  /** 注册 */
  async register(username, password) {
    username = username.trim();
    if (!username) return { ok: false, msg: '用户名不能为空' };
    if (username.length < 2) return { ok: false, msg: '用户名至少2个字符' };
    if (username.length > 20) return { ok: false, msg: '用户名最多20个字符' };
    if (!/^[\w一-鿿]+$/.test(username)) return { ok: false, msg: '用户名只能包含字母、中文、数字、下划线' };

    if (!password || password.length < 6) return { ok: false, msg: '密码至少6个字符' };
    if (password.length > 20) return { ok: false, msg: '密码最多20个字符' };
    if (!/[a-zA-Z]/.test(password)) return { ok: false, msg: '密码必须包含字母' };
    if (!/[0-9]/.test(password)) return { ok: false, msg: '密码必须包含数字' };

    try {
      // 检查用户名是否存在
      const { data: existing } = await db.from('users').select('id').eq('username', username).maybeSingle();
      if (existing) return { ok: false, msg: '该用户名已被注册' };

      const passwordHash = this._hash(password);
      await db.from('users').insert({ username, password: passwordHash });
      return { ok: true };
    } catch (e) {
      return { ok: false, msg: '网络错误，请重试' };
    }
  },

  /** 登录 */
  async login(username, password) {
    username = username.trim();
    if (!username || !password) return { ok: false, msg: '请填写用户名和密码' };

    try {
      const { data: user } = await db.from('users').select('*').eq('username', username).maybeSingle();
      if (!user) return { ok: false, msg: '用户名不存在' };

      const hash = this._hash(password);
      if (hash !== user.password) return { ok: false, msg: '密码错误' };

      sessionStorage.setItem(this.SESSION_KEY, username);
      return { ok: true };
    } catch (e) {
      return { ok: false, msg: '网络错误，请重试' };
    }
  },

  currentUser() {
    return sessionStorage.getItem(this.SESSION_KEY);
  },

  isLoggedIn() {
    return !!this.currentUser();
  },

  logout() {
    sessionStorage.removeItem(this.SESSION_KEY);
  }
};

// ===================================================================
// 登录页面
// ===================================================================
(function initLogin() {
  const overlay = document.getElementById('loginOverlay');
  const loginForm = document.getElementById('loginForm');
  const registerForm = document.getElementById('registerForm');
  const loginError = document.getElementById('loginError');
  const regError = document.getElementById('regError');

  if (Auth.isLoggedIn()) { overlay.classList.add('hidden'); return; }

  document.getElementById('switchToRegister').querySelector('a').addEventListener('click', e => {
    e.preventDefault();
    loginForm.style.display = 'none';
    registerForm.style.display = 'block';
    document.getElementById('switchToRegister').style.display = 'none';
    document.getElementById('switchToLogin').style.display = 'inline';
    loginError.textContent = ''; regError.textContent = '';
  });
  document.getElementById('switchToLogin').querySelector('a').addEventListener('click', e => {
    e.preventDefault();
    registerForm.style.display = 'none';
    loginForm.style.display = 'block';
    document.getElementById('switchToLogin').style.display = 'none';
    document.getElementById('switchToRegister').style.display = 'inline';
    loginError.textContent = ''; regError.textContent = '';
  });

  loginForm.addEventListener('submit', async e => {
    e.preventDefault(); loginError.textContent = '';
    const u = document.getElementById('loginUsername').value;
    const p = document.getElementById('loginPassword').value;
    const btn = loginForm.querySelector('button');
    btn.disabled = true; btn.textContent = '登录中...';
    const r = await Auth.login(u, p);
    if (r.ok) location.reload();
    else { loginError.textContent = r.msg; btn.disabled = false; btn.textContent = '登 录'; }
  });

  registerForm.addEventListener('submit', async e => {
    e.preventDefault(); regError.textContent = '';
    const u = document.getElementById('regUsername').value;
    const p = document.getElementById('regPassword').value;
    const p2 = document.getElementById('regPassword2').value;
    if (p !== p2) { regError.textContent = '两次密码不一致'; return; }
    const btn = registerForm.querySelector('button');
    btn.disabled = true; btn.textContent = '注册中...';
    const r = await Auth.register(u, p);
    if (r.ok) { await Auth.login(u, p); location.reload(); }
    else { regError.textContent = r.msg; btn.disabled = false; btn.textContent = '注 册'; }
  });
})();
