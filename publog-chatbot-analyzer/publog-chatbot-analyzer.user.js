// ==UserScript==
// @name         퍼블로그 챗봇 품질 분석기
// @namespace    https://chatbot.publog.co.kr/
// @version      1.0
// @description  챗봇 어드민에 분석 버튼을 자동 추가. 클릭 한 번으로 빈응답·회피·환각·메뉴버그 리포트 생성.
// @match        https://chatbot.publog.co.kr/admin/*
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(function() {
  'use strict';

  // 이미 버튼이 있으면 중복 방지
  if (document.getElementById('publog-analyzer-btn')) return;

  // 플로팅 버튼 생성
  const btn = document.createElement('button');
  btn.id = 'publog-analyzer-btn';
  btn.textContent = '📊 품질 분석';
  btn.style.cssText = 'position:fixed;right:20px;bottom:20px;z-index:99999;padding:14px 22px;background:linear-gradient(135deg,#2563eb,#1d4ed8);color:white;border:none;border-radius:50px;font-size:15px;font-weight:bold;cursor:pointer;box-shadow:0 4px 16px rgba(37,99,235,0.4);font-family:"Malgun Gothic",sans-serif';
  btn.onmouseover = () => btn.style.transform = 'scale(1.05)';
  btn.onmouseout = () => btn.style.transform = 'scale(1)';
  document.body.appendChild(btn);

  btn.onclick = async function() {
    const days = parseInt(prompt('분석할 일수 (1~30, 기본 7):', '7') || '7', 10);
    const D = Math.min(Math.max(days, 1), 30);
    const cutoffStr = prompt('이 시각 이후만 (UTC ISO, 비우면 전체)\n예: 2026-04-17T09:00 = KST 4/17 18:00', '') || '';

    const w = window.open('', '_blank');
    w.document.write('<title>분석중...</title><body style="font-family:sans-serif;padding:40px"><h2>📡 데이터 수집 중...</h2><pre id="log" style="background:#f3f4f6;padding:16px;border-radius:8px"></pre></body>');
    const log = m => { w.document.getElementById('log').textContent += m + '\n'; };

    try {
      log('세션 목록 가져오는 중...');
      const sessions = [];
      for (let p=1; p<=10; p++) {
        const r = await fetch(`/api/admin/chat-history?days=${D}&limit=100&page=${p}`, {credentials:'include'});
        const j = await r.json();
        const arr = j.data || [];
        sessions.push(...arr);
        if (arr.length < 100) break;
      }
      const filtered = cutoffStr ? sessions.filter(s => s.started_at >= cutoffStr) : sessions;
      log(`전체 ${sessions.length}건 → 필터 후 ${filtered.length}건`);

      log('각 세션 메시지 가져오는 중...');
      const details = [];
      let i = 0;
      async function worker(){
        while (i < filtered.length) {
          const idx = i++;
          const s = filtered[idx];
          try {
            const r = await fetch('/api/admin/chat-history/' + encodeURIComponent(s.session_id), {credentials:'include'});
            const j = await r.json();
            details.push({meta: s, msgs: j.data?.data || j.data || []});
          } catch(e) { details.push({meta: s, msgs: []}); }
          if (idx % 10 === 0) log(`  ${idx+1}/${filtered.length}`);
        }
      }
      await Promise.all(Array.from({length: 8}, worker));
      log('분석 중...');

      const isMenuQ = q => /^[1-6]번?$/.test(q.trim()) || /^[a-z]$/i.test(q.trim());
      const evasiveRx = /상담사|상담원|고객센터|1544|1:1 문의|확인이 어려|확인이 필요|정확한 안내|정확한 내용은 사이트|드릴 수 없|확실하지|판단이 어려|문의 부탁|안내 문서에 없|명시되어 있지 않|명시되지 않/;
      const hallucinationRx = /\d시간 이내에 자동|10분 이내|1시간 이내.*취소|평일에만 제작|토요일.*제작|토요일.*포함/;
      const menuLabelRx = /^(배송 조회|취소\/환불|쿠폰 사용|결제 오류|대량 주문|제품 불량|상담원 연결|상담원연결|주문\/배송 문의|반품\/교환|제작\/파일 문의|가격\/할인\/쿠폰)$/;
      const kbGapRx = /(안내 문서에 없|명시되어 있지 않|명시되지 않)/;

      const sessions_qa = details.map(d => {
        const msgs = d.msgs || [];
        const pairs = [];
        for (let k=0; k<msgs.length; k++) {
          if (msgs[k].role === 'user') {
            let ans = '';
            for (let j=k+1; j<msgs.length; j++) {
              if (msgs[j].role === 'assistant') { ans = msgs[j].content; break; }
              if (msgs[j].role === 'user') break;
            }
            pairs.push({q: msgs[k].content, a: ans, cat: msgs[k].question_category});
          }
        }
        return {at: d.meta.started_at, sid: d.meta.session_id, cat: d.meta.question_category, pairs};
      });

      const allMeaningful = sessions_qa.flatMap(s => s.pairs.filter(p => p.q && p.q.length > 3 && !isMenuQ(p.q)));
      const empty = allMeaningful.filter(p => !p.a);
      const evasive = allMeaningful.filter(p => p.a && evasiveRx.test(p.a));
      const hallucination = allMeaningful.filter(p => p.a && hallucinationRx.test(p.a));
      const menuBugs = sessions_qa.flatMap(s => s.pairs.filter(p => menuLabelRx.test(p.q.trim()) && !p.a));
      const kbGap = allMeaningful.filter(p => p.a && kbGapRx.test(p.a));
      const ok = allMeaningful.filter(p => p.a && !evasiveRx.test(p.a) && !hallucinationRx.test(p.a));

      const repeats = [];
      for (const s of sessions_qa) {
        const seen = new Map();
        for (const p of s.pairs) {
          const k = p.q.trim();
          if (k.length < 5) continue;
          seen.set(k, (seen.get(k) || 0) + 1);
        }
        for (const [q, c] of seen) if (c >= 2) repeats.push({sid: s.sid, q, count: c});
      }

      const stats = {sessions: sessions_qa.length, meaningfulQA: allMeaningful.length, empty: empty.length, evasive: evasive.length, hallucination: hallucination.length, menuBugs: menuBugs.length, kbGap: kbGap.length, repeats: repeats.length, ok: ok.length};
      const byCat = {};
      for (const p of allMeaningful) {
        const c = p.cat || '(없음)';
        byCat[c] = byCat[c] || {total:0, bad:0};
        byCat[c].total++;
        if (!p.a || evasiveRx.test(p.a)) byCat[c].bad++;
      }
      const catRanked = Object.entries(byCat).map(([k,v])=>({cat:k, ...v, pct: Math.round(v.bad/v.total*100)})).sort((a,b)=>b.bad-a.bad);

      const esc = s => String(s||'').replace(/[<>&]/g, c => ({'<':'&lt;','>':'&gt;','&':'&amp;'}[c]));
      const truncate = (s, n) => (s||'').length > n ? (s||'').substring(0,n) + '…' : (s||'');
      const renderList = (items, mapper, max=30) => items.slice(0,max).map(mapper).join('') + (items.length > max ? `<p style="color:#888">… 외 ${items.length-max}건 (JSON 다운로드에 전체 포함)</p>` : '');

      const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>퍼블로그 챗봇 분석 리포트</title>
<style>body{font-family:'Malgun Gothic',sans-serif;max-width:1200px;margin:24px auto;padding:24px;background:#f5f7fa;color:#222}h1{color:#2563eb}.stats{display:grid;grid-template-columns:repeat(5,1fr);gap:12px;margin:20px 0}.stat{background:white;padding:16px;border-radius:8px;text-align:center;box-shadow:0 1px 3px rgba(0,0,0,0.05)}.stat .v{font-size:28px;font-weight:bold;color:#2563eb}.stat.bad .v{color:#dc2626}.stat.warn .v{color:#d97706}.stat.ok .v{color:#059669}.stat .l{font-size:12px;color:#666;margin-top:4px}section{background:white;padding:20px;margin:16px 0;border-radius:8px;box-shadow:0 1px 3px rgba(0,0,0,0.05)}section h2{margin-top:0;border-bottom:2px solid #e5e7eb;padding-bottom:8px}.qa{padding:10px;margin:8px 0;border-left:3px solid #ddd;background:#fafafa;font-size:13px}.qa.bad{border-left-color:#dc2626;background:#fef2f2}.qa.warn{border-left-color:#d97706;background:#fffbeb}.qa .q{font-weight:bold;color:#1e293b}.qa .a{color:#475569;margin-top:4px;white-space:pre-wrap}table{width:100%;border-collapse:collapse;font-size:13px}th,td{text-align:left;padding:6px 10px;border-bottom:1px solid #eee}th{background:#f8fafc}.dl{display:inline-block;padding:8px 16px;background:#059669;color:white;text-decoration:none;border-radius:6px;margin:8px 4px}</style></head><body>
<h1>📊 퍼블로그 챗봇 품질 분석</h1>
<p>대상: ${stats.sessions}세션 / 의미있는 Q&amp;A ${stats.meaningfulQA}건 · 기간: ${D}일${cutoffStr ? ' (필터: ' + cutoffStr + ' 이후)' : ''}</p>
<div class="stats">
<div class="stat"><div class="v">${stats.sessions}</div><div class="l">세션</div></div>
<div class="stat"><div class="v">${stats.meaningfulQA}</div><div class="l">Q&amp;A</div></div>
<div class="stat bad"><div class="v">${stats.empty}<small style="font-size:14px">/${Math.round(stats.empty/stats.meaningfulQA*100)||0}%</small></div><div class="l">빈 응답</div></div>
<div class="stat warn"><div class="v">${stats.evasive}<small style="font-size:14px">/${Math.round(stats.evasive/stats.meaningfulQA*100)||0}%</small></div><div class="l">회피</div></div>
<div class="stat ok"><div class="v">${stats.ok}<small style="font-size:14px">/${Math.round(stats.ok/stats.meaningfulQA*100)||0}%</small></div><div class="l">정상</div></div>
</div>
<div class="stats">
<div class="stat warn"><div class="v">${stats.hallucination}</div><div class="l">환각 의심</div></div>
<div class="stat bad"><div class="v">${stats.menuBugs}</div><div class="l">메뉴 버그</div></div>
<div class="stat warn"><div class="v">${stats.kbGap}</div><div class="l">KB 누락</div></div>
<div class="stat warn"><div class="v">${stats.repeats}</div><div class="l">반복 질문</div></div>
<div class="stat"><div class="v">${catRanked.length}</div><div class="l">카테고리</div></div>
</div>
<a class="dl" href="data:application/json;charset=utf-8,${encodeURIComponent(JSON.stringify({stats, catRanked, sessions_qa}, null, 2))}" download="publog-chatbot-${new Date().toISOString().slice(0,10)}.json">📥 JSON 다운로드</a>
<section><h2>🔴 빈 응답 (${empty.length})</h2>${renderList(empty, p => `<div class="qa bad"><div class="q">Q: ${esc(truncate(p.q,200))}</div><div style="font-size:11px;color:#94a3b8">카테고리: ${esc(p.cat||'-')}</div></div>`)}</section>
<section><h2>🔄 메뉴 라우팅 버그 (${menuBugs.length})</h2>${menuBugs.length === 0 ? '<p>없음</p>' : renderList(menuBugs, p => `<div class="qa bad"><div class="q">메뉴: ${esc(p.q)}</div><div style="font-size:11px;color:#94a3b8">→ 빈 응답</div></div>`)}</section>
<section><h2>🟠 환각 의심 (${hallucination.length})</h2>${hallucination.length === 0 ? '<p>없음</p>' : renderList(hallucination, p => `<div class="qa warn"><div class="q">Q: ${esc(truncate(p.q,150))}</div><div class="a">A: ${esc(truncate(p.a,300))}</div></div>`)}</section>
<section><h2>📚 KB 누락 (${kbGap.length})</h2>${renderList(kbGap, p => `<div class="qa warn"><div class="q">Q: ${esc(truncate(p.q,200))}</div><div class="a">A: ${esc(truncate(p.a,300))}</div></div>`)}</section>
<section><h2>🔁 반복 질문 (${repeats.length})</h2>${repeats.length === 0 ? '<p>없음</p>' : `<table><tr><th>질문</th><th>반복</th></tr>${repeats.map(r => `<tr><td>${esc(truncate(r.q,250))}</td><td>${r.count}회</td></tr>`).join('')}</table>`}</section>
<section><h2>📊 카테고리별 회피율</h2><table><tr><th>카테고리</th><th>총</th><th>빈/회피</th><th>회피율</th></tr>${catRanked.map(c => `<tr><td>${esc(c.cat)}</td><td>${c.total}</td><td>${c.bad}</td><td>${c.pct}%</td></tr>`).join('')}</table></section>
<section><h2>🟡 회피 답변 전체 (${evasive.length})</h2>${renderList(evasive, p => `<div class="qa warn"><div class="q">Q: ${esc(truncate(p.q,200))}</div><div class="a">A: ${esc(truncate(p.a,300))}</div></div>`, 50)}</section>
<p style="color:#888;font-size:12px;text-align:center;margin-top:40px">생성 시각: ${new Date().toLocaleString('ko-KR')}</p>
</body></html>`;
      w.document.open();
      w.document.write(html);
      w.document.close();
    } catch (e) {
      log('❌ 오류: ' + e.message);
    }
  };
})();
