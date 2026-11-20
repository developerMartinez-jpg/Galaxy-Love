import { useEffect, useRef } from 'react'

/** Living galaxy: twinkling stars, drifting particles, tiny hearts and the odd shooting star. */
export default function Background() {
  const ref = useRef(null)
  useEffect(() => {
    const cv = ref.current, g = cv.getContext('2d')
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    let W, H, dpr, raf, stars = [], dust = [], hearts = [], shooters = []
    const R = (a, b) => a + Math.random() * (b - a)

    const init = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 2)
      W = window.innerWidth; H = window.innerHeight
      cv.width = W * dpr; cv.height = H * dpr
      g.setTransform(dpr, 0, 0, dpr, 0, 0)
      const area = W * H
      stars = Array.from({ length: Math.min(320, Math.round(area / 5500)) }, () => ({
        x: R(0, W), y: R(0, H), r: R(0.3, 1.6), t: R(0, 6.28), s: R(0.4, 2.2),
        c: ['#ffffff', '#ffe8ff', '#cfe3ff', '#ffd9f0'][Math.floor(R(0, 4))]
      }))
      dust = Array.from({ length: Math.round(area / 26000) }, () => ({ x: R(0, W), y: R(0, H), r: R(1, 3), vx: R(-0.12, 0.12), vy: R(-0.2, -0.04), a: R(0.15, 0.5) }))
      hearts = Array.from({ length: Math.max(5, Math.round(area / 90000)) }, () => ({ x: R(0, W), y: R(0, H), s: R(9, 18), vy: R(-0.3, -0.1), sway: R(0, 6.28), a: R(0.18, 0.4) }))
    }
    init()
    window.addEventListener('resize', init)

    let last = performance.now(), nextShoot = last + 2500
    const draw = (now) => {
      raf = requestAnimationFrame(draw)
      const dt = Math.min(50, now - last); last = now
      g.clearRect(0, 0, W, H)
      for (const s of stars) {
        s.t += dt * 0.001 * s.s
        const a = reduce ? 0.7 : 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(s.t))
        g.globalAlpha = a; g.fillStyle = s.c
        g.beginPath(); g.arc(s.x, s.y, s.r, 0, 6.283); g.fill()
        if (s.r > 1.3) { g.globalAlpha = a * 0.5; g.fillRect(s.x - s.r * 3, s.y - 0.4, s.r * 6, 0.8); g.fillRect(s.x - 0.4, s.y - s.r * 3, 0.8, s.r * 6) }
      }
      if (!reduce) {
        for (const d of dust) {
          d.x += d.vx * dt * 0.06; d.y += d.vy * dt * 0.06
          if (d.y < -5) { d.y = H + 5; d.x = R(0, W) }
          if (d.x < -5) d.x = W + 5; if (d.x > W + 5) d.x = -5
          const gr = g.createRadialGradient(d.x, d.y, 0, d.x, d.y, d.r * 4)
          gr.addColorStop(0, `rgba(255,214,250,${d.a})`); gr.addColorStop(1, 'rgba(255,214,250,0)')
          g.globalAlpha = 1; g.fillStyle = gr; g.fillRect(d.x - d.r * 4, d.y - d.r * 4, d.r * 8, d.r * 8)
        }
        g.font = '16px "Apple Color Emoji","Segoe UI Emoji",sans-serif'; g.textAlign = 'center'
        for (const h of hearts) {
          h.y += h.vy * dt * 0.06; h.sway += dt * 0.0012
          if (h.y < -30) { h.y = H + 30; h.x = R(0, W) }
          g.globalAlpha = h.a; g.font = `${h.s}px "Apple Color Emoji","Segoe UI Emoji",sans-serif`
          g.fillText('💜', h.x + Math.sin(h.sway) * 14, h.y)
        }
        if (now > nextShoot) {
          nextShoot = now + R(3500, 9000)
          const a = R(0.35, 0.6)
          shooters.push({ x: R(W * 0.2, W), y: R(0, H * 0.4), vx: -Math.cos(a) * 9, vy: Math.sin(a) * 9, life: 0 })
        }
        shooters = shooters.filter((s) => s.life < 70)
        for (const s of shooters) {
          s.life++; s.x += s.vx; s.y += s.vy
          const gr = g.createLinearGradient(s.x, s.y, s.x - s.vx * 9, s.y - s.vy * 9)
          gr.addColorStop(0, 'rgba(255,255,255,0.95)'); gr.addColorStop(1, 'rgba(255,180,240,0)')
          g.globalAlpha = 1 - s.life / 70; g.strokeStyle = gr; g.lineWidth = 2
          g.beginPath(); g.moveTo(s.x, s.y); g.lineTo(s.x - s.vx * 9, s.y - s.vy * 9); g.stroke()
        }
      }
      g.globalAlpha = 1
    }
    raf = requestAnimationFrame(draw)
    const vis = () => { if (document.hidden) cancelAnimationFrame(raf); else { last = performance.now(); raf = requestAnimationFrame(draw) } }
    document.addEventListener('visibilitychange', vis)
    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', init); document.removeEventListener('visibilitychange', vis) }
  }, [])

  return (
    <>
      <div className="nebula" aria-hidden="true"><i /><i /><i /><i /></div>
      <canvas ref={ref} className="bg-canvas" aria-hidden="true" />
    </>
  )
}
