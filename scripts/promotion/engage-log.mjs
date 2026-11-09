import {readFileSync} from 'node:fs';
import path from 'node:path';

// Renders the W8 conversation log into the automatic section of docs/promotion.md.
// Other people's comment text stays in the server state; only indiek's own replies are quoted here.
const LABELS={
  'reply-published':'자동 답글 게시','approved-published':'승인 답글 게시','queued':'승인 대기 등록','held-sensitive':'민감 주제 보류',
  'rejected-review':'검수 반려 · 미게시','skipped':'건너뜀','rejected':'운영자 거절','expired':'만료 · 미게시','stop':'중단',
  'pause':'운영자 중단','resume':'재개','permission-missing':'권한 없음 · 동작 안 함','disclosure-missing':'프로필 AI 안내 없음 · 동작 안 함',
  'daily-limit':'일일 한도 도달','discovery-unavailable':'대화 탐색 불가','reconciled':'게시 결과 확인',
};
const kst = iso => {const d=new Date(Date.parse(iso)+9*3600000).toISOString();return `${d.slice(0,10)} ${d.slice(11,16)} KST`;};
export function engageSummary(state,now=new Date(),days=7) {
  const since=now.getTime()-days*86400000,recent=(state?.actions||[]).filter(a=>Date.parse(a.at)>=since);
  const count=type=>recent.filter(a=>a.action===type).length;
  const approved=count('approved-published'),rejected=count('rejected');
  return {days,ownReplies:count('reply-published'),externalReplies:approved,operatorRejected:rejected,approvalRate:approved+rejected?Math.round(approved/(approved+rejected)*100):null,queued:count('queued'),heldSensitive:count('held-sensitive'),reviewRejected:count('rejected-review'),stops:count('stop'),pending:(state?.items||[]).filter(i=>i.status==='pending-approval').length,paused:state?state.control?.paused||null:{kind:'not-started',reason:'No engagement run yet.'}};
}
export function engageMarkdown(root,now=new Date()) {
  let state;
  try{state=JSON.parse(readFileSync(path.join(root,'promotion/state/engage/state.json'),'utf8'));}catch(error){if(error.code==='ENOENT')return '';throw error;}
  const s=engageSummary(state,now);
  const status=s.paused?`중지 · ${s.paused.kind}: ${s.paused.reason}`:'운영 중';
  const lines=state.actions.map(a=>{
    const target=a.target?` · [대상](${a.target})`:'',reply=a.replyPermalink?` → [답글](${a.replyPermalink})`:'';
    const who=a.author?` · @${a.author}`:'';
    const text=a.replyText?`\n  > ${a.replyText.replace(/\n/g,' ')}`:'';
    return `- ${kst(a.at)} · ${LABELS[a.action]||a.action}${a.itemId?` · ${a.itemId}`:''}${who}${target}${reply}${a.detail?` · ${a.detail}`:''}${text}`;
  });
  return `### 대화 기록 · Threads 답글 (W8)\n\n- 상태: ${status}\n- 최근 7일: 자동 답글 ${s.ownReplies}, 승인 답글 ${s.externalReplies}, 운영자 거절 ${s.operatorRejected}, 승인률 ${s.approvalRate??'–'}%, 승인 대기 ${s.pending}, 민감 주제 보류 ${s.heldSensitive}, 중단 ${s.stops}\n- 댓글 원문은 서버 상태에만 두고 이 기록에는 indiek 답글만 남긴다.\n\n${lines.join('\n')||'- 기록 없음'}\n`;
}
