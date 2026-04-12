#!/usr/bin/env node
/**
 * Encrypts landing/index.html with AES-256-GCM (PBKDF2 key derivation)
 * Generates landing/index.encrypted.html — self-decrypting page with password prompt
 *
 * Usage: node landing/encrypt.js
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PASSWORD = 'ghiokn478aklslx939498nbcbj';
const SALT_LEN = 16;
const IV_LEN = 12;
const ITERATIONS = 100000;

const srcPath = path.join(__dirname, 'index.html');
const outPath = path.join(__dirname, 'index.encrypted.html');

// Read original HTML
const html = fs.readFileSync(srcPath, 'utf8');

// Generate salt and IV
const salt = crypto.randomBytes(SALT_LEN);
const iv = crypto.randomBytes(IV_LEN);

// Derive key via PBKDF2
const key = crypto.pbkdf2Sync(PASSWORD, salt, ITERATIONS, 32, 'sha256');

// Encrypt with AES-256-GCM
const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
let encrypted = cipher.update(html, 'utf8');
encrypted = Buffer.concat([encrypted, cipher.final()]);
const authTag = cipher.getAuthTag();

// Pack: salt(16) + iv(12) + authTag(16) + ciphertext → base64
const packed = Buffer.concat([salt, iv, authTag, encrypted]).toString('base64');

// Generate the wrapper HTML
const wrapper = `<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1.0"/>
<title>VirtCardPay — Доступ</title>
<link rel="icon" type="image/svg+xml" href="/public/favicon.svg?v=2"/>
<style>
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800&display=swap');
body{
  font-family:'Inter',sans-serif;
  background:#e8ecf1;
  min-height:100vh;
  display:flex;align-items:center;justify-content:center;
  padding:20px;
}
.gate{
  width:100%;max-width:420px;
  background:#e8ecf1;
  border-radius:24px;
  padding:48px 36px;
  text-align:center;
  box-shadow:12px 12px 28px rgba(163,177,198,.55),
             -12px -12px 28px rgba(255,255,255,.9);
}
.gate__logo{
  display:inline-flex;align-items:center;gap:10px;
  margin-bottom:32px;
}
.gate__logo-icon{
  width:40px;height:40px;border-radius:12px;
  background:linear-gradient(135deg,#3B82F6,#1D4ED8);
  display:flex;align-items:center;justify-content:center;
}
.gate__logo-icon svg{width:22px;height:22px;fill:white}
.gate__logo-text{font-size:20px;font-weight:800;color:#0F172A}
.gate__logo-text span{color:#3B82F6}
.gate__title{font-size:16px;color:#475569;margin-bottom:28px;font-weight:500}
.gate__input-wrap{
  position:relative;margin-bottom:20px;
}
.gate__input{
  width:100%;padding:16px 50px 16px 20px;
  border:none;border-radius:14px;
  background:#e8ecf1;
  box-shadow:inset 4px 4px 10px rgba(163,177,198,.6),
             inset -4px -4px 10px rgba(255,255,255,.95);
  font-size:15px;font-family:'Inter',sans-serif;
  color:#0F172A;outline:none;
  transition:box-shadow .25s;
}
.gate__input:focus{
  box-shadow:inset 4px 4px 10px rgba(59,130,246,.15),
             inset -4px -4px 10px rgba(255,255,255,.95);
}
.gate__input::placeholder{color:#94A3B8}
.gate__toggle{
  position:absolute;right:16px;top:50%;transform:translateY(-50%);
  background:none;border:none;cursor:pointer;color:#94A3B8;
  padding:4px;
}
.gate__toggle:hover{color:#3B82F6}
.gate__btn{
  width:100%;padding:16px;border:none;border-radius:14px;
  background:linear-gradient(135deg,#3B82F6,#1D4ED8);
  color:white;font-size:15px;font-weight:800;
  font-family:'Inter',sans-serif;cursor:pointer;
  box-shadow:0 6px 20px rgba(59,130,246,.35);
  transition:all .25s;
  display:flex;align-items:center;justify-content:center;gap:8px;
}
.gate__btn:hover{transform:translateY(-2px);box-shadow:0 10px 30px rgba(59,130,246,.4)}
.gate__btn:active{transform:translateY(0)}
.gate__error{
  color:#EF4444;font-size:13px;font-weight:600;
  margin-top:16px;opacity:0;transition:opacity .3s;
}
.gate__error.show{opacity:1}
.gate__hint{
  color:#94A3B8;font-size:11px;margin-top:20px;
}
@keyframes shake{
  0%,100%{transform:translateX(0)}
  20%,60%{transform:translateX(-8px)}
  40%,80%{transform:translateX(8px)}
}
.shake{animation:shake .4s ease}

@media(prefers-color-scheme:dark){
  body{background:#0B1120}
  .gate{
    background:#0F172A;
    box-shadow:12px 12px 28px rgba(0,0,0,.4),
               -12px -12px 28px rgba(255,255,255,.02);
  }
  .gate__logo-text{color:#F1F5F9}
  .gate__title{color:#94A3B8}
  .gate__input{
    background:#0F172A;color:#F1F5F9;
    box-shadow:inset 4px 4px 10px rgba(0,0,0,.5),
               inset -4px -4px 10px rgba(255,255,255,.04);
  }
  .gate__input:focus{
    box-shadow:inset 4px 4px 10px rgba(59,130,246,.1),
               inset -4px -4px 10px rgba(255,255,255,.04);
  }
  .gate__input::placeholder{color:#475569}
}
</style>
</head>
<body>

<div class="gate" id="gate">
  <div class="gate__logo">
    <div class="gate__logo-icon">
      <svg viewBox="0 0 24 24"><rect x="1" y="4" width="22" height="16" rx="2"/><path d="M1 10h22" fill="none" stroke="white" stroke-width="2"/></svg>
    </div>
    <div class="gate__logo-text">Virt<span>Card</span>Pay</div>
  </div>
  <div class="gate__title">Введите пароль для доступа</div>
  <div class="gate__input-wrap">
    <input class="gate__input" id="pwd" type="password" placeholder="Пароль" autocomplete="off" autofocus/>
    <button class="gate__toggle" id="togglePwd" type="button">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
    </button>
  </div>
  <button class="gate__btn" id="submitBtn">
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
    Войти
  </button>
  <div class="gate__error" id="error">Неверный пароль</div>
  <div class="gate__hint">Доступ только по приглашению</div>
</div>

<script id="enc-data" type="encrypted">${packed}</script>

<script>
(function(){
  var ITER=${ITERATIONS}, SALT_LEN=${SALT_LEN}, IV_LEN=${IV_LEN}, TAG_LEN=16;
  var CACHE_KEY='vcp_auth', CACHE_TTL=24*60*60*1000;

  // Check localStorage cache
  var cached = localStorage.getItem(CACHE_KEY);
  if(cached){
    try{
      var c=JSON.parse(cached);
      if(c.t && Date.now()-c.t<CACHE_TTL){
        decrypt(c.p);
        return;
      }else{localStorage.removeItem(CACHE_KEY)}
    }catch(e){localStorage.removeItem(CACHE_KEY)}
  }

  var gate=document.getElementById('gate');
  var pwd=document.getElementById('pwd');
  var err=document.getElementById('error');
  var btn=document.getElementById('submitBtn');
  var tog=document.getElementById('togglePwd');

  tog.addEventListener('click',function(){
    pwd.type=pwd.type==='password'?'text':'password';
  });

  function submit(){
    var p=pwd.value.trim();
    if(!p)return;
    btn.disabled=true;
    btn.textContent='Расшифровка...';
    setTimeout(function(){decrypt(p)},50);
  }

  btn.addEventListener('click',submit);
  pwd.addEventListener('keydown',function(e){if(e.key==='Enter')submit()});

  async function decrypt(password){
    try{
      var raw=atob(document.getElementById('enc-data').textContent.trim());
      var bytes=new Uint8Array(raw.length);
      for(var i=0;i<raw.length;i++)bytes[i]=raw.charCodeAt(i);

      var salt=bytes.slice(0,SALT_LEN);
      var iv=bytes.slice(SALT_LEN,SALT_LEN+IV_LEN);
      var tag=bytes.slice(SALT_LEN+IV_LEN,SALT_LEN+IV_LEN+TAG_LEN);
      var data=bytes.slice(SALT_LEN+IV_LEN+TAG_LEN);

      // Combine ciphertext + authTag for GCM
      var combined=new Uint8Array(data.length+TAG_LEN);
      combined.set(data);combined.set(tag,data.length);

      var enc=new TextEncoder();
      var keyMaterial=await crypto.subtle.importKey('raw',enc.encode(password),{name:'PBKDF2'},false,['deriveKey']);
      var key=await crypto.subtle.deriveKey({name:'PBKDF2',salt:salt,iterations:ITER,hash:'SHA-256'},keyMaterial,{name:'AES-GCM',length:256},false,['decrypt']);
      var decrypted=await crypto.subtle.decrypt({name:'AES-GCM',iv:iv},key,combined);
      var html=new TextDecoder().decode(decrypted);

      // Success — cache password
      localStorage.setItem(CACHE_KEY,JSON.stringify({p:password,t:Date.now()}));

      // Replace entire document
      document.open();document.write(html);document.close();
    }catch(e){
      // Wrong password
      if(btn){btn.disabled=false;btn.innerHTML='<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg> Войти';}
      if(err){err.classList.add('show')}
      if(gate){gate.classList.add('shake');setTimeout(function(){gate.classList.remove('shake')},400)}
      if(pwd){pwd.value='';pwd.focus()}
      localStorage.removeItem(CACHE_KEY);
    }
  }
})();
</script>
</body>
</html>`;

fs.writeFileSync(outPath, wrapper, 'utf8');
console.log(`✅ Encrypted: ${outPath}`);
console.log(`   Original size: ${(html.length/1024).toFixed(1)} KB`);
console.log(`   Encrypted size: ${(wrapper.length/1024).toFixed(1)} KB`);
console.log(`   Salt: ${salt.toString('hex')}`);
console.log(`   Password: ${PASSWORD.substring(0,4)}****`);
