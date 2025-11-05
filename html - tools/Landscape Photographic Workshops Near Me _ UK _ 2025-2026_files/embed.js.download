/*
  Lightweight embed script to launch the Alan Ranger Assistant chat UI on any site.
  Usage (Squarespace Global Header or Footer):
  <script async src="/embed.js" data-chat-src="/chat.html" data-position="br" data-color="#4CAF50"></script>

  Optional data-attributes:
    data-chat-src  - absolute or relative URL to chat.html (default: /chat.html)
    data-position  - br | bl (bottom-right default, bottom-left alternative)
    data-color     - hex color for launcher background (default: #4CAF50)
    data-size      - desktop max width/height in px (e.g., 420x640)
    data-offset    - CSS margin from edges (default: 20)
*/
(function(){
  if (window.__AlanChatEmbedLoaded) return; // idempotent
  window.__AlanChatEmbedLoaded = true;

  const doc = document;
  const scriptEl = doc.currentScript || (function(){ const s = doc.querySelector('script[src*="/embed.js"]'); return s || {}; })();
  const cfg = {
    chatSrc: scriptEl.getAttribute('data-chat-src') || '/chat.html',
    position: (scriptEl.getAttribute('data-position') || 'br').toLowerCase(),
    color: scriptEl.getAttribute('data-color') || '#4CAF50',
    size: scriptEl.getAttribute('data-size') || '420x640',
    offset: parseInt(scriptEl.getAttribute('data-offset') || '20', 10),
    ga4: scriptEl.getAttribute('data-ga4-id') || ''
  };
  // Read optional cache-busting version from script src (?v=...)
  let scriptVersion = '';
  try { const u = new URL(scriptEl.src, location.href); scriptVersion = u.searchParams.get('v') || ''; } catch {}
  if (!scriptVersion) { scriptVersion = String(Date.now()); }

  function ensureGA(){
    if (!cfg.ga4) return;
    if (window.gtag) return;
    window.dataLayer = window.dataLayer || [];
    function gtag(){ dataLayer.push(arguments); }
    window.gtag = gtag;
    gtag('js', new Date());
    gtag('config', cfg.ga4, { send_page_view: false, debug_mode: true });
    const s = doc.createElement('script'); s.async = true; s.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(cfg.ga4)}`;
    doc.head.appendChild(s);
  }

  function track(eventName, params){
    try{ if (window.gtag) window.gtag('event', eventName, { debug_mode: true, ...(params||{}) }); else if (window.dataLayer) window.dataLayer.push({ event: eventName, debug_mode: true, ...params }); }catch{}
  }

  function injectStyles(){
    const style = doc.createElement('style');
    style.id = 'alan-chat-embed-styles';
    style.textContent = `
      #alan-chat-launcher{position:fixed;z-index:2147483000;display:flex;align-items:center;justify-content:center;border-radius:999px;box-shadow:0 4px 18px rgba(0,0,0,0.3);width:56px;height:56px;color:#fff;cursor:pointer;}
      #alan-chat-launcher:hover{filter:brightness(1.05)}
      #alan-chat-frame-wrap{position:fixed;z-index:2147482999;display:none;background:rgba(0,0,0,0.35);} 
      #alan-chat-panel{position:absolute;background:#111;border-radius:12px;box-shadow:0 20px 60px rgba(0,0,0,0.45);overflow:hidden;border:1px solid rgba(255,255,255,0.08);min-width:400px;min-height:300px;max-width:90vw;max-height:90vh;}
      #alan-chat-panel .drag-handle{position:absolute;top:0;left:0;right:0;height:40px;cursor:move;z-index:5;background:transparent;}
      #alan-chat-panel.resizing{cursor:nw-resize}
      #alan-chat-resize-handle{position:absolute;bottom:0;right:0;width:20px;height:20px;background:#E57200;cursor:nw-resize;border-radius:0 0 12px 0;opacity:0.7;transition:opacity 0.2s;z-index:10;}
      #alan-chat-resize-handle:hover{opacity:1}
      #alan-chat-resize-handle::after{content:'';position:absolute;bottom:4px;right:4px;width:0;height:0;border-left:6px solid transparent;border-bottom:6px solid #0b0f16;} 
      #alan-chat-close{position:absolute;right:8px;top:8px;width:40px;height:40px;border-radius:999px;background:rgba(0,0,0,0.55);color:#fff;display:flex;align-items:center;justify-content:center;cursor:pointer;border:1px solid rgba(255,255,255,0.15);font-size:18px;font-weight:bold;transition:all 0.2s ease;z-index:20;padding:4px;}
      #alan-chat-close:hover{background:rgba(0,0,0,0.75);transform:scale(1.1);}
      #alan-chat-iframe{border:0;width:100%;height:100%;}
      @media (max-width: 768px){
        #alan-chat-panel{left:0!important;right:0!important;top:0!important;bottom:0!important;width:auto!important;height:auto!important;border-radius:0!important;}
        #alan-chat-frame-wrap{inset:0!important}
        #alan-chat-launcher{width:60px;height:60px;bottom:20px;right:20px;}
      }
      @media (max-width: 480px){
        #alan-chat-launcher{width:56px;height:56px;bottom:16px;right:16px;}
        #alan-chat-panel{border-radius:0!important;}
        #alan-chat-close{width:44px;height:44px;right:12px;top:12px;font-size:20px;}
      }
    `;
    doc.head.appendChild(style);
  }

  function createLauncher(){
    const btn = doc.createElement('div');
    btn.id = 'alan-chat-launcher';
    btn.setAttribute('aria-label','Open Alan Ranger Assistant');
    btn.style.background = cfg.color;
    const off = cfg.offset + 'px';
    if (cfg.position === 'bl') { btn.style.left = off; btn.style.bottom = off; }
    else { btn.style.right = off; btn.style.bottom = off; }
    btn.innerHTML = '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 3C7.03 3 3 6.58 3 11c0 2.02.93 3.84 2.47 5.19-.1.88-.44 2.34-1.39 3.86 0 0 2.02-.22 4.02-1.74.03-.02.05-.03.08-.05 1.12.38 2.33.59 3.64.59 4.97 0 9-3.58 9-8s-4.03-8-9-8z" fill="currentColor"/></svg>';
    btn.addEventListener('click', openPanel);
    doc.body.appendChild(btn);
  }

  function openPanel(){
    let wrap = doc.getElementById('alan-chat-frame-wrap');
    if (!wrap){
      ensureGA();
      wrap = doc.createElement('div');
      wrap.id = 'alan-chat-frame-wrap';
      wrap.style.inset = '0';
      doc.body.appendChild(wrap);

      const panel = doc.createElement('div');
      panel.id = 'alan-chat-panel';
      const [w,h] = cfg.size.split('x').map(v=>parseInt(v||'0',10));
      const off = cfg.offset;
      // Center the chat panel on screen instead of bottom-right/bottom-left
      const centerX = (window.innerWidth - (w||420)) / 2;
      const centerY = (window.innerHeight - (h||640)) / 2;
      const posStyles = {
        left: Math.max(off, centerX) + 'px',
        top: Math.max(off, centerY) + 'px'
      };
      Object.assign(panel.style, { width: (w||420)+'px', height: (h||640)+'px', ...posStyles });

      const close = doc.createElement('div');
      close.id = 'alan-chat-close';
      close.innerHTML = '&#10005;';
      close.addEventListener('click', ()=>{ wrap.style.display='none'; });
      panel.appendChild(close);

      const dragHandle = doc.createElement('div');
      dragHandle.className = 'drag-handle';
      panel.appendChild(dragHandle);

      const resizeHandle = doc.createElement('div');
      resizeHandle.id = 'alan-chat-resize-handle';
      panel.appendChild(resizeHandle);

      const iframe = doc.createElement('iframe');
      iframe.id = 'alan-chat-iframe';
      // Append parent page context so chat can log/display real host page, not /chat.html
      try{
        const u = new URL(cfg.chatSrc, location.origin);
        u.searchParams.set('parentUrl', location.href);
        u.searchParams.set('parentTitle', document.title || '');
        u.searchParams.set('parentHost', location.hostname || '');
        u.searchParams.set('parentPath', location.pathname || '');
        if (scriptVersion) u.searchParams.set('v', scriptVersion);
        iframe.src = u.toString();
      }catch{
        iframe.src = cfg.chatSrc;
      }
      iframe.setAttribute('title','Alan Ranger Assistant');
      iframe.setAttribute('loading','lazy');
      // Allow clipboard for Copy log button inside iframe
      try { iframe.allow = [iframe.allow||'', 'clipboard-read', 'clipboard-write'].filter(Boolean).join('; '); } catch{}
      panel.appendChild(iframe);

      wrap.appendChild(panel);

      // Add drag and resize functionality
      let isDragging = false;
      let isResizing = false;
      let startX, startY, startWidth, startHeight, startLeft, startTop;

      // Make panel draggable via drag handle
      dragHandle.addEventListener('mousedown', (e) => {
        isDragging = true;
        startX = e.clientX;
        startY = e.clientY;
        startLeft = panel.offsetLeft;
        startTop = panel.offsetTop;
        
        doc.body.style.userSelect = 'none';
        e.preventDefault();
      });

      // Handle resize
      resizeHandle.addEventListener('mousedown', (e) => {
        isResizing = true;
        startX = e.clientX;
        startY = e.clientY;
        startWidth = panel.offsetWidth;
        startHeight = panel.offsetHeight;
        
        panel.classList.add('resizing');
        doc.body.style.userSelect = 'none';
        e.preventDefault();
        e.stopPropagation();
      });

      // Mouse move handler
      doc.addEventListener('mousemove', (e) => {
        if (isDragging) {
          const deltaX = e.clientX - startX;
          const deltaY = e.clientY - startY;
          
          let newLeft = startLeft + deltaX;
          let newTop = startTop + deltaY;
          
          // Keep within viewport bounds
          const maxLeft = window.innerWidth - panel.offsetWidth;
          const maxTop = window.innerHeight - panel.offsetHeight;
          
          newLeft = Math.max(0, Math.min(newLeft, maxLeft));
          newTop = Math.max(0, Math.min(newTop, maxTop));
          
          panel.style.left = newLeft + 'px';
          panel.style.top = newTop + 'px';
          panel.style.right = 'auto';
          panel.style.bottom = 'auto';
        }
        
        if (isResizing) {
          const deltaX = e.clientX - startX;
          const deltaY = e.clientY - startY;
          
          let newWidth = startWidth + deltaX;
          let newHeight = startHeight + deltaY;
          
          // Enforce min/max constraints
          newWidth = Math.max(400, Math.min(newWidth, window.innerWidth - panel.offsetLeft));
          newHeight = Math.max(300, Math.min(newHeight, window.innerHeight - panel.offsetTop));
          
          panel.style.width = newWidth + 'px';
          panel.style.height = newHeight + 'px';
        }
      });

      // Mouse up handler
      doc.addEventListener('mouseup', () => {
        if (isDragging || isResizing) {
          isDragging = false;
          isResizing = false;
          panel.classList.remove('resizing');
          doc.body.style.userSelect = '';
        }
      });

      // Touch support for mobile
      dragHandle.addEventListener('touchstart', (e) => {
        isDragging = true;
        const touch = e.touches[0];
        startX = touch.clientX;
        startY = touch.clientY;
        startLeft = panel.offsetLeft;
        startTop = panel.offsetTop;
        
        e.preventDefault();
      });

      resizeHandle.addEventListener('touchstart', (e) => {
        isResizing = true;
        const touch = e.touches[0];
        startX = touch.clientX;
        startY = touch.clientY;
        startWidth = panel.offsetWidth;
        startHeight = panel.offsetHeight;
        
        panel.classList.add('resizing');
        e.preventDefault();
        e.stopPropagation();
      });

      doc.addEventListener('touchmove', (e) => {
        if (isDragging || isResizing) {
          const touch = e.touches[0];
          
          if (isDragging) {
            const deltaX = touch.clientX - startX;
            const deltaY = touch.clientY - startY;
            
            let newLeft = startLeft + deltaX;
            let newTop = startTop + deltaY;
            
            const maxLeft = window.innerWidth - panel.offsetWidth;
            const maxTop = window.innerHeight - panel.offsetHeight;
            
            newLeft = Math.max(0, Math.min(newLeft, maxLeft));
            newTop = Math.max(0, Math.min(newTop, maxTop));
            
            panel.style.left = newLeft + 'px';
            panel.style.top = newTop + 'px';
            panel.style.right = 'auto';
            panel.style.bottom = 'auto';
          }
          
          if (isResizing) {
            const deltaX = touch.clientX - startX;
            const deltaY = touch.clientY - startY;
            
            let newWidth = startWidth + deltaX;
            let newHeight = startHeight + deltaY;
            
            newWidth = Math.max(400, Math.min(newWidth, window.innerWidth - panel.offsetLeft));
            newHeight = Math.max(300, Math.min(newHeight, window.innerHeight - panel.offsetTop));
            
            panel.style.width = newWidth + 'px';
            panel.style.height = newHeight + 'px';
          }
          
          e.preventDefault();
        }
      });

      doc.addEventListener('touchend', () => {
        if (isDragging || isResizing) {
          isDragging = false;
          isResizing = false;
          panel.classList.remove('resizing');
        }
      });
    }
    wrap.style.display = 'block';

    // fire only once per browser session
    if (!sessionStorage.getItem('chat_started')) {
      track('chat_start', { source: 'embed', page_location: location.href });
      sessionStorage.setItem('chat_started', 'true');
    }
  }

  function init(){
    ensureGA();
    injectStyles();
    createLauncher();
  }

  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', init);
  else init();
})();


