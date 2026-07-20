// ABOUTME: Shared canvas engine for the constellation star-map pages (index + cluster drill-downs).
// ABOUTME: Each page supplies NODE_DEFS/EDGE_LIST and calls initConstellation() with that data.

function initConstellation(NODE_DEFS, EDGE_LIST) {
  const canvas  = document.getElementById('c');
  const ctx     = canvas.getContext('2d');
  const ui      = document.getElementById('ui');
  const tooltip = document.getElementById('tooltip');

  let W, H;
  let nodes = [], conns = [], particles = [], ripples = [];
  let hovered = null, labelEls = [], lastSpawn = 0;

  function rgba(hex, a) {
    const n = parseInt(hex.replace('#',''), 16);
    return `rgba(${(n>>16)&255},${(n>>8)&255},${n&255},${a})`;
  }

  function bezierPt(t, p0, cp, p1) {
    const u = 1 - t;
    return { x: u*u*p0.x + 2*u*t*cp.x + t*t*p1.x, y: u*u*p0.y + 2*u*t*cp.y + t*t*p1.y };
  }

  function radialGlow(x, y, r, color, alpha) {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0,   rgba(color, alpha));
    g.addColorStop(0.5, rgba(color, alpha * 0.4));
    g.addColorStop(1,   rgba(color, 0));
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI*2); ctx.fill();
  }

  function init() {
    W = canvas.width  = window.innerWidth;
    H = canvas.height = window.innerHeight;

    const mobile = Math.min(W, H) < 768;
    const sizeScale = mobile ? 0.55 : 1.0;

    nodes = NODE_DEFS.map(d => ({
      ...d,
      x: d.rx * W, y: d.ry * H,
      size: d.size * sizeScale,
      breath: Math.random() * Math.PI * 2,
      pulse: 0,
    }));

    conns = EDGE_LIST.map(([a, b]) => {
      const na = nodes[a], nb = nodes[b];
      const mx = (na.x + nb.x) / 2, my = (na.y + nb.y) / 2;
      const dx = nb.x - na.x,       dy = nb.y - na.y;
      const len = Math.hypot(dx, dy);
      const curl = ((a + b) % 2 === 0 ? 1 : -1) * len * 0.18;
      return {
        a, b,
        cp: { x: mx - (dy / len) * curl, y: my + (dx / len) * curl },
        glowPhase: Math.random() * Math.PI * 2,
      };
    });

    ui.innerHTML = '';
    labelEls = nodes.map(n => {
      const el = document.createElement('div');
      el.className = 'lbl';
      el.style.color = n.color;
      el.appendChild(document.createTextNode(n.label));
      if (n.type !== 'hub') {
        const b = document.createElement('span');
        b.className = `badge badge-${n.type}`;
        b.textContent = ({ tools: 'TOOL', oss: 'OSS', writing: 'ARTICLE' })[n.type] || n.type.toUpperCase();
        el.appendChild(b);
      }
      ui.appendChild(el);
      return el;
    });

    particles = []; ripples = [];
    conns.forEach((c, i) => setTimeout(() => spawn(c), i * 60 + Math.random() * 200));
  }

  function spawn(conn) {
    const dir   = Math.random() > 0.5 ? 1 : -1;
    const fromI = dir > 0 ? conn.a : conn.b;
    const toI   = dir > 0 ? conn.b : conn.a;
    particles.push({
      conn, fromI, toI, t: 0,
      speed: 0.0010 + Math.random() * 0.0018,
      trail: [], color: nodes[fromI].color, sz: 1.8 + Math.random() * 1.4,
    });
  }

  function launch(n) {
    if (!n.action) return;
    if (n.external === false) window.location.href = n.action;
    else window.open(n.action, '_blank');
  }

  function frame(ts) {
    ctx.clearRect(0, 0, W, H);

    const bg = ctx.createRadialGradient(W/2, H/2, 0, W/2, H/2, Math.hypot(W, H) * 0.6);
    bg.addColorStop(0, '#0c0c18');
    bg.addColorStop(1, '#020308');
    ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);

    // Connections
    conns.forEach(c => {
      const na = nodes[c.a], nb = nodes[c.b];
      const lit = hovered && (c.a === hovered.id || c.b === hovered.id);
      const pulse = 0.04 + 0.018 * Math.sin(ts * 0.0007 + c.glowPhase);
      ctx.beginPath(); ctx.moveTo(na.x, na.y);
      ctx.quadraticCurveTo(c.cp.x, c.cp.y, nb.x, nb.y);
      ctx.strokeStyle = lit ? 'rgba(255,255,255,0.26)' : `rgba(160,160,255,${pulse})`;
      ctx.lineWidth   = lit ? 1.2 : 0.55;
      ctx.stroke();
    });

    // Particles
    particles = particles.filter(p => {
      const na  = nodes[p.fromI], nb = nodes[p.toI];
      const pos = bezierPt(p.t, na, p.conn.cp, nb);
      p.trail.unshift({ x: pos.x, y: pos.y });
      if (p.trail.length > 18) p.trail.pop();

      p.trail.forEach((pt, i) => {
        const alpha = (1 - i / p.trail.length) * 0.65;
        const sz    = p.sz * (1 - i / p.trail.length) * 0.6;
        if (sz < 0.2) return;
        ctx.beginPath(); ctx.arc(pt.x, pt.y, sz, 0, Math.PI*2);
        ctx.fillStyle = rgba(p.color, alpha); ctx.fill();
      });
      radialGlow(pos.x, pos.y, p.sz * 5, p.color, 0.25);
      ctx.beginPath(); ctx.arc(pos.x, pos.y, p.sz * 1.1, 0, Math.PI*2);
      ctx.fillStyle = '#ffffff'; ctx.fill();
      ctx.beginPath(); ctx.arc(pos.x, pos.y, p.sz * 0.5, 0, Math.PI*2);
      ctx.fillStyle = p.color; ctx.fill();

      p.t += p.speed;
      if (p.t >= 1) { nodes[p.toI].pulse = 1.0; return false; }
      return true;
    });

    // Respawn particles
    if (ts - lastSpawn > 500) {
      lastSpawn = ts;
      const c = conns[Math.floor(Math.random() * conns.length)];
      if (particles.filter(p => p.conn === c).length < 2) spawn(c);
    }

    // Nodes
    nodes.forEach(n => {
      const isHov  = hovered === n;
      const breath = 1 + 0.09 * Math.sin(ts * 0.0009 + n.breath);
      const r      = n.size * breath * (1 + n.pulse * 0.45);

      radialGlow(n.x, n.y, r * 7,   n.color, 0.07 + n.pulse * 0.14 + (isHov ? 0.10 : 0));
      radialGlow(n.x, n.y, r * 3.5, n.color, 0.22 + n.pulse * 0.38 + (isHov ? 0.18 : 0));
      ctx.beginPath(); ctx.arc(n.x, n.y, r, 0, Math.PI*2);
      ctx.fillStyle = isHov ? '#ffffff' : rgba(n.color, 0.92); ctx.fill();
      ctx.beginPath(); ctx.arc(n.x, n.y, r * 2.1, 0, Math.PI*2);
      ctx.strokeStyle = rgba(n.color, 0.18 + (isHov ? 0.28 : 0) + n.pulse * 0.28);
      ctx.lineWidth = 0.8; ctx.stroke();

      if (n.expands) {
        const pulse2 = 0.5 + 0.5 * Math.sin(ts * 0.0016 + n.breath);
        ctx.beginPath(); ctx.arc(n.x, n.y, r * 2.9, 0, Math.PI*2);
        ctx.strokeStyle = rgba(n.color, 0.14 + pulse2 * 0.18 + (isHov ? 0.2 : 0));
        ctx.lineWidth = 1.1; ctx.stroke();
      }

      n.pulse = Math.max(0, n.pulse - 0.022);
    });

    // Ripples
    ripples = ripples.filter(rp => {
      rp.r += 3.8; rp.a -= 0.02;
      if (rp.a <= 0) return false;
      ctx.beginPath(); ctx.arc(rp.x, rp.y, rp.r, 0, Math.PI*2);
      ctx.strokeStyle = rgba(rp.color, rp.a); ctx.lineWidth = 1.2; ctx.stroke();
      return true;
    });

    // Labels
    const mobile = Math.min(W, H) < 768;
    nodes.forEach((n, i) => {
      const el = labelEls[i];
      const r  = n.size * (1 + n.pulse * 0.45);
      el.style.left    = n.x + 'px';
      el.style.top     = (n.y + r * 2.9) + 'px';
      el.style.opacity = hovered === n ? '1' : '0.45';
      el.style.fontSize = n.id === 0 ? (mobile ? '9px' : '12px') : (mobile ? '7px' : '10px');
    });

    requestAnimationFrame(frame);
  }

  window.addEventListener('resize', init);

  canvas.addEventListener('mousemove', e => {
    hovered = null; tooltip.style.display = 'none';
    for (const n of nodes) {
      if (Math.hypot(n.x - e.clientX, n.y - e.clientY) < n.size * 3.5) {
        hovered = n; canvas.style.cursor = 'pointer';
        document.getElementById('tt-name').textContent = n.label;
        document.getElementById('tt-desc').textContent = n.desc || '';
        tooltip.style.display = 'block';
        tooltip.style.left = Math.min(e.clientX + 18, W - 275) + 'px';
        tooltip.style.top  = Math.max(e.clientY - 14, 8) + 'px';
        return;
      }
    }
    canvas.style.cursor = 'crosshair';
  });

  canvas.addEventListener('mouseleave', () => { tooltip.style.display = 'none'; hovered = null; });

  canvas.addEventListener('click', e => {
    for (const n of nodes) {
      if (Math.hypot(n.x - e.clientX, n.y - e.clientY) < n.size * 3.5) {
        n.pulse = 1.6; tooltip.style.display = 'none';
        for (let i = 0; i < 3; i++)
          ripples.push({ x: n.x, y: n.y, r: n.size * 0.8, a: 0.75, color: n.color });
        conns.filter(c => c.a === n.id || c.b === n.id).forEach(c => spawn(c));
        launch(n);
        break;
      }
    }
  });

  init();
  requestAnimationFrame(frame);
}
